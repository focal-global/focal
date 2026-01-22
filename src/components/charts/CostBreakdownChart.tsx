'use client';

/**
 * Cost Breakdown Chart
 * 
 * Pie/Donut chart for cost allocation visualization.
 * Shows proportional breakdown of costs by category.
 * 
 * Use cases:
 * - Service cost breakdown
 * - Regional cost distribution
 * - Tag-based allocation
 * - Pricing category mix
 */

import { useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import { formatCurrency, SUPPORTED_CURRENCIES } from '@/lib/currency';

// ============================================================================
// Types
// ============================================================================

export interface CostBreakdownData {
  /** Category name */
  name: string;
  /** Cost value */
  value: number;
  /** Optional color override */
  color?: string;
  /** Optional percentage (calculated if not provided) */
  percentage?: number;
}

interface CostBreakdownChartProps {
  /** Chart data */
  data: CostBreakdownData[];
  /** Currency code for formatting (default: USD) */
  currency?: string;
  /** Chart height in pixels (default: 300) */
  height?: number;
  /** Show as donut chart (default: true) */
  donut?: boolean;
  /** Inner radius for donut (default: 60) */
  innerRadius?: number;
  /** Outer radius (default: 80) */
  outerRadius?: number;
  /** Show legend (default: true) */
  showLegend?: boolean;
  /** Show labels on chart (default: false) */
  showLabels?: boolean;
  /** Chart title */
  title?: string;
  /** Max items to show (others grouped as "Other") */
  maxItems?: number;
}

// ============================================================================
// Color Palette (Dark Mode Optimized)
// ============================================================================

const CHART_COLORS = [
  '#3b82f6', // Blue
  '#10b981', // Green
  '#f59e0b', // Amber
  '#8b5cf6', // Purple
  '#ef4444', // Red
  '#06b6d4', // Cyan
  '#ec4899', // Pink
  '#f97316', // Orange
  '#14b8a6', // Teal
  '#6366f1', // Indigo
  '#84cc16', // Lime
  '#a855f7', // Violet
];

// ============================================================================
// Component
// ============================================================================

export function CostBreakdownChart({
  data,
  currency = 'USD',
  height = 300,
  donut = true,
  innerRadius = 60,
  outerRadius = 100,
  showLegend = true,
  showLabels = false,
  title,
  maxItems = 10,
}: CostBreakdownChartProps) {
  const currencyInfo = SUPPORTED_CURRENCIES[currency];

  // Process data: calculate percentages and group small items
  const processedData = useMemo(() => {
    if (data.length === 0) return [];

    const total = data.reduce((sum, item) => sum + item.value, 0);
    if (total === 0) return [];

    // Sort by value descending
    const sorted = [...data]
      .map((item) => ({
        ...item,
        percentage: (item.value / total) * 100,
      }))
      .sort((a, b) => b.value - a.value);

    // Group items beyond maxItems as "Other"
    if (sorted.length > maxItems) {
      const top = sorted.slice(0, maxItems - 1);
      const others = sorted.slice(maxItems - 1);
      const otherValue = others.reduce((sum, item) => sum + item.value, 0);
      const otherPercentage = others.reduce((sum, item) => sum + (item.percentage || 0), 0);

      return [
        ...top,
        {
          name: 'Other',
          value: otherValue,
          percentage: otherPercentage,
        },
      ];
    }

    return sorted;
  }, [data, maxItems]);

  // Assign colors
  const dataWithColors = useMemo(() => {
    return processedData.map((item, index) => ({
      ...item,
      color: item.color || CHART_COLORS[index % CHART_COLORS.length],
    }));
  }, [processedData]);

  if (processedData.length === 0) {
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
        <PieChart>
          <Pie
            data={dataWithColors}
            cx="50%"
            cy="50%"
            innerRadius={donut ? innerRadius : 0}
            outerRadius={outerRadius}
            dataKey="value"
            paddingAngle={2}
            label={showLabels}
            labelLine={showLabels}
          >
            {dataWithColors.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              fontSize: '12px',
            }}
            formatter={(value) => [
              formatCurrency(value as number, currency, { maximumFractionDigits: 0 }),
              'Cost',
            ]}
          />
          {showLegend && (
            <Legend
              layout="vertical"
              align="right"
              verticalAlign="middle"
              wrapperStyle={{ fontSize: '12px' }}
              formatter={(value: string) => {
                const item = dataWithColors.find((d) => d.name === value);
                return (
                  <span className="text-foreground">
                    {value}{' '}
                    <span className="text-muted-foreground">
                      ({item?.percentage?.toFixed(1)}%)
                    </span>
                  </span>
                );
              }}
            />
          )}
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
