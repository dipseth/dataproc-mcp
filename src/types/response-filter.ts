/**
 * Type definitions for MCP Response Optimization
 * Supports intelligent filtering and Qdrant storage for token reduction
 */

export interface FilteredResponse {
  type: 'filtered' | 'full' | 'summary' | 'semantic';
  content: string;
  summary?: string;
  resourceUri?: string;
  fullDataAvailable: boolean;
  tokensSaved?: number;
}

export interface ClusterSummary {
  clusterName: string;
  status: string;
  createTime: string;
  projectId: string;
  region: string;
  machineType?: string;
  numWorkers?: number;
  labels?: Record<string, string>;
}

export interface ClusterDetails {
  clusterName: string;
  projectId: string;
  region: string;
  status: string;
  createTime: string;
  config: {
    masterConfig?: {
      numInstances?: number;
      machineTypeUri?: string;
      diskConfig?: {
        bootDiskSizeGb?: number;
        bootDiskType?: string;
      };
    };
    workerConfig?: {
      numInstances?: number;
      machineTypeUri?: string;
      diskConfig?: {
        bootDiskSizeGb?: number;
        bootDiskType?: string;
      };
    };
    softwareConfig?: {
      imageVersion?: string;
      optionalComponents?: string[];
    };
  };
  labels?: Record<string, string>;
  metrics?: {
    hdfsMetrics?: Record<string, string>;
    yarnMetrics?: Record<string, string>;
  };
  statusHistory?: Array<{
    state: string;
    stateStartTime: string;
    detail?: string;
  }>;
}

export interface ResponseFilterConfig {
  tokenLimits: {
    list_clusters: number;
    get_cluster: number;
    submit_hive_query: number;
    get_query_results: number;
    list_tracked_clusters: number;
    check_active_jobs: number;
    default: number;
  };
  extractionRules: {
    list_clusters: {
      maxClusters: number;
      essentialFields: string[];
      summaryFormat: 'table' | 'list' | 'compact';
    };
    get_cluster: {
      essentialSections: string[];
      includeMetrics: boolean;
      includeHistory: boolean;
    };
    query_results: {
      maxRows: number;
      includeSchema: boolean;
      summaryStats: boolean;
    };
    job_tracking: {
      maxJobs: number;
      includeMetrics: boolean;
      groupByStatus: boolean;
    };
  };
  qdrant: {
    url: string;
    apiKey?: string;
    collectionName: string;
    vectorSize: number;
    distance: 'Cosine' | 'Euclidean' | 'Dot';
  };
  formatting: {
    useEmojis: boolean;
    compactTables: boolean;
    includeResourceLinks: boolean;
    maxLineLength: number;
  };
  caching: {
    enabled: boolean;
    ttlSeconds: number;
    maxCacheSize: number;
  };
}

export interface QdrantStorageMetadata {
  toolName: string;
  timestamp: string;
  projectId?: string;
  region?: string;
  clusterName?: string;
  responseType: string;
  originalTokenCount: number;
  filteredTokenCount: number;
  compressionRatio: number;
  type?: string; // For knowledge indexing
}

export interface ResponseOptimizationMetrics {
  totalRequests: number;
  filteredRequests: number;
  tokensSaved: number;
  averageCompressionRatio: number;
  cacheHitRate: number;
  qdrantStorageUsed: number;
}
