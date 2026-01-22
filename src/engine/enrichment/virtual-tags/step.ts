/**
 * Virtual Tags Enrichment Step
 * 
 * Applies user-defined tag overrides to billing data without modifying
 * the original cloud resources. This allows for custom cost allocation
 * and organization-specific tagging strategies.
 */

import type { 
  EnrichmentStep, 
  PipelineContext, 
  RawBillingData, 
  EnrichedData,
  VirtualTagData 
} from '../../ingestion/types';

export interface VirtualTagRule {
  id: string;
  name: string;
  description?: string;
  condition: TagCondition;
  tags: Record<string, string>;
  priority: number;
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TagCondition {
  type: 'resource_id' | 'service_name' | 'account_id' | 'region' | 'custom';
  operator: 'equals' | 'contains' | 'starts_with' | 'regex' | 'in';
  value: string | string[];
  field?: string; // For custom conditions
}

export class VirtualTagsStep implements EnrichmentStep<RawBillingData, EnrichedData> {
  name = 'virtual-tags';
  description = 'Apply user-defined virtual tags to resources';
  dependencies: string[] = [];

  constructor(private rules: VirtualTagRule[] = []) {}

  async execute(
    data: RawBillingData, 
    context: PipelineContext
  ): Promise<EnrichedData> {
    const { duckdb, cache, userId, orgId } = context;
    
    // Load rules from cache or database
    const cacheKey = `virtual-tags:${orgId}:${userId}`;
    let rules = await cache.get<VirtualTagRule[]>(cacheKey);
    
    if (!rules) {
      rules = await this.loadVirtualTagRules(context);
      await cache.set(cacheKey, rules, 10 * 60 * 1000); // Cache for 10 minutes
    }

    if (!rules || rules.length === 0) {
      console.log('[VirtualTags] No rules defined, skipping enrichment');
      return {
        ...data,
        virtualTags: []
      };
    }

    // Create a temporary view with the raw data
    await duckdb.query(`
      CREATE OR REPLACE TEMPORARY VIEW raw_billing AS
      SELECT * FROM (VALUES ${this.buildValuesClause(data.rows)})
      AS t(${data.schema.columns.map(col => `"${col}"`).join(', ')})
    `);

    // Apply virtual tags using DuckDB
    const virtualTags = await this.applyVirtualTags(rules, duckdb);

    console.log(`[VirtualTags] Applied ${virtualTags.length} tag overrides`);

    return {
      ...data,
      virtualTags
    };
  }

  validate(output: EnrichedData): boolean {
    return Array.isArray(output.virtualTags);
  }

  /**
   * Load virtual tag rules from the database
   */
  private async loadVirtualTagRules(context: PipelineContext): Promise<VirtualTagRule[]> {
    // TODO: Load from actual database once we have virtual tag management UI
    // For now, return some example rules
    return [
      {
        id: 'rule-1',
        name: 'Tag development resources',
        description: 'Tag all resources with "dev" in the name as development',
        condition: {
          type: 'service_name',
          operator: 'contains',
          value: 'dev'
        },
        tags: {
          Environment: 'Development',
          CostCenter: 'Engineering'
        },
        priority: 100,
        isActive: true,
        createdBy: context.userId,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'rule-2', 
        name: 'Tag production resources',
        description: 'Tag all resources with "prod" in the name as production',
        condition: {
          type: 'service_name',
          operator: 'contains',
          value: 'prod'
        },
        tags: {
          Environment: 'Production',
          CostCenter: 'Operations'
        },
        priority: 200,
        isActive: true,
        createdBy: context.userId,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
  }

  /**
   * Apply virtual tag rules using DuckDB queries
   */
  private async applyVirtualTags(
    rules: VirtualTagRule[], 
    duckdb: any
  ): Promise<VirtualTagData[]> {
    const virtualTags: VirtualTagData[] = [];
    
    // Sort rules by priority (higher priority first)
    const activeRules = rules.filter(r => r.isActive).sort((a, b) => b.priority - a.priority);
    
    for (const rule of activeRules) {
      try {
        const query = this.buildRuleQuery(rule);
        const matches = await duckdb.query(query);
        
        for (const match of matches) {
          // Check if this resource already has virtual tags (lower priority rule)
          const existingIndex = virtualTags.findIndex(vt => vt.resourceId === match.ResourceId);
          
          if (existingIndex >= 0) {
            // Merge tags (higher priority wins on conflicts)
            virtualTags[existingIndex].tags = {
              ...virtualTags[existingIndex].tags,
              ...rule.tags
            };
          } else {
            // New virtual tag entry
            virtualTags.push({
              resourceId: String(match.ResourceId || 'unknown'),
              tags: { ...rule.tags },
              appliedAt: new Date(),
              appliedBy: rule.id
            });
          }
        }
        
        console.log(`[VirtualTags] Rule "${rule.name}" matched ${matches.length} resources`);
        
      } catch (error) {
        console.error(`[VirtualTags] Error applying rule "${rule.name}":`, error);
      }
    }
    
    return virtualTags;
  }

  /**
   * Build a DuckDB query for a virtual tag rule
   */
  private buildRuleQuery(rule: VirtualTagRule): string {
    const { condition } = rule;
    let whereClause = '';
    
    switch (condition.type) {
      case 'service_name':
        whereClause = this.buildConditionClause('ServiceName', condition);
        break;
      case 'resource_id':
        whereClause = this.buildConditionClause('ResourceId', condition);
        break;
      case 'account_id':
        whereClause = this.buildConditionClause('AccountId', condition);
        break;
      case 'region':
        whereClause = this.buildConditionClause('RegionName', condition);
        break;
      case 'custom':
        whereClause = this.buildConditionClause(condition.field || 'ServiceName', condition);
        break;
    }
    
    return `
      SELECT DISTINCT ResourceId, ServiceName, AccountId, RegionName
      FROM raw_billing 
      WHERE ${whereClause}
    `;
  }

  /**
   * Build WHERE clause for a specific condition
   */
  private buildConditionClause(field: string, condition: TagCondition): string {
    const safeValue = (val: string) => `'${val.replace(/'/g, "''")}'`;
    
    switch (condition.operator) {
      case 'equals':
        return `"${field}" = ${safeValue(String(condition.value))}`;
      case 'contains':
        return `"${field}" LIKE '%${String(condition.value).replace(/'/g, "''")}%'`;
      case 'starts_with':
        return `"${field}" LIKE '${String(condition.value).replace(/'/g, "''")}%'`;
      case 'in':
        const values = Array.isArray(condition.value) ? condition.value : [condition.value];
        return `"${field}" IN (${values.map(v => safeValue(String(v))).join(', ')})`;
      case 'regex':
        return `regexp_matches("${field}", ${safeValue(String(condition.value))})`;
      default:
        return '1=1'; // Always true fallback
    }
  }

  /**
   * Build VALUES clause for DuckDB from raw data
   */
  private buildValuesClause(rows: Record<string, unknown>[]): string {
    if (!rows.length) return '(NULL)';
    
    return rows.slice(0, 1000).map(row => { // Limit to 1000 rows for performance
      const values = Object.values(row).map(val => {
        if (val === null || val === undefined) return 'NULL';
        if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
        if (typeof val === 'number') return String(val);
        if (typeof val === 'boolean') return val ? 'true' : 'false';
        return `'${String(val).replace(/'/g, "''")}'`;
      });
      return `(${values.join(', ')})`;
    }).join(',\n');
  }
}