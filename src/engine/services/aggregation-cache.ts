/**
 * Aggregation Cache Service
 * 
 * Pre-computes and caches common dashboard aggregations to provide
 * instant loading on repeat visits. All data stays in browser (Local-First).
 * 
 * Cache Types:
 * - 'daily_costs': Daily cost totals
 * - 'monthly_costs': Monthly summaries
 * - 'service_breakdown': Cost by service
 * - 'resource_costs': Top resources by cost
 * - 'anomalies': Detected anomalies
 * - 'kpi': Key performance indicators
 */

import { IndexedDBCacheProvider } from '../ingestion/cache';

// ============================================================================
// Types
// ============================================================================

export interface CachedDailyCosts {
  date: string;
  total: number;
  billedCost: number;
  effectiveCost: number;
  usageQuantity: number;
}

export interface CachedMonthlySummary {
  month: string;
  total: number;
  previousTotal: number;
  change: number;
  changePercent: number;
  topServices: { name: string; cost: number }[];
}

export interface CachedServiceBreakdown {
  serviceName: string;
  serviceCategory: string;
  cost: number;
  percentage: number;
  trend: 'up' | 'down' | 'stable';
  trendPercent: number;
}

export interface CachedResourceCost {
  resourceId: string;
  resourceName: string;
  resourceType: string;
  serviceName: string;
  cost: number;
  region: string;
}

export interface CachedAnomaly {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  date: string;
  metric: string;
  value: number;
  expectedValue: number;
  deviation: number;
  description: string;
  affectedService?: string;
  affectedResource?: string;
}

export interface CachedKPIs {
  totalCost: number;
  costTrend: number;
  topService: string;
  topServiceCost: number;
  resourceCount: number;
  anomalyCount: number;
  lastUpdated: string;
}

export interface AggregationMeta {
  cacheKey: string;
  cachedAt: Date;
  dataRange: { start: string; end: string };
  sourceCount: number;
  isStale: boolean;
}

// Cache TTLs in milliseconds
const CACHE_TTL = {
  daily_costs: 4 * 60 * 60 * 1000,       // 4 hours - changes with new data
  monthly_costs: 24 * 60 * 60 * 1000,     // 24 hours - fairly stable
  service_breakdown: 4 * 60 * 60 * 1000,  // 4 hours
  resource_costs: 4 * 60 * 60 * 1000,     // 4 hours
  anomalies: 1 * 60 * 60 * 1000,          // 1 hour - need fresh detection
  kpi: 15 * 60 * 1000,                    // 15 minutes - quick refresh
};

// ============================================================================
// Aggregation Cache Service
// ============================================================================

class AggregationCacheService {
  private cache: IndexedDBCacheProvider;
  private initialized = false;

  constructor() {
    this.cache = new IndexedDBCacheProvider();
  }

  // --------------------------------------------------------------------------
  // Cache Key Helpers
  // --------------------------------------------------------------------------

