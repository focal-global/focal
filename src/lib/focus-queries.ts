/**
 * FOCUS Use Case Query Library
 * 
 * 59 standard FinOps queries based on the FOCUS specification
 * from the FinOps Foundation: https://focus.finops.org/use-cases/
 * 
 * Each query is parameterized with:
 * - {{TABLE}} - replaced with the actual data source table name
 * - {{START_DATE}} - replaced with the start date filter
 * - {{END_DATE}} - replaced with the end date filter
 */

// ============================================================================
// Types
// ============================================================================

export type FocusCategory =
  | 'allocation'
  | 'anomaly-management'
  | 'budgeting'
  | 'data-ingestion'
  | 'forecasting'
  | 'invoicing-chargeback'
  | 'planning-estimating'
  | 'policy-governance'
  | 'rate-optimization'
  | 'reporting-analytics'
  | 'unit-economics'
  | 'workload-optimization';

export interface FocusQuery {
  id: string;
  name: string;
  description: string;
  category: FocusCategory;
  sql: string;
  requiredColumns: string[];
  minFocusVersion: '1.0' | '1.1' | '1.2';
  hasDateFilter: boolean;
  /**
   * Which date columns to use for filtering:
   * - 'charge': ChargePeriodStart/ChargePeriodEnd (for usage, resource, commitment queries)
   * - 'billing': BillingPeriodStart/BillingPeriodEnd (for invoice, chargeback, budget queries)
   * 
   * Per FOCUS v1.2 spec:
   * - BillingPeriod = time window for invoice receipt (independent of usage time)
   * - ChargePeriod = time window when charge is effective (usage-based)
   */
  dateFilterType: 'charge' | 'billing';
  // Additional parameters beyond date (e.g., specific filters)
  parameters?: {
    name: string;
    type: 'string' | 'number' | 'select';
    label: string;
    placeholder?: string;
    options?: string[];
  }[];
}

export interface FocusCategoryInfo {
  id: FocusCategory;
  name: string;
  description: string;
  icon: string;
}

// ============================================================================
// Category Definitions
// ============================================================================

export const FOCUS_CATEGORIES: FocusCategoryInfo[] = [
  {
    id: 'allocation',
    name: 'Allocation',
    description: 'Assigning costs to owners, tags, or entities',
    icon: '🏷️',
  },
  {
    id: 'anomaly-management',
    name: 'Anomaly Management',
    description: 'Detecting spikes and waste',
    icon: '⚠️',
  },
  {
    id: 'budgeting',
    name: 'Budgeting',
    description: 'Tracking spend against limits',
    icon: '💰',
  },
  {
    id: 'data-ingestion',
    name: 'Data Ingestion',
    description: 'Validating data quality and completeness',
    icon: '📥',
  },
  {
    id: 'forecasting',
    name: 'Forecasting',
    description: 'Predicting future spend',
    icon: '📈',
  },
  {
    id: 'invoicing-chargeback',
    name: 'Invoicing & Chargeback',
    description: 'Internal billing and cost allocation',
    icon: '🧾',
  },
  {
    id: 'planning-estimating',
    name: 'Planning & Estimating',
    description: 'What-if analysis and cost planning',
    icon: '📋',
  },
  {
    id: 'policy-governance',
    name: 'Policy & Governance',
    description: 'Compliance and policy enforcement',
    icon: '📜',
  },
  {
    id: 'rate-optimization',
    name: 'Rate Optimization',
    description: 'Managing discounts and commitments',
    icon: '💎',
  },
  {
    id: 'reporting-analytics',
    name: 'Reporting & Analytics',
    description: 'General reporting and analysis',
    icon: '📊',
  },
  {
    id: 'unit-economics',
    name: 'Unit Economics',
    description: 'Margin and unit cost analysis',
    icon: '🔢',
  },
  {
    id: 'workload-optimization',
    name: 'Workload Optimization',
    description: 'Resource and workload optimization',
    icon: '⚡',
  },
];

// ============================================================================
// Query Library - 59 FOCUS Use Cases
// ============================================================================

