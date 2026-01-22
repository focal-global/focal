/**
 * Anomaly Detection Dashboard
 * 
 * Real-time anomaly detection and alerting for cloud costs.
 * Runs ML models locally in the browser for privacy.
 * Features full drill-down capability with interactive visualizations.
 */

'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Activity,
  Shield,
  Zap,
  Target,
  Filter,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  XCircle,
  Info,
  Calendar,
  ChevronDown,
  ChevronUp,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  X
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from '@/components/ui/table';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  ReferenceLine,
  Brush
} from 'recharts';
import { useEnrichedSpectrum, UNIFIED_VIEW_NAME } from '@/components/providers';
import { useDataDetection } from '@/hooks/use-data-detection';
import { EmptyState } from '@/components/ui/empty-state';
import { useRouter, useSearchParams } from 'next/navigation';
import { formatCurrency, loadCurrencySettings } from '@/lib/currency';
import { 
  AnomalyDetectionEngine, 
  type AnomalyResult, 
  type AnomalyDetectionConfig,
  type TimeSeriesData 
} from './engine';

// ============================================================================
// Scan Frequency Configuration
// ============================================================================

const SCAN_FREQUENCIES = {
  manual: { label: 'Manual Only', interval: 0, description: 'Only scan when you click "Scan Now"' },
  '1h': { label: 'Every Hour', interval: 60 * 60 * 1000, description: 'Good for high-activity accounts' },
  '6h': { label: 'Every 6 Hours', interval: 6 * 60 * 60 * 1000, description: 'Balanced frequency' },
  '12h': { label: 'Every 12 Hours', interval: 12 * 60 * 60 * 1000, description: 'Twice daily checks' },
  '24h': { label: 'Daily', interval: 24 * 60 * 60 * 1000, description: 'Recommended for daily data updates' },
} as const;

type ScanFrequency = keyof typeof SCAN_FREQUENCIES;

// Storage key for persisting scan settings
const SCAN_SETTINGS_KEY = 'focal:anomaly-scan-settings';

// ============================================================================
// Helpers
// ============================================================================

/**
 * Format time until a future date in a human-readable way
 */
function formatTimeUntil(date: Date): string {
  const now = Date.now();
  const target = date.getTime();
  const diff = target - now;
  
  if (diff <= 0) return 'Now';
  
  const minutes = Math.floor(diff / (60 * 1000));
  const hours = Math.floor(diff / (60 * 60 * 1000));
  
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  if (hours >= 1) {
    return `${hours}h ${minutes % 60}m`;
  }
  return `${minutes}m`;
}

// ============================================================================
// Types
// ============================================================================

interface AnomalyStats {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  totalImpact: number;
}

interface DailyTrendData {
  date: string;
  cost: number;
  expectedCost: number;
  hasAnomaly: boolean;
  anomalyCount: number;
}

interface ServiceBreakdown {
  serviceName: string;
  totalCost: number;
  anomalyCount: number;
  avgDeviation: number;
}

interface DrillDownData {
  resourceDetails: {
    resourceId: string;
    serviceName: string;
    dailyCosts: { date: string; cost: number }[];
    totalCost: number;
    avgCost: number;
    maxCost: number;
    minCost: number;
  };
  relatedAnomalies: AnomalyResult[];
}

// ============================================================================
// Visualization Components
// ============================================================================

interface AnomalyTrendChartProps {
  data: DailyTrendData[];
  currency: string;
  height?: number;
}

