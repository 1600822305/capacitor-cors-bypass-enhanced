/**
 * Cache Manager Implementation
 * 缓存管理器实现
 */

import type {
  CacheEntry,
  CacheStats,
  CacheOptions,
  CacheEvictionPolicy,
  CacheEvictionOptions,
} from '../types/cache';
import type { CacheManager } from '../types/cache';

// Re-export CacheManager for external use
export type { CacheManager } from '../types/cache';

/**
 * Memory Cache Manager
 * 内存缓存管理器
 */
export class MemoryCacheManager implements CacheManager {
  private cache: Map<string, CacheEntry> = new Map();
  private accessCount: Map<string, number> = new Map();
  private accessTime: Map<string, number> = new Map();
  private stats = {
    hits: 0,
    misses: 0,
  };
  private maxSize: number;
  private evictionPolicy: CacheEvictionPolicy;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(
    maxSize: number = 50 * 1024 * 1024, // 50MB
    evictionOptions?: CacheEvictionOptions
  ) {
    this.maxSize = maxSize;
    this.evictionPolicy = evictionOptions?.policy || 'lru';

    // 启动自动清理
    if (evictionOptions?.interval) {
      this.startAutoCleanup(evictionOptions.interval);
    }
  }

  async get(key: string): Promise<CacheEntry | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // 检查是否过期
    if (Date.now() > entry.expiresAt) {
      await this.delete(key);
      this.stats.misses++;
      return null;
    }

    // 更新访问统计
    this.accessCount.set(key, (this.accessCount.get(key) || 0) + 1);
    this.accessTime.set(key, Date.now());
    this.stats.hits++;

    return entry;
  }

  async set(key: string, entry: CacheEntry): Promise<void> {
    // 检查是否需要清理空间
    const currentSize = await this.getSize();
    if (currentSize + entry.size > this.maxSize) {
      await this.evict(entry.size);
    }

    this.cache.set(key, entry);
    this.accessCount.set(key, 1);
    this.accessTime.set(key, Date.now());
  }

  async delete(key: string): Promise<boolean> {
    this.accessCount.delete(key);
    this.accessTime.delete(key);
    return this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.accessCount.clear();
    this.accessTime.clear();
    this.stats.hits = 0;
    this.stats.misses = 0;
  }

  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) return false;

    // 检查是否过期
    if (Date.now() > entry.expiresAt) {
      await this.delete(key);
      return false;
    }

    return true;
  }

  async keys(): Promise<string[]> {
    return Array.from(this.cache.keys());
  }

  async getStats(): Promise<CacheStats> {
    const entries = Array.from(this.cache.values());
    const totalSize = entries.reduce((sum, entry) => sum + entry.size, 0);
    const timestamps = entries.map(e => e.timestamp);

    return {
      totalEntries: this.cache.size,
      totalSize,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0,
      oldestEntry: timestamps.length > 0 ? Math.min(...timestamps) : undefined,
      newestEntry: timestamps.length > 0 ? Math.max(...timestamps) : undefined,
    };
  }

  async cleanup(): Promise<number> {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        await this.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }

  async getSize(): Promise<number> {
    let totalSize = 0;
    for (const entry of this.cache.values()) {
      totalSize += entry.size;
    }
    return totalSize;
  }

  /**
   * 清理缓存以腾出空间
   */
  private async evict(requiredSpace: number): Promise<void> {
    const currentSize = await this.getSize();
    const targetSize = this.maxSize * 0.7; // 清理到70%
    let freedSpace = 0;

    const entries = Array.from(this.cache.entries());
    const sortedEntries = this.sortEntriesForEviction(entries);

    for (const [key] of sortedEntries) {
      if (currentSize - freedSpace <= targetSize && freedSpace >= requiredSpace) {
        break;
      }

      const entry = this.cache.get(key);
      if (entry) {
        freedSpace += entry.size;
        await this.delete(key);
      }
    }
  }

  /**
   * 根据清理策略排序条目
   */
  private sortEntriesForEviction(
    entries: Array<[string, CacheEntry]>
  ): Array<[string, CacheEntry]> {
    switch (this.evictionPolicy) {
      case 'lru': // 最近最少使用
        return entries.sort((a, b) => {
          const timeA = this.accessTime.get(a[0]) || 0;
          const timeB = this.accessTime.get(b[0]) || 0;
          return timeA - timeB;
        });

      case 'lfu': // 最不经常使用
        return entries.sort((a, b) => {
          const countA = this.accessCount.get(a[0]) || 0;
          const countB = this.accessCount.get(b[0]) || 0;
          return countA - countB;
        });

      case 'fifo': // 先进先出
        return entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

      case 'ttl': // 基于过期时间
        return entries.sort((a, b) => a[1].expiresAt - b[1].expiresAt);

      default:
        return entries;
    }
  }

  /**
   * 启动自动清理
   */
  private startAutoCleanup(interval: number): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup().catch(console.error);
    }, interval);
  }

  /**
   * 停止自动清理
   */
  stopAutoCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }

  /**
   * 销毁缓存管理器
   */
  destroy(): void {
    this.stopAutoCleanup();
    this.clear();
  }
}

