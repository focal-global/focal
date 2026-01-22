/**
 * Enhanced Spectrum Provider with Enrichment Pipeline
 * 
 * Extends the existing spectrum provider to include automatic data enrichment
 * using the Focal enrichment pipeline system.
 */

import { createContext, useContext, useCallback, useMemo, useState } from 'react';
import * as duckdb from '@duckdb/duckdb-wasm';
import { useSpectrum } from './spectrum-provider';
import { 
  createFullEnrichmentPipeline, 
  InMemoryCacheProvider,
  generateExecutionId,
  type PipelineContext,
  type RawBillingData,
  type EnrichedData
} from '../../engine';

// ============================================================================
// Types
// ============================================================================

interface EnrichedSpectrumContextValue {
  /** Original spectrum context */
  spectrum: ReturnType<typeof useSpectrum>;
  /** Enrichment pipeline instance */
  pipeline: ReturnType<typeof createFullEnrichmentPipeline> | null;
  /** Cache provider for pipeline results */
  cache: InMemoryCacheProvider;
  /** Execute enrichment pipeline on raw data */
  enrichData: (rawData: RawBillingData, userId: string, orgId: string) => Promise<EnrichedData | null>;
  /** Get enriched query results with all enhancements applied */
  queryEnriched: <T = Record<string, unknown>>(sql: string) => Promise<T[]>;
  /** Pipeline execution statistics */
  pipelineStats: {
    lastExecutionId: string | null;
    lastExecutionTime: number | null;
    totalEnrichments: number;
  };
}

// ============================================================================
// Context
// ============================================================================

const EnrichedSpectrumContext = createContext<EnrichedSpectrumContextValue | null>(null);

// ============================================================================
// Provider Component
// ============================================================================

interface EnrichedSpectrumProviderProps {
  children: React.ReactNode;
}

