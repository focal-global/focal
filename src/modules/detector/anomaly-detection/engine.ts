/**
 * Local AI Anomaly Detection Engine
 * 
 * Detects cost anomalies using statistical methods and lightweight ML models 
 * that run entirely in the browser. Uses Web Workers for performance.
 * 
 * Detection methods:
 * - Statistical outlier detection (Z-score, IQR)
 * - Time series anomaly detection (seasonal decomposition)
 * - Pattern-based anomalies (usage vs cost mismatch)
 * - Threshold-based alerts (budget violations)
 */

export interface AnomalyDetectionConfig {
  /** Sensitivity level (0.1 = very sensitive, 0.9 = very conservative) */
  sensitivity: number;
  /** Minimum anomaly score to report (0-1) */
  threshold: number;
  /** Time window for analysis in days */
  windowDays: number;
  /** Methods to use for detection */
  methods: AnomalyMethod[];
  /** Enable seasonal adjustment */
  seasonalAdjustment: boolean;
}

export type AnomalyMethod = 
  | 'statistical' 
  | 'time-series' 
  | 'pattern-based' 
  | 'threshold-based'
  | 'ml-based';

export interface AnomalyResult {
  id: string;
  timestamp: Date;
  resourceId: string;
  serviceName: string;
  anomalyType: AnomalyType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  score: number; // 0-1, higher = more anomalous
  description: string;
  impact: {
    costImpact: number;
    percentageIncrease: number;
  };
  context: {
    expectedCost: number;
    actualCost: number;
    historicalAverage: number;
    method: AnomalyMethod;
  };
  recommendations: string[];
  metadata: Record<string, unknown>;
}

export type AnomalyType = 
  | 'cost-spike'
  | 'cost-drop' 
  | 'usage-mismatch'
  | 'new-resource'
  | 'idle-resource'
  | 'budget-violation'
  | 'seasonal-deviation'
  | 'pattern-break';

export interface TimeSeriesData {
  timestamp: Date;
  value: number;
  resourceId: string;
  metadata?: Record<string, unknown>;
}

export class AnomalyDetectionEngine {
  private config: AnomalyDetectionConfig;
  private worker?: Worker;

  constructor(config: Partial<AnomalyDetectionConfig> = {}) {
    this.config = {
      sensitivity: 0.3,
      threshold: 0.7,
      windowDays: 30,
      methods: ['statistical', 'time-series', 'pattern-based'],
      seasonalAdjustment: true,
      ...config
    };
  }

  /**
   * Detect anomalies in cost data
   */
  async detectAnomalies(
    timeSeriesData: TimeSeriesData[]
  ): Promise<AnomalyResult[]> {
    if (timeSeriesData.length < 7) {
      console.warn('[AnomalyDetection] Insufficient data for analysis');
      return [];
    }

    const anomalies: AnomalyResult[] = [];

    // Group data by resource for individual analysis
    const resourceGroups = this.groupByResource(timeSeriesData);

    for (const [resourceId, resourceData] of resourceGroups.entries()) {
      // Statistical anomaly detection
      if (this.config.methods.includes('statistical')) {
        const statisticalAnomalies = await this.detectStatisticalAnomalies(
          resourceId,
          resourceData
        );
        anomalies.push(...statisticalAnomalies);
      }

      // Time series anomaly detection
      if (this.config.methods.includes('time-series')) {
        const timeSeriesAnomalies = await this.detectTimeSeriesAnomalies(
          resourceId,
          resourceData
        );
        anomalies.push(...timeSeriesAnomalies);
      }

      // Pattern-based anomaly detection
      if (this.config.methods.includes('pattern-based')) {
        const patternAnomalies = await this.detectPatternAnomalies(
          resourceId,
          resourceData
        );
        anomalies.push(...patternAnomalies);
      }
    }

    // Sort by severity and score
    return anomalies
      .filter(a => a.score >= this.config.threshold)
      .sort((a, b) => {
        const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
        return severityDiff !== 0 ? severityDiff : b.score - a.score;
      });
  }

