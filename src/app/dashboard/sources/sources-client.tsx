'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Database,
  Upload,
  CloudDownload,
  Trash2,
  FileText,
  Loader2,
  CheckCircle,
  XCircle,
  Cable,
  Folder,
  ChevronRight,
  ArrowLeft,
  Check,
  Calendar,
  Download,
  Settings,
  RefreshCw,
  MoreVertical,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useSpectrum } from '@/components/providers/spectrum-provider';
import { 
  generateAzureSasUrl, 
  listAzureCostExports, 
  listFilesInFolder,
  type FocusFolder,
} from '@/actions/azure';
import {
  createDataSource,
  updateDataSource,
  deleteDataSource,
  type CreateDataSourceInput,
} from '@/actions/data-sources';
import type { DataConnector, AzureConnectorConfig, DataSource, DataSourceConfig } from '@/db/schema';
import Link from 'next/link';

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format date range for display (e.g., "Jan 2025" or "Jan-Feb 2025")
 */
function formatFocusDateRange(dateRange: { start: string; end: string }): string {
  const startDate = new Date(dateRange.start);
  const endDate = new Date(dateRange.end);
  
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const startMonth = monthNames[startDate.getMonth()];
  const endMonth = monthNames[endDate.getMonth()];
  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();
  
  if (startMonth === endMonth && startYear === endYear) {
    return `${startMonth} ${startYear}`;
  }
  
  if (startYear === endYear) {
    return `${startMonth}-${endMonth} ${startYear}`;
  }
  
  return `${startMonth} ${startYear} - ${endMonth} ${endYear}`;
}

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

/**
 * Generate a combined table name for data source
 */
function generateCombinedTableName(baseName: string): string {
  return baseName.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
}

/**
 * Get provider icon/badge display
 */
function getProviderDisplay(provider: string) {
  const providers: Record<string, { icon: string; color: string; name: string }> = {
    local: { icon: '📁', color: 'bg-slate-500/20 text-slate-400', name: 'Local' },
    azure: { icon: '☁️', color: 'bg-blue-500/20 text-blue-500', name: 'Azure' },
    aws: { icon: '🟠', color: 'bg-orange-500/20 text-orange-500', name: 'AWS' },
    gcp: { icon: '🔵', color: 'bg-green-500/20 text-green-500', name: 'GCP' },
  };
  return providers[provider] || { icon: '☁️', color: 'bg-gray-500/20', name: provider };
}

/**
 * Detect FOCUS specification version from column names
 * Based on FOCUS spec changes between versions:
 * - 1.0: Initial columns like BilledCost, EffectiveCost, ChargeType, etc.
 * - 1.1: Added ContractedCost, ListCost, SkuPriceId, renamed some columns
 * - 1.2: Added CapacityReservationId, CommitmentDiscountCategory, etc.
 */
function detectFocusVersion(columns: string[]): string | undefined {
  const columnSet = new Set(columns.map(c => c.toLowerCase()));
  
  // Check for FOCUS-specific columns
  const hasBilledCost = columnSet.has('billedcost');
  const hasEffectiveCost = columnSet.has('effectivecost');
  const hasChargeType = columnSet.has('chargetype') || columnSet.has('chargedescription');
  
  // Not a FOCUS dataset if missing core columns
  if (!hasBilledCost && !hasEffectiveCost && !hasChargeType) {
    return undefined;
  }
  
  // FOCUS 1.2+ indicators
  const has1_2Columns = columnSet.has('capacityreservationid') ||
                        columnSet.has('commitmentdiscountcategory') ||
                        columnSet.has('commitmentdiscountid') ||
                        columnSet.has('commitmentdiscounttype');
  
  // FOCUS 1.1+ indicators  
  const has1_1Columns = columnSet.has('contractedcost') ||
                        columnSet.has('listcost') ||
                        columnSet.has('skupriceid') ||
                        columnSet.has('contractedunitprice') ||
                        columnSet.has('listunitprice');
  
  if (has1_2Columns) {
    return '1.2';
  }
  
  if (has1_1Columns) {
    return '1.1';
  }
  
  // Has core FOCUS columns but not 1.1+ specific ones
  return '1.0';
}

// ============================================================================
// Types
// ============================================================================

interface SavedDataSourceWithConnector extends DataSource {
  connector: { name: string; provider: string } | null;
}

interface DataSourcesClientProps {
  connectors: DataConnector[];
  savedDataSources?: SavedDataSourceWithConnector[];
}

/** Track individual file load status */
interface FileLoadStatus {
  path: string;           // Full blob path
  fileName: string;       // Just the file name
  parentFolder: string;   // Parent folder for context (e.g., "20250101-20250131")
  friendlyName: string;   // User-friendly name (e.g., "Jan 2025")
  status: 'pending' | 'loading' | 'loaded' | 'failed';
  error?: string;         // Error message if failed
  rowCount?: number;      // Row count if loaded
}

/** Extract parent folder and friendly name from blob path */
function extractPathContext(blobPath: string): { parentFolder: string; friendlyName: string } {
  const parts = blobPath.split('/');
  
  // Find the date range folder (format: YYYYMMDD-YYYYMMDD)
  const dateRangeFolder = parts.find(part => /^\d{8}-\d{8}$/.test(part));
  
  if (dateRangeFolder) {
    // Parse date range to create friendly name
    const startDate = dateRangeFolder.slice(0, 8);
    const year = startDate.slice(0, 4);
    const month = parseInt(startDate.slice(4, 6), 10);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return {
      parentFolder: dateRangeFolder,
      friendlyName: `${monthNames[month - 1]} ${year}`,
    };
  }
  
  // Find the export name folder (usually one level up from date range)
  const exportFolder = parts.find(part => part.includes('focus-cost') || part.includes('export'));
  if (exportFolder) {
    return {
      parentFolder: exportFolder,
      friendlyName: exportFolder,
    };
  }
  
  // Fallback to second-to-last folder if any
  if (parts.length >= 2) {
    return {
      parentFolder: parts[parts.length - 2],
      friendlyName: parts[parts.length - 2],
    };
  }
  
  return {
    parentFolder: 'Unknown',
    friendlyName: 'Unknown',
  };
}