export function EnrichedSpectrumProvider({ children }: EnrichedSpectrumProviderProps) {
  const spectrum = useSpectrum();
  
  // Initialize pipeline and cache
  const pipeline = useMemo(() => {
    if (!spectrum.isReady) return null;
    return createFullEnrichmentPipeline();
  }, [spectrum.isReady]);

  const cache = useMemo(() => new InMemoryCacheProvider(), []);

  // Pipeline execution statistics
  const [pipelineStats, setPipelineStats] = useState({
    lastExecutionId: null as string | null,
    lastExecutionTime: null as number | null,
    totalEnrichments: 0
  });

  /**
   * Enrich raw billing data using the pipeline
   */
  const enrichData = useCallback(async (
    rawData: RawBillingData,
    userId: string,
    orgId: string
  ): Promise<EnrichedData | null> => {
    if (!pipeline || !spectrum.conn || !spectrum.db) {
      console.warn('[EnrichedSpectrum] Pipeline or DuckDB not ready');
      return null;
    }

    const executionId = generateExecutionId();
    const startTime = performance.now();

    try {
      const context: PipelineContext = {
        duckdb: spectrum.conn,
        cache,
        metadata: {
          source: rawData.source.provider,
          fileName: rawData.source.fileName
        },
        userId,
        orgId,
        executionId
      };

      console.log(`[EnrichedSpectrum] Starting enrichment pipeline: ${executionId}`);
      
      const result = await pipeline.execute(rawData, context);
      const executionTime = performance.now() - startTime;

      if (result.success && result.data) {
        setPipelineStats(prev => ({
          lastExecutionId: executionId,
          lastExecutionTime: executionTime,
          totalEnrichments: prev.totalEnrichments + 1
        }));

        console.log(`[EnrichedSpectrum] ✅ Enrichment completed in ${executionTime.toFixed(1)}ms`);
        return result.data;
      } else {
        console.error(`[EnrichedSpectrum] ❌ Enrichment failed:`, result.error);
        return null;
      }

    } catch (error) {
      const executionTime = performance.now() - startTime;
      console.error(`[EnrichedSpectrum] ❌ Pipeline error (${executionTime.toFixed(1)}ms):`, error);
      return null;
    }
  }, [pipeline, spectrum.conn, spectrum.db, cache]);

  /**
   * Execute a query with automatic enrichment context
   */
  const queryEnriched = useCallback(async <T = Record<string, unknown>>(
    sql: string
  ): Promise<T[]> => {
    if (!spectrum.conn) {
      throw new Error('DuckDB connection not ready');
    }

    try {
      const result = await spectrum.conn.query(sql);
      return result.toArray().map(row => row.toJSON()) as T[];
    } catch (error) {
      console.error('[EnrichedSpectrum] Query error:', error);
      throw error;
    }
  }, [spectrum.conn]);

  const contextValue: EnrichedSpectrumContextValue = {
    spectrum,
    pipeline,
    cache,
    enrichData,
    queryEnriched,
    pipelineStats
  };

  return (
    <EnrichedSpectrumContext.Provider value={contextValue}>
      {children}
    </EnrichedSpectrumContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useEnrichedSpectrum(): EnrichedSpectrumContextValue {
  const context = useContext(EnrichedSpectrumContext);
  if (!context) {
    throw new Error('useEnrichedSpectrum must be used within an EnrichedSpectrumProvider');
  }
  return context;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert query results to RawBillingData format
 */
export function queryResultsToRawBillingData(
  rows: Record<string, unknown>[],
  source: RawBillingData['source']
): RawBillingData {
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
  
  return {
    rows,
    source,
    schema: {
      columns,
      rowCount: rows.length,
      estimatedSize: JSON.stringify(rows).length
    }
  };
}

/**
 * Helper to create enriched views in DuckDB for advanced analytics
 */
export async function createEnrichedView(
  conn: duckdb.AsyncDuckDBConnection,
  enrichedData: EnrichedData,
  viewName: string = 'enriched_billing'
): Promise<void> {
  // Create base billing view
  const baseRows = enrichedData.rows.slice(0, 10000);
  if (baseRows.length === 0) return;

  const columns = enrichedData.schema.columns.map(col => `"${col}"`).join(', ');
  const valuesClause = baseRows.map(row => {
    const values = Object.values(row).map(val => {
      if (val === null || val === undefined) return 'NULL';
      if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
      if (typeof val === 'number') return String(val);
      return `'${String(val).replace(/'/g, "''")}'`;
    });
    return `(${values.join(', ')})`;
  }).join(',\n');

  await conn.query(`
    CREATE OR REPLACE VIEW ${viewName} AS
    SELECT * FROM (VALUES ${valuesClause})
    AS t(${columns})
  `);

  // Add virtual tags if available
  if (enrichedData.virtualTags && enrichedData.virtualTags.length > 0) {
    const tagValuesClause = enrichedData.virtualTags.map(vt => {
      const resourceId = `'${vt.resourceId.replace(/'/g, "''")}'`;
      const tags = `'${JSON.stringify(vt.tags).replace(/'/g, "''")}'`;
      const appliedBy = `'${vt.appliedBy.replace(/'/g, "''")}'`;
      return `(${resourceId}, ${tags}, '${vt.appliedAt.toISOString()}', ${appliedBy})`;
    }).join(',\n');

    await conn.query(`
      CREATE OR REPLACE VIEW ${viewName}_virtual_tags AS
      SELECT * FROM (VALUES ${tagValuesClause})
      AS t(ResourceId, Tags, AppliedAt, AppliedBy)
    `);
  }

  // Add CO2 data if available
  if (enrichedData.co2Data && enrichedData.co2Data.length > 0) {
    const co2ValuesClause = enrichedData.co2Data.map(co2 => {
      const resourceId = `'${co2.resourceId.replace(/'/g, "''")}'`;
      return `(${resourceId}, ${co2.estimatedKgCO2}, ${co2.confidence}, '${co2.coefficient}', '${co2.region}')`;
    }).join(',\n');

    await conn.query(`
      CREATE OR REPLACE VIEW ${viewName}_co2 AS
      SELECT * FROM (VALUES ${co2ValuesClause})
      AS t(ResourceId, EstimatedKgCO2, Confidence, CoefficientSource, Region)
    `);
  }

  // Add AI classification if available
  if (enrichedData.aiClassification && enrichedData.aiClassification.length > 0) {
    const aiValuesClause = enrichedData.aiClassification.map(ai => {
      const resourceId = `'${ai.resourceId.replace(/'/g, "''")}'`;
      const tokens = ai.estimatedTokens ? String(ai.estimatedTokens) : 'NULL';
      return `(${resourceId}, ${ai.isAIRelated}, ${ai.confidence}, '${ai.category}', ${tokens})`;
    }).join(',\n');

    await conn.query(`
      CREATE OR REPLACE VIEW ${viewName}_ai AS
      SELECT * FROM (VALUES ${aiValuesClause})
      AS t(ResourceId, IsAIRelated, Confidence, Category, EstimatedTokens)
    `);
  }

  console.log(`[EnrichedSpectrum] Created enriched views: ${viewName}*`);
}