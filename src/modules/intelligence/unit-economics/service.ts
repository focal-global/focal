/**
 * Unit Economics Service
 * 
 * Calculates key unit economics metrics like:
 * - Cost per customer
 * - Cost per API request
 * - Cost per GB processed
 * - Revenue per unit vs cost per unit
 * - Unit economics trends and forecasting
 */

import type { EnrichedData } from '../../../engine';

export interface UnitEconomicsMetrics {
  unitType: 'customer' | 'request' | 'gb-hour' | 'transaction' | 'user-session' | 'custom';
  unitName: string;
  totalCost: number;
  totalUnits: number;
  costPerUnit: number;
  revenuePerUnit?: number;
  grossMarginPerUnit?: number;
  period: {
    start: Date;
    end: Date;
  };
  breakdown: UnitEconomicsBreakdown[];
  trends: UnitEconomicsTrend[];
}

export interface UnitEconomicsBreakdown {
  category: string;
  cost: number;
  costPerUnit: number;
  percentage: number;
}

export interface UnitEconomicsTrend {
  date: string;
  totalCost: number;
  totalUnits: number;
  costPerUnit: number;
  efficiency: number; // Lower cost per unit over time = positive efficiency
}

export interface UnitDefinition {
  id: string;
  name: string;
  type: UnitEconomicsMetrics['unitType'];
  description: string;
  /** SQL query to calculate total units */
  unitQuery: string;
  /** How to allocate costs to this unit */
  allocationMethod: 'direct' | 'proportional' | 'tag-based' | 'custom';
  /** Configuration for allocation */
  allocationConfig: {
    /** Tags or resource patterns to include */
    includePatterns?: string[];
    /** Tags or resource patterns to exclude */  
    excludePatterns?: string[];
    /** Custom allocation logic */
    customLogic?: string;
  };
  isActive: boolean;
  createdBy: string;
  updatedAt: Date;
}

export class UnitEconomicsService {
  private predefinedUnits: UnitDefinition[] = [];

  constructor() {
    this.initializePredefinedUnits();
  }

  /**
   * Calculate unit economics for a specific unit definition
   */
  async calculateUnitEconomics(
    enrichedData: EnrichedData,
    unitDefinition: UnitDefinition,
    startDate: Date,
    endDate: Date,
    duckdbQuery: (sql: string) => Promise<any[]>
  ): Promise<UnitEconomicsMetrics> {
    
    // Step 1: Calculate total units
    const totalUnits = await this.calculateTotalUnits(
      unitDefinition,
      startDate,
      endDate,
      duckdbQuery
    );

    // Step 2: Calculate total allocated costs
    const totalCost = await this.calculateAllocatedCosts(
      enrichedData,
      unitDefinition,
      startDate,
      endDate,
      duckdbQuery
    );

    // Step 3: Calculate cost breakdown by category
    const breakdown = await this.calculateCostBreakdown(
      enrichedData,
      unitDefinition,
      startDate,
      endDate,
      duckdbQuery
    );

    // Step 4: Calculate trends over time
    const trends = await this.calculateTrends(
      enrichedData,
      unitDefinition,
      startDate,
      endDate,
      duckdbQuery
    );

    const costPerUnit = totalUnits > 0 ? totalCost / totalUnits : 0;

    return {
      unitType: unitDefinition.type,
      unitName: unitDefinition.name,
      totalCost,
      totalUnits,
      costPerUnit,
      period: { start: startDate, end: endDate },
      breakdown,
      trends
    };
  }

  /**
   * Get all available unit definitions
   */
  getAvailableUnits(): UnitDefinition[] {
    return this.predefinedUnits.filter(unit => unit.isActive);
  }

  /**
   * Calculate total units based on definition
   */
  private async calculateTotalUnits(
    unitDefinition: UnitDefinition,
    startDate: Date,
    endDate: Date,
    duckdbQuery: (sql: string) => Promise<any[]>
  ): Promise<number> {
    
    try {
      // Replace placeholders in the unit query
      const query = unitDefinition.unitQuery
        .replace('{{START_DATE}}', `'${startDate.toISOString()}'`)
        .replace('{{END_DATE}}', `'${endDate.toISOString()}'`);

      const result = await duckdbQuery(query);
      return result.length > 0 ? Number(result[0].total_units || 0) : 0;
    } catch (error) {
      console.error(`[UnitEconomics] Error calculating units for ${unitDefinition.name}:`, error);
      return 0;
    }
  }

