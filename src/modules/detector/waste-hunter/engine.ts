/**
 * Waste Hunter Engine
 * 
 * Local-First waste detection engine that analyzes cloud billing data
 * to identify unused, underutilized, and orphaned resources.
 * 
 * Detection Categories:
 * 1. Idle Resources - Resources with zero or minimal usage
 * 2. Underutilized Resources - Resources using < threshold of capacity
 * 3. Orphaned Resources - Resources not attached to active workloads
 * 4. Oversized Resources - Resources larger than needed
 * 5. Zombie Resources - Resources from deleted projects/apps
 * 6. Untagged Resources - Resources missing cost allocation tags
 */

// ============================================================================
// Types
// ============================================================================

export type WasteCategory = 
  | 'idle'
  | 'underutilized'
  | 'orphaned'
  | 'oversized'
  | 'zombie'
  | 'untagged'
  | 'stale-snapshot'
  | 'unused-storage'
  | 'detached-disk'
  | 'idle-database'
  | 'unused-ip'
  | 'old-generation';

export type WasteSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface WasteOpportunity {
  id: string;
  category: WasteCategory;
  severity: WasteSeverity;
  resourceId: string;
  resourceName: string;
  resourceType: string;
  serviceName: string;
  serviceCategory: string;
  region: string;
  
  // Cost metrics
  currentCost: number;
  potentialSavings: number;
  savingsPercent: number;
  currency: string;
  
  // Historical cost data for trend visualization
  dailyCosts: { date: string; cost: number }[];
  
  // Detection details
  detectionMethod: string;
  confidence: number; // 0-100
  reason: string;
  evidence: WasteEvidence[];
  
  // Recommendations
  recommendations: WasteRecommendation[];
  
  // Metadata
  detectedAt: Date;
  lastActive?: Date;
  daysSinceActivity?: number;
  tags: Record<string, string>;
}

export interface WasteEvidence {
  metric: string;
  value: number;
  threshold: number;
  unit: string;
  period: string;
}

export interface WasteRecommendation {
  action: 'delete' | 'resize' | 'stop' | 'archive' | 'tag' | 'review' | 'migrate';
  title: string;
  description: string;
  estimatedSavings: number;
  effort: 'low' | 'medium' | 'high';
  risk: 'low' | 'medium' | 'high';
  automatable: boolean;
}

export interface WasteAnalysisConfig {
  // Thresholds
  idleThresholdDays: number;
  utilizationThreshold: number; // Percentage (e.g., 10 = 10%)
  minCostThreshold: number; // Minimum cost to consider (filters noise)
  
  // Categories to analyze
  categories: WasteCategory[];
  
  // Date range
  analysisWindowDays: number;
}

export interface WasteSummary {
  totalOpportunities: number;
  totalPotentialSavings: number;
  byCategory: Record<WasteCategory, { count: number; savings: number }>;
  bySeverity: Record<WasteSeverity, { count: number; savings: number }>;
  byService: { name: string; count: number; savings: number }[];
  topOpportunities: WasteOpportunity[];
  analysisDate: Date;
  dataRange: { start: Date; end: Date };
}

// ============================================================================
// Detection Rules Configuration
// ============================================================================

interface DetectionRule {
  category: WasteCategory;
  name: string;
  description: string;
  servicePatterns: string[];
  resourceTypePatterns: string[];
  detect: (data: ResourceAnalysis) => WasteDetectionResult | null;
}

interface ResourceAnalysis {
  resourceId: string;
  resourceName: string;
  resourceType: string;
  serviceName: string;
  serviceCategory: string;
  region: string;
  totalCost: number;
  dailyCosts: { date: string; cost: number }[];
  avgDailyCost: number;
  usageQuantity: number;
  pricingUnit: string;
  tags: Record<string, string>;
  chargeCategory: string;
  currency: string;
}

interface WasteDetectionResult {
  severity: WasteSeverity;
  confidence: number;
  reason: string;
  potentialSavings: number;
  evidence: WasteEvidence[];
  recommendations: WasteRecommendation[];
}

// ============================================================================
// Waste Hunter Engine
// ============================================================================

const DEFAULT_CONFIG: WasteAnalysisConfig = {
  idleThresholdDays: 7,
  utilizationThreshold: 10,
  minCostThreshold: 1,
  categories: ['idle', 'underutilized', 'orphaned', 'oversized', 'zombie', 'untagged', 'stale-snapshot', 'unused-storage', 'detached-disk', 'idle-database', 'unused-ip', 'old-generation'],
  analysisWindowDays: 30,
};

