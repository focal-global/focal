/**
 * Waste Hunter Module
 * 
 * Exports for the waste detection system
 */

export { WasteHunterDashboard } from './dashboard';
export {
  WasteHunterEngine,
  getCategoryLabel,
  getCategoryIcon,
  getSeverityColor,
  type WasteOpportunity,
  type WasteSummary,
  type WasteCategory,
  type WasteSeverity,
  type WasteRecommendation,
} from './engine';
