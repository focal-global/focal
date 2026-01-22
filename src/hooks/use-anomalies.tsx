/**
 * Shared Anomaly Detection Hook
 * 
 * Provides a centralized anomaly detection system that can be used across
 * all dashboards (Engineering, Executive, Finance, etc.) and the dedicated
 * Anomaly Detection module.
 * 
 * Features:
 * - Caches anomalies in memory and IndexedDB for fast access
 * - Shares state between components via React context
 * - Auto-refreshes at configurable intervals
 * - Supports filtering by severity, service, resource, etc.
 */

import { useState, useEffect, useCallback, useMemo, useRef, createContext, useContext, type ReactNode } from 'react';
import { useSpectrum, UNIFIED_VIEW_NAME } from '@/components/providers/spectrum-provider';
import { 
  AnomalyDetectionEngine, 
  type AnomalyResult, 
  type TimeSeriesData 
} from '@/modules/detector/anomaly-detection/engine';

// ============================================================================
// Types
// ============================================================================

export type AnomalySeverity = 'low' | 'medium' | 'high' | 'critical';

export interface AnomalySummary {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  totalImpact: number;
  topServices: Array<{ service: string; count: number; impact: number }>;
}

export interface AnomalyFilters {
  severity?: AnomalySeverity | 'all';
  service?: string;
  resourceId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  minImpact?: number;
}

export interface UseAnomaliesReturn {
  /** All detected anomalies (unfiltered) */
  anomalies: AnomalyResult[];
  /** Filtered anomalies based on current filters */
  filteredAnomalies: AnomalyResult[];
  /** Summary statistics */
  summary: AnomalySummary;
  /** Whether detection is in progress */
  isDetecting: boolean;
  /** Last detection timestamp */
  lastDetection: Date | null;
  /** Current filters */
  filters: AnomalyFilters;
  /** Set filters */
  setFilters: (filters: AnomalyFilters) => void;
  /** Manually trigger detection */
  runDetection: () => Promise<void>;
  /** Error message if detection failed */
  error: string | null;
  /** Get anomalies for a specific resource */
  getAnomaliesForResource: (resourceId: string) => AnomalyResult[];
  /** Get anomalies by severity */
  getAnomaliesBySeverity: (severity: AnomalySeverity) => AnomalyResult[];
}

// ============================================================================
// Context
// ============================================================================

const AnomalyContext = createContext<UseAnomaliesReturn | null>(null);

// Local storage key for persisting anomalies
const ANOMALY_CACHE_KEY = 'focal:anomaly-cache';
const ANOMALY_SETTINGS_KEY = 'focal:anomaly-settings';

// ============================================================================
// Provider
// ============================================================================

interface AnomalyProviderProps {
  children: ReactNode;
  /** Detection window in days */
  windowDays?: number;
  /** Auto-refresh interval in milliseconds (0 = disabled) */
  autoRefreshInterval?: number;
}

