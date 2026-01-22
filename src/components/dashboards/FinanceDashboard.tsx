'use client';

/**
 * Finance Dashboard
 * 
 * Budget tracking, cost allocation, and financial reporting.
 * Focuses on:
 * - Budget vs actual spending
 * - Cost allocation by tags/accounts
 * - Tag coverage and compliance
 * - Chargeback reporting
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { 
  RefreshCw, 
  Loader2,
  DollarSign,
  PieChart,
  Tag,
  Building2,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { useSpectrum, UNIFIED_VIEW_NAME } from '@/components/providers/spectrum-provider';
import { KPICard, CostBreakdownChart, BudgetGauge } from '@/components/charts';
import { formatCurrency } from '@/lib/currency';
import { NoDataState } from '@/components/ui/empty-state';
import type { CostBreakdownData } from '@/components/charts/CostBreakdownChart';

// ============================================================================
// Types
// ============================================================================

interface FinanceDashboardData {
  totalBilledCost: number;
  totalEffectiveCost: number;
  totalSavings: number;
  costByAccount: CostBreakdownData[];
  costByChargeType: CostBreakdownData[];
  tagCoverage: {
    taggedCost: number;
    untaggedCost: number;
    taggedPercent: number;
  };
  costByTag: Array<{
    tagValue: string;
    cost: number;
    percent: number;
  }>;
  accountDetails: Array<{
    account: string;
    billedCost: number;
    effectiveCost: number;
    savings: number;
    resourceCount: number;
  }>;
}

interface FinanceDashboardProps {
  /** Monthly budget amount */
  monthlyBudget?: number;
}

// ============================================================================
// Component
// ============================================================================

