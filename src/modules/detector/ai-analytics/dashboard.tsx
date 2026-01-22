/**
 * AI Analytics Dashboard
 * 
 * Track and optimize AI/ML cloud spending with detailed insights.
 * Supports Azure OpenAI, AWS Bedrock, GCP Vertex AI, and more.
 */

'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Brain,
  BrainCircuit,
  Cpu,
  TrendingUp,
  TrendingDown,
  Search,
  RefreshCw,
  DollarSign,
  Zap,
  BarChart3,
  PieChart,
  Server,
  Globe,
  Clock,
  Timer,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Gauge,
  Target,
  ChevronDown,
  ChevronUp,
  Database,
  Info
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
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RePieChart,
  Pie,
  Cell,
  Legend,
  ComposedChart,
  Line,
} from 'recharts';
import { useEnrichedSpectrum, UNIFIED_VIEW_NAME } from '@/components/providers';
import { useDataDetection } from '@/hooks/use-data-detection';
import { EmptyState } from '@/components/ui/empty-state';
import { useRouter } from 'next/navigation';
import { formatCurrency, loadCurrencySettings, SUPPORTED_CURRENCIES } from '@/lib/currency';
import {
  AIAnalyticsEngine,
  type AISpendItem,
  type AISpendSummary,
  type AIServiceCategory,
  type AIEfficiencyMetrics,
  getCategoryLabel,
  getCategoryIcon,
  getCategoryColor,
} from './engine';
import {
  SCAN_FREQUENCY_OPTIONS,
  SCAN_SETTINGS_KEYS,
  type ScanFrequency,
  loadScanSettings,
  saveScanSettings,
  calculateNextScan,
  isScanDue,
  formatTimeUntil,
} from '../shared';

// ============================================================================
// Constants
// ============================================================================

const CATEGORY_COLORS: Record<AIServiceCategory, string> = {
  'llm': '#8b5cf6',
  'ml-training': '#f59e0b',
  'ml-inference': '#10b981',
  'gpu-compute': '#ef4444',
  'cognitive-services': '#3b82f6',
  'vector-db': '#ec4899',
  'data-processing': '#06b6d4',
  'model-hosting': '#6366f1',
  'ai-search': '#14b8a6',
  'other-ai': '#9ca3af',
};

// ============================================================================
// Component
// ============================================================================