export function AnomalyProvider({ 
  children, 
  windowDays = 30,
  autoRefreshInterval = 60 * 60 * 1000 // 1 hour default
}: AnomalyProviderProps) {
  const { isReady, query } = useSpectrum();
  
  const [anomalies, setAnomalies] = useState<AnomalyResult[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [lastDetection, setLastDetection] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<AnomalyFilters>({ severity: 'all' });
  
  // Refs to avoid stale closures and prevent callback recreation
  const isDetectingRef = useRef(false);
  const hasRunInitialDetection = useRef(false);
  
  // Initialize engine
  const [engine] = useState(() => new AnomalyDetectionEngine({
    sensitivity: 0.3,
    threshold: 0.6,
    windowDays,
    methods: ['statistical', 'time-series', 'pattern-based'],
    seasonalAdjustment: true,
  }));

  // Load cached anomalies on mount
  useEffect(() => {
    try {
      const cached = localStorage.getItem(ANOMALY_CACHE_KEY);
      if (cached) {
        const { anomalies: cachedAnomalies, timestamp } = JSON.parse(cached);
        const cacheAge = Date.now() - timestamp;
        // Use cache if less than 4 hours old
        if (cacheAge < 4 * 60 * 60 * 1000 && cachedAnomalies?.length > 0) {
          // Rehydrate dates
          const rehydrated = cachedAnomalies.map((a: AnomalyResult) => ({
            ...a,
            timestamp: new Date(a.timestamp),
          }));
          setAnomalies(rehydrated);
          setLastDetection(new Date(timestamp));
          hasRunInitialDetection.current = true; // Mark as loaded from cache
        }
      }
    } catch (e) {
      console.warn('[Anomalies] Failed to load cache:', e);
    }
  }, []);

  // Run anomaly detection - stable callback using refs
  const runDetection = useCallback(async () => {
    // Use ref to check if already detecting (avoids stale closure)
    if (isDetectingRef.current) return;
    
    isDetectingRef.current = true;
    setIsDetecting(true);
    setError(null);
    
    try {
      const endDate = new Date();
      const startDate = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
      
      // Query daily cost data grouped by resource
      const costData = await query<{
        ResourceId: string;
        ServiceName: string;
        ChargeDate: string;
        DailyCost: number;
      }>(`
        SELECT 
          ResourceId,
          ServiceName,
          CAST(ChargePeriodStart AS DATE) AS ChargeDate,
          CAST(SUM(BilledCost) AS DOUBLE) AS DailyCost
        FROM ${UNIFIED_VIEW_NAME}
        WHERE ChargePeriodStart >= epoch_ms(${startDate.getTime()})
          AND ChargePeriodEnd < epoch_ms(${endDate.getTime()})
          AND ResourceId IS NOT NULL
          AND ResourceId != ''
        GROUP BY ResourceId, ServiceName, CAST(ChargePeriodStart AS DATE)
        ORDER BY ResourceId, ChargeDate
      `);

      if (!costData || costData.length === 0) {
        setAnomalies([]);
        setLastDetection(new Date());
        hasRunInitialDetection.current = true;
        return;
      }

      // Convert to TimeSeriesData format
      const timeSeriesData: TimeSeriesData[] = costData.map(row => ({
        timestamp: new Date(row.ChargeDate),
        value: row.DailyCost || 0,
        resourceId: String(row.ResourceId),
        metadata: {
          serviceName: row.ServiceName,
        },
      }));

      // Run detection
      const detected = await engine.detectAnomalies(timeSeriesData);
      
      setAnomalies(detected);
      setLastDetection(new Date());
      hasRunInitialDetection.current = true;
      
      // Cache results
      try {
        localStorage.setItem(ANOMALY_CACHE_KEY, JSON.stringify({
          anomalies: detected,
          timestamp: Date.now(),
        }));
      } catch (e) {
        console.warn('[Anomalies] Failed to cache:', e);
      }
      
    } catch (err) {
      console.error('[Anomalies] Detection error:', err);
      setError(err instanceof Error ? err.message : 'Detection failed');
    } finally {
      setIsDetecting(false);
      isDetectingRef.current = false;
    }
  }, [query, engine, windowDays]); // Removed isReady and isDetecting - using refs

  // Auto-run detection on mount if no cached data
  useEffect(() => {
    if (isReady && !hasRunInitialDetection.current && !isDetectingRef.current) {
      runDetection();
    }
  }, [isReady, runDetection]);

  // Auto-refresh at interval
  useEffect(() => {
    if (autoRefreshInterval <= 0 || !isReady) return;
    
    const interval = setInterval(() => {
      runDetection();
    }, autoRefreshInterval);
    
    return () => clearInterval(interval);
  }, [autoRefreshInterval, isReady, runDetection]);

  // Filter anomalies
  const filteredAnomalies = useMemo(() => {
    return anomalies.filter(a => {
      if (filters.severity && filters.severity !== 'all' && a.severity !== filters.severity) {
        return false;
      }
      if (filters.service && a.serviceName !== filters.service) {
        return false;
      }
      if (filters.resourceId && a.resourceId !== filters.resourceId) {
        return false;
      }
      if (filters.dateFrom && a.timestamp < filters.dateFrom) {
        return false;
      }
      if (filters.dateTo && a.timestamp > filters.dateTo) {
        return false;
      }
      if (filters.minImpact && a.impact.costImpact < filters.minImpact) {
        return false;
      }
      return true;
    });
  }, [anomalies, filters]);

  // Calculate summary
  const summary = useMemo((): AnomalySummary => {
    const total = anomalies.length;
    const critical = anomalies.filter(a => a.severity === 'critical').length;
    const high = anomalies.filter(a => a.severity === 'high').length;
    const medium = anomalies.filter(a => a.severity === 'medium').length;
    const low = anomalies.filter(a => a.severity === 'low').length;
    const totalImpact = anomalies.reduce((sum, a) => sum + a.impact.costImpact, 0);
    
    // Group by service
    const serviceMap = new Map<string, { count: number; impact: number }>();
    for (const a of anomalies) {
      const current = serviceMap.get(a.serviceName) || { count: 0, impact: 0 };
      serviceMap.set(a.serviceName, {
        count: current.count + 1,
        impact: current.impact + a.impact.costImpact,
      });
    }
    
    const topServices = Array.from(serviceMap.entries())
      .map(([service, data]) => ({ service, ...data }))
      .sort((a, b) => b.impact - a.impact)
      .slice(0, 5);
    
    return { total, critical, high, medium, low, totalImpact, topServices };
  }, [anomalies]);

  // Helper functions
  const getAnomaliesForResource = useCallback((resourceId: string) => {
    return anomalies.filter(a => a.resourceId === resourceId);
  }, [anomalies]);

  const getAnomaliesBySeverity = useCallback((severity: AnomalySeverity) => {
    return anomalies.filter(a => a.severity === severity);
  }, [anomalies]);

  const value: UseAnomaliesReturn = {
    anomalies,
    filteredAnomalies,
    summary,
    isDetecting,
    lastDetection,
    filters,
    setFilters,
    runDetection,
    error,
    getAnomaliesForResource,
    getAnomaliesBySeverity,
  };

  return (
    <AnomalyContext.Provider value={value}>
      {children}
    </AnomalyContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Use the shared anomaly detection system
 * Must be used within an AnomalyProvider
 */
export function useAnomalies(): UseAnomaliesReturn {
  const context = useContext(AnomalyContext);
  if (!context) {
    throw new Error('useAnomalies must be used within an AnomalyProvider');
  }
  return context;
}

/**
 * Standalone hook for simple anomaly access without the provider
 * Useful for components that just need to display anomaly data
 * 
 * STABILITY: This hook is optimized to prevent re-render loops:
 * - useRef tracks if initial load has been done
 * - useCallback has minimal dependencies (empty array)
 * - Effect only runs once on mount, then relies on isReady ref
 */
export function useAnomalySummary() {
  const { isReady } = useSpectrum();
  const [summary, setSummary] = useState<AnomalySummary>({
    total: 0,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    totalImpact: 0,
    topServices: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [recentAnomalies, setRecentAnomalies] = useState<AnomalyResult[]>([]);
  
  // Track if we've already loaded to prevent duplicate calls
  const hasLoadedRef = useRef(false);
  const isLoadingRef = useRef(false);

  // Stable function that reads isReady from closure at call time
  const loadSummary = useCallback(async () => {
    // Prevent concurrent calls
    if (isLoadingRef.current) return;
    
    isLoadingRef.current = true;
    setIsLoading(true);
    
    try {
      // Check if we have cached anomalies
      const cached = localStorage.getItem(ANOMALY_CACHE_KEY);
      if (cached) {
        const { anomalies, timestamp } = JSON.parse(cached);
        const cacheAge = Date.now() - timestamp;
        
        // Use cache if less than 4 hours old
        if (cacheAge < 4 * 60 * 60 * 1000 && anomalies?.length > 0) {
          const rehydrated = anomalies.map((a: AnomalyResult) => ({
            ...a,
            timestamp: new Date(a.timestamp),
          }));
          
          // Calculate summary from cached anomalies
          const total = rehydrated.length;
          const critical = rehydrated.filter((a: AnomalyResult) => a.severity === 'critical').length;
          const high = rehydrated.filter((a: AnomalyResult) => a.severity === 'high').length;
          const medium = rehydrated.filter((a: AnomalyResult) => a.severity === 'medium').length;
          const low = rehydrated.filter((a: AnomalyResult) => a.severity === 'low').length;
          const totalImpact = rehydrated.reduce((sum: number, a: AnomalyResult) => sum + a.impact.costImpact, 0);
          
          // Group by service
          const serviceMap = new Map<string, { count: number; impact: number }>();
          for (const a of rehydrated) {
            const current = serviceMap.get(a.serviceName) || { count: 0, impact: 0 };
            serviceMap.set(a.serviceName, {
              count: current.count + 1,
              impact: current.impact + a.impact.costImpact,
            });
          }
          
          const topServices = Array.from(serviceMap.entries())
            .map(([service, data]) => ({ service, ...data }))
            .sort((a, b) => b.impact - a.impact)
            .slice(0, 5);
          
          setSummary({ total, critical, high, medium, low, totalImpact, topServices });
          
          // Get recent high-severity anomalies
          const recent = rehydrated
            .filter((a: AnomalyResult) => a.severity === 'critical' || a.severity === 'high')
            .slice(0, 5);
          setRecentAnomalies(recent);
          
          hasLoadedRef.current = true;
        }
      }
    } catch (e) {
      console.warn('[AnomalySummary] Failed to load:', e);
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  }, []); // Empty deps - stable callback

  // Only run once when isReady becomes true
  useEffect(() => {
    if (isReady && !hasLoadedRef.current) {
      loadSummary();
    }
  }, [isReady, loadSummary]);

  return { summary, isLoading, recentAnomalies, refresh: loadSummary };
}