export const FOCUS_QUERIES: FocusQuery[] = [
  // =========================================================================
  // ALLOCATION (12 Use Cases)
  // =========================================================================
  {
    id: 'allocate-multi-currency-charges',
    name: 'Allocate multi-currency charges per application',
    description: 'Analyze costs by application tag across different billing currencies. Returns total billed cost per application grouped by billing currency.',
    category: 'allocation',
    sql: `SELECT 
  Tags->>'$.Application' AS Application,
  BillingCurrency,
  SUM(BilledCost) AS TotalBilledCost
FROM {{TABLE}}
WHERE ChargePeriodStart >= '{{START_DATE}}' 
  AND ChargePeriodEnd < '{{END_DATE}}'
GROUP BY Tags->>'$.Application', BillingCurrency
ORDER BY TotalBilledCost DESC`,
    requiredColumns: ['Tags', 'BillingCurrency', 'BilledCost', 'ChargePeriodStart', 'ChargePeriodEnd'],
    minFocusVersion: '1.0',
    hasDateFilter: true,
    dateFilterType: 'charge',
  },
  {
    id: 'analyze-cost-by-entities',
    name: 'Analyze cost by participating entities',
    description: 'Break down costs by billing account and sub-account hierarchy. Shows cost distribution across organizational entities.',
    category: 'allocation',
    sql: `SELECT 
  BillingAccountId,
  BillingAccountName,
  SubAccountId,
  SubAccountName,
  SUM(BilledCost) AS TotalBilledCost
FROM {{TABLE}}
WHERE ChargePeriodStart >= '{{START_DATE}}' 
  AND ChargePeriodEnd < '{{END_DATE}}'
GROUP BY BillingAccountId, BillingAccountName, SubAccountId, SubAccountName
ORDER BY TotalBilledCost DESC`,
    requiredColumns: ['BillingAccountId', 'BillingAccountName', 'SubAccountId', 'SubAccountName', 'BilledCost', 'ChargePeriodStart', 'ChargePeriodEnd'],
    minFocusVersion: '1.0',
    hasDateFilter: true,
    dateFilterType: 'charge',
  },
  {
    id: 'analyze-effective-cost-by-pricing-currency',
    name: 'Analyze effective cost by pricing currency',
    description: 'View effective costs grouped by pricing currency. Helps understand cost distribution across different pricing currencies.',
    category: 'allocation',
    sql: `SELECT 
  PricingCurrency,
  SUM(EffectiveCost) AS TotalEffectiveCost,
  SUM(ListCost) AS TotalListCost,
  SUM(BilledCost) AS TotalBilledCost
FROM {{TABLE}}
WHERE ChargePeriodStart >= '{{START_DATE}}' 
  AND ChargePeriodEnd < '{{END_DATE}}'
GROUP BY PricingCurrency
ORDER BY TotalEffectiveCost DESC`,
    requiredColumns: ['PricingCurrency', 'EffectiveCost', 'ListCost', 'BilledCost', 'ChargePeriodStart', 'ChargePeriodEnd'],
    minFocusVersion: '1.0',
    hasDateFilter: true,
    dateFilterType: 'charge',
  },
  {
    id: 'analyze-purchase-virtual-currency',
    name: 'Analyze purchase of virtual currency (credits)',
    description: 'Track purchases of prepaid credits or virtual currency by SKU. Filters for Purchase charge category.',
    category: 'allocation',
    sql: `SELECT 
  SkuId,
  SkuPriceId,
  ServiceName,
  ServiceCategory,
  SUM(BilledCost) AS TotalPurchaseCost
FROM {{TABLE}}
WHERE ChargeCategory = 'Purchase'
  AND ChargePeriodStart >= '{{START_DATE}}' 
  AND ChargePeriodEnd < '{{END_DATE}}'
GROUP BY SkuId, SkuPriceId, ServiceName, ServiceCategory
ORDER BY TotalPurchaseCost DESC`,
    requiredColumns: ['SkuId', 'SkuPriceId', 'ServiceName', 'ServiceCategory', 'BilledCost', 'ChargeCategory', 'ChargePeriodStart', 'ChargePeriodEnd'],
    minFocusVersion: '1.0',
    hasDateFilter: true,
    dateFilterType: 'charge',
  },
  {
    id: 'analyze-tag-coverage',
    name: 'Analyze tag coverage',
    description: 'Determine what percentage of costs are properly tagged. Shows tagged vs untagged cost distribution.',
    category: 'allocation',
    sql: `SELECT 
  CASE 
    WHEN Tags IS NULL OR Tags = '{}' OR Tags = '' THEN 'Untagged' 
    ELSE 'Tagged' 
  END AS TagStatus,
  COUNT(*) AS LineItemCount,
  SUM(BilledCost) AS TotalBilledCost,
  ROUND(SUM(BilledCost) * 100.0 / SUM(SUM(BilledCost)) OVER (), 2) AS CostPercentage
FROM {{TABLE}}
WHERE ChargePeriodStart >= '{{START_DATE}}' 
  AND ChargePeriodEnd < '{{END_DATE}}'
GROUP BY TagStatus
ORDER BY TotalBilledCost DESC`,
    requiredColumns: ['Tags', 'BilledCost', 'ChargePeriodStart', 'ChargePeriodEnd'],
    minFocusVersion: '1.0',
    hasDateFilter: true,
    dateFilterType: 'charge',
  },
  {
    id: 'analyze-total-cost-by-resource',
    name: 'Analyze total cost by allocated resource',
    description: 'View costs broken down by individual resource. Shows top 100 resources by cost.',
    category: 'allocation',
    sql: `SELECT 
  ResourceId,
  ResourceName,
  ServiceName,
  ServiceCategory,
  SUM(BilledCost) AS TotalBilledCost,
  SUM(EffectiveCost) AS TotalEffectiveCost
FROM {{TABLE}}
WHERE ChargePeriodStart >= '{{START_DATE}}' 
  AND ChargePeriodEnd < '{{END_DATE}}'
  AND ResourceId IS NOT NULL 
  AND ResourceId != ''
GROUP BY ResourceId, ResourceName, ServiceName, ServiceCategory
ORDER BY TotalBilledCost DESC
LIMIT 100`,
    requiredColumns: ['ResourceId', 'ResourceName', 'ServiceName', 'ServiceCategory', 'BilledCost', 'EffectiveCost', 'ChargePeriodStart', 'ChargePeriodEnd'],
    minFocusVersion: '1.0',
    hasDateFilter: true,
    dateFilterType: 'charge',
  },
  {
    id: 'determine-virtual-currency-usage-target',
    name: 'Determine target of virtual currency usage',
    description: 'Identify which services and resources consume prepaid credits. Filters for Usage charge category.',
    category: 'allocation',
    sql: `SELECT 
  ServiceName,
  ServiceCategory,
  ResourceId,
  ResourceName,
  SUM(BilledCost) AS TotalUsageCost,
  SUM(EffectiveCost) AS TotalEffectiveCost
FROM {{TABLE}}
WHERE ChargeCategory = 'Usage'
  AND ChargePeriodStart >= '{{START_DATE}}' 
  AND ChargePeriodEnd < '{{END_DATE}}'
GROUP BY ServiceName, ServiceCategory, ResourceId, ResourceName
ORDER BY TotalUsageCost DESC
LIMIT 100`,
    requiredColumns: ['ServiceName', 'ServiceCategory', 'ResourceId', 'ResourceName', 'BilledCost', 'EffectiveCost', 'ChargeCategory', 'ChargePeriodStart', 'ChargePeriodEnd'],
    minFocusVersion: '1.0',
    hasDateFilter: true,
    dateFilterType: 'charge',
  },
  {
    id: 'identify-shared-cost-resources',
    name: 'Identify resources with shared cost allocation',
    description: 'Find resources that have cost allocation tags for chargeback/showback purposes.',
    category: 'allocation',
    sql: `SELECT 
  ResourceId,
  ResourceName,
  ServiceName,
  Tags,
  SUM(BilledCost) AS TotalBilledCost,
  SUM(EffectiveCost) AS TotalEffectiveCost
FROM {{TABLE}}
WHERE ChargePeriodStart >= '{{START_DATE}}' 
  AND ChargePeriodEnd < '{{END_DATE}}'
  AND Tags IS NOT NULL 
  AND Tags != '{}'
  AND Tags != ''
GROUP BY ResourceId, ResourceName, ServiceName, Tags
ORDER BY TotalBilledCost DESC
LIMIT 100`,
    requiredColumns: ['ResourceId', 'ResourceName', 'ServiceName', 'Tags', 'BilledCost', 'EffectiveCost', 'ChargePeriodStart', 'ChargePeriodEnd'],
    minFocusVersion: '1.0',
    hasDateFilter: true,
    dateFilterType: 'charge',
  },
  {
    id: 'identify-billed-cost-sources',
    name: 'Identify sources of billed cost by service',
    description: 'Break down costs by service and service category. Shows cost contribution by each cloud service.',
    category: 'allocation',
    sql: `SELECT 
  ServiceCategory,
  ServiceName,
  ChargeCategory,
  PricingCategory,
  SUM(BilledCost) AS TotalBilledCost,
  SUM(EffectiveCost) AS TotalEffectiveCost,
  SUM(ListCost) AS TotalListCost
FROM {{TABLE}}
WHERE ChargePeriodStart >= '{{START_DATE}}' 
  AND ChargePeriodEnd < '{{END_DATE}}'
GROUP BY ServiceCategory, ServiceName, ChargeCategory, PricingCategory
ORDER BY TotalBilledCost DESC`,
    requiredColumns: ['ServiceCategory', 'ServiceName', 'ChargeCategory', 'PricingCategory', 'BilledCost', 'EffectiveCost', 'ListCost', 'ChargePeriodStart', 'ChargePeriodEnd'],
    minFocusVersion: '1.0',
    hasDateFilter: true,
    dateFilterType: 'charge',
  },
  {
    id: 'report-corrections-by-subaccount',
    name: 'Report corrections by subaccount',
    description: 'View billing corrections (adjustments) grouped by sub-account. Shows credit and debit adjustments.',
    category: 'allocation',
    sql: `SELECT 
  SubAccountId,
  SubAccountName,
  ChargeCategory,
  SUM(BilledCost) AS TotalCorrectionAmount,
  COUNT(*) AS CorrectionCount
FROM {{TABLE}}
WHERE ChargeCategory = 'Adjustment'
  AND ChargePeriodStart >= '{{START_DATE}}' 
  AND ChargePeriodEnd < '{{END_DATE}}'
GROUP BY SubAccountId, SubAccountName, ChargeCategory
ORDER BY TotalCorrectionAmount DESC`,
    requiredColumns: ['SubAccountId', 'SubAccountName', 'ChargeCategory', 'BilledCost', 'ChargePeriodStart', 'ChargePeriodEnd'],
    minFocusVersion: '1.0',
    hasDateFilter: true,
    dateFilterType: 'charge',
  },
  {
    id: 'analyze-commitment-discounts',
    name: 'Analyze commitment discount coverage',
    description: 'Track commitment-based discounts (reservations, savings plans) and their effective savings.',
    category: 'allocation',
    sql: `SELECT 
  CommitmentDiscountId,
  CommitmentDiscountCategory,
  ServiceName,
  SUM(EffectiveCost) AS TotalEffectiveCost,
  SUM(ListCost) AS TotalListCost,
  SUM(ListCost) - SUM(EffectiveCost) AS TotalSavings,
  ROUND((SUM(ListCost) - SUM(EffectiveCost)) * 100.0 / NULLIF(SUM(ListCost), 0), 2) AS SavingsPercentage
FROM {{TABLE}}
WHERE ChargePeriodStart >= '{{START_DATE}}' 
  AND ChargePeriodEnd < '{{END_DATE}}'
  AND CommitmentDiscountId IS NOT NULL
  AND CommitmentDiscountId != ''
GROUP BY CommitmentDiscountId, CommitmentDiscountCategory, ServiceName
ORDER BY TotalSavings DESC`,
    requiredColumns: ['CommitmentDiscountId', 'CommitmentDiscountCategory', 'ServiceName', 'EffectiveCost', 'ListCost', 'ChargePeriodStart', 'ChargePeriodEnd'],
    minFocusVersion: '1.0',
    hasDateFilter: true,
    dateFilterType: 'charge',
  },
  {
    id: 'analyze-pricing-categories',
    name: 'Analyze costs by pricing category',
    description: 'Break down costs by pricing category (On-Demand, Spot, Committed, etc.) to understand pricing mix.',
    category: 'allocation',
    sql: `SELECT 
  PricingCategory,
  ServiceCategory,
  ServiceName,
  SUM(BilledCost) AS TotalBilledCost,
  SUM(EffectiveCost) AS TotalEffectiveCost,
  SUM(ListCost) AS TotalListCost,
  COUNT(DISTINCT ResourceId) AS UniqueResources
FROM {{TABLE}}
WHERE ChargePeriodStart >= '{{START_DATE}}' 
  AND ChargePeriodEnd < '{{END_DATE}}'
GROUP BY PricingCategory, ServiceCategory, ServiceName
ORDER BY TotalBilledCost DESC`,
    requiredColumns: ['PricingCategory', 'ServiceCategory', 'ServiceName', 'BilledCost', 'EffectiveCost', 'ListCost', 'ResourceId', 'ChargePeriodStart', 'ChargePeriodEnd'],
    minFocusVersion: '1.0',
    hasDateFilter: true,
    dateFilterType: 'charge',
  },

  // =========================================================================
  // ANOMALY MANAGEMENT (7 Use Cases)
  // =========================================================================
  {
    id: 'analyze-costs-by-service-name',
    name: 'Analyze costs by service name',
    description: 'View effective and billed costs by service',
    category: 'anomaly-management',
    sql: `SELECT 
  ServiceName,
  SUM(EffectiveCost) AS TotalEffectiveCost,
  SUM(BilledCost) AS TotalBilledCost,
  SUM(BilledCost) - SUM(EffectiveCost) AS Savings
FROM {{TABLE}}
WHERE ChargePeriodStart >= '{{START_DATE}}' AND ChargePeriodEnd < '{{END_DATE}}'
GROUP BY ServiceName
ORDER BY TotalBilledCost DESC`,
    requiredColumns: ['ServiceName', 'EffectiveCost', 'BilledCost', 'ChargePeriodStart', 'ChargePeriodEnd'],
    minFocusVersion: '1.0',
    hasDateFilter: true,
    dateFilterType: 'charge',
  },
  {
    id: 'analyze-service-costs-by-region',
    name: 'Analyze service costs by region',
    description: 'Break down service costs by geographic region',
    category: 'anomaly-management',
    sql: `SELECT 
  ServiceName,
  RegionName,
  SUM(BilledCost) AS TotalBilledCost
FROM {{TABLE}}
WHERE ChargePeriodStart >= '{{START_DATE}}' AND ChargePeriodEnd < '{{END_DATE}}'
GROUP BY ServiceName, RegionName
ORDER BY TotalBilledCost DESC`,
    requiredColumns: ['ServiceName', 'RegionName', 'BilledCost', 'ChargePeriodStart', 'ChargePeriodEnd'],
    minFocusVersion: '1.0',
    hasDateFilter: true,
    dateFilterType: 'charge',
  },
  {
    id: 'compare-resource-usage-mom',
    name: 'Compare resource usage month over month',
    description: 'Track resource consumption trends over time',
    category: 'anomaly-management',
    sql: `SELECT 
  ResourceId,
  ResourceName,
  DATE_TRUNC('month', ChargePeriodStart) AS Month,
  SUM(ConsumedQuantity) AS TotalConsumedQuantity,
  SUM(BilledCost) AS TotalBilledCost
FROM {{TABLE}}
WHERE ChargePeriodStart >= '{{START_DATE}}' AND ChargePeriodEnd < '{{END_DATE}}'
  AND ResourceId IS NOT NULL
GROUP BY ResourceId, ResourceName, DATE_TRUNC('month', ChargePeriodStart)
ORDER BY ResourceId, Month`,
    requiredColumns: ['ResourceId', 'ResourceName', 'ChargePeriodStart', 'ConsumedQuantity', 'BilledCost'],
    minFocusVersion: '1.0',
    hasDateFilter: true,
    dateFilterType: 'charge',
  },
  {
    id: 'identify-anomalous-spending-subaccount',
    name: 'Identify anomalous daily spending by subaccount',
    description: 'Track daily spend to detect cost anomalies',
    category: 'anomaly-management',
    sql: `SELECT 
  DATE_TRUNC('day', ChargePeriodStart) AS Day,
  SubAccountId,
  SubAccountName,
  SUM(EffectiveCost) AS DailyEffectiveCost
FROM {{TABLE}}
WHERE ChargePeriodStart >= '{{START_DATE}}' AND ChargePeriodEnd < '{{END_DATE}}'
GROUP BY DATE_TRUNC('day', ChargePeriodStart), SubAccountId, SubAccountName
ORDER BY Day, DailyEffectiveCost DESC`,
    requiredColumns: ['ChargePeriodStart', 'SubAccountId', 'SubAccountName', 'EffectiveCost'],
    minFocusVersion: '1.0',
    hasDateFilter: true,
    dateFilterType: 'charge',
  },
  {
    id: 'identify-anomalous-spending-subaccount-region',
    name: 'Identify anomalous daily spending by subaccount and region',
    description: 'Track daily spend by subaccount and region for anomaly detection',
    category: 'anomaly-management',
    sql: `SELECT 
  DATE_TRUNC('day', ChargePeriodStart) AS Day,
  SubAccountId,
  RegionName,
  SUM(BilledCost) AS DailyBilledCost
FROM {{TABLE}}
WHERE ChargePeriodStart >= '{{START_DATE}}' AND ChargePeriodEnd < '{{END_DATE}}'
GROUP BY DATE_TRUNC('day', ChargePeriodStart), SubAccountId, RegionName
ORDER BY Day, DailyBilledCost DESC`,
    requiredColumns: ['ChargePeriodStart', 'SubAccountId', 'RegionName', 'BilledCost'],
    minFocusVersion: '1.0',
    hasDateFilter: true,
    dateFilterType: 'charge',
  },
  {
    id: 'identify-anomalous-spending-full',
    name: 'Identify anomalous daily spending (Subaccount/Region/Service)',
    description: 'Comprehensive daily spend tracking for anomaly detection',
    category: 'anomaly-management',
    sql: `SELECT 
  DATE_TRUNC('day', ChargePeriodStart) AS Day,
  SubAccountId,
  RegionName,
  ServiceName,
  SUM(BilledCost) AS DailyBilledCost
FROM {{TABLE}}
WHERE ChargePeriodStart >= '{{START_DATE}}' AND ChargePeriodEnd < '{{END_DATE}}'
GROUP BY DATE_TRUNC('day', ChargePeriodStart), SubAccountId, RegionName, ServiceName
ORDER BY Day, DailyBilledCost DESC`,
    requiredColumns: ['ChargePeriodStart', 'SubAccountId', 'RegionName', 'ServiceName', 'BilledCost'],
    minFocusVersion: '1.0',
    hasDateFilter: true,
    dateFilterType: 'charge',
  },
  {
    id: 'identify-unused-capacity-reservations',
    name: 'Identify unused capacity reservations',
    description: 'Find compute reservations with zero usage',
    category: 'anomaly-management',
    sql: `SELECT 
  SkuId,
  ServiceName,
  SUM(EffectiveCost) AS WastedCost
FROM {{TABLE}}
WHERE ServiceCategory = 'Compute'
  AND (ConsumedQuantity = 0 OR ConsumedQuantity IS NULL)
  AND ChargePeriodStart >= '{{START_DATE}}' AND ChargePeriodEnd < '{{END_DATE}}'
GROUP BY SkuId, ServiceName
ORDER BY WastedCost DESC`,
    requiredColumns: ['SkuId', 'ServiceName', 'ServiceCategory', 'ConsumedQuantity', 'EffectiveCost', 'ChargePeriodStart', 'ChargePeriodEnd'],
    minFocusVersion: '1.0',
    hasDateFilter: true,
    dateFilterType: 'charge',
  },

  // =========================================================================
  // BUDGETING (5 Use Cases)
  // =========================================================================
  {
    id: 'calculate-virtual-currency-consumption',
    name: 'Calculate consumption of virtual currency',
    description: 'Track credit/virtual currency usage within a billing period',
    category: 'budgeting',
    sql: `SELECT 
  PricingUnit,
  SUM(ConsumedQuantity) AS TotalConsumed,
  SUM(BilledCost) AS TotalCost
FROM {{TABLE}}
WHERE BillingPeriodStart < '{{END_DATE}}' AND BillingPeriodEnd > '{{START_DATE}}'
GROUP BY PricingUnit
ORDER BY TotalCost DESC`,
    requiredColumns: ['PricingUnit', 'ConsumedQuantity', 'BilledCost', 'BillingPeriodStart', 'BillingPeriodEnd'],
    minFocusVersion: '1.0',
    hasDateFilter: true,
    dateFilterType: 'billing',
  },
  {
    id: 'compare-billed-cost-to-budget',
    name: 'Compare billed cost per subaccount to budget',
    description: 'View costs by subaccount for budget comparison against billing periods',
    category: 'budgeting',
    sql: `SELECT 
  SubAccountId,
  SubAccountName,
  SUM(BilledCost) AS TotalBilledCost
FROM {{TABLE}}
WHERE BillingPeriodStart < '{{END_DATE}}' AND BillingPeriodEnd > '{{START_DATE}}'
GROUP BY SubAccountId, SubAccountName
ORDER BY TotalBilledCost DESC`,
    requiredColumns: ['SubAccountId', 'SubAccountName', 'BilledCost', 'BillingPeriodStart', 'BillingPeriodEnd'],
    minFocusVersion: '1.0',
    hasDateFilter: true,
    dateFilterType: 'billing',
  },
  {
    id: 'track-commitment-burndown',
    name: 'Track contract commitment burn-down over time',
    description: 'Monitor commitment discount usage over time (uses ChargePeriod for actual usage tracking)',
    category: 'budgeting',
    sql: `SELECT 
  CommitmentDiscountId,
  DATE_TRUNC('day', ChargePeriodStart) AS Day,
  SUM(EffectiveCost) AS DailyEffectiveCost
FROM {{TABLE}}
WHERE CommitmentDiscountId IS NOT NULL
  AND ChargePeriodStart >= '{{START_DATE}}' AND ChargePeriodEnd < '{{END_DATE}}'
GROUP BY CommitmentDiscountId, DATE_TRUNC('day', ChargePeriodStart)
ORDER BY CommitmentDiscountId, Day`,
    requiredColumns: ['CommitmentDiscountId', 'ChargePeriodStart', 'ChargePeriodEnd', 'EffectiveCost'],
    minFocusVersion: '1.0',
    hasDateFilter: true,
    dateFilterType: 'charge',
  },
  {
    id: 'update-budgets-by-application',
    name: 'Update budgets for each application',
    description: 'Get costs by application tag for budget updates aligned to billing periods',
    category: 'budgeting',
    sql: `SELECT 
  Tags->>'$.Application' AS Application,
  SUM(BilledCost) AS TotalBilledCost
FROM {{TABLE}}
WHERE BillingPeriodStart < '{{END_DATE}}' AND BillingPeriodEnd > '{{START_DATE}}'
GROUP BY Tags->>'$.Application'
ORDER BY TotalBilledCost DESC`,
    requiredColumns: ['Tags', 'BilledCost', 'BillingPeriodStart', 'BillingPeriodEnd'],
    minFocusVersion: '1.0',
    hasDateFilter: true,
    dateFilterType: 'billing',
  },
  {
    id: 'update-budgets-with-billed-costs',
    name: 'Update budgets with billed costs',
    description: 'Get total costs by billing account for budget tracking aligned to billing periods',
    category: 'budgeting',
    sql: `SELECT 
  BillingAccountId,
  BillingAccountName,
  SUM(BilledCost) AS TotalBilledCost
FROM {{TABLE}}
WHERE BillingPeriodStart < '{{END_DATE}}' AND BillingPeriodEnd > '{{START_DATE}}'
GROUP BY BillingAccountId, BillingAccountName
ORDER BY TotalBilledCost DESC`,
    requiredColumns: ['BillingAccountId', 'BillingAccountName', 'BilledCost', 'BillingPeriodStart', 'BillingPeriodEnd'],
    minFocusVersion: '1.0',
    hasDateFilter: true,
    dateFilterType: 'billing',
  },

  // =========================================================================
  // DATA INGESTION (3 Use Cases)
  // =========================================================================
  {
    id: 'verify-service-provider-invoices',
    name: 'Verify accuracy of service provider invoices',
    description: 'Cross-check costs against provider invoices aligned to billing periods',
    category: 'data-ingestion',
    sql: `SELECT 
  ProviderName,
  BillingPeriodStart,
  SUM(BilledCost) AS TotalBilledCost,
  COUNT(*) AS LineItemCount
FROM {{TABLE}}
WHERE BillingPeriodStart < '{{END_DATE}}' AND BillingPeriodEnd > '{{START_DATE}}'
GROUP BY ProviderName, BillingPeriodStart
ORDER BY BillingPeriodStart DESC, TotalBilledCost DESC`,
    requiredColumns: ['ProviderName', 'BillingPeriodStart', 'BillingPeriodEnd', 'BilledCost'],
    minFocusVersion: '1.0',
    hasDateFilter: true,
    dateFilterType: 'billing',
  },
  {
    id: 'verify-services-charges-across-providers',
    name: 'Verify accuracy of services charges across providers',
    description: 'Compare service costs across different providers',
    category: 'data-ingestion',
    sql: `SELECT 
  ServiceName,
  ProviderName,
  SUM(BilledCost) AS TotalBilledCost
FROM {{TABLE}}
WHERE ChargePeriodStart >= '{{START_DATE}}' AND ChargePeriodEnd < '{{END_DATE}}'
GROUP BY ServiceName, ProviderName
ORDER BY ServiceName, TotalBilledCost DESC`,
    requiredColumns: ['ServiceName', 'ProviderName', 'BilledCost', 'ChargePeriodStart', 'ChargePeriodEnd'],
    minFocusVersion: '1.0',
    hasDateFilter: true,
    dateFilterType: 'charge',
  },
  {
    id: 'verify-discount-accuracy',
    name: 'Verify discount accuracy (corrections excluded)',
    description: 'Calculate total discounts excluding corrections',
    category: 'data-ingestion',
    sql: `SELECT 
  SUM(ListCost) AS TotalListCost,
  SUM(ContractedCost) AS TotalContractedCost,
  SUM(ListCost) - SUM(ContractedCost) AS TotalDiscount,
  ROUND((SUM(ListCost) - SUM(ContractedCost)) * 100.0 / NULLIF(SUM(ListCost), 0), 2) AS DiscountPercentage
FROM {{TABLE}}
WHERE (ChargeClass IS NULL OR ChargeClass != 'Correction')
  AND ChargePeriodStart >= '{{START_DATE}}' AND ChargePeriodEnd < '{{END_DATE}}'`,
    requiredColumns: ['ListCost', 'ContractedCost', 'ChargeClass', 'ChargePeriodStart', 'ChargePeriodEnd'],
    minFocusVersion: '1.1',
    hasDateFilter: true,
    dateFilterType: 'charge',
  },

  // =========================================================================
  // FORECASTING (4 Use Cases)
  // =========================================================================
  {
    id: 'calculate-average-rate',
    name: 'Calculate average rate of a component resource',
    description: 'Compute effective rate per unit for resources',
    category: 'forecasting',
    sql: `SELECT 
  ResourceId,
  ResourceName,
  SUM(EffectiveCost) AS TotalCost,
  SUM(ConsumedQuantity) AS TotalQuantity,
  ROUND(SUM(EffectiveCost) / NULLIF(SUM(ConsumedQuantity), 0), 4) AS AverageRate
FROM {{TABLE}}
WHERE ConsumedQuantity > 0
  AND ChargePeriodStart >= '{{START_DATE}}' AND ChargePeriodEnd < '{{END_DATE}}'
GROUP BY ResourceId, ResourceName
ORDER BY TotalCost DESC
LIMIT 100`,
    requiredColumns: ['ResourceId', 'ResourceName', 'EffectiveCost', 'ConsumedQuantity', 'ChargePeriodStart', 'ChargePeriodEnd'],
    minFocusVersion: '1.0',
    hasDateFilter: true,
    dateFilterType: 'charge',
  },
  {
    id: 'forecast-amortized-costs-mom',
    name: 'Forecast amortized costs month over month',
    description: 'View monthly effective cost trends for forecasting',
    category: 'forecasting',
    sql: `SELECT 
  DATE_TRUNC('month', ChargePeriodStart) AS Month,
  SUM(EffectiveCost) AS MonthlyEffectiveCost
FROM {{TABLE}}
WHERE ChargePeriodStart >= '{{START_DATE}}' AND ChargePeriodEnd < '{{END_DATE}}'
GROUP BY DATE_TRUNC('month', ChargePeriodStart)
ORDER BY Month`,
    requiredColumns: ['ChargePeriodStart', 'EffectiveCost'],
    minFocusVersion: '1.0',
    hasDateFilter: true,
    dateFilterType: 'charge',
  },
  {
    id: 'forecast-cashflow-by-service',
    name: 'Forecast cashflow month over month by service',
    description: 'Track monthly billed costs by service for cash planning',
    category: 'forecasting',
    sql: `SELECT 
  ServiceName,
  DATE_TRUNC('month', ChargePeriodStart) AS Month,
  SUM(BilledCost) AS MonthlyBilledCost
FROM {{TABLE}}
WHERE ChargePeriodStart >= '{{START_DATE}}' AND ChargePeriodEnd < '{{END_DATE}}'
GROUP BY ServiceName, DATE_TRUNC('month', ChargePeriodStart)
ORDER BY ServiceName, Month`,
    requiredColumns: ['ServiceName', 'ChargePeriodStart', 'BilledCost'],
    minFocusVersion: '1.0',
    hasDateFilter: true,
    dateFilterType: 'charge',
  },
  {
    id: 'get-historical-usage-rates',
    name: 'Get historical usage and rates',
    description: 'Extract historical data for forecasting models',
    category: 'forecasting',
    sql: `SELECT 
  SkuId,
  DATE_TRUNC('day', ChargePeriodStart) AS Day,
  SUM(ConsumedQuantity) AS DailyQuantity,
  SUM(EffectiveCost) AS DailyCost,
  ROUND(SUM(EffectiveCost) / NULLIF(SUM(ConsumedQuantity), 0), 4) AS UnitRate
FROM {{TABLE}}
WHERE ChargePeriodStart >= '{{START_DATE}}' AND ChargePeriodEnd < '{{END_DATE}}'
GROUP BY SkuId, DATE_TRUNC('day', ChargePeriodStart)
ORDER BY Day DESC, DailyCost DESC
LIMIT 1000`,
    requiredColumns: ['SkuId', 'ChargePeriodStart', 'ConsumedQuantity', 'EffectiveCost'],
    minFocusVersion: '1.0',
    hasDateFilter: true,
    dateFilterType: 'charge',
  },

  // =========================================================================
  // INVOICING & CHARGEBACK (1 Use Case)
  // =========================================================================
  {
    id: 'understand-billing-entities',
    name: 'Understand the billing account or sub account entity',
    description: 'Get a complete picture of billing hierarchy. Uses BillingPeriod for invoice alignment.',
    category: 'invoicing-chargeback',
    sql: `SELECT DISTINCT
  BillingAccountId,
  BillingAccountName,
  SubAccountId,
  SubAccountName
FROM {{TABLE}}
WHERE BillingPeriodStart < '{{END_DATE}}' AND BillingPeriodEnd > '{{START_DATE}}'
ORDER BY BillingAccountName, SubAccountName`,
    requiredColumns: ['BillingAccountId', 'BillingAccountName', 'SubAccountId', 'SubAccountName', 'BillingPeriodStart', 'BillingPeriodEnd'],
    minFocusVersion: '1.0',
    hasDateFilter: true,
    dateFilterType: 'billing',
  },

  // =========================================================================
  // PLANNING & ESTIMATING (4 Use Cases)
  // =========================================================================
  {
    id: 'determine-contracted-savings',
    name: 'Determine contracted savings by virtual currency',
    description: 'Calculate savings from contracted pricing',
    category: 'planning-estimating',
    sql: `SELECT 
  PricingUnit,
  SUM(ListCost) AS TotalListCost,
  SUM(ContractedCost) AS TotalContractedCost,
  SUM(ListCost) - SUM(ContractedCost) AS TotalSavings
FROM {{TABLE}}
WHERE ChargePeriodStart >= '{{START_DATE}}' AND ChargePeriodEnd < '{{END_DATE}}'
GROUP BY PricingUnit
ORDER BY TotalSavings DESC`,
    requiredColumns: ['PricingUnit', 'ListCost', 'ContractedCost', 'ChargePeriodStart', 'ChargePeriodEnd'],
    minFocusVersion: '1.1',
    hasDateFilter: true,
    dateFilterType: 'charge',
  },
  {
    id: 'join-commitment-details',
    name: 'Join contract commitment details with usage',
    description: 'Link commitment discounts with actual usage',
    category: 'planning-estimating',
    sql: `SELECT 
  CommitmentDiscountId,
  CommitmentDiscountName,
  SUM(BilledCost) AS TotalBilledCost,
  SUM(EffectiveCost) AS TotalEffectiveCost
FROM {{TABLE}}
WHERE CommitmentDiscountId IS NOT NULL
  AND ChargePeriodStart >= '{{START_DATE}}' AND ChargePeriodEnd < '{{END_DATE}}'
GROUP BY CommitmentDiscountId, CommitmentDiscountName
ORDER BY TotalBilledCost DESC`,
    requiredColumns: ['CommitmentDiscountId', 'CommitmentDiscountName', 'BilledCost', 'EffectiveCost', 'ChargePeriodStart', 'ChargePeriodEnd'],
    minFocusVersion: '1.0',
    hasDateFilter: true,
    dateFilterType: 'charge',
  },
  {
    id: 'quantify-resource-usage',
    name: 'Quantify usage of a component resource',
    description: 'Get total consumption quantity by resource',
    category: 'planning-estimating',
    sql: `SELECT 
  ResourceId,
  ResourceName,
  PricingUnit,
  SUM(ConsumedQuantity) AS TotalConsumed
FROM {{TABLE}}
WHERE ChargePeriodStart >= '{{START_DATE}}' AND ChargePeriodEnd < '{{END_DATE}}'
  AND ResourceId IS NOT NULL
GROUP BY ResourceId, ResourceName, PricingUnit
ORDER BY TotalConsumed DESC
LIMIT 100`,
    requiredColumns: ['ResourceId', 'ResourceName', 'PricingUnit', 'ConsumedQuantity', 'ChargePeriodStart', 'ChargePeriodEnd'],
    minFocusVersion: '1.0',
    hasDateFilter: true,
    dateFilterType: 'charge',
  },
  {
    id: 'report-effective-cost-compute',
    name: 'Report effective cost of compute',
    description: 'Get total effective cost for compute services',
    category: 'planning-estimating',
    sql: `SELECT 
  ServiceName,
  SUM(EffectiveCost) AS TotalEffectiveCost,
  SUM(BilledCost) AS TotalBilledCost
FROM {{TABLE}}
WHERE ServiceCategory = 'Compute'
  AND ChargePeriodStart >= '{{START_DATE}}' AND ChargePeriodEnd < '{{END_DATE}}'
GROUP BY ServiceName
ORDER BY TotalEffectiveCost DESC`,
    requiredColumns: ['ServiceName', 'ServiceCategory', 'EffectiveCost', 'BilledCost', 'ChargePeriodStart', 'ChargePeriodEnd'],
    minFocusVersion: '1.0',
    hasDateFilter: true,
    dateFilterType: 'charge',
  },

  // =========================================================================
  // POLICY & GOVERNANCE (1 Use Case)
  // =========================================================================
  {
    id: 'report-subaccounts-by-region',
    name: 'Report subaccounts by region',
    description: 'View which subaccounts are deployed in which regions',
    category: 'policy-governance',
    sql: `SELECT DISTINCT
  SubAccountId,
  SubAccountName,
  RegionName
FROM {{TABLE}}
WHERE ChargePeriodStart >= '{{START_DATE}}' AND ChargePeriodEnd < '{{END_DATE}}'
ORDER BY SubAccountName, RegionName`,
    requiredColumns: ['SubAccountId', 'SubAccountName', 'RegionName', 'ChargePeriodStart', 'ChargePeriodEnd'],
    minFocusVersion: '1.0',
    hasDateFilter: true,
    dateFilterType: 'charge',
  },

  // =========================================================================
  // RATE OPTIMIZATION (2 Use Cases)
  // =========================================================================
  {
    id: 'identify-unused-commitments',
    name: 'Identify unused commitments',
    description: 'Find commitment discounts with unused capacity',
    category: 'rate-optimization',
    sql: `SELECT 
  CommitmentDiscountId,
  CommitmentDiscountName,
  CommitmentDiscountStatus,
  SUM(EffectiveCost) AS TotalEffectiveCost
FROM {{TABLE}}
WHERE CommitmentDiscountStatus = 'Unused'
  AND ChargePeriodStart >= '{{START_DATE}}' AND ChargePeriodEnd < '{{END_DATE}}'
GROUP BY CommitmentDiscountId, CommitmentDiscountName, CommitmentDiscountStatus
ORDER BY TotalEffectiveCost DESC`,
    requiredColumns: ['CommitmentDiscountId', 'CommitmentDiscountName', 'CommitmentDiscountStatus', 'EffectiveCost', 'ChargePeriodStart', 'ChargePeriodEnd'],
    minFocusVersion: '1.0',
    hasDateFilter: true,
    dateFilterType: 'charge',
  },
  {
    id: 'report-commitment-purchases',
    name: 'Report commitment discount purchases',
    description: 'View all commitment/reservation purchases',
    category: 'rate-optimization',
    sql: `SELECT 
  SkuId,
  ServiceName,
  SUM(BilledCost) AS TotalPurchaseCost
FROM {{TABLE}}
WHERE ChargeCategory = 'Purchase'
  AND ChargePeriodStart >= '{{START_DATE}}' AND ChargePeriodEnd < '{{END_DATE}}'
GROUP BY SkuId, ServiceName
ORDER BY TotalPurchaseCost DESC`,
    requiredColumns: ['SkuId', 'ServiceName', 'ChargeCategory', 'BilledCost', 'ChargePeriodStart', 'ChargePeriodEnd'],
    minFocusVersion: '1.0',
    hasDateFilter: true,
    dateFilterType: 'charge',
  },

  // =========================================================================
  // REPORTING & ANALYTICS (16 Use Cases)
  // =========================================================================
  {
    id: 'analyze-capacity-reservations-compute',
    name: 'Analyze capacity reservations on compute costs',
    description: 'View reservation impact on compute spending',
    category: 'reporting-analytics',
    sql: `SELECT 
  SkuId,
  CommitmentDiscountId,
  SUM(EffectiveCost) AS TotalEffectiveCost,
  SUM(BilledCost) AS TotalBilledCost
FROM {{TABLE}}
WHERE ServiceCategory = 'Compute'
  AND CommitmentDiscountId IS NOT NULL
  AND ChargePeriodStart >= '{{START_DATE}}' AND ChargePeriodEnd < '{{END_DATE}}'
GROUP BY SkuId, CommitmentDiscountId
ORDER BY TotalEffectiveCost DESC`,
    requiredColumns: ['SkuId', 'CommitmentDiscountId', 'ServiceCategory', 'EffectiveCost', 'BilledCost', 'ChargePeriodStart', 'ChargePeriodEnd'],
    minFocusVersion: '1.0',
    hasDateFilter: true,
    dateFilterType: 'charge',
  },
  {
    id: 'analyze-marketplace-vendors',
    name: 'Analyze marketplace vendors costs',
    description: 'View costs from third-party marketplace publishers',
    category: 'reporting-analytics',
    sql: `SELECT 
  PublisherName,
  ServiceName,
  SUM(BilledCost) AS TotalBilledCost
FROM {{TABLE}}
WHERE PublisherName IS NOT NULL
  AND ChargePeriodStart >= '{{START_DATE}}' AND ChargePeriodEnd < '{{END_DATE}}'
GROUP BY PublisherName, ServiceName
ORDER BY TotalBilledCost DESC`,
    requiredColumns: ['PublisherName', 'ServiceName', 'BilledCost', 'ChargePeriodStart', 'ChargePeriodEnd'],
    minFocusVersion: '1.0',
    hasDateFilter: true,
    dateFilterType: 'charge',
  },
  {
    id: 'analyze-resource-costs-by-sku',
    name: 'Analyze resource costs by SKU',
    description: 'Break down costs by SKU identifier',
    category: 'reporting-analytics',
    sql: `SELECT 
  SkuId,
  ServiceName,
  SUM(BilledCost) AS TotalBilledCost,
  SUM(ConsumedQuantity) AS TotalQuantity
FROM {{TABLE}}
WHERE ChargePeriodStart >= '{{START_DATE}}' AND ChargePeriodEnd < '{{END_DATE}}'
GROUP BY SkuId, ServiceName
ORDER BY TotalBilledCost DESC
LIMIT 100`,
    requiredColumns: ['SkuId', 'ServiceName', 'BilledCost', 'ConsumedQuantity', 'ChargePeriodStart', 'ChargePeriodEnd'],
    minFocusVersion: '1.0',
    hasDateFilter: true,
    dateFilterType: 'charge',
  },
  {
    id: 'analyze-service-costs-by-subaccount',
    name: 'Analyze service costs by subaccount',
    description: 'View service costs broken down by sub-account',
    category: 'reporting-analytics',
    sql: `SELECT 
  SubAccountId,
  SubAccountName,
  ServiceName,
  SUM(BilledCost) AS TotalBilledCost
FROM {{TABLE}}
WHERE ChargePeriodStart >= '{{START_DATE}}' AND ChargePeriodEnd < '{{END_DATE}}'
GROUP BY SubAccountId, SubAccountName, ServiceName
ORDER BY TotalBilledCost DESC`,
    requiredColumns: ['SubAccountId', 'SubAccountName', 'ServiceName', 'BilledCost', 'ChargePeriodStart', 'ChargePeriodEnd'],
    minFocusVersion: '1.0',
    hasDateFilter: true,
    dateFilterType: 'charge',
  },
  {
    id: 'analyze-service-costs-mom',
    name: 'Analyze service costs month over month',
    description: 'Track service costs over time',
    category: 'reporting-analytics',
    sql: `SELECT 
  ServiceName,
  DATE_TRUNC('month', ChargePeriodStart) AS Month,
  SUM(BilledCost) AS MonthlyBilledCost
FROM {{TABLE}}
WHERE ChargePeriodStart >= '{{START_DATE}}' AND ChargePeriodEnd < '{{END_DATE}}'
GROUP BY ServiceName, DATE_TRUNC('month', ChargePeriodStart)
ORDER BY ServiceName, Month`,
    requiredColumns: ['ServiceName', 'ChargePeriodStart', 'BilledCost'],
    minFocusVersion: '1.0',
    hasDateFilter: true,
    dateFilterType: 'charge',
  },
  {
    id: 'analyze-metered-costs-by-sku',
    name: 'Analyze the different metered costs for a SKU',
    description: 'View pricing unit breakdown for SKUs',
    category: 'reporting-analytics',
    sql: `SELECT 
  SkuId,
  PricingUnit,
  SUM(BilledCost) AS TotalBilledCost,
  SUM(ConsumedQuantity) AS TotalQuantity
FROM {{TABLE}}
WHERE ChargePeriodStart >= '{{START_DATE}}' AND ChargePeriodEnd < '{{END_DATE}}'
GROUP BY SkuId, PricingUnit
ORDER BY TotalBilledCost DESC
LIMIT 100`,
    requiredColumns: ['SkuId', 'PricingUnit', 'BilledCost', 'ConsumedQuantity', 'ChargePeriodStart', 'ChargePeriodEnd'],
    minFocusVersion: '1.0',
    hasDateFilter: true,
    dateFilterType: 'charge',
  },
  {
    id: 'calculate-unit-economics',
    name: 'Calculate unit economics',
    description: 'Compute overall cost per unit consumed',
    category: 'reporting-analytics',
    sql: `SELECT 
  SUM(EffectiveCost) AS TotalCost,
  SUM(ConsumedQuantity) AS TotalQuantity,
  ROUND(SUM(EffectiveCost) / NULLIF(SUM(ConsumedQuantity), 0), 4) AS CostPerUnit
FROM {{TABLE}}
WHERE ConsumedQuantity > 0
  AND ChargePeriodStart >= '{{START_DATE}}' AND ChargePeriodEnd < '{{END_DATE}}'`,
    requiredColumns: ['EffectiveCost', 'ConsumedQuantity', 'ChargePeriodStart', 'ChargePeriodEnd'],
    minFocusVersion: '1.0',
    hasDateFilter: true,
    dateFilterType: 'charge',
  },
  {
    id: 'determine-effective-savings-rate',
    name: 'Determine Effective Savings Rate',
    description: 'Calculate overall savings percentage vs list price',
    category: 'reporting-analytics',
    sql: `SELECT 
  SUM(ListCost) AS TotalListCost,
  SUM(EffectiveCost) AS TotalEffectiveCost,
  ROUND((1 - (SUM(EffectiveCost) / NULLIF(SUM(ListCost), 0))) * 100, 2) AS EffectiveSavingsRate
FROM {{TABLE}}
WHERE ListCost > 0
  AND ChargePeriodStart >= '{{START_DATE}}' AND ChargePeriodEnd < '{{END_DATE}}'`,
    requiredColumns: ['ListCost', 'EffectiveCost', 'ChargePeriodStart', 'ChargePeriodEnd'],
    minFocusVersion: '1.1',
    hasDateFilter: true,
    dateFilterType: 'charge',
  },
  {
    id: 'determine-effective-savings-rate-by-service',
    name: 'Determine Effective Savings Rate by Service',
    description: 'Calculate savings percentage by service',
    category: 'reporting-analytics',
    sql: `SELECT 
  ServiceName,
  SUM(ListCost) AS TotalListCost,
  SUM(EffectiveCost) AS TotalEffectiveCost,
  ROUND((1 - (SUM(EffectiveCost) / NULLIF(SUM(ListCost), 0))) * 100, 2) AS EffectiveSavingsRate
FROM {{TABLE}}
WHERE ListCost > 0
  AND ChargePeriodStart >= '{{START_DATE}}' AND ChargePeriodEnd < '{{END_DATE}}'
GROUP BY ServiceName
ORDER BY EffectiveSavingsRate DESC`,
    requiredColumns: ['ServiceName', 'ListCost', 'EffectiveCost', 'ChargePeriodStart', 'ChargePeriodEnd'],
    minFocusVersion: '1.1',
    hasDateFilter: true,
    dateFilterType: 'charge',
  },
  {
    id: 'report-application-cost-mom',
    name: 'Report application cost month over month',
    description: 'Track costs by application tag over time',
    category: 'reporting-analytics',
    sql: `SELECT 
  Tags->>'$.Application' AS Application,
  DATE_TRUNC('month', ChargePeriodStart) AS Month,
  SUM(BilledCost) AS MonthlyBilledCost
FROM {{TABLE}}
WHERE ChargePeriodStart >= '{{START_DATE}}' AND ChargePeriodEnd < '{{END_DATE}}'
GROUP BY Tags->>'$.Application', DATE_TRUNC('month', ChargePeriodStart)
ORDER BY Application, Month`,
    requiredColumns: ['Tags', 'ChargePeriodStart', 'BilledCost'],
    minFocusVersion: '1.0',
    hasDateFilter: true,
    dateFilterType: 'charge',
  },
  {
    id: 'report-corrections-previous-period',
    name: 'Report corrections for previous billing period',
    description: 'View billing corrections by period',
    category: 'reporting-analytics',
    sql: `SELECT 
  BillingPeriodStart,
  BillingPeriodEnd,
  SUM(BilledCost) AS TotalCorrections,
  COUNT(*) AS CorrectionCount
FROM {{TABLE}}
WHERE ChargeClass = 'Correction'
  AND ChargePeriodStart >= '{{START_DATE}}' AND ChargePeriodEnd < '{{END_DATE}}'
GROUP BY BillingPeriodStart, BillingPeriodEnd
ORDER BY BillingPeriodStart DESC`,
    requiredColumns: ['BillingPeriodStart', 'BillingPeriodEnd', 'ChargeClass', 'BilledCost', 'ChargePeriodStart', 'ChargePeriodEnd'],
    minFocusVersion: '1.0',
    hasDateFilter: true,
    dateFilterType: 'charge',
  },
  {
    id: 'report-costs-by-service-category',
    name: 'Report costs by service category',
    description: 'View costs grouped by high-level service category',
    category: 'reporting-analytics',
    sql: `SELECT 
  ServiceCategory,
  SUM(BilledCost) AS TotalBilledCost,
  COUNT(DISTINCT ServiceName) AS ServiceCount
FROM {{TABLE}}
WHERE ChargePeriodStart >= '{{START_DATE}}' AND ChargePeriodEnd < '{{END_DATE}}'
GROUP BY ServiceCategory
ORDER BY TotalBilledCost DESC`,
    requiredColumns: ['ServiceCategory', 'ServiceName', 'BilledCost', 'ChargePeriodStart', 'ChargePeriodEnd'],
    minFocusVersion: '1.0',
    hasDateFilter: true,
    dateFilterType: 'charge',
  },
  {
    id: 'report-costs-by-category-subcategory',
    name: 'Report costs by service category and subcategory',
    description: 'Detailed breakdown by category hierarchy',
    category: 'reporting-analytics',
    sql: `SELECT 
  ServiceCategory,
  ServiceName,
  SUM(BilledCost) AS TotalBilledCost
FROM {{TABLE}}
WHERE ChargePeriodStart >= '{{START_DATE}}' AND ChargePeriodEnd < '{{END_DATE}}'
GROUP BY ServiceCategory, ServiceName
ORDER BY ServiceCategory, TotalBilledCost DESC`,
    requiredColumns: ['ServiceCategory', 'ServiceName', 'BilledCost', 'ChargePeriodStart', 'ChargePeriodEnd'],
    minFocusVersion: '1.0',
    hasDateFilter: true,
    dateFilterType: 'charge',
  },
  {
    id: 'report-initial-contract-commitments',
    name: 'Report on initial contract commitments',
    description: 'View commitment purchase transactions',
    category: 'reporting-analytics',
    sql: `SELECT 
  SkuId,
  ServiceName,
  CommitmentDiscountId,
  SUM(BilledCost) AS TotalPurchaseCost
FROM {{TABLE}}
WHERE ChargeCategory = 'Purchase'
  AND ChargePeriodStart >= '{{START_DATE}}' AND ChargePeriodEnd < '{{END_DATE}}'
GROUP BY SkuId, ServiceName, CommitmentDiscountId
ORDER BY TotalPurchaseCost DESC`,
    requiredColumns: ['SkuId', 'ServiceName', 'CommitmentDiscountId', 'ChargeCategory', 'BilledCost', 'ChargePeriodStart', 'ChargePeriodEnd'],
    minFocusVersion: '1.0',
    hasDateFilter: true,
    dateFilterType: 'charge',
  },
  {
    id: 'report-service-costs-by-provider-subaccount',
    name: 'Report service costs by providers subaccount',
    description: 'Multi-provider view by subaccount and service',
    category: 'reporting-analytics',
    sql: `SELECT 
  ProviderName,
  SubAccountId,
  SubAccountName,
  ServiceName,
  SUM(BilledCost) AS TotalBilledCost
FROM {{TABLE}}
WHERE ChargePeriodStart >= '{{START_DATE}}' AND ChargePeriodEnd < '{{END_DATE}}'
GROUP BY ProviderName, SubAccountId, SubAccountName, ServiceName
ORDER BY ProviderName, TotalBilledCost DESC`,
    requiredColumns: ['ProviderName', 'SubAccountId', 'SubAccountName', 'ServiceName', 'BilledCost', 'ChargePeriodStart', 'ChargePeriodEnd'],
    minFocusVersion: '1.0',
    hasDateFilter: true,
    dateFilterType: 'charge',
  },
  {
    id: 'report-spending-across-billing-periods',
    name: 'Report spending across billing periods',
    description: 'Track spending by provider and category over billing periods',
    category: 'reporting-analytics',
    sql: `SELECT 
  ProviderName,
  ServiceCategory,
  BillingPeriodStart,
  SUM(BilledCost) AS TotalBilledCost
FROM {{TABLE}}
WHERE ChargePeriodStart >= '{{START_DATE}}' AND ChargePeriodEnd < '{{END_DATE}}'
GROUP BY ProviderName, ServiceCategory, BillingPeriodStart
ORDER BY BillingPeriodStart DESC, TotalBilledCost DESC`,
    requiredColumns: ['ProviderName', 'ServiceCategory', 'BillingPeriodStart', 'BilledCost', 'ChargePeriodStart', 'ChargePeriodEnd'],
    minFocusVersion: '1.0',
    hasDateFilter: true,
    dateFilterType: 'charge',
  },

  // =========================================================================
  // UNIT ECONOMICS (1 Use Case)
  // =========================================================================
  {
    id: 'analyze-credit-memos',
    name: 'Analyze credit memos',
    description: 'View credit transactions and adjustments',
    category: 'unit-economics',
    sql: `SELECT 
  InvoiceIssuerName,
  BillingPeriodStart,
  SUM(BilledCost) AS TotalCredits,
  COUNT(*) AS CreditCount
FROM {{TABLE}}
WHERE ChargeCategory = 'Credit'
  AND ChargePeriodStart >= '{{START_DATE}}' AND ChargePeriodEnd < '{{END_DATE}}'
GROUP BY InvoiceIssuerName, BillingPeriodStart
ORDER BY BillingPeriodStart DESC, TotalCredits`,
    requiredColumns: ['InvoiceIssuerName', 'BillingPeriodStart', 'ChargeCategory', 'BilledCost', 'ChargePeriodStart', 'ChargePeriodEnd'],
    minFocusVersion: '1.0',
    hasDateFilter: true,
    dateFilterType: 'charge',
  },

  // =========================================================================
  // WORKLOAD OPTIMIZATION (3 Use Cases)
  // =========================================================================
  {
    id: 'analyze-compute-cost-by-subaccount',
    name: 'Analyze cost per compute service for a subaccount',
    description: 'Break down compute costs by subaccount',
    category: 'workload-optimization',
    sql: `SELECT 
  SubAccountId,
  SubAccountName,
  ServiceName,
  SUM(BilledCost) AS TotalBilledCost
FROM {{TABLE}}
WHERE ServiceCategory = 'Compute'
  AND ChargePeriodStart >= '{{START_DATE}}' AND ChargePeriodEnd < '{{END_DATE}}'
GROUP BY SubAccountId, SubAccountName, ServiceName
ORDER BY TotalBilledCost DESC`,
    requiredColumns: ['SubAccountId', 'SubAccountName', 'ServiceName', 'ServiceCategory', 'BilledCost', 'ChargePeriodStart', 'ChargePeriodEnd'],
    minFocusVersion: '1.0',
    hasDateFilter: true,
    dateFilterType: 'charge',
  },
  {
    id: 'analyze-costs-by-az-subaccount',
    name: 'Analyze costs by availability zone for a subaccount',
    description: 'View costs distributed across availability zones',
    category: 'workload-optimization',
    sql: `SELECT 
  SubAccountId,
  SubAccountName,
  AvailabilityZone,
  SUM(BilledCost) AS TotalBilledCost
FROM {{TABLE}}
WHERE ChargePeriodStart >= '{{START_DATE}}' AND ChargePeriodEnd < '{{END_DATE}}'
GROUP BY SubAccountId, SubAccountName, AvailabilityZone
ORDER BY SubAccountId, TotalBilledCost DESC`,
    requiredColumns: ['SubAccountId', 'SubAccountName', 'AvailabilityZone', 'BilledCost', 'ChargePeriodStart', 'ChargePeriodEnd'],
    minFocusVersion: '1.0',
    hasDateFilter: true,
    dateFilterType: 'charge',
  },
  {
    id: 'analyze-resource-component-costs',
    name: 'Analyze costs of components of a resource',
    description: 'Break down costs by resource and its components',
    category: 'workload-optimization',
    sql: `SELECT 
  ResourceId,
  ResourceName,
  SkuId,
  SUM(BilledCost) AS TotalBilledCost
FROM {{TABLE}}
WHERE ResourceId IS NOT NULL
  AND ChargePeriodStart >= '{{START_DATE}}' AND ChargePeriodEnd < '{{END_DATE}}'
GROUP BY ResourceId, ResourceName, SkuId
ORDER BY ResourceId, TotalBilledCost DESC
LIMIT 100`,
    requiredColumns: ['ResourceId', 'ResourceName', 'SkuId', 'BilledCost', 'ChargePeriodStart', 'ChargePeriodEnd'],
    minFocusVersion: '1.0',
    hasDateFilter: true,
    dateFilterType: 'charge',
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get queries by category
 */
export function getQueriesByCategory(category: FocusCategory): FocusQuery[] {
  return FOCUS_QUERIES.filter((q) => q.category === category);
}

/**
 * Get category info by ID
 */
export function getCategoryInfo(categoryId: FocusCategory): FocusCategoryInfo | undefined {
  return FOCUS_CATEGORIES.find((c) => c.id === categoryId);
}

/**
 * Get queries compatible with a FOCUS version
 */
export function getQueriesForVersion(version: '1.0' | '1.1' | '1.2'): FocusQuery[] {
  const versionOrder = { '1.0': 1, '1.1': 2, '1.2': 3 };
  const targetVersion = versionOrder[version];
  
  return FOCUS_QUERIES.filter((q) => {
    const queryVersion = versionOrder[q.minFocusVersion];
    return queryVersion <= targetVersion;
  });
}

/**
 * Check if a query is compatible with given columns
 */
export function isQueryCompatible(query: FocusQuery, availableColumns: string[]): boolean {
  const columnSet = new Set(availableColumns.map((c) => c.toLowerCase()));
  return query.requiredColumns.every((col) => columnSet.has(col.toLowerCase()));
}

/**
 * Build a runnable SQL query from template
 * 
 * IMPORTANT: FOCUS date columns (ChargePeriodStart, ChargePeriodEnd, BillingPeriodStart, BillingPeriodEnd)
 * are stored as TIMESTAMP types in DuckDB.
 * This function converts date strings to epoch_ms() calls for proper TIMESTAMP comparison.
 * 
 * IMPORTANT: FOCUS cost columns are DECIMAL types in Parquet.
 * DuckDB-WASM returns DECIMAL as BigInt (scaled integers), which causes display issues.
 * This function modifies the SQL to cast SUM() results to DOUBLE for JS compatibility.
 */
export function buildQuery(
  query: FocusQuery,
  tableName: string,
  startDate: string,
  endDate: string
): string {
  // Convert date strings to Unix epoch milliseconds
  // Then wrap with epoch_ms() to convert to TIMESTAMP for comparison
  const startEpochMs = new Date(startDate).getTime();
  const endEpochMs = new Date(endDate).getTime();

  let sql = query.sql
    .replace(/\{\{TABLE\}\}/g, tableName)
    // Replace quoted placeholders with epoch_ms() calls
    .replace(/'\{\{START_DATE\}\}'/g, `epoch_ms(${startEpochMs})`)
    .replace(/'\{\{END_DATE\}\}'/g, `epoch_ms(${endEpochMs})`)
    // Also handle cases without quotes (just in case)
    .replace(/\{\{START_DATE\}\}/g, `epoch_ms(${startEpochMs})`)
    .replace(/\{\{END_DATE\}\}/g, `epoch_ms(${endEpochMs})`);
  
  // Cast SUM() of DECIMAL columns to DOUBLE to avoid BigInt issues
  // This pattern matches SUM(ColumnName) and wraps it with CAST(... AS DOUBLE)
  // Cost columns in FOCUS: BilledCost, EffectiveCost, ContractedCost, ListCost, etc.
  sql = sql.replace(
    /SUM\s*\(\s*(BilledCost|EffectiveCost|ContractedCost|ListCost|ContractedUnitPrice|ListUnitPrice|PricingQuantity|UsageQuantity|ConsumedQuantity|Savings)\s*\)/gi,
    'CAST(SUM($1) AS DOUBLE)'
  );
  
  // Also handle expressions like SUM(BilledCost) - SUM(EffectiveCost) that might already be wrapped
  // And ROUND(SUM(...)) patterns
  sql = sql.replace(
    /ROUND\s*\(\s*CAST\s*\(\s*SUM\s*\(([^)]+)\)\s*AS\s*DOUBLE\s*\)/gi,
    'ROUND(CAST(SUM($1) AS DOUBLE)'
  );
  
  return sql;
}

/**
 * Search queries by name or description
 */
export function searchQueries(searchTerm: string): FocusQuery[] {
  const term = searchTerm.toLowerCase();
  return FOCUS_QUERIES.filter(
    (q) =>
      q.name.toLowerCase().includes(term) ||
      q.description.toLowerCase().includes(term) ||
      q.category.toLowerCase().includes(term)
  );
}

/**
 * Get query count by category
 */
export function getQueryCountByCategory(): Record<FocusCategory, number> {
  const counts: Partial<Record<FocusCategory, number>> = {};
  
  for (const query of FOCUS_QUERIES) {
    counts[query.category] = (counts[query.category] || 0) + 1;
  }
  
  return counts as Record<FocusCategory, number>;
}