/**
 * LocalStorage Cache Manager
 * LocalStorage 缓存管理器
 */
export class LocalStorageCacheManager implements CacheManager {
  private prefix: string;
  private stats = {
    hits: 0,
    misses: 0,
  };

  constructor(prefix: string = 'cache_') {
    this.prefix = prefix;
  }

  async get(key: string): Promise<CacheEntry | null> {
    try {
      const data = localStorage.getItem(this.prefix + key);
      if (!data) {
        this.stats.misses++;
        return null;
      }

      const entry: CacheEntry = JSON.parse(data);

      // 检查是否过期
      if (Date.now() > entry.expiresAt) {
        await this.delete(key);
        this.stats.misses++;
        return null;
      }

      this.stats.hits++;
      return entry;
    } catch (error) {
      console.error('[Cache] Error reading from localStorage:', error);
      this.stats.misses++;
      return null;
    }
  }

  async set(key: string, entry: CacheEntry): Promise<void> {
    try {
      localStorage.setItem(this.prefix + key, JSON.stringify(entry));
    } catch (error) {
      console.error('[Cache] Error writing to localStorage:', error);
      // 如果存储失败（可能是空间不足），尝试清理
      await this.cleanup();
      try {
        localStorage.setItem(this.prefix + key, JSON.stringify(entry));
      } catch (retryError) {
        console.error('[Cache] Failed to write after cleanup:', retryError);
      }
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      localStorage.removeItem(this.prefix + key);
      return true;
    } catch (error) {
      console.error('[Cache] Error deleting from localStorage:', error);
      return false;
    }
  }

  async clear(): Promise<void> {
    const keys = await this.keys();
    for (const key of keys) {
      await this.delete(key);
    }
    this.stats.hits = 0;
    this.stats.misses = 0;
  }

  async has(key: string): Promise<boolean> {
    const entry = await this.get(key);
    return entry !== null;
  }

