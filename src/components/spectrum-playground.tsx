'use client';

import { useState, useCallback } from 'react';
import {
  Upload,
  Cloud,
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  Database,
  FileSpreadsheet,
  Trash2,
} from 'lucide-react';
import { useSpectrum } from '@/components/providers';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
}

export function SpectrumPlayground() {
  const {
    isInitializing,
    isReady,
    error,
    ingestFile,
    mountRemoteAzureSource,
    query,
    listTables,
    dropTable,
  } = useSpectrum();

  // State
  const [tables, setTables] = useState<string[]>([]);
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [sasUrl, setSasUrl] = useState('');
  const [tableName, setTableName] = useState('billing');
  const [customQuery, setCustomQuery] = useState('SELECT * FROM billing LIMIT 10');
  const [isDragging, setIsDragging] = useState(false);

  // Refresh table list
  const refreshTables = useCallback(async () => {
    const tableList = await listTables();
    setTables(tableList);
  }, [listTables]);

  // Handle file drop/select
  const handleFileSelect = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      setIsLoading(true);
      setStatusMessage(null);

      try {
        const file = files[0];
        const result = await ingestFile(file, tableName || undefined);

        if (result.success) {
          setStatusMessage(
            `✓ Loaded "${result.tableName}" with ${result.rowCount.toLocaleString()} rows`
          );
          await refreshTables();
        } else {
          setStatusMessage(`✗ Error: ${result.error}`);
        }
      } catch (err) {
        setStatusMessage(`✗ Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setIsLoading(false);
      }
    },
    [ingestFile, tableName, refreshTables]
  );

  // Handle Azure mount
  const handleAzureMount = useCallback(async () => {
    if (!sasUrl.trim()) {
      setStatusMessage('✗ Please enter a SAS URL');
      return;
    }

    setIsLoading(true);
    setStatusMessage(null);

    try {
      const result = await mountRemoteAzureSource(sasUrl, tableName || 'azure_data');

      if (result.success) {
        setStatusMessage(
          `✓ Mounted "${result.tableName}" with ${result.rowCount.toLocaleString()} rows`
        );
        await refreshTables();
      } else {
        setStatusMessage(`✗ Error: ${result.error}`);
      }
    } catch (err) {
      setStatusMessage(`✗ Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  }, [sasUrl, tableName, mountRemoteAzureSource, refreshTables]);

  // Run query
  const handleRunQuery = useCallback(async () => {
    setIsLoading(true);
    setStatusMessage(null);

    try {
      const results = await query<Record<string, unknown>>(customQuery);

      if (results.length > 0) {
        setQueryResult({
          columns: Object.keys(results[0]),
          rows: results,
        });
        setStatusMessage(`✓ Query returned ${results.length} rows`);
      } else {
        setQueryResult({ columns: [], rows: [] });
        setStatusMessage('Query returned no results');
      }
    } catch (err) {
      setStatusMessage(`✗ Query error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setQueryResult(null);
    } finally {
      setIsLoading(false);
    }
  }, [customQuery, query]);

  // Handle table drop
  const handleDropTable = useCallback(
    async (name: string) => {
      try {
        await dropTable(name);
        setStatusMessage(`✓ Dropped table "${name}"`);
        await refreshTables();
        setQueryResult(null);
      } catch (err) {
        setStatusMessage(`✗ Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    },
    [dropTable, refreshTables]
  );

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFileSelect(e.dataTransfer.files);
    },
    [handleFileSelect]
  );

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Left Column: Data Sources */}
      <div className="space-y-6 lg:col-span-1">
        {/* Engine Status */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Database className="h-5 w-5" />
              Spectrum Engine
            </CardTitle>
            <CardDescription>DuckDB-WASM Analytics Engine</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {isInitializing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />
                  <span className="text-sm text-yellow-500">Initializing...</span>
                </>
              ) : isReady ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-green-500">Ready</span>
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span className="text-sm text-red-500">
                    Error: {error?.message || 'Failed to initialize'}
                  </span>
                </>
              )}
            </div>

            {/* Loaded Tables */}
            {tables.length > 0 && (
              <div className="mt-4 space-y-2">
                <Label className="text-xs text-muted-foreground">Loaded Tables</Label>
                <div className="flex flex-wrap gap-2">
                  {tables.map((t) => (
                    <Badge
                      key={t}
                      variant="secondary"
                      className="group cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                      onClick={() => handleDropTable(t)}
                    >
                      {t}
                      <Trash2 className="ml-1 h-3 w-3 opacity-0 group-hover:opacity-100" />
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Local File Upload */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileSpreadsheet className="h-5 w-5" />
              Local File
            </CardTitle>
            <CardDescription>Upload CSV, Parquet, or JSON files</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tableName">Table Name</Label>
              <Input
                id="tableName"
                placeholder="billing"
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
              />
            </div>

            {/* Drop Zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={cn(
                'relative flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors',
                isDragging
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25 hover:border-primary/50',
                !isReady && 'pointer-events-none opacity-50'
              )}
            >
              <input
                type="file"
                accept=".csv,.parquet,.json,.jsonl"
                onChange={(e) => handleFileSelect(e.target.files)}
                className="absolute inset-0 cursor-pointer opacity-0"
                disabled={!isReady || isLoading}
              />
              <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Drop file here or click to browse
              </span>
              <span className="text-xs text-muted-foreground/60">
                CSV, Parquet, JSON supported
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Azure Remote Source */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Cloud className="h-5 w-5" />
              Azure Blob Storage
            </CardTitle>
            <CardDescription>Mount remote data via SAS URL</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sasUrl">SAS URL</Label>
              <Input
                id="sasUrl"
                placeholder="https://account.blob.core.windows.net/container/blob.parquet?sv=..."
                value={sasUrl}
                onChange={(e) => setSasUrl(e.target.value)}
              />
            </div>
            <Button
              onClick={handleAzureMount}
              disabled={!isReady || isLoading || !sasUrl.trim()}
              className="w-full"
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Cloud className="mr-2 h-4 w-4" />
              )}
              Mount Azure Source
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Right Column: Query & Results */}
      <div className="space-y-6 lg:col-span-2">
        {/* Query Editor */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">SQL Query</CardTitle>
            <CardDescription>Run queries against your loaded data</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={customQuery}
              onChange={(e) => setCustomQuery(e.target.value)}
              placeholder="SELECT * FROM billing LIMIT 10"
              className="min-h-[100px] font-mono text-sm"
            />
            <div className="flex items-center gap-4">
              <Button
                onClick={handleRunQuery}
                disabled={!isReady || isLoading}
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Play className="mr-2 h-4 w-4" />
                )}
                Run Query
              </Button>

              {/* Status Message */}
              {statusMessage && (
                <span
                  className={cn(
                    'text-sm',
                    statusMessage.startsWith('✓')
                      ? 'text-green-500'
                      : statusMessage.startsWith('✗')
                        ? 'text-red-500'
                        : 'text-muted-foreground'
                  )}
                >
                  {statusMessage}
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Results Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Results</CardTitle>
            <CardDescription>
              {queryResult
                ? `${queryResult.rows.length} rows × ${queryResult.columns.length} columns`
                : 'Run a query to see results'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {queryResult && queryResult.rows.length > 0 ? (
              <div className="max-h-[400px] overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {queryResult.columns.map((col) => (
                        <TableHead key={col} className="whitespace-nowrap">
                          {col}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {queryResult.rows.map((row, i) => (
                      <TableRow key={i}>
                        {queryResult.columns.map((col) => (
                          <TableCell key={col} className="font-mono text-xs">
                            {formatCellValue(row[col])}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex min-h-[200px] flex-col items-center justify-center rounded-lg border border-dashed text-muted-foreground">
                <Database className="mb-2 h-10 w-10 opacity-40" />
                <p className="text-sm">No data loaded</p>
                <p className="text-xs opacity-60">
                  Upload a file or mount an Azure source to get started
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Helper to format cell values for display
function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '—';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    // Format numbers with locale-specific separators
    return value.toLocaleString();
  }
  return String(value);
}
