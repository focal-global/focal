'use client';

/**
 * Sparkline Chart
 * 
 * Mini inline chart for showing trends in compact spaces.
 * Used in KPI cards and table cells.
 * 
 * Use cases:
 * - Trend indicators in KPI cards
 * - Inline cost trends in tables
 * - Mini comparison charts
 */

import { useMemo } from 'react';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';

// ============================================================================
// Types
// ============================================================================

export interface SparklineData {
  value: number;
}

interface SparklineChartProps {
  /** Data points */
  data: SparklineData[] | number[];
  /** Chart width (default: 100) */
  width?: number;
  /** Chart height (default: 32) */
  height?: number;
  /** Line color (default: based on trend) */
  color?: string;
  /** Show trend color (green for up, red for down) */
  trendColor?: boolean;
  /** Stroke width (default: 1.5) */
  strokeWidth?: number;
}

// ============================================================================
// Component
// ============================================================================

export function SparklineChart({
  data,
  width = 100,
  height = 32,
  color,
  trendColor = true,
  strokeWidth = 1.5,
}: SparklineChartProps) {
  // Normalize data format
  const chartData = useMemo(() => {
    if (data.length === 0) return [];
    
    // If data is array of numbers, convert to objects
    if (typeof data[0] === 'number') {
      return (data as number[]).map((value) => ({ value }));
    }
    return data as SparklineData[];
  }, [data]);

  // Calculate trend direction
  const trend = useMemo(() => {
    if (chartData.length < 2) return 'neutral';
    const first = chartData[0].value;
    const last = chartData[chartData.length - 1].value;
    if (last > first) return 'up';
    if (last < first) return 'down';
    return 'neutral';
  }, [chartData]);

  // Determine line color
  const lineColor = useMemo(() => {
    if (color) return color;
    if (!trendColor) return '#3b82f6'; // Default blue
    
    switch (trend) {
      case 'up':
        return '#ef4444'; // Red for cost increase
      case 'down':
        return '#10b981'; // Green for cost decrease
      default:
        return '#6b7280'; // Gray for neutral
    }
  }, [color, trendColor, trend]);

  // Calculate Y domain for better visualization
  const yDomain = useMemo(() => {
    if (chartData.length === 0) return [0, 100];
    const values = chartData.map((d) => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = (max - min) * 0.1 || 1;
    return [min - padding, max + padding];
  }, [chartData]);

  if (chartData.length === 0) {
    return <div style={{ width, height }} className="bg-muted/50 rounded" />;
  }

  return (
    <ResponsiveContainer width={width} height={height}>
      <LineChart data={chartData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        <YAxis domain={yDomain} hide />
        <Line
          type="monotone"
          dataKey="value"
          stroke={lineColor}
          strokeWidth={strokeWidth}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
