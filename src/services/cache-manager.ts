/**
 * Cache Manager service for handling cached GCS file contents
 */

import { CacheConfig, CacheEntry, CacheStats, DEFAULT_CACHE_CONFIG } from '../types/cache-types.js';

export class CacheManager {
  private cache: Map<string, CacheEntry>;
  private config: CacheConfig;
  private stats: CacheStats;
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor(config: Partial<CacheConfig> = {}) {
    this.cache = new Map();
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config };
    this.stats = {
      size: 0,
      totalSize: 0,
      hits: 0,
      misses: 0,
      evictions: 0,
    };

    // Start cleanup interval
    this.cleanupInterval = setInterval(() => this.cleanup(), this.config.cleanupInterval * 1000);
  }

  /**
   * Get an item from cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if entry has expired
    if (Date.now() - entry.timestamp > this.config.ttl * 1000) {
      this.evict(key);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return entry.data as T;
  }

  /**
   * Store an item in cache
   */
  set<T>(key: string, value: T, size: number): boolean {
    // Don't cache if disabled or too large
    if (!this.config.enabled || size > this.config.maxFileSize) {
      return false;
    }

    // Check if we need to make space
    if (this.stats.totalSize + size > this.config.totalSize) {
      this.makeSpace(size);
    }

    // Check if we could make enough space
    if (this.stats.totalSize + size > this.config.totalSize) {
      return false;
    }

    const entry: CacheEntry<T> = {
      data: value,
      size,
      timestamp: Date.now(),
      source: key,
    };

    const oldEntry = this.cache.get(key);
    if (oldEntry) {
      this.stats.totalSize -= oldEntry.size;
    }

    this.cache.set(key, entry);
    this.stats.totalSize += size;
    this.stats.size = this.cache.size;

    return true;
  }

  /**
   * Check if an item would be eligible for caching
   */
  isEligibleForCache(size: number): boolean {
    return this.config.enabled && size <= this.config.maxFileSize;
  }

  /**
   * Get current cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Remove an item from cache
   */
  private evict(key: string): void {
    const entry = this.cache.get(key);
    if (entry) {
      this.cache.delete(key);
      this.stats.totalSize -= entry.size;
      this.stats.size = this.cache.size;
      this.stats.evictions++;
    }
  }

  /**
   * Make space in cache for new item
   */
  private makeSpace(needed: number): void {
    // Sort entries by last access time
    const entries = Array.from(this.cache.entries()).sort(
      ([, a], [, b]) => a.timestamp - b.timestamp
    );

    for (const [key] of entries) {
      this.evict(key);
      if (this.stats.totalSize + needed <= this.config.totalSize) {
        break;
      }
    }
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const expired = Array.from(this.cache.keys()).filter((key) => {
      const entry = this.cache.get(key);
      return entry && now - entry.timestamp > this.config.ttl * 1000;
    });

    expired.forEach((key) => this.evict(key));
  }

  /**
   * Stop cleanup interval
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
  }
}
