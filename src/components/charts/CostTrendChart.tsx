'use client';

/**
 * Cost Trend Chart
 * 
 * Time series visualization for cost trends over time.
 * Supports multiple cost types (Billed, Effective, List) with area/line display.
 * 
 * Use cases:
 * - Daily/Weekly/Monthly cost trends
 * - Month-over-month comparisons
 * - Anomaly detection visualization
 */

import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { formatCurrency, SUPPORTED_CURRENCIES } from '@/lib/currency';

// ============================================================================
// Types
// ============================================================================

export interface CostTrendData {
  /** Date label (e.g., "2026-01-15" or "Jan 15") */
  date: string;
  /** Billed cost for this period */
  billedCost?: number;
  /** Effective cost for this period */
  effectiveCost?: number;
  /** List cost for this period */
  listCost?: number;
  /** Optional forecast values */
  forecast?: number;
  /** Optional budget line */
  budget?: number;
  /** Any additional metrics */
  [key: string]: string | number | undefined;
}

interface CostTrendChartProps {
  /** Chart data */
  data: CostTrendData[];
  /** Which cost types to display */
  costTypes?: ('billedCost' | 'effectiveCost' | 'listCost' | 'forecast' | 'budget')[];
  /** Currency code for formatting (default: USD) */
  currency?: string;
  /** Chart height in pixels (default: 300) */
  height?: number;
  /** Show legend (default: true) */
  showLegend?: boolean;
  /** Show grid (default: true) */
  showGrid?: boolean;
  /** Area fill opacity (default: 0.3) */
  fillOpacity?: number;
  /** Chart title */
  title?: string;
}

// ============================================================================
// Color Palette (Dark Mode Optimized)
// ============================================================================

const CHART_COLORS = {
  billedCost: { stroke: '#3b82f6', fill: '#3b82f6' },      // Blue
  effectiveCost: { stroke: '#10b981', fill: '#10b981' },   // Green
  listCost: { stroke: '#f59e0b', fill: '#f59e0b' },        // Amber
  forecast: { stroke: '#8b5cf6', fill: '#8b5cf6' },        // Purple
  budget: { stroke: '#ef4444', fill: '#ef4444' },          // Red
};

const COST_TYPE_LABELS: Record<string, string> = {
  billedCost: 'Billed Cost',
  effectiveCost: 'Effective Cost',
  listCost: 'List Cost',
  forecast: 'Forecast',
  budget: 'Budget',
};

// ============================================================================
// Component
// ============================================================================

export function CostTrendChart({
  data,
  costTypes = ['billedCost'],
  currency = 'USD',
  height = 300,
  showLegend = true,
  showGrid = true,
  fillOpacity = 0.3,
  title,
}: CostTrendChartProps) {
  const currencyInfo = SUPPORTED_CURRENCIES[currency];

  // Custom tooltip formatter
  const formatTooltipValue = (value: number) => {
    return formatCurrency(value, currency, { maximumFractionDigits: 0 });
  };

  // Y-axis tick formatter
  const formatYAxis = (value: number) => {
    if (value >= 1000000) return `${currencyInfo?.symbol || currency}${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${currencyInfo?.symbol || currency}${(value / 1000).toFixed(0)}K`;
    return `${currencyInfo?.symbol || currency}${value}`;
  };

  // Calculate domain for better visualization
  const yDomain = useMemo(() => {
    const allValues = data.flatMap((d) =>
      costTypes.map((type) => d[type] as number).filter(Boolean)
    );
    if (allValues.length === 0) return [0, 100];
    const max = Math.max(...allValues);
    return [0, Math.ceil(max * 1.1)]; // Add 10% padding
  }, [data, costTypes]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        No data available
      </div>
    );
  }

  return (
    <div className="w-full">
      {title && (
        <h3 className="text-sm font-medium text-muted-foreground mb-2">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          {showGrid && (
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
          )}
          <XAxis
            dataKey="date"
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatYAxis}
            domain={yDomain}
            width={80}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              fontSize: '12px',
            }}
            labelStyle={{ color: 'hsl(var(--foreground))' }}
            formatter={(value, name) => [
              formatTooltipValue(value as number),
              COST_TYPE_LABELS[name as string] || name,
            ]}
          />
          {showLegend && (
            <Legend
              wrapperStyle={{ fontSize: '12px' }}
              formatter={(value) => COST_TYPE_LABELS[value] || value}
            />
          )}
          {costTypes.map((costType) => (
            <Area
              key={costType}
              type="monotone"
              dataKey={costType}
              stroke={CHART_COLORS[costType]?.stroke || '#888'}
              fill={CHART_COLORS[costType]?.fill || '#888'}
              fillOpacity={fillOpacity}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2 }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