function AnomalyTrendChart({ data, currency, height = 300 }: AnomalyTrendChartProps) {
  const formatValue = (value: number) => formatCurrency(value, currency);
  
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
          </linearGradient>
          <linearGradient id="colorExpected" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
            <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis 
          dataKey="date" 
          tick={{ fontSize: 12 }}
          className="text-muted-foreground"
        />
        <YAxis 
          tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
          tick={{ fontSize: 12 }}
          className="text-muted-foreground"
        />
        <Tooltip 
          formatter={(value) => formatValue(Number(value) || 0)}
          labelFormatter={(label) => `Date: ${label}`}
          contentStyle={{ 
            backgroundColor: 'hsl(var(--card))', 
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px'
          }}
        />
        <Area
          type="monotone"
          dataKey="expectedCost"
          name="Expected"
          stroke="#22c55e"
          strokeDasharray="5 5"
          fillOpacity={0.3}
          fill="url(#colorExpected)"
        />
        <Area
          type="monotone"
          dataKey="cost"
          name="Actual Cost"
          stroke="#3b82f6"
          fillOpacity={1}
          fill="url(#colorCost)"
        />
        {/* Mark anomaly points */}
        {data.filter(d => d.hasAnomaly).map((d, i) => (
          <ReferenceLine
            key={i}
            x={d.date}
            stroke="#ef4444"
            strokeDasharray="3 3"
            strokeWidth={2}
          />
        ))}
        <Brush dataKey="date" height={30} stroke="#8884d8" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

interface SeverityDistributionChartProps {
  stats: AnomalyStats;
}

function SeverityDistributionChart({ stats }: SeverityDistributionChartProps) {
  const data = [
    { name: 'Critical', value: stats.critical, color: '#ef4444' },
    { name: 'High', value: stats.high, color: '#f97316' },
    { name: 'Medium', value: stats.medium, color: '#eab308' },
    { name: 'Low', value: stats.low, color: '#3b82f6' },
  ].filter(d => d.value > 0);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        No anomalies detected
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis type="number" tick={{ fontSize: 12 }} />
        <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={70} />
        <Tooltip />
        <Bar dataKey="value" name="Count" radius={[0, 4, 4, 0]}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

interface ServiceImpactChartProps {
  services: ServiceBreakdown[];
  currency: string;
}

function ServiceImpactChart({ services, currency }: ServiceImpactChartProps) {
  const formatValue = (value: number) => formatCurrency(value, currency);
  const topServices = services.slice(0, 8);

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={topServices} margin={{ top: 10, right: 30, left: 0, bottom: 60 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis 
          dataKey="serviceName" 
          tick={{ fontSize: 10 }}
          angle={-45}
          textAnchor="end"
          interval={0}
          height={80}
        />
        <YAxis 
          tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
          tick={{ fontSize: 12 }}
        />
        <Tooltip 
          formatter={(value) => formatValue(Number(value) || 0)}
          contentStyle={{ 
            backgroundColor: 'hsl(var(--card))', 
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px'
          }}
        />
        <Bar dataKey="totalCost" name="Total Cost" fill="#3b82f6" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ============================================================================
// Drill-Down Dialog Component
// ============================================================================

interface AnomalyDrillDownDialogProps {
  anomaly: AnomalyResult | null;
  drillDownData: DrillDownData | null;
  isOpen: boolean;
  onClose: () => void;
  currency: string;
  isLoading: boolean;
}

function AnomalyDrillDownDialog({
  anomaly,
  drillDownData,
  isOpen,
  onClose,
  currency,
  isLoading
}: AnomalyDrillDownDialogProps) {
  if (!anomaly) return null;

  const severityColors = {
    critical: 'text-red-500 bg-red-500/10',
    high: 'text-orange-500 bg-orange-500/10',
    medium: 'text-yellow-500 bg-yellow-500/10',
    low: 'text-blue-500 bg-blue-500/10',
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${severityColors[anomaly.severity]}`}>
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl">{anomaly.serviceName}</DialogTitle>
              <DialogDescription>
                Resource: {anomaly.resourceId}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="overview" className="mt-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="trend">Cost Trend</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="related">Related</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Severity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Badge className={severityColors[anomaly.severity]}>
                    {anomaly.severity.toUpperCase()}
                  </Badge>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Cost Impact
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold">
                    {formatCurrency(anomaly.impact.costImpact, currency)}
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Deviation
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-1">
                    {anomaly.impact.percentageIncrease > 0 ? (
                      <ArrowUpRight className="h-4 w-4 text-red-500" />
                    ) : (
                      <ArrowDownRight className="h-4 w-4 text-green-500" />
                    )}
                    <span className="text-xl font-bold">
                      {Math.abs(anomaly.impact.percentageIncrease).toFixed(1)}%
                    </span>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Confidence
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Progress value={anomaly.score * 100} className="flex-1" />
                    <span className="text-sm font-medium">
                      {(anomaly.score * 100).toFixed(0)}%
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Description */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {anomaly.description}
                </p>
              </CardContent>
            </Card>

            {/* Recommendations */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Recommendations</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {anomaly.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="trend" className="mt-4">
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : drillDownData?.resourceDetails ? (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Daily Cost Trend</CardTitle>
                    <CardDescription>
                      Cost history for this resource
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={drillDownData.resourceDetails.dailyCosts}>
                        <defs>
                          <linearGradient id="colorResourceCost" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                        <YAxis tickFormatter={(v) => formatCurrency(v, currency)} tick={{ fontSize: 10 }} />
                        <Tooltip 
                          formatter={(value) => formatCurrency(Number(value) || 0, currency)}
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))'
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="cost"
                          stroke="#3b82f6"
                          fillOpacity={1}
                          fill="url(#colorResourceCost)"
                        />
                        <ReferenceLine 
                          y={drillDownData.resourceDetails.avgCost} 
                          stroke="#22c55e" 
                          strokeDasharray="5 5"
                          label={{ value: 'Average', position: 'right', fill: '#22c55e', fontSize: 10 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-sm text-muted-foreground">Total Cost</div>
                      <div className="text-lg font-bold">
                        {formatCurrency(drillDownData.resourceDetails.totalCost, currency)}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-sm text-muted-foreground">Average</div>
                      <div className="text-lg font-bold">
                        {formatCurrency(drillDownData.resourceDetails.avgCost, currency)}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-sm text-muted-foreground">Maximum</div>
                      <div className="text-lg font-bold">
                        {formatCurrency(drillDownData.resourceDetails.maxCost, currency)}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-sm text-muted-foreground">Minimum</div>
                      <div className="text-lg font-bold">
                        {formatCurrency(drillDownData.resourceDetails.minCost, currency)}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                No trend data available
              </div>
            )}
          </TabsContent>

          <TabsContent value="details" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Anomaly Details</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Anomaly Type</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {anomaly.anomalyType.replace(/-/g, ' ')}
                        </Badge>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Detection Method</TableCell>
                      <TableCell>{anomaly.context.method}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Expected Cost</TableCell>
                      <TableCell>
                        {formatCurrency(anomaly.context.expectedCost, currency)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Actual Cost</TableCell>
                      <TableCell>
                        {formatCurrency(anomaly.context.actualCost, currency)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Historical Average</TableCell>
                      <TableCell>
                        {formatCurrency(anomaly.context.historicalAverage, currency)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Detected At</TableCell>
                      <TableCell>
                        {anomaly.timestamp.toLocaleString()}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Resource ID</TableCell>
                      <TableCell className="font-mono text-xs">
                        {anomaly.resourceId}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="related" className="mt-4">
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : drillDownData?.relatedAnomalies && drillDownData.relatedAnomalies.length > 0 ? (
              <div className="space-y-2">
                {drillDownData.relatedAnomalies.map((related) => (
                  <Card key={related.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{related.serviceName}</div>
                        <div className="text-sm text-muted-foreground">
                          {related.timestamp.toLocaleDateString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge className={severityColors[related.severity]}>
                          {related.severity}
                        </Badge>
                        <div className="text-sm mt-1">
                          {formatCurrency(related.impact.costImpact, currency)}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                No related anomalies found
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function AnomalyDetectionDashboard() {
  const { spectrum, queryEnriched } = useEnrichedSpectrum();
  const { hasData, isChecking, rowCount, dateRange } = useDataDetection();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Get resource filter from URL (for linking from other dashboards)
  const resourceFilter = searchParams.get('resource');
  
  // Currency - prefer detected currency from data
  const currency = spectrum.unifiedView?.detectedCurrency || 'USD';

  const [engine] = useState(() => new AnomalyDetectionEngine());
  const [anomalies, setAnomalies] = useState<AnomalyResult[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [lastScan, setLastScan] = useState<Date | null>(null);
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('30d');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Load from URL resource filter as initial search if present
  useEffect(() => {
    if (resourceFilter) {
      setSearchQuery(resourceFilter);
    }
  }, [resourceFilter]);
  
  // Load cached anomalies on mount
  useEffect(() => {
    try {
      const cached = localStorage.getItem('focal:anomaly-cache');
      if (cached) {
        const { anomalies: cachedAnomalies, timestamp } = JSON.parse(cached);
        const cacheAge = Date.now() - timestamp;
        // Use cache if less than 4 hours old
        if (cacheAge < 4 * 60 * 60 * 1000 && cachedAnomalies?.length > 0) {
          const rehydrated = cachedAnomalies.map((a: AnomalyResult) => ({
            ...a,
            timestamp: new Date(a.timestamp),
          }));
          setAnomalies(rehydrated);
          setLastScan(new Date(timestamp));
        }
      }
    } catch (e) {
      console.warn('[AnomalyDetection] Failed to load cache:', e);
    }
  }, []);
  
  // Scan frequency settings
  const [scanFrequency, setScanFrequency] = useState<ScanFrequency>('24h');
  const [nextScheduledScan, setNextScheduledScan] = useState<Date | null>(null);
  
  // Trend data
  const [trendData, setTrendData] = useState<DailyTrendData[]>([]);
  const [serviceBreakdown, setServiceBreakdown] = useState<ServiceBreakdown[]>([]);
  
  // Drill-down state
  const [selectedAnomaly, setSelectedAnomaly] = useState<AnomalyResult | null>(null);
  const [drillDownData, setDrillDownData] = useState<DrillDownData | null>(null);
  const [isDrillDownLoading, setIsDrillDownLoading] = useState(false);
  
  // Expanded sections
  const [isChartsExpanded, setIsChartsExpanded] = useState(true);

  // Calculate statistics
  const stats: AnomalyStats = useMemo(() => {
    const filtered = anomalies.filter(a => 
      selectedSeverity === 'all' || a.severity === selectedSeverity
    );
    
    return {
      total: filtered.length,
      critical: filtered.filter(a => a.severity === 'critical').length,
      high: filtered.filter(a => a.severity === 'high').length,
      medium: filtered.filter(a => a.severity === 'medium').length,
      low: filtered.filter(a => a.severity === 'low').length,
      totalImpact: filtered.reduce((sum, a) => sum + a.impact.costImpact, 0)
    };
  }, [anomalies, selectedSeverity]);

  // Filtered anomalies for display
  const filteredAnomalies = useMemo(() => {
    return anomalies
      .filter(a => selectedSeverity === 'all' || a.severity === selectedSeverity)
      .filter(a => !resourceFilter || a.resourceId === resourceFilter)
      .filter(a => 
        searchQuery === '' || 
        a.serviceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.resourceId.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .slice(0, 100);
  }, [anomalies, selectedSeverity, searchQuery, resourceFilter]);

  /**
   * Load drill-down data for a specific anomaly
   */
  const loadDrillDownData = useCallback(async (anomaly: AnomalyResult) => {
    if (!spectrum.isReady) return;
    
    setIsDrillDownLoading(true);
    setSelectedAnomaly(anomaly);
    
    try {
      const days = parseInt(selectedTimeframe.replace('d', ''));
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      
      // Get daily costs for this resource
      const resourceQuery = `
        SELECT 
          strftime(ChargePeriodStart, '%Y-%m-%d') as date,
          SUM(CAST(BilledCost AS DOUBLE)) as cost
        FROM ${UNIFIED_VIEW_NAME}
        WHERE CAST(ResourceId AS VARCHAR) = '${anomaly.resourceId}'
          AND ChargePeriodStart >= '${startDate.toISOString()}'
        GROUP BY strftime(ChargePeriodStart, '%Y-%m-%d')
        ORDER BY date ASC
      `;

      const dailyCosts = await queryEnriched<{ date: string; cost: number }>(resourceQuery);
      
      const costs = dailyCosts.map(d => Number(d.cost) || 0);
      const totalCost = costs.reduce((a, b) => a + b, 0);
      const avgCost = costs.length > 0 ? totalCost / costs.length : 0;
      const maxCost = Math.max(...costs, 0);
      const minCost = Math.min(...costs, 0);

      // Find related anomalies (same service)
      const relatedAnomalies = anomalies
        .filter(a => a.serviceName === anomaly.serviceName && a.id !== anomaly.id)
        .slice(0, 5);

      setDrillDownData({
        resourceDetails: {
          resourceId: anomaly.resourceId,
          serviceName: anomaly.serviceName,
          dailyCosts: dailyCosts.map(d => ({ date: d.date, cost: Number(d.cost) || 0 })),
          totalCost,
          avgCost,
          maxCost,
          minCost,
        },
        relatedAnomalies,
      });
    } catch (error) {
      console.error('[AnomalyDetection] Drill-down error:', error);
      setDrillDownData(null);
    } finally {
      setIsDrillDownLoading(false);
    }
  }, [spectrum.isReady, queryEnriched, selectedTimeframe, anomalies]);

  /**
   * Run anomaly detection analysis
   */
  const runAnomalyDetection = useCallback(async () => {
    if (!spectrum.isReady || !hasData) {
      console.log('[AnomalyDetection] Skipping - not ready or no data', { isReady: spectrum.isReady, hasData });
      return;
    }

    setIsScanning(true);
    
    try {
      const days = parseInt(selectedTimeframe.replace('d', ''));
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      
      console.log(`[AnomalyDetection] Querying data from ${startDate.toISOString()}`);
      
      // Query using the unified view name directly
      const timeSeriesQuery = `
        SELECT 
          COALESCE(CAST(ResourceId AS VARCHAR), 'unknown') as ResourceId,
          COALESCE(ServiceName, 'Unknown') as ServiceName,
          strftime(ChargePeriodStart, '%Y-%m-%d') as date,
          SUM(CAST(BilledCost AS DOUBLE)) as daily_cost
        FROM ${UNIFIED_VIEW_NAME}
        WHERE ChargePeriodStart >= '${startDate.toISOString()}'
        GROUP BY COALESCE(CAST(ResourceId AS VARCHAR), 'unknown'), 
                 COALESCE(ServiceName, 'Unknown'), 
                 strftime(ChargePeriodStart, '%Y-%m-%d')
        ORDER BY date DESC
        LIMIT 10000
      `;

      console.log('[AnomalyDetection] Executing query...');
      const results = await queryEnriched<{
        ResourceId: string;
        ServiceName: string;
        date: string;
        daily_cost: number;
      }>(timeSeriesQuery);

      console.log(`[AnomalyDetection] Got ${results.length} results`);

      if (results.length === 0) {
        console.warn('[AnomalyDetection] No data returned from query');
        setAnomalies([]);
        setTrendData([]);
        setServiceBreakdown([]);
        setIsScanning(false);
        setLastScan(new Date());
        return;
      }

      // Convert to TimeSeriesData format
      const timeSeriesData: TimeSeriesData[] = results.map(row => ({
        timestamp: new Date(row.date),
        value: Number(row.daily_cost) || 0,
        resourceId: String(row.ResourceId),
        metadata: {
          serviceName: row.ServiceName
        }
      }));

      console.log(`[AnomalyDetection] Analyzing ${timeSeriesData.length} data points`);

      // Run anomaly detection
      const detectedAnomalies = await engine.detectAnomalies(timeSeriesData);
      setAnomalies(detectedAnomalies);
      setLastScan(new Date());
      
      // Save to shared cache for other dashboards
      try {
        localStorage.setItem('focal:anomaly-cache', JSON.stringify({
          anomalies: detectedAnomalies,
          timestamp: Date.now(),
        }));
      } catch (e) {
        console.warn('[AnomalyDetection] Failed to cache anomalies:', e);
      }
      
      console.log(`[AnomalyDetection] Found ${detectedAnomalies.length} anomalies`);

      // Build trend data for chart
      const trendQuery = `
        SELECT 
          strftime(ChargePeriodStart, '%Y-%m-%d') as date,
          SUM(CAST(BilledCost AS DOUBLE)) as daily_cost
        FROM ${UNIFIED_VIEW_NAME}
        WHERE ChargePeriodStart >= '${startDate.toISOString()}'
        GROUP BY strftime(ChargePeriodStart, '%Y-%m-%d')
        ORDER BY date ASC
      `;
      
      const trendResults = await queryEnriched<{ date: string; daily_cost: number }>(trendQuery);
      
      // Calculate expected cost (simple moving average)
      const trendDataWithExpected: DailyTrendData[] = trendResults.map((row, i) => {
        const cost = Number(row.daily_cost) || 0;
        const windowStart = Math.max(0, i - 7);
        const windowValues = trendResults.slice(windowStart, i + 1).map(r => Number(r.daily_cost) || 0);
        const expectedCost = windowValues.length > 0 
          ? windowValues.reduce((a, b) => a + b, 0) / windowValues.length 
          : cost;
        
        const anomaliesOnDate = detectedAnomalies.filter(a => 
          a.timestamp.toISOString().split('T')[0] === row.date
        );
        
        return {
          date: row.date,
          cost,
          expectedCost,
          hasAnomaly: anomaliesOnDate.length > 0,
          anomalyCount: anomaliesOnDate.length
        };
      });
      
      setTrendData(trendDataWithExpected);

      // Build service breakdown
      const serviceQuery = `
        SELECT 
          COALESCE(ServiceName, 'Unknown') as serviceName,
          SUM(CAST(BilledCost AS DOUBLE)) as totalCost,
          COUNT(DISTINCT CAST(ResourceId AS VARCHAR)) as resourceCount
        FROM ${UNIFIED_VIEW_NAME}
        WHERE ChargePeriodStart >= '${startDate.toISOString()}'
        GROUP BY COALESCE(ServiceName, 'Unknown')
        ORDER BY totalCost DESC
        LIMIT 20
      `;
      
      const serviceResults = await queryEnriched<{ 
        serviceName: string; 
        totalCost: number;
        resourceCount: number;
      }>(serviceQuery);
      
      const serviceBreakdownData: ServiceBreakdown[] = serviceResults.map(row => {
        const serviceAnomalies = detectedAnomalies.filter(a => a.serviceName === row.serviceName);
        const avgDeviation = serviceAnomalies.length > 0
          ? serviceAnomalies.reduce((sum, a) => sum + Math.abs(a.impact.percentageIncrease), 0) / serviceAnomalies.length
          : 0;
        
        return {
          serviceName: row.serviceName,
          totalCost: Number(row.totalCost) || 0,
          anomalyCount: serviceAnomalies.length,
          avgDeviation
        };
      });
      
      setServiceBreakdown(serviceBreakdownData);

    } catch (error) {
      console.error('[AnomalyDetection] Error during analysis:', error);
    } finally {
      setIsScanning(false);
    }
  }, [spectrum.isReady, hasData, queryEnriched, selectedTimeframe, engine]);

  // Load saved scan settings from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(SCAN_SETTINGS_KEY);
        if (saved) {
          const settings = JSON.parse(saved);
          if (settings.frequency && SCAN_FREQUENCIES[settings.frequency as ScanFrequency]) {
            setScanFrequency(settings.frequency);
          }
          if (settings.lastScan) {
            setLastScan(new Date(settings.lastScan));
          }
        }
      } catch (e) {
        console.warn('[AnomalyDetection] Failed to load scan settings:', e);
      }
    }
  }, []);

  // Save scan settings when they change
  const updateScanFrequency = useCallback((freq: ScanFrequency) => {
    setScanFrequency(freq);
    if (typeof window !== 'undefined') {
      localStorage.setItem(SCAN_SETTINGS_KEY, JSON.stringify({
        frequency: freq,
        lastScan: lastScan?.toISOString(),
      }));
    }
  }, [lastScan]);

  // Update last scan time when scan completes
  useEffect(() => {
    if (lastScan && typeof window !== 'undefined') {
      const saved = localStorage.getItem(SCAN_SETTINGS_KEY);
      const settings = saved ? JSON.parse(saved) : {};
      localStorage.setItem(SCAN_SETTINGS_KEY, JSON.stringify({
        ...settings,
        lastScan: lastScan.toISOString(),
      }));
    }
  }, [lastScan]);

  // Calculate next scheduled scan
  useEffect(() => {
    const freq = SCAN_FREQUENCIES[scanFrequency];
    if (freq.interval === 0 || !lastScan) {
      setNextScheduledScan(null);
    } else {
      setNextScheduledScan(new Date(lastScan.getTime() + freq.interval));
    }
  }, [scanFrequency, lastScan]);

  // Auto-run scheduled scans
  useEffect(() => {
    if (!spectrum.isReady || !hasData || isScanning) return;
    
    const freq = SCAN_FREQUENCIES[scanFrequency];
    
    // Initial scan on first load (if never scanned)
    if (anomalies.length === 0 && !lastScan) {
      const timer = setTimeout(() => {
        runAnomalyDetection();
      }, 500);
      return () => clearTimeout(timer);
    }
    
    // Scheduled scan based on frequency
    if (freq.interval > 0 && lastScan) {
      const timeSinceLastScan = Date.now() - lastScan.getTime();
      const timeUntilNextScan = freq.interval - timeSinceLastScan;
      
      if (timeUntilNextScan <= 0) {
        // Due for a scan
        console.log('[AnomalyDetection] Running scheduled scan');
        runAnomalyDetection();
      } else {
        // Schedule next scan
        console.log(`[AnomalyDetection] Next scan in ${Math.round(timeUntilNextScan / 60000)} minutes`);
        const timer = setTimeout(() => {
          runAnomalyDetection();
        }, timeUntilNextScan);
        return () => clearTimeout(timer);
      }
    }
  }, [spectrum.isReady, hasData, isScanning, anomalies.length, lastScan, scanFrequency, runAnomalyDetection]);

  // Severity colors
  const severityStyles = {
    critical: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300',
    high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300',
    medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300',
    low: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300'
  };

  const severityIcons = {
    critical: XCircle,
    high: AlertTriangle,
    medium: AlertCircle,
    low: Info
  };

  // Loading state
  if (!spectrum.isReady || isChecking) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-4">
          <div className="animate-spin h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="text-muted-foreground">
            {!spectrum.isReady ? 'Initializing anomaly detection engine...' : 'Checking for billing data...'}
          </p>
        </div>
      </div>
    );
  }

  // No data state
  if (!hasData) {
    return (
      <EmptyState
        icon={Shield}
        title="No billing data available"
        description={`Load billing data from your cloud provider to enable anomaly detection. ${rowCount === 0 ? 'No cost records found in the system.' : ''}`}
        action={{
          label: 'Go to Data Sources',
          href: '/dashboard/sources'
        }}
        skeletonType="detector"
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Anomaly Detection</h1>
          <p className="text-muted-foreground">
            AI-powered cost anomaly detection running locally in your browser
          </p>
          {dateRange && (
            <p className="text-xs text-muted-foreground mt-1">
              Data range: {new Date(dateRange.earliest).toLocaleDateString()} - {new Date(dateRange.latest).toLocaleDateString()}
            </p>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={selectedTimeframe} onValueChange={setSelectedTimeframe}>
            <SelectTrigger className="w-32">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">7 days</SelectItem>
              <SelectItem value="14d">14 days</SelectItem>
              <SelectItem value="30d">30 days</SelectItem>
              <SelectItem value="60d">60 days</SelectItem>
              <SelectItem value="90d">90 days</SelectItem>
            </SelectContent>
          </Select>

          <Select value={scanFrequency} onValueChange={(v) => updateScanFrequency(v as ScanFrequency)}>
            <SelectTrigger className="w-40">
              <RefreshCw className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(SCAN_FREQUENCIES).map(([key, config]) => (
                <SelectItem key={key} value={key}>
                  <div className="flex flex-col">
                    <span>{config.label}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button 
            onClick={runAnomalyDetection}
            disabled={isScanning}
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isScanning ? 'animate-spin' : ''}`} />
            {isScanning ? 'Scanning...' : 'Scan Now'}
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Anomalies</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              {lastScan ? `Last scan: ${lastScan.toLocaleTimeString()}` : 'No scan yet'}
            </p>
          </CardContent>
        </Card>

        <Card className={stats.critical > 0 ? 'border-red-500/50' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.critical}</div>
            <p className="text-xs text-muted-foreground">
              Immediate attention required
            </p>
          </CardContent>
        </Card>

        <Card className={stats.high > 0 ? 'border-orange-500/50' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Priority</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.high}</div>
            <p className="text-xs text-muted-foreground">
              Investigation recommended
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Impact</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(stats.totalImpact, currency)}
            </div>
            <p className="text-xs text-muted-foreground">
              Cost deviation detected
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Next Scan</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isScanning ? '...' : 
               scanFrequency === 'manual' ? 'Manual' :
               nextScheduledScan ? (
                 nextScheduledScan > new Date() 
                   ? formatTimeUntil(nextScheduledScan)
                   : 'Now'
               ) : 'Ready'}
            </div>
            <p className="text-xs text-muted-foreground">
              {SCAN_FREQUENCIES[scanFrequency].description}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Visualizations Section */}
      <Collapsible open={isChartsExpanded} onOpenChange={setIsChartsExpanded}>
        <Card>
          <CardHeader className="pb-2">
            <CollapsibleTrigger className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                <CardTitle>Trend Analysis</CardTitle>
              </div>
              {isChartsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent>
              <div className="grid gap-6 lg:grid-cols-3">
                {/* Main trend chart */}
                <div className="lg:col-span-2">
                  <h4 className="text-sm font-medium mb-3">Cost Trend with Anomalies</h4>
                  {trendData.length > 0 ? (
                    <AnomalyTrendChart data={trendData} currency={currency} height={280} />
                  ) : (
                    <div className="flex items-center justify-center h-64 text-muted-foreground">
                      {isScanning ? 'Loading trend data...' : 'Run a scan to see trends'}
                    </div>
                  )}
                </div>
                
                {/* Side charts */}
                <div className="space-y-6">
                  <div>
                    <h4 className="text-sm font-medium mb-3">Severity Distribution</h4>
                    <SeverityDistributionChart stats={stats} />
                  </div>
                </div>
              </div>
              
              {/* Service impact chart */}
              {serviceBreakdown.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-sm font-medium mb-3">Cost by Service</h4>
                  <ServiceImpactChart services={serviceBreakdown} currency={currency} />
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by service or resource..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
              onClick={() => setSearchQuery('')}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        
        <Select value={selectedSeverity} onValueChange={setSelectedSeverity}>
          <SelectTrigger className="w-48">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="critical">Critical Only</SelectItem>
            <SelectItem value="high">High Priority</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low Priority</SelectItem>
          </SelectContent>
        </Select>

        {isScanning && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="animate-spin h-4 w-4 border-b-2 border-primary" />
            <span>Running anomaly detection...</span>
          </div>
        )}
      </div>

      {/* Anomalies List */}
      <div className="space-y-4">
        {filteredAnomalies.length > 0 ? (
          filteredAnomalies.map(anomaly => {
            const SeverityIcon = severityIcons[anomaly.severity];
            const severityStyle = severityStyles[anomaly.severity];
            
            return (
              <Card 
                key={anomaly.id} 
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => loadDrillDownData(anomaly)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <SeverityIcon className="h-5 w-5 mt-0.5" />
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <CardTitle className="text-base">{anomaly.serviceName}</CardTitle>
                          <Badge className={severityStyle}>
                            {anomaly.severity.toUpperCase()}
                          </Badge>
                          <Badge variant="outline">
                            {anomaly.anomalyType.replace(/-/g, ' ')}
                          </Badge>
                        </div>
                        <CardDescription className="mt-1">
                          <span className="font-mono text-xs">{anomaly.resourceId}</span>
                        </CardDescription>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="font-medium">
                        {formatCurrency(anomaly.impact.costImpact, currency)}
                      </div>
                      <div className={`text-sm flex items-center justify-end gap-1 ${
                        anomaly.impact.percentageIncrease > 0 ? 'text-red-500' : 'text-green-500'
                      }`}>
                        {anomaly.impact.percentageIncrease > 0 ? (
                          <TrendingUp className="h-3 w-3" />
                        ) : (
                          <TrendingDown className="h-3 w-3" />
                        )}
                        {anomaly.impact.percentageIncrease > 0 ? '+' : ''}
                        {anomaly.impact.percentageIncrease.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <div className="space-y-4">
                    <p className="text-sm">{anomaly.description}</p>
                    
                    <div className="grid gap-4 md:grid-cols-4">
                      <div>
                        <div className="text-sm font-medium">Expected</div>
                        <div className="text-sm text-muted-foreground">
                          {formatCurrency(anomaly.context.expectedCost, currency)}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm font-medium">Actual</div>
                        <div className="text-sm text-muted-foreground">
                          {formatCurrency(anomaly.context.actualCost, currency)}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm font-medium">Method</div>
                        <div className="text-sm text-muted-foreground">
                          {anomaly.context.method}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm font-medium">Confidence</div>
                        <div className="flex items-center gap-2">
                          <Progress value={anomaly.score * 100} className="flex-1" />
                          <span className="text-sm text-muted-foreground">
                            {(anomaly.score * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {anomaly.recommendations.length > 0 && (
                      <div className="pt-2 border-t">
                        <div className="text-sm font-medium mb-2">Quick Actions</div>
                        <div className="flex flex-wrap gap-2">
                          {anomaly.recommendations.slice(0, 2).map((rec, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              {rec.length > 50 ? rec.slice(0, 50) + '...' : rec}
                            </Badge>
                          ))}
                          {anomaly.recommendations.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{anomaly.recommendations.length - 2} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-2">
                <CheckCircle className="h-12 w-12 mx-auto text-green-500" />
                <div>
                  <h3 className="font-medium">No anomalies detected</h3>
                  <p className="text-sm text-muted-foreground">
                    {isScanning 
                      ? 'Scanning your cost data...' 
                      : searchQuery 
                        ? 'No anomalies match your search criteria' 
                        : 'Your cloud costs are looking normal. Great job!'
                    }
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        {filteredAnomalies.length > 0 && filteredAnomalies.length < anomalies.length && (
          <p className="text-center text-sm text-muted-foreground">
            Showing {filteredAnomalies.length} of {anomalies.length} anomalies
          </p>
        )}
      </div>

      {/* Drill-down Dialog */}
      <AnomalyDrillDownDialog
        anomaly={selectedAnomaly}
        drillDownData={drillDownData}
        isOpen={!!selectedAnomaly}
        onClose={() => {
          setSelectedAnomaly(null);
          setDrillDownData(null);
        }}
        currency={currency}
        isLoading={isDrillDownLoading}
      />
    </div>
  );
}
