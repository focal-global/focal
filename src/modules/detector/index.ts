/**
 * Detector Module Exports
 * 
 * The Detector module provides optimization and anomaly detection:
 * - AI-powered anomaly detection
 * - Waterline savings simulation (future)
 * - Rightsizing recommendations (future)
 * - Cost optimization suggestions (future)
 */

export { AnomalyDetectionEngine } from './anomaly-detection/engine';
export { AnomalyDetectionDashboard } from './anomaly-detection/dashboard';
export type { 
  AnomalyResult, 
  AnomalyDetectionConfig, 
  TimeSeriesData,
  AnomalyMethod,
  AnomalyType 
} from './anomaly-detection/engine';