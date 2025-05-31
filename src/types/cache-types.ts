/**
 * Cache configuration and types for the GCS output handler
 */

/**
 * Cache configuration options
 */
export interface CacheConfig {
  /**
   * Whether caching is enabled
   */
  enabled: boolean;

  /**
   * Maximum size of a single file to cache (in bytes)
   * Default: 50MB
   */
  maxFileSize: number;

  /**
   * Total maximum size of the cache (in bytes)
   * Default: 500MB
   */
  totalSize: number;

  /**
   * Time to live for cached items (in seconds)
   * Default: 4 hours
   */
  ttl: number;

  /**
   * Interval for cache cleanup (in seconds)
   * Default: 1 hour
   */
  cleanupInterval: number;
}

/**
 * Cache entry metadata
 */
export interface CacheEntry<T = unknown> {
  /**
   * The cached data
   */
  data: T;

  /**
   * Size of the cached data in bytes
   */
  size: number;

  /**
   * Timestamp when the entry was cached
   */
  timestamp: number;

  /**
   * Original source of the cached data (e.g., GCS URI)
   */
  source: string;
}

/**
 * Cache statistics for monitoring
 */
export interface CacheStats {
  /**
   * Number of items currently in cache
   */
  size: number;

  /**
   * Total size of cached items in bytes
   */
  totalSize: number;

  /**
   * Number of cache hits
   */
  hits: number;

  /**
   * Number of cache misses
   */
  misses: number;

  /**
   * Number of items evicted due to size/TTL
   */
  evictions: number;
}

/**
 * Default cache configuration
 */
export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  enabled: true,
  maxFileSize: 52428800, // 50MB
  totalSize: 524288000, // 500MB
  ttl: 14400, // 4 hours
  cleanupInterval: 3600, // 1 hour
};
