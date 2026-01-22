'use client';

/**
 * Storage Manager Component
 * 
 * Provides a comprehensive interface for managing Local-First data storage in Focal.
 * Includes visual usage indicators, persistence configuration, retention settings,
 * and the nuclear "purge all data" option.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  HardDrive,
  Database,
  Clock,
  AlertTriangle,
  Trash2,
  RefreshCw,
  Settings2,
  Shield,
  Zap,
} from 'lucide-react';
import {
  getStorageController,
  type StorageInfo,
  type StorageSettings,
  type RetentionSettings,
  type StorageMode,
} from '@/lib/storage-controller';

export function StorageManager() {
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [settings, setSettings] = useState<StorageSettings | null>(null);
  const [retentionOptions, setRetentionOptions] = useState<RetentionSettings[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cleaningUp, setCleaningUp] = useState(false);
  const [purging, setPurging] = useState(false);

  const storageController = getStorageController();

  // ============================================================================
  // Data Loading
  // ============================================================================

  const loadData = useCallback(async () => {
    try {
      const [info, currentSettings, options] = await Promise.all([
        storageController.getStorageInfo(),
        Promise.resolve(storageController.getSettings()),
        Promise.resolve(storageController.getRetentionOptions()),
      ]);
      
      setStorageInfo(info);
      setSettings(currentSettings);
      setRetentionOptions(options);
    } catch (error) {
      console.error('[StorageManager] Failed to load data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [storageController]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
  };

  const handleStorageModeChange = (mode: StorageMode) => {
    if (!settings) return;
    
    const newSettings = { ...settings, mode };
    storageController.updateSettings(newSettings);
    setSettings(newSettings);
  };

  const handleRetentionChange = (retentionLabel: string) => {
    if (!settings) return;
    
    const retention = retentionOptions.find(opt => opt.label === retentionLabel);
    if (!retention) return;

    const newSettings = { ...settings, retention };
    storageController.updateSettings(newSettings);
    setSettings(newSettings);
  };

  const handleWarningsToggle = (showWarnings: boolean) => {
    if (!settings) return;
    
    const newSettings = { ...settings, showWarnings };
    storageController.updateSettings(newSettings);
    setSettings(newSettings);
  };

  const handleRunCleanup = async () => {
    setCleaningUp(true);
    try {
      const result = await storageController.runRetentionCleanup();
      console.log('[StorageManager] Cleanup completed:', result);
      
      // Refresh storage info after cleanup
      await loadData();
    } catch (error) {
      console.error('[StorageManager] Cleanup failed:', error);
    } finally {
      setCleaningUp(false);
    }
  };

  const handlePurgeAllData = async () => {
    setPurging(true);
    try {
      await storageController.purgeAllData();
      
      // Reload the page to ensure clean state
      storageController.reloadApplication();
    } catch (error) {
      console.error('[StorageManager] Purge failed:', error);
      setPurging(false);
    }
  };

  // ============================================================================
  // Render Helpers
  // ============================================================================

  const formatUsage = (bytes: number) => storageController.formatBytes(bytes);

  const getStorageStatusColor = (usagePercent: number) => {
    if (usagePercent >= 90) return 'text-red-500';
    if (usagePercent >= 75) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getStorageStatusIcon = (usagePercent: number) => {
    if (usagePercent >= 90) return <AlertTriangle className="h-4 w-4 text-red-500" />;
    if (usagePercent >= 75) return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    return <HardDrive className="h-4 w-4 text-green-500" />;
  };

  // ============================================================================
  // Loading State
  // ============================================================================

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Storage Manager
          </CardTitle>
          <CardDescription>
            Loading storage information...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!storageInfo || !settings) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Storage Manager
          </CardTitle>
          <CardDescription>
            Failed to load storage information.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleRefresh} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ============================================================================
  // Main Render
  // ============================================================================

  return (
    <div className="space-y-6">
      {/* Storage Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Storage Usage
            <Button
              onClick={handleRefresh}
              variant="ghost"
              size="sm"
              disabled={refreshing}
              className="ml-auto"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </CardTitle>
          <CardDescription>
            Local browser storage for billing data and analytics
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Usage Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                {getStorageStatusIcon(storageInfo.usagePercent)}
                Storage Used
              </span>
              <span className={getStorageStatusColor(storageInfo.usagePercent)}>
                {formatUsage(storageInfo.usage)} of {formatUsage(storageInfo.quota)}
              </span>
            </div>
            <Progress 
              value={storageInfo.usagePercent} 
              className="h-2"
            />
            <div className="text-xs text-muted-foreground text-center">
              {storageInfo.usagePercent.toFixed(1)}% used
            </div>
          </div>

          <Separator />

          {/* Storage Breakdown */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Storage Breakdown</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Database className="h-3 w-3 text-blue-500" />
                    Billing Data
                  </span>
                  <span>{storageInfo.breakdownPercent.billingData.toFixed(1)}%</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatUsage(storageInfo.breakdown.billingData)}
                </div>
              </div>
              
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Zap className="h-3 w-3 text-yellow-500" />
                    Indexes
                  </span>
                  <span>{storageInfo.breakdownPercent.indexes.toFixed(1)}%</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatUsage(storageInfo.breakdown.indexes)}
                </div>
              </div>
              
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <RefreshCw className="h-3 w-3 text-green-500" />
                    Cache
                  </span>
                  <span>{storageInfo.breakdownPercent.cache.toFixed(1)}%</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatUsage(storageInfo.breakdown.cache)}
                </div>
              </div>
              
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Settings2 className="h-3 w-3 text-gray-500" />
                    Other
                  </span>
                  <span>{storageInfo.breakdownPercent.other.toFixed(1)}%</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatUsage(storageInfo.breakdown.other)}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Storage Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Data Persistence
          </CardTitle>
          <CardDescription>
            Configure how billing data is stored in your browser
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Storage Mode */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Storage Mode</Label>
            <Select
              value={settings.mode}
              onValueChange={handleStorageModeChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select storage mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PERSISTENT">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-blue-500" />
                    <div>
                      <div>Persistent</div>
                      <div className="text-xs text-muted-foreground">
                        Save data to device (recommended)
                      </div>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="EPHEMERAL">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-yellow-500" />
                    <div>
                      <div>Memory Only</div>
                      <div className="text-xs text-muted-foreground">
                        RAM only, faster but temporary
                      </div>
                    </div>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            {settings.mode === 'EPHEMERAL' && (
              <div className="text-xs text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded">
                ⚠️ Memory-only mode: Data will be lost when you close the browser
              </div>
            )}
          </div>

          <Separator />

          {/* Data Retention */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Data Retention</Label>
            <Select
              value={settings.retention.label}
              onValueChange={handleRetentionChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select retention period" />
              </SelectTrigger>
              <SelectContent>
                {retentionOptions.map((option) => (
                  <SelectItem key={option.label} value={option.label}>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-gray-500" />
                      {option.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="text-xs text-muted-foreground">
              Automatically delete data older than the selected period
            </div>
          </div>

          <Separator />

          {/* Storage Warnings */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-sm font-medium">Storage Warnings</Label>
              <div className="text-xs text-muted-foreground">
                Show alerts when storage usage is high
              </div>
            </div>
            <Switch
              checked={settings.showWarnings}
              onCheckedChange={handleWarningsToggle}
            />
          </div>
        </CardContent>
      </Card>

      {/* Maintenance Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Maintenance
          </CardTitle>
          <CardDescription>
            Clean up old data and manage storage space
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Cleanup Button */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-sm font-medium">Run Cleanup</div>
              <div className="text-xs text-muted-foreground">
                Remove old files based on retention settings ({settings.retention.label})
              </div>
            </div>
            <Button
              onClick={handleRunCleanup}
              disabled={cleaningUp}
              variant="outline"
            >
              {cleaningUp ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {cleaningUp ? 'Cleaning...' : 'Clean Up'}
            </Button>
          </div>

          <Separator />

          {/* Danger Zone - Purge All */}
          <div className="border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 p-4 rounded-lg">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                <AlertTriangle className="h-4 w-4" />
                <span className="font-medium">Danger Zone</span>
              </div>
              
              <div className="space-y-2">
                <div className="text-sm font-medium text-red-700 dark:text-red-400">
                  Delete All Data
                </div>
                <div className="text-xs text-red-600 dark:text-red-500">
                  This will permanently delete all billing data, indexes, and cache from this device. 
                  This action cannot be undone.
                </div>
              </div>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={purging}
                  >
                    {purging ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 mr-2" />
                    )}
                    {purging ? 'Purging...' : 'Delete All Data'}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                      Delete All Data?
                    </AlertDialogTitle>
                    <AlertDialogDescription className="space-y-2">
                      <p>
                        This will permanently delete <strong>all</strong> local data including:
                      </p>
                      <ul className="list-disc list-inside text-sm space-y-1 ml-4">
                        <li>All billing data and cost exports</li>
                        <li>Query indexes and analytics cache</li>
                        <li>Saved views and bookmarks</li>
                        <li>Local settings and preferences</li>
                      </ul>
                      <p className="text-red-600 dark:text-red-400 font-medium">
                        This action cannot be undone. The application will reload to a clean state.
                      </p>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handlePurgeAllData}
                      className="bg-red-500 hover:bg-red-600"
                    >
                      Yes, Delete Everything
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}