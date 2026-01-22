/**
 * Data Detection Hook
 * 
 * Provides consistent data availability detection across the app
 */

import { useState, useEffect, useCallback } from 'react';
import { useSpectrum, UNIFIED_VIEW_NAME } from '@/components/providers/spectrum-provider';

interface DataState {
  /** Whether data is available */
  hasData: boolean;
  /** Whether we're checking for data */
  isChecking: boolean;
  /** Error if data check failed */
  error: string | null;
  /** Row count if available */
  rowCount?: number;
  /** Date range of available data */
  dateRange?: {
    earliest: string;
    latest: string;
  };
}

export function useDataDetection(checkInterval = 30000) {
  const { isReady, query } = useSpectrum();
  const [dataState, setDataState] = useState<DataState>({
    hasData: false,
    isChecking: false,
    error: null,
  });

  const checkDataAvailability = useCallback(async () => {
    if (!isReady) return;

    setDataState(prev => ({ ...prev, isChecking: true, error: null }));

    try {
      // First check if unified view exists and has data
      const rowCountResult = await query<{ count: number }>(`
        SELECT COUNT(*) as count 
        FROM ${UNIFIED_VIEW_NAME}
      `);

      const rowCount = rowCountResult[0]?.count || 0;
      const hasData = rowCount > 0;

      let dateRange: DataState['dateRange'] = undefined;

      if (hasData) {
        // Get date range of available data
        try {
          const dateRangeResult = await query<{
            earliest: string;
            latest: string;
          }>(`
            SELECT 
              MIN(ChargePeriodStart) as earliest,
              MAX(ChargePeriodEnd) as latest
            FROM ${UNIFIED_VIEW_NAME}
          `);

          if (dateRangeResult[0]) {
            dateRange = {
              earliest: dateRangeResult[0].earliest,
              latest: dateRangeResult[0].latest,
            };
          }
        } catch (dateErr) {
          console.warn('[DataDetection] Could not get date range:', dateErr);
        }
      }

      setDataState({
        hasData,
        isChecking: false,
        error: null,
        rowCount,
        dateRange,
      });

    } catch (error) {
      console.warn('[DataDetection] Data check failed:', error);
      setDataState({
        hasData: false,
        isChecking: false,
        error: error instanceof Error ? error.message : 'Failed to check data',
        rowCount: 0,
      });
    }
  }, [isReady, query]);

  // Initial check and periodic refresh
  useEffect(() => {
    if (isReady) {
      checkDataAvailability();
      
      if (checkInterval > 0) {
        const interval = setInterval(checkDataAvailability, checkInterval);
        return () => clearInterval(interval);
      }
    }
  }, [isReady, checkDataAvailability, checkInterval]);

  return {
    ...dataState,
    refresh: checkDataAvailability,
  };
}