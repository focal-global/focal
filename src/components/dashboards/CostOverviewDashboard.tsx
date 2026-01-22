'use client';

/**
 * Cost Overview Dashboard
 * 
 * Executive summary dashboard for cloud cost analysis.
 * Combines KPIs, trends, and breakdowns into a single view.
 * 
 * FinOps Foundation Alignment:
 * - Reporting & Analytics domain
 * - High-level cost visibility
 * - Trend identification
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { RefreshCw, Calendar, TrendingUp, TrendingDown, AlertTriangle, Loader2, Database } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSpectrum, UNIFIED_VIEW_NAME } from '@/components/providers/spectrum-provider';
import { KPICard, CostTrendChart, CostBreakdownChart, CostTreemap } from '@/components/charts';
import { formatCurrency, SUPPORTED_CURRENCIES } from '@/lib/currency';
import { NoDataState } from '@/components/ui/empty-state';
import type { CostTrendData } from '@/components/charts/CostTrendChart';
import type { CostBreakdownData } from '@/components/charts/CostBreakdownChart';
import type { TreemapData } from '@/components/charts/CostTreemap';

// ============================================================================
// Types
// ============================================================================

interface DashboardData {
  totalBilledCost: number;
  totalEffectiveCost: number;
  totalSavings: number;
  previousPeriodCost: number;
  costByService: CostBreakdownData[];
  costByRegion: CostBreakdownData[];
  costTrend: CostTrendData[];
  costByServiceCategory: TreemapData[];
  topResources: Array<{
    resourceId: string;
    resourceName: string;
    serviceName: string;
    cost: number;
  }>;
  tagCoverage: {
    tagged: number;
    untagged: number;
    taggedPercent: number;
  };
}

interface CostOverviewDashboardProps {
  /** Default currency */
  currency?: string;
}

// ============================================================================
// Utility Functions
// ============================================================================

function getDefaultDateRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

function formatDateForSQL(date: string): string {
  return date;
}

// ============================================================================
// Dashboard Component
// ============================================================================

