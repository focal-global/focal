'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import * as duckdb from '@duckdb/duckdb-wasm';

// ============================================================================
// Types
// ============================================================================

interface DataSourceInfo {
  tableName: string;
  fileName: string;
  rowCount: number;
  columns: string[];
  source: 'local' | 'azure' | 'aws' | 'gcp';
}

interface UnifiedViewInfo {
  /** Whether the unified view exists */
  exists: boolean;
  /** Total row count across all sources */
  totalRowCount: number;
  /** Columns available in the unified view */
  columns: string[];
  /** List of source tables included in the view */
  sourceTables: string[];
  /** Last time the view was refreshed */
  lastRefreshed: Date | null;
  /** Detected currency from the data (BillingCurrency) */
  detectedCurrency: string | null;
}

interface SpectrumContextValue {
  /** DuckDB instance - null until initialized */
  db: duckdb.AsyncDuckDB | null;
  /** Connection for running queries */
  conn: duckdb.AsyncDuckDBConnection | null;
  /** Whether DuckDB is currently initializing */
  isInitializing: boolean;
  /** Whether DuckDB is ready for queries */
  isReady: boolean;
  /** Whether data sources are currently being loaded */
  isLoadingSources: boolean;
  /** Set the isLoadingSources flag */
  setIsLoadingSources: (loading: boolean) => void;
  /** Any error that occurred during initialization */
  error: Error | null;
  /** List of loaded data sources */
  dataSources: DataSourceInfo[];
  /** Info about the unified FOCUS data view */
  unifiedView: UnifiedViewInfo;
  /** Ingest a file into the virtual filesystem and register as table */
  ingestFile: (file: File, tableName?: string) => Promise<IngestResult>;
  /** Mount a remote Azure Blob via SAS URL and register as table */
  mountRemoteAzureSource: (sasUrl: string, tableName: string) => Promise<MountResult>;
  /** Execute a SQL query and return results */
  query: <T = Record<string, unknown>>(sql: string) => Promise<T[]>;
  /** Execute raw SQL (for DDL statements) */
  executeQuery: (sql: string) => Promise<void>;
  /** List all registered tables */
  listTables: () => Promise<string[]>;
  /** Drop a table from the database */
  dropTable: (tableName: string) => Promise<void>;
  /** Refresh the unified FOCUS view combining all data sources */
  refreshUnifiedView: () => Promise<void>;
}

interface IngestResult {
  success: boolean;
  tableName: string;
  rowCount: number;
  columns: string[];
  error?: string;
}

interface MountResult {
  success: boolean;
  tableName: string;
  rowCount: number;
  columns: string[];
  error?: string;
}

interface SpectrumProviderProps {
  children: ReactNode;
}

// ============================================================================
// Context
// ============================================================================

const SpectrumContext = createContext<SpectrumContextValue | null>(null);

// ============================================================================
// DuckDB Bundle Configuration for Next.js
// ============================================================================

async function initializeDuckDB(): Promise<{
  db: duckdb.AsyncDuckDB;
  conn: duckdb.AsyncDuckDBConnection;
}> {
  // Use locally hosted DuckDB files to avoid CORS issues with COEP headers
  // Files are copied from node_modules to public/duckdb/
  // 
  // NOTE: We use the EH (Exception Handling) bundle instead of COI (Cross-Origin Isolated)
  // because the COI bundle with pthread workers causes memory mismatch errors when loading
  // extensions like parquet. The EH bundle is single-threaded but has better extension support.
  const MANUAL_BUNDLES: duckdb.DuckDBBundles = {
    mvp: {
      mainModule: '/duckdb/duckdb-mvp.wasm',
      mainWorker: '/duckdb/duckdb-browser-mvp.worker.js',
    },
    eh: {
      mainModule: '/duckdb/duckdb-eh.wasm',
      mainWorker: '/duckdb/duckdb-browser-eh.worker.js',
    },
  };

  // Pick the EH bundle (better extension support, no threading issues)
  const bundle = await duckdb.selectBundle(MANUAL_BUNDLES);

  if (!bundle.mainWorker) {
    throw new Error('Failed to resolve DuckDB worker bundle');
  }

  // Instantiate the worker
  const worker = new Worker(bundle.mainWorker);
  const logger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING);

  // Create the DuckDB instance
  const db = new duckdb.AsyncDuckDB(logger, worker);

  // Instantiate with the main module (and pthread worker if available)
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);

  // Open a connection
  const conn = await db.connect();

  // Configure DuckDB for WASM environment with generous memory settings
  await conn.query(`
    SET autoinstall_known_extensions = true;
    SET autoload_known_extensions = true;
    SET memory_limit = '4GB';
    SET preserve_insertion_order = false;
  `);

  // Pre-install and load common extensions for better compatibility
  try {
    await conn.query(`INSTALL parquet; LOAD parquet;`);
    console.log('[Spectrum] Parquet extension loaded successfully');
  } catch (e) {
    console.warn('[Spectrum] Could not pre-load parquet extension:', e);
  }

  return { db, conn };
}