export class WasteHunterEngine {
  private config: WasteAnalysisConfig;
  private rules: DetectionRule[];

  constructor(config: Partial<WasteAnalysisConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.rules = this.initializeRules();
  }

  private initializeRules(): DetectionRule[] {
    return [
      // ========== IDLE RESOURCES ==========
      {
        category: 'idle',
        name: 'Idle Compute Instances',
        description: 'Virtual machines with minimal or no activity',
        servicePatterns: ['Virtual Machine', 'Compute Engine', 'EC2'],
        resourceTypePatterns: ['vm', 'instance', 'virtualMachine'],
        detect: (data) => {
          const recentDays = data.dailyCosts.slice(-7);
          const hasConsistentCost = recentDays.every(d => d.cost > 0);
          const avgCost = recentDays.reduce((s, d) => s + d.cost, 0) / recentDays.length;
          
          // Low usage quantity relative to cost indicates idle
          if (hasConsistentCost && data.usageQuantity < 100 && avgCost > 5) {
            return {
              severity: avgCost > 50 ? 'high' : avgCost > 20 ? 'medium' : 'low',
              confidence: 75,
              reason: `VM has been running with minimal activity. Average daily cost: $${avgCost.toFixed(2)}`,
              potentialSavings: avgCost * 30 * 0.7, // 70% savings if stopped/downsized
              evidence: [{
                metric: 'Average Daily Cost',
                value: avgCost,
                threshold: 5,
                unit: 'USD/day',
                period: '7 days'
              }],
              recommendations: [
                {
                  action: 'stop',
                  title: 'Stop idle instance',
                  description: 'Stop the VM during non-business hours or when not in use',
                  estimatedSavings: avgCost * 30 * 0.5,
                  effort: 'low',
                  risk: 'low',
                  automatable: true
                },
                {
                  action: 'resize',
                  title: 'Downsize to smaller instance',
                  description: 'Reduce to a smaller instance type if workload is minimal',
                  estimatedSavings: avgCost * 30 * 0.4,
                  effort: 'medium',
                  risk: 'medium',
                  automatable: false
                }
              ]
            };
          }
          return null;
        }
      },

      // ========== UNTAGGED RESOURCES ==========
      {
        category: 'untagged',
        name: 'Untagged High-Cost Resources',
        description: 'Resources missing cost allocation tags',
        servicePatterns: ['*'],
        resourceTypePatterns: ['*'],
        detect: (data) => {
          const criticalTags = ['CostCenter', 'Project', 'Environment', 'Owner', 'Team', 'Application'];
          const hasTags = Object.keys(data.tags).length > 0;
          const missingCritical = criticalTags.filter(t => 
            !Object.keys(data.tags).some(k => k.toLowerCase().includes(t.toLowerCase()))
          );
          
          if ((!hasTags || missingCritical.length >= 3) && data.totalCost > 50) {
            return {
              severity: data.totalCost > 500 ? 'high' : data.totalCost > 100 ? 'medium' : 'low',
              confidence: 95,
              reason: `Resource is missing ${missingCritical.length} critical cost allocation tags: ${missingCritical.slice(0, 3).join(', ')}`,
              potentialSavings: 0, // Tagging doesn't save money directly but enables accountability
              evidence: [{
                metric: 'Missing Tags',
                value: missingCritical.length,
                threshold: 3,
                unit: 'tags',
                period: 'current'
              }],
              recommendations: [
                {
                  action: 'tag',
                  title: 'Add cost allocation tags',
                  description: `Add tags for: ${missingCritical.join(', ')}`,
                  estimatedSavings: 0,
                  effort: 'low',
                  risk: 'low',
                  automatable: true
                }
              ]
            };
          }
          return null;
        }
      },

      // ========== STALE SNAPSHOTS ==========
      {
        category: 'stale-snapshot',
        name: 'Old Snapshots',
        description: 'Disk snapshots that are older than retention policy',
        servicePatterns: ['Storage', 'Snapshot', 'Backup'],
        resourceTypePatterns: ['snapshot', 'backup'],
        detect: (data) => {
          const isSnapshot = data.resourceType.toLowerCase().includes('snapshot') ||
                            data.serviceName.toLowerCase().includes('snapshot');
          
          if (isSnapshot && data.totalCost > 5) {
            // Snapshots usually have a consistent daily cost pattern
            const avgCost = data.totalCost / this.config.analysisWindowDays;
            return {
              severity: data.totalCost > 100 ? 'high' : data.totalCost > 30 ? 'medium' : 'low',
              confidence: 70,
              reason: `Snapshot incurring ongoing storage costs. Consider if still needed.`,
              potentialSavings: data.totalCost * 0.8, // Assume 80% can be deleted
              evidence: [{
                metric: 'Monthly Storage Cost',
                value: avgCost * 30,
                threshold: 10,
                unit: 'USD/month',
                period: `${this.config.analysisWindowDays} days`
              }],
              recommendations: [
                {
                  action: 'review',
                  title: 'Review snapshot necessity',
                  description: 'Verify if this snapshot is still needed or can be archived to cold storage',
                  estimatedSavings: data.totalCost * 0.5,
                  effort: 'low',
                  risk: 'medium',
                  automatable: false
                },
                {
                  action: 'delete',
                  title: 'Delete old snapshot',
                  description: 'Delete if no longer needed for disaster recovery',
                  estimatedSavings: data.totalCost * 0.9,
                  effort: 'low',
                  risk: 'high',
                  automatable: true
                }
              ]
            };
          }
          return null;
        }
      },

      // ========== UNUSED STORAGE ==========
      {
        category: 'unused-storage',
        name: 'Unused Blob/Object Storage',
        description: 'Storage accounts with no recent access',
        servicePatterns: ['Storage', 'Blob', 'S3', 'Object Storage'],
        resourceTypePatterns: ['storage', 'blob', 'bucket'],
        detect: (data) => {
          const isStorage = data.serviceName.toLowerCase().includes('storage') ||
                           data.serviceCategory.toLowerCase().includes('storage');
          
          // Look for storage with consistent cost but no transaction costs
          if (isStorage && data.totalCost > 10) {
            const avgCost = data.totalCost / this.config.analysisWindowDays;
            return {
              severity: data.totalCost > 200 ? 'high' : data.totalCost > 50 ? 'medium' : 'low',
              confidence: 60,
              reason: `Storage account with ongoing costs. Verify data access patterns.`,
              potentialSavings: data.totalCost * 0.3, // Conservative estimate
              evidence: [{
                metric: 'Monthly Storage Cost',
                value: avgCost * 30,
                threshold: 20,
                unit: 'USD/month',
                period: `${this.config.analysisWindowDays} days`
              }],
              recommendations: [
                {
                  action: 'archive',
                  title: 'Move to cold storage tier',
                  description: 'Archive infrequently accessed data to Cool or Archive tier',
                  estimatedSavings: data.totalCost * 0.5,
                  effort: 'medium',
                  risk: 'low',
                  automatable: true
                },
                {
                  action: 'review',
                  title: 'Implement lifecycle policy',
                  description: 'Set up automatic tiering and deletion policies',
                  estimatedSavings: data.totalCost * 0.3,
                  effort: 'medium',
                  risk: 'low',
                  automatable: true
                }
              ]
            };
          }
          return null;
        }
      },

      // ========== IDLE DATABASE ==========
      {
        category: 'idle-database',
        name: 'Idle Database Instance',
        description: 'Database with minimal query activity',
        servicePatterns: ['SQL', 'Database', 'Cosmos', 'RDS', 'PostgreSQL', 'MySQL'],
        resourceTypePatterns: ['database', 'sql', 'db'],
        detect: (data) => {
          const isDatabase = data.serviceName.toLowerCase().includes('sql') ||
                            data.serviceName.toLowerCase().includes('database') ||
                            data.serviceName.toLowerCase().includes('cosmos');
          
          if (isDatabase && data.totalCost > 30) {
            const avgCost = data.totalCost / this.config.analysisWindowDays;
            return {
              severity: data.totalCost > 500 ? 'critical' : data.totalCost > 200 ? 'high' : 'medium',
              confidence: 65,
              reason: `Database instance with significant cost. Verify if actively used.`,
              potentialSavings: data.totalCost * 0.5,
              evidence: [{
                metric: 'Monthly Database Cost',
                value: avgCost * 30,
                threshold: 50,
                unit: 'USD/month',
                period: `${this.config.analysisWindowDays} days`
              }],
              recommendations: [
                {
                  action: 'resize',
                  title: 'Scale down database tier',
                  description: 'Consider moving to a smaller SKU or serverless option',
                  estimatedSavings: data.totalCost * 0.4,
                  effort: 'medium',
                  risk: 'medium',
                  automatable: false
                },
                {
                  action: 'stop',
                  title: 'Pause database (if supported)',
                  description: 'Enable auto-pause for serverless databases',
                  estimatedSavings: data.totalCost * 0.6,
                  effort: 'low',
                  risk: 'low',
                  automatable: true
                }
              ]
            };
          }
          return null;
        }
      },

      // ========== OLD GENERATION ==========
      {
        category: 'old-generation',
        name: 'Old Generation Resources',
        description: 'Resources using older, less efficient SKUs',
        servicePatterns: ['Virtual Machine', 'Compute', 'EC2'],
        resourceTypePatterns: ['*'],
        detect: (data) => {
          // Check for old VM series patterns
          const oldPatterns = ['Standard_D', 'Standard_A', 'Standard_G', 'm4.', 'm3.', 'c4.', 'c3.', 'r4.', 'r3.'];
          const resourceLower = (data.resourceName + data.resourceType).toLowerCase();
          
          const hasOldSeries = oldPatterns.some(p => resourceLower.includes(p.toLowerCase()));
          
          if (hasOldSeries && data.totalCost > 50) {
            return {
              severity: data.totalCost > 300 ? 'high' : 'medium',
              confidence: 80,
              reason: `Resource appears to use an older generation SKU. Newer generations offer better price/performance.`,
              potentialSavings: data.totalCost * 0.25,
              evidence: [{
                metric: 'Potential Efficiency Gain',
                value: 25,
                threshold: 0,
                unit: '%',
                period: 'upgrade'
              }],
              recommendations: [
                {
                  action: 'migrate',
                  title: 'Upgrade to newer generation',
                  description: 'Migrate to Dv5, Ev5, M-series (Azure) or m6i, c6i, r6i (AWS) for better efficiency',
                  estimatedSavings: data.totalCost * 0.25,
                  effort: 'medium',
                  risk: 'medium',
                  automatable: false
                }
              ]
            };
          }
          return null;
        }
      },

      // ========== UNUSED PUBLIC IP ==========
      {
        category: 'unused-ip',
        name: 'Unused Public IP Addresses',
        description: 'Public IPs not attached to any resource',
        servicePatterns: ['Network', 'IP Address', 'Elastic IP'],
        resourceTypePatterns: ['publicIP', 'ip', 'elasticIP'],
        detect: (data) => {
          const isIP = data.serviceName.toLowerCase().includes('ip') ||
                      data.resourceType.toLowerCase().includes('ip');
          
          if (isIP && data.totalCost > 3) {
            return {
              severity: 'low',
              confidence: 70,
              reason: `Public IP address incurring charges. Verify if attached to an active resource.`,
              potentialSavings: data.totalCost * 0.9,
              evidence: [{
                metric: 'IP Cost',
                value: data.totalCost,
                threshold: 3,
                unit: 'USD',
                period: `${this.config.analysisWindowDays} days`
              }],
              recommendations: [
                {
                  action: 'delete',
                  title: 'Release unused IP',
                  description: 'Delete the public IP if no longer needed',
                  estimatedSavings: data.totalCost * 0.95,
                  effort: 'low',
                  risk: 'low',
                  automatable: true
                }
              ]
            };
          }
          return null;
        }
      },
    ];
  }

