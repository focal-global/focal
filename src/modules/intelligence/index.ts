/**
 * Intelligence Module Exports
 * 
 * The Intelligence module provides advanced analytics and insights:
 * - Unit Economics analysis
 * - Kubernetes cost allocation (future)
 * - GreenOps carbon footprint (future)
 * - Forecasting and predictions (future)
 */

export { UnitEconomicsService } from './unit-economics/service';
export { UnitEconomicsDashboard } from './unit-economics/dashboard';
export type { 
  UnitEconomicsMetrics, 
  UnitEconomicsBreakdown, 
  UnitEconomicsTrend, 
  UnitDefinition 
} from './unit-economics/service';