'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  Search,
  Play,
  Loader2,
  Database,
  Calendar,
  Table as TableIcon,
  AlertCircle,
  CheckCircle,
  Copy,
  Download,
  ChevronRight,
  BarChart3,
  Filter,
  X,
  PieChart,
  LineChart,
  GitMerge,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useSpectrum, UNIFIED_VIEW_NAME } from '@/components/providers/spectrum-provider';
import { generateAzureSasUrl } from '@/actions/azure';
import {
  FOCUS_CATEGORIES,
  FOCUS_QUERIES,
  type FocusCategory,
  type FocusQuery,
  getQueriesByCategory,
  getCategoryInfo,
  searchQueries,
  buildQuery,
  isQueryCompatible,
  getQueryCountByCategory,
} from '@/lib/focus-queries';
import { CostBreakdownChart, CostTrendChart, CostTreemap, CostTopologyGraph, transformToTopologyNodes, DrillDownPanel, useDrillDown } from '@/components/charts';
import { SavedViewsPanel } from '@/components/SavedViewsPanel';
import {
  formatCurrency as formatCurrencyValue,
  isCostColumn,
  getCurrencyFromRow,
  SUPPORTED_CURRENCIES,
  loadCurrencySettings,
  saveCurrencySettings,
  type CurrencySettings,
} from '@/lib/currency';
import type { DataSource, DataSourceConfig } from '@/db/schema';

// ============================================================================
// Types
// ============================================================================

interface SavedDataSourceWithConnector extends DataSource {
  connector: { name: string; provider: string } | null;
}

interface AnalyticsClientProps {
  dataSources: SavedDataSourceWithConnector[];
}

interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  executionTime: number;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format a date for display
 */
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Get default date range (last 30 days)
 */
function getDefaultDateRange(): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return {
    start: formatDate(start),
    end: formatDate(end),
  };
}

/**
 * Export results to CSV
 */
function exportToCSV(results: QueryResult, filename: string): void {
  const headers = results.columns.join(',');
  const rows = results.rows.map((row) =>
    results.columns
      .map((col) => {
        const val = row[col];
        if (val === null || val === undefined) return '';
        if (typeof val === 'string' && val.includes(',')) return `"${val}"`;
        return String(val);
      })
      .join(',')
  );
  const csv = [headers, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Format number for display (handles BigInt from DuckDB)
 */
function formatNumber(value: unknown): string {
  if (value === null || value === undefined) return '-';
  
  // Handle BigInt
  if (typeof value === 'bigint') {
    return value.toLocaleString();
  }
  
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return value.toLocaleString();
    return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  }
  return String(value);
}

/**
 * Format a cell value based on column name and row context
 * Uses detected currency from data or falls back to user settings
 */
function formatCellValue(
  value: unknown, 
  columnName: string, 
  row: Record<string, unknown>,
  defaultCurrency: string
): string {
  // For cost columns, use currency formatting
  if (isCostColumn(columnName)) {
    // Try to find BillingCurrency in the same row first
    const rowCurrency = getCurrencyFromRow(row);
    const currency = rowCurrency || defaultCurrency;
    return formatCurrencyValue(value, currency);
  }
  
  // Default formatting
  return formatNumber(value);
}

/**
 * Prepare chart data from query results
 * Detects the best label and value columns for visualization
 */
function prepareChartData(
  result: QueryResult
): { name: string; value: number }[] {
  if (!result.rows.length || result.columns.length < 2) return [];
  
  // Find the label column (first non-numeric column)
  const labelColumn = result.columns.find((col) => {
    const firstValue = result.rows[0][col];
    return typeof firstValue === 'string' || firstValue === null;
  }) || result.columns[0];
  
  // Find the value column (prefer cost columns, then any numeric)
  const valueColumn = result.columns.find((col) => isCostColumn(col)) ||
    result.columns.find((col) => {
      const firstValue = result.rows[0][col];
      return typeof firstValue === 'number' || typeof firstValue === 'bigint';
    }) || result.columns[1];
  
  return result.rows.slice(0, 20).map((row) => ({
    name: String(row[labelColumn] || 'Unknown'),
    value: Number(row[valueColumn]) || 0,
  }));
}

/**
 * Prepare time series data from query results
 * Looks for date columns and cost values
 */
function prepareTimeSeriesData(
  result: QueryResult
): { date: string; billedCost: number }[] {
  if (!result.rows.length) return [];
  
  // Find date-like column
  const dateColumn = result.columns.find((col) => 
    col.toLowerCase().includes('date') ||
    col.toLowerCase().includes('day') ||
    col.toLowerCase().includes('month') ||
    col.toLowerCase().includes('period')
  ) || result.columns[0];
  
  // Find cost column
  const costColumn = result.columns.find((col) => isCostColumn(col)) ||
    result.columns.find((col) => {
      const firstValue = result.rows[0][col];
      return typeof firstValue === 'number' || typeof firstValue === 'bigint';
    });
  
  if (!costColumn) return [];
  
  return result.rows.map((row) => ({
    date: String(row[dateColumn] || ''),
    billedCost: Number(row[costColumn]) || 0,
  }));
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * Generate a table name from blob path - sanitized for SQL
 * Uses the date range folder (e.g., 20250101-20250131) to create unique names
 * because all parquet files have the same filename (part_0_0001.snappy.parquet)
 */
function generateTableName(blobPath: string): string {
  // Extract the date range folder from the path
  // Path format: focus-costs/bifinops-focus-cost/20250101-20250131/uuid/part_0_0001.snappy.parquet
  const parts = blobPath.split('/');
  
  // Find the date range folder (format: YYYYMMDD-YYYYMMDD)
  const dateRangeFolder = parts.find(part => /^\d{8}-\d{8}$/.test(part));
  
  if (dateRangeFolder) {
    // Use date range as table name: focus_20250101_20250131
    return `focus_${dateRangeFolder.replace('-', '_')}`;
  }
  
  // Fallback: use file name with a timestamp to avoid collisions
  const fileName = parts.pop() || blobPath;
  return fileName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_]/g, '_') + '_' + Date.now();
}

