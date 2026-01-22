'use client';

/**
 * Budget Gauge
 * 
 * Progress/gauge visualization for budget tracking.
 * Shows current spend vs budget with thresholds.
 * 
 * Use cases:
 * - Budget utilization
 * - Commitment coverage
 * - Savings targets
 */

import { useMemo } from 'react';
import { formatCurrency } from '@/lib/currency';

// ============================================================================
// Types
// ============================================================================

interface BudgetGaugeProps {
  /** Current value */
  value: number;
  /** Maximum/budget value */
  max: number;
  /** Currency code (default: USD) */
  currency?: string;
  /** Label for the gauge */
  label?: string;
  /** Warning threshold percentage (default: 80) */
  warningThreshold?: number;
  /** Danger threshold percentage (default: 100) */
  dangerThreshold?: number;
  /** Show percentage (default: true) */
  showPercentage?: boolean;
  /** Show values (default: true) */
  showValues?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Inverse colors (green when high) */
  inverse?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function BudgetGauge({
  value,
  max,
  currency = 'USD',
  label,
  warningThreshold = 80,
  dangerThreshold = 100,
  showPercentage = true,
  showValues = true,
  size = 'md',
  inverse = false,
}: BudgetGaugeProps) {
  // Calculate percentage
  const percentage = useMemo(() => {
    if (max === 0) return 0;
    return Math.min((value / max) * 100, 100);
  }, [value, max]);

  // Determine color based on thresholds
  const statusColor = useMemo(() => {
    if (inverse) {
      if (percentage >= dangerThreshold) return 'bg-green-500';
      if (percentage >= warningThreshold) return 'bg-amber-500';
      return 'bg-red-500';
    }
    
    if (percentage >= dangerThreshold) return 'bg-red-500';
    if (percentage >= warningThreshold) return 'bg-amber-500';
    return 'bg-green-500';
  }, [percentage, warningThreshold, dangerThreshold, inverse]);

  // Size classes
  const sizeClasses = {
    sm: { height: 'h-2', text: 'text-xs', valueText: 'text-sm' },
    md: { height: 'h-3', text: 'text-sm', valueText: 'text-base' },
    lg: { height: 'h-4', text: 'text-base', valueText: 'text-lg' },
  };

  const classes = sizeClasses[size];

  return (
    <div className="w-full space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        {label && (
          <span className={`font-medium text-foreground ${classes.text}`}>
            {label}
          </span>
        )}
        {showPercentage && (
          <span className={`font-mono ${classes.text} ${
            percentage >= dangerThreshold 
              ? (inverse ? 'text-green-500' : 'text-red-500')
              : percentage >= warningThreshold
              ? 'text-amber-500'
              : (inverse ? 'text-red-500' : 'text-green-500')
          }`}>
            {percentage.toFixed(1)}%
          </span>
        )}
      </div>

      {/* Progress Bar */}
      <div className={`w-full bg-muted rounded-full overflow-hidden ${classes.height}`}>
        <div
          className={`${classes.height} ${statusColor} transition-all duration-500 ease-out rounded-full`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Values */}
      {showValues && (
        <div className="flex items-center justify-between">
          <span className={`text-muted-foreground ${classes.text}`}>
            {formatCurrency(value, currency, { compact: true })}
          </span>
          <span className={`text-muted-foreground ${classes.text}`}>
            / {formatCurrency(max, currency, { compact: true })}
          </span>
        </div>
      )}
    </div>
  );
}