// ============================================================================
// Constants
// ============================================================================

const UNIFIED_VIEW_NAME = 'focus_data';

// ============================================================================
// Provider Component
// ============================================================================

export function SpectrumProvider({ children }: SpectrumProviderProps) {
  const [db, setDb] = useState<duckdb.AsyncDuckDB | null>(null);
  const [conn, setConn] = useState<duckdb.AsyncDuckDBConnection | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [isLoadingSources, setIsLoadingSources] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [dataSources, setDataSources] = useState<DataSourceInfo[]>([]);
  const [unifiedView, setUnifiedView] = useState<UnifiedViewInfo>({
    exists: false,
    totalRowCount: 0,
    columns: [],
    sourceTables: [],
    lastRefreshed: null,
    detectedCurrency: null,
  });

  // Track registered files to avoid duplicates
  const registeredFiles = useRef<Set<string>>(new Set());

  // Initialize DuckDB on mount
  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        // Check for SharedArrayBuffer support
        if (typeof SharedArrayBuffer === 'undefined') {
          throw new Error(
            'SharedArrayBuffer is not available. Ensure COOP/COEP headers are configured.'
          );
        }

        const { db: database, conn: connection } = await initializeDuckDB();

        if (mounted) {
          setDb(database);
          setConn(connection);
          setIsReady(true);
          setIsInitializing(false);
          console.log('[Spectrum] DuckDB-WASM initialized successfully');
        }
      } catch (err) {
        console.error('[Spectrum] Failed to initialize DuckDB:', err);
        if (mounted) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setIsInitializing(false);
        }
      }
    }

    init();

    // Listen for storage manager close connection events
    const handleCloseConnections = () => {
      console.log('[Spectrum] Received close connections request from Storage Manager');
      conn?.close();
      db?.terminate();
    };

    window.addEventListener('focal:close-duckdb-connections', handleCloseConnections);

    // Cleanup on unmount
    return () => {
      mounted = false;
      conn?.close();
      db?.terminate();
      window.removeEventListener('focal:close-duckdb-connections', handleCloseConnections);
    };
  }, []);

  // ============================================================================
  // Storage Mode Integration
  // ============================================================================

  useEffect(() => {
    // Check storage mode on initialization
    if (typeof window !== 'undefined') {
      const settings = localStorage.getItem('focal_storage_settings');
      if (settings) {
        try {
          const parsed = JSON.parse(settings);
          if (parsed.mode === 'EPHEMERAL') {
            console.log('[Spectrum] Operating in EPHEMERAL mode - memory-only storage');
            // Future: Configure DuckDB to use memory-only mode
          }
        } catch (error) {
          console.warn('[Spectrum] Could not parse storage settings:', error);
        }
      }
    }
  }, []);

  // ============================================================================
  // Ingest File Function
  // ============================================================================

  const ingestFile = useCallback(
    async (file: File, tableName?: string): Promise<IngestResult> => {
      if (!db || !conn) {
        return {
          success: false,
          tableName: '',
          rowCount: 0,
          columns: [],
          error: 'DuckDB is not initialized',
        };
      }

      // Generate table name from file name if not provided
      const sanitizedName =
        tableName ||
        file.name
          .replace(/\.[^/.]+$/, '') // Remove extension
          .replace(/[^a-zA-Z0-9_]/g, '_') // Replace invalid chars
          .replace(/^[0-9]/, '_$&') // Prefix if starts with number
          .toLowerCase();

      const fileName = `/${sanitizedName}_${Date.now()}`;

      try {
        // Read file as ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        // Register file in DuckDB's virtual filesystem
        await db.registerFileBuffer(fileName, uint8Array);
        registeredFiles.current.add(fileName);

        // Determine file type and create table
        const extension = file.name.split('.').pop()?.toLowerCase();
        let createTableSQL: string;

        switch (extension) {
          case 'parquet':
            // Ensure parquet extension is loaded before reading
            try {
              await conn.query(`LOAD parquet;`);
            } catch (e) {
              console.log('[Spectrum] Parquet extension already loaded or will autoload');
            }
            createTableSQL = `
              CREATE OR REPLACE TABLE "${sanitizedName}" AS 
              SELECT * FROM read_parquet('${fileName}')
            `;
            break;

          case 'csv':
          case 'tsv':
          case 'txt':
            // Use flexible CSV parsing options to handle various formats
            createTableSQL = `
              CREATE OR REPLACE TABLE "${sanitizedName}" AS 
              SELECT * FROM read_csv('${fileName}', 
                header = true,
                auto_detect = true,
                ignore_errors = true,
                null_padding = true,
                all_varchar = true
              )
            `;
            break;

          case 'json':
          case 'jsonl':
          case 'ndjson':
            createTableSQL = `
              CREATE OR REPLACE TABLE "${sanitizedName}" AS 
              SELECT * FROM read_json_auto('${fileName}')
            `;
            break;

          default:
            // Try CSV with flexible options as fallback
            createTableSQL = `
              CREATE OR REPLACE TABLE "${sanitizedName}" AS 
              SELECT * FROM read_csv('${fileName}', 
                header = true,
                auto_detect = true,
                ignore_errors = true,
                null_padding = true,
                all_varchar = true
              )
            `;
        }

        // Execute the CREATE TABLE statement
        try {
          await conn.query(createTableSQL);
        } catch (parseError) {
          // If parquet fails, provide a helpful error message
          if (extension === 'parquet') {
            throw new Error(
              `Parquet file parsing failed. This may be due to WASM compatibility issues. ` +
              `Consider converting your Parquet file to CSV format using: ` +
              `'duckdb -c "COPY (SELECT * FROM read_parquet(\'file.parquet\')) TO \'file.csv\' (HEADER)"' ` +
              `Original error: ${parseError instanceof Error ? parseError.message : String(parseError)}`
            );
          }
          throw parseError;
        }

        // Get row count
        const countResult = await conn.query(
          `SELECT COUNT(*) as count FROM "${sanitizedName}"`
        );
        const rowCount = Number(countResult.toArray()[0]?.count ?? 0);

        // Get column names
        const schemaResult = await conn.query(
          `DESCRIBE "${sanitizedName}"`
        );
        const columns = schemaResult
          .toArray()
          .map((row) => String(row.column_name));

        console.log(
          `[Spectrum] Ingested "${file.name}" as table "${sanitizedName}" (${rowCount} rows)`
        );

        // Add to dataSources state
        setDataSources((prev) => [
          ...prev.filter((ds) => ds.tableName !== sanitizedName),
          {
            tableName: sanitizedName,
            fileName: file.name,
            rowCount,
            columns,
            source: 'local',
          },
        ]);

        return {
          success: true,
          tableName: sanitizedName,
          rowCount,
          columns,
        };
      } catch (err) {
        console.error('[Spectrum] Failed to ingest file:', err);
        return {
          success: false,
          tableName: sanitizedName,
          rowCount: 0,
          columns: [],
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
    [db, conn]
  );

  // ============================================================================
  // Query Function
  // ============================================================================

  const query = useCallback(
    async <T = Record<string, unknown>>(sql: string): Promise<T[]> => {
      if (!conn) {
        throw new Error('DuckDB is not initialized');
      }

      const result = await conn.query(sql);
      const rows = result.toArray();
      
      // Convert BigInt values to numbers
      // DuckDB-WASM returns DECIMAL as BigInt (scaled integers)
      // We need to handle this for JavaScript compatibility
      return rows.map((row) => {
        const converted: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(row as Record<string, unknown>)) {
          if (typeof value === 'bigint') {
            // For BigInt, convert to Number
            // Note: This may lose precision for values > Number.MAX_SAFE_INTEGER
            // but cloud cost data should fit within safe integer range
            converted[key] = Number(value);
          } else {
            converted[key] = value;
          }
        }
        return converted as T;
      });
    },
    [conn]
  );

  // ============================================================================
  // List Tables Function
  // ============================================================================

  const listTables = useCallback(async (): Promise<string[]> => {
    if (!conn) {
      return [];
    }

    const result = await conn.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'main'
    `);

    return result.toArray().map((row) => String(row.table_name));
  }, [conn]);

  // ============================================================================
  // Drop Table Function
  // ============================================================================

  const dropTable = useCallback(
    async (tableName: string): Promise<void> => {
      if (!conn) {
        throw new Error('DuckDB is not initialized');
      }

      // Try dropping as view first, then as table
      await conn.query(`DROP VIEW IF EXISTS "${tableName}"`);
      await conn.query(`DROP TABLE IF EXISTS "${tableName}"`);
      
      // Remove from dataSources state
      setDataSources((prev) => prev.filter((ds) => ds.tableName !== tableName));
      
      console.log(`[Spectrum] Dropped "${tableName}"`);
    },
    [conn]
  );

  // ============================================================================
  // Mount Remote Azure Source (Valet Key Pattern)
  // ============================================================================

  const mountRemoteAzureSource = useCallback(
    async (sasUrl: string, tableName: string): Promise<MountResult> => {
      if (!db || !conn) {
        return {
          success: false,
          tableName,
          rowCount: 0,
          columns: [],
          error: 'DuckDB is not initialized',
        };
      }

      // Sanitize table name
      const sanitizedName = tableName
        .replace(/[^a-zA-Z0-9_]/g, '_')
        .replace(/^[0-9]/, '_$&')
        .toLowerCase();

      // Generate a unique file handle
      const fileHandle = `/remote_${sanitizedName}_${Date.now()}`;

      try {
        // Determine file type from URL (before query params)
        const urlPath = sasUrl.split('?')[0];
        const extension = urlPath.split('.').pop()?.toLowerCase();

        console.log(`[Spectrum] Fetching remote file: ${urlPath.split('/').pop()} (${extension})`);

        // Fetch the file using Fetch API (better CORS handling than XMLHttpRequest)
        // Azure SAS URLs work with fetch when the SAS token includes proper permissions
        const response = await fetch(sasUrl, {
          method: 'GET',
          mode: 'cors',
        });

        if (!response.ok) {
          // Return error result instead of throwing to prevent React error overlay
          let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          if (response.status === 404) {
            errorMessage = 'Blob not found. The file may have been moved or deleted.';
          } else if (response.status === 403) {
            errorMessage = 'Access denied. The SAS token may be expired or invalid.';
          }
          console.warn(`[Spectrum] Failed to fetch ${urlPath.split('/').pop()}: ${errorMessage}`);
          return {
            success: false,
            tableName: sanitizedName,
            rowCount: 0,
            columns: [],
            error: errorMessage,
          };
        }

        // Convert to ArrayBuffer and register as local file
        const arrayBuffer = await response.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        // Register file in DuckDB's virtual filesystem as a local buffer
        await db.registerFileBuffer(fileHandle, uint8Array);
        registeredFiles.current.add(fileHandle);

        console.log(
          `[Spectrum] Downloaded and registered file: ${fileHandle} (${(uint8Array.length / 1024 / 1024).toFixed(2)} MB)`
        );

        // Build the CREATE VIEW query based on file type
        // Using VIEW instead of TABLE to avoid copying data into memory
        let createViewSQL: string;
        let readFunction: string;

        switch (extension) {
          case 'parquet':
            // Ensure parquet extension is loaded before reading
            try {
              await conn.query(`LOAD parquet;`);
            } catch (e) {
              console.log('[Spectrum] Parquet extension already loaded or will autoload');
            }
            readFunction = `read_parquet('${fileHandle}')`;
            break;

          case 'csv':
          case 'gz': // Handle .csv.gz
            readFunction = `read_csv('${fileHandle}', 
                header = true,
                auto_detect = true,
                ignore_errors = true,
                null_padding = true
              )`;
            break;

          case 'json':
          case 'jsonl':
          case 'ndjson':
            readFunction = `read_json_auto('${fileHandle}')`;
            break;

          default:
            // Default to CSV for unknown formats
            readFunction = `read_csv('${fileHandle}', 
                header = true,
                auto_detect = true,
                ignore_errors = true,
                null_padding = true
              )`;
        }

        // Create a VIEW that references the file directly (no data copy)
        createViewSQL = `
          CREATE OR REPLACE VIEW "${sanitizedName}" AS 
          SELECT * FROM ${readFunction}
        `;

        // Execute the CREATE VIEW
        await conn.query(createViewSQL);

        // Get row count to verify successful data load
        const countResult = await conn.query(
          `SELECT COUNT(*) as count FROM "${sanitizedName}"`
        );
        const rowCount = Number(countResult.toArray()[0]?.count ?? 0);

        // Get column schema
        const schemaResult = await conn.query(`DESCRIBE "${sanitizedName}"`);
        const columns = schemaResult
          .toArray()
          .map((row) => String(row.column_name));

        console.log(
          `[Spectrum] Mounted Azure source "${sanitizedName}" (${rowCount} rows, ${columns.length} columns)`
        );

        // Add to dataSources state (reuse urlPath from earlier in the function)
        const fileName = urlPath.split('/').pop() || sanitizedName;
        setDataSources((prev) => [
          ...prev.filter((ds) => ds.tableName !== sanitizedName),
          {
            tableName: sanitizedName,
            fileName,
            rowCount,
            columns,
            source: 'azure',
          },
        ]);

        return {
          success: true,
          tableName: sanitizedName,
          rowCount,
          columns,
        };
      } catch (err) {
        console.error('[Spectrum] Failed to mount Azure source:', err);

        // Clean up registered file on error
        registeredFiles.current.delete(fileHandle);

        // Provide helpful error messages
        let errorMessage = err instanceof Error ? err.message : String(err);

        if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
          errorMessage = 'Access denied. The SAS token may be expired or invalid.';
        } else if (errorMessage.includes('404') || errorMessage.includes('Not Found')) {
          errorMessage = 'Blob not found. Check the file path and container name.';
        } else if (errorMessage.includes('CORS')) {
          errorMessage = 'CORS error. Ensure the Azure Storage account has CORS configured for this origin.';
        }

        return {
          success: false,
          tableName: sanitizedName,
          rowCount: 0,
          columns: [],
          error: errorMessage,
        };
      }
    },
    [db, conn]
  );

  // ============================================================================
  // Context Value
  // ============================================================================

  // Execute raw SQL for DDL statements
  const executeQuery = useCallback(
    async (sql: string): Promise<void> => {
      if (!conn) {
        throw new Error('DuckDB is not initialized');
      }
      await conn.query(sql);
    },
    [conn]
  );

  // ============================================================================
  // Refresh Unified View (combines all data sources)
  // ============================================================================

  const refreshUnifiedView = useCallback(async (): Promise<void> => {
    if (!conn) {
      throw new Error('DuckDB is not initialized');
    }

    // Get all views/tables (excluding our unified view)
    const result = await conn.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'main' 
        AND table_name != '${UNIFIED_VIEW_NAME}'
        AND table_name LIKE 'focus_%'
    `);
    const tables = result.toArray().map((row) => String(row.table_name));

    if (tables.length === 0) {
      // No tables to combine, drop the view if it exists
      await conn.query(`DROP VIEW IF EXISTS "${UNIFIED_VIEW_NAME}"`);
      setUnifiedView({
        exists: false,
        totalRowCount: 0,
        columns: [],
        sourceTables: [],
        lastRefreshed: null,
        detectedCurrency: null,
      });
      console.log('[Spectrum] No tables to combine, unified view cleared');
      return;
    }

    // Get columns from first table to use as reference
    const firstTableSchema = await conn.query(`DESCRIBE "${tables[0]}"`);
    const referenceColumns = firstTableSchema
      .toArray()
      .map((row) => String(row.column_name));

    // Build UNION ALL query with only the common columns
    // This handles cases where tables have different schemas
    const selectColumns = referenceColumns.map((col) => `"${col}"`).join(', ');
    
    const unionParts = tables.map((tableName) => 
      `SELECT ${selectColumns}, '${tableName}' as _source_table FROM "${tableName}"`
    );
    
    const unionQuery = unionParts.join('\n  UNION ALL\n  ');

    // Create the unified view
    try {
      await conn.query(`DROP VIEW IF EXISTS "${UNIFIED_VIEW_NAME}"`);
      await conn.query(`
        CREATE VIEW "${UNIFIED_VIEW_NAME}" AS
        ${unionQuery}
      `);

      // Get row count
      const countResult = await conn.query(
        `SELECT COUNT(*) as count FROM "${UNIFIED_VIEW_NAME}"`
      );
      const totalRowCount = Number(countResult.toArray()[0]?.count ?? 0);

      // Get columns from the view
      const viewSchema = await conn.query(`DESCRIBE "${UNIFIED_VIEW_NAME}"`);
      const columns = viewSchema.toArray().map((row) => String(row.column_name));

      // Detect currency from data (sample first 100 rows)
      let detectedCurrency: string | null = null;
      if (columns.includes('BillingCurrency') || columns.includes('billingcurrency')) {
        try {
          const currencyResult = await conn.query(`
            SELECT BillingCurrency, COUNT(*) as cnt 
            FROM "${UNIFIED_VIEW_NAME}" 
            WHERE BillingCurrency IS NOT NULL 
            GROUP BY BillingCurrency 
            ORDER BY cnt DESC 
            LIMIT 1
          `);
          const currencyRows = currencyResult.toArray();
          if (currencyRows.length > 0 && currencyRows[0].BillingCurrency) {
            detectedCurrency = String(currencyRows[0].BillingCurrency).toUpperCase();
            console.log(`[Spectrum] Detected currency from data: ${detectedCurrency}`);
          }
        } catch (e) {
          console.warn('[Spectrum] Failed to detect currency:', e);
        }
      }

      setUnifiedView({
        exists: true,
        totalRowCount,
        columns,
        sourceTables: tables,
        lastRefreshed: new Date(),
        detectedCurrency,
      });

      console.log(
        `[Spectrum] Unified view "${UNIFIED_VIEW_NAME}" created: ${totalRowCount} rows from ${tables.length} tables`
      );
    } catch (err) {
      console.error('[Spectrum] Failed to create unified view:', err);
      
      // Try a simpler approach - just use the first table as fallback
      if (tables.length === 1) {
        await conn.query(`
          CREATE VIEW "${UNIFIED_VIEW_NAME}" AS
          SELECT *, '${tables[0]}' as _source_table FROM "${tables[0]}"
        `);
        
        const countResult = await conn.query(
          `SELECT COUNT(*) as count FROM "${UNIFIED_VIEW_NAME}"`
        );
        const totalRowCount = Number(countResult.toArray()[0]?.count ?? 0);

        // Detect currency for single table
        let detectedCurrency: string | null = null;
        try {
          const currencyResult = await conn.query(`
            SELECT BillingCurrency, COUNT(*) as cnt 
            FROM "${UNIFIED_VIEW_NAME}" 
            WHERE BillingCurrency IS NOT NULL 
            GROUP BY BillingCurrency 
            ORDER BY cnt DESC 
            LIMIT 1
          `);
          const currencyRows = currencyResult.toArray();
          if (currencyRows.length > 0 && currencyRows[0].BillingCurrency) {
            detectedCurrency = String(currencyRows[0].BillingCurrency).toUpperCase();
          }
        } catch {
          // Currency detection failed, continue without it
        }

        setUnifiedView({
          exists: true,
          totalRowCount,
          columns: [...referenceColumns, '_source_table'],
          sourceTables: tables,
          lastRefreshed: new Date(),
          detectedCurrency,
        });
        
        console.log(`[Spectrum] Unified view created from single table: ${totalRowCount} rows`);
      } else {
        throw err;
      }
    }
  }, [conn]);

  const value: SpectrumContextValue = {
    db,
    conn,
    isInitializing,
    isReady,
    isLoadingSources,
    setIsLoadingSources,
    error,
    dataSources,
    unifiedView,
    ingestFile,
    mountRemoteAzureSource,
    query,
    executeQuery,
    listTables,
    dropTable,
    refreshUnifiedView,
  };

  // Expose context to window for debugging (development only)
  useEffect(() => {
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      (window as unknown as Record<string, unknown>).__SPECTRUM_CTX__ = value;
    }
  }, [value]);

  return (
    <SpectrumContext.Provider value={value}>
      {children}
    </SpectrumContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useSpectrum(): SpectrumContextValue {
  const context = useContext(SpectrumContext);

  if (!context) {
    throw new Error('useSpectrum must be used within a SpectrumProvider');
  }

  return context;
}

// Export types for consumers
export type { SpectrumContextValue, IngestResult, MountResult, UnifiedViewInfo };

// Export the unified view name constant
export { UNIFIED_VIEW_NAME };