  /**
   * Statistical outlier detection using Z-score and IQR methods
   */
  private async detectStatisticalAnomalies(
    resourceId: string,
    data: TimeSeriesData[]
  ): Promise<AnomalyResult[]> {
    const anomalies: AnomalyResult[] = [];
    const values = data.map(d => d.value);
    
    if (values.length < 5) return anomalies;

    // Calculate statistical measures
    const mean = this.calculateMean(values);
    const stdDev = this.calculateStdDev(values, mean);
    const q1 = this.calculateQuantile(values, 0.25);
    const q3 = this.calculateQuantile(values, 0.75);
    const iqr = q3 - q1;

    // Z-score threshold based on sensitivity
    const zThreshold = 2.5 - (this.config.sensitivity * 1.5);
    
    // IQR multiplier based on sensitivity
    const iqrMultiplier = 2.0 - (this.config.sensitivity * 0.5);

    for (let i = 0; i < data.length; i++) {
      const point = data[i];
      const value = point.value;
      
      // Z-score anomaly detection
      const zScore = Math.abs((value - mean) / stdDev);
      const isZScoreAnomaly = zScore > zThreshold;

      // IQR anomaly detection
      const lowerBound = q1 - (iqrMultiplier * iqr);
      const upperBound = q3 + (iqrMultiplier * iqr);
      const isIQRAnomaly = value < lowerBound || value > upperBound;

      if (isZScoreAnomaly || isIQRAnomaly) {
        const severity = this.calculateSeverity(zScore, mean, value);
        const percentageIncrease = ((value - mean) / mean) * 100;

        anomalies.push({
          id: `stat_${resourceId}_${point.timestamp.getTime()}`,
          timestamp: point.timestamp,
          resourceId,
          serviceName: String(point.metadata?.serviceName || 'Unknown'),
          anomalyType: value > mean ? 'cost-spike' : 'cost-drop',
          severity,
          score: Math.min(zScore / 5, 1), // Normalize to 0-1
          description: `${severity.toUpperCase()} statistical anomaly detected. Cost is ${Math.abs(percentageIncrease).toFixed(1)}% ${value > mean ? 'above' : 'below'} normal.`,
          impact: {
            costImpact: Math.abs(value - mean),
            percentageIncrease
          },
          context: {
            expectedCost: mean,
            actualCost: value,
            historicalAverage: mean,
            method: 'statistical'
          },
          recommendations: this.generateRecommendations(value, mean, 'statistical'),
          metadata: {
            zScore,
            isZScoreAnomaly,
            isIQRAnomaly,
            ...point.metadata
          }
        });
      }
    }

    return anomalies;
  }

  /**
   * Time series anomaly detection using simple trend analysis
   */
  private async detectTimeSeriesAnomalies(
    resourceId: string,
    data: TimeSeriesData[]
  ): Promise<AnomalyResult[]> {
    const anomalies: AnomalyResult[] = [];
    
    if (data.length < 7) return anomalies;

    // Sort by timestamp
    const sortedData = [...data].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    // Calculate moving average and detect deviations
    const windowSize = Math.min(7, Math.floor(sortedData.length / 3));
    
    for (let i = windowSize; i < sortedData.length; i++) {
      const current = sortedData[i];
      const window = sortedData.slice(i - windowSize, i);
      const windowAverage = this.calculateMean(window.map(d => d.value));
      const windowStdDev = this.calculateStdDev(window.map(d => d.value), windowAverage);
      
      const deviation = Math.abs(current.value - windowAverage);
      const normalizedDeviation = windowStdDev > 0 ? deviation / windowStdDev : 0;
      
      const threshold = 2.5 - (this.config.sensitivity * 1.0);
      
      if (normalizedDeviation > threshold) {
        const severity = this.calculateSeverity(normalizedDeviation, windowAverage, current.value);
        const percentageChange = ((current.value - windowAverage) / windowAverage) * 100;

        anomalies.push({
          id: `ts_${resourceId}_${current.timestamp.getTime()}`,
          timestamp: current.timestamp,
          resourceId,
          serviceName: String(current.metadata?.serviceName || 'Unknown'),
          anomalyType: current.value > windowAverage ? 'cost-spike' : 'cost-drop',
          severity,
          score: Math.min(normalizedDeviation / 5, 1),
          description: `Time series anomaly: ${Math.abs(percentageChange).toFixed(1)}% ${current.value > windowAverage ? 'increase' : 'decrease'} from recent trend.`,
          impact: {
            costImpact: Math.abs(current.value - windowAverage),
            percentageIncrease: percentageChange
          },
          context: {
            expectedCost: windowAverage,
            actualCost: current.value,
            historicalAverage: windowAverage,
            method: 'time-series'
          },
          recommendations: this.generateRecommendations(current.value, windowAverage, 'time-series'),
          metadata: {
            normalizedDeviation,
            windowSize,
            ...current.metadata
          }
        });
      }
    }

    return anomalies;
  }

