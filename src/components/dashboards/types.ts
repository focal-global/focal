/**
 * Dashboard System Types
 * 
 * Defines the core types for the dashboard system including:
 * - Widget configurations
 * - Dashboard templates
 * - Persona definitions
 */

// ============================================================================
// Dashboard Personas
// ============================================================================

export type DashboardPersona = 
  | 'executive'     // C-suite, VP level - high-level KPIs and trends
  | 'finance'       // CFO, accounting - budgets, allocations, chargebacks
  | 'engineering'   // DevOps, Platform teams - optimization, utilization
  | 'overview'      // General purpose overview (current default)
  | 'custom';       // User-created custom dashboard

export interface PersonaConfig {
  id: DashboardPersona;
  name: string;
  description: string;
  icon: string;
  defaultWidgets: WidgetConfig[];
  color: string;
}

// ============================================================================
// Widget Types
// ============================================================================

export type WidgetType = 
  | 'kpi'           // Single KPI metric with trend
  | 'trend-chart'   // Line chart showing cost over time
  | 'breakdown'     // Bar chart breakdown by dimension
  | 'treemap'       // Treemap visualization
  | 'table'         // Data table
  | 'gauge'         // Budget gauge
  | 'sparkline'     // Mini sparkline chart
  | 'comparison'    // Period comparison
  | 'forecast'      // Forecast/projection chart
  | 'anomaly'       // Anomaly detection highlights
  | 'allocation'    // Cost allocation breakdown
  | 'top-n'         // Top N resources/services
  | 'tag-coverage'  // Tag coverage metrics
  | 'savings'       // Savings opportunities;

export type WidgetSize = 'small' | 'medium' | 'large' | 'full';

export interface WidgetPosition {
  x: number;  // Grid column (0-based)
  y: number;  // Grid row (0-based)
  w: number;  // Width in grid units
  h: number;  // Height in grid units
}

export interface WidgetConfig {
  id: string;
  type: WidgetType;
  title: string;
  description?: string;
  size: WidgetSize;
  position?: WidgetPosition;
  
  // Widget-specific configuration
  config: WidgetSpecificConfig;
}

// ============================================================================
// Widget-Specific Configurations
// ============================================================================

export interface KPIWidgetConfig {
  metric: 'total-cost' | 'effective-cost' | 'savings' | 'budget-remaining' | 'cost-change' | 'forecast';
  showTrend: boolean;
  showSparkline?: boolean;
  comparisonPeriod?: 'previous' | 'same-last-month' | 'same-last-year';
}

export interface TrendChartConfig {
  metrics: Array<'billed' | 'effective' | 'list' | 'budget' | 'forecast'>;
  granularity: 'daily' | 'weekly' | 'monthly';
  showArea?: boolean;
  showComparison?: boolean;
}

export interface BreakdownConfig {
  dimension: 'service' | 'region' | 'account' | 'category' | 'provider' | 'charge-type' | 'tag';
  tagKey?: string;  // If dimension is 'tag'
  limit: number;
  showOther?: boolean;
  chartType: 'bar' | 'pie' | 'donut';
}

export interface TreemapConfig {
  groupBy: 'category' | 'service' | 'account' | 'provider';
  colorBy?: 'cost' | 'change' | 'utilization';
}

export interface TableConfig {
  columns: string[];
  groupBy?: string[];
  orderBy: string;
  limit: number;
  showTotals?: boolean;
}

export interface GaugeConfig {
  budgetType: 'monthly' | 'quarterly' | 'annual' | 'custom';
  budgetAmount?: number;
  showForecast?: boolean;
  warningThreshold: number;  // Percentage
  criticalThreshold: number; // Percentage
}

export interface ComparisonConfig {
  metric: 'cost' | 'savings' | 'count';
  compareWith: 'previous-period' | 'same-last-month' | 'same-last-year';
  breakdown?: 'service' | 'region' | 'account';
}

export interface ForecastConfig {
  horizon: 7 | 14 | 30 | 90;  // Days
  method: 'linear' | 'seasonal' | 'average';
  showConfidenceInterval?: boolean;
}

export interface TopNConfig {
  dimension: 'resources' | 'services' | 'accounts' | 'subscriptions';
  metric: 'cost' | 'growth' | 'savings-opportunity';
  limit: number;
  showChange?: boolean;
}

