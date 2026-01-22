'use client';

/**
 * Cost Treemap
 * 
 * Hierarchical visualization for cost breakdown.
 * Shows proportional sizes for cost categories.
 * 
 * Use cases:
 * - Service category hierarchy
 * - Resource cost distribution
 * - Sub-account breakdown
 */

import { useMemo } from 'react';
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';
import { formatCurrency, SUPPORTED_CURRENCIES } from '@/lib/currency';

// ============================================================================
// Types
// ============================================================================

export interface TreemapData {
  name: string;
  value?: number;
  children?: TreemapData[];
  color?: string;
  [key: string]: unknown;
}

interface CostTreemapProps {
  /** Chart data (hierarchical) */
  data: TreemapData[];
  /** Currency code for formatting (default: USD) */
  currency?: string;
  /** Chart height in pixels (default: 400) */
  height?: number;
  /** Chart title */
  title?: string;
  /** Color scheme */
  colors?: string[];
  /** Aspect ratio (default: calculated from container) */
  aspectRatio?: number;
}

// ============================================================================
// Color Palette
// ============================================================================

const DEFAULT_COLORS = [
  '#3b82f6', // Blue
  '#10b981', // Green
  '#f59e0b', // Amber
  '#8b5cf6', // Purple
  '#ef4444', // Red
  '#06b6d4', // Cyan
  '#ec4899', // Pink
  '#f97316', // Orange
];

// ============================================================================
// Custom Content Component
// ============================================================================

interface CustomContentProps {
  root?: TreemapData;
  depth?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  index?: number;
  name?: string;
  value?: number;
  colors: string[];
  currency: string;
}

const TreemapContent = ({
  depth = 0,
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  index = 0,
  name,
  value,
  colors,
  currency,
}: CustomContentProps) => {
  const isSmall = width < 80 || height < 40;
  const isTiny = width < 50 || height < 30;
  
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{
          fill: depth === 1 ? colors[index % colors.length] : 'transparent',
          stroke: 'hsl(var(--background))',
          strokeWidth: 2,
          strokeOpacity: depth === 1 ? 1 : 0,
        }}
      />
      {depth === 1 && !isTiny && (
        <>
          <text
            x={x + width / 2}
            y={y + height / 2 - (isSmall ? 0 : 8)}
            textAnchor="middle"
            fill="white"
            fontSize={isSmall ? 10 : 12}
            fontWeight={500}
            className="pointer-events-none"
          >
            {isSmall ? (name?.slice(0, 8) || '') : name}
          </text>
          {!isSmall && value !== undefined && (
            <text
              x={x + width / 2}
              y={y + height / 2 + 10}
              textAnchor="middle"
              fill="white"
              fontSize={10}
              opacity={0.9}
              className="pointer-events-none"
            >
              {formatCurrency(value, currency, { compact: true })}
            </text>
          )}
        </>
      )}
    </g>
  );
};

// ============================================================================
// Component
// ============================================================================

export function CostTreemap({
  data,
  currency = 'USD',
  height = 400,
  title,
  colors = DEFAULT_COLORS,
}: CostTreemapProps) {
  // Wrap data in root node for Recharts
  const treemapData = useMemo(() => {
    return [
      {
        name: 'root',
        children: data,
      },
    ];
  }, [data]);

  // Calculate total for tooltip
  const total = useMemo(() => {
    return data.reduce((sum, item) => sum + (item.value || 0), 0);
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[400px] text-muted-foreground">
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
        <Treemap
          data={treemapData}
          dataKey="value"
          stroke="hsl(var(--background))"
          fill="hsl(var(--muted))"
          content={<TreemapContent colors={colors} currency={currency} />}
        >
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              fontSize: '12px',
            }}
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const item = payload[0].payload as TreemapData;
              if (!item.value) return null;
              const percentage = ((item.value / total) * 100).toFixed(1);
              return (
                <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
                  <p className="font-medium text-foreground">{item.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatCurrency(item.value, currency, { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-xs text-muted-foreground">{percentage}% of total</p>
                </div>
              );
            }}
          />
        </Treemap>
      </ResponsiveContainer>
    </div>
  );
}
