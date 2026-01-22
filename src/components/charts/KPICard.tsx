'use client';

/**
 * KPI Card
 * 
 * Key Performance Indicator display card.
 * Shows a metric value with optional trend and comparison.
 * 
 * Use cases:
 * - Total cost display
 * - Savings summary
 * - Budget status
 * - Period comparisons
 */

import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency, SUPPORTED_CURRENCIES } from '@/lib/currency';
import { SparklineChart } from './SparklineChart';

// ============================================================================
// Types
// ============================================================================

interface KPICardProps {
  /** KPI title */
  title: string;
  /** Main value */
  value: number;
  /** Currency code (default: USD) */
  currency?: string;
  /** Previous period value for comparison */
  previousValue?: number;
  /** Change percentage (calculated from previousValue if not provided) */
  changePercent?: number;
  /** Sparkline data for trend visualization */
  sparklineData?: number[];
  /** Icon or emoji */
  icon?: React.ReactNode;
  /** Footer text/description */
  footer?: string;
  /** Loading state */
  loading?: boolean;
  /** Inverse trend colors (decrease is good) */
  inverseTrend?: boolean;
  /** Compact display mode */
  compact?: boolean;
  /** Click handler */
  onClick?: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function KPICard({
  title,
  value,
  currency = 'USD',
  previousValue,
  changePercent,
  sparklineData,
  icon,
  footer,
  loading = false,
  inverseTrend = false,
  compact = false,
  onClick,
}: KPICardProps) {
  // Calculate change percentage if not provided
  const calculatedChange = useMemo(() => {
    if (changePercent !== undefined) return changePercent;
    if (previousValue === undefined || previousValue === 0) return undefined;
    return ((value - previousValue) / previousValue) * 100;
  }, [value, previousValue, changePercent]);

  // Determine trend direction and color
  const trend = useMemo(() => {
    if (calculatedChange === undefined) return null;
    
    const isPositive = calculatedChange > 0;
    const isNegative = calculatedChange < 0;
    
    // For costs: increase is bad, decrease is good
    // With inverseTrend: increase is good (e.g., savings)
    const isGood = inverseTrend ? isPositive : isNegative;
    const isBad = inverseTrend ? isNegative : isPositive;
    
    return {
      direction: isPositive ? 'up' : isNegative ? 'down' : 'neutral',
      color: isGood ? 'text-green-500' : isBad ? 'text-red-500' : 'text-muted-foreground',
      bgColor: isGood ? 'bg-green-500/10' : isBad ? 'bg-red-500/10' : 'bg-muted',
      Icon: isPositive ? TrendingUp : isNegative ? TrendingDown : Minus,
    };
  }, [calculatedChange, inverseTrend]);

  const currencyInfo = SUPPORTED_CURRENCIES[currency];

  if (loading) {
    return (
      <Card className={onClick ? 'cursor-pointer hover:bg-muted/50 transition-colors' : ''}>
        <CardContent className={compact ? 'p-4' : 'p-6'}>
          <div className="animate-pulse space-y-3">
            <div className="h-4 w-24 bg-muted rounded" />
            <div className="h-8 w-32 bg-muted rounded" />
            <div className="h-4 w-20 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card 
      className={onClick ? 'cursor-pointer hover:bg-muted/50 transition-colors' : ''}
      onClick={onClick}
    >
      <CardContent className={compact ? 'p-4' : 'p-6'}>
        <div className="space-y-2">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {icon && <span className="text-xl">{icon}</span>}
              <span className="text-sm font-medium text-muted-foreground">
                {title}
              </span>
            </div>
            {sparklineData && sparklineData.length > 0 && (
              <SparklineChart 
                data={sparklineData} 
                width={60} 
                height={24}
                trendColor={!inverseTrend}
              />
            )}
          </div>

          {/* Main Value */}
          <div className="flex items-baseline gap-2">
            <span className={`font-bold tracking-tight ${compact ? 'text-2xl' : 'text-3xl'}`}>
              {formatCurrency(value, currency, { 
                maximumFractionDigits: value >= 1000 ? 0 : 2,
                compact: value >= 1000000,
              })}
            </span>
          </div>

          {/* Change Indicator */}
          {trend && calculatedChange !== undefined && (
            <div className="flex items-center gap-2">
              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${trend.bgColor} ${trend.color}`}>
                <trend.Icon className="h-3 w-3" />
                <span>{Math.abs(calculatedChange).toFixed(1)}%</span>
              </div>
              {previousValue !== undefined && (
                <span className="text-xs text-muted-foreground">
                  vs {formatCurrency(previousValue, currency, { compact: true })}
                </span>
              )}
            </div>
          )}

          {/* Footer */}
          {footer && (
            <p className="text-xs text-muted-foreground pt-1">{footer}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
