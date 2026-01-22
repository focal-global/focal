/**
 * In-Memory Cache Provider for Pipeline Data
 * 
 * Provides caching capabilities for pipeline execution results.
 * Uses Map for in-memory storage with optional TTL support.
 */

import type { CacheProvider } from './types';

interface CacheEntry<T> {
  value: T;
  expiresAt?: number;
}

export class InMemoryCacheProvider implements CacheProvider {
  private cache = new Map<string, CacheEntry<any>>();
  private cleanupInterval?: NodeJS.Timeout;

  constructor(
    private defaultTTL: number = 5 * 60 * 1000, // 5 minutes
    private maxSize: number = 1000
  ) {
    // Start cleanup interval
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000); // Every minute
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if expired
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const effectiveTTL = ttl ?? this.defaultTTL;
    const expiresAt = effectiveTTL > 0 ? Date.now() + effectiveTTL : undefined;

    // If at max size, remove oldest entry
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, { value, expiresAt });
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const now = Date.now();
    let expired = 0;
    let active = 0;

    for (const entry of this.cache.values()) {
      if (entry.expiresAt && now > entry.expiresAt) {
        expired++;
      } else {
        active++;
      }
    }

    return {
      totalEntries: this.cache.size,
      activeEntries: active,
      expiredEntries: expired,
      maxSize: this.maxSize
    };
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt && now > entry.expiresAt) {
        toDelete.push(key);
      }
    }

    for (const key of toDelete) {
      this.cache.delete(key);
    }

    if (toDelete.length > 0) {
      console.log(`[Cache] Cleaned up ${toDelete.length} expired entries`);
    }
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cache.clear();
  }
}

// ============================================================================
// IndexedDB Cache Provider - Persistent Local Storage
// ============================================================================

const DB_NAME = 'focal_cache';
const DB_VERSION = 1;
const STORE_NAME = 'cache_entries';

interface IndexedDBEntry<T> {
  key: string;
  value: T;
  expiresAt?: number;
  createdAt: number;
  type: string; // For categorizing cached data
}

/**
 * IndexedDB-based cache provider for persistent storage
 * 
 * Stores aggregated data locally in the browser that survives page refreshes.
 * This is safe for Local-First architecture as data never leaves the browser.
 * 
 * Use cases:
 * - Dashboard aggregations (daily/monthly totals)
 * - Anomaly detection results
 * - Service breakdowns
 * - Cost trends
 */
export class IndexedDBCacheProvider implements CacheProvider {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  constructor(private defaultTTL: number = 24 * 60 * 60 * 1000) { // 24 hours default
    this.initPromise = this.init();
  }

