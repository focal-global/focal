/**
 * Focal Chart Components
 * 
 * Reusable visualization components for FinOps dashboards.
 * Built with Recharts and React Flow for visualization.
 * 
 * All charts are:
 * - Dark mode compatible
 * - Responsive by default
 * - Currency-aware for cost values
 * - Accessible with proper ARIA labels
 */

export { CostTrendChart } from './CostTrendChart';
export { CostBreakdownChart } from './CostBreakdownChart';
export { CostTreemap } from './CostTreemap';
export { SparklineChart } from './SparklineChart';
export { BudgetGauge } from './BudgetGauge';
export { KPICard } from './KPICard';
export { CostTopologyGraph, transformToTopologyNodes, type CostNode, type CostTopologyProps } from './CostTopologyGraph';
export { 
  DrillDownPanel, 
  useDrillDown,
  COST_DRILLDOWN_HIERARCHY,
  REGION_DRILLDOWN_HIERARCHY,
  type DrillDownLevel,
  type DrillDownPath,
  type DrillDownConfig,
  type DrillDownPanelProps,
} from './DrillDownPanel';

// Chart types for consistent typing
export type { CostTrendData } from './CostTrendChart';
export type { CostBreakdownData } from './CostBreakdownChart';
export type { TreemapData } from './CostTreemap';
export type { SparklineData } from './SparklineChart';
