/**
 * Hook for using aggregation cache in React components
 * 
 * Provides a simple interface for caching query results with automatic
 * cache-first loading strategy:
 * 
 * 1. Check cache for existing data
 * 2. If cached, return immediately (instant load!)
 * 3. Optionally fetch fresh data in background
 * 4. Update cache with fresh data
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getAggregationCache, type AggregationCacheService } from '@/engine/services/aggregation-cache';

interface UseCachedQueryOptions<T> {
  /** Unique cache key */
  cacheKey: string;
  /** Function to fetch fresh data */
  queryFn: () => Promise<T>;
  /** Time-to-live in milliseconds */
  ttl?: number;
  /** Cache type for categorization */
  cacheType?: string;
  /** Whether to automatically refresh in background */
  backgroundRefresh?: boolean;
  /** Stale-while-revalidate time in ms (use cache but still refresh if older than this) */
  staleTime?: number;
  /** Whether to run the query on mount */
  enabled?: boolean;
}

interface UseCachedQueryResult<T> {
  data: T | null;
  isLoading: boolean;
  isFetching: boolean;
  isFromCache: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  invalidate: () => Promise<void>;
}

export function useCachedQuery<T>(options: UseCachedQueryOptions<T>): UseCachedQueryResult<T> {
  const {
    cacheKey,
    queryFn,
    ttl = 15 * 60 * 1000, // 15 minutes default
    cacheType = 'query',
    backgroundRefresh = true,
    staleTime = 5 * 60 * 1000, // 5 minutes default
    enabled = true,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [isFromCache, setIsFromCache] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const cacheRef = useRef<AggregationCacheService | null>(null);
  const fetchedRef = useRef(false);

  // Initialize cache
  useEffect(() => {
    if (typeof window !== 'undefined') {
      cacheRef.current = getAggregationCache();
    }
  }, []);

  const fetchData = useCallback(async (bypassCache = false) => {
    if (!cacheRef.current) return;

    try {
      setError(null);

      // Try cache first (unless bypassing)
      if (!bypassCache) {
        const cached = await cacheRef.current.getCustom<{ data: T; cachedAt: number }>(cacheKey);
        
        if (cached) {
          const age = Date.now() - cached.cachedAt;
          setData(cached.data);
          setIsFromCache(true);
          setIsLoading(false);

          // If within stale time, don't refresh
          if (age < staleTime) {
            console.log(`[useCachedQuery] Using fresh cache for "${cacheKey}" (${Math.round(age / 1000)}s old)`);
            return;
          }

          // If backgroundRefresh is enabled, fetch fresh data in background
          if (backgroundRefresh) {
            console.log(`[useCachedQuery] Cache stale for "${cacheKey}", refreshing in background`);
            setIsFetching(true);
          } else {
            return;
          }
        }
      }

      // No cache or stale - fetch fresh data
      if (!data || bypassCache) {
        setIsLoading(true);
      }
      setIsFetching(true);

      const freshData = await queryFn();
      
      // Update cache
      await cacheRef.current.setCustom(
        cacheKey,
        { data: freshData, cachedAt: Date.now() },
        ttl,
        cacheType
      );

      setData(freshData);
      setIsFromCache(false);
      console.log(`[useCachedQuery] Fresh data cached for "${cacheKey}"`);
    } catch (err) {
      console.error(`[useCachedQuery] Error fetching "${cacheKey}":`, err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
      setIsFetching(false);
    }
  }, [cacheKey, queryFn, ttl, cacheType, backgroundRefresh, staleTime, data]);

  // Initial fetch
  useEffect(() => {
    if (enabled && !fetchedRef.current) {
      fetchedRef.current = true;
      fetchData();
    }
  }, [enabled, fetchData]);

  // Reset when cache key changes
  useEffect(() => {
    fetchedRef.current = false;
    setData(null);
    setIsLoading(true);
    setIsFromCache(false);
  }, [cacheKey]);

  const refetch = useCallback(async () => {
    await fetchData(true);
  }, [fetchData]);

  const invalidate = useCallback(async () => {
    if (cacheRef.current) {
      await cacheRef.current.setCustom(cacheKey, null, 0, cacheType);
      setData(null);
      setIsFromCache(false);
    }
  }, [cacheKey, cacheType]);

  return {
    data,
    isLoading,
    isFetching,
    isFromCache,
    error,
    refetch,
    invalidate,
  };
}

// ============================================================================
// Pre-built hooks for common aggregations
// ============================================================================

interface UseDailyCostsOptions {
  startDate: string;
  endDate: string;
  queryFn: () => Promise<Array<{ date: string; total: number; billedCost: number; effectiveCost: number }>>;
  enabled?: boolean;
}

export function useCachedDailyCosts(options: UseDailyCostsOptions) {
  const { startDate, endDate, queryFn, enabled = true } = options;
  
  return useCachedQuery({
    cacheKey: `daily_costs:${startDate}:${endDate}`,
    queryFn,
    ttl: 4 * 60 * 60 * 1000, // 4 hours
    cacheType: 'daily_costs',
    staleTime: 30 * 60 * 1000, // 30 minutes
    enabled,
  });
}

interface UseServiceBreakdownOptions {
  startDate: string;
  endDate: string;
  queryFn: () => Promise<Array<{ serviceName: string; cost: number; percentage: number }>>;
  enabled?: boolean;
}

export function useCachedServiceBreakdown(options: UseServiceBreakdownOptions) {
  const { startDate, endDate, queryFn, enabled = true } = options;
  
  return useCachedQuery({
    cacheKey: `service_breakdown:${startDate}:${endDate}`,
    queryFn,
    ttl: 4 * 60 * 60 * 1000, // 4 hours
    cacheType: 'service_breakdown',
    staleTime: 30 * 60 * 1000, // 30 minutes
    enabled,
  });
}

interface UseKPIsOptions {
  queryFn: () => Promise<{
    totalCost: number;
    costTrend: number;
    topService: string;
    topServiceCost: number;
    resourceCount: number;
  }>;
  enabled?: boolean;
}

export function useCachedKPIs(options: UseKPIsOptions) {
  const { queryFn, enabled = true } = options;
  
  return useCachedQuery({
    cacheKey: 'kpi:dashboard',
    queryFn,
    ttl: 15 * 60 * 1000, // 15 minutes
    cacheType: 'kpi',
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled,
  });
}

// ============================================================================
// Cache management hook
// ============================================================================

export function useAggregationCache() {
  const [stats, setStats] = useState<{
    totalEntries: number;
    totalSize: number;
    entriesByType: Record<string, number>;
  } | null>(null);

  const cache = typeof window !== 'undefined' ? getAggregationCache() : null;

  const refreshStats = useCallback(async () => {
    if (cache) {
      const s = await cache.getStats();
      setStats({
        totalEntries: s.totalEntries,
        totalSize: s.totalSize,
        entriesByType: s.entriesByType,
      });
    }
  }, [cache]);

  useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  const clearAll = useCallback(async () => {
    if (cache) {
      await cache.invalidateAll();
      await refreshStats();
    }
  }, [cache, refreshStats]);

  const clearType = useCallback(async (type: string) => {
    if (cache) {
      await cache.invalidateType(type as 'daily_costs' | 'monthly_costs' | 'service_breakdown' | 'resource_costs' | 'anomalies' | 'kpi');
      await refreshStats();
    }
  }, [cache, refreshStats]);

  const cleanup = useCallback(async () => {
    if (cache) {
      const deleted = await cache.cleanup();
      await refreshStats();
      return deleted;
    }
    return 0;
  }, [cache, refreshStats]);

  return {
    stats,
    refreshStats,
    clearAll,
    clearType,
    cleanup,
  };
}
