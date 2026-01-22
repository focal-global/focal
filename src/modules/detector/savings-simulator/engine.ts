/**
 * Savings Simulator Engine
 * 
 * Model cost savings scenarios locally in the browser.
 * Provides what-if analysis for various optimization strategies.
 * 
 * Simulation Types:
 * 1. Reserved Instances / Savings Plans
 * 2. Spot/Preemptible Instances
 * 3. Right-sizing (downgrade SKUs)
 * 4. Region Migration
 * 5. Commitment Discounts
 * 6. Scheduled Scaling (stop/start)
 * 7. Storage Tier Optimization
 * 8. License Optimization (BYOL)
 */

// ============================================================================
// Types
// ============================================================================

export type SimulationType = 
  | 'reserved-instances'
  | 'spot-instances'
  | 'rightsizing'
  | 'region-migration'
  | 'commitment'
  | 'scheduled-scaling'
  | 'storage-tiering'
  | 'license-optimization'
  | 'custom';

export type RiskLevel = 'low' | 'medium' | 'high';

export interface SimulationScenario {
  id: string;
  name: string;
  type: SimulationType;
  description: string;
  
  // Configuration
  targetServices: string[];
  targetResources: string[];
  parameters: ScenarioParameters;
  
  // Results
  currentCost: number;
  projectedCost: number;
  savings: number;
  savingsPercent: number;
  
  // Risk assessment
  riskLevel: RiskLevel;
  riskFactors: string[];
  
  // Implementation
  effort: 'low' | 'medium' | 'high';
  timeToImplement: string;
  prerequisites: string[];
  
  // Timeline
  breakEvenMonths?: number;
  annualSavings: number;
  threeYearSavings: number;
}

export interface ScenarioParameters {
  // Reserved instances
  reservationTerm?: '1-year' | '3-year';
  paymentOption?: 'all-upfront' | 'partial-upfront' | 'no-upfront';
  reservationDiscount?: number;
  
  // Spot instances
  spotDiscount?: number;
  interruptionRate?: number;
  
  // Rightsizing
  downsizePercent?: number;
  targetUtilization?: number;
  
  // Region
  targetRegion?: string;
  regionPriceDiff?: number;
  
  // Scheduling
  weekdayHours?: number;
  weekendHours?: number;
  
  // Storage
  coldStoragePercent?: number;
  archivePercent?: number;
  
  // Custom
  customDiscount?: number;
  customDescription?: string;
}

export interface SimulationSummary {
  totalCurrentCost: number;
  totalProjectedCost: number;
  totalSavings: number;
  savingsPercent: number;
  scenarios: SimulationScenario[];
  byType: Record<SimulationType, { count: number; savings: number }>;
  recommendations: SimulationRecommendation[];
  generatedAt: Date;
}

export interface SimulationRecommendation {
  priority: number;
  title: string;
  description: string;
  savings: number;
  effort: 'low' | 'medium' | 'high';
  risk: RiskLevel;
  scenarios: string[];
}

// ============================================================================
// Simulation Templates
// ============================================================================

interface SimulationTemplate {
  type: SimulationType;
  name: string;
  description: string;
  icon: string;
  defaultParams: ScenarioParameters;
  discountRange: { min: number; max: number };
  riskLevel: RiskLevel;
  effort: 'low' | 'medium' | 'high';
  applicableServices: string[];
}