export interface TagCoverageConfig {
  showByDimension?: 'service' | 'account' | 'region';
  requiredTags?: string[];
}

export interface SavingsConfig {
  categories: Array<'commitments' | 'rightsizing' | 'unused' | 'scheduling'>;
  showPotential?: boolean;
}

export interface AllocationConfig {
  allocateBy: 'tag' | 'account' | 'cost-center';
  tagKey?: string;
  showUnallocated?: boolean;
}

export interface AnomalyConfig {
  sensitivity: 'low' | 'medium' | 'high';
  metric: 'cost' | 'usage';
  timeWindow: 7 | 14 | 30;
}

export type WidgetSpecificConfig = 
  | { type: 'kpi'; kpi: KPIWidgetConfig }
  | { type: 'trend-chart'; trendChart: TrendChartConfig }
  | { type: 'breakdown'; breakdown: BreakdownConfig }
  | { type: 'treemap'; treemap: TreemapConfig }
  | { type: 'table'; table: TableConfig }
  | { type: 'gauge'; gauge: GaugeConfig }
  | { type: 'comparison'; comparison: ComparisonConfig }
  | { type: 'forecast'; forecast: ForecastConfig }
  | { type: 'top-n'; topN: TopNConfig }
  | { type: 'tag-coverage'; tagCoverage: TagCoverageConfig }
  | { type: 'savings'; savings: SavingsConfig }
  | { type: 'allocation'; allocation: AllocationConfig }
  | { type: 'anomaly'; anomaly: AnomalyConfig };

// ============================================================================
// Dashboard Configuration
// ============================================================================

export interface DashboardConfig {
  id: string;
  name: string;
  description?: string;
  persona: DashboardPersona;
  widgets: WidgetConfig[];
  
  // Global filters for the dashboard
  defaultFilters?: {
    dateRange?: { start: string; end: string };
    accounts?: string[];
    services?: string[];
    regions?: string[];
    tags?: Record<string, string>;
  };
  
  // Layout settings
  columns: number;  // Grid columns (e.g., 12)
  
  // Metadata
  createdAt?: Date;
  updatedAt?: Date;
  createdBy?: string;
  isDefault?: boolean;
  isShared?: boolean;
}

// ============================================================================
// Dashboard State
// ============================================================================

export interface DashboardState {
  activeDashboard: DashboardConfig | null;
  availableDashboards: DashboardConfig[];
  isLoading: boolean;
  error: string | null;
  
  // Active filters (may override dashboard defaults)
  filters: {
    dateRange: { start: string; end: string };
    accounts: string[];
    services: string[];
    regions: string[];
    tags: Record<string, string>;
  };
  
  // Widget data cache
  widgetData: Record<string, unknown>;
  widgetLoading: Record<string, boolean>;
  widgetErrors: Record<string, string>;
}

// ============================================================================
// Pre-defined Persona Configurations
// ============================================================================

export const PERSONA_CONFIGS: Record<DashboardPersona, PersonaConfig> = {
  executive: {
    id: 'executive',
    name: 'Executive Summary',
    description: 'High-level KPIs, trends, and business insights for leadership',
    icon: 'briefcase',
    color: 'from-purple-500 to-indigo-600',
    defaultWidgets: [], // Will be defined separately
  },
  finance: {
    id: 'finance',
    name: 'Finance & Accounting',
    description: 'Budget tracking, cost allocation, and chargeback reports',
    icon: 'calculator',
    color: 'from-emerald-500 to-teal-600',
    defaultWidgets: [],
  },
  engineering: {
    id: 'engineering',
    name: 'Engineering & DevOps',
    description: 'Resource optimization, utilization, and rightsizing insights',
    icon: 'wrench',
    color: 'from-orange-500 to-red-600',
    defaultWidgets: [],
  },
  overview: {
    id: 'overview',
    name: 'Cost Overview',
    description: 'General cloud cost visibility and analytics',
    icon: 'layout-dashboard',
    color: 'from-blue-500 to-cyan-600',
    defaultWidgets: [],
  },
  custom: {
    id: 'custom',
    name: 'Custom Dashboard',
    description: 'Create your own dashboard with custom widgets',
    icon: 'settings',
    color: 'from-gray-500 to-slate-600',
    defaultWidgets: [],
  },
};