export function AIAnalyticsDashboard() {
  const spectrum = useEnrichedSpectrum();
  const { hasData, isChecking: isDetecting } = useDataDetection();
  const { queryEnriched } = spectrum;
  const router = useRouter();

  // Currency
  const [currency, setCurrency] = useState('USD');
  useEffect(() => {
    const settings = loadCurrencySettings();
    setCurrency(settings?.displayCurrency || spectrum.spectrum.unifiedView?.detectedCurrency || 'USD');
  }, [spectrum.spectrum.unifiedView?.detectedCurrency]);

  // Engine and state
  const [engine] = useState(() => new AIAnalyticsEngine());
  const [aiItems, setAiItems] = useState<AISpendItem[]>([]);
  const [summary, setSummary] = useState<AISpendSummary | null>(null);
  const [efficiency, setEfficiency] = useState<AIEfficiencyMetrics | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [lastScan, setLastScan] = useState<Date | null>(null);

  // Scan frequency
  const [scanFrequency, setScanFrequency] = useState<ScanFrequency>('24h');
  const [nextScheduledScan, setNextScheduledScan] = useState<Date | null>(null);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTimeframe, setSelectedTimeframe] = useState('30d');

  // UI state
  const [isChartsExpanded, setIsChartsExpanded] = useState(true);
  const [selectedItem, setSelectedItem] = useState<AISpendItem | null>(null);

  // Filtered items
  const filteredItems = useMemo(() => {
    return aiItems
      .filter(i => selectedCategory === 'all' || i.serviceCategory === selectedCategory)
      .filter(i =>
        searchQuery === '' ||
        i.resourceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.serviceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (i.model && i.model.toLowerCase().includes(searchQuery.toLowerCase()))
      );
  }, [aiItems, selectedCategory, searchQuery]);

  /**
   * Run AI spend analysis
   */
  const runAnalysis = useCallback(async () => {
    if (!spectrum.spectrum.isReady || !hasData || !queryEnriched) return;

    setIsScanning(true);
    console.log('[AIAnalytics] Starting AI spend analysis...');

    try {
      const days = parseInt(selectedTimeframe.replace('d', ''));
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      // Query resource-level data
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
          BillingCurrency as Currency,
          CAST(ChargePeriodStart AS DATE) as ChargeDate
        FROM ${UNIFIED_VIEW_NAME}
        WHERE ChargePeriodStart >= epoch_ms(${startDate.getTime()})
          AND ChargePeriodEnd < epoch_ms(${endDate.getTime()})
          AND ResourceId IS NOT NULL
        GROUP BY 1, 2, 3, 4, 5, 6, 9, 10, 11
        ORDER BY TotalCost DESC
        LIMIT 10000
      `;

      const result = await queryEnriched(query);

      if (!result || result.length === 0) {
        console.log('[AIAnalytics] No data found');
        setAiItems([]);
        setSummary(null);
        setEfficiency(null);
        setLastScan(new Date());
        return;
      }

      // Group by resource
      const resourceMap = new Map<string, {
        resourceId: string;
        resourceName: string;
        resourceType: string;
        serviceName: string;
        serviceCategory: string;
        region: string;
        totalCost: number;
        usageQuantity: number;
        pricingUnit: string;
        currency: string;
        dailyCosts: { date: string; cost: number }[];
      }>();

      for (const row of result) {
        const resourceId = String(row.ResourceId || '');
        const cost = Number(row.TotalCost) || 0;

        if (!resourceMap.has(resourceId)) {
          resourceMap.set(resourceId, {
            resourceId,
            resourceName: String(row.ResourceName || resourceId),
            resourceType: String(row.ResourceType || 'Unknown'),
            serviceName: String(row.ServiceName || 'Unknown'),
            serviceCategory: String(row.ServiceCategory || 'Unknown'),
            region: String(row.ResourceRegion || 'Unknown'),
            totalCost: 0,
            usageQuantity: 0,
            pricingUnit: String(row.PricingUnit || 'units'),
            currency: String(row.Currency || 'USD'),
            dailyCosts: [],
          });
        }

        const resource = resourceMap.get(resourceId)!;
        resource.totalCost += cost;
        resource.usageQuantity += Number(row.UsageQuantity) || 0;
        resource.dailyCosts.push({
          date: String(row.ChargeDate || ''),
          cost,
        });
      }

      // Analyze AI spend
      const resources = Array.from(resourceMap.values());
      console.log(`[AIAnalytics] Analyzing ${resources.length} resources for AI services...`);

      const detectedItems = engine.analyzeAISpend(resources);
      const spendSummary = engine.generateSummary(detectedItems, { start: startDate, end: endDate });
      const efficiencyMetrics = engine.calculateEfficiencyMetrics(detectedItems);

      console.log(`[AIAnalytics] Found ${detectedItems.length} AI-related resources`);

      setAiItems(detectedItems);
      setSummary(spendSummary);
      setEfficiency(efficiencyMetrics);
      setLastScan(new Date());

    } catch (error) {
      console.error('[AIAnalytics] Analysis error:', error);
    } finally {
      setIsScanning(false);
    }
  }, [spectrum.spectrum.isReady, hasData, queryEnriched, selectedTimeframe, engine]);

  // Load scan settings
  useEffect(() => {
    const settings = loadScanSettings(SCAN_SETTINGS_KEYS.aiAnalytics);
    if (settings?.frequency) {
      setScanFrequency(settings.frequency);
    }
    if (settings?.lastScan) {
      setLastScan(settings.lastScan);
    }
  }, []);

  // Save scan settings when frequency changes
  useEffect(() => {
    saveScanSettings(SCAN_SETTINGS_KEYS.aiAnalytics, {
      frequency: scanFrequency,
      lastScan: lastScan || undefined,
    });
    if (lastScan && scanFrequency !== 'manual') {
      setNextScheduledScan(calculateNextScan(scanFrequency, lastScan));
    } else {
      setNextScheduledScan(null);
    }
  }, [scanFrequency, lastScan]);

  // Auto-scan based on frequency (only check on interval, not on state changes)
  useEffect(() => {
    if (scanFrequency === 'manual') return;
    if (!spectrum.spectrum.isReady || !hasData) return;

    // Set up interval to check for due scans (every minute)
    const interval = setInterval(() => {
      if (isScanDue(scanFrequency, lastScan) && !isScanning) {
        console.log('[AIAnalytics] Auto-scan triggered by schedule');
        runAnalysis();
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [scanFrequency, lastScan, spectrum.spectrum.isReady, hasData, isScanning, runAnalysis]);

  // Auto-run on mount
  useEffect(() => {
    if (spectrum.spectrum.isReady && hasData && !isScanning && aiItems.length === 0) {
      const timer = setTimeout(() => runAnalysis(), 500);
      return () => clearTimeout(timer);
    }
  }, [spectrum.spectrum.isReady, hasData, isScanning, aiItems.length, runAnalysis]);

  // Category chart data
  const categoryChartData = useMemo(() => {
    if (!summary) return [];
    return Object.entries(summary.byCategory)
      .filter(([, v]) => v.cost > 0)
      .map(([category, data]) => ({
        name: getCategoryLabel(category as AIServiceCategory),
        value: data.cost,
        count: data.count,
        trend: data.trend,
        fill: CATEGORY_COLORS[category as AIServiceCategory] || '#9ca3af',
      }))
      .sort((a, b) => b.value - a.value);
  }, [summary]);

  // Daily trend chart data
  const trendChartData = useMemo(() => {
    if (!summary) return [];
    return summary.dailyTrend.map(d => ({
      ...d,
      date: d.date.split('-').slice(1).join('/'), // MM/DD format
    }));
  }, [summary]);

  // Loading state
  if (!spectrum.spectrum.isReady || isDetecting) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Initializing AI Analytics...</p>
        </div>
      </div>
    );
  }

  // No data state
  if (!hasData) {
    return (
      <EmptyState
        icon={BrainCircuit}
        title="No billing data available"
        description="Load your cloud billing data to start tracking AI and ML spending."
        action={{ 
          label: 'Go to Data Sources',
          href: '/dashboard/sources'
        }}
        skeletonType="analytics"
      />
    );
  }

  // No AI spend found
  if (!isScanning && aiItems.length === 0 && lastScan) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BrainCircuit className="h-6 w-6 text-purple-500" />
              AI Analytics
            </h1>
            <p className="text-muted-foreground">Track AI and ML cloud spending</p>
          </div>
          <Button onClick={runAnalysis} size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Re-scan
          </Button>
        </div>

        <Card className="border-purple-500/20">
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Brain className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-lg font-medium">No AI Services Detected</h3>
              <p className="text-muted-foreground mt-2 max-w-md mx-auto">
                We didn't find any AI-related services in your billing data. This could mean:
              </p>
              <ul className="text-sm text-muted-foreground mt-4 space-y-1">
                <li>• You haven't used AI services in the selected time period</li>
                <li>• AI costs are categorized under different service names</li>
                <li>• The data source doesn't include AI service details</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BrainCircuit className="h-6 w-6 text-purple-500" />
            AI Analytics
          </h1>
          <p className="text-muted-foreground">
            Track and optimize your AI and ML cloud spending
          </p>
          {lastScan && (
            <p className="text-xs text-muted-foreground mt-1">
              Last scan: {lastScan.toLocaleString()}
              {nextScheduledScan && scanFrequency !== 'manual' && (
                <> • Next: {formatTimeUntil(nextScheduledScan)}</>
              )}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Select value={selectedTimeframe} onValueChange={setSelectedTimeframe}>
            <SelectTrigger className="w-32">
              <Clock className="h-4 w-4 mr-2" />
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

          <Select value={scanFrequency} onValueChange={(v) => setScanFrequency(v as ScanFrequency)}>
            <SelectTrigger className="w-36">
              <Timer className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SCAN_FREQUENCY_OPTIONS.map((freq) => (
                <SelectItem key={freq.value} value={freq.value}>
                  {freq.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={runAnalysis} disabled={isScanning} size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${isScanning ? 'animate-spin' : ''}`} />
            {isScanning ? 'Analyzing...' : 'Analyze'}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-purple-500/50 bg-purple-500/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total AI Spend</CardTitle>
            <BrainCircuit className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(summary?.totalSpend || 0, currency)}
            </div>
            <div className="flex items-center text-xs text-muted-foreground">
              {summary && summary.spendTrend !== 0 && (
                <>
                  {summary.spendTrend > 0 ? (
                    <ArrowUpRight className="h-3 w-3 text-red-500 mr-1" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3 text-green-500 mr-1" />
                  )}
                  <span className={summary.spendTrend > 0 ? 'text-red-500' : 'text-green-500'}>
                    {Math.abs(summary.spendTrend).toFixed(1)}%
                  </span>
                  <span className="ml-1">vs last period</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">LLM Spend</CardTitle>
            <Sparkles className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(summary?.byCategory.llm?.cost || 0, currency)}
            </div>
            <p className="text-xs text-muted-foreground">
              {summary?.byCategory.llm?.count || 0} resources
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">GPU Compute</CardTitle>
            <Cpu className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(summary?.byCategory['gpu-compute']?.cost || 0, currency)}
            </div>
            <p className="text-xs text-muted-foreground">
              {summary?.byCategory['gpu-compute']?.count || 0} instances
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Projected Monthly</CardTitle>
            <Target className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(summary?.projectedMonthly || 0, currency)}
            </div>
            <p className="text-xs text-muted-foreground">
              Based on current usage
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
                <CardTitle>AI Spend Analysis</CardTitle>
              </div>
              {isChartsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent>
              <Tabs defaultValue="trend" className="space-y-4">
                <TabsList>
                  <TabsTrigger value="trend">Spend Trend</TabsTrigger>
                  <TabsTrigger value="breakdown">Category Breakdown</TabsTrigger>
                  <TabsTrigger value="models">By Model</TabsTrigger>
                </TabsList>

                <TabsContent value="trend">
                  {trendChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <ComposedChart data={trendChartData}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                        <YAxis tickFormatter={(v) => `${SUPPORTED_CURRENCIES[currency]?.symbol || currency}${(v / 1000).toFixed(0)}k`} />
                        <Tooltip
                          formatter={(value, name) => [
                            formatCurrency(Number(value) || 0, currency),
                            name === 'cost' ? 'Total' : 
                            name === 'llm' ? 'LLM' :
                            name === 'training' ? 'Training' :
                            name === 'inference' ? 'Inference' : String(name || '')
                          ]}
                        />
                        <Legend />
                        <Area
                          type="monotone"
                          dataKey="cost"
                          fill="#8b5cf6"
                          fillOpacity={0.2}
                          stroke="#8b5cf6"
                          strokeWidth={2}
                          name="Total AI Spend"
                        />
                        <Line
                          type="monotone"
                          dataKey="llm"
                          stroke="#f59e0b"
                          strokeWidth={2}
                          dot={false}
                          name="LLM"
                        />
                        <Line
                          type="monotone"
                          dataKey="training"
                          stroke="#10b981"
                          strokeWidth={2}
                          dot={false}
                          name="Training"
                        />
                        <Line
                          type="monotone"
                          dataKey="inference"
                          stroke="#3b82f6"
                          strokeWidth={2}
                          dot={false}
                          name="Inference"
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                      No trend data available
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="breakdown">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Category Pie Chart */}
                    <div>
                      <h4 className="text-sm font-medium mb-4">Spend by Category</h4>
                      {categoryChartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={280}>
                          <RePieChart>
                            <Pie
                              data={categoryChartData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={100}
                              dataKey="value"
                              label={({ name, percent }) => `${(name || '').toString().split(' ')[0]} ${((percent || 0) * 100).toFixed(0)}%`}
                              labelLine={{ strokeWidth: 1 }}
                            >
                              {categoryChartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} />
                              ))}
                            </Pie>
                            <Tooltip
                              formatter={(value) => [formatCurrency(Number(value) || 0, currency), 'Spend']}
                            />
                          </RePieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                          No category data
                        </div>
                      )}
                    </div>

                    {/* Category Bar Chart */}
                    <div>
                      <h4 className="text-sm font-medium mb-4">Category Comparison</h4>
                      {categoryChartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={280}>
                          <BarChart data={categoryChartData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                            <XAxis type="number" tickFormatter={(v) => `${SUPPORTED_CURRENCIES[currency]?.symbol || currency}${(v / 1000).toFixed(0)}k`} />
                            <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                            <Tooltip
                              formatter={(value) => [formatCurrency(Number(value) || 0, currency), 'Spend']}
                            />
                            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                              {categoryChartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                          No category data
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="models">
                  {summary && summary.byModel.length > 0 ? (
                    <div className="space-y-3">
                      {summary.byModel.slice(0, 8).map((model, idx) => (
                        <div key={model.name} className="flex items-center gap-3">
                          <span className="text-sm text-muted-foreground w-6">{idx + 1}</span>
                          <Badge variant="secondary" className="min-w-[100px]">
                            {getCategoryIcon('llm')} {model.name}
                          </Badge>
                          <div className="flex-1">
                            <Progress
                              value={(model.cost / summary.totalSpend) * 100}
                              className="h-2"
                            />
                          </div>
                          <span className="text-sm font-medium min-w-[100px] text-right">
                            {formatCurrency(model.cost, currency)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No specific AI models detected in resource names</p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Efficiency Insights */}
      {efficiency && summary && summary.byCategory.llm?.cost > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Gauge className="h-5 w-5" />
              Optimization Opportunities
            </CardTitle>
            <CardDescription>
              Potential savings based on usage patterns
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-medium">Off-Peak Scheduling</span>
                </div>
                <div className="text-xl font-bold text-green-600">
                  {formatCurrency(efficiency.offPeakSavingsPotential, currency)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Shift batch jobs to off-peak hours
                </p>
              </div>

              <div className="border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm font-medium">Request Batching</span>
                </div>
                <div className="text-xl font-bold text-green-600">
                  {formatCurrency(efficiency.batchingPotential, currency)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Batch multiple requests together
                </p>
              </div>

              <div className="border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="h-4 w-4 text-purple-500" />
                  <span className="text-sm font-medium">Model Optimization</span>
                </div>
                <div className="text-xl font-bold text-green-600">
                  {formatCurrency(efficiency.modelDowngradeSavings, currency)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Use smaller models where appropriate
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resource List */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle className="text-lg">AI Resources</CardTitle>
            <div className="flex items-center gap-2">
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
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="llm">LLM</SelectItem>
                  <SelectItem value="ml-training">ML Training</SelectItem>
                  <SelectItem value="ml-inference">ML Inference</SelectItem>
                  <SelectItem value="gpu-compute">GPU Compute</SelectItem>
                  <SelectItem value="cognitive-services">Cognitive Services</SelectItem>
                  <SelectItem value="vector-db">Vector DB</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isScanning ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No AI resources found matching your filters</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground mb-4">
                {filteredItems.length} AI resources • Total: {formatCurrency(
                  filteredItems.reduce((sum, i) => sum + i.totalCost, 0), 
                  currency
                )}
              </div>

              {filteredItems.slice(0, 30).map((item) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  className="border rounded-lg p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{getCategoryIcon(item.serviceCategory)}</span>
                        <span className="font-medium truncate">{item.resourceName}</span>
                        <Badge
                          style={{ backgroundColor: getCategoryColor(item.serviceCategory) + '20', color: getCategoryColor(item.serviceCategory) }}
                        >
                          {getCategoryLabel(item.serviceCategory)}
                        </Badge>
                        {item.model && (
                          <Badge variant="outline" className="text-xs">
                            {item.model}
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {item.serviceName} • {item.region}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-lg font-bold">
                        {formatCurrency(item.totalCost, currency)}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center justify-end gap-1">
                        {item.costTrend !== 0 && (
                          <>
                            {item.costTrend > 0 ? (
                              <ArrowUpRight className="h-3 w-3 text-red-500" />
                            ) : (
                              <ArrowDownRight className="h-3 w-3 text-green-500" />
                            )}
                            <span className={item.costTrend > 0 ? 'text-red-500' : 'text-green-500'}>
                              {Math.abs(item.costTrend).toFixed(1)}%
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {filteredItems.length > 30 && (
                <p className="text-center text-muted-foreground text-sm py-4">
                  Showing top 30 of {filteredItems.length} resources
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <DialogContent className="max-w-lg">
          {selectedItem && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{getCategoryIcon(selectedItem.serviceCategory)}</span>
                  <div>
                    <DialogTitle>{selectedItem.resourceName}</DialogTitle>
                    <DialogDescription>
                      {getCategoryLabel(selectedItem.serviceCategory)} • {selectedItem.serviceName}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="border rounded-lg p-3">
                    <div className="text-sm text-muted-foreground">Total Cost</div>
                    <div className="text-xl font-bold">
                      {formatCurrency(selectedItem.totalCost, currency)}
                    </div>
                  </div>
                  <div className="border rounded-lg p-3">
                    <div className="text-sm text-muted-foreground">Daily Average</div>
                    <div className="text-xl font-bold">
                      {formatCurrency(selectedItem.dailyAvgCost, currency)}
                    </div>
                  </div>
                </div>

                <Table>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Resource ID</TableCell>
                      <TableCell className="font-mono text-xs">{selectedItem.resourceId}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Type</TableCell>
                      <TableCell>{selectedItem.resourceType}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Region</TableCell>
                      <TableCell>{selectedItem.region}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Provider</TableCell>
                      <TableCell className="capitalize">{selectedItem.provider}</TableCell>
                    </TableRow>
                    {selectedItem.model && (
                      <TableRow>
                        <TableCell className="font-medium">Model</TableCell>
                        <TableCell>{selectedItem.model}</TableCell>
                      </TableRow>
                    )}
                    <TableRow>
                      <TableCell className="font-medium">Usage</TableCell>
                      <TableCell>
                        {selectedItem.usageQuantity.toLocaleString()} {selectedItem.usageUnit}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>

                {/* Mini trend chart */}
                {selectedItem.dailyCosts.length > 1 && (
                  <div>
                    <div className="text-sm font-medium mb-2">Cost Trend</div>
                    <ResponsiveContainer width="100%" height={100}>
                      <AreaChart data={selectedItem.dailyCosts.slice(-14)}>
                        <Area
                          type="monotone"
                          dataKey="cost"
                          fill={getCategoryColor(selectedItem.serviceCategory)}
                          fillOpacity={0.2}
                          stroke={getCategoryColor(selectedItem.serviceCategory)}
                          strokeWidth={2}
                        />
                        <Tooltip
                          formatter={(value) => [formatCurrency(Number(value) || 0, currency), 'Cost']}
                          labelFormatter={(label) => label}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