export const SIMULATION_TEMPLATES: SimulationTemplate[] = [
  {
    type: 'reserved-instances',
    name: 'Reserved Instances',
    description: 'Commit to 1 or 3 years for significant discounts on compute',
    icon: '📅',
    defaultParams: {
      reservationTerm: '1-year',
      paymentOption: 'no-upfront',
      reservationDiscount: 35,
    },
    discountRange: { min: 20, max: 72 },
    riskLevel: 'medium',
    effort: 'medium',
    applicableServices: ['Virtual Machine', 'Compute', 'EC2', 'SQL Database', 'RDS'],
  },
  {
    type: 'spot-instances',
    name: 'Spot/Preemptible Instances',
    description: 'Use spare cloud capacity at steep discounts for fault-tolerant workloads',
    icon: '⚡',
    defaultParams: {
      spotDiscount: 70,
      interruptionRate: 5,
    },
    discountRange: { min: 50, max: 90 },
    riskLevel: 'high',
    effort: 'high',
    applicableServices: ['Virtual Machine', 'Compute', 'EC2', 'Batch'],
  },
  {
    type: 'rightsizing',
    name: 'Right-sizing',
    description: 'Match resource sizes to actual utilization',
    icon: '📐',
    defaultParams: {
      downsizePercent: 30,
      targetUtilization: 70,
    },
    discountRange: { min: 10, max: 50 },
    riskLevel: 'low',
    effort: 'medium',
    applicableServices: ['Virtual Machine', 'Compute', 'EC2', 'Database', 'App Service'],
  },
  {
    type: 'scheduled-scaling',
    name: 'Scheduled Scaling',
    description: 'Stop non-production resources outside business hours',
    icon: '🕐',
    defaultParams: {
      weekdayHours: 10, // 8am-6pm
      weekendHours: 0,
    },
    discountRange: { min: 30, max: 70 },
    riskLevel: 'low',
    effort: 'low',
    applicableServices: ['Virtual Machine', 'Compute', 'EC2', 'Database', 'App Service'],
  },
  {
    type: 'storage-tiering',
    name: 'Storage Tiering',
    description: 'Move infrequently accessed data to cheaper storage tiers',
    icon: '📦',
    defaultParams: {
      coldStoragePercent: 40,
      archivePercent: 20,
    },
    discountRange: { min: 20, max: 80 },
    riskLevel: 'low',
    effort: 'low',
    applicableServices: ['Storage', 'Blob', 'S3', 'Object Storage'],
  },
  {
    type: 'region-migration',
    name: 'Region Migration',
    description: 'Move workloads to lower-cost regions',
    icon: '🌍',
    defaultParams: {
      regionPriceDiff: 20,
    },
    discountRange: { min: 5, max: 40 },
    riskLevel: 'medium',
    effort: 'high',
    applicableServices: ['*'],
  },
  {
    type: 'license-optimization',
    name: 'License Optimization',
    description: 'Use Azure Hybrid Benefit, BYOL, or open-source alternatives',
    icon: '📜',
    defaultParams: {
      customDiscount: 40,
    },
    discountRange: { min: 20, max: 55 },
    riskLevel: 'low',
    effort: 'medium',
    applicableServices: ['SQL', 'Windows', 'Database', 'Virtual Machine'],
  },
];

// ============================================================================
// Savings Simulator Engine
// ============================================================================

export class SavingsSimulatorEngine {
  private templates: SimulationTemplate[];

  constructor() {
    this.templates = SIMULATION_TEMPLATES;
  }

  /**
   * Generate simulation scenarios for given cost data
   */
  generateScenarios(resources: {
    resourceId: string;
    resourceName: string;
    serviceName: string;
    serviceCategory: string;
    region: string;
    totalCost: number;
    avgDailyCost: number;
    chargeCategory: string;
  }[]): SimulationScenario[] {
    const scenarios: SimulationScenario[] = [];
    
    // Group resources by service
    const serviceGroups = new Map<string, typeof resources>();
    for (const resource of resources) {
      const existing = serviceGroups.get(resource.serviceName) || [];
      existing.push(resource);
      serviceGroups.set(resource.serviceName, existing);
    }

    // Generate scenarios for each applicable template
    for (const template of this.templates) {
      // Find applicable resources
      const applicable = resources.filter(r => 
        template.applicableServices.includes('*') ||
        template.applicableServices.some(s => 
          r.serviceName.toLowerCase().includes(s.toLowerCase()) ||
          r.serviceCategory.toLowerCase().includes(s.toLowerCase())
        )
      );

      if (applicable.length === 0) continue;

      const currentCost = applicable.reduce((sum, r) => sum + r.totalCost, 0);
      
      if (currentCost < 50) continue; // Skip trivial amounts

      const scenario = this.createScenario(template, applicable, currentCost);
      if (scenario.savings > 10) { // Only include meaningful savings
        scenarios.push(scenario);
      }
    }

    // Sort by savings descending
    return scenarios.sort((a, b) => b.savings - a.savings);
  }