  /**
   * Analyze resources for waste opportunities
   */
  analyzeResources(resources: ResourceAnalysis[]): WasteOpportunity[] {
    const opportunities: WasteOpportunity[] = [];
    
    for (const resource of resources) {
      // Skip resources below minimum cost threshold
      if (resource.totalCost < this.config.minCostThreshold) continue;
      
      // Run all applicable rules
      for (const rule of this.rules) {
        if (!this.config.categories.includes(rule.category)) continue;
        
        const result = rule.detect(resource);
        if (result) {
          opportunities.push({
            id: `${rule.category}-${resource.resourceId}-${Date.now()}`,
            category: rule.category,
            severity: result.severity,
            resourceId: resource.resourceId,
            resourceName: resource.resourceName,
            resourceType: resource.resourceType,
            serviceName: resource.serviceName,
            serviceCategory: resource.serviceCategory,
            region: resource.region,
            currentCost: resource.totalCost,
            potentialSavings: result.potentialSavings,
            savingsPercent: (result.potentialSavings / resource.totalCost) * 100,
            currency: resource.currency,
            dailyCosts: resource.dailyCosts, // Include historical cost data
            detectionMethod: rule.name,
            confidence: result.confidence,
            reason: result.reason,
            evidence: result.evidence,
            recommendations: result.recommendations,
            detectedAt: new Date(),
            daysSinceActivity: this.calculateDaysSinceActivity(resource.dailyCosts),
            tags: resource.tags,
          });
        }
      }
    }
    
    // Sort by potential savings (highest first)
    return opportunities.sort((a, b) => b.potentialSavings - a.potentialSavings);
  }