  /**
   * Calculate allocated costs based on allocation method
   */
  private async calculateAllocatedCosts(
    enrichedData: EnrichedData,
    unitDefinition: UnitDefinition,
    startDate: Date,
    endDate: Date,
    duckdbQuery: (sql: string) => Promise<any[]>
  ): Promise<number> {

    let whereClause = `ChargePeriodStart >= '${startDate.toISOString()}' AND ChargePeriodEnd <= '${endDate.toISOString()}'`;
    
    // Add allocation filters based on method
    switch (unitDefinition.allocationMethod) {
      case 'direct':
        // Include only resources that directly match patterns
        if (unitDefinition.allocationConfig.includePatterns?.length) {
          const patterns = unitDefinition.allocationConfig.includePatterns
            .map(p => `ServiceName LIKE '%${p}%'`)
            .join(' OR ');
          whereClause += ` AND (${patterns})`;
        }
        break;

      case 'tag-based':
        // Use virtual tags for allocation
        if (unitDefinition.allocationConfig.includePatterns?.length) {
          const tagPatterns = unitDefinition.allocationConfig.includePatterns
            .map(p => `json_extract(vt.Tags, '$.${p}') IS NOT NULL`)
            .join(' OR ');
          whereClause += ` AND EXISTS (
            SELECT 1 FROM enriched_billing_virtual_tags vt 
            WHERE vt.ResourceId = billing.ResourceId AND (${tagPatterns})
          )`;
        }
        break;

      case 'proportional':
        // Allocate all costs proportionally (no additional filters)
        break;

      case 'custom':
        // Apply custom logic if provided
        if (unitDefinition.allocationConfig.customLogic) {
          whereClause += ` AND ${unitDefinition.allocationConfig.customLogic}`;
        }
        break;
    }

    const query = `
      SELECT SUM(BilledCost) as total_cost
      FROM enriched_billing billing
      WHERE ${whereClause}
    `;

    try {
      const result = await duckdbQuery(query);
      return result.length > 0 ? Number(result[0].total_cost || 0) : 0;
    } catch (error) {
      console.error(`[UnitEconomics] Error calculating costs for ${unitDefinition.name}:`, error);
      return 0;
    }
  }

  /**
   * Calculate cost breakdown by service category
   */
  private async calculateCostBreakdown(
    enrichedData: EnrichedData,
    unitDefinition: UnitDefinition,
    startDate: Date,
    endDate: Date,
    duckdbQuery: (sql: string) => Promise<any[]>
  ): Promise<UnitEconomicsBreakdown[]> {

    const query = `
      WITH allocated_costs AS (
        SELECT 
          COALESCE(ServiceCategory, 'Other') as category,
          SUM(BilledCost) as cost
        FROM enriched_billing
        WHERE ChargePeriodStart >= '${startDate.toISOString()}' 
          AND ChargePeriodEnd <= '${endDate.toISOString()}'
        GROUP BY ServiceCategory
      ),
      total_cost AS (
        SELECT SUM(cost) as total FROM allocated_costs
      )
      SELECT 
        ac.category,
        ac.cost,
        (ac.cost / tc.total * 100) as percentage
      FROM allocated_costs ac
      CROSS JOIN total_cost tc
      ORDER BY ac.cost DESC
    `;

    try {
      const results = await duckdbQuery(query);
      const totalUnits = await this.calculateTotalUnits(unitDefinition, startDate, endDate, duckdbQuery);
      
      return results.map(row => ({
        category: row.category,
        cost: Number(row.cost),
        costPerUnit: totalUnits > 0 ? Number(row.cost) / totalUnits : 0,
        percentage: Number(row.percentage)
      }));
    } catch (error) {
      console.error(`[UnitEconomics] Error calculating breakdown:`, error);
      return [];
    }
  }