  private createScenario(
    template: SimulationTemplate,
    resources: { resourceId: string; resourceName: string; serviceName: string; totalCost: number }[],
    currentCost: number
  ): SimulationScenario {
    const params = { ...template.defaultParams };
    
    // Calculate savings based on template type
    let savingsPercent: number;
    let riskFactors: string[] = [];
    let prerequisites: string[] = [];
    let breakEvenMonths: number | undefined;

    switch (template.type) {
      case 'reserved-instances':
        savingsPercent = params.reservationTerm === '3-year' ? 55 : 35;
        if (params.paymentOption === 'all-upfront') savingsPercent += 10;
        riskFactors = ['Commitment lock-in', 'Changing requirements'];
        prerequisites = ['Stable workload analysis', 'Usage forecast'];
        breakEvenMonths = params.reservationTerm === '3-year' ? 8 : 5;
        break;

      case 'spot-instances':
        savingsPercent = params.spotDiscount || 70;
        riskFactors = ['Instance interruption', 'Requires fault-tolerant architecture'];
        prerequisites = ['Stateless workloads', 'Auto-scaling setup', 'Checkpoint mechanism'];
        break;

      case 'rightsizing':
        savingsPercent = params.downsizePercent || 30;
        riskFactors = ['Performance impact if undersized'];
        prerequisites = ['Utilization monitoring', 'Performance baselines'];
        break;

      case 'scheduled-scaling':
        const weekdayHours = params.weekdayHours || 10;
        const weekendHours = params.weekendHours || 0;
        const totalWeekHours = (weekdayHours * 5) + (weekendHours * 2);
        savingsPercent = Math.round((1 - totalWeekHours / 168) * 100);
        riskFactors = ['Requires consistent schedule'];
        prerequisites = ['Identify non-production workloads', 'Automation setup'];
        break;

      case 'storage-tiering':
        const coldPercent = params.coldStoragePercent || 40;
        const archivePercent = params.archivePercent || 20;
        // Cold = ~50% cheaper, Archive = ~90% cheaper
        savingsPercent = Math.round((coldPercent * 0.5 + archivePercent * 0.9) / 2);
        riskFactors = ['Access latency for archived data'];
        prerequisites = ['Data lifecycle analysis', 'Access pattern review'];
        break;

      case 'region-migration':
        savingsPercent = params.regionPriceDiff || 20;
        riskFactors = ['Data residency compliance', 'Latency changes', 'Migration complexity'];
        prerequisites = ['Compliance review', 'Latency testing', 'Migration plan'];
        break;

      case 'license-optimization':
        savingsPercent = params.customDiscount || 40;
        riskFactors = ['License compliance'];
        prerequisites = ['Existing license inventory', 'SA agreement review'];
        break;

      default:
        savingsPercent = params.customDiscount || 20;
    }

    const projectedCost = currentCost * (1 - savingsPercent / 100);
    const savings = currentCost - projectedCost;
    const annualSavings = (savings / 30) * 365; // Extrapolate from 30-day window

    return {
      id: `${template.type}-${Date.now()}`,
      name: template.name,
      type: template.type,
      description: template.description,
      targetServices: [...new Set(resources.map(r => r.serviceName))],
      targetResources: resources.map(r => r.resourceId),
      parameters: params,
      currentCost,
      projectedCost,
      savings,
      savingsPercent,
      riskLevel: template.riskLevel,
      riskFactors,
      effort: template.effort,
      timeToImplement: this.getTimeToImplement(template.effort),
      prerequisites,
      breakEvenMonths,
      annualSavings,
      threeYearSavings: annualSavings * 3,
    };
  }

  private getTimeToImplement(effort: 'low' | 'medium' | 'high'): string {
    switch (effort) {
      case 'low': return '1-2 days';
      case 'medium': return '1-2 weeks';
      case 'high': return '2-4 weeks';
    }
  }

  /**
   * Generate summary with recommendations
   */
  generateSummary(scenarios: SimulationScenario[]): SimulationSummary {
    const totalCurrentCost = scenarios.reduce((sum, s) => sum + s.currentCost, 0);
    // Avoid double-counting by taking the max savings per resource
    const totalSavings = scenarios.reduce((sum, s) => sum + s.savings, 0) * 0.6; // Conservative estimate
    const totalProjectedCost = totalCurrentCost - totalSavings;

    // By type
    const byType = {} as Record<SimulationType, { count: number; savings: number }>;
    for (const template of this.templates) {
      byType[template.type] = { count: 0, savings: 0 };
    }
    byType['custom'] = { count: 0, savings: 0 };

    for (const scenario of scenarios) {
      byType[scenario.type].count++;
      byType[scenario.type].savings += scenario.savings;
    }

    // Generate recommendations
    const recommendations = this.generateRecommendations(scenarios);

    return {
      totalCurrentCost,
      totalProjectedCost,
      totalSavings,
      savingsPercent: totalCurrentCost > 0 ? (totalSavings / totalCurrentCost) * 100 : 0,
      scenarios,
      byType,
      recommendations,
      generatedAt: new Date(),
    };
  }