  /**
   * Generate summary statistics
   */
  generateSummary(opportunities: WasteOpportunity[], dataRange: { start: Date; end: Date }): WasteSummary {
    const byCategory = {} as Record<WasteCategory, { count: number; savings: number }>;
    const bySeverity = {} as Record<WasteSeverity, { count: number; savings: number }>;
    const byServiceMap = new Map<string, { count: number; savings: number }>();
    
    // Initialize
    for (const cat of this.config.categories) {
      byCategory[cat] = { count: 0, savings: 0 };
    }
    for (const sev of ['critical', 'high', 'medium', 'low'] as WasteSeverity[]) {
      bySeverity[sev] = { count: 0, savings: 0 };
    }
    
    // Aggregate
    let totalSavings = 0;
    for (const opp of opportunities) {
      totalSavings += opp.potentialSavings;
      
      if (byCategory[opp.category]) {
        byCategory[opp.category].count++;
        byCategory[opp.category].savings += opp.potentialSavings;
      }
      
      bySeverity[opp.severity].count++;
      bySeverity[opp.severity].savings += opp.potentialSavings;
      
      const serviceStats = byServiceMap.get(opp.serviceName) || { count: 0, savings: 0 };
      serviceStats.count++;
      serviceStats.savings += opp.potentialSavings;
      byServiceMap.set(opp.serviceName, serviceStats);
    }
    
    // Convert service map to sorted array
    const byService = Array.from(byServiceMap.entries())
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.savings - a.savings)
      .slice(0, 10);
    