interface LoadedSource {
  id?: string; // Database ID if saved
  name: string;
  tableName: string;
  rowCount: number;
  columns: string[];
  source: 'local' | 'azure' | 'aws' | 'gcp';
  connectorId?: string;
  connectorName?: string;
  blobPaths?: string[];
  folderPaths?: string[];
  dateRange?: { start: string; end: string };
  loadedAt: Date;
  autoImportNewMonths?: boolean;
  isLoading?: boolean;
  isSaved?: boolean;
  focusVersion?: string;
  loadWarning?: string; // Warning message if some files failed to load
  /** Detailed per-file load status */
  fileStatuses?: FileLoadStatus[];
}

// ============================================================================
// Main Component
// ============================================================================

export function DataSourcesClient({ connectors, savedDataSources = [] }: DataSourcesClientProps) {
  const { isReady, dataSources: providerDataSources, ingestFile, mountRemoteAzureSource, executeQuery, refreshUnifiedView, setIsLoadingSources } = useSpectrum();

  // Loaded sources state - initialized from provider's already-loaded tables
  const [loadedSources, setLoadedSources] = useState<LoadedSource[]>([]);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  
  // Track if we've already initialized from provider and auto-loaded saved sources
  const hasInitialized = useRef(false);

  // Remote file browser state
  const [isRemoteDialogOpen, setIsRemoteDialogOpen] = useState(false);
  const [selectedConnector, setSelectedConnector] = useState<string | null>(null);
  const [remoteFiles, setRemoteFiles] = useState<string[]>([]);
  const [remoteFolders, setRemoteFolders] = useState<FocusFolder[]>([]);
  const [isFocusExportRoot, setIsFocusExportRoot] = useState(false);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [pathHistory, setPathHistory] = useState<string[]>([]);
  const [isLoadingRemoteFiles, setIsLoadingRemoteFiles] = useState(false);
  const [loadingRemoteFile, setLoadingRemoteFile] = useState<string | null>(null);
  
  // Selection state
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set());
  
  // Loading multiple items state
  const [isLoadingMultiple, setIsLoadingMultiple] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState({ current: 0, total: 0, message: '' });
  
  // Settings dialog state
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<LoadedSource | null>(null);
  const [settingsName, setSettingsName] = useState('');
  const [settingsAutoImport, setSettingsAutoImport] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // ============================================================================
  // Initialize loadedSources from provider state and auto-load saved sources
  // ============================================================================
  
  useEffect(() => {
    if (!isReady || hasInitialized.current) return;
    
    hasInitialized.current = true;
    
    // Create a set of table names already loaded in DuckDB
    const alreadyLoadedTables = new Set(providerDataSources.map(ds => ds.tableName));
    console.log('[Sources] Already loaded tables in DuckDB:', Array.from(alreadyLoadedTables));
    
    // If no saved sources, nothing to initialize
    if (savedDataSources.length === 0) {
      // Still populate loadedSources from providerDataSources if any local files were loaded
      if (providerDataSources.length > 0) {
        const localSources: LoadedSource[] = providerDataSources
          .filter(ds => ds.source === 'local')
          .map(ds => ({
            name: ds.fileName.replace(/\.[^/.]+$/, ''),
            tableName: ds.tableName,
            rowCount: ds.rowCount,
            columns: ds.columns,
            source: ds.source,
            loadedAt: new Date(),
            isLoading: false,
            isSaved: false,
            focusVersion: detectFocusVersion(ds.columns),
          }));
        if (localSources.length > 0) {
          setLoadedSources(localSources);
        }
      }
      return;
    }
    
    // Map saved data sources to LoadedSource objects
    // Check if their tables are already loaded in DuckDB
    const sourcesToLoad = savedDataSources.map((ds): LoadedSource => {
      const config = ds.config as DataSourceConfig;
      const columns = ds.columns || [];
      
      // Check if all blob paths have their tables already loaded
      const allTablesLoaded = config.blobPaths?.every(path => {
        const tableName = generateTableName(path);
        return alreadyLoadedTables.has(tableName);
      }) ?? false;
      
      // Get existing row count from provider if loaded
      const existingRowCount = config.blobPaths?.reduce((sum, path) => {
        const tableName = generateTableName(path);
        const existingSource = providerDataSources.find(ds => ds.tableName === tableName);
        return sum + (existingSource?.rowCount || 0);
      }, 0) ?? 0;
      
      return {
        id: ds.id,
        name: ds.name,
        tableName: config.tableName,
        rowCount: allTablesLoaded && existingRowCount > 0 ? existingRowCount : (ds.rowCount || 0),
        columns,
        source: ds.provider as 'azure' | 'aws' | 'gcp',
        connectorId: ds.connectorId,
        connectorName: ds.connector?.name || 'Unknown',
        blobPaths: config.blobPaths,
        folderPaths: config.folderPaths,
        dateRange: config.dateRange,
        loadedAt: new Date(ds.updatedAt),
        autoImportNewMonths: config.autoImportNewMonths,
        isLoading: !allTablesLoaded, // Only set loading if not already loaded
        isSaved: true,
        focusVersion: config.focusVersion || detectFocusVersion(columns),
      };
    });
    
    setLoadedSources(sourcesToLoad);
    
    // Only load sources that aren't already loaded
    const sourcesNeedingLoad = sourcesToLoad.filter(s => s.isLoading);
    console.log(`[Sources] ${sourcesToLoad.length} saved sources, ${sourcesNeedingLoad.length} need loading`);
    
    // Set global loading flag if we have sources to load
    if (sourcesNeedingLoad.length > 0) {
      setIsLoadingSources(true);
    }
    
    // Track how many sources are being loaded
    let loadingCount = sourcesNeedingLoad.length;
    
    // Load each source that needs loading
    sourcesNeedingLoad.forEach(async (source) => {
      if (!source.connectorId || !source.blobPaths?.length) {
        // Mark sources without blob paths as loaded (they may just have folder refs)
        setLoadedSources(prev => prev.map(s => 
          s.id === source.id ? { ...s, isLoading: false } : s
        ));
        loadingCount--;
        if (loadingCount === 0) setIsLoadingSources(false);
        return;
      }
      
      try {
        let totalRowCount = 0;
        let columns: string[] = [];
        const fileStatuses: FileLoadStatus[] = [];
        
        // Initialize file statuses - check if each file's table is already loaded
        for (const blobPath of source.blobPaths) {
          const fileName = blobPath.split('/').pop() || blobPath;
          const { parentFolder, friendlyName } = extractPathContext(blobPath);
          const tableName = generateTableName(blobPath);
          const existingSource = providerDataSources.find(ds => ds.tableName === tableName);
          
          if (existingSource) {
            // Table already loaded, mark as loaded with existing data
            fileStatuses.push({
              path: blobPath,
              fileName,
              parentFolder,
              friendlyName,
              status: 'loaded',
              rowCount: existingSource.rowCount,
            });
            totalRowCount += existingSource.rowCount;
            if (columns.length === 0) {
              columns = existingSource.columns;
            }
          } else {
            fileStatuses.push({
              path: blobPath,
              fileName,
              parentFolder,
              friendlyName,
              status: 'pending',
            });
          }
        }
        
        // Update state with initial file statuses
        setLoadedSources(prev => prev.map(s => 
          s.id === source.id ? { ...s, fileStatuses: [...fileStatuses] } : s
        ));
        
        // Load files that aren't already loaded
        for (let i = 0; i < source.blobPaths.length; i++) {
          const blobPath = source.blobPaths[i];
          
          // Skip if already loaded
          if (fileStatuses[i].status === 'loaded') {
            continue;
          }
          
          // Mark file as loading
          fileStatuses[i].status = 'loading';
          setLoadedSources(prev => prev.map(s => 
            s.id === source.id ? { ...s, fileStatuses: [...fileStatuses] } : s
          ));
          
          const sasResult = await generateAzureSasUrl({ 
            connectorId: source.connectorId, 
            blobPath 
          });
          
          if (!sasResult.success) {
            console.warn(`[Sources] SAS generation failed for ${blobPath}:`, sasResult.error);
            fileStatuses[i].status = 'failed';
            fileStatuses[i].error = sasResult.error || 'SAS generation failed';
            continue;
          }
          
          const tableName = generateTableName(blobPath);
          const result = await mountRemoteAzureSource(sasResult.sasUrl, tableName);
          
          // Check if mount was successful
          if (!result.success) {
            console.warn(`[Sources] Failed to mount ${blobPath}:`, result.error);
            fileStatuses[i].status = 'failed';
            fileStatuses[i].error = result.error || 'Failed to load file';
            continue;
          }
          
          fileStatuses[i].status = 'loaded';
          fileStatuses[i].rowCount = result.rowCount;
          totalRowCount += result.rowCount;
          if (columns.length === 0) {
            columns = result.columns;
          }
        }
        
        const loadedCount = fileStatuses.filter(f => f.status === 'loaded').length;
        const failedCount = fileStatuses.filter(f => f.status === 'failed').length;
        
        // Log summary
        if (failedCount > 0) {
          console.warn(`[Sources] ${source.name}: Loaded ${loadedCount}/${source.blobPaths.length} files (${failedCount} failed - blobs may have been moved/deleted)`);
        }
        
        // Mark as loaded with fresh row count, columns, and file statuses
        const focusVersion = columns.length > 0 ? detectFocusVersion(columns) : source.focusVersion;
        setLoadedSources(prev => prev.map(s => 
          s.id === source.id ? { 
            ...s, 
            isLoading: false,
            rowCount: totalRowCount > 0 ? totalRowCount : s.rowCount,
            columns: columns.length > 0 ? columns : s.columns,
            focusVersion,
            fileStatuses,
            // Mark with warning if some files failed
            loadWarning: failedCount > 0 ? `${failedCount} file(s) unavailable` : undefined,
          } : s
        ));
        
        // Decrement loading counter and clear flag when done
        loadingCount--;
        if (loadingCount === 0) setIsLoadingSources(false);
      } catch (error) {
        console.error(`Failed to auto-load source ${source.name}:`, error);
        setLoadedSources(prev => prev.map(s => 
          s.id === source.id ? { ...s, isLoading: false, loadWarning: 'Failed to load' } : s
        ));
        
        // Decrement loading counter and clear flag when done
        loadingCount--;
        if (loadingCount === 0) setIsLoadingSources(false);
      }
    });
  }, [isReady, savedDataSources, providerDataSources, mountRemoteAzureSource, setIsLoadingSources]);

  // ============================================================================
  // Refresh Unified View when data sources change
  // ============================================================================
  
  // Track the number of non-loading sources to trigger unified view refresh
  const loadedSourceCount = loadedSources.filter(s => !s.isLoading).length;
  
  useEffect(() => {
    // Refresh unified view when we have loaded sources
    if (isReady && loadedSourceCount > 0) {
      refreshUnifiedView().catch(err => 
        console.error('[Sources] Failed to refresh unified view:', err)
      );
    }
  }, [isReady, loadedSourceCount, refreshUnifiedView]);

  // ============================================================================
  // File Upload Handlers
  // ============================================================================

  const handleFileUpload = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0 || !isReady) return;

      setIsLoadingFile(true);
      setLoadProgress(0);
      setLoadError(null);

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setLoadProgress(((i + 0.5) / files.length) * 100);

        try {
          const result = await ingestFile(file);
          const focusVersion = detectFocusVersion(result.columns);

          setLoadedSources((prev) => [
            ...prev.filter((s) => s.tableName !== result.tableName),
            {
              name: file.name.replace(/\.[^/.]+$/, ''),
              tableName: result.tableName,
              rowCount: result.rowCount,
              columns: result.columns,
              source: 'local',
              loadedAt: new Date(),
              focusVersion,
            },
          ]);
        } catch (error) {
          setLoadError(error instanceof Error ? error.message : 'Failed to load file');
        }

        setLoadProgress(((i + 1) / files.length) * 100);
      }

      setIsLoadingFile(false);
    },
    [isReady, ingestFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      handleFileUpload(e.dataTransfer.files);
    },
    [handleFileUpload]
  );

  // ============================================================================
  // Remote Browser Handlers
  // ============================================================================

  const handleBrowseConnector = async (connectorId: string, prefix?: string) => {
    setSelectedConnector(connectorId);
    setIsLoadingRemoteFiles(true);
    setRemoteFiles([]);
    setRemoteFolders([]);
    setSelectedFiles(new Set());
    setSelectedFolders(new Set());
    setIsFocusExportRoot(false);
    setLoadError(null);

    const result = await listAzureCostExports(connectorId, prefix);

    if (result.success) {
      setRemoteFiles(result.blobs);
      setRemoteFolders(result.folders);
      setIsFocusExportRoot(result.isFocusExportRoot);
    } else {
      setLoadError(result.error);
    }

    setIsLoadingRemoteFiles(false);
  };

  const handleNavigateToFolder = (folderPath: string) => {
    if (!selectedConnector) return;
    setPathHistory((prev) => [...prev, currentPath]);
    setCurrentPath(folderPath);
    handleBrowseConnector(selectedConnector, folderPath);
  };

  const handleNavigateBack = () => {
    if (!selectedConnector || pathHistory.length === 0) return;
    const previousPath = pathHistory[pathHistory.length - 1];
    setPathHistory((prev) => prev.slice(0, -1));
    setCurrentPath(previousPath);
    handleBrowseConnector(selectedConnector, previousPath || undefined);
  };

  // ============================================================================
  // Selection Handlers
  // ============================================================================

  const handleToggleFileSelection = (file: string) => {
    setSelectedFiles((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(file)) {
        newSet.delete(file);
      } else {
        newSet.add(file);
      }
      return newSet;
    });
  };

  const handleToggleFolderSelection = (folder: FocusFolder) => {
    setSelectedFolders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(folder.path)) {
        newSet.delete(folder.path);
      } else {
        newSet.add(folder.path);
      }
      return newSet;
    });
  };

  const handleSelectAllFiles = () => {
    if (selectedFiles.size === remoteFiles.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(remoteFiles));
    }
  };

  const handleSelectAllFolders = () => {
    const focusFolders = remoteFolders.filter(f => f.isFocusDateRange);
    if (selectedFolders.size === focusFolders.length) {
      setSelectedFolders(new Set());
    } else {
      setSelectedFolders(new Set(focusFolders.map(f => f.path)));
    }
  };

  // ============================================================================
  // Load Handlers
  // ============================================================================

  /**
   * Load selected items and save as a data source
   */
  const handleLoadSelected = async () => {
    if (!selectedConnector) return;
    
    const hasFiles = selectedFiles.size > 0;
    const hasFolders = selectedFolders.size > 0;
    
    if (!hasFiles && !hasFolders) return;

    setIsLoadingMultiple(true);
    setLoadError(null);

    const connector = connectors.find(c => c.id === selectedConnector);
    const connectorName = connector?.name || 'Azure';

    try {
      // Collect all files to load
      const allFilesToLoad: string[] = [];
      const folderPathsToSave: string[] = [];
      const dateRanges: { start: string; end: string }[] = [];
      
      // Process selected folders first
      if (hasFolders) {
        setLoadingProgress({ current: 0, total: selectedFolders.size, message: 'Discovering files in folders...' });
        
        let folderIndex = 0;
        for (const folderPath of selectedFolders) {
          folderIndex++;
          folderPathsToSave.push(folderPath);
          const folder = remoteFolders.find(f => f.path === folderPath);
          const folderName = folderPath.replace(/\/$/, '').split('/').pop() || folderPath;
          setLoadingProgress({ 
            current: folderIndex, 
            total: selectedFolders.size, 
            message: `Scanning ${folder?.dateRange ? formatFocusDateRange(folder.dateRange) : folderName}...` 
          });

          const filesResult = await listFilesInFolder(selectedConnector, folderPath);
          
          if (filesResult.success) {
            allFilesToLoad.push(...filesResult.blobs);
            if (folder?.dateRange) {
              dateRanges.push(folder.dateRange);
            }
          }
        }
      }

      // Add directly selected files
      allFilesToLoad.push(...Array.from(selectedFiles));

      if (allFilesToLoad.length === 0) {
        setLoadError('No files found to load. Try navigating into a folder to find parquet files.');
        setIsLoadingMultiple(false);
        return;
      }

      // Determine combined date range
      let combinedDateRange: { start: string; end: string } | undefined;
      if (dateRanges.length === 1) {
        combinedDateRange = dateRanges[0];
      } else if (dateRanges.length > 1) {
        const sortedStarts = dateRanges.map(d => d.start).sort();
        const sortedEnds = dateRanges.map(d => d.end).sort();
        combinedDateRange = {
          start: sortedStarts[0],
          end: sortedEnds[sortedEnds.length - 1],
        };
      }

      // Load all files
      setLoadingProgress({ current: 0, total: allFilesToLoad.length, message: '' });
      
      const loadedBlobPaths: string[] = [];
      let totalRowCount = 0;
      let columns: string[] = [];
      
      for (let i = 0; i < allFilesToLoad.length; i++) {
        const blobPath = allFilesToLoad[i];
        const fileName = blobPath.split('/').pop() || blobPath;
        setLoadingProgress({ current: i + 1, total: allFilesToLoad.length, message: fileName });

        try {
          const sasResult = await generateAzureSasUrl({ connectorId: selectedConnector, blobPath });

          if (!sasResult.success) {
            console.error(`Failed to get SAS for ${blobPath}:`, sasResult.error);
            continue;
          }

          const tableName = generateTableName(blobPath);
          const result = await mountRemoteAzureSource(sasResult.sasUrl, tableName);
          
          loadedBlobPaths.push(blobPath);
          totalRowCount += result.rowCount;
          if (columns.length === 0) {
            columns = result.columns;
          }
        } catch (error) {
          console.error(`Failed to load ${blobPath}:`, error);
        }
      }

      if (loadedBlobPaths.length > 0) {
        const combinedTableName = generateCombinedTableName(connectorName);
        const focusVersion = detectFocusVersion(columns);
        
        // Save to database immediately
        const config: DataSourceConfig = {
          blobPaths: loadedBlobPaths,
          folderPaths: folderPathsToSave,
          tableName: combinedTableName,
          dateRange: combinedDateRange,
          autoImportNewMonths: false,
          focusVersion,
        };

        const saveResult = await createDataSource({
          connectorId: selectedConnector,
          name: connectorName, // Use connector name as default
          provider: (connector?.provider || 'azure') as 'azure' | 'aws' | 'gcp',
          config,
          rowCount: totalRowCount,
          columns,
        });

        if (saveResult.success) {
          setLoadedSources((prev) => [
            ...prev,
            {
              id: saveResult.dataSource.id,
              name: connectorName,
              tableName: combinedTableName,
              rowCount: totalRowCount,
              columns,
              source: (connector?.provider || 'azure') as 'azure' | 'aws' | 'gcp',
              connectorId: selectedConnector,
              connectorName,
              blobPaths: loadedBlobPaths,
              folderPaths: folderPathsToSave,
              dateRange: combinedDateRange,
              loadedAt: new Date(),
              autoImportNewMonths: false,
              isSaved: true,
              focusVersion,
            },
          ]);
        } else {
          // Still add to UI even if save failed
          setLoadedSources((prev) => [
            ...prev,
            {
              name: connectorName,
              tableName: combinedTableName,
              rowCount: totalRowCount,
              columns,
              source: (connector?.provider || 'azure') as 'azure' | 'aws' | 'gcp',
              connectorId: selectedConnector,
              connectorName,
              blobPaths: loadedBlobPaths,
              folderPaths: folderPathsToSave,
              dateRange: combinedDateRange,
              loadedAt: new Date(),
              autoImportNewMonths: false,
              isSaved: false,
              focusVersion,
            },
          ]);
          console.error('Failed to save data source:', saveResult.error);
        }
      }

      setIsRemoteDialogOpen(false);
      setSelectedFiles(new Set());
      setSelectedFolders(new Set());
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to load selected items');
    }

    setIsLoadingMultiple(false);
  };

  /**
   * Load entire dataset (all visible folders)
   */
  const handleLoadEntireDataset = async () => {
    if (!selectedConnector) return;
    
    const focusFolders = remoteFolders.filter(f => f.isFocusDateRange);
    if (focusFolders.length === 0) {
      setLoadError('No date range folders found');
      return;
    }
    
    setSelectedFolders(new Set(focusFolders.map(f => f.path)));
    setTimeout(() => handleLoadSelected(), 0);
  };

  // ============================================================================
  // Settings Dialog Handlers
  // ============================================================================

  const handleOpenSettings = (source: LoadedSource) => {
    setEditingSource(source);
    setSettingsName(source.name);
    setSettingsAutoImport(source.autoImportNewMonths || false);
    setIsSettingsDialogOpen(true);
  };

  const handleSaveSettings = async () => {
    if (!editingSource) return;

    setIsSaving(true);
    setLoadError(null);

    try {
      if (editingSource.id) {
        // Update existing data source
        const result = await updateDataSource({
          id: editingSource.id,
          name: settingsName,
          config: {
            autoImportNewMonths: settingsAutoImport,
          },
        });

        if (!result.success) {
          throw new Error(result.error);
        }
      } else if (editingSource.connectorId) {
        // Create new data source
        const config: DataSourceConfig = {
          blobPaths: editingSource.blobPaths || [],
          folderPaths: editingSource.folderPaths || [],
          tableName: editingSource.tableName,
          dateRange: editingSource.dateRange,
          autoImportNewMonths: settingsAutoImport,
        };

        const result = await createDataSource({
          connectorId: editingSource.connectorId,
          name: settingsName,
          provider: editingSource.source as 'azure' | 'aws' | 'gcp',
          config,
          rowCount: editingSource.rowCount,
          columns: editingSource.columns,
        });

        if (!result.success) {
          throw new Error(result.error);
        }

        // Update with new ID
        setLoadedSources((prev) =>
          prev.map((s) =>
            s.tableName === editingSource.tableName
              ? { ...s, id: result.dataSource.id, name: settingsName, autoImportNewMonths: settingsAutoImport, isSaved: true }
              : s
          )
        );
        setIsSettingsDialogOpen(false);
        setEditingSource(null);
        setIsSaving(false);
        return;
      }

      // Update local state
      setLoadedSources((prev) =>
        prev.map((s) =>
          s.tableName === editingSource.tableName
            ? { ...s, name: settingsName, autoImportNewMonths: settingsAutoImport }
            : s
        )
      );

      setIsSettingsDialogOpen(false);
      setEditingSource(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to save settings');
    }

    setIsSaving(false);
  };

  // ============================================================================
  // Refresh Handler
  // ============================================================================

  const handleRefreshSource = async (source: LoadedSource) => {
    if (!source.connectorId || !source.blobPaths?.length) return;
    
    // Mark as loading
    setLoadedSources(prev => prev.map(s => 
      s.tableName === source.tableName ? { ...s, isLoading: true } : s
    ));

    try {
      // If we have folder paths and auto-import is enabled, check for new files
      if (source.autoImportNewMonths && source.folderPaths?.length) {
        for (const folderPath of source.folderPaths) {
          const filesResult = await listFilesInFolder(source.connectorId, folderPath);
          if (filesResult.success) {
            // Load any new files
            for (const blobPath of filesResult.blobs) {
              if (!source.blobPaths?.includes(blobPath)) {
                const sasResult = await generateAzureSasUrl({ 
                  connectorId: source.connectorId, 
                  blobPath 
                });
                if (sasResult.success) {
                  const tableName = generateTableName(blobPath);
                  await mountRemoteAzureSource(sasResult.sasUrl, tableName);
                }
              }
            }
          }
        }
      } else {
        // Just reload existing files
        for (const blobPath of source.blobPaths) {
          const sasResult = await generateAzureSasUrl({ 
            connectorId: source.connectorId, 
            blobPath 
          });
          if (sasResult.success) {
            const tableName = generateTableName(blobPath);
            await mountRemoteAzureSource(sasResult.sasUrl, tableName);
          }
        }
      }

      // Update last refresh time if saved
      if (source.id) {
        await updateDataSource({
          id: source.id,
          lastRefreshAt: new Date(),
        });
      }
    } catch (error) {
      console.error('Failed to refresh source:', error);
      setLoadError(error instanceof Error ? error.message : 'Failed to refresh');
    }

    setLoadedSources(prev => prev.map(s => 
      s.tableName === source.tableName ? { ...s, isLoading: false, loadedAt: new Date() } : s
    ));
  };

  // ============================================================================
  // Remove Handler
  // ============================================================================

  const handleRemoveSource = async (source: LoadedSource) => {
    try {
      // Remove from DuckDB
      await executeQuery(`DROP TABLE IF EXISTS "${source.tableName}"`);
      
      // Delete from database if saved
      if (source.id) {
        await deleteDataSource(source.id);
      }
      
      setLoadedSources((prev) => prev.filter((s) => s.tableName !== source.tableName));
    } catch (error) {
      console.error('Failed to remove source:', error);
    }
  };

  // ============================================================================
  // Computed Values
  // ============================================================================

  const activeConnectors = connectors.filter((c) => c.status === 'active');
  const focusFolders = remoteFolders.filter(f => f.isFocusDateRange);
  const regularFolders = remoteFolders.filter(f => !f.isFocusDateRange);
  const hasSelection = selectedFiles.size > 0 || selectedFolders.size > 0;

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Database className="h-8 w-8" />
            Data Sources
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your cost data from local files or cloud connectors
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => document.getElementById('file-input')?.click()}
            disabled={!isReady || isLoadingFile}
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload File
          </Button>
          <input
            id="file-input"
            type="file"
            className="hidden"
            accept=".csv,.parquet,.json,.jsonl,.ndjson,.tsv"
            multiple
            onChange={(e) => handleFileUpload(e.target.files)}
          />

          <Dialog open={isRemoteDialogOpen} onOpenChange={(open) => {
            setIsRemoteDialogOpen(open);
            if (!open) {
              setCurrentPath('');
              setPathHistory([]);
              setSelectedFiles(new Set());
              setSelectedFolders(new Set());
              setIsFocusExportRoot(false);
            }
          }}>
            <DialogTrigger asChild>
              <Button disabled={!isReady || activeConnectors.length === 0}>
                <CloudDownload className="h-4 w-4 mr-2" />
                Add Data Source
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[750px] max-h-[85vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>Add Data Source from Cloud</DialogTitle>
                <DialogDescription>
                  Select months or files to add as a data source. Data will be saved and auto-loaded when you return.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4 flex-1 overflow-hidden flex flex-col">
                {/* Connector Select */}
                <div className="space-y-2">
                  <Label>Select Connector</Label>
                  <Select
                    value={selectedConnector || ''}
                    onValueChange={(v) => {
                      setCurrentPath('');
                      setPathHistory([]);
                      setSelectedFiles(new Set());
                      setSelectedFolders(new Set());
                      handleBrowseConnector(v);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a connector..." />
                    </SelectTrigger>
                    <SelectContent>
                      {activeConnectors.map((c) => {
                        const config = c.config as AzureConnectorConfig | null;
                        const providerInfo = getProviderDisplay(c.provider);
                        return (
                          <SelectItem key={c.id} value={c.id}>
                            <span className="flex items-center gap-2">
                              <span>{providerInfo.icon}</span>
                              <span>{c.name}</span>
                              {config?.containerName && (
                                <span className="text-muted-foreground">
                                  ({config.containerName})
                                </span>
                              )}
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {/* Navigation Breadcrumb */}
                {selectedConnector && currentPath && (
                  <div className="flex items-center gap-2 text-sm">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleNavigateBack}
                      disabled={pathHistory.length === 0}
                    >
                      <ArrowLeft className="h-4 w-4 mr-1" />
                      Back
                    </Button>
                    <span className="text-muted-foreground font-mono truncate">
                      /{currentPath}
                    </span>
                  </div>
                )}

                {/* Loading States */}
                {isLoadingRemoteFiles && (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                    <span>Loading...</span>
                  </div>
                )}

                {isLoadingMultiple && (
                  <div className="space-y-2 py-4">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>Loading {loadingProgress.current} of {loadingProgress.total}...</span>
                      </div>
                      {loadingProgress.message && (
                        <span className="text-sm text-muted-foreground font-mono truncate max-w-full">
                          {loadingProgress.message}
                        </span>
                      )}
                    </div>
                    <Progress value={(loadingProgress.current / loadingProgress.total) * 100} />
                  </div>
                )}

                {/* Empty State */}
                {!isLoadingRemoteFiles && !isLoadingMultiple && remoteFolders.length === 0 && remoteFiles.length === 0 && selectedConnector && (
                  <div className="text-center py-8 text-muted-foreground">
                    No folders or files found at this location.
                  </div>
                )}

                {/* Content Browser */}
                {!isLoadingRemoteFiles && !isLoadingMultiple && (remoteFolders.length > 0 || remoteFiles.length > 0) && (
                  <div className="flex-1 overflow-hidden flex flex-col">
                    {/* FOCUS Export Detection Banner */}
                    {isFocusExportRoot && (
                      <div className="flex items-center gap-3 p-4 mb-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                        <Calendar className="h-6 w-6 text-blue-500 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm font-semibold">FOCUS Cost Export Detected</p>
                          <p className="text-xs text-muted-foreground">
                            Select individual months or load the entire dataset.
                          </p>
                        </div>
                        <Button
                          size="sm"
                          onClick={handleLoadEntireDataset}
                          disabled={focusFolders.length === 0}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Load All ({focusFolders.length})
                        </Button>
                      </div>
                    )}

                    {/* Header with selection controls */}
                    <div className="flex items-center justify-between pb-2 border-b mb-2">
                      <div className="flex items-center gap-4">
                        {focusFolders.length > 0 && (
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={selectedFolders.size === focusFolders.length && focusFolders.length > 0}
                              onCheckedChange={handleSelectAllFolders}
                            />
                            <span className="text-sm text-muted-foreground">
                              {selectedFolders.size > 0 
                                ? `${selectedFolders.size} of ${focusFolders.length} month(s)` 
                                : `${focusFolders.length} month(s)`}
                            </span>
                          </div>
                        )}
                        {remoteFiles.length > 0 && (
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={selectedFiles.size === remoteFiles.length && remoteFiles.length > 0}
                              onCheckedChange={handleSelectAllFiles}
                            />
                            <span className="text-sm text-muted-foreground">
                              {selectedFiles.size > 0 
                                ? `${selectedFiles.size} of ${remoteFiles.length} file(s)` 
                                : `${remoteFiles.length} file(s)`}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Scrollable content */}
                    <div className="space-y-1 overflow-y-auto flex-1 max-h-[350px]">
                      {/* FOCUS Date Range Folders */}
                      {focusFolders.map((folder) => {
                        const isSelected = selectedFolders.has(folder.path);
                        return (
                          <div
                            key={folder.path}
                            className={`flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer ${
                              isSelected ? 'bg-primary/10 border-primary/50' : ''
                            }`}
                            onClick={() => handleToggleFolderSelection(folder)}
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => handleToggleFolderSelection(folder)}
                                onClick={(e) => e.stopPropagation()}
                              />
                              <Calendar className="h-4 w-4 flex-shrink-0 text-blue-500" />
                              <div className="flex flex-col min-w-0">
                                <span className="text-sm font-medium">
                                  {folder.dateRange ? formatFocusDateRange(folder.dateRange) : folder.name}
                                </span>
                                <span className="text-xs text-muted-foreground font-mono">
                                  {folder.name}
                                </span>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleNavigateToFolder(folder.path);
                              }}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        );
                      })}

                      {/* Regular Folders */}
                      {regularFolders.map((folder) => (
                        <div
                          key={folder.path}
                          className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                          onClick={() => handleNavigateToFolder(folder.path)}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <Folder className="h-4 w-4 flex-shrink-0 text-yellow-500" />
                            <span className="text-sm truncate font-medium">{folder.name}</span>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      ))}

                      {/* Files */}
                      {remoteFiles.map((file) => {
                        const fileName = file.split('/').pop() || file;
                        const isSelected = selectedFiles.has(file);
                        return (
                          <div
                            key={file}
                            className={`flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer ${
                              isSelected ? 'bg-primary/10 border-primary/50' : ''
                            }`}
                            onClick={() => handleToggleFileSelection(file)}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => handleToggleFileSelection(file)}
                                onClick={(e) => e.stopPropagation()}
                              />
                              <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                              <span className="text-sm truncate font-mono">{fileName}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              {hasSelection && (
                <DialogFooter className="border-t pt-4">
                  <div className="flex items-center justify-between w-full">
                    <span className="text-sm text-muted-foreground">
                      {selectedFolders.size > 0 && `${selectedFolders.size} month(s)`}
                      {selectedFolders.size > 0 && selectedFiles.size > 0 && ', '}
                      {selectedFiles.size > 0 && `${selectedFiles.size} file(s)`}
                      {' selected'}
                    </span>
                    <Button
                      onClick={handleLoadSelected}
                      disabled={isLoadingMultiple}
                    >
                      {isLoadingMultiple ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4 mr-2" />
                      )}
                      Add Data Source
                    </Button>
                  </div>
                </DialogFooter>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Engine Status */}
      {!isReady && (
        <Card className="border-yellow-500/50 bg-yellow-500/10">
          <CardContent className="flex items-center gap-3 py-4">
            <Loader2 className="h-5 w-5 animate-spin text-yellow-500" />
            <span>Initializing analytics engine...</span>
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {loadError && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="flex items-center gap-3 py-4">
            <XCircle className="h-5 w-5 text-destructive" />
            <span className="text-destructive flex-1">{loadError}</span>
            <Button variant="ghost" size="sm" onClick={() => setLoadError(null)}>
              Dismiss
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Upload Progress */}
      {isLoadingFile && (
        <Card>
          <CardContent className="py-4 space-y-2">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading files...</span>
            </div>
            <Progress value={loadProgress} />
          </CardContent>
        </Card>
      )}

      {/* Drop Zone */}
      <Card
        className="border-dashed cursor-pointer hover:border-primary/50 transition-colors"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => document.getElementById('file-input')?.click()}
      >
        <CardContent className="flex flex-col items-center justify-center py-8">
          <Upload className="h-10 w-10 text-muted-foreground mb-3" />
          <h3 className="text-lg font-semibold">Drop files here</h3>
          <p className="text-muted-foreground text-center max-w-sm mt-1 text-sm">
            Drag and drop CSV, Parquet, or JSON files
          </p>
        </CardContent>
      </Card>

      {/* Data Sources */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-500" />
          Data Sources ({loadedSources.length})
        </h2>

        {loadedSources.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No data sources yet. Add a data source from a cloud connector or upload a file.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {loadedSources.map((source) => {
              const providerInfo = getProviderDisplay(source.source);
              return (
                <Card key={source.tableName} className={source.isLoading ? 'opacity-70' : ''}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-base truncate flex items-center gap-2" title={source.name}>
                          {source.isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                          {source.name}
                        </CardTitle>
                        {source.dateRange && (
                          <CardDescription className="flex items-center gap-1 mt-1">
                            <Calendar className="h-3 w-3" />
                            {formatFocusDateRange(source.dateRange)}
                          </CardDescription>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge className={`${providerInfo.color} flex-shrink-0`}>
                          {providerInfo.icon} {providerInfo.name}
                        </Badge>
                        {source.isSaved && (
                          <Badge variant="outline" className="text-xs">
                            Saved
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-sm space-y-1">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Rows:</span>
                        <span className="font-mono">{source.rowCount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Columns:</span>
                        <span>{source.columns.length}</span>
                      </div>
                      {source.focusVersion && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">FOCUS:</span>
                          <span className="font-medium text-blue-500">v{source.focusVersion}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Files:</span>
                        <span>{source.blobPaths?.length || 1}</span>
                      </div>
                      {source.autoImportNewMonths && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Auto-import:</span>
                          <span className="text-green-500">Enabled</span>
                        </div>
                      )}
                      {source.loadWarning && (
                        <div className="flex items-center gap-1 text-yellow-500 text-xs mt-1">
                          <AlertCircle className="h-3 w-3" />
                          <span>{source.loadWarning}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {source.columns.slice(0, 4).map((col) => (
                        <Badge key={col} variant="outline" className="text-xs">
                          {col}
                        </Badge>
                      ))}
                      {source.columns.length > 4 && (
                        <Badge variant="outline" className="text-xs">
                          +{source.columns.length - 4}
                        </Badge>
                      )}
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button variant="outline" size="sm" className="flex-1" asChild>
                        <Link href="/dashboard">
                          Query
                        </Link>
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleOpenSettings(source)}>
                            <Settings className="h-4 w-4 mr-2" />
                            Settings
                          </DropdownMenuItem>
                          {source.connectorId && (
                            <DropdownMenuItem onClick={() => handleRefreshSource(source)}>
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Refresh Data
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={() => handleRemoveSource(source)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* No Connectors Warning */}
      {connectors.length === 0 && (
        <Card className="bg-muted/50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Cable className="h-5 w-5" />
              No Cloud Connectors Configured
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>
              To load data directly from Azure Blob Storage, configure a connector first.
            </p>
            <Button variant="outline" className="mt-4" asChild>
              <Link href="/dashboard/connectors">
                <Cable className="h-4 w-4 mr-2" />
                Configure Connectors
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Settings Dialog */}
      <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Data Source Settings</DialogTitle>
            <DialogDescription>
              Configure how this data source is managed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="source-name">Name</Label>
              <Input
                id="source-name"
                value={settingsName}
                onChange={(e) => setSettingsName(e.target.value)}
                placeholder="Data source name"
              />
            </div>

            {/* Connector Info */}
            {editingSource?.connectorName && (
              <div className="space-y-2">
                <Label>Source Connector</Label>
                <div className="text-sm p-2 bg-muted rounded flex items-center gap-2">
                  <Cable className="h-4 w-4 text-muted-foreground" />
                  <span>{editingSource.connectorName}</span>
                </div>
              </div>
            )}
            
            {editingSource?.dateRange && (
              <div className="space-y-2">
                <Label>Date Range</Label>
                <div className="text-sm text-muted-foreground p-2 bg-muted rounded">
                  {formatFocusDateRange(editingSource.dateRange)}
                </div>
              </div>
            )}

            {editingSource?.focusVersion && (
              <div className="space-y-2">
                <Label>FOCUS Version</Label>
                <div className="text-sm p-2 bg-muted rounded">
                  <span className="font-medium text-blue-500">v{editingSource.focusVersion}</span>
                  <span className="text-muted-foreground ml-2">
                    ({editingSource.focusVersion === '1.2' ? 'Latest' : editingSource.focusVersion === '1.1' ? 'Current' : 'Initial'})
                  </span>
                </div>
              </div>
            )}

            {editingSource?.connectorId && (
              <div className="flex items-center justify-between space-x-2 p-4 border rounded-lg">
                <div className="space-y-0.5">
                  <Label htmlFor="auto-import">Auto-import new months</Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically load new monthly data as it becomes available
                  </p>
                </div>
                <Switch
                  id="auto-import"
                  checked={settingsAutoImport}
                  onCheckedChange={setSettingsAutoImport}
                />
              </div>
            )}

            {/* Detailed File Status */}
            {editingSource?.fileStatuses && editingSource.fileStatuses.length > 0 ? (
              <div className="space-y-2">
                <Label>
                  Loaded Files ({editingSource.fileStatuses.filter(f => f.status === 'loaded').length}/{editingSource.fileStatuses.length})
                </Label>
                <div className="text-sm max-h-48 overflow-y-auto space-y-2 border rounded-lg p-2">
                  {editingSource.fileStatuses.map((file, i) => (
                    <div 
                      key={i} 
                      className={`p-2 rounded-md ${
                        file.status === 'failed' 
                          ? 'bg-red-500/10 border border-red-500/20' 
                          : file.status === 'loaded'
                          ? 'bg-green-500/10 border border-green-500/20'
                          : 'bg-muted'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {file.status === 'loaded' && (
                              <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
                            )}
                            {file.status === 'failed' && (
                              <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                            )}
                            {(file.status === 'pending' || file.status === 'loading') && (
                              <Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin shrink-0" />
                            )}
                            <span className="font-medium text-xs truncate">{file.friendlyName}</span>
                          </div>
                          <p className="text-xs text-muted-foreground ml-5 truncate" title={file.path}>
                            {file.parentFolder}/{file.fileName}
                          </p>
                          {file.status === 'failed' && file.error && (
                            <p className="text-xs text-red-400 ml-5 mt-1">
                              ⚠️ {file.error}
                            </p>
                          )}
                          {file.status === 'loaded' && file.rowCount !== undefined && (
                            <p className="text-xs text-green-400/80 ml-5">
                              {file.rowCount.toLocaleString()} rows
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : editingSource?.blobPaths && editingSource.blobPaths.length > 0 && (
              <div className="space-y-2">
                <Label>Loaded Files</Label>
                <div className="text-sm text-muted-foreground max-h-32 overflow-y-auto space-y-1 border rounded-lg p-2">
                  {editingSource.blobPaths.map((path, i) => {
                    const { parentFolder, friendlyName } = extractPathContext(path);
                    const fileName = path.split('/').pop() || path;
                    return (
                      <div key={i} className="p-1.5 bg-muted rounded text-xs">
                        <div className="flex items-center gap-2">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="font-medium">{friendlyName}</span>
                        </div>
                        <p className="text-muted-foreground ml-5 truncate" title={path}>
                          {parentFolder}/{fileName}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSettingsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSettings} disabled={!settingsName.trim() || isSaving}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
