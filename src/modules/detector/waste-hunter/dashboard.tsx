/**
 * Waste Hunter Dashboard
 * 
 * Find and eliminate cloud waste with intelligent detection.
 * Provides actionable recommendations to reduce unnecessary spending.
 */

'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Trash2,
  TrendingDown,
  TrendingUp,
  Search,
  Filter,
  RefreshCw,
  DollarSign,
  Package,
  AlertTriangle,
  CheckCircle,
  Target,
  Zap,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Tag,
  Database,
  HardDrive,
  Server,
  Globe,
  BarChart3,
  PieChart,
  ArrowRight,
  Lightbulb,
  Clock,
  Timer,
  X,
  Activity
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
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RePieChart,
  Pie,
  Cell,
  Treemap,
} from 'recharts';
import { useEnrichedSpectrum, UNIFIED_VIEW_NAME } from '@/components/providers';
import { useDataDetection } from '@/hooks/use-data-detection';
import { EmptyState } from '@/components/ui/empty-state';
import { useRouter } from 'next/navigation';
import { formatCurrency, SUPPORTED_CURRENCIES } from '@/lib/currency';
import {
  WasteHunterEngine,
  type WasteOpportunity,
  type WasteSummary,
  type WasteCategory,
  type WasteSeverity,
  getCategoryLabel,
  getCategoryIcon,
  getSeverityColor,
} from './engine';
import {
  SCAN_FREQUENCIES,
  SCAN_SETTINGS_KEYS,
  TIMEFRAME_OPTIONS,
  type ScanFrequency,
  formatTimeUntil,
  loadScanSettings,
  saveScanSettings,
  calculateNextScan,
  isScanDue,
} from '../shared';

// ============================================================================
// Constants
// ============================================================================

const SEVERITY_COLORS = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#3b82f6',
};

const CATEGORY_COLORS = [
  '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444',
  '#ec4899', '#6366f1', '#14b8a6', '#84cc16', '#f97316',
  '#a855f7', '#22d3d8'
];

// ============================================================================
// Component
// ============================================================================

