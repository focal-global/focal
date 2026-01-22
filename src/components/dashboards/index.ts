/**
 * Dashboard Components
 * 
 * Pre-built dashboard layouts for FinOps analysis.
 * Each dashboard combines charts, KPIs, and data tables
 * to provide a complete view of a specific domain.
 * 
 * Available Dashboards:
 * - CostOverviewDashboard: General purpose cost visibility
 * - ExecutiveDashboard: High-level KPIs for leadership
 * - FinanceDashboard: Budget tracking and allocations
 * - EngineeringDashboard: Resource optimization for DevOps
 */

// Dashboard Components
export { CostOverviewDashboard } from './CostOverviewDashboard';
export { ExecutiveDashboard } from './ExecutiveDashboard';
export { FinanceDashboard } from './FinanceDashboard';
export { EngineeringDashboard } from './EngineeringDashboard';

// Dashboard Selector
export { DashboardSelector, PersonaCard, PersonaSelectionGrid } from './DashboardSelector';

// Types
export type { 
  DashboardPersona, 
  PersonaConfig, 
  WidgetType, 
  WidgetConfig, 
  DashboardConfig,
  DashboardState,
} from './types';
export { PERSONA_CONFIGS } from './types';

// Templates
export { 
  DASHBOARD_TEMPLATES, 
  getDefaultDashboardForPersona,
  executiveDashboardTemplate,
  financeDashboardTemplate,
  engineeringDashboardTemplate,
  overviewDashboardTemplate,
} from './templates';