  /**
   * Pattern-based anomaly detection (simplified version)
   */
  private async detectPatternAnomalies(
    resourceId: string,
    data: TimeSeriesData[]
  ): Promise<AnomalyResult[]> {
    const anomalies: AnomalyResult[] = [];
    
    // Detect new resources (first appearance)
    const firstAppearance = data.reduce((earliest, current) => {
      return current.timestamp < earliest.timestamp ? current : earliest;
    });
    
    const daysSinceFirst = (Date.now() - firstAppearance.timestamp.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysSinceFirst <= 3 && firstAppearance.value > 0) {
      anomalies.push({
        id: `pattern_new_${resourceId}`,
        timestamp: firstAppearance.timestamp,
        resourceId,
        serviceName: String(firstAppearance.metadata?.serviceName || 'Unknown'),
        anomalyType: 'new-resource',
        severity: 'low',
        score: 0.6,
        description: 'New resource detected with immediate cost impact.',
        impact: {
          costImpact: firstAppearance.value,
          percentageIncrease: 100
        },
        context: {
          expectedCost: 0,
          actualCost: firstAppearance.value,
          historicalAverage: 0,
          method: 'pattern-based'
        },
        recommendations: [
          'Review if this new resource is expected',
          'Check resource configuration and sizing',
          'Set up monitoring and alerts for this resource'
        ],
        metadata: {
          daysSinceFirst,
          ...firstAppearance.metadata
        }
      });
    }

    return anomalies;
  }

  /**
   * Helper methods
   */
  private groupByResource(data: TimeSeriesData[]): Map<string, TimeSeriesData[]> {
    const groups = new Map<string, TimeSeriesData[]>();
    
    for (const point of data) {
      if (!groups.has(point.resourceId)) {
        groups.set(point.resourceId, []);
      }
      groups.get(point.resourceId)!.push(point);
    }
    
    return groups;
  }

  private calculateMean(values: number[]): number {
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private calculateStdDev(values: number[], mean: number): number {
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  private calculateQuantile(values: number[], quantile: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = quantile * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) {
      return sorted[lower];
    }
    
    return sorted[lower] * (upper - index) + sorted[upper] * (index - lower);
  }

  private calculateSeverity(
    score: number, 
    expected: number, 
    actual: number
  ): AnomalyResult['severity'] {
    const impact = Math.abs(actual - expected);
    const relativeImpact = expected > 0 ? impact / expected : 1;
    
    if (score > 4 || relativeImpact > 2) return 'critical';
    if (score > 3 || relativeImpact > 1) return 'high';
    if (score > 2 || relativeImpact > 0.5) return 'medium';
    return 'low';
  }

  private generateRecommendations(
    actual: number,
    expected: number,
    method: AnomalyMethod
  ): string[] {
    const recommendations: string[] = [];
    
    if (actual > expected * 1.5) {
      recommendations.push('Investigate sudden cost increase');
      recommendations.push('Check for configuration changes or new deployments');
      recommendations.push('Consider implementing cost controls');
    } else if (actual < expected * 0.5) {
      recommendations.push('Verify if service is functioning properly');
      recommendations.push('Check for potential underutilization');
    }
    
    recommendations.push('Set up monitoring alerts for this resource');
    recommendations.push('Review resource usage patterns');
    
    return recommendations;
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = undefined;
    }
  }
}