export function WasteHunterDashboard() {
  const spectrum = useEnrichedSpectrum();
  const { hasData, isChecking: isDetecting } = useDataDetection();
  const { queryEnriched } = spectrum;
  const router = useRouter();

  // Currency - prefer detected currency from data
  const currency = spectrum.spectrum.unifiedView?.detectedCurrency || 'USD';

  // Engine and state
  const [engine] = useState(() => new WasteHunterEngine());
  const [opportunities, setOpportunities] = useState<WasteOpportunity[]>([]);
  const [summary, setSummary] = useState<WasteSummary | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [lastScan, setLastScan] = useState<Date | null>(null);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [showQuickWinsOnly, setShowQuickWinsOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTimeframe, setSelectedTimeframe] = useState('30d');

  // Scan frequency settings
  const [scanFrequency, setScanFrequency] = useState<ScanFrequency>('24h');
  const [nextScheduledScan, setNextScheduledScan] = useState<Date | null>(null);

  // Drill-down
  const [selectedOpportunity, setSelectedOpportunity] = useState<WasteOpportunity | null>(null);

  // Charts expanded state
  const [isChartsExpanded, setIsChartsExpanded] = useState(true);

  // Filter opportunities
  const filteredOpportunities = useMemo(() => {
    return opportunities
      .filter(o => selectedCategory === 'all' || o.category === selectedCategory)
      .filter(o => selectedSeverity === 'all' || o.severity === selectedSeverity)
      .filter(o => !showQuickWinsOnly || o.recommendations.some(r => r.effort === 'low' && r.automatable))
      .filter(o =>
        searchQuery === '' ||
        o.resourceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.serviceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.resourceId.toLowerCase().includes(searchQuery.toLowerCase())
      );
  }, [opportunities, selectedCategory, selectedSeverity, showQuickWinsOnly, searchQuery]);

  // Calculate filtered stats
  const filteredStats = useMemo(() => {
    const totalSavings = filteredOpportunities.reduce((sum, o) => sum + o.potentialSavings, 0);
    const bySeverity = {
      critical: filteredOpportunities.filter(o => o.severity === 'critical').length,
      high: filteredOpportunities.filter(o => o.severity === 'high').length,
      medium: filteredOpportunities.filter(o => o.severity === 'medium').length,
      low: filteredOpportunities.filter(o => o.severity === 'low').length,
    };
    return { totalSavings, bySeverity, count: filteredOpportunities.length };
  }, [filteredOpportunities]);

  /**
   * Analyze usage patterns from daily cost data
   * Detects peaks, usage trends, and whether resource shows actual activity
   */
  const analyzeUsagePatterns = useCallback((dailyCosts: { date: string; cost: number }[]) => {
    if (!dailyCosts || dailyCosts.length < 3) {
      return {
        hasPeaks: false,
        peakCount: 0,
        peaks: [] as { date: string; cost: number; percentAboveAvg: number }[],
        avgCost: 0,
        stdDev: 0,
        variationPercent: 0,
        usagePattern: 'insufficient-data' as const,
        verdict: 'Not enough data to analyze usage patterns',
        verdictType: 'neutral' as const,
      };
    }

    const sorted = [...dailyCosts].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const costs = sorted.map(d => d.cost);
    
    // Calculate statistics
    const avgCost = costs.reduce((s, c) => s + c, 0) / costs.length;
    const variance = costs.reduce((s, c) => s + Math.pow(c - avgCost, 2), 0) / costs.length;
    const stdDev = Math.sqrt(variance);
    const variationPercent = avgCost > 0 ? (stdDev / avgCost) * 100 : 0;
    
    // Detect peaks (costs more than 1.5 standard deviations above average)
    const peakThreshold = avgCost + (stdDev * 1.5);
    const peaks = sorted
      .filter(d => d.cost > peakThreshold)
      .map(d => ({
        date: d.date,
        cost: d.cost,
        percentAboveAvg: avgCost > 0 ? ((d.cost - avgCost) / avgCost) * 100 : 0,
      }));
    
    // Determine usage pattern
    let usagePattern: 'flat' | 'variable' | 'spiky' | 'declining' | 'growing';
    let verdict: string;
    let verdictType: 'positive' | 'negative' | 'neutral';
    
    // Check for trend (compare first half avg vs second half avg)
    const midpoint = Math.floor(costs.length / 2);
    const firstHalfAvg = costs.slice(0, midpoint).reduce((s, c) => s + c, 0) / midpoint;
    const secondHalfAvg = costs.slice(midpoint).reduce((s, c) => s + c, 0) / (costs.length - midpoint);
    const trendPercent = firstHalfAvg > 0 ? ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100 : 0;
    
    if (variationPercent < 10) {
      usagePattern = 'flat';
      verdict = 'Consistently flat cost pattern suggests the resource is running but not actively used. Good candidate for optimization.';
      verdictType = 'negative';
    } else if (peaks.length >= 3 && variationPercent > 50) {
      usagePattern = 'spiky';
      verdict = `Detected ${peaks.length} usage peaks indicating periodic high activity. Consider scheduled scaling or reserved capacity for peak times.`;
      verdictType = 'positive';
    } else if (trendPercent < -20) {
      usagePattern = 'declining';
      verdict = 'Usage is declining over time. This resource may become fully idle soon - monitor and plan for decommissioning.';
      verdictType = 'negative';
    } else if (trendPercent > 20) {
      usagePattern = 'growing';
      verdict = 'Usage is growing over time. This resource appears actively used - verify the waste detection is accurate.';
      verdictType = 'positive';
    } else {
      usagePattern = 'variable';
      verdict = `Moderate variation (${variationPercent.toFixed(0)}%) suggests some activity but may still be underutilized.`;
      verdictType = 'neutral';
    }
    
    return {
      hasPeaks: peaks.length > 0,
      peakCount: peaks.length,
      peaks: peaks.slice(0, 5), // Top 5 peaks
      avgCost,
      stdDev,
      variationPercent,
      usagePattern,
      verdict,
      verdictType,
      trendPercent,
    };
  }, []);

  /**
   * Run waste analysis
   */
  const runWasteAnalysis = useCallback(async () => {
    if (!spectrum.spectrum.isReady || !hasData || !queryEnriched) return;

    setIsScanning(true);
    console.log('[WasteHunter] Starting waste analysis...');

    try {
      const days = parseInt(selectedTimeframe.replace('d', ''));
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      // Query resource-level cost data
      // Note: DuckDB doesn't allow alias in GROUP BY when COALESCE is used, so we use column positions
      // FOCUS schema uses RegionName (not Region) and ConsumedQuantity (not UsageQuantity)
      const query = `
        SELECT 
          ResourceId,
          COALESCE(ResourceName, CAST(ResourceId AS VARCHAR)) as ResourceName,
          COALESCE(ResourceType, 'Unknown') as ResourceType,
          ServiceName,
          ServiceCategory,
          COALESCE(RegionName, 'Unknown') as ResourceRegion,
          SUM(CAST(BilledCost AS DOUBLE)) as TotalCost,
          SUM(CAST(ConsumedQuantity AS DOUBLE)) as UsageQuantity,
          COALESCE(PricingUnit, 'units') as PricingUnit,
          ChargeCategory,
          BillingCurrency as Currency,
          CAST(ChargePeriodStart AS DATE) as ChargeDate,
          COALESCE(Tags, '{}') as Tags
        FROM ${UNIFIED_VIEW_NAME}
        WHERE ChargePeriodStart >= epoch_ms(${startDate.getTime()})
          AND ChargePeriodEnd < epoch_ms(${endDate.getTime()})
          AND ResourceId IS NOT NULL
          AND CAST(ResourceId AS VARCHAR) != ''
        GROUP BY 1, 2, 3, 4, 5, 6, 9, 10, 11, 12, 13
        ORDER BY TotalCost DESC
        LIMIT 5000
      `;

      const result = await queryEnriched(query);

      if (!result || result.length === 0) {
        console.log('[WasteHunter] No resource data found');
        setOpportunities([]);
        setSummary(null);
        setLastScan(new Date());
        return;
      }

      // Group by resource and build daily cost arrays
      const resourceMap = new Map<string, {
        resourceId: string;
        resourceName: string;
        resourceType: string;
        serviceName: string;
        serviceCategory: string;
        region: string;
        totalCost: number;
        dailyCosts: { date: string; cost: number }[];
        usageQuantity: number;
        pricingUnit: string;
        chargeCategory: string;
        currency: string;
        tags: Record<string, string>;
      }>();

      for (const row of result) {
        const resourceId = String(row.ResourceId || '');
        const chargeDate = String(row.ChargeDate || '');
        const cost = Number(row.TotalCost) || 0;

        // Parse tags from JSON string
        let tags: Record<string, string> = {};
        try {
          const tagsStr = String(row.Tags || '{}');
          if (tagsStr && tagsStr !== '{}') {
            tags = JSON.parse(tagsStr);
          }
        } catch {
          // Tags parsing failed, use empty object
        }

        if (!resourceMap.has(resourceId)) {
          resourceMap.set(resourceId, {
            resourceId,
            resourceName: String(row.ResourceName || resourceId),
            resourceType: String(row.ResourceType || 'Unknown'),
            serviceName: String(row.ServiceName || 'Unknown'),
            serviceCategory: String(row.ServiceCategory || 'Unknown'),
            region: String(row.ResourceRegion || 'Unknown'),
            totalCost: 0,
            dailyCosts: [],
            usageQuantity: 0,
            pricingUnit: String(row.PricingUnit || 'units'),
            chargeCategory: String(row.ChargeCategory || ''),
            currency: String(row.Currency || 'USD'),
            tags,
          });
        }

        const resource = resourceMap.get(resourceId)!;
        resource.totalCost += cost;
        resource.usageQuantity += Number(row.UsageQuantity) || 0;
        resource.dailyCosts.push({ date: chargeDate, cost });
      }

      // Analyze resources - add avgDailyCost
      const resources = Array.from(resourceMap.values()).map(r => ({
        ...r,
        avgDailyCost: r.dailyCosts.length > 0 
          ? r.totalCost / r.dailyCosts.length 
          : 0,
      }));
      console.log(`[WasteHunter] Analyzing ${resources.length} resources...`);

      const detectedOpportunities = engine.analyzeResources(resources);
      const wasteSummary = engine.generateSummary(detectedOpportunities, { start: startDate, end: endDate });

      console.log(`[WasteHunter] Found ${detectedOpportunities.length} waste opportunities`);

      setOpportunities(detectedOpportunities);
      setSummary(wasteSummary);
      setLastScan(new Date());

    } catch (error) {
      console.error('[WasteHunter] Analysis error:', error);
    } finally {
      setIsScanning(false);
    }
  }, [spectrum.spectrum.isReady, hasData, queryEnriched, selectedTimeframe, engine]);

  // Load saved scan settings
  useEffect(() => {
    const settings = loadScanSettings(SCAN_SETTINGS_KEYS.waste);
    if (settings) {
      if (settings.frequency && SCAN_FREQUENCIES[settings.frequency]) {
        setScanFrequency(settings.frequency);
      }
      if (settings.lastScan) {
        setLastScan(settings.lastScan);
      }
    }
  }, []);

  // Update scan frequency and save to localStorage
  const updateScanFrequency = useCallback((freq: ScanFrequency) => {
    setScanFrequency(freq);
    saveScanSettings(SCAN_SETTINGS_KEYS.waste, { frequency: freq, lastScan: lastScan || undefined });
  }, [lastScan]);

  // Save lastScan to localStorage whenever it changes
  useEffect(() => {
    if (lastScan) {
      saveScanSettings(SCAN_SETTINGS_KEYS.waste, { frequency: scanFrequency, lastScan });
    }
  }, [lastScan, scanFrequency]);

  // Calculate next scheduled scan time
  useEffect(() => {
    setNextScheduledScan(calculateNextScan(scanFrequency, lastScan));
  }, [scanFrequency, lastScan]);

  // Auto-scan based on frequency (only check on interval, not on state changes)
  useEffect(() => {
    if (!spectrum.spectrum.isReady || !hasData) return;
    if (scanFrequency === 'manual') return;

    // Set up interval to check periodically (every minute)
    const checkInterval = setInterval(() => {
      if (!isScanning && isScanDue(scanFrequency, lastScan)) {
        console.log('[WasteHunter] Auto-scan triggered by schedule');
        runWasteAnalysis();
      }
    }, 60000);

    return () => clearInterval(checkInterval);
  }, [spectrum.spectrum.isReady, hasData, scanFrequency, lastScan, isScanning, runWasteAnalysis]);

  // Initial scan on mount - always run if no opportunities loaded yet
  useEffect(() => {
    if (spectrum.spectrum.isReady && hasData && !isScanning && opportunities.length === 0) {
      const timer = setTimeout(() => runWasteAnalysis(), 500);
      return () => clearTimeout(timer);
    }
  }, [spectrum.spectrum.isReady, hasData, isScanning, opportunities.length, runWasteAnalysis]);

  // Severity badge style
  const getSeverityBadge = (severity: WasteSeverity) => {
    const styles: Record<WasteSeverity, string> = {
      critical: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300',
      high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300',
      medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300',
      low: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300',
    };
    return styles[severity];
  };

  // Category data for chart
  const categoryChartData = useMemo(() => {
    if (!summary) return [];
    return Object.entries(summary.byCategory)
      .filter(([, v]) => v.count > 0)
      .map(([category, data], idx) => ({
        name: getCategoryLabel(category as WasteCategory),
        value: data.savings,
        count: data.count,
        fill: CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
      }))
      .sort((a, b) => b.value - a.value);
  }, [summary]);

  // Severity data for chart
  const severityChartData = useMemo(() => {
    if (!summary) return [];
    return (['critical', 'high', 'medium', 'low'] as WasteSeverity[])
      .map(severity => ({
        name: severity.charAt(0).toUpperCase() + severity.slice(1),
        value: summary.bySeverity[severity].count,
        savings: summary.bySeverity[severity].savings,
        fill: SEVERITY_COLORS[severity],
      }))
      .filter(d => d.value > 0);
  }, [summary]);

  // Loading state
  if (!spectrum.spectrum.isReady || isDetecting) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Initializing Waste Hunter...</p>
        </div>
      </div>
    );
  }

  // No data state
  if (!hasData) {
    return (
      <EmptyState
        icon={Trash2}
        title="No billing data available"
        description="Load your cloud billing data to start hunting for waste and optimization opportunities."
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Trash2 className="h-6 w-6 text-red-500" />
            Waste Hunter
          </h1>
          <p className="text-muted-foreground">
            Identify and eliminate cloud waste to reduce unnecessary spending
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Select value={selectedTimeframe} onValueChange={setSelectedTimeframe}>
            <SelectTrigger className="w-32">
              <Clock className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIMEFRAME_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={scanFrequency} onValueChange={(v) => updateScanFrequency(v as ScanFrequency)}>
            <SelectTrigger className="w-36">
              <Timer className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(SCAN_FREQUENCIES).map(([key, config]) => (
                <SelectItem key={key} value={key}>{config.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={runWasteAnalysis} disabled={isScanning} size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${isScanning ? 'animate-spin' : ''}`} />
            {isScanning ? 'Hunting...' : 'Hunt Now'}
          </Button>
        </div>
      </div>

      {/* Scan Status */}
      {lastScan && (
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>Last scan: {lastScan.toLocaleString()}</span>
          {nextScheduledScan && scanFrequency !== 'manual' && (
            <span className="flex items-center gap-1">
              <Timer className="h-3 w-3" />
              Next: {formatTimeUntil(nextScheduledScan)}
            </span>
          )}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card 
          className={`cursor-pointer transition-all border-green-500/50 bg-green-500/5 hover:border-green-500 hover:bg-green-500/10 ${selectedSeverity === 'all' && !showQuickWinsOnly ? 'border-green-500 ring-1 ring-green-500/30' : ''}`}
          onClick={() => { setSelectedSeverity('all'); setShowQuickWinsOnly(false); }}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Potential Savings</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {formatCurrency(summary?.totalPotentialSavings || 0, currency)}
            </div>
            <p className="text-xs text-muted-foreground">
              {summary?.totalOpportunities || 0} opportunities found
            </p>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all hover:border-red-500/50 hover:bg-red-500/5 ${selectedSeverity === 'critical' ? 'border-red-500 bg-red-500/10' : ''}`}
          onClick={() => setSelectedSeverity(selectedSeverity === 'critical' ? 'all' : 'critical')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Issues</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {summary?.bySeverity.critical.count || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(summary?.bySeverity.critical.savings || 0, currency)} in savings
            </p>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all hover:border-orange-500/50 hover:bg-orange-500/5 ${selectedSeverity === 'high' ? 'border-orange-500 bg-orange-500/10' : ''}`}
          onClick={() => setSelectedSeverity(selectedSeverity === 'high' ? 'all' : 'high')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Priority</CardTitle>
            <Target className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {(summary?.bySeverity.critical.count || 0) + (summary?.bySeverity.high.count || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Need immediate attention
            </p>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all hover:border-yellow-500/50 hover:bg-yellow-500/5 ${showQuickWinsOnly ? 'border-yellow-500 bg-yellow-500/10' : ''}`}
          onClick={() => setShowQuickWinsOnly(!showQuickWinsOnly)}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quick Wins</CardTitle>
            <Zap className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {opportunities.filter(o => 
                o.recommendations.some(r => r.effort === 'low' && r.automatable)
              ).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Easy fixes available
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Visualizations */}
      <Collapsible open={isChartsExpanded} onOpenChange={setIsChartsExpanded}>
        <Card>
          <CardHeader className="pb-2">
            <CollapsibleTrigger className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                <CardTitle>Waste Analysis</CardTitle>
              </div>
              {isChartsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Savings by Category */}
                <div>
                  <h4 className="text-sm font-medium mb-4">Savings by Category</h4>
                  {categoryChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={categoryChartData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis type="number" tickFormatter={(v) => `${SUPPORTED_CURRENCIES[currency]?.symbol || currency}${(v / 1000).toFixed(0)}k`} />
                        <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                        <Tooltip
                          formatter={(value) => [formatCurrency(Number(value) || 0, currency), 'Savings']}
                          labelFormatter={(label) => label}
                        />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                          {categoryChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                      No waste categories detected
                    </div>
                  )}
                </div>

                {/* Severity Distribution */}
                <div>
                  <h4 className="text-sm font-medium mb-4">Severity Distribution</h4>
                  {severityChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <RePieChart>
                        <Pie
                          data={severityChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          dataKey="value"
                          label={({ name, value }) => `${name}: ${value}`}
                          labelLine={{ strokeWidth: 1 }}
                        >
                          {severityChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value, name, props) => [
                            `${value} issues (${formatCurrency((props?.payload as { savings?: number })?.savings || 0, currency)})`,
                            String(name || '')
                          ]}
                        />
                      </RePieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                      Run analysis to see distribution
                    </div>
                  )}
                </div>
              </div>

              {/* Top Services */}
              {summary && summary.byService.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-sm font-medium mb-4">Top Services with Waste</h4>
                  <div className="space-y-2">
                    {summary.byService.slice(0, 5).map((service, idx) => (
                      <div key={service.name} className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground w-4">{idx + 1}</span>
                        <div className="flex-1">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-sm font-medium">{service.name}</span>
                            <span className="text-sm text-green-600 dark:text-green-400">
                              {formatCurrency(service.savings, currency)}
                            </span>
                          </div>
                          <Progress 
                            value={(service.savings / summary.totalPotentialSavings) * 100} 
                            className="h-2"
                          />
                        </div>
                        <Badge variant="secondary">{service.count}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Filters and Search */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle className="text-lg">Waste Opportunities</CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search resources..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 w-[200px]"
                />
              </div>

              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-[150px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="idle">Idle Resources</SelectItem>
                  <SelectItem value="untagged">Untagged</SelectItem>
                  <SelectItem value="stale-snapshot">Stale Snapshots</SelectItem>
                  <SelectItem value="unused-storage">Unused Storage</SelectItem>
                  <SelectItem value="idle-database">Idle Databases</SelectItem>
                  <SelectItem value="old-generation">Old Generation</SelectItem>
                  <SelectItem value="unused-ip">Unused IPs</SelectItem>
                </SelectContent>
              </Select>

              <Select value={selectedSeverity} onValueChange={setSelectedSeverity}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severity</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isScanning ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Hunting for waste...</p>
              </div>
            </div>
          ) : filteredOpportunities.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
              <h3 className="text-lg font-medium">No waste found!</h3>
              <p className="text-muted-foreground mt-1">
                {opportunities.length === 0 
                  ? 'Your cloud resources appear to be well-optimized'
                  : 'No opportunities match your current filters'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground mb-4">
                Showing {filteredOpportunities.length} of {opportunities.length} opportunities
                • Total savings: {formatCurrency(filteredStats.totalSavings, currency)}
              </div>

              {filteredOpportunities.slice(0, 50).map((opportunity) => (
                <div
                  key={opportunity.id}
                  onClick={() => setSelectedOpportunity(opportunity)}
                  className="border rounded-lg p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{getCategoryIcon(opportunity.category)}</span>
                        <span className="font-medium truncate">{opportunity.resourceName}</span>
                        <Badge className={getSeverityBadge(opportunity.severity)}>
                          {opportunity.severity}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground mb-2">
                        {opportunity.serviceName} • {opportunity.region} • {opportunity.resourceType}
                      </div>
                      <p className="text-sm">{opportunity.reason}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-lg font-bold text-green-600 dark:text-green-400">
                        {formatCurrency(opportunity.potentialSavings, currency)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {opportunity.savingsPercent.toFixed(0)}% savings
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {opportunity.confidence}% confidence
                      </div>
                    </div>
                  </div>

                  {/* Quick action badges */}
                  <div className="flex gap-2 mt-3">
                    {opportunity.recommendations.slice(0, 2).map((rec, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {rec.automatable && <Zap className="h-3 w-3 mr-1" />}
                        {rec.title}
                      </Badge>
                    ))}
                    {opportunity.recommendations.length > 2 && (
                      <Badge variant="outline" className="text-xs">
                        +{opportunity.recommendations.length - 2} more
                      </Badge>
                    )}
                  </div>
                </div>
              ))}

              {filteredOpportunities.length > 50 && (
                <p className="text-center text-muted-foreground text-sm py-4">
                  Showing top 50 of {filteredOpportunities.length} opportunities
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Drill-down Dialog */}
      <Dialog open={!!selectedOpportunity} onOpenChange={(open) => !open && setSelectedOpportunity(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedOpportunity && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{getCategoryIcon(selectedOpportunity.category)}</span>
                  <div>
                    <DialogTitle className="flex items-center gap-2">
                      {selectedOpportunity.resourceName}
                      <Badge className={getSeverityBadge(selectedOpportunity.severity)}>
                        {selectedOpportunity.severity}
                      </Badge>
                    </DialogTitle>
                    <DialogDescription>
                      {getCategoryLabel(selectedOpportunity.category)} • {selectedOpportunity.serviceName}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <Tabs defaultValue="overview" className="mt-4">
                <TabsList className="w-full">
                  <TabsTrigger value="overview" className="flex-1">Overview</TabsTrigger>
                  <TabsTrigger value="history" className="flex-1">History</TabsTrigger>
                  <TabsTrigger value="evidence" className="flex-1">Evidence</TabsTrigger>
                  <TabsTrigger value="actions" className="flex-1">Actions</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4 mt-4">
                  {/* Savings Summary */}
                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardContent className="pt-4">
                        <div className="text-sm text-muted-foreground">Current Cost</div>
                        <div className="text-2xl font-bold">
                          {formatCurrency(selectedOpportunity.currentCost, currency)}
                        </div>
                        <div className="text-xs text-muted-foreground">Last {selectedTimeframe}</div>
                      </CardContent>
                    </Card>
                    <Card className="border-green-500/50 bg-green-500/5">
                      <CardContent className="pt-4">
                        <div className="text-sm text-muted-foreground">Potential Savings</div>
                        <div className="text-2xl font-bold text-green-600">
                          {formatCurrency(selectedOpportunity.potentialSavings, currency)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {selectedOpportunity.savingsPercent.toFixed(0)}% reduction
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Details */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Resource Details</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableBody>
                          <TableRow>
                            <TableCell className="font-medium">Resource ID</TableCell>
                            <TableCell className="font-mono text-xs">{selectedOpportunity.resourceId}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">Type</TableCell>
                            <TableCell>{selectedOpportunity.resourceType}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">Service</TableCell>
                            <TableCell>{selectedOpportunity.serviceName}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">Region</TableCell>
                            <TableCell>{selectedOpportunity.region}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">Detection Method</TableCell>
                            <TableCell>{selectedOpportunity.detectionMethod}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">Confidence</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Progress value={selectedOpportunity.confidence} className="w-20 h-2" />
                                <span>{selectedOpportunity.confidence}%</span>
                              </div>
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>

                  {/* Reason */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Lightbulb className="h-4 w-4" />
                        Analysis
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm">{selectedOpportunity.reason}</p>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="history" className="space-y-4 mt-4">
                  {(() => {
                    const analysis = analyzeUsagePatterns(selectedOpportunity.dailyCosts);
                    return (
                      <>
                        {/* Usage Pattern Analysis */}
                        <Card className={
                          analysis.verdictType === 'positive' ? 'border-green-500/50 bg-green-500/5' :
                          analysis.verdictType === 'negative' ? 'border-orange-500/50 bg-orange-500/5' :
                          'border-muted'
                        }>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Activity className="h-4 w-4" />
                              Usage Pattern Analysis
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="flex items-start gap-3">
                              {analysis.verdictType === 'positive' ? (
                                <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                              ) : analysis.verdictType === 'negative' ? (
                                <AlertTriangle className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
                              ) : (
                                <Target className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                              )}
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge variant="outline" className="capitalize">
                                    {analysis.usagePattern.replace('-', ' ')}
                                  </Badge>
                                  {analysis.hasPeaks && (
                                    <Badge variant="secondary">
                                      {analysis.peakCount} peak{analysis.peakCount !== 1 ? 's' : ''} detected
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm">{analysis.verdict}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Cost Chart */}
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-sm flex items-center gap-2">
                              <BarChart3 className="h-4 w-4" />
                              Cost History
                            </CardTitle>
                            <CardDescription>Daily cost trend for this resource over the analysis period</CardDescription>
                          </CardHeader>
                          <CardContent>
                            {selectedOpportunity.dailyCosts && selectedOpportunity.dailyCosts.length > 0 ? (
                              <div className="h-[250px]">
                                <ResponsiveContainer width="100%" height="100%">
                                  <AreaChart
                                    data={selectedOpportunity.dailyCosts
                                      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                                      .map(d => ({
                                        date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                                        cost: d.cost,
                                        avgLine: analysis.avgCost,
                                      }))}
                                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                                  >
                                    <defs>
                                      <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                                      </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                    <XAxis 
                                      dataKey="date" 
                                      tick={{ fontSize: 11 }} 
                                      tickLine={false}
                                      axisLine={false}
                                    />
                                    <YAxis 
                                      tick={{ fontSize: 11 }} 
                                      tickLine={false}
                                      axisLine={false}
                                      tickFormatter={(v) => `${SUPPORTED_CURRENCIES[currency]?.symbol || currency}${v.toFixed(0)}`}
                                    />
                                    <Tooltip 
                                      formatter={(value) => [formatCurrency(Number(value) || 0, currency), 'Cost']}
                                      contentStyle={{ 
                                        backgroundColor: 'hsl(var(--background))', 
                                        border: '1px solid hsl(var(--border))',
                                        borderRadius: '8px'
                                      }}
                                    />
                                    <Area
                                      type="monotone"
                                      dataKey="cost"
                                      stroke="#f97316"
                                      strokeWidth={2}
                                      fillOpacity={1}
                                      fill="url(#colorCost)"
                                    />
                                    {/* Average line */}
                                    <Area
                                      type="monotone"
                                      dataKey="avgLine"
                                      stroke="#6b7280"
                                      strokeWidth={1}
                                      strokeDasharray="5 5"
                                      fillOpacity={0}
                                      dot={false}
                                    />
                                  </AreaChart>
                                </ResponsiveContainer>
                              </div>
                            ) : (
                              <div className="text-center py-8 text-muted-foreground">
                                <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                <p>No historical cost data available</p>
                              </div>
                            )}
                          </CardContent>
                        </Card>

                        {/* Statistics Grid */}
                        {selectedOpportunity.dailyCosts && selectedOpportunity.dailyCosts.length > 0 && (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <Card>
                              <CardContent className="pt-4 text-center">
                                <div className="text-sm text-muted-foreground">Avg Daily</div>
                                <div className="text-lg font-bold">
                                  {formatCurrency(analysis.avgCost, currency)}
                                </div>
                              </CardContent>
                            </Card>
                            <Card>
                              <CardContent className="pt-4 text-center">
                                <div className="text-sm text-muted-foreground">Peak Day</div>
                                <div className="text-lg font-bold">
                                  {formatCurrency(
                                    Math.max(...selectedOpportunity.dailyCosts.map(d => d.cost)),
                                    currency
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                            <Card>
                              <CardContent className="pt-4 text-center">
                                <div className="text-sm text-muted-foreground">Variation</div>
                                <div className="text-lg font-bold flex items-center justify-center gap-1">
                                  {analysis.variationPercent.toFixed(0)}%
                                  {analysis.variationPercent > 30 ? (
                                    <TrendingUp className="h-4 w-4 text-green-500" />
                                  ) : (
                                    <TrendingDown className="h-4 w-4 text-orange-500" />
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                            <Card>
                              <CardContent className="pt-4 text-center">
                                <div className="text-sm text-muted-foreground">Days Tracked</div>
                                <div className="text-lg font-bold">
                                  {selectedOpportunity.dailyCosts.length}
                                </div>
                              </CardContent>
                            </Card>
                          </div>
                        )}

                        {/* Detected Peaks */}
                        {analysis.peaks.length > 0 && (
                          <Card>
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm flex items-center gap-2">
                                <TrendingUp className="h-4 w-4 text-green-500" />
                                Detected Usage Peaks
                              </CardTitle>
                              <CardDescription>
                                Days with significantly higher than average cost, indicating actual compute usage
                              </CardDescription>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-2">
                                {analysis.peaks.map((peak, idx) => (
                                  <div key={idx} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                                    <div className="flex items-center gap-2">
                                      <div className="w-2 h-2 rounded-full bg-green-500" />
                                      <span className="text-sm">
                                        {new Date(peak.date).toLocaleDateString('en-US', { 
                                          weekday: 'short', 
                                          month: 'short', 
                                          day: 'numeric' 
                                        })}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                      <span className="text-sm font-medium">
                                        {formatCurrency(peak.cost, currency)}
                                      </span>
                                      <Badge variant="secondary" className="text-xs">
                                        +{peak.percentAboveAvg.toFixed(0)}% above avg
                                      </Badge>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </Card>
                        )}
                      </>
                    );
                  })()}
                </TabsContent>

                <TabsContent value="evidence" className="space-y-4 mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Detection Evidence</CardTitle>
                      <CardDescription>Metrics that triggered this waste detection</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {selectedOpportunity.evidence.length > 0 ? (
                        <div className="space-y-4">
                          {selectedOpportunity.evidence.map((evidence, idx) => (
                            <div key={idx} className="border rounded-lg p-4">
                              <div className="flex justify-between items-center mb-2">
                                <span className="font-medium">{evidence.metric}</span>
                                <Badge variant="outline">{evidence.period}</Badge>
                              </div>
                              <div className="flex items-center gap-4">
                                <div>
                                  <div className="text-2xl font-bold">
                                    {evidence.value.toFixed(2)} {evidence.unit}
                                  </div>
                                  <div className="text-xs text-muted-foreground">Actual</div>
                                </div>
                                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                <div>
                                  <div className="text-2xl font-bold text-muted-foreground">
                                    {evidence.threshold.toFixed(2)} {evidence.unit}
                                  </div>
                                  <div className="text-xs text-muted-foreground">Threshold</div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-sm">No detailed evidence available</p>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="actions" className="space-y-4 mt-4">
                  <div className="space-y-3">
                    {selectedOpportunity.recommendations.map((rec, idx) => (
                      <Card key={idx} className={rec.automatable ? 'border-green-500/30' : ''}>
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium">{rec.title}</span>
                                {rec.automatable && (
                                  <Badge variant="secondary" className="text-xs">
                                    <Zap className="h-3 w-3 mr-1" />
                                    Automatable
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mb-3">{rec.description}</p>
                              <div className="flex gap-4 text-xs">
                                <div>
                                  <span className="text-muted-foreground">Effort:</span>{' '}
                                  <Badge variant="outline" className={
                                    rec.effort === 'low' ? 'text-green-600' :
                                    rec.effort === 'medium' ? 'text-yellow-600' : 'text-red-600'
                                  }>
                                    {rec.effort}
                                  </Badge>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Risk:</span>{' '}
                                  <Badge variant="outline" className={
                                    rec.risk === 'low' ? 'text-green-600' :
                                    rec.risk === 'medium' ? 'text-yellow-600' : 'text-red-600'
                                  }>
                                    {rec.risk}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold text-green-600">
                                {formatCurrency(rec.estimatedSavings, currency)}
                              </div>
                              <div className="text-xs text-muted-foreground">Est. Savings</div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