export function CostOverviewDashboard({ currency = 'USD' }: CostOverviewDashboardProps) {
  const { isReady, query: executeQuery, unifiedView, isLoadingSources } = useSpectrum();
  
  // State
  const [dateRange, setDateRange] = useState(getDefaultDateRange);
  const [isLoading, setIsLoading] = useState(false);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Detected currency from unified view
  const effectiveCurrency = useMemo(() => {
    return unifiedView.detectedCurrency || currency;
  }, [unifiedView.detectedCurrency, currency]);

  // Load dashboard data
  const loadDashboardData = useCallback(async () => {
    if (!isReady || !unifiedView.exists) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const startDate = formatDateForSQL(dateRange.start);
      const endDate = formatDateForSQL(dateRange.end);
      
      // Calculate previous period for comparison
      const startMs = new Date(startDate).getTime();
      const endMs = new Date(endDate).getTime();
      const periodLength = endMs - startMs;
      const prevStart = new Date(startMs - periodLength).toISOString().split('T')[0];
      const prevEnd = startDate;
      
      // Execute all queries in parallel
      const [
        summaryResult,
        prevSummaryResult,
        serviceResult,
        regionResult,
        trendResult,
        categoryResult,
        topResourcesResult,
        tagCoverageResult,
      ] = await Promise.all([
        // Current period summary
        executeQuery<{ TotalBilled: number; TotalEffective: number; TotalList: number }>(`
          SELECT 
            CAST(SUM(BilledCost) AS DOUBLE) AS TotalBilled,
            CAST(SUM(EffectiveCost) AS DOUBLE) AS TotalEffective,
            CAST(SUM(ListCost) AS DOUBLE) AS TotalList
          FROM ${UNIFIED_VIEW_NAME}
          WHERE ChargePeriodStart >= epoch_ms(${new Date(startDate).getTime()})
            AND ChargePeriodEnd < epoch_ms(${new Date(endDate).getTime()})
        `),
        
        // Previous period summary for comparison
        executeQuery<{ TotalBilled: number }>(`
          SELECT CAST(SUM(BilledCost) AS DOUBLE) AS TotalBilled
          FROM ${UNIFIED_VIEW_NAME}
          WHERE ChargePeriodStart >= epoch_ms(${new Date(prevStart).getTime()})
            AND ChargePeriodEnd < epoch_ms(${new Date(prevEnd).getTime()})
        `),
        
        // Cost by service
        executeQuery<{ ServiceName: string; TotalCost: number }>(`
          SELECT 
            ServiceName,
            CAST(SUM(BilledCost) AS DOUBLE) AS TotalCost
          FROM ${UNIFIED_VIEW_NAME}
          WHERE ChargePeriodStart >= epoch_ms(${new Date(startDate).getTime()})
            AND ChargePeriodEnd < epoch_ms(${new Date(endDate).getTime()})
          GROUP BY ServiceName
          ORDER BY TotalCost DESC
          LIMIT 10
        `),
        
        // Cost by region
        executeQuery<{ RegionName: string; TotalCost: number }>(`
          SELECT 
            COALESCE(RegionName, 'Unknown') AS RegionName,
            CAST(SUM(BilledCost) AS DOUBLE) AS TotalCost
          FROM ${UNIFIED_VIEW_NAME}
          WHERE ChargePeriodStart >= epoch_ms(${new Date(startDate).getTime()})
            AND ChargePeriodEnd < epoch_ms(${new Date(endDate).getTime()})
          GROUP BY RegionName
          ORDER BY TotalCost DESC
          LIMIT 8
        `),
        
        // Daily cost trend
        executeQuery<{ Day: string; BilledCost: number; EffectiveCost: number }>(`
          SELECT 
            strftime(ChargePeriodStart, '%Y-%m-%d') AS Day,
            CAST(SUM(BilledCost) AS DOUBLE) AS BilledCost,
            CAST(SUM(EffectiveCost) AS DOUBLE) AS EffectiveCost
          FROM ${UNIFIED_VIEW_NAME}
          WHERE ChargePeriodStart >= epoch_ms(${new Date(startDate).getTime()})
            AND ChargePeriodEnd < epoch_ms(${new Date(endDate).getTime()})
          GROUP BY strftime(ChargePeriodStart, '%Y-%m-%d')
          ORDER BY Day
        `),
        
        // Cost by service category (for treemap)
        executeQuery<{ ServiceCategory: string; TotalCost: number }>(`
          SELECT 
            COALESCE(ServiceCategory, 'Other') AS ServiceCategory,
            CAST(SUM(BilledCost) AS DOUBLE) AS TotalCost
          FROM ${UNIFIED_VIEW_NAME}
          WHERE ChargePeriodStart >= epoch_ms(${new Date(startDate).getTime()})
            AND ChargePeriodEnd < epoch_ms(${new Date(endDate).getTime()})
          GROUP BY ServiceCategory
          ORDER BY TotalCost DESC
        `),
        
        // Top resources by cost
        executeQuery<{ ResourceId: string; ResourceName: string; ServiceName: string; TotalCost: number }>(`
          SELECT 
            ResourceId,
            ResourceName,
            ServiceName,
            CAST(SUM(BilledCost) AS DOUBLE) AS TotalCost
          FROM ${UNIFIED_VIEW_NAME}
          WHERE ChargePeriodStart >= epoch_ms(${new Date(startDate).getTime()})
            AND ChargePeriodEnd < epoch_ms(${new Date(endDate).getTime()})
            AND ResourceId IS NOT NULL
            AND ResourceId != ''
          GROUP BY ResourceId, ResourceName, ServiceName
          ORDER BY TotalCost DESC
          LIMIT 5
        `),
        
        // Tag coverage
        executeQuery<{ TagStatus: string; TotalCost: number }>(`
          SELECT 
            CASE 
              WHEN Tags IS NULL OR Tags = '{}' OR Tags = '' THEN 'Untagged' 
              ELSE 'Tagged' 
            END AS TagStatus,
            CAST(SUM(BilledCost) AS DOUBLE) AS TotalCost
          FROM ${UNIFIED_VIEW_NAME}
          WHERE ChargePeriodStart >= epoch_ms(${new Date(startDate).getTime()})
            AND ChargePeriodEnd < epoch_ms(${new Date(endDate).getTime()})
          GROUP BY TagStatus
        `),
      ]);
      
      // Process results
      const summary = summaryResult[0] || { TotalBilled: 0, TotalEffective: 0, TotalList: 0 };
      const prevSummary = prevSummaryResult[0] || { TotalBilled: 0 };
      
      // Process tag coverage
      const taggedCost = tagCoverageResult.find(r => r.TagStatus === 'Tagged')?.TotalCost || 0;
      const untaggedCost = tagCoverageResult.find(r => r.TagStatus === 'Untagged')?.TotalCost || 0;
      const totalTagCost = taggedCost + untaggedCost;
      
      setDashboardData({
        totalBilledCost: summary.TotalBilled || 0,
        totalEffectiveCost: summary.TotalEffective || 0,
        totalSavings: (summary.TotalList || 0) - (summary.TotalEffective || 0),
        previousPeriodCost: prevSummary.TotalBilled || 0,
        costByService: serviceResult.map(r => ({
          name: r.ServiceName || 'Unknown',
          value: r.TotalCost || 0,
        })),
        costByRegion: regionResult.map(r => ({
          name: r.RegionName || 'Unknown',
          value: r.TotalCost || 0,
        })),
        costTrend: trendResult.map(r => ({
          date: r.Day?.split('-').slice(1).join('/') || '', // Format as MM/DD
          billedCost: r.BilledCost || 0,
          effectiveCost: r.EffectiveCost || 0,
        })),
        costByServiceCategory: categoryResult.map(r => ({
          name: r.ServiceCategory || 'Other',
          value: r.TotalCost || 0,
        })),
        topResources: topResourcesResult.map(r => ({
          resourceId: r.ResourceId || '',
          resourceName: r.ResourceName || r.ResourceId || 'Unknown',
          serviceName: r.ServiceName || '',
          cost: r.TotalCost || 0,
        })),
        tagCoverage: {
          tagged: taggedCost,
          untagged: untaggedCost,
          taggedPercent: totalTagCost > 0 ? (taggedCost / totalTagCost) * 100 : 0,
        },
      });
      
    } catch (err) {
      console.error('Dashboard query error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    }
    
    setIsLoading(false);
  }, [isReady, executeQuery, unifiedView.exists, dateRange]);

  // Load data when ready
  useEffect(() => {
    if (isReady && unifiedView.exists) {
      loadDashboardData();
    }
  }, [isReady, unifiedView.exists, loadDashboardData]);

  // Loading state (engine initializing or loading data sources)
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

  // No data state - show skeleton with CTA (only after loading is complete)
  if (!unifiedView.exists) {
    return <NoDataState skeletonType="dashboard" />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Cost Overview</h2>
          <p className="text-muted-foreground">
            Executive summary of your cloud spending
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Date Range */}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="w-32 h-8"
            />
            <span className="text-muted-foreground">→</span>
            <Input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="w-32 h-8"
            />
          </div>
          {/* Currency Badge */}
          <Badge variant="outline">{effectiveCurrency}</Badge>
          {/* Refresh */}
          <Button
            variant="outline"
            size="sm"
            onClick={loadDashboardData}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI Cards */}
      {dashboardData && (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <KPICard
              title="Total Billed Cost"
              value={dashboardData.totalBilledCost}
              currency={effectiveCurrency}
              previousValue={dashboardData.previousPeriodCost}
              icon="💵"
              footer="Current period spend"
              sparklineData={dashboardData.costTrend.map(d => d.billedCost || 0)}
            />
            <KPICard
              title="Effective Cost"
              value={dashboardData.totalEffectiveCost}
              currency={effectiveCurrency}
              icon="💰"
              footer="After discounts & credits"
              sparklineData={dashboardData.costTrend.map(d => d.effectiveCost || 0)}
            />
            <KPICard
              title="Total Savings"
              value={dashboardData.totalSavings}
              currency={effectiveCurrency}
              icon="🎯"
              footer="vs list price"
              inverseTrend
            />
            <KPICard
              title="Tag Coverage"
              value={dashboardData.tagCoverage.taggedPercent}
              currency=""
              icon="🏷️"
              footer={`${formatCurrency(dashboardData.tagCoverage.tagged, effectiveCurrency, { compact: true })} tagged`}
            />
          </div>

          {/* Charts Row 1 */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Cost Trend */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Cost Trend</CardTitle>
                <CardDescription>Daily billed vs effective cost</CardDescription>
              </CardHeader>
              <CardContent>
                <CostTrendChart
                  data={dashboardData.costTrend}
                  costTypes={['billedCost', 'effectiveCost']}
                  currency={effectiveCurrency}
                  height={250}
                />
              </CardContent>
            </Card>

            {/* Cost by Service */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Cost by Service</CardTitle>
                <CardDescription>Top 10 services by spend</CardDescription>
              </CardHeader>
              <CardContent>
                <CostBreakdownChart
                  data={dashboardData.costByService}
                  currency={effectiveCurrency}
                  height={250}
                />
              </CardContent>
            </Card>
          </div>

          {/* Charts Row 2 */}
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Cost by Region */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Cost by Region</CardTitle>
                <CardDescription>Geographic distribution</CardDescription>
              </CardHeader>
              <CardContent>
                <CostBreakdownChart
                  data={dashboardData.costByRegion}
                  currency={effectiveCurrency}
                  height={200}
                  outerRadius={80}
                  innerRadius={50}
                  showLegend={false}
                />
              </CardContent>
            </Card>

            {/* Cost Treemap */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Cost by Category</CardTitle>
                <CardDescription>Service category breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                <CostTreemap
                  data={dashboardData.costByServiceCategory}
                  currency={effectiveCurrency}
                  height={200}
                />
              </CardContent>
            </Card>
          </div>

          {/* Top Resources */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top Resources by Cost</CardTitle>
              <CardDescription>Highest spending resources</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {dashboardData.topResources.map((resource, index) => (
                  <div
                    key={resource.resourceId}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-muted-foreground w-6">
                        #{index + 1}
                      </span>
                      <div>
                        <p className="font-medium truncate max-w-[300px]">
                          {resource.resourceName}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {resource.serviceName}
                        </p>
                      </div>
                    </div>
                    <span className="font-mono font-medium">
                      {formatCurrency(resource.cost, effectiveCurrency, { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                ))}
                {dashboardData.topResources.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">
                    No resource-level data available
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Loading Skeleton */}
      {isLoading && !dashboardData && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse space-y-3">
                  <div className="h-4 w-24 bg-muted rounded" />
                  <div className="h-8 w-32 bg-muted rounded" />
                  <div className="h-4 w-20 bg-muted rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