  /**
   * Calculate unit economics trends over time
   */
  private async calculateTrends(
    enrichedData: EnrichedData,
    unitDefinition: UnitDefinition,
    startDate: Date,
    endDate: Date,
    duckdbQuery: (sql: string) => Promise<any[]>
  ): Promise<UnitEconomicsTrend[]> {

    const query = `
      SELECT 
        DATE_TRUNC('day', ChargePeriodStart) as date,
        SUM(BilledCost) as daily_cost,
        COUNT(DISTINCT ResourceId) as resource_count
      FROM enriched_billing
      WHERE ChargePeriodStart >= '${startDate.toISOString()}' 
        AND ChargePeriodEnd <= '${endDate.toISOString()}'
      GROUP BY DATE_TRUNC('day', ChargePeriodStart)
      ORDER BY date
    `;

    try {
      const results = await duckdbQuery(query);
      
      return results.map((row, index) => {
        const dailyCost = Number(row.daily_cost);
        const dailyUnits = 1; // Simplified - would need more complex unit calculation per day
        const costPerUnit = dailyUnits > 0 ? dailyCost / dailyUnits : 0;
        
        // Calculate efficiency as improvement over previous day
        let efficiency = 0;
        if (index > 0) {
          const prevCostPerUnit = Number(results[index - 1].daily_cost); 
          efficiency = prevCostPerUnit > 0 ? (prevCostPerUnit - costPerUnit) / prevCostPerUnit : 0;
        }

        return {
          date: row.date,
          totalCost: dailyCost,
          totalUnits: dailyUnits,
          costPerUnit,
          efficiency
        };
      });
    } catch (error) {
      console.error(`[UnitEconomics] Error calculating trends:`, error);
      return [];
    }
  }

  /**
   * Initialize predefined unit definitions
   */
  private initializePredefinedUnits(): void {
    this.predefinedUnits = [
      {
        id: 'customers',
        name: 'Active Customers',
        type: 'customer',
        description: 'Cost per active customer using your platform',
        unitQuery: `
          SELECT COUNT(DISTINCT customer_id) as total_units
          FROM customer_activity 
          WHERE activity_date BETWEEN {{START_DATE}} AND {{END_DATE}}
        `,
        allocationMethod: 'proportional',
        allocationConfig: {},
        isActive: true,
        createdBy: 'system',
        updatedAt: new Date()
      },
      {
        id: 'api_requests',
        name: 'API Requests',
        type: 'request',
        description: 'Cost per API request processed',
        unitQuery: `
          SELECT SUM(UsageQuantity) as total_units
          FROM enriched_billing
          WHERE ServiceName LIKE '%API%' 
            AND ChargePeriodStart BETWEEN {{START_DATE}} AND {{END_DATE}}
        `,
        allocationMethod: 'direct',
        allocationConfig: {
          includePatterns: ['API', 'Gateway', 'Lambda']
        },
        isActive: true,
        createdBy: 'system',
        updatedAt: new Date()
      },
      {
        id: 'gb_processed',
        name: 'Data Processed (GB)',
        type: 'gb-hour',
        description: 'Cost per GB of data processed',
        unitQuery: `
          SELECT SUM(UsageQuantity) as total_units
          FROM enriched_billing
          WHERE UsageUnit IN ('GB', 'TB', 'GB-Hours')
            AND ChargePeriodStart BETWEEN {{START_DATE}} AND {{END_DATE}}
        `,
        allocationMethod: 'direct',
        allocationConfig: {
          includePatterns: ['Storage', 'Data', 'Analytics']
        },
        isActive: true,
        createdBy: 'system',
        updatedAt: new Date()
      },
      {
        id: 'ai_tokens',
        name: 'AI Tokens',
        type: 'request',
        description: 'Cost per AI token processed',
        unitQuery: `
          SELECT SUM(EstimatedTokens) as total_units
          FROM enriched_billing_ai ai
          JOIN enriched_billing billing ON ai.ResourceId = billing.ResourceId
          WHERE billing.ChargePeriodStart BETWEEN {{START_DATE}} AND {{END_DATE}}
        `,
        allocationMethod: 'tag-based',
        allocationConfig: {
          includePatterns: ['AI', 'ML', 'OpenAI']
        },
        isActive: true,
        createdBy: 'system',
        updatedAt: new Date()
      }
    ];
  }
}