    return {
      totalOpportunities: opportunities.length,
      totalPotentialSavings: totalSavings,
      byCategory,
      bySeverity,
      byService,
      topOpportunities: opportunities.slice(0, 20),
      analysisDate: new Date(),
      dataRange,
    };
  }

  private calculateDaysSinceActivity(dailyCosts: { date: string; cost: number }[]): number {
    // Find last day with significant cost change
    const sorted = [...dailyCosts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const today = new Date();
    
    for (const day of sorted) {
      if (day.cost > 0) {
        const daysSince = Math.floor((today.getTime() - new Date(day.date).getTime()) / (24 * 60 * 60 * 1000));
        return daysSince;
      }
    }
    
    return this.config.analysisWindowDays;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<WasteAnalysisConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): WasteAnalysisConfig {
    return { ...this.config };
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

export function getCategoryLabel(category: WasteCategory): string {
  const labels: Record<WasteCategory, string> = {
    'idle': 'Idle Resources',
    'underutilized': 'Underutilized',
    'orphaned': 'Orphaned',
    'oversized': 'Oversized',
    'zombie': 'Zombie Resources',
    'untagged': 'Untagged',
    'stale-snapshot': 'Stale Snapshots',
    'unused-storage': 'Unused Storage',
    'detached-disk': 'Detached Disks',
    'idle-database': 'Idle Databases',
    'unused-ip': 'Unused IPs',
    'old-generation': 'Old Generation',
  };
  return labels[category] || category;
}

export function getCategoryIcon(category: WasteCategory): string {
  const icons: Record<WasteCategory, string> = {
    'idle': '💤',
    'underutilized': '📉',
    'orphaned': '👻',
    'oversized': '📈',
    'zombie': '🧟',
    'untagged': '🏷️',
    'stale-snapshot': '📸',
    'unused-storage': '📦',
    'detached-disk': '💽',
    'idle-database': '🗄️',
    'unused-ip': '🌐',
    'old-generation': '👴',
  };
  return icons[category] || '❓';
}

export function getSeverityColor(severity: WasteSeverity): string {
  const colors: Record<WasteSeverity, string> = {
    'critical': '#ef4444',
    'high': '#f97316',
    'medium': '#eab308',
    'low': '#3b82f6',
  };
  return colors[severity];
}