  async keys(): Promise<string[]> {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.prefix)) {
        keys.push(key.substring(this.prefix.length));
      }
    }
    return keys;
  }

  async getStats(): Promise<CacheStats> {
    const keys = await this.keys();
    let totalSize = 0;
    const timestamps: number[] = [];

    for (const key of keys) {
      const entry = await this.get(key);
      if (entry) {
        totalSize += entry.size;
        timestamps.push(entry.timestamp);
      }
    }

    return {
      totalEntries: keys.length,
      totalSize,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0,
      oldestEntry: timestamps.length > 0 ? Math.min(...timestamps) : undefined,
      newestEntry: timestamps.length > 0 ? Math.max(...timestamps) : undefined,
    };
  }

  async cleanup(): Promise<number> {
    const keys = await this.keys();
    const now = Date.now();
    let cleaned = 0;

    for (const key of keys) {
      const entry = await this.get(key);
      if (entry && now > entry.expiresAt) {
        await this.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }

  async getSize(): Promise<number> {
    const keys = await this.keys();
    let totalSize = 0;

    for (const key of keys) {
      const entry = await this.get(key);
      if (entry) {
        totalSize += entry.size;
      }
    }

    return totalSize;
  }
}

/**
 * IndexedDB Cache Manager
 * IndexedDB 缓存管理器（用于大数据量）
 */
export class IndexedDBCacheManager implements CacheManager {
  private dbName: string;
  private storeName: string;
  private db: IDBDatabase | null = null;
  private stats = {
    hits: 0,
    misses: 0,
  };

  constructor(dbName: string = 'CacheDB', storeName: string = 'cache') {
    this.dbName = dbName;
    this.storeName = storeName;
  }

  private async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'key' });
          store.createIndex('expiresAt', 'expiresAt', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  async get(key: string): Promise<CacheEntry | null> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(key);

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          const entry = request.result as CacheEntry | undefined;

          if (!entry) {
            this.stats.misses++;
            resolve(null);
            return;
          }

          // 检查是否过期
          if (Date.now() > entry.expiresAt) {
            this.delete(key);
            this.stats.misses++;
            resolve(null);
            return;
          }

          this.stats.hits++;
          resolve(entry);
        };

        request.onerror = () => {
          this.stats.misses++;
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('[Cache] Error reading from IndexedDB:', error);
      this.stats.misses++;
      return null;
    }
  }

  async set(key: string, entry: CacheEntry): Promise<void> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(entry);

      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('[Cache] Error writing to IndexedDB:', error);
      throw error;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(key);

      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('[Cache] Error deleting from IndexedDB:', error);
      return false;
    }
  }

  async clear(): Promise<void> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          this.stats.hits = 0;
          this.stats.misses = 0;
          resolve();
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('[Cache] Error clearing IndexedDB:', error);
      throw error;
    }
  }

  async has(key: string): Promise<boolean> {
    const entry = await this.get(key);
    return entry !== null;
  }

  async keys(): Promise<string[]> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAllKeys();

      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result as string[]);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('[Cache] Error getting keys from IndexedDB:', error);
      return [];
    }
  }

  async getStats(): Promise<CacheStats> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          const entries = request.result as CacheEntry[];
          const totalSize = entries.reduce((sum, entry) => sum + entry.size, 0);
          const timestamps = entries.map(e => e.timestamp);

          resolve({
            totalEntries: entries.length,
            totalSize,
            hits: this.stats.hits,
            misses: this.stats.misses,
            hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0,
            oldestEntry: timestamps.length > 0 ? Math.min(...timestamps) : undefined,
            newestEntry: timestamps.length > 0 ? Math.max(...timestamps) : undefined,
          });
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('[Cache] Error getting stats from IndexedDB:', error);
      return {
        totalEntries: 0,
        totalSize: 0,
        hits: this.stats.hits,
        misses: this.stats.misses,
        hitRate: 0,
      };
    }
  }

  async cleanup(): Promise<number> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('expiresAt');
      const now = Date.now();
      const range = IDBKeyRange.upperBound(now);
      const request = index.openCursor(range);

      let cleaned = 0;

      return new Promise((resolve, reject) => {
        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result as IDBCursorWithValue;
          if (cursor) {
            cursor.delete();
            cleaned++;
            cursor.continue();
          } else {
            resolve(cleaned);
          }
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('[Cache] Error cleaning up IndexedDB:', error);
      return 0;
    }
  }

  async getSize(): Promise<number> {
    const stats = await this.getStats();
    return stats.totalSize;
  }

  /**
   * 关闭数据库连接
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

/**
 * 创建缓存管理器工厂函数
 */
export function createCacheManager(options?: CacheOptions): CacheManager {
  const storage = options?.storage || 'memory';
  const maxSize = options?.maxSize || 50 * 1024 * 1024;

  switch (storage) {
    case 'localStorage':
      return new LocalStorageCacheManager();
    case 'indexedDB':
      return new IndexedDBCacheManager();
    case 'memory':
    default:
      return new MemoryCacheManager(maxSize);
  }
}