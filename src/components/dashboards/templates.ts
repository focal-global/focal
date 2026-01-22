/**
 * Dashboard Templates
 * 
 * Pre-configured dashboard layouts for different personas.
 * Each template provides a curated set of widgets optimized
 * for specific FinOps use cases.
 */

import type { DashboardConfig, WidgetConfig } from './types';

// ============================================================================
// Widget Presets
// ============================================================================

const createWidget = (
  id: string,
  type: WidgetConfig['type'],
  title: string,
  size: WidgetConfig['size'],
  config: WidgetConfig['config'],
  description?: string
): WidgetConfig => ({
  id,
  type,
  title,
  description,
  size,
  config,
});

// ============================================================================
// Executive Dashboard Template
// ============================================================================

export const executiveDashboardTemplate: DashboardConfig = {
  id: 'executive-default',
  name: 'Executive Summary',
  description: 'High-level cloud cost overview for leadership and stakeholders',
  persona: 'executive',
  columns: 12,
  isDefault: true,
  widgets: [
    // Row 1: Key KPIs
    createWidget('exec-total-cost', 'kpi', 'Total Cloud Spend', 'small', {
      type: 'kpi',
      kpi: { metric: 'total-cost', showTrend: true, showSparkline: true, comparisonPeriod: 'previous' },
    }),
    createWidget('exec-cost-change', 'kpi', 'Month-over-Month', 'small', {
      type: 'kpi',
      kpi: { metric: 'cost-change', showTrend: true, comparisonPeriod: 'same-last-month' },
    }),
    createWidget('exec-savings', 'kpi', 'Cost Savings', 'small', {
      type: 'kpi',
      kpi: { metric: 'savings', showTrend: true },
    }),
    createWidget('exec-forecast', 'kpi', 'Projected Month-End', 'small', {
      type: 'kpi',
      kpi: { metric: 'forecast', showTrend: false },
    }),
    
    // Row 2: Trend Chart
    createWidget('exec-trend', 'trend-chart', 'Cost Trend', 'large', {
      type: 'trend-chart',
      trendChart: { 
        metrics: ['billed', 'forecast'], 
        granularity: 'daily',
        showArea: true,
        showComparison: true,
      },
    }, 'Daily cloud spend with forecast projection'),
    
    // Row 3: Breakdowns
    createWidget('exec-by-service', 'breakdown', 'Cost by Service', 'medium', {
      type: 'breakdown',
      breakdown: { dimension: 'service', limit: 8, chartType: 'bar', showOther: true },
    }),
    createWidget('exec-by-category', 'treemap', 'Service Categories', 'medium', {
      type: 'treemap',
      treemap: { groupBy: 'category', colorBy: 'cost' },
    }),
    
    // Row 4: Period Comparison and Top Movers
    createWidget('exec-comparison', 'comparison', 'Period Comparison', 'medium', {
      type: 'comparison',
      comparison: { metric: 'cost', compareWith: 'previous-period', breakdown: 'service' },
    }),
    createWidget('exec-top-services', 'top-n', 'Top Growing Services', 'medium', {
      type: 'top-n',
      topN: { dimension: 'services', metric: 'growth', limit: 5, showChange: true },
    }),
  ],
};

// ============================================================================
// Finance Dashboard Template
// ============================================================================

