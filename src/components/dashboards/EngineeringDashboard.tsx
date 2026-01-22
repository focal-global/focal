'use client';

/**
 * Engineering Dashboard
 * 
 * Resource optimization and utilization metrics for DevOps/Platform teams.
 * Focuses on:
 * - Resource-level cost visibility
 * - Cost anomaly detection
 * - Environment breakdown
 * - Optimization opportunities
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  RefreshCw, 
  Loader2,
  Server,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Layers,
  MapPin,
  Zap,
  Activity,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSpectrum, UNIFIED_VIEW_NAME } from '@/components/providers/spectrum-provider';
import { KPICard, CostTrendChart, CostBreakdownChart } from '@/components/charts';
import { formatCurrency } from '@/lib/currency';
import { NoDataState } from '@/components/ui/empty-state';
import { useAnomalySummary, type AnomalySeverity } from '@/hooks/use-anomalies';
import type { CostTrendData } from '@/components/charts/CostTrendChart';
import type { CostBreakdownData } from '@/components/charts/CostBreakdownChart';

// ============================================================================
// Types
// ============================================================================

interface EngineeringDashboardData {
  totalCost: number;
  previousPeriodCost: number;
  percentChange: number;
  resourceCount: number;
  serviceCount: number;
  avgCostPerResource: number;
  dailyTrend: CostTrendData[];
  costByService: CostBreakdownData[];
  costByRegion: CostBreakdownData[];
  costByEnvironment: CostBreakdownData[];
  topResources: Array<{
    resourceId: string;
    resourceName: string;
    serviceName: string;
    regionName: string;
    cost: number;
    previousCost: number;
    change: number;
    changePercent: number;
  }>;
  costByTeam: CostBreakdownData[];
}

// ============================================================================
// Component
// ============================================================================

export function EngineeringDashboard() {
  const { isReady, query: executeQuery, unifiedView, isLoadingSources } = useSpectrum();
  const router = useRouter();
  
  // Use shared anomaly system
  const { summary: anomalySummary, recentAnomalies, isLoading: isAnomalyLoading, refresh: refreshAnomalies } = useAnomalySummary();
  
  const [dateRange, setDateRange] = useState(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 14);
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    };
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<EngineeringDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const effectiveCurrency = useMemo(() => {
    return unifiedView.detectedCurrency || 'USD';
  }, [unifiedView.detectedCurrency]);

  const loadData = useCallback(async () => {
    if (!isReady || !unifiedView.exists) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const startMs = new Date(dateRange.start).getTime();
      const endMs = new Date(dateRange.end).getTime();
      const periodLength = endMs - startMs;
      const prevStart = new Date(startMs - periodLength).toISOString().split('T')[0];
      const prevEnd = dateRange.start;
      const prevStartMs = new Date(prevStart).getTime();
      const prevEndMs = new Date(prevEnd).getTime();
      
      const [
        summaryResult,
        prevSummaryResult,
        trendResult,
        serviceResult,
        regionResult,
        environmentResult,
        topResourcesResult,
        prevResourcesResult,
        teamResult,
      ] = await Promise.all([
        // Current period summary
        executeQuery<{ 
          TotalCost: number; 
          ResourceCount: number; 
          ServiceCount: number;
        }>(`
          SELECT 
            CAST(SUM(BilledCost) AS DOUBLE) AS TotalCost,
            COUNT(DISTINCT ResourceId) AS ResourceCount,
            COUNT(DISTINCT ServiceName) AS ServiceCount
          FROM ${UNIFIED_VIEW_NAME}
          WHERE ChargePeriodStart >= epoch_ms(${startMs})
            AND ChargePeriodEnd < epoch_ms(${endMs})
        `),
        
        // Previous period
        executeQuery<{ TotalCost: number }>(`
          SELECT CAST(SUM(BilledCost) AS DOUBLE) AS TotalCost
          FROM ${UNIFIED_VIEW_NAME}
          WHERE ChargePeriodStart >= epoch_ms(${prevStartMs})
            AND ChargePeriodEnd < epoch_ms(${prevEndMs})
        `),
        
        // Daily trend
        executeQuery<{ Day: string; BilledCost: number; EffectiveCost: number }>(`
          SELECT 
            strftime(ChargePeriodStart, '%Y-%m-%d') AS Day,
            CAST(SUM(BilledCost) AS DOUBLE) AS BilledCost,
            CAST(SUM(EffectiveCost) AS DOUBLE) AS EffectiveCost
          FROM ${UNIFIED_VIEW_NAME}
          WHERE ChargePeriodStart >= epoch_ms(${startMs})
            AND ChargePeriodEnd < epoch_ms(${endMs})
          GROUP BY strftime(ChargePeriodStart, '%Y-%m-%d')
          ORDER BY Day
        `),
        
        // By service
        executeQuery<{ ServiceName: string; TotalCost: number }>(`
          SELECT 
            ServiceName,
            CAST(SUM(BilledCost) AS DOUBLE) AS TotalCost
          FROM ${UNIFIED_VIEW_NAME}
          WHERE ChargePeriodStart >= epoch_ms(${startMs})
            AND ChargePeriodEnd < epoch_ms(${endMs})
          GROUP BY ServiceName
          ORDER BY TotalCost DESC
          LIMIT 10
        `),
        
        // By region
        executeQuery<{ RegionName: string; TotalCost: number }>(`
          SELECT 
            COALESCE(RegionName, 'Unknown') AS RegionName,
            CAST(SUM(BilledCost) AS DOUBLE) AS TotalCost
          FROM ${UNIFIED_VIEW_NAME}
          WHERE ChargePeriodStart >= epoch_ms(${startMs})
            AND ChargePeriodEnd < epoch_ms(${endMs})
          GROUP BY RegionName
          ORDER BY TotalCost DESC
          LIMIT 8
        `),
        
        // By environment tag
        executeQuery<{ Environment: string; TotalCost: number }>(`
          SELECT 
            COALESCE(
              json_extract_string(Tags, '$.Environment'),
              json_extract_string(Tags, '$.environment'),
              json_extract_string(Tags, '$.env'),
              'Untagged'
            ) AS Environment,
            CAST(SUM(BilledCost) AS DOUBLE) AS TotalCost
          FROM ${UNIFIED_VIEW_NAME}
          WHERE ChargePeriodStart >= epoch_ms(${startMs})
            AND ChargePeriodEnd < epoch_ms(${endMs})
          GROUP BY Environment
          ORDER BY TotalCost DESC
        `),
        
        // Top resources - current period
        executeQuery<{ 
          ResourceId: string; 
          ResourceName: string; 
          ServiceName: string;
          RegionName: string;
          TotalCost: number 
        }>(`
          SELECT 
            ResourceId,
            ResourceName,
            ServiceName,
            COALESCE(RegionName, 'Unknown') AS RegionName,
            CAST(SUM(BilledCost) AS DOUBLE) AS TotalCost
          FROM ${UNIFIED_VIEW_NAME}
          WHERE ChargePeriodStart >= epoch_ms(${startMs})
            AND ChargePeriodEnd < epoch_ms(${endMs})
            AND ResourceId IS NOT NULL
            AND ResourceId != ''
          GROUP BY ResourceId, ResourceName, ServiceName, RegionName
          ORDER BY TotalCost DESC
          LIMIT 15
        `),
        
        // Top resources - previous period (for comparison)
        executeQuery<{ ResourceId: string; TotalCost: number }>(`
          SELECT 
            ResourceId,
            CAST(SUM(BilledCost) AS DOUBLE) AS TotalCost
          FROM ${UNIFIED_VIEW_NAME}
          WHERE ChargePeriodStart >= epoch_ms(${prevStartMs})
            AND ChargePeriodEnd < epoch_ms(${prevEndMs})
            AND ResourceId IS NOT NULL
            AND ResourceId != ''
          GROUP BY ResourceId
        `),
        
        // By team tag
        executeQuery<{ Team: string; TotalCost: number }>(`
          SELECT 
            COALESCE(
              json_extract_string(Tags, '$.Team'),
              json_extract_string(Tags, '$.team'),
              json_extract_string(Tags, '$.Owner'),
              json_extract_string(Tags, '$.owner'),
              'Unassigned'
            ) AS Team,
            CAST(SUM(BilledCost) AS DOUBLE) AS TotalCost
          FROM ${UNIFIED_VIEW_NAME}
          WHERE ChargePeriodStart >= epoch_ms(${startMs})
            AND ChargePeriodEnd < epoch_ms(${endMs})
          GROUP BY Team
          ORDER BY TotalCost DESC
          LIMIT 8
        `),
      ]);
      
      const summary = summaryResult[0] || { TotalCost: 0, ResourceCount: 0, ServiceCount: 0 };
      const prevSummary = prevSummaryResult[0] || { TotalCost: 0 };
      
      const totalCost = summary.TotalCost || 0;
      const previousCost = prevSummary.TotalCost || 0;
      const percentChange = previousCost > 0 ? ((totalCost - previousCost) / previousCost) * 100 : 0;
      const resourceCount = Number(summary.ResourceCount) || 0;
      const avgCost = resourceCount > 0 ? totalCost / resourceCount : 0;
      
      // Build previous resources map
      const prevResourceMap = new Map(prevResourcesResult.map(r => [r.ResourceId, r.TotalCost]));
      
      // Calculate top resources with change
      const topResources = topResourcesResult.map(r => {
        const prevCost = prevResourceMap.get(r.ResourceId) || 0;
        const change = r.TotalCost - prevCost;
        const changePercent = prevCost > 0 ? (change / prevCost) * 100 : (r.TotalCost > 0 ? 100 : 0);
        return {
          resourceId: r.ResourceId,
          resourceName: r.ResourceName || r.ResourceId,
          serviceName: r.ServiceName || 'Unknown',
          regionName: r.RegionName || 'Unknown',
          cost: r.TotalCost,
          previousCost: prevCost,
          change,
          changePercent,
        };
      });
      
      setData({
        totalCost,
        previousPeriodCost: previousCost,
        percentChange,
        resourceCount,
        serviceCount: Number(summary.ServiceCount) || 0,
        avgCostPerResource: avgCost,
        dailyTrend: trendResult.map(r => ({
          date: r.Day?.split('-').slice(1).join('/') || '',
          billedCost: r.BilledCost || 0,
          effectiveCost: r.EffectiveCost || 0,
        })),
        costByService: serviceResult.map(s => ({
          name: s.ServiceName || 'Unknown',
          value: s.TotalCost || 0,
        })),
        costByRegion: regionResult.map(r => ({
          name: r.RegionName || 'Unknown',
          value: r.TotalCost || 0,
        })),
        costByEnvironment: environmentResult.map(e => ({
          name: e.Environment || 'Untagged',
          value: e.TotalCost || 0,
        })),
        topResources,
        costByTeam: teamResult.map(t => ({
          name: t.Team || 'Unassigned',
          value: t.TotalCost || 0,
        })),
      });
      
    } catch (err) {
      console.error('Engineering dashboard error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    }
    
    setIsLoading(false);
  }, [isReady, executeQuery, unifiedView.exists, dateRange]);

  useEffect(() => {
    if (isReady && unifiedView.exists) {
      loadData();
    }
  }, [isReady, unifiedView.exists, loadData]);

  if (!isReady || isLoadingSources) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">
            {!isReady ? 'Initializing analytics engine...' : 'Loading data sources...'}
          </p>
        </div>
      </div>
    );
  }

  if (!unifiedView.exists) {
    return <NoDataState skeletonType="dashboard" />;
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground">From</Label>
            <Input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="w-auto"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground">To</Label>
            <Input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="w-auto"
            />
          </div>
        </div>
        <Button onClick={loadData} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <Card className="border-red-500/50 bg-red-500/10">
          <CardContent className="pt-4">
            <p className="text-red-500">{error}</p>
          </CardContent>
        </Card>
      )}

      {isLoading && !data && (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {data && (
        <>
          {/* KPI Row */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <KPICard
              title="Total Cost"
              value={data.totalCost}
              currency={effectiveCurrency}
              changePercent={data.percentChange}
              icon={<Activity className="h-4 w-4" />}
            />
            <KPICard
              title="Active Resources"
              value={data.resourceCount}
              icon={<Server className="h-4 w-4" />}
              footer={`${data.serviceCount} services`}
            />
            <KPICard
              title="Avg Cost/Resource"
              value={data.avgCostPerResource}
              currency={effectiveCurrency}
              icon={<Layers className="h-4 w-4" />}
            />
            <Card 
              className={`cursor-pointer transition-all hover:border-amber-500/50 ${
                anomalySummary.total > 0 ? 'border-amber-500/30 bg-amber-500/5' : ''
              }`}
              onClick={() => router.push('/dashboard/detector/anomalies')}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Cost Anomalies</CardTitle>
                <AlertTriangle className={`h-4 w-4 ${anomalySummary.critical > 0 ? 'text-red-500' : anomalySummary.high > 0 ? 'text-orange-500' : 'text-muted-foreground'}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {anomalySummary.total}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  {anomalySummary.critical > 0 && (
                    <Badge variant="destructive" className="text-[10px] px-1 py-0">
                      {anomalySummary.critical} critical
                    </Badge>
                  )}
                  {anomalySummary.high > 0 && (
                    <Badge className="bg-orange-500/20 text-orange-500 text-[10px] px-1 py-0">
                      {anomalySummary.high} high
                    </Badge>
                  )}
                  {anomalySummary.total === 0 && 'All normal'}
                  <ArrowRight className="h-3 w-3 ml-auto" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Cost Anomalies Alert - Using Shared System */}
          {(anomalySummary.critical > 0 || anomalySummary.high > 0) && (
            <Card className="border-amber-500/50 bg-amber-500/10">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-amber-500">
                    <AlertTriangle className="h-5 w-5" />
                    {anomalySummary.critical > 0 ? 'Critical Anomalies Detected' : 'Cost Anomalies Detected'}
                  </CardTitle>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => router.push('/dashboard/detector/anomalies')}
                    className="text-amber-500 hover:text-amber-400 hover:bg-amber-500/10"
                  >
                    View All <ExternalLink className="h-3 w-3 ml-1" />
                  </Button>
                </div>
                <CardDescription>
                  {anomalySummary.total} anomalies detected with {formatCurrency(anomalySummary.totalImpact, effectiveCurrency, { compact: true })} potential impact
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentAnomalies.slice(0, 5).map((anomaly, index) => (
                    <div
                      key={anomaly.id || index}
                      className="flex items-center justify-between p-3 rounded-lg bg-background/50 cursor-pointer hover:bg-background/80 transition-colors"
                      onClick={() => router.push(`/dashboard/detector/anomalies?resource=${encodeURIComponent(anomaly.resourceId)}`)}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{anomaly.resourceId}</p>
                        <p className="text-sm text-muted-foreground">{anomaly.serviceName}</p>
                      </div>
                      <div className="text-right ml-4">
                        <Badge 
                          variant={anomaly.severity === 'critical' ? 'destructive' : anomaly.severity === 'high' ? 'default' : 'secondary'}
                          className={anomaly.severity === 'critical' ? '' : anomaly.severity === 'high' ? 'bg-orange-500/20 text-orange-500' : ''}
                        >
                          {anomaly.severity === 'critical' ? '🚨' : anomaly.severity === 'high' ? '⚠️' : ''} 
                          +{anomaly.impact.percentageIncrease.toFixed(0)}%
                        </Badge>
                        <p className="text-sm text-muted-foreground mt-1">
                          {formatCurrency(anomaly.context.expectedCost, effectiveCurrency, { compact: true })} → {formatCurrency(anomaly.context.actualCost, effectiveCurrency, { compact: true })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                {anomalySummary.total > 5 && (
                  <Button 
                    variant="ghost" 
                    className="w-full mt-3 text-amber-500"
                    onClick={() => router.push('/dashboard/detector/anomalies')}
                  >
                    View all {anomalySummary.total} anomalies <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Trend Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Daily Cost Trend
              </CardTitle>
              <CardDescription>Cost pattern over selected period</CardDescription>
            </CardHeader>
            <CardContent>
              <CostTrendChart 
                data={data.dailyTrend} 
                height={300}
                currency={effectiveCurrency}
              />
            </CardContent>
          </Card>

          {/* Two Column Layout */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* By Service */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Layers className="h-5 w-5" />
                  Cost by Service
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CostBreakdownChart 
                  data={data.costByService} 
                  height={300}
                  currency={effectiveCurrency}
                />
              </CardContent>
            </Card>

            {/* By Region */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Cost by Region
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CostBreakdownChart 
                  data={data.costByRegion} 
                  height={300}
                  currency={effectiveCurrency}
                />
              </CardContent>
            </Card>
          </div>

          {/* Environment and Team */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* By Environment */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Cost by Environment
                </CardTitle>
                <CardDescription>Based on Environment tag</CardDescription>
              </CardHeader>
              <CardContent>
                <CostBreakdownChart 
                  data={data.costByEnvironment} 
                  height={250}
                  currency={effectiveCurrency}
                  donut={false}
                />
              </CardContent>
            </Card>

            {/* By Team */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5" />
                  Cost by Team/Owner
                </CardTitle>
                <CardDescription>Based on Team or Owner tag</CardDescription>
              </CardHeader>
              <CardContent>
                <CostBreakdownChart 
                  data={data.costByTeam} 
                  height={250}
                  currency={effectiveCurrency}
                />
              </CardContent>
            </Card>
          </div>

          {/* Top Resources */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                Top Resources by Cost
              </CardTitle>
              <CardDescription>Highest cost resources with period comparison</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium">Resource</th>
                      <th className="text-left py-3 px-4 font-medium">Service</th>
                      <th className="text-left py-3 px-4 font-medium">Region</th>
                      <th className="text-right py-3 px-4 font-medium">Cost</th>
                      <th className="text-right py-3 px-4 font-medium">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topResources.slice(0, 10).map((resource) => (
                      <tr key={resource.resourceId} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="py-3 px-4">
                          <p className="font-medium truncate max-w-[200px]" title={resource.resourceName}>
                            {resource.resourceName}
                          </p>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">{resource.serviceName}</td>
                        <td className="py-3 px-4 text-muted-foreground">{resource.regionName}</td>
                        <td className="py-3 px-4 text-right font-mono">
                          {formatCurrency(resource.cost, effectiveCurrency)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Badge 
                            variant={resource.change >= 0 ? 'destructive' : 'default'}
                            className={resource.change >= 0 ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}
                          >
                            {resource.change >= 0 ? <TrendingUp className="h-3 w-3 inline mr-1" /> : <TrendingDown className="h-3 w-3 inline mr-1" />}
                            {resource.change >= 0 ? '+' : ''}{resource.changePercent.toFixed(1)}%
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
