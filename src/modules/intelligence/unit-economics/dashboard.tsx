/**
 * Unit Economics Dashboard Component
 * 
 * Provides comprehensive unit economics analysis including:
 * - Cost per unit metrics across different unit types
 * - Trend analysis and efficiency tracking
 * - Cost breakdown by category
 * - Actionable insights and recommendations
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  Calculator,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Zap,
  Database,
  Bot,
  Calendar,
  Info,
  Target,
  BarChart3
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useEnrichedSpectrum } from '@/components/providers';
import { useDataDetection } from '@/hooks/use-data-detection';
import { EmptyState } from '@/components/ui/empty-state';
import { useRouter } from 'next/navigation';
import { formatCurrency } from '@/lib/currency';
import { UnitEconomicsService, type UnitEconomicsMetrics, type UnitDefinition } from './service';

// ============================================================================
// Types
// ============================================================================

interface DateRange {
  start: Date;
  end: Date;
  label: string;
}

// ============================================================================
// Component
// ============================================================================

export function UnitEconomicsDashboard() {
  const { spectrum, queryEnriched } = useEnrichedSpectrum();
  const { hasData, isChecking, rowCount } = useDataDetection();
  const router = useRouter();
  const [service] = useState(() => new UnitEconomicsService());
  
  const [selectedUnit, setSelectedUnit] = useState<string>('customers');
  const [selectedDateRange, setSelectedDateRange] = useState<DateRange>({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    end: new Date(),
    label: 'Last 30 days'
  });
  
  const [metrics, setMetrics] = useState<UnitEconomicsMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Available date ranges
  const dateRanges: DateRange[] = [
    {
      start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      end: new Date(),
      label: 'Last 7 days'
    },
    {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end: new Date(),
      label: 'Last 30 days'
    },
    {
      start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      end: new Date(),
      label: 'Last 90 days'
    }
  ];

  // Available unit definitions
  const availableUnits = useMemo(() => service.getAvailableUnits(), [service]);

  // Unit type icons
  const unitIcons = {
    customer: Users,
    request: Zap,
    'gb-hour': Database,
    transaction: DollarSign,
    'user-session': Users,
    custom: Calculator
  };

  /**
   * Load unit economics data
   */
  const loadUnitEconomics = async () => {
    if (!spectrum.isReady || !spectrum.unifiedView?.exists) {
      return;
    }

    const unitDefinition = availableUnits.find(u => u.id === selectedUnit);
    if (!unitDefinition) return;

    setIsLoading(true);
    setError(null);

    try {
      // For demo purposes, we'll create mock enriched data
      // In production, this would use actual enriched billing data
      const mockEnrichedData = {
        rows: [
          {
            ResourceId: 'resource-1',
            ServiceName: 'API Gateway',
            ServiceCategory: 'Compute',
            BilledCost: 1000,
            UsageQuantity: 5000,
            ChargePeriodStart: selectedDateRange.start.toISOString(),
            ChargePeriodEnd: selectedDateRange.end.toISOString()
          },
          {
            ResourceId: 'resource-2',
            ServiceName: 'Lambda Functions',
            ServiceCategory: 'Compute',
            BilledCost: 500,
            UsageQuantity: 2500,
            ChargePeriodStart: selectedDateRange.start.toISOString(),
            ChargePeriodEnd: selectedDateRange.end.toISOString()
          }
        ],
        source: {
          provider: 'aws' as const,
          format: 'focus' as const,
          uploadedAt: new Date(),
          fileName: 'demo-data'
        },
        schema: {
          columns: ['ResourceId', 'ServiceName', 'ServiceCategory', 'BilledCost', 'UsageQuantity'],
          rowCount: 2,
          estimatedSize: 1000
        }
      };

      const calculatedMetrics = await service.calculateUnitEconomics(
        mockEnrichedData,
        unitDefinition,
        selectedDateRange.start,
        selectedDateRange.end,
        queryEnriched
      );

      setMetrics(calculatedMetrics);

    } catch (err) {
      console.error('[UnitEconomics] Error loading metrics:', err);
      setError(err instanceof Error ? err.message : 'Failed to load unit economics data');
    } finally {
      setIsLoading(false);
    }
  };

  // Load data when dependencies change
  useEffect(() => {
    loadUnitEconomics();
  }, [selectedUnit, selectedDateRange, spectrum.isReady]);

  // Loading state
  if (!spectrum.isReady || isChecking) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-4">
          <div className="animate-spin h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="text-muted-foreground">
            {!spectrum.isReady ? 'Loading unit economics...' : 'Checking for data...'}
          </p>
        </div>
      </div>
    );
  }

  // No data state with overlay effect
  if (!hasData) {
    return (
      <EmptyState
        icon={Calculator}
        title="No billing data available"
        description={`Upload billing data to view unit economics analysis. ${rowCount === 0 ? 'No records found.' : ''}`}
        action={{
          label: 'Go to Data Sources',
          href: '/dashboard/sources'
        }}
        skeletonType="analytics"
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Unit Economics</h1>
          <p className="text-muted-foreground">
            Analyze cost efficiency across different business units
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Select value={selectedUnit} onValueChange={setSelectedUnit}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableUnits.map(unit => {
                const Icon = unitIcons[unit.type] || Calculator;
                return (
                  <SelectItem key={unit.id} value={unit.id}>
                    <div className="flex items-center space-x-2">
                      <Icon className="h-4 w-4" />
                      <span>{unit.name}</span>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>

          <Select 
            value={selectedDateRange.label} 
            onValueChange={(label) => {
              const range = dateRanges.find(r => r.label === label);
              if (range) setSelectedDateRange(range);
            }}
          >
            <SelectTrigger className="w-40">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {dateRanges.map(range => (
                <SelectItem key={range.label} value={range.label}>
                  {range.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2 text-destructive">
              <Info className="h-4 w-4" />
              <span>Error: {error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Key Metrics */}
      {metrics && (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Cost per Unit</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(metrics.costPerUnit, spectrum.unifiedView?.detectedCurrency || 'USD')}
                </div>
                <p className="text-xs text-muted-foreground">
                  per {metrics.unitName.toLowerCase()}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Units</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics.totalUnits.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  {metrics.unitName}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(metrics.totalCost, spectrum.unifiedView?.detectedCurrency || 'USD')}
                </div>
                <p className="text-xs text-muted-foreground">
                  {selectedDateRange.label}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Efficiency Trend</CardTitle>
                {metrics.trends.length > 1 && metrics.trends[metrics.trends.length - 1].efficiency > 0 ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics.trends.length > 1 ? (
                    <span className={
                      metrics.trends[metrics.trends.length - 1].efficiency > 0 
                        ? 'text-green-500' 
                        : 'text-red-500'
                    }>
                      {(metrics.trends[metrics.trends.length - 1].efficiency * 100).toFixed(1)}%
                    </span>
                  ) : (
                    'N/A'
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  cost efficiency change
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Cost Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Cost Breakdown</CardTitle>
              <CardDescription>
                How costs are distributed across service categories
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {metrics.breakdown.map(item => (
                  <div key={item.category} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Badge variant="outline">{item.category}</Badge>
                      <span className="text-sm text-muted-foreground">
                        {formatCurrency(item.costPerUnit, spectrum.unifiedView?.detectedCurrency || 'USD')} per unit
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">
                        {formatCurrency(item.cost, spectrum.unifiedView?.detectedCurrency || 'USD')}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        ({item.percentage.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Insights & Recommendations */}
          <Card>
            <CardHeader>
              <CardTitle>Insights & Recommendations</CardTitle>
              <CardDescription>
                AI-powered suggestions to optimize your unit economics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {metrics.costPerUnit > 10 && (
                  <div className="flex items-start space-x-3 p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg">
                    <Info className="h-4 w-4 text-orange-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">High cost per unit detected</p>
                      <p className="text-sm text-muted-foreground">
                        Consider implementing cost optimization strategies or reviewing resource allocation.
                      </p>
                    </div>
                  </div>
                )}

                {metrics.trends.length > 1 && metrics.trends[metrics.trends.length - 1].efficiency < -0.1 && (
                  <div className="flex items-start space-x-3 p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
                    <TrendingDown className="h-4 w-4 text-red-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Efficiency declining</p>
                      <p className="text-sm text-muted-foreground">
                        Unit costs are increasing. Review recent changes or consider scaling optimizations.
                      </p>
                    </div>
                  </div>
                )}

                {metrics.breakdown.length > 0 && metrics.breakdown[0].percentage > 50 && (
                  <div className="flex items-start space-x-3 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                    <Target className="h-4 w-4 text-blue-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Cost concentration opportunity</p>
                      <p className="text-sm text-muted-foreground">
                        {metrics.breakdown[0].category} represents {metrics.breakdown[0].percentage.toFixed(1)}% of costs. 
                        Focus optimization efforts here for maximum impact.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Loading State */}
      {isLoading && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center space-x-2">
              <div className="animate-spin h-4 w-4 border-b-2 border-primary" />
              <span>Calculating unit economics...</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}