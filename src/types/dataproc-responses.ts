/**
 * Extended type definitions for Dataproc API responses
 * Builds upon existing types to provide better type safety for `any` replacements
 */

import { QueryJob } from './query.js';
import { ClusterInfo } from './response.js';
import { ClusterConfig, InitializationAction } from './cluster-config.js';

/**
 * Extended Dataproc job interface that includes all job types
 */
export interface DataprocJob extends QueryJob {
  sparkJob?: {
    mainClass?: string;
    mainJarFileUri?: string;
    jarFileUris?: string[];
    fileUris?: string[];
    archiveUris?: string[];
    properties?: Record<string, string>;
    args?: string[];
    loggingConfig?: {
      driverLogLevels?: Record<string, string>;
    };
  };
  pysparkJob?: {
    mainPythonFileUri?: string;
    pythonFileUris?: string[];
    jarFileUris?: string[];
    fileUris?: string[];
    archiveUris?: string[];
    properties?: Record<string, string>;
    args?: string[];
    loggingConfig?: {
      driverLogLevels?: Record<string, string>;
    };
  };
  prestoJob?: {
    queryFileUri?: string;
    queryList?: {
      queries?: string[];
    };
    continueOnFailure?: boolean;
    outputFormat?: string;
    clientTags?: string[];
    properties?: Record<string, string>;
    loggingConfig?: {
      driverLogLevels?: Record<string, string>;
    };
  };
}

/**
 * Extended cluster data interface for comprehensive cluster information
 */
export interface ExtendedClusterData extends ClusterInfo {
  config?: ClusterConfig;
  region?: string;
  zone?: string;
  [key: string]: unknown;
}

/**
 * Query result data with proper typing
 */
export interface QueryResultData {
  results?: unknown[][];
  rows?: unknown[][];
  schema?: {
    fields?: Array<{
      name?: string;
      type?: string;
      mode?: string;
      description?: string;
    }>;
  };
  totalRows?: number;
  numRows?: number;
  executionTime?: string;
  elapsedTime?: string;
  bytesProcessed?: number;
  totalBytesProcessed?: number;
  jobId?: string;
  reference?: {
    jobId?: string;
    projectId?: string;
  };
}

/**
 * Extracted query essentials with proper typing
 */
export interface ExtractedQueryData {
  results?: unknown[][];
  schema?: {
    fields?: Array<{
      name?: string;
      type?: string;
      mode?: string;
      description?: string;
    }>;
  };
  stats?: {
    totalRows?: number;
    executionTime?: string;
    bytesProcessed?: number;
    jobId?: string;
  };
}

/**
 * Error information with structured typing
 */
export interface ErrorInfo {
  errorType: string;
  errorMessage: string;
  stackTrace?: string;
  commonCause?: string;
  suggestedFix?: string;
}

/**
 * Output sample structure for job results
 */
export interface OutputSample {
  columns: string[];
  rows: unknown[][];
  totalRows?: number;
}

/**
 * Union type for different API response types
 * Made flexible to accept Google Cloud API types
 */
export type DataprocApiResponse = unknown;

/**
 * Type guards for runtime type checking
 */
export function isClusterResponse(
  response: unknown
): response is { clusters?: ExtendedClusterData[]; cluster?: ExtendedClusterData } {
  return (
    typeof response === 'object' &&
    response !== null &&
    ('clusters' in response || 'cluster' in response)
  );
}

export function isJobResponse(response: unknown): response is { jobs?: DataprocJob[] } {
  return typeof response === 'object' && response !== null && 'jobs' in response;
}

export function isQueryResultData(response: unknown): response is QueryResultData {
  return (
    typeof response === 'object' &&
    response !== null &&
    ('results' in response || 'rows' in response || 'schema' in response)
  );
}

export function isDataprocJob(obj: unknown): obj is DataprocJob {
  return typeof obj === 'object' && obj !== null && 'reference' in obj && 'placement' in obj;
}

export function isExtendedClusterData(obj: unknown): obj is ExtendedClusterData {
  return typeof obj === 'object' && obj !== null && ('clusterName' in obj || 'projectId' in obj);
}

export function isInitializationAction(obj: unknown): obj is InitializationAction {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    ('executableFile' in obj || 'executionTimeout' in obj)
  );
}

/**
 * Configuration validation types
 */
export interface QdrantConfigInput {
  url: string;
  apiKey?: string;
  collectionName: string;
  vectorSize: number;
  distance: 'Cosine' | 'Euclidean' | 'Dot';
}

export interface ResponseFilterConfigInput {
  tokenLimits?: Record<string, number>;
  extractionRules?: Record<string, unknown>;
  qdrant?: Record<string, unknown>;
  formatting?: Record<string, unknown>;
  caching?: Record<string, unknown>;
}

/**
 * Type guard to validate QdrantConfig
 */
export function isValidQdrantConfig(config: unknown): config is QdrantConfigInput {
  return (
    typeof config === 'object' &&
    config !== null &&
    typeof (config as any).url === 'string' &&
    typeof (config as any).collectionName === 'string' &&
    typeof (config as any).vectorSize === 'number' &&
    ['Cosine', 'Euclidean', 'Dot'].includes((config as any).distance)
  );
}