export const financeDashboardTemplate: DashboardConfig = {
  id: 'finance-default',
  name: 'Finance & Accounting',
  description: 'Budget tracking, allocations, and financial reporting',
  persona: 'finance',
  columns: 12,
  isDefault: true,
  widgets: [
    // Row 1: Budget KPIs
    createWidget('fin-budget-used', 'kpi', 'Budget Used', 'small', {
      type: 'kpi',
      kpi: { metric: 'total-cost', showTrend: true },
    }),
    createWidget('fin-budget-remaining', 'kpi', 'Budget Remaining', 'small', {
      type: 'kpi',
      kpi: { metric: 'budget-remaining', showTrend: false },
    }),
    createWidget('fin-effective', 'kpi', 'Effective Cost', 'small', {
      type: 'kpi',
      kpi: { metric: 'effective-cost', showTrend: true },
    }),
    createWidget('fin-savings', 'kpi', 'Total Savings', 'small', {
      type: 'kpi',
      kpi: { metric: 'savings', showTrend: true },
    }),
    
    // Row 2: Budget Gauge and Trend
    createWidget('fin-budget-gauge', 'gauge', 'Monthly Budget', 'medium', {
      type: 'gauge',
      gauge: { 
        budgetType: 'monthly', 
        showForecast: true,
        warningThreshold: 80,
        criticalThreshold: 95,
      },
    }),
    createWidget('fin-trend', 'trend-chart', 'Budget vs Actual', 'large', {
      type: 'trend-chart',
      trendChart: { 
        metrics: ['billed', 'effective', 'budget'], 
        granularity: 'daily',
        showArea: false,
      },
    }),
    
    // Row 3: Allocation
    createWidget('fin-allocation', 'allocation', 'Cost Allocation', 'medium', {
      type: 'allocation',
      allocation: { allocateBy: 'tag', tagKey: 'CostCenter', showUnallocated: true },
    }),
    createWidget('fin-by-account', 'breakdown', 'Cost by Account', 'medium', {
      type: 'breakdown',
      breakdown: { dimension: 'account', limit: 10, chartType: 'bar', showOther: true },
    }),
    
    // Row 4: Tag Coverage and Unallocated
    createWidget('fin-tag-coverage', 'tag-coverage', 'Tag Coverage', 'medium', {
      type: 'tag-coverage',
      tagCoverage: { showByDimension: 'account', requiredTags: ['CostCenter', 'Project', 'Environment'] },
    }),
    createWidget('fin-charge-types', 'breakdown', 'Charge Types', 'medium', {
      type: 'breakdown',
      breakdown: { dimension: 'charge-type', limit: 6, chartType: 'donut' },
    }),
    
    // Row 5: Detailed Table
    createWidget('fin-details-table', 'table', 'Cost Details by Account', 'full', {
      type: 'table',
      table: { 
        columns: ['Account', 'Service', 'BilledCost', 'EffectiveCost', 'Savings', 'Change%'],
        groupBy: ['Account'],
        orderBy: 'BilledCost DESC',
        limit: 20,
        showTotals: true,
      },
    }),
  ],
};

// ============================================================================
// Engineering Dashboard Template
// ============================================================================

export const engineeringDashboardTemplate: DashboardConfig = {
  id: 'engineering-default',
  name: 'Engineering & DevOps',
  description: 'Resource optimization, utilization, and efficiency metrics',
  persona: 'engineering',
  columns: 12,
  isDefault: true,
  widgets: [
    // Row 1: Engineering KPIs
    createWidget('eng-total-resources', 'kpi', 'Active Resources', 'small', {
      type: 'kpi',
      kpi: { metric: 'total-cost', showTrend: true },
    }),
    createWidget('eng-savings-opp', 'kpi', 'Savings Opportunities', 'small', {
      type: 'kpi',
      kpi: { metric: 'savings', showTrend: true },
    }),
    createWidget('eng-cost-per-resource', 'kpi', 'Avg Cost/Resource', 'small', {
      type: 'kpi',
      kpi: { metric: 'effective-cost', showTrend: true },
    }),
    createWidget('eng-anomalies', 'kpi', 'Cost Anomalies', 'small', {
      type: 'kpi',
      kpi: { metric: 'cost-change', showTrend: false },
    }),
    
    // Row 2: Trend and Anomalies
    createWidget('eng-trend', 'trend-chart', 'Daily Cost Trend', 'large', {
      type: 'trend-chart',
      trendChart: { 
        metrics: ['billed', 'effective'], 
        granularity: 'daily',
        showArea: true,
      },
    }),
    createWidget('eng-anomaly-chart', 'anomaly', 'Anomaly Detection', 'medium', {
      type: 'anomaly',
      anomaly: { sensitivity: 'medium', metric: 'cost', timeWindow: 14 },
    }),
    
    // Row 3: Resource Analysis
    createWidget('eng-top-resources', 'top-n', 'Top Cost Resources', 'medium', {
      type: 'top-n',
      topN: { dimension: 'resources', metric: 'cost', limit: 10, showChange: true },
    }),
    createWidget('eng-by-service', 'breakdown', 'Cost by Service', 'medium', {
      type: 'breakdown',
      breakdown: { dimension: 'service', limit: 10, chartType: 'bar' },
    }),
    
    // Row 4: Optimization
    createWidget('eng-by-region', 'breakdown', 'Cost by Region', 'medium', {
      type: 'breakdown',
      breakdown: { dimension: 'region', limit: 8, chartType: 'bar' },
    }),
    createWidget('eng-savings', 'savings', 'Savings Opportunities', 'medium', {
      type: 'savings',
      savings: { categories: ['commitments', 'rightsizing', 'unused', 'scheduling'], showPotential: true },
    }),
    
    // Row 5: Environment Breakdown (by tag)
    createWidget('eng-by-env', 'breakdown', 'Cost by Environment', 'medium', {
      type: 'breakdown',
      breakdown: { dimension: 'tag', tagKey: 'Environment', limit: 5, chartType: 'donut' },
    }),
    createWidget('eng-by-team', 'breakdown', 'Cost by Team', 'medium', {
      type: 'breakdown',
      breakdown: { dimension: 'tag', tagKey: 'Team', limit: 8, chartType: 'bar' },
    }),
  ],
};