  private makeCacheKey(type: string, params: Record<string, string | number> = {}): string {
    const paramStr = Object.entries(params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('&');
    return paramStr ? `${type}:${paramStr}` : type;
  }

  // --------------------------------------------------------------------------
  // Daily Costs
  // --------------------------------------------------------------------------

  async getDailyCosts(startDate: string, endDate: string): Promise<CachedDailyCosts[] | null> {
    const key = this.makeCacheKey('daily_costs', { start: startDate, end: endDate });
    return this.cache.get<CachedDailyCosts[]>(key);
  }

  async setDailyCosts(startDate: string, endDate: string, data: CachedDailyCosts[]): Promise<void> {
    const key = this.makeCacheKey('daily_costs', { start: startDate, end: endDate });
    await this.cache.set(key, data, CACHE_TTL.daily_costs, 'daily_costs');
    console.log(`[AggregationCache] Cached ${data.length} daily cost entries`);
  }

  // --------------------------------------------------------------------------
  // Monthly Summary
  // --------------------------------------------------------------------------

  async getMonthlySummary(year: number): Promise<CachedMonthlySummary[] | null> {
    const key = this.makeCacheKey('monthly_costs', { year });
    return this.cache.get<CachedMonthlySummary[]>(key);
  }

  async setMonthlySummary(year: number, data: CachedMonthlySummary[]): Promise<void> {
    const key = this.makeCacheKey('monthly_costs', { year });
    await this.cache.set(key, data, CACHE_TTL.monthly_costs, 'monthly_costs');
    console.log(`[AggregationCache] Cached ${data.length} monthly summaries for ${year}`);
  }

  // --------------------------------------------------------------------------
  // Service Breakdown
  // --------------------------------------------------------------------------

  async getServiceBreakdown(startDate: string, endDate: string): Promise<CachedServiceBreakdown[] | null> {
    const key = this.makeCacheKey('service_breakdown', { start: startDate, end: endDate });
    return this.cache.get<CachedServiceBreakdown[]>(key);
  }

  async setServiceBreakdown(startDate: string, endDate: string, data: CachedServiceBreakdown[]): Promise<void> {
    const key = this.makeCacheKey('service_breakdown', { start: startDate, end: endDate });
    await this.cache.set(key, data, CACHE_TTL.service_breakdown, 'service_breakdown');
    console.log(`[AggregationCache] Cached ${data.length} service breakdowns`);
  }

  // --------------------------------------------------------------------------
  // Resource Costs
  // --------------------------------------------------------------------------

  async getResourceCosts(limit: number = 100): Promise<CachedResourceCost[] | null> {
    const key = this.makeCacheKey('resource_costs', { limit });
    return this.cache.get<CachedResourceCost[]>(key);
  }

  async setResourceCosts(data: CachedResourceCost[], limit: number = 100): Promise<void> {
    const key = this.makeCacheKey('resource_costs', { limit });
    await this.cache.set(key, data, CACHE_TTL.resource_costs, 'resource_costs');
    console.log(`[AggregationCache] Cached ${data.length} resource costs`);
  }

  // --------------------------------------------------------------------------
  // Anomalies
  // --------------------------------------------------------------------------

  async getAnomalies(startDate: string, endDate: string): Promise<CachedAnomaly[] | null> {
    const key = this.makeCacheKey('anomalies', { start: startDate, end: endDate });
    return this.cache.get<CachedAnomaly[]>(key);
  }

  async setAnomalies(startDate: string, endDate: string, data: CachedAnomaly[]): Promise<void> {
    const key = this.makeCacheKey('anomalies', { start: startDate, end: endDate });
    await this.cache.set(key, data, CACHE_TTL.anomalies, 'anomalies');
    console.log(`[AggregationCache] Cached ${data.length} anomalies`);
  }

  // --------------------------------------------------------------------------
  // KPIs
  // --------------------------------------------------------------------------

  async getKPIs(): Promise<CachedKPIs | null> {
    return this.cache.get<CachedKPIs>('kpi:latest');
  }

  async setKPIs(data: CachedKPIs): Promise<void> {
    await this.cache.set('kpi:latest', data, CACHE_TTL.kpi, 'kpi');
    console.log(`[AggregationCache] Cached KPIs`);
  }

  // --------------------------------------------------------------------------
  // Generic Cache Methods
  // --------------------------------------------------------------------------

  async getCustom<T>(key: string): Promise<T | null> {
    return this.cache.get<T>(key);
  }

  async setCustom<T>(key: string, value: T, ttl?: number, type: string = 'custom'): Promise<void> {
    await this.cache.set(key, value, ttl, type);
  }

  // --------------------------------------------------------------------------
  // Cache Management
  // --------------------------------------------------------------------------

  async invalidateType(type: keyof typeof CACHE_TTL): Promise<void> {
    await this.cache.clearByType(type);
    console.log(`[AggregationCache] Invalidated all "${type}" cache entries`);
  }

  async invalidateAll(): Promise<void> {
    await this.cache.clear();
    console.log(`[AggregationCache] All cache cleared`);
  }

  async cleanup(): Promise<number> {
    return this.cache.cleanup();
  }

  async getStats() {
    return this.cache.getStats();
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

let instance: AggregationCacheService | null = null;

export function getAggregationCache(): AggregationCacheService {
  if (!instance) {
    instance = new AggregationCacheService();
  }
  return instance;
}

// Export for testing
export { AggregationCacheService };
