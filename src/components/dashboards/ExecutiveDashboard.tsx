'use client';

/**
 * Executive Dashboard
 * 
 * High-level KPIs and trends designed for leadership.
 * Focuses on:
 * - Total spend and month-over-month changes
 * - Forecast projections
 * - Top cost drivers
 * - Business-level insights
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { 
  RefreshCw, 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Loader2,
  DollarSign,
  BarChart3,
  Target,
  Zap,
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
import type { CostTrendData } from '@/components/charts/CostTrendChart';
import type { CostBreakdownData } from '@/components/charts/CostBreakdownChart';

// ============================================================================
// Types
// ============================================================================

interface ExecutiveDashboardData {
  totalCost: number;
  previousPeriodCost: number;
  percentChange: number;
  effectiveCost: number;
  savings: number;
  projectedMonthEnd: number;
  dailyTrend: CostTrendData[];
  topServices: CostBreakdownData[];
  topGrowingServices: Array<{
    name: string;
    currentCost: number;
    previousCost: number;
    change: number;
    changePercent: number;
  }>;
  costByCategory: CostBreakdownData[];
}

// ============================================================================
// Component
// ============================================================================

export function ExecutiveDashboard() {
  const { isReady, query: executeQuery, unifiedView, isLoadingSources } = useSpectrum();
  
  const [dateRange, setDateRange] = useState(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    };
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<ExecutiveDashboardData | null>(null);
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
      
      const [
        summaryResult,
        prevSummaryResult,
        trendResult,
        servicesResult,
        prevServicesResult,
        categoryResult,
      ] = await Promise.all([
        executeQuery<{ TotalBilled: number; TotalEffective: number; TotalList: number }>(`
          SELECT 
            CAST(SUM(BilledCost) AS DOUBLE) AS TotalBilled,
            CAST(SUM(EffectiveCost) AS DOUBLE) AS TotalEffective,
            CAST(SUM(ListCost) AS DOUBLE) AS TotalList
          FROM ${UNIFIED_VIEW_NAME}
          WHERE ChargePeriodStart >= epoch_ms(${startMs})
            AND ChargePeriodEnd < epoch_ms(${endMs})
        `),
        
        executeQuery<{ TotalBilled: number }>(`
          SELECT CAST(SUM(BilledCost) AS DOUBLE) AS TotalBilled
          FROM ${UNIFIED_VIEW_NAME}
          WHERE ChargePeriodStart >= epoch_ms(${new Date(prevStart).getTime()})
            AND ChargePeriodEnd < epoch_ms(${new Date(prevEnd).getTime()})
        `),
        
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
        
        executeQuery<{ ServiceName: string; TotalCost: number }>(`
          SELECT 
            ServiceName,
            CAST(SUM(BilledCost) AS DOUBLE) AS TotalCost
          FROM ${UNIFIED_VIEW_NAME}
          WHERE ChargePeriodStart >= epoch_ms(${new Date(prevStart).getTime()})
            AND ChargePeriodEnd < epoch_ms(${new Date(prevEnd).getTime()})
          GROUP BY ServiceName
          ORDER BY TotalCost DESC
          LIMIT 20
        `),
        
        executeQuery<{ ServiceCategory: string; TotalCost: number }>(`
          SELECT 
            COALESCE(ServiceCategory, 'Other') AS ServiceCategory,
            CAST(SUM(BilledCost) AS DOUBLE) AS TotalCost
          FROM ${UNIFIED_VIEW_NAME}
          WHERE ChargePeriodStart >= epoch_ms(${startMs})
            AND ChargePeriodEnd < epoch_ms(${endMs})
          GROUP BY ServiceCategory
          ORDER BY TotalCost DESC
        `),
      ]);
      
      const summary = summaryResult[0] || { TotalBilled: 0, TotalEffective: 0, TotalList: 0 };
      const prevSummary = prevSummaryResult[0] || { TotalBilled: 0 };
      
      const totalCost = summary.TotalBilled || 0;
      const previousCost = prevSummary.TotalBilled || 0;
      const percentChange = previousCost > 0 ? ((totalCost - previousCost) / previousCost) * 100 : 0;
      
      // Calculate forecast (simple linear projection)
      const daysInPeriod = (endMs - startMs) / (1000 * 60 * 60 * 24);
      const today = new Date();
      const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      const dayOfMonth = today.getDate();
      const dailyAverage = totalCost / daysInPeriod;
      const projectedMonthEnd = dailyAverage * daysInMonth;
      
      // Calculate top growing services
      const prevServiceMap = new Map(prevServicesResult.map(s => [s.ServiceName, s.TotalCost]));
      const topGrowing = servicesResult
        .map(s => ({
          name: s.ServiceName,
          currentCost: s.TotalCost,
          previousCost: prevServiceMap.get(s.ServiceName) || 0,
          change: s.TotalCost - (prevServiceMap.get(s.ServiceName) || 0),
          changePercent: prevServiceMap.get(s.ServiceName) 
            ? ((s.TotalCost - prevServiceMap.get(s.ServiceName)!) / prevServiceMap.get(s.ServiceName)!) * 100 
            : 100,
        }))
        .sort((a, b) => b.change - a.change)
        .slice(0, 5);
      
      setData({
        totalCost,
        previousPeriodCost: previousCost,
        percentChange,
        effectiveCost: summary.TotalEffective || 0,
        savings: (summary.TotalList || 0) - (summary.TotalEffective || 0),
        projectedMonthEnd,
        dailyTrend: trendResult.map(r => ({
          date: r.Day?.split('-').slice(1).join('/') || '',
          billedCost: r.BilledCost || 0,
          effectiveCost: r.EffectiveCost || 0,
        })),
        topServices: servicesResult.map(s => ({
          name: s.ServiceName || 'Unknown',
          value: s.TotalCost || 0,
        })),
        topGrowingServices: topGrowing,
        costByCategory: categoryResult.map(c => ({
          name: c.ServiceCategory || 'Other',
          value: c.TotalCost || 0,
        })),
      });
      
    } catch (err) {
      console.error('Executive dashboard error:', err);
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
              title="Total Cloud Spend"
              value={data.totalCost}
              currency={effectiveCurrency}
              changePercent={data.percentChange}
              icon={<DollarSign className="h-4 w-4" />}
            />
            <KPICard
              title="Period Change"
              value={data.totalCost - data.previousPeriodCost}
              currency={effectiveCurrency}
              icon={data.percentChange >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              footer={`${data.percentChange >= 0 ? '+' : ''}${data.percentChange.toFixed(1)}% vs previous`}
            />
            <KPICard
              title="Cost Savings"
              value={data.savings}
              currency={effectiveCurrency}
              icon={<Target className="h-4 w-4" />}
              inverseTrend
              footer={`${((data.savings / (data.effectiveCost + data.savings)) * 100).toFixed(1)}% discount rate`}
            />
            <KPICard
              title="Projected Month-End"
              value={data.projectedMonthEnd}
              currency={effectiveCurrency}
              icon={<Zap className="h-4 w-4" />}
              footer="Based on current trend"
            />
          </div>

          {/* Trend Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Daily Cost Trend
              </CardTitle>
              <CardDescription>Billed cost over the selected period</CardDescription>
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
            {/* Top Services */}
            <Card>
              <CardHeader>
                <CardTitle>Top Services by Cost</CardTitle>
                <CardDescription>Largest cost contributors</CardDescription>
              </CardHeader>
              <CardContent>
                <CostBreakdownChart 
                  data={data.topServices.slice(0, 8)} 
                  height={300}
                  currency={effectiveCurrency}
                />
              </CardContent>
            </Card>

            {/* Cost by Category */}
            <Card>
              <CardHeader>
                <CardTitle>Cost by Category</CardTitle>
                <CardDescription>Service category distribution</CardDescription>
              </CardHeader>
              <CardContent>
                <CostBreakdownChart 
                  data={data.costByCategory.slice(0, 8)} 
                  height={300}
                  currency={effectiveCurrency}
                  donut={false}
                />
              </CardContent>
            </Card>
          </div>

          {/* Top Growing Services */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Top Growing Services
              </CardTitle>
              <CardDescription>Services with the highest cost increase vs previous period</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.topGrowingServices.map((service, index) => (
                  <div
                    key={service.name}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-muted-foreground w-6">
                        #{index + 1}
                      </span>
                      <div>
                        <p className="font-medium">{service.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatCurrency(service.previousCost, effectiveCurrency, { compact: true })} → {formatCurrency(service.currentCost, effectiveCurrency, { compact: true })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge 
                        variant={service.change >= 0 ? 'destructive' : 'default'}
                        className={service.change >= 0 ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}
                      >
                        {service.change >= 0 ? '+' : ''}{service.changePercent.toFixed(1)}%
                      </Badge>
                      <p className="text-sm text-muted-foreground mt-1">
                        {service.change >= 0 ? '+' : ''}{formatCurrency(service.change, effectiveCurrency, { compact: true })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
