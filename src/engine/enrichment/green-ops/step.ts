/**
 * GreenOps CO2 Calculation Enrichment Step
 * 
 * Calculates estimated CO2 emissions for cloud resources based on:
 * - Service type and usage patterns
 * - Regional energy grid carbon intensity
 * - Provider-specific emission factors
 * - Industry-standard coefficients
 */

import type { 
  EnrichmentStep, 
  PipelineContext, 
  EnrichedData,
  CO2Data 
} from '../../ingestion/types';

export interface CO2Coefficient {
  id: string;
  provider: 'aws' | 'azure' | 'gcp' | 'generic';
  serviceName: string;
  serviceCategory?: string;
  region: string;
  /** kg CO2 per dollar spent */
  kgCO2PerDollar: number;
  /** kg CO2 per unit (hour, GB, etc.) */
  kgCO2PerUnit?: number;
  /** Unit type (hour, gb-hour, request, etc.) */
  unitType?: string;
  /** Confidence level (0-1) */
  confidence: number;
  /** Source of the coefficient */
  source: 'cloud_carbon_footprint' | 'provider_official' | 'research_paper' | 'estimated';
  /** When this coefficient was last updated */
  updatedAt: Date;
}

export class GreenOpsStep implements EnrichmentStep<EnrichedData, EnrichedData> {
  name = 'green-ops-co2';
  description = 'Calculate CO2 emissions for cloud resources';
  dependencies = ['virtual-tags']; // Run after virtual tags for better allocation

  private coefficients: CO2Coefficient[] = [];

  constructor() {
    // Initialize with default coefficients
    this.initializeDefaultCoefficients();
  }

  async execute(
    data: EnrichedData,
    context: PipelineContext
  ): Promise<EnrichedData> {
    const { duckdb, cache } = context;

    // Load or refresh CO2 coefficients
    await this.loadCoefficients(context);

    // Create temporary view with billing data
    await this.createBillingView(data, duckdb);
    
    // Create coefficients table
    await this.createCoefficientsTable(duckdb);

    // Calculate CO2 emissions
    const co2Data = await this.calculateCO2Emissions(duckdb);

    console.log(`[GreenOps] Calculated CO2 for ${co2Data.length} resources`);

    return {
      ...data,
      co2Data
    };
  }

  validate(output: EnrichedData): boolean {
    return Array.isArray(output.co2Data);
  }

  /**
   * Load CO2 coefficients from various sources
   */
  private async loadCoefficients(context: PipelineContext): Promise<void> {
    const { cache } = context;
    
    const cacheKey = 'co2-coefficients:latest';
    let coefficients = await cache.get<CO2Coefficient[]>(cacheKey);
    
    if (!coefficients) {
      // In production, this would fetch from:
      // - Cloud Carbon Footprint database
      // - Provider sustainability APIs
      // - Research paper datasets
      coefficients = this.coefficients;
      await cache.set(cacheKey, coefficients, 24 * 60 * 60 * 1000); // Cache for 24 hours
    }
    
    this.coefficients = coefficients;
  }

  /**
   * Create billing data view in DuckDB
   */
  private async createBillingView(data: EnrichedData, duckdb: any): Promise<void> {
    const rows = data.rows.slice(0, 10000); // Limit for performance
    
    if (rows.length === 0) return;
    
    const valuesClause = rows.map(row => {
      const resourceId = this.escapeValue(row.ResourceId);
      const serviceName = this.escapeValue(row.ServiceName);
      const regionName = this.escapeValue(row.RegionName);
      const billedCost = Number(row.BilledCost) || 0;
      const usageQuantity = Number(row.UsageQuantity) || 0;
      
      return `(${resourceId}, ${serviceName}, ${regionName}, ${billedCost}, ${usageQuantity})`;
    }).join(',\n');

    await duckdb.query(`
      CREATE OR REPLACE TEMPORARY VIEW billing_with_co2 AS
      SELECT * FROM (VALUES ${valuesClause})
      AS t(ResourceId, ServiceName, RegionName, BilledCost, UsageQuantity)
    `);
  }

  /**
   * Create CO2 coefficients table in DuckDB
   */
  private async createCoefficientsTable(duckdb: any): Promise<void> {
    if (this.coefficients.length === 0) return;

    const valuesClause = this.coefficients.map(coeff => {
      return `(
        ${this.escapeValue(coeff.serviceName)},
        ${this.escapeValue(coeff.region)},
        ${coeff.kgCO2PerDollar},
        ${coeff.kgCO2PerUnit || 0},
        ${this.escapeValue(coeff.unitType || 'dollar')},
        ${coeff.confidence},
        ${this.escapeValue(coeff.source)}
      )`;
    }).join(',\n');

    await duckdb.query(`
      CREATE OR REPLACE TEMPORARY VIEW co2_coefficients AS
      SELECT * FROM (VALUES ${valuesClause})
      AS t(ServiceName, Region, KgCO2PerDollar, KgCO2PerUnit, UnitType, Confidence, Source)
    `);
  }

