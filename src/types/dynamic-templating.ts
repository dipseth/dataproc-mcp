/**
 * Type definitions for Dynamic Templating System
 * Supports job output references and Qdrant knowledge queries
 */

import { JobTracker } from '../services/job-tracker.js';
import { KnowledgeIndexer } from '../services/knowledge-indexer.js';
import { AsyncQueryPoller } from '../services/async-query-poller.js';
import { TemplateResolutionContext } from './templating.js';

/**
 * Supported dynamic function types
 */
export type DynamicFunctionType = 'job_output' | 'qdrant_query';

/**
 * Parsed function call from template string
 */
export interface FunctionCall {
  /** Function name */
  name: DynamicFunctionType;

  /** Function arguments */
  args: string[];

  /** Original function string for debugging */
  original: string;

  /** Position in the template string */
  position: {
    start: number;
    end: number;
  };
}

/**
 * Context for dynamic function resolution
 */
export interface DynamicResolutionContext {
  /** Job tracking service */
  jobTracker: JobTracker;

  /** Knowledge indexer for Qdrant queries */
  knowledgeIndexer: KnowledgeIndexer;

  /** Async query poller for job status */
  asyncQueryPoller: AsyncQueryPoller;

  /** Template resolution context */
  templateContext: TemplateResolutionContext;
}

/**
 * Cache entry for resolved dynamic values
 */
export interface DynamicCacheEntry {
  /** Resolved value */
  value: unknown;

  /** Cache timestamp */
  timestamp: Date;

  /** Time-to-live in milliseconds */
  ttl: number;

  /** Original function call */
  functionCall: FunctionCall;

  /** Resolution metadata */
  metadata: {
    resolutionTimeMs: number;
    source: 'cache' | 'fresh';
    confidence?: number; // For Qdrant queries
  };
}

/**
 * Dynamic function execution result
 */
export interface FunctionExecutionResult {
  /** Resolved value */
  value: unknown;

  /** Execution success status */
  success: boolean;

  /** Error message if execution failed */
  error?: string;

  /** Execution time in milliseconds */
  executionTimeMs: number;

  /** Whether result was cached */
  cached: boolean;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Job output function specific types
 */
export interface JobOutputOptions {
  /** Job ID to query */
  jobId: string;

  /** Field path using dot notation (e.g., 'results.rows[0].column_name') */
  fieldPath: string;

  /** Timeout for waiting for job completion (ms) */
  timeoutMs?: number;

  /** Whether to wait for job completion if still running */
  waitForCompletion?: boolean;
}

/**
 * Qdrant query function specific types
 */
export interface QdrantQueryOptions {
  /** Semantic query string */
  query: string;

  /** Field to extract from results */
  field: string;

  /** Minimum confidence threshold (0-1) */
  minConfidence?: number;

  /** Maximum number of results to consider */
  maxResults?: number;

  /** Filter by project/region/cluster */
  filters?: {
    projectId?: string;
    region?: string;
    clusterName?: string;
  };
}

/**
 * Dynamic resolver configuration
 */
export interface DynamicResolverConfig {
  /** Enable caching of resolved values */
  enableCaching: boolean;

  /** Default TTL for cached values (ms) */
  defaultTtlMs: number;

  /** Maximum cache size */
  maxCacheSize: number;

  /** Function execution timeout (ms) */
  executionTimeoutMs: number;

  /** Enable performance metrics */
  enableMetrics: boolean;

  /** Job output specific configuration */
  jobOutput: {
    /** Default timeout for job completion (ms) */
    defaultTimeoutMs: number;

    /** Whether to wait for running jobs by default */
    waitForCompletion: boolean;

    /** Cache TTL for job outputs (ms) */
    cacheTtlMs: number;
  };

  /** Qdrant query specific configuration */
  qdrantQuery: {
    /** Default minimum confidence threshold */
    defaultMinConfidence: number;

    /** Default maximum results to consider */
    defaultMaxResults: number;

    /** Cache TTL for Qdrant queries (ms) */
    cacheTtlMs: number;
  };
}

/**
 * Dynamic resolver metrics
 */
export interface DynamicResolverMetrics {
  /** Total function calls */
  totalCalls: number;

  /** Successful resolutions */
  successfulResolutions: number;

  /** Failed resolutions */
  failedResolutions: number;

  /** Cache hits */
  cacheHits: number;

  /** Cache misses */
  cacheMisses: number;

  /** Average resolution time (ms) */
  averageResolutionTimeMs: number;

  /** Function-specific metrics */
  functionMetrics: {
    job_output: {
      calls: number;
      successes: number;
      failures: number;
      averageTimeMs: number;
    };
    qdrant_query: {
      calls: number;
      successes: number;
      failures: number;
      averageTimeMs: number;
      averageConfidence: number;
    };
  };
}

/**
 * Error types for dynamic function resolution
 */
export class DynamicResolutionError extends Error {
  constructor(
    message: string,
    public functionCall: FunctionCall,
    public cause?: Error
  ) {
    super(message);
    this.name = 'DynamicResolutionError';
  }
}

export class JobOutputError extends DynamicResolutionError {
  constructor(
    message: string,
    functionCall: FunctionCall,
    public jobId: string,
    cause?: Error
  ) {
    super(message, functionCall, cause);
    this.name = 'JobOutputError';
  }
}

export class QdrantQueryError extends DynamicResolutionError {
  constructor(
    message: string,
    functionCall: FunctionCall,
    public query: string,
    cause?: Error
  ) {
    super(message, functionCall, cause);
    this.name = 'QdrantQueryError';
  }
}