// ============================================================================
// Overview Dashboard Template (Default/General)
// ============================================================================

export const overviewDashboardTemplate: DashboardConfig = {
  id: 'overview-default',
  name: 'Cost Overview',
  description: 'General cloud cost visibility dashboard',
  persona: 'overview',
  columns: 12,
  isDefault: true,
  widgets: [
    // Row 1: Key KPIs
    createWidget('ovw-total-cost', 'kpi', 'Total Billed Cost', 'small', {
      type: 'kpi',
      kpi: { metric: 'total-cost', showTrend: true, showSparkline: true },
    }),
    createWidget('ovw-effective', 'kpi', 'Effective Cost', 'small', {
      type: 'kpi',
      kpi: { metric: 'effective-cost', showTrend: true },
    }),
    createWidget('ovw-savings', 'kpi', 'Savings Realized', 'small', {
      type: 'kpi',
      kpi: { metric: 'savings', showTrend: true },
    }),
    createWidget('ovw-tag-coverage', 'kpi', 'Tag Coverage', 'small', {
      type: 'kpi',
      kpi: { metric: 'total-cost', showTrend: false },
    }),
    
    // Row 2: Main Trend Chart
    createWidget('ovw-trend', 'trend-chart', 'Cost Over Time', 'full', {
      type: 'trend-chart',
      trendChart: { 
        metrics: ['billed', 'effective'], 
        granularity: 'daily',
        showArea: true,
      },
    }),
    
    // Row 3: Breakdowns
    createWidget('ovw-by-service', 'breakdown', 'Cost by Service', 'medium', {
      type: 'breakdown',
      breakdown: { dimension: 'service', limit: 10, chartType: 'bar', showOther: true },
    }),
    createWidget('ovw-by-region', 'breakdown', 'Cost by Region', 'medium', {
      type: 'breakdown',
      breakdown: { dimension: 'region', limit: 8, chartType: 'bar' },
    }),
    
    // Row 4: Treemap and Top Resources
    createWidget('ovw-categories', 'treemap', 'Service Categories', 'medium', {
      type: 'treemap',
      treemap: { groupBy: 'category', colorBy: 'cost' },
    }),
    createWidget('ovw-top-resources', 'top-n', 'Top Resources', 'medium', {
      type: 'top-n',
      topN: { dimension: 'resources', metric: 'cost', limit: 5, showChange: true },
    }),
  ],
};

// ============================================================================
// All Dashboard Templates
// ============================================================================

export const DASHBOARD_TEMPLATES: Record<string, DashboardConfig> = {
  'executive-default': executiveDashboardTemplate,
  'finance-default': financeDashboardTemplate,
  'engineering-default': engineeringDashboardTemplate,
  'overview-default': overviewDashboardTemplate,
};

export const getDefaultDashboardForPersona = (persona: DashboardConfig['persona']): DashboardConfig => {
  switch (persona) {
    case 'executive':
      return executiveDashboardTemplate;
    case 'finance':
      return financeDashboardTemplate;
    case 'engineering':
      return engineeringDashboardTemplate;
    case 'overview':
    default:
      return overviewDashboardTemplate;
  }
};