export function FinanceDashboard({ monthlyBudget = 50000 }: FinanceDashboardProps) {
  const { isReady, query: executeQuery, unifiedView, isLoadingSources } = useSpectrum();
  
  const [dateRange, setDateRange] = useState(() => {
    const end = new Date();
    const start = new Date(end.getFullYear(), end.getMonth(), 1);
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    };
  });
  
  const [budget, setBudget] = useState(monthlyBudget);
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<FinanceDashboardData | null>(null);
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
      
      const [
        summaryResult,
        accountResult,
        chargeTypeResult,
        tagCoverageResult,
        costCenterResult,
        accountDetailsResult,
      ] = await Promise.all([
        // Summary
        executeQuery<{ TotalBilled: number; TotalEffective: number; TotalList: number }>(`
          SELECT 
            CAST(SUM(BilledCost) AS DOUBLE) AS TotalBilled,
            CAST(SUM(EffectiveCost) AS DOUBLE) AS TotalEffective,
            CAST(SUM(ListCost) AS DOUBLE) AS TotalList
          FROM ${UNIFIED_VIEW_NAME}
          WHERE ChargePeriodStart >= epoch_ms(${startMs})
            AND ChargePeriodEnd < epoch_ms(${endMs})
        `),
        
        // Cost by account/subscription
        executeQuery<{ SubAccountName: string; TotalCost: number }>(`
          SELECT 
            COALESCE(SubAccountName, 'Unknown') AS SubAccountName,
            CAST(SUM(BilledCost) AS DOUBLE) AS TotalCost
          FROM ${UNIFIED_VIEW_NAME}
          WHERE ChargePeriodStart >= epoch_ms(${startMs})
            AND ChargePeriodEnd < epoch_ms(${endMs})
          GROUP BY SubAccountName
          ORDER BY TotalCost DESC
          LIMIT 10
        `),
        
        // Cost by charge type
        executeQuery<{ ChargeType: string; TotalCost: number }>(`
          SELECT 
            COALESCE(ChargeCategory, ChargeType, 'Other') AS ChargeType,
            CAST(SUM(BilledCost) AS DOUBLE) AS TotalCost
          FROM ${UNIFIED_VIEW_NAME}
          WHERE ChargePeriodStart >= epoch_ms(${startMs})
            AND ChargePeriodEnd < epoch_ms(${endMs})
          GROUP BY ChargeType
          ORDER BY TotalCost DESC
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
          WHERE ChargePeriodStart >= epoch_ms(${startMs})
            AND ChargePeriodEnd < epoch_ms(${endMs})
          GROUP BY TagStatus
        `),
        
        // Cost by cost center tag (if available)
        executeQuery<{ CostCenter: string; TotalCost: number }>(`
          SELECT 
            COALESCE(
              json_extract_string(Tags, '$.CostCenter'),
              json_extract_string(Tags, '$.costcenter'),
              json_extract_string(Tags, '$.cost-center'),
              'Unallocated'
            ) AS CostCenter,
            CAST(SUM(BilledCost) AS DOUBLE) AS TotalCost
          FROM ${UNIFIED_VIEW_NAME}
          WHERE ChargePeriodStart >= epoch_ms(${startMs})
            AND ChargePeriodEnd < epoch_ms(${endMs})
          GROUP BY CostCenter
          ORDER BY TotalCost DESC
          LIMIT 10
        `),
        
        // Account details
        executeQuery<{ 
          SubAccountName: string; 
          TotalBilled: number; 
          TotalEffective: number;
          TotalList: number;
          ResourceCount: number;
        }>(`
          SELECT 
            COALESCE(SubAccountName, 'Unknown') AS SubAccountName,
            CAST(SUM(BilledCost) AS DOUBLE) AS TotalBilled,
            CAST(SUM(EffectiveCost) AS DOUBLE) AS TotalEffective,
            CAST(SUM(ListCost) AS DOUBLE) AS TotalList,
            COUNT(DISTINCT ResourceId) AS ResourceCount
          FROM ${UNIFIED_VIEW_NAME}
          WHERE ChargePeriodStart >= epoch_ms(${startMs})
            AND ChargePeriodEnd < epoch_ms(${endMs})
          GROUP BY SubAccountName
          ORDER BY TotalBilled DESC
          LIMIT 15
        `),
      ]);
      
      const summary = summaryResult[0] || { TotalBilled: 0, TotalEffective: 0, TotalList: 0 };
      
      const taggedCost = tagCoverageResult.find(r => r.TagStatus === 'Tagged')?.TotalCost || 0;
      const untaggedCost = tagCoverageResult.find(r => r.TagStatus === 'Untagged')?.TotalCost || 0;
      const totalTagCost = taggedCost + untaggedCost;
      
      const totalCostCenters = costCenterResult.reduce((sum, r) => sum + r.TotalCost, 0);
      
      setData({
        totalBilledCost: summary.TotalBilled || 0,
        totalEffectiveCost: summary.TotalEffective || 0,
        totalSavings: (summary.TotalList || 0) - (summary.TotalEffective || 0),
        costByAccount: accountResult.map(r => ({
          name: r.SubAccountName || 'Unknown',
          value: r.TotalCost || 0,
        })),
        costByChargeType: chargeTypeResult.map(r => ({
          name: r.ChargeType || 'Other',
          value: r.TotalCost || 0,
        })),
        tagCoverage: {
          taggedCost,
          untaggedCost,
          taggedPercent: totalTagCost > 0 ? (taggedCost / totalTagCost) * 100 : 0,
        },
        costByTag: costCenterResult.map(r => ({
          tagValue: r.CostCenter || 'Unallocated',
          cost: r.TotalCost || 0,
          percent: totalCostCenters > 0 ? ((r.TotalCost || 0) / totalCostCenters) * 100 : 0,
        })),
        accountDetails: accountDetailsResult.map(r => ({
          account: r.SubAccountName || 'Unknown',
          billedCost: r.TotalBilled || 0,
          effectiveCost: r.TotalEffective || 0,
          savings: (r.TotalList || 0) - (r.TotalEffective || 0),
          resourceCount: Number(r.ResourceCount) || 0,
        })),
      });
      
    } catch (err) {
      console.error('Finance dashboard error:', err);
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

  const budgetUsedPercent = data ? (data.totalBilledCost / budget) * 100 : 0;
  const budgetRemaining = data ? budget - data.totalBilledCost : budget;

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
          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground">Budget</Label>
            <Input
              type="number"
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
              className="w-32"
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
              title="Total Billed Cost"
              value={data.totalBilledCost}
              currency={effectiveCurrency}
              icon={<DollarSign className="h-4 w-4" />}
              footer={`${budgetUsedPercent.toFixed(1)}% of budget`}
            />
            <KPICard
              title="Budget Remaining"
              value={budgetRemaining}
              currency={effectiveCurrency}
              icon={<PieChart className="h-4 w-4" />}
              inverseTrend={budgetRemaining > 0}
            />
            <KPICard
              title="Effective Cost"
              value={data.totalEffectiveCost}
              currency={effectiveCurrency}
              icon={<DollarSign className="h-4 w-4" />}
            />
            <KPICard
              title="Total Savings"
              value={data.totalSavings}
              currency={effectiveCurrency}
              icon={<CheckCircle className="h-4 w-4" />}
              inverseTrend
              footer="Commitments & discounts"
            />
          </div>

          {/* Budget Gauge and Tag Coverage */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Budget Gauge */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5" />
                  Budget Status
                </CardTitle>
                <CardDescription>Monthly budget consumption</CardDescription>
              </CardHeader>
              <CardContent>
                <BudgetGauge
                  value={data.totalBilledCost}
                  max={budget}
                  currency={effectiveCurrency}
                  label="Monthly Budget"
                />
              </CardContent>
            </Card>

            {/* Tag Coverage */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Tag className="h-5 w-5" />
                  Tag Coverage
                </CardTitle>
                <CardDescription>Cost allocation compliance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Tagged Resources</span>
                  <Badge variant={data.tagCoverage.taggedPercent >= 80 ? 'default' : 'destructive'}>
                    {data.tagCoverage.taggedPercent.toFixed(1)}%
                  </Badge>
                </div>
                <Progress value={data.tagCoverage.taggedPercent} className="h-3" />
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm font-medium">Tagged</span>
                    </div>
                    <p className="text-lg font-bold">
                      {formatCurrency(data.tagCoverage.taggedCost, effectiveCurrency, { compact: true })}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                    <div className="flex items-center gap-2 mb-1">
                      <XCircle className="h-4 w-4 text-red-500" />
                      <span className="text-sm font-medium">Untagged</span>
                    </div>
                    <p className="text-lg font-bold">
                      {formatCurrency(data.tagCoverage.untaggedCost, effectiveCurrency, { compact: true })}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Cost Allocation */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* By Account */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Cost by Account
                </CardTitle>
                <CardDescription>Subscription/account breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                <CostBreakdownChart 
                  data={data.costByAccount} 
                  height={300}
                  currency={effectiveCurrency}
                />
              </CardContent>
            </Card>

            {/* By Cost Center */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Tag className="h-5 w-5" />
                  Cost by Cost Center
                </CardTitle>
                <CardDescription>Allocation by CostCenter tag</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.costByTag.map((item) => (
                    <div key={item.tagValue} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium truncate max-w-[200px]">{item.tagValue}</span>
                        <span className="text-muted-foreground">
                          {formatCurrency(item.cost, effectiveCurrency, { compact: true })}
                        </span>
                      </div>
                      <Progress value={item.percent} className="h-2" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charge Types */}
          <Card>
            <CardHeader>
              <CardTitle>Cost by Charge Type</CardTitle>
              <CardDescription>Breakdown by charge category</CardDescription>
            </CardHeader>
            <CardContent>
              <CostBreakdownChart 
                data={data.costByChargeType} 
                height={250}
                currency={effectiveCurrency}
                donut={false}
              />
            </CardContent>
          </Card>

          {/* Account Details Table */}
          <Card>
            <CardHeader>
              <CardTitle>Account Cost Details</CardTitle>
              <CardDescription>Detailed breakdown by account/subscription</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium">Account</th>
                      <th className="text-right py-3 px-4 font-medium">Billed Cost</th>
                      <th className="text-right py-3 px-4 font-medium">Effective Cost</th>
                      <th className="text-right py-3 px-4 font-medium">Savings</th>
                      <th className="text-right py-3 px-4 font-medium">Resources</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.accountDetails.map((account) => (
                      <tr key={account.account} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="py-3 px-4 font-medium">{account.account}</td>
                        <td className="py-3 px-4 text-right font-mono">
                          {formatCurrency(account.billedCost, effectiveCurrency)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                          {formatCurrency(account.effectiveCost, effectiveCurrency)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-green-500">
                          {formatCurrency(account.savings, effectiveCurrency)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {account.resourceCount.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/50 font-medium">
                      <td className="py-3 px-4">Total</td>
                      <td className="py-3 px-4 text-right font-mono">
                        {formatCurrency(data.totalBilledCost, effectiveCurrency)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono">
                        {formatCurrency(data.totalEffectiveCost, effectiveCurrency)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-green-500">
                        {formatCurrency(data.totalSavings, effectiveCurrency)}
                      </td>
                      <td className="py-3 px-4 text-right">-</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