  private async init(): Promise<void> {
    if (typeof window === 'undefined' || !window.indexedDB) {
      console.warn('[IndexedDBCache] IndexedDB not available');
      return;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('[IndexedDBCache] Failed to open database:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('[IndexedDBCache] Database opened successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create object store with indexes
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
          store.createIndex('type', 'type', { unique: false });
          store.createIndex('expiresAt', 'expiresAt', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
          console.log('[IndexedDBCache] Object store created');
        }
      };
    });
  }

  private async ensureDB(): Promise<IDBDatabase | null> {
    if (this.initPromise) {
      await this.initPromise;
    }
    return this.db;
  }

  async get<T>(key: string): Promise<T | null> {
    const db = await this.ensureDB();
    if (!db) return null;

    return new Promise((resolve) => {
      try {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(key);

        request.onsuccess = () => {
          const entry = request.result as IndexedDBEntry<T> | undefined;
          
          if (!entry) {
            resolve(null);
            return;
          }

          // Check if expired
          if (entry.expiresAt && Date.now() > entry.expiresAt) {
            // Clean up expired entry asynchronously
            this.delete(key).catch(console.error);
            resolve(null);
            return;
          }

          resolve(entry.value);
        };

        request.onerror = () => {
          console.error('[IndexedDBCache] Get error:', request.error);
          resolve(null);
        };
      } catch (error) {
        console.error('[IndexedDBCache] Get exception:', error);
        resolve(null);
      }
    });
  }

  async set<T>(key: string, value: T, ttl?: number, type: string = 'general'): Promise<void> {
    const db = await this.ensureDB();
    if (!db) return;

    const effectiveTTL = ttl ?? this.defaultTTL;
    const entry: IndexedDBEntry<T> = {
      key,
      value,
      expiresAt: effectiveTTL > 0 ? Date.now() + effectiveTTL : undefined,
      createdAt: Date.now(),
      type,
    };

    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(entry);

        request.onsuccess = () => {
          resolve();
        };

        request.onerror = () => {
          console.error('[IndexedDBCache] Set error:', request.error);
          reject(request.error);
        };
      } catch (error) {
        console.error('[IndexedDBCache] Set exception:', error);
        reject(error);
      }
    });
  }

  async delete(key: string): Promise<void> {
    const db = await this.ensureDB();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(key);

        request.onsuccess = () => resolve();
        request.onerror = () => {
          console.error('[IndexedDBCache] Delete error:', request.error);
          resolve();
        };
      } catch (error) {
        console.error('[IndexedDBCache] Delete exception:', error);
        resolve();
      }
    });
  }

  async clear(): Promise<void> {
    const db = await this.ensureDB();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();

        request.onsuccess = () => {
          console.log('[IndexedDBCache] Cache cleared');
          resolve();
        };
        request.onerror = () => {
          console.error('[IndexedDBCache] Clear error:', request.error);
          resolve();
        };
      } catch (error) {
        console.error('[IndexedDBCache] Clear exception:', error);
        resolve();
      }
    });
  }

  /**
   * Clear all entries of a specific type
   */
  async clearByType(type: string): Promise<void> {
    const db = await this.ensureDB();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('type');
        const request = index.openCursor(IDBKeyRange.only(type));
        let deleted = 0;

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor) {
            cursor.delete();
            deleted++;
            cursor.continue();
          } else {
            console.log(`[IndexedDBCache] Cleared ${deleted} entries of type "${type}"`);
            resolve();
          }
        };

        request.onerror = () => {
          console.error('[IndexedDBCache] ClearByType error:', request.error);
          resolve();
        };
      } catch (error) {
        console.error('[IndexedDBCache] ClearByType exception:', error);
        resolve();
      }
    });
  }

  /**
   * Cleanup expired entries
   */
  async cleanup(): Promise<number> {
    const db = await this.ensureDB();
    if (!db) return 0;

    return new Promise((resolve) => {
      try {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('expiresAt');
        const now = Date.now();
        let deleted = 0;

        // Get all entries that have expired
        const request = index.openCursor(IDBKeyRange.upperBound(now));

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor) {
            const entry = cursor.value as IndexedDBEntry<unknown>;
            if (entry.expiresAt && entry.expiresAt <= now) {
              cursor.delete();
              deleted++;
            }
            cursor.continue();
          } else {
            if (deleted > 0) {
              console.log(`[IndexedDBCache] Cleaned up ${deleted} expired entries`);
            }
            resolve(deleted);
          }
        };

        request.onerror = () => {
          console.error('[IndexedDBCache] Cleanup error:', request.error);
          resolve(0);
        };
      } catch (error) {
        console.error('[IndexedDBCache] Cleanup exception:', error);
        resolve(0);
      }
    });
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    totalEntries: number;
    totalSize: number;
    entriesByType: Record<string, number>;
    oldestEntry: Date | null;
    newestEntry: Date | null;
  }> {
    const db = await this.ensureDB();
    if (!db) {
      return { totalEntries: 0, totalSize: 0, entriesByType: {}, oldestEntry: null, newestEntry: null };
    }

    return new Promise((resolve) => {
      try {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
          const entries = request.result as IndexedDBEntry<unknown>[];
          const entriesByType: Record<string, number> = {};
          let oldest: number | null = null;
          let newest: number | null = null;
          let totalSize = 0;

          for (const entry of entries) {
            entriesByType[entry.type] = (entriesByType[entry.type] || 0) + 1;
            
            if (oldest === null || entry.createdAt < oldest) oldest = entry.createdAt;
            if (newest === null || entry.createdAt > newest) newest = entry.createdAt;
            
            // Rough size estimate
            totalSize += JSON.stringify(entry.value).length;
          }

          resolve({
            totalEntries: entries.length,
            totalSize,
            entriesByType,
            oldestEntry: oldest ? new Date(oldest) : null,
            newestEntry: newest ? new Date(newest) : null,
          });
        };

        request.onerror = () => {
          console.error('[IndexedDBCache] GetStats error:', request.error);
          resolve({ totalEntries: 0, totalSize: 0, entriesByType: {}, oldestEntry: null, newestEntry: null });
        };
      } catch (error) {
        console.error('[IndexedDBCache] GetStats exception:', error);
        resolve({ totalEntries: 0, totalSize: 0, entriesByType: {}, oldestEntry: null, newestEntry: null });
      }
    });
  }
}