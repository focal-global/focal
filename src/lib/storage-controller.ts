'use client';

/**
 * Storage Controller for Local-First Data Management
 * 
 * Provides comprehensive control over browser-based data storage for the Focal platform.
 * Manages OPFS (Origin Private File System) files, IndexedDB metadata, and storage quotas.
 * 
 * Features:
 * - Storage usage monitoring via navigator.storage.estimate()
 * - Data persistence configuration (PERSISTENT vs EPHEMERAL)
 * - Smart retention with automatic cleanup
 * - Nuclear purge option to reset all local data
 * - Breakdown of storage usage by category
 */

import * as duckdb from '@duckdb/duckdb-wasm';

// ============================================================================
// Types & Interfaces
// ============================================================================

export type StorageMode = 'PERSISTENT' | 'EPHEMERAL';

export interface StorageInfo {
  /** Total storage quota in bytes */
  quota: number;
  /** Currently used storage in bytes */
  usage: number;
  /** Usage percentage (0-100) */
  usagePercent: number;
  /** Breakdown by category */
  breakdown: {
    billingData: number;
    indexes: number;
    cache: number;
    other: number;
  };
  /** Breakdown percentages */
  breakdownPercent: {
    billingData: number;
    indexes: number;
    cache: number;
    other: number;
  };
}

export interface RetentionSettings {
  /** Retention period in days (0 = forever) */
  days: number;
  /** Human readable label */
  label: string;
}

export interface StorageSettings {
  /** Storage mode configuration */
  mode: StorageMode;
  /** Data retention settings */
  retention: RetentionSettings;
  /** Whether to show storage warnings */
  showWarnings: boolean;
  /** Auto-cleanup threshold (percentage) */
  autoCleanupThreshold: number;
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_SETTINGS_KEY = 'focal_storage_settings';
const OPFS_ROOT_PATH = '/focal-data';
const INDEXEDDB_NAME = 'focal-metadata';

const DEFAULT_SETTINGS: StorageSettings = {
  mode: 'PERSISTENT',
  retention: { days: 180, label: '6 months' },
  showWarnings: true,
  autoCleanupThreshold: 85,
};

const RETENTION_OPTIONS: RetentionSettings[] = [
  { days: 30, label: '30 days' },
  { days: 90, label: '3 months' },
  { days: 180, label: '6 months' },
  { days: 365, label: '1 year' },
  { days: 0, label: 'Forever' },
];

// ============================================================================
// Storage Controller Class
// ============================================================================

export class StorageController {
  private settings: StorageSettings;

  constructor() {
    this.settings = this.loadSettings();
  }

  // ============================================================================
  // Settings Management
  // ============================================================================

  getSettings(): StorageSettings {
    return { ...this.settings };
  }

  updateSettings(newSettings: Partial<StorageSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    this.saveSettings();
  }

  getRetentionOptions(): RetentionSettings[] {
    return [...RETENTION_OPTIONS];
  }

  private loadSettings(): StorageSettings {
    if (typeof window === 'undefined') return DEFAULT_SETTINGS;

    try {
      const stored = localStorage.getItem(STORAGE_SETTINGS_KEY);
      if (!stored) return DEFAULT_SETTINGS;

      const parsed = JSON.parse(stored);
      return { ...DEFAULT_SETTINGS, ...parsed };
    } catch (error) {
      console.warn('[StorageController] Failed to load settings:', error);
      return DEFAULT_SETTINGS;
    }
  }