  /**
   * Calculate CO2 emissions using DuckDB joins
   */
  private async calculateCO2Emissions(duckdb: any): Promise<CO2Data[]> {
    const query = `
      WITH co2_calculations AS (
        SELECT 
          b.ResourceId,
          b.ServiceName,
          b.RegionName,
          b.BilledCost,
          b.UsageQuantity,
          c.KgCO2PerDollar,
          c.KgCO2PerUnit,
          c.Confidence,
          c.Source,
          -- Calculate emissions based on cost (primary method)
          (b.BilledCost * COALESCE(c.KgCO2PerDollar, 0)) as CostBasedCO2,
          -- Calculate emissions based on usage (secondary method)  
          (b.UsageQuantity * COALESCE(c.KgCO2PerUnit, 0)) as UsageBasedCO2,
          -- Use cost-based if available, otherwise usage-based, otherwise regional average
          CASE 
            WHEN c.KgCO2PerDollar > 0 THEN (b.BilledCost * c.KgCO2PerDollar)
            WHEN c.KgCO2PerUnit > 0 THEN (b.UsageQuantity * c.KgCO2PerUnit)
            ELSE (b.BilledCost * 0.5) -- Default: 0.5 kg CO2 per dollar (rough cloud average)
          END as EstimatedKgCO2
        FROM billing_with_co2 b
        LEFT JOIN co2_coefficients c ON (
          b.ServiceName = c.ServiceName 
          AND (b.RegionName = c.Region OR c.Region = 'global')
        )
      )
      SELECT 
        ResourceId,
        EstimatedKgCO2,
        COALESCE(Confidence, 0.3) as Confidence,
        COALESCE(Source, 'estimated') as CoefficientSource,
        RegionName
      FROM co2_calculations
      WHERE EstimatedKgCO2 > 0
    `;

    const results = await duckdb.query(query);
    
    return results.map((row: any) => ({
      resourceId: String(row.ResourceId),
      estimatedKgCO2: Number(row.EstimatedKgCO2) || 0,
      confidence: Number(row.Confidence) || 0,
      coefficient: String(row.CoefficientSource),
      region: String(row.RegionName)
    }));
  }

  /**
   * Initialize with industry-standard CO2 coefficients
   * Data sourced from Cloud Carbon Footprint and sustainability research
   */
  private initializeDefaultCoefficients(): void {
    this.coefficients = [
      // AWS Compute Services
      {
        id: 'aws-ec2-us-east-1',
        provider: 'aws',
        serviceName: 'Amazon Elastic Compute Cloud',
        serviceCategory: 'Compute',
        region: 'us-east-1',
        kgCO2PerDollar: 0.45,
        confidence: 0.8,
        source: 'cloud_carbon_footprint',
        updatedAt: new Date('2024-01-01')
      },
      {
        id: 'aws-ec2-eu-west-1',
        provider: 'aws', 
        serviceName: 'Amazon Elastic Compute Cloud',
        serviceCategory: 'Compute',
        region: 'eu-west-1',
        kgCO2PerDollar: 0.25, // EU has cleaner energy grid
        confidence: 0.8,
        source: 'cloud_carbon_footprint',
        updatedAt: new Date('2024-01-01')
      },
      // Azure Compute
      {
        id: 'azure-compute-eastus',
        provider: 'azure',
        serviceName: 'Virtual Machines',
        serviceCategory: 'Compute', 
        region: 'East US',
        kgCO2PerDollar: 0.48,
        confidence: 0.7,
        source: 'estimated',
        updatedAt: new Date('2024-01-01')
      },
      // Storage Services (lower carbon intensity)
      {
        id: 'aws-s3-global',
        provider: 'aws',
        serviceName: 'Amazon Simple Storage Service',
        serviceCategory: 'Storage',
        region: 'global',
        kgCO2PerDollar: 0.15,
        confidence: 0.6,
        source: 'estimated',
        updatedAt: new Date('2024-01-01')
      },
      // Generic fallback coefficients
      {
        id: 'generic-compute',
        provider: 'generic',
        serviceName: 'generic-compute',
        region: 'global',
        kgCO2PerDollar: 0.4,
        confidence: 0.3,
        source: 'estimated',
        updatedAt: new Date('2024-01-01')
      },
      {
        id: 'generic-storage',
        provider: 'generic',
        serviceName: 'generic-storage', 
        region: 'global',
        kgCO2PerDollar: 0.2,
        confidence: 0.3,
        source: 'estimated',
        updatedAt: new Date('2024-01-01')
      }
    ];
  }

  /**
   * Escape values for SQL
   */
  private escapeValue(value: unknown): string {
    if (value === null || value === undefined) return 'NULL';
    if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
    if (typeof value === 'number') return String(value);
    return `'${String(value).replace(/'/g, "''")}'`;
  }
}