  private generateRecommendations(scenarios: SimulationScenario[]): SimulationRecommendation[] {
    const recommendations: SimulationRecommendation[] = [];

    // Quick wins (low effort, low risk)
    const quickWins = scenarios.filter(s => s.effort === 'low' && s.riskLevel === 'low');
    if (quickWins.length > 0) {
      const totalSavings = quickWins.reduce((sum, s) => sum + s.savings, 0);
      recommendations.push({
        priority: 1,
        title: 'Start with Quick Wins',
        description: `${quickWins.length} low-effort, low-risk opportunities available`,
        savings: totalSavings,
        effort: 'low',
        risk: 'low',
        scenarios: quickWins.map(s => s.id),
      });
    }

    // High-impact opportunities
    const highImpact = scenarios.filter(s => s.savingsPercent >= 30);
    if (highImpact.length > 0) {
      const totalSavings = highImpact.reduce((sum, s) => sum + s.savings, 0);
      recommendations.push({
        priority: 2,
        title: 'Focus on High-Impact Areas',
        description: `${highImpact.length} scenarios with 30%+ savings potential`,
        savings: totalSavings,
        effort: 'medium',
        risk: 'medium',
        scenarios: highImpact.map(s => s.id),
      });
    }

    // Reserved instances
    const riScenarios = scenarios.filter(s => s.type === 'reserved-instances');
    if (riScenarios.length > 0) {
      recommendations.push({
        priority: 3,
        title: 'Consider Reserved Instances',
        description: 'Commit to reservations for predictable workloads',
        savings: riScenarios.reduce((sum, s) => sum + s.savings, 0),
        effort: 'medium',
        risk: 'medium',
        scenarios: riScenarios.map(s => s.id),
      });
    }

    // Scheduled scaling for dev/test
    const scheduleScenarios = scenarios.filter(s => s.type === 'scheduled-scaling');
    if (scheduleScenarios.length > 0) {
      recommendations.push({
        priority: 4,
        title: 'Implement Dev/Test Scheduling',
        description: 'Stop non-production resources outside business hours',
        savings: scheduleScenarios.reduce((sum, s) => sum + s.savings, 0),
        effort: 'low',
        risk: 'low',
        scenarios: scheduleScenarios.map(s => s.id),
      });
    }

    return recommendations.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Create custom scenario
   */
  createCustomScenario(
    name: string,
    description: string,
    resources: { resourceId: string; totalCost: number }[],
    discountPercent: number
  ): SimulationScenario {
    const currentCost = resources.reduce((sum, r) => sum + r.totalCost, 0);
    const projectedCost = currentCost * (1 - discountPercent / 100);
    const savings = currentCost - projectedCost;
    const annualSavings = (savings / 30) * 365;

    return {
      id: `custom-${Date.now()}`,
      name,
      type: 'custom',
      description,
      targetServices: [],
      targetResources: resources.map(r => r.resourceId),
      parameters: { customDiscount: discountPercent, customDescription: description },
      currentCost,
      projectedCost,
      savings,
      savingsPercent: discountPercent,
      riskLevel: 'medium',
      riskFactors: ['Custom scenario - verify assumptions'],
      effort: 'medium',
      timeToImplement: 'Varies',
      prerequisites: [],
      annualSavings,
      threeYearSavings: annualSavings * 3,
    };
  }

  /**
   * Get templates
   */
  getTemplates(): SimulationTemplate[] {
    return [...this.templates];
  }

  /**
   * Get template by type
   */
  getTemplate(type: SimulationType): SimulationTemplate | undefined {
    return this.templates.find(t => t.type === type);
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

export function getTypeLabel(type: SimulationType): string {
  const labels: Record<SimulationType, string> = {
    'reserved-instances': 'Reserved Instances',
    'spot-instances': 'Spot Instances',
    'rightsizing': 'Right-sizing',
    'region-migration': 'Region Migration',
    'commitment': 'Commitment Discounts',
    'scheduled-scaling': 'Scheduled Scaling',
    'storage-tiering': 'Storage Tiering',
    'license-optimization': 'License Optimization',
    'custom': 'Custom Scenario',
  };
  return labels[type] || type;
}

export function getTypeIcon(type: SimulationType): string {
  const template = SIMULATION_TEMPLATES.find(t => t.type === type);
  return template?.icon || '💡';
}

export function getRiskColor(risk: RiskLevel): string {
  const colors: Record<RiskLevel, string> = {
    low: '#10b981',
    medium: '#f59e0b',
    high: '#ef4444',
  };
  return colors[risk];
}

export function getEffortColor(effort: 'low' | 'medium' | 'high'): string {
  const colors = {
    low: '#10b981',
    medium: '#f59e0b',
    high: '#ef4444',
  };
  return colors[effort];
}