  private saveSettings(): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(this.settings));
    } catch (error) {
      console.error('[StorageController] Failed to save settings:', error);
    }
  }

  // ============================================================================
  // Storage Information
  // ============================================================================

  async getStorageInfo(): Promise<StorageInfo> {
    if (typeof navigator === 'undefined' || !navigator.storage?.estimate) {
      // Fallback for unsupported environments
      return {
        quota: 0,
        usage: 0,
        usagePercent: 0,
        breakdown: { billingData: 0, indexes: 0, cache: 0, other: 0 },
        breakdownPercent: { billingData: 0, indexes: 0, cache: 0, other: 0 },
      };
    }

    try {
      const estimate = await navigator.storage.estimate();
      const quota = estimate.quota || 0;
      const usage = estimate.usage || 0;
      const usagePercent = quota > 0 ? (usage / quota) * 100 : 0;

      // Estimate breakdown based on typical usage patterns
      const breakdown = await this.estimateStorageBreakdown(usage);
      const total = Object.values(breakdown).reduce((sum, val) => sum + val, 0);
      
      const breakdownPercent = {
        billingData: total > 0 ? (breakdown.billingData / total) * 100 : 0,
        indexes: total > 0 ? (breakdown.indexes / total) * 100 : 0,
        cache: total > 0 ? (breakdown.cache / total) * 100 : 0,
        other: total > 0 ? (breakdown.other / total) * 100 : 0,
      };

      return {
        quota,
        usage,
        usagePercent,
        breakdown,
        breakdownPercent,
      };
    } catch (error) {
      console.error('[StorageController] Failed to get storage info:', error);
      return {
        quota: 0,
        usage: 0,
        usagePercent: 0,
        breakdown: { billingData: 0, indexes: 0, cache: 0, other: 0 },
        breakdownPercent: { billingData: 0, indexes: 0, cache: 0, other: 0 },
      };
    }
  }

  private async estimateStorageBreakdown(totalUsage: number): Promise<StorageInfo['breakdown']> {
    try {
      // Try to get more accurate breakdown from OPFS if available
      if ('storage' in navigator && 'getDirectory' in navigator.storage) {
        const opfsRoot = await navigator.storage.getDirectory();
        
        let billingDataSize = 0;
        let indexesSize = 0;
        let cacheSize = 0;

        try {
          // Estimate billing data (parquet files)
          const dataDir = await opfsRoot.getDirectoryHandle('billing-data', { create: false });
          billingDataSize = await this.estimateDirectorySize(dataDir);
        } catch {
          // Directory doesn't exist
        }

        try {
          // Estimate indexes
          const indexDir = await opfsRoot.getDirectoryHandle('indexes', { create: false });
          indexesSize = await this.estimateDirectorySize(indexDir);
        } catch {
          // Directory doesn't exist
        }

        try {
          // Estimate cache
          const cacheDir = await opfsRoot.getDirectoryHandle('cache', { create: false });
          cacheSize = await this.estimateDirectorySize(cacheDir);
        } catch {
          // Directory doesn't exist
        }

        const accountedFor = billingDataSize + indexesSize + cacheSize;
        const other = Math.max(0, totalUsage - accountedFor);

        return {
          billingData: billingDataSize,
          indexes: indexesSize,
          cache: cacheSize,
          other,
        };
      }
    } catch (error) {
      console.warn('[StorageController] Could not get detailed breakdown:', error);
    }

    // Fallback to estimation based on typical patterns
    return {
      billingData: totalUsage * 0.8, // 80% usually billing data
      indexes: totalUsage * 0.1,     // 10% indexes
      cache: totalUsage * 0.07,      // 7% cache
      other: totalUsage * 0.03,      // 3% other
    };
  }

  private async estimateDirectorySize(dirHandle: FileSystemDirectoryHandle): Promise<number> {
    let totalSize = 0;
    
    try {
      // @ts-ignore - OPFS API is newer than TypeScript definitions
      for await (const [name, handle] of dirHandle.entries()) {
        if (handle.kind === 'file') {
          const file = await (handle as FileSystemFileHandle).getFile();
          totalSize += file.size;
        } else if (handle.kind === 'directory') {
          totalSize += await this.estimateDirectorySize(handle as FileSystemDirectoryHandle);
        }
      }
    } catch (error) {
      console.warn('[StorageController] Error estimating directory size:', error);
    }

    return totalSize;
  }

  // ============================================================================
  // Purge Functions
  // ============================================================================

  async purgeAllData(): Promise<void> {
    try {
      // 1. Close any active DuckDB connections
      await this.closeDuckDBConnections();

      // 2. Clear OPFS root directory
      await this.clearOPFS();

      // 3. Clear IndexedDB metadata
      await this.clearIndexedDB();

      // 4. Clear localStorage settings (optional)
      this.clearLocalStorageData();

      console.log('[StorageController] All data purged successfully');
    } catch (error) {
      console.error('[StorageController] Error during data purge:', error);
      throw new Error(`Failed to purge data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async closeDuckDBConnections(): Promise<void> {
    try {
      // Signal to close connections via custom event
      window.dispatchEvent(new CustomEvent('focal:close-duckdb-connections'));
      
      // Give connections time to close gracefully
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.warn('[StorageController] Could not close DuckDB connections:', error);
    }
  }

  private async clearOPFS(): Promise<void> {
    if (!('storage' in navigator) || !('getDirectory' in navigator.storage)) {
      console.warn('[StorageController] OPFS not supported');
      return;
    }

    try {
      const opfsRoot = await navigator.storage.getDirectory();
      
      // Remove all entries in the root directory
      // @ts-ignore - OPFS API is newer than TypeScript definitions
      for await (const [name, handle] of opfsRoot.entries()) {
        try {
          if (handle.kind === 'directory') {
            await opfsRoot.removeEntry(name, { recursive: true });
          } else {
            await opfsRoot.removeEntry(name);
          }
        } catch (error) {
          console.warn(`[StorageController] Could not remove OPFS entry ${name}:`, error);
        }
      }
    } catch (error) {
      console.error('[StorageController] Error clearing OPFS:', error);
    }
  }

  private async clearIndexedDB(): Promise<void> {
    try {
      // Clear the main IndexedDB database
      await this.deleteIndexedDBDatabase(INDEXEDDB_NAME);
      
      // Clear DuckDB's internal IndexedDB usage
      await this.deleteIndexedDBDatabase('duckdb');
      
      // Clear any other Focal-related IndexedDB stores
      const databases = await indexedDB.databases();
      for (const db of databases) {
        if (db.name?.startsWith('focal-') || db.name?.includes('duckdb')) {
          if (db.name) {
            await this.deleteIndexedDBDatabase(db.name);
          }
        }
      }
    } catch (error) {
      console.error('[StorageController] Error clearing IndexedDB:', error);
    }
  }

  private deleteIndexedDBDatabase(name: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const deleteRequest = indexedDB.deleteDatabase(name);
      
      deleteRequest.onsuccess = () => resolve();
      deleteRequest.onerror = () => reject(deleteRequest.error);
      deleteRequest.onblocked = () => {
        console.warn(`[StorageController] Delete blocked for database: ${name}`);
        // Resolve anyway after timeout
        setTimeout(resolve, 2000);
      };
    });
  }

  private clearLocalStorageData(): void {
    try {
      const keys = Object.keys(localStorage);
      for (const key of keys) {
        if (key.startsWith('focal_') || key.includes('duckdb')) {
          localStorage.removeItem(key);
        }
      }
    } catch (error) {
      console.error('[StorageController] Error clearing localStorage:', error);
    }
  }

  // ============================================================================
  // Retention & Cleanup
  // ============================================================================

  async runRetentionCleanup(): Promise<{ deletedFiles: number; freedBytes: number }> {
    if (this.settings.retention.days === 0) {
      // Forever retention, no cleanup needed
      return { deletedFiles: 0, freedBytes: 0 };
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.settings.retention.days);

    try {
      return await this.cleanupOldFiles(cutoffDate);
    } catch (error) {
      console.error('[StorageController] Error during retention cleanup:', error);
      return { deletedFiles: 0, freedBytes: 0 };
    }
  }

  private async cleanupOldFiles(cutoffDate: Date): Promise<{ deletedFiles: number; freedBytes: number }> {
    if (!('storage' in navigator) || !('getDirectory' in navigator.storage)) {
      return { deletedFiles: 0, freedBytes: 0 };
    }

    let deletedFiles = 0;
    let freedBytes = 0;

    try {
      const opfsRoot = await navigator.storage.getDirectory();
      
      // @ts-ignore - OPFS API is newer than TypeScript definitions
      for await (const [name, handle] of opfsRoot.entries()) {
        if (handle.kind === 'file') {
          const file = await (handle as FileSystemFileHandle).getFile();
          
          if (file.lastModified < cutoffDate.getTime()) {
            freedBytes += file.size;
            await opfsRoot.removeEntry(name);
            deletedFiles++;
          }
        } else if (handle.kind === 'directory') {
          const result = await this.cleanupDirectoryFiles(
            handle as FileSystemDirectoryHandle,
            cutoffDate
          );
          deletedFiles += result.deletedFiles;
          freedBytes += result.freedBytes;
        }
      }
    } catch (error) {
      console.error('[StorageController] Error during file cleanup:', error);
    }

    return { deletedFiles, freedBytes };
  }

  private async cleanupDirectoryFiles(
    dirHandle: FileSystemDirectoryHandle,
    cutoffDate: Date
  ): Promise<{ deletedFiles: number; freedBytes: number }> {
    let deletedFiles = 0;
    let freedBytes = 0;

    try {
      // @ts-ignore - OPFS API is newer than TypeScript definitions
      for await (const [name, handle] of dirHandle.entries()) {
        if (handle.kind === 'file') {
          const file = await (handle as FileSystemFileHandle).getFile();
          
          if (file.lastModified < cutoffDate.getTime()) {
            freedBytes += file.size;
            await dirHandle.removeEntry(name);
            deletedFiles++;
          }
        } else if (handle.kind === 'directory') {
          const result = await this.cleanupDirectoryFiles(
            handle as FileSystemDirectoryHandle,
            cutoffDate
          );
          deletedFiles += result.deletedFiles;
          freedBytes += result.freedBytes;
        }
      }
    } catch (error) {
      console.warn('[StorageController] Error cleaning directory:', error);
    }

    return { deletedFiles, freedBytes };
  }

  // ============================================================================
  // Storage Mode Management
  // ============================================================================

  shouldPersistData(): boolean {
    return this.settings.mode === 'PERSISTENT';
  }

  shouldAutoCleanup(usagePercent: number): boolean {
    return usagePercent >= this.settings.autoCleanupThreshold;
  }

  // ============================================================================
  // Utility Functions
  // ============================================================================

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async shouldShowStorageWarning(): Promise<boolean> {
    if (!this.settings.showWarnings) return false;
    
    const info = await this.getStorageInfo();
    return info.usagePercent >= this.settings.autoCleanupThreshold;
  }

  // Force reload the page (used after purge)
  reloadApplication(): void {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let storageController: StorageController | null = null;

export function getStorageController(): StorageController {
  if (!storageController) {
    storageController = new StorageController();
  }
  return storageController;
}