export function AnalyticsClient({ dataSources }: AnalyticsClientProps) {
  const { isReady, query: executeQuery, unifiedView, refreshUnifiedView, mountRemoteAzureSource } = useSpectrum();

  // State
  const [selectedCategory, setSelectedCategory] = useState<FocusCategory | 'all'>('all');
  const [selectedQuery, setSelectedQuery] = useState<FocusQuery | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState(getDefaultDateRange);
  
  // Query execution state
  const [isExecuting, setIsExecuting] = useState(false);
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [executedSQL, setExecutedSQL] = useState<string>('');
  
  // Results view mode: table, pie, bar, treemap, or topology
  const [resultsViewMode, setResultsViewMode] = useState<'table' | 'pie' | 'bar' | 'treemap' | 'topology'>('table');
  
  // Custom query dialog
  const [isCustomQueryOpen, setIsCustomQueryOpen] = useState(false);
  const [customSQL, setCustomSQL] = useState('');
  
  // Data explorer state
  const [isDataExplorerOpen, setIsDataExplorerOpen] = useState(false);
  const [dataExplorerResult, setDataExplorerResult] = useState<QueryResult | null>(null);
  const [isExploringData, setIsExploringData] = useState(false);
  
  // Unified view refresh state
  const [isRefreshingView, setIsRefreshingView] = useState(false);
  
  // Auto-loading state
  const [isAutoLoading, setIsAutoLoading] = useState(false);
  const [autoLoadProgress, setAutoLoadProgress] = useState({ current: 0, total: 0 });
  const hasAutoLoaded = useRef(false);
  
  // Currency settings
  const [currencySettings, setCurrencySettings] = useState<CurrencySettings>(() => loadCurrencySettings());
  const [isCurrencySettingsOpen, setIsCurrencySettingsOpen] = useState(false);
  
  // Effective currency: use detected currency if auto-detect is on, otherwise use display currency
  const effectiveCurrency = useMemo(() => {
    if (currencySettings.autoDetect && unifiedView.detectedCurrency) {
      return unifiedView.detectedCurrency;
    }
    return currencySettings.displayCurrency;
  }, [currencySettings.autoDetect, currencySettings.displayCurrency, unifiedView.detectedCurrency]);
  
  // Update currency settings when detected currency changes
  useEffect(() => {
    if (unifiedView.detectedCurrency && currencySettings.autoDetect) {
      const newSettings = { ...currencySettings, detectedCurrency: unifiedView.detectedCurrency };
      setCurrencySettings(newSettings);
      saveCurrencySettings(newSettings);
      console.log(`[Analytics] Auto-detected currency: ${unifiedView.detectedCurrency}`);
    }
  }, [unifiedView.detectedCurrency, currencySettings.autoDetect]);

  // ============================================================================
  // Drill-Down State
  // ============================================================================
  
  const [isDrillDownActive, setIsDrillDownActive] = useState(false);
  const [drillDownData, setDrillDownData] = useState<Array<{ name: string; value: number }>>([]);
  const [drillDownPath, setDrillDownPath] = useState<{
    levels: Array<{
      id: string;
      name: string;
      field: string;
      value: string;
      cost: number;
      percentage: number;
    }>;
    totalCost: number;
  }>({ levels: [], totalCost: 0 });
  const [isDrillDownLoading, setIsDrillDownLoading] = useState(false);

  // Drill-down hierarchy configuration
  const drillDownHierarchy = [
    { field: 'ServiceCategory', label: 'Category' },
    { field: 'ServiceName', label: 'Service' },
    { field: 'SubAccountName', label: 'Account' },
    { field: 'ResourceName', label: 'Resource' },
  ];

  // Handle drill-down action
  const handleDrillDown = useCallback(async (level: { id: string; name: string; field: string; value: string; cost: number; percentage: number }, depth: number) => {
    if (!unifiedView.exists || depth >= drillDownHierarchy.length - 1) return;
    
    setIsDrillDownLoading(true);
    const newLevels = [...drillDownPath.levels.slice(0, depth), level];
    setDrillDownPath(prev => ({ ...prev, levels: newLevels }));
    
    // Build WHERE clause from current drill path
    const whereClauses: string[] = [];
    const nextField = drillDownHierarchy[newLevels.length]?.field;
    
    // Add parent filters
    newLevels.forEach((l, i) => {
      whereClauses.push(`${drillDownHierarchy[i].field} = '${l.value.replace(/'/g, "''")}'`);
    });
    
    // Add date filter if set
    if (dateRange.start && dateRange.end) {
      const start = new Date(dateRange.start).getTime();
      const end = new Date(dateRange.end);
      end.setDate(end.getDate() + 1);
      whereClauses.push(`ChargePeriodStart >= epoch_ms(${start})`);
      whereClauses.push(`ChargePeriodEnd < epoch_ms(${end.getTime()})`);
    }
    
    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    
    const drillQuery = `
      SELECT 
        ${nextField} as name,
        SUM(CAST(BilledCost AS DOUBLE)) as value
      FROM ${UNIFIED_VIEW_NAME}
      ${whereClause}
      GROUP BY ${nextField}
      ORDER BY value DESC
      LIMIT 50
    `;
    
    try {
      const result = await executeQuery(drillQuery);
      if (result && Array.isArray(result)) {
        setDrillDownData(result.map(r => ({
          name: String(r.name || ''),
          value: Number(r.value || 0),
        })));
      }
    } catch (err) {
      console.error('Drill-down query failed:', err);
    }
    
    setIsDrillDownLoading(false);
  }, [unifiedView.exists, drillDownPath, dateRange.start, dateRange.end, executeQuery]);

  // Handle drill-up action
  const handleDrillUp = useCallback(async (toDepth: number) => {
    setIsDrillDownLoading(true);
    const newLevels = drillDownPath.levels.slice(0, toDepth);
    setDrillDownPath(prev => ({ ...prev, levels: newLevels }));
    
    // Build query for the new level
    const whereClauses: string[] = [];
    const nextField = drillDownHierarchy[newLevels.length]?.field || 'ServiceCategory';
    
    // Add parent filters
    newLevels.forEach((l, i) => {
      whereClauses.push(`${drillDownHierarchy[i].field} = '${l.value.replace(/'/g, "''")}'`);
    });
    
    // Add date filter
    if (dateRange.start && dateRange.end) {
      const start = new Date(dateRange.start).getTime();
      const end = new Date(dateRange.end);
      end.setDate(end.getDate() + 1);
      whereClauses.push(`ChargePeriodStart >= epoch_ms(${start})`);
      whereClauses.push(`ChargePeriodEnd < epoch_ms(${end.getTime()})`);
    }
    
    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    
    const drillQuery = `
      SELECT 
        ${nextField} as name,
        SUM(CAST(BilledCost AS DOUBLE)) as value
      FROM ${UNIFIED_VIEW_NAME}
      ${whereClause}
      GROUP BY ${nextField}
      ORDER BY value DESC
      LIMIT 50
    `;
    
    try {
      const result = await executeQuery(drillQuery);
      if (result && Array.isArray(result)) {
        setDrillDownData(result.map(r => ({
          name: String(r.name || ''),
          value: Number(r.value || 0),
        })));
      }
    } catch (err) {
      console.error('Drill-up query failed:', err);
    }
    
    setIsDrillDownLoading(false);
  }, [unifiedView.exists, drillDownPath, dateRange.start, dateRange.end, executeQuery]);

  // Initialize drill-down with initial data
  const initializeDrillDown = useCallback(async () => {
    if (!unifiedView.exists || !queryResult) return;
    
    setIsDrillDownActive(true);
    setIsDrillDownLoading(true);
    
    // Calculate total cost from results
    const totalCost = queryResult.rows.reduce((sum, row) => {
      const cost = Number(row.BilledCost || row.billed_cost || row.cost || row.TotalCost || row.total_cost || row.value || 0);
      return sum + cost;
    }, 0);
    
    setDrillDownPath({ levels: [], totalCost });
    
    // Get initial category breakdown
    const whereClauses: string[] = [];
    if (dateRange.start && dateRange.end) {
      const start = new Date(dateRange.start).getTime();
      const end = new Date(dateRange.end);
      end.setDate(end.getDate() + 1);
      whereClauses.push(`ChargePeriodStart >= epoch_ms(${start})`);
      whereClauses.push(`ChargePeriodEnd < epoch_ms(${end.getTime()})`);
    }
    
    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    
    const initialQuery = `
      SELECT 
        ServiceCategory as name,
        SUM(CAST(BilledCost AS DOUBLE)) as value
      FROM ${UNIFIED_VIEW_NAME}
      ${whereClause}
      GROUP BY ServiceCategory
      ORDER BY value DESC
      LIMIT 50
    `;
    
    try {
      const result = await executeQuery(initialQuery);
      if (result && Array.isArray(result)) {
        setDrillDownData(result.map(r => ({
          name: String(r.name || ''),
          value: Number(r.value || 0),
        })));
      }
    } catch (err) {
      console.error('Initial drill-down query failed:', err);
    }
    
    setIsDrillDownLoading(false);
  }, [unifiedView.exists, queryResult, dateRange.start, dateRange.end, executeQuery]);

  // ============================================================================
  // Auto-load saved data sources on mount
  // ============================================================================
  
  useEffect(() => {
    // Skip if not ready, already auto-loaded, no data sources, or unified view already exists
    if (!isReady || hasAutoLoaded.current || dataSources.length === 0 || unifiedView.exists) return;
    
    hasAutoLoaded.current = true;
    
    async function loadDataSources() {
      setIsAutoLoading(true);
      
      // Collect all blob paths to load
      const allBlobPaths: { connectorId: string; blobPath: string }[] = [];
      for (const ds of dataSources) {
        const config = ds.config as DataSourceConfig;
        if (ds.connectorId && config.blobPaths?.length) {
          for (const blobPath of config.blobPaths) {
            allBlobPaths.push({ connectorId: ds.connectorId, blobPath });
          }
        }
      }
      
      console.log(`[Analytics] Auto-loading ${allBlobPaths.length} files from ${dataSources.length} data sources`);
      setAutoLoadProgress({ current: 0, total: allBlobPaths.length });
      
      // Load each blob path
      let loadedCount = 0;
      for (const { connectorId, blobPath } of allBlobPaths) {
        try {
          console.log(`[Analytics] Loading ${blobPath}...`);
          const sasResult = await generateAzureSasUrl({ connectorId, blobPath });
          
          if (sasResult.success) {
            const tableName = generateTableName(blobPath);
            const result = await mountRemoteAzureSource(sasResult.sasUrl, tableName);
            console.log(`[Analytics] Loaded ${tableName}: ${result.rowCount} rows`);
          } else {
            console.error(`[Analytics] Failed to get SAS URL for ${blobPath}`);
          }
        } catch (error) {
          console.error(`[Analytics] Failed to load ${blobPath}:`, error);
        }
        
        loadedCount++;
        setAutoLoadProgress({ current: loadedCount, total: allBlobPaths.length });
      }
      
      // Refresh unified view after loading all sources
      console.log('[Analytics] Refreshing unified view...');
      try {
        await refreshUnifiedView();
        console.log('[Analytics] Unified view refreshed');
      } catch (error) {
        console.error('[Analytics] Failed to refresh unified view:', error);
      }
      
      setIsAutoLoading(false);
    }
    
    loadDataSources();
  }, [isReady, dataSources, unifiedView.exists, mountRemoteAzureSource, refreshUnifiedView]);

  // Query counts by category
  const queryCounts = useMemo(() => getQueryCountByCategory(), []);

  // Get columns from unified view (or empty if not ready)
  const availableColumns = useMemo(() => {
    return unifiedView.columns || [];
  }, [unifiedView.columns]);

  // Use unified view for queries
  const tableName = UNIFIED_VIEW_NAME;

  // Filter queries by category and search
  const filteredQueries = useMemo(() => {
    let queries = selectedCategory === 'all' 
      ? FOCUS_QUERIES 
      : getQueriesByCategory(selectedCategory);
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      queries = queries.filter(
        (q) =>
          q.name.toLowerCase().includes(term) ||
          q.description.toLowerCase().includes(term)
      );
    }
    
    return queries;
  }, [selectedCategory, searchTerm]);

  // Check query compatibility
  const queryCompatibility = useMemo(() => {
    if (!selectedQuery || availableColumns.length === 0) return null;
    return isQueryCompatible(selectedQuery, availableColumns);
  }, [selectedQuery, availableColumns]);

  // Find missing columns
  const missingColumns = useMemo(() => {
    if (!selectedQuery || availableColumns.length === 0) return [];
    const columnSet = new Set(availableColumns.map((c) => c.toLowerCase()));
    return selectedQuery.requiredColumns.filter(
      (col) => !columnSet.has(col.toLowerCase())
    );
  }, [selectedQuery, availableColumns]);

  // Refresh unified view handler
  const handleRefreshView = useCallback(async () => {
    if (!isReady) return;
    
    setIsRefreshingView(true);
    try {
      await refreshUnifiedView();
    } catch (error) {
      console.error('Failed to refresh unified view:', error);
    }
    setIsRefreshingView(false);
  }, [isReady, refreshUnifiedView]);

  // Execute query
  const handleExecuteQuery = useCallback(async () => {
    if (!selectedQuery || !unifiedView.exists || !isReady) return;

    setIsExecuting(true);
    setQueryError(null);
    setQueryResult(null);

    const sql = buildQuery(selectedQuery, tableName, dateRange.start, dateRange.end);
    setExecutedSQL(sql);

    const startTime = performance.now();

    try {
      const results = await executeQuery<Record<string, unknown>>(sql);
      const endTime = performance.now();

      const columns = results.length > 0 ? Object.keys(results[0]) : [];
      
      setQueryResult({
        columns,
        rows: results,
        rowCount: results.length,
        executionTime: Math.round(endTime - startTime),
      });
    } catch (error) {
      setQueryError(error instanceof Error ? error.message : 'Query execution failed');
    }

    setIsExecuting(false);
  }, [selectedQuery, tableName, dateRange, isReady, executeQuery, unifiedView.exists]);

  // Execute custom query
  const handleExecuteCustomQuery = useCallback(async () => {
    if (!customSQL.trim() || !isReady || !unifiedView.exists) return;

    setIsExecuting(true);
    setQueryError(null);
    setQueryResult(null);

    // Replace {{TABLE}} placeholder if present
    const sql = tableName 
      ? customSQL.replace(/\{\{TABLE\}\}/g, tableName) 
      : customSQL;
    setExecutedSQL(sql);

    const startTime = performance.now();

    try {
      const results = await executeQuery<Record<string, unknown>>(sql);
      const endTime = performance.now();

      const columns = results.length > 0 ? Object.keys(results[0]) : [];
      
      setQueryResult({
        columns,
        rows: results,
        rowCount: results.length,
        executionTime: Math.round(endTime - startTime),
      });
      setIsCustomQueryOpen(false);
    } catch (error) {
      setQueryError(error instanceof Error ? error.message : 'Query execution failed');
    }

    setIsExecuting(false);
  }, [customSQL, tableName, isReady, executeQuery]);

  // Explore data - run a simple SELECT * LIMIT 10 to see actual data
  const handleExploreData = useCallback(async () => {
    if (!isReady || !unifiedView.exists) return;

    setIsExploringData(true);
    setDataExplorerResult(null);

    const sql = `SELECT * FROM ${UNIFIED_VIEW_NAME} LIMIT 10`;
    const startTime = performance.now();

    try {
      const results = await executeQuery<Record<string, unknown>>(sql);
      const endTime = performance.now();

      const columns = results.length > 0 ? Object.keys(results[0]) : [];
      
      setDataExplorerResult({
        columns,
        rows: results,
        rowCount: results.length,
        executionTime: Math.round(endTime - startTime),
      });
      setIsDataExplorerOpen(true);
    } catch (error) {
      console.error('Data explorer error:', error);
      setQueryError(error instanceof Error ? error.message : 'Failed to explore data');
    }

    setIsExploringData(false);
  }, [isReady, executeQuery, unifiedView.exists]);

  // Copy SQL to clipboard
  const handleCopySQL = useCallback(() => {
    if (executedSQL) {
      navigator.clipboard.writeText(executedSQL);
    }
  }, [executedSQL]);

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Left Sidebar - Categories & Queries */}
      <div className="w-80 border-r bg-muted/30 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            FOCUS Analytics
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            59 FinOps use cases
          </p>
        </div>

        {/* Search */}
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search queries..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Category Filter */}
        <div className="p-4 border-b">
          <Label className="text-xs font-medium text-muted-foreground">CATEGORY</Label>
          <Select
            value={selectedCategory}
            onValueChange={(v) => setSelectedCategory(v as FocusCategory | 'all')}
          >
            <SelectTrigger className="mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories ({FOCUS_QUERIES.length})</SelectItem>
              {FOCUS_CATEGORIES.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.icon} {cat.name} ({queryCounts[cat.id] || 0})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Query List */}
        <div className="flex-1 overflow-y-auto">
          {filteredQueries.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              No queries found
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {filteredQueries.map((query) => {
                const catInfo = getCategoryInfo(query.category);
                const isSelected = selectedQuery?.id === query.id;
                return (
                  <button
                    key={query.id}
                    onClick={() => setSelectedQuery(query)}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                      isSelected
                        ? 'bg-primary/10 border border-primary/50'
                        : 'hover:bg-muted border border-transparent'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-lg flex-shrink-0">{catInfo?.icon}</span>
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">{query.name}</div>
                        <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                          {query.description}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            v{query.minFocusVersion}+
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Custom Query Button */}
        <div className="p-4 border-t">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setIsCustomQueryOpen(true)}
            disabled={!isReady}
          >
            Custom SQL Query
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top Bar - Unified View Status & Date Range */}
        <div className="p-4 border-b bg-background flex flex-wrap items-center gap-3">
          {/* Unified View Status */}
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            {unifiedView.exists ? (
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="default" className="bg-green-600">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  {unifiedView.sourceTables.length} Source{unifiedView.sourceTables.length !== 1 ? 's' : ''}
                </Badge>
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  {unifiedView.totalRowCount.toLocaleString()} rows
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRefreshView}
                  disabled={isRefreshingView}
                  className="h-7 px-2"
                >
                  {isRefreshingView ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    '↻'
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExploreData}
                  disabled={isExploringData}
                  className="h-7 px-2"
                >
                  {isExploringData ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    '🔍'
                  )}
                </Button>
              </div>
            ) : isAutoLoading ? (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-blue-500 border-blue-500">
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Loading...
                </Badge>
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  {autoLoadProgress.current}/{autoLoadProgress.total}
                </span>
              </div>
            ) : (
              <Badge variant="outline" className="text-amber-500 border-amber-500">
                <AlertCircle className="h-3 w-3 mr-1" />
                No Data
              </Badge>
            )}
          </div>

          {/* Separator */}
          <div className="h-6 w-px bg-border hidden sm:block" />

          {/* Date Range */}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <Input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
              className="w-32 h-8"
            />
            <span className="text-muted-foreground text-sm">→</span>
            <Input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
              className="w-32 h-8"
            />
          </div>

          {/* Separator */}
          <div className="h-6 w-px bg-border hidden sm:block" />

          {/* Currency Indicator */}
          <div className="flex items-center gap-1">
            <Badge 
              variant={unifiedView.detectedCurrency ? 'default' : 'outline'} 
              className={`cursor-pointer ${unifiedView.detectedCurrency ? 'bg-blue-600 hover:bg-blue-700' : 'hover:bg-muted'}`}
              onClick={() => setIsCurrencySettingsOpen(true)}
            >
              {SUPPORTED_CURRENCIES[effectiveCurrency]?.symbol || effectiveCurrency}
              <span className="ml-1">{effectiveCurrency}</span>
              {currencySettings.autoDetect && unifiedView.detectedCurrency && (
                <span className="ml-1 text-[10px] opacity-75">✓</span>
              )}
            </Badge>
          </div>

          {/* Separator */}
          <div className="h-6 w-px bg-border hidden sm:block" />

          {/* Saved Views */}
          <SavedViewsPanel
            currentConfig={{
              queryId: selectedQuery?.id,
              dateRange: dateRange,
              viewMode: resultsViewMode,
              drillPath: drillDownPath.levels.map(l => ({ field: l.name, value: l.value })),
            }}
            onLoadView={(view) => {
              const config = view.config;
              if (config?.queryId) {
                const query = FOCUS_QUERIES.find(q => q.id === config.queryId);
                if (query) setSelectedQuery(query);
              }
              if (config?.dateRange) {
                setDateRange(config.dateRange);
              }
              if (config?.viewMode) {
                setResultsViewMode(config.viewMode);
              }
            }}
            viewType="query"
          />

          {/* Execute Button - pushed to right */}
          <div className="flex-1" />
          <Button
            onClick={handleExecuteQuery}
            disabled={!selectedQuery || !unifiedView.exists || !isReady || isExecuting}
            size="sm"
          >
            {isExecuting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            Run
          </Button>
        </div>

        {/* Query Info & Results */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* No Query Selected */}
          {!selectedQuery && !queryResult && (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">Select a Query</h3>
                <p className="text-muted-foreground text-center max-w-md mt-2">
                  Choose a FOCUS use case from the sidebar to analyze your cloud cost data.
                  All 59 FinOps Foundation queries are available.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Selected Query Info */}
          {selectedQuery && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{selectedQuery.name}</CardTitle>
                    <CardDescription className="mt-1">
                      {selectedQuery.description}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">FOCUS v{selectedQuery.minFocusVersion}+</Badge>
                    <Badge variant="secondary">
                      {getCategoryInfo(selectedQuery.category)?.icon}{' '}
                      {getCategoryInfo(selectedQuery.category)?.name}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Compatibility Check */}
                {availableColumns.length > 0 && (
                  <div className="flex items-center gap-2">
                    {queryCompatibility ? (
                      <>
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-green-600">
                          All required columns available
                        </span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-4 w-4 text-yellow-500" />
                        <span className="text-sm text-yellow-600">
                          Missing columns: {missingColumns.join(', ')}
                        </span>
                      </>
                    )}
                  </div>
                )}

                {/* SQL Preview */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium text-muted-foreground">SQL QUERY</Label>
                    {executedSQL && (
                      <Button variant="ghost" size="sm" onClick={handleCopySQL}>
                        <Copy className="h-3 w-3 mr-1" />
                        Copy
                      </Button>
                    )}
                  </div>
                  <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap">
                    {tableName
                      ? buildQuery(selectedQuery, tableName, dateRange.start, dateRange.end)
                      : selectedQuery.sql}
                  </pre>
                </div>

                {/* Required Columns */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">
                    REQUIRED COLUMNS
                  </Label>
                  <div className="flex flex-wrap gap-1">
                    {selectedQuery.requiredColumns.map((col) => {
                      const isMissing = missingColumns.includes(col);
                      return (
                        <Badge
                          key={col}
                          variant={isMissing ? 'destructive' : 'outline'}
                          className="text-xs"
                        >
                          {col}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Error Display */}
          {queryError && (
            <Card className="border-destructive bg-destructive/10">
              <CardContent className="py-4 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-destructive">Query Error</p>
                  <p className="text-sm text-destructive/80 mt-1">{queryError}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Results */}
          {queryResult && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <TableIcon className="h-4 w-4" />
                      Results
                    </CardTitle>
                    <CardDescription>
                      {queryResult.rowCount.toLocaleString()} rows in {queryResult.executionTime}ms
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* View Mode Toggle */}
                    <div className="flex items-center bg-muted rounded-lg p-0.5">
                      <Button
                        variant={resultsViewMode === 'table' ? 'default' : 'ghost'}
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => setResultsViewMode('table')}
                        title="Table View"
                      >
                        <TableIcon className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant={resultsViewMode === 'pie' ? 'default' : 'ghost'}
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => setResultsViewMode('pie')}
                        title="Pie Chart"
                      >
                        <PieChart className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant={resultsViewMode === 'bar' ? 'default' : 'ghost'}
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => setResultsViewMode('bar')}
                        title="Trend Chart"
                      >
                        <LineChart className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant={resultsViewMode === 'treemap' ? 'default' : 'ghost'}
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => setResultsViewMode('treemap')}
                        title="Treemap"
                      >
                        <BarChart3 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant={resultsViewMode === 'topology' ? 'default' : 'ghost'}
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => setResultsViewMode('topology')}
                        title="Topology Graph"
                      >
                        <GitMerge className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        exportToCSV(queryResult, selectedQuery?.id || 'query-results')
                      }
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export CSV
                    </Button>
                    <Button
                      variant={isDrillDownActive ? 'secondary' : 'outline'}
                      size="sm"
                      onClick={() => isDrillDownActive ? setIsDrillDownActive(false) : initializeDrillDown()}
                      title="Enable Drill-Down Analysis"
                    >
                      <Filter className="h-4 w-4 mr-2" />
                      {isDrillDownActive ? 'Close Drill-Down' : 'Drill-Down'}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {queryResult.rows.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No results found for the selected date range
                  </div>
                ) : resultsViewMode === 'table' ? (
                  <div className="border rounded-lg overflow-hidden">
                    <div className="max-h-[400px] overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {queryResult.columns.map((col) => (
                              <TableHead key={col} className="whitespace-nowrap bg-muted/50">
                                {col}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {queryResult.rows.slice(0, 100).map((row, i) => (
                            <TableRow key={i}>
                              {queryResult.columns.map((col) => (
                                <TableCell key={col} className="font-mono text-sm">
                                  {formatCellValue(row[col], col, row, effectiveCurrency)}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {queryResult.rows.length > 100 && (
                      <div className="p-2 text-center text-sm text-muted-foreground bg-muted/30">
                        Showing first 100 of {queryResult.rows.length.toLocaleString()} rows
                      </div>
                    )}
                  </div>
                ) : resultsViewMode === 'pie' ? (
                  <div className="py-4">
                    <CostBreakdownChart
                      data={prepareChartData(queryResult)}
                      currency={effectiveCurrency}
                      height={350}
                    />
                  </div>
                ) : resultsViewMode === 'bar' ? (
                  <div className="py-4">
                    <CostTrendChart
                      data={prepareTimeSeriesData(queryResult)}
                      costTypes={['billedCost']}
                      currency={effectiveCurrency}
                      height={350}
                    />
                  </div>
                ) : resultsViewMode === 'treemap' ? (
                  <div className="py-4">
                    <CostTreemap
                      data={prepareChartData(queryResult)}
                      currency={effectiveCurrency}
                      height={350}
                    />
                  </div>
                ) : resultsViewMode === 'topology' ? (
                  <div className="py-4">
                    <CostTopologyGraph
                      nodes={transformToTopologyNodes(
                        queryResult.rows.map(row => ({
                          ServiceName: String(row.ServiceName || row.service_name || row.name || 'Unknown'),
                          ServiceCategory: String(row.ServiceCategory || row.service_category || row.category || ''),
                          BilledCost: Number(row.BilledCost || row.billed_cost || row.cost || row.TotalCost || row.total_cost || 0),
                        })),
                        'Cloud Provider'
                      )}
                      currency={effectiveCurrency}
                      height={450}
                    />
                  </div>
                ) : null}
              </CardContent>
            </Card>
          )}

          {/* Drill-Down Panel */}
          {isDrillDownActive && queryResult && (
            <DrillDownPanel
              path={drillDownPath}
              currency={effectiveCurrency}
              onDrillDown={handleDrillDown}
              onDrillUp={handleDrillUp}
              onClose={() => setIsDrillDownActive(false)}
              currentLevelData={drillDownData}
              isLoading={isDrillDownLoading}
              maxDepth={drillDownHierarchy.length}
            />
          )}
        </div>
      </div>

      {/* Custom Query Dialog */}
      <Dialog open={isCustomQueryOpen} onOpenChange={setIsCustomQueryOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Custom SQL Query</DialogTitle>
            <DialogDescription>
              Write a custom SQL query. Use <code className="bg-muted px-1 rounded">{'{{TABLE}}'}</code> as a
              placeholder for the selected data source table.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>SQL Query</Label>
              <Textarea
                value={customSQL}
                onChange={(e) => setCustomSQL(e.target.value)}
                placeholder={`SELECT 
  ServiceName,
  SUM(BilledCost) AS TotalCost
FROM {{TABLE}}
GROUP BY ServiceName
ORDER BY TotalCost DESC`}
                className="font-mono text-sm min-h-[200px]"
              />
            </div>
            {tableName && (
              <p className="text-sm text-muted-foreground">
                Table: <code className="bg-muted px-1 rounded">{tableName}</code>
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsCustomQueryOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleExecuteCustomQuery}
              disabled={!customSQL.trim() || isExecuting || !unifiedView.exists}
            >
              {isExecuting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Execute
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Data Explorer Dialog */}
      <Dialog open={isDataExplorerOpen} onOpenChange={setIsDataExplorerOpen}>
        <DialogContent className="sm:max-w-[900px] max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              🔍 Data Explorer
            </DialogTitle>
            <DialogDescription>
              Showing a sample of your FOCUS data with actual column names.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4 overflow-auto flex-1">
            {/* Column List */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Available Columns ({availableColumns.length})</Label>
              <div className="flex flex-wrap gap-1 max-h-[150px] overflow-auto p-2 border rounded-lg bg-muted/50">
                {availableColumns.length > 0 ? (
                  availableColumns.map((col) => {
                    // Highlight critical FOCUS date columns
                    const isDateCol = col.toLowerCase().includes('period') || 
                                      col.toLowerCase().includes('date');
                    const isCostCol = col.toLowerCase().includes('cost');
                    return (
                      <Badge
                        key={col}
                        variant={isDateCol ? 'default' : isCostCol ? 'secondary' : 'outline'}
                        className={`text-xs ${isDateCol ? 'bg-blue-600' : ''}`}
                      >
                        {col}
                      </Badge>
                    );
                  })
                ) : (
                  <span className="text-sm text-muted-foreground">No columns found</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                💡 Blue = date columns, Gray = cost columns
              </p>
            </div>

            {/* Sample Data */}
            {dataExplorerResult && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Sample Data (First 10 Rows)</Label>
                <div className="border rounded-lg overflow-hidden">
                  <div className="max-h-[250px] overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {dataExplorerResult.columns.slice(0, 15).map((col) => (
                            <TableHead key={col} className="whitespace-nowrap bg-muted/50 text-xs">
                              {col}
                            </TableHead>
                          ))}
                          {dataExplorerResult.columns.length > 15 && (
                            <TableHead className="whitespace-nowrap bg-muted/50 text-xs">
                              +{dataExplorerResult.columns.length - 15} more...
                            </TableHead>
                          )}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dataExplorerResult.rows.map((row, i) => (
                          <TableRow key={i}>
                            {dataExplorerResult.columns.slice(0, 15).map((col) => (
                              <TableCell key={col} className="font-mono text-xs max-w-[150px] truncate">
                                {formatNumber(row[col])}
                              </TableCell>
                            ))}
                            {dataExplorerResult.columns.length > 15 && (
                              <TableCell className="text-xs text-muted-foreground">...</TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            )}

            {/* Debug Info */}
            <div className="space-y-2 p-3 border rounded-lg bg-amber-500/10">
              <Label className="text-sm font-medium text-amber-600">Debug Information</Label>
              <div className="text-xs space-y-1 font-mono">
                <p>• Table Name: <code className="bg-muted px-1 rounded">{UNIFIED_VIEW_NAME}</code></p>
                <p>• Unified View Exists: <code className="bg-muted px-1 rounded">{String(unifiedView.exists)}</code></p>
                <p>• Total Row Count: <code className="bg-muted px-1 rounded">{unifiedView.totalRowCount.toLocaleString()}</code></p>
                <p>• Source Tables: <code className="bg-muted px-1 rounded">{unifiedView.sourceTables.join(', ') || 'None'}</code></p>
                <p>• Detected Columns: <code className="bg-muted px-1 rounded">{availableColumns.length}</code></p>
                {availableColumns.length > 0 && (
                  <>
                    <p className="mt-2 text-amber-600">Key FOCUS Columns Check:</p>
                    <p>• ChargePeriodStart: {availableColumns.some(c => c.toLowerCase() === 'chargeperiodstart') ? '✅' : '❌'}</p>
                    <p>• ChargePeriodEnd: {availableColumns.some(c => c.toLowerCase() === 'chargeperiodend') ? '✅' : '❌'}</p>
                    <p>• BillingPeriodStart: {availableColumns.some(c => c.toLowerCase() === 'billingperiodstart') ? '✅' : '❌'}</p>
                    <p>• BillingPeriodEnd: {availableColumns.some(c => c.toLowerCase() === 'billingperiodend') ? '✅' : '❌'}</p>
                    <p>• BilledCost: {availableColumns.some(c => c.toLowerCase() === 'billedcost') ? '✅' : '❌'}</p>
                    <p>• EffectiveCost: {availableColumns.some(c => c.toLowerCase() === 'effectivecost') ? '✅' : '❌'}</p>
                  </>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={() => setIsDataExplorerOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* No Unified View Warning */}
      {!unifiedView.exists && isReady && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                No Data Loaded
              </CardTitle>
              <CardDescription>
                Load your FOCUS cost data from the Data Sources page to run analytics queries.
                You can load data from Azure, AWS, GCP, or upload local files.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button asChild className="w-full">
                <a href="/dashboard/sources">Go to Data Sources</a>
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                After loading data, click "↻ Refresh" to update the unified view.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Currency Settings Dialog */}
      <Dialog open={isCurrencySettingsOpen} onOpenChange={setIsCurrencySettingsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              💱 Currency Settings
            </DialogTitle>
            <DialogDescription>
              Configure how cost values are displayed in query results.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Auto-detect toggle */}
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="autoDetect">Auto-detect from data</Label>
                <p className="text-sm text-muted-foreground">
                  Use BillingCurrency from your FOCUS data
                </p>
              </div>
              <input
                type="checkbox"
                id="autoDetect"
                checked={currencySettings.autoDetect}
                onChange={(e) => {
                  const newSettings = { ...currencySettings, autoDetect: e.target.checked };
                  setCurrencySettings(newSettings);
                  saveCurrencySettings(newSettings);
                }}
                className="h-4 w-4"
              />
            </div>
            
            {/* Detected currency info */}
            {unifiedView.detectedCurrency && (
              <div className="p-3 bg-muted rounded-md">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">Detected: {unifiedView.detectedCurrency}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {SUPPORTED_CURRENCIES[unifiedView.detectedCurrency]?.name || 'Unknown currency'}
                </p>
              </div>
            )}
            
            {/* Manual currency selector */}
            <div className="space-y-2">
              <Label htmlFor="displayCurrency">
                {currencySettings.autoDetect ? 'Fallback Currency' : 'Display Currency'}
              </Label>
              <Select
                value={currencySettings.displayCurrency}
                onValueChange={(value) => {
                  const newSettings = { ...currencySettings, displayCurrency: value };
                  setCurrencySettings(newSettings);
                  saveCurrencySettings(newSettings);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SUPPORTED_CURRENCIES).map(([code, info]) => (
                    <SelectItem key={code} value={code}>
                      <span className="font-mono mr-2">{code}</span>
                      <span className="text-muted-foreground">{info.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {currencySettings.autoDetect 
                  ? 'Used when currency cannot be detected from data'
                  : 'Currency used for all cost values'
                }
              </p>
            </div>
            
            {/* Current effective currency */}
            <div className="p-3 border rounded-md">
              <Label className="text-xs text-muted-foreground">Currently using</Label>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="default" className="bg-blue-600">
                  {effectiveCurrency}
                </Badge>
                <span className="text-sm">
                  {SUPPORTED_CURRENCIES[effectiveCurrency]?.symbol || effectiveCurrency}{' '}
                  {SUPPORTED_CURRENCIES[effectiveCurrency]?.name || ''}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={() => setIsCurrencySettingsOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
