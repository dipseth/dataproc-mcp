/**
 * Semantic Query Service for Qdrant-stored cluster data
 *
 * This service enables natural language queries against stored cluster configurations
 * and provides intelligent data extraction with confidence scoring.
 *
 * KEY CAPABILITIES:
 * - Natural language query processing: "show me clusters with pip packages"
 * - Vector similarity search using Transformers.js embeddings
 * - Confidence scoring and relevance ranking
 * - Intelligent data extraction from cluster configurations
 * - Graceful degradation when Qdrant is unavailable
 *
 * SUPPORTED QUERY TYPES:
 * - Package queries: "pip packages", "machine learning libraries"
 * - Infrastructure queries: "high memory configurations", "SSD storage"
 * - Component queries: "Jupyter notebooks", "Spark configurations"
 * - Network queries: "service accounts", "subnet configurations"
 *
 * GRACEFUL DEGRADATION:
 * - Automatically detects Qdrant availability
 * - Provides helpful setup guidance when Qdrant is not connected
 * - Falls back to standard data retrieval without breaking functionality
 * - Maintains consistent API regardless of backend availability
 *
 * USAGE EXAMPLES:
 * - query_cluster_data: Direct semantic queries against knowledge base
 * - list_clusters with semanticQuery: Enhanced cluster listing
 * - get_cluster with semanticQuery: Focused data extraction
 *
 * CONFIGURATION:
 * - Uses config/response-filter.json for Qdrant connection settings
 * - Default port: 6334, collection: dataproc_knowledge
 * - Vector size: 384 (Transformers.js compatible)
 * - Distance metric: Cosine similarity
 */

import { QdrantStorageService } from './qdrant-storage.js';
import { QdrantStorageMetadata } from '../types/response-filter.js';
import { ClusterConfig } from '../types/cluster-config.js';
import { logger } from '../utils/logger.js';

// Type definitions for better type safety
interface QdrantSearchResult {
  id: string;
  score: number;
  metadata: QdrantStorageMetadata;
  data: unknown;
}

interface ClusterData {
  clusterName?: string;
  projectId?: string;
  region?: string;
  config?: ClusterConfig;
  labels?: Record<string, string>;
  status?: {
    state?: string;
    stateStartTime?: string;
  };
  [key: string]: unknown;
}

interface ExtractedInfo {
  type?: string;
  packages?: string[];
  count?: number;
  rawValue?: string;
  pipPackages?: string[];
  machineTypes?: string[];
  components?: string[];
  properties?: Record<string, string>;
  master?: {
    instances?: number;
    machineType?: string;
    diskSize?: number;
    diskType?: string;
  };
  workers?:
    | number
    | {
        instances?: number;
        machineType?: string;
        diskSize?: number;
        diskType?: string;
      };
  secondaryWorkers?: {
    instances?: number;
    machineType?: string;
    preemptible?: boolean;
  } | null;
  optionalComponents?: string[];
  imageVersion?: string;
  initializationActions?: Array<{
    script?: string;
    timeout?: string;
  }>;
  keyProperties?: Record<string, string>;
  name?: string;
  status?: string;
  created?: string;
  zone?: string;
  subnet?: string;
  network?: string;
  internalIpOnly?: boolean;
  serviceAccount?: string;
  tags?: string[];
  shieldedInstance?: unknown;
  machineType?: string;
  [key: string]: unknown;
}

export interface SemanticQueryResult {
  clusterId: string;
  clusterName: string;
  projectId: string;
  region: string;
  matchedContent: string;
  confidence: number;
  extractedInfo: ExtractedInfo;
}

export interface QueryResponse {
  query: string;
  results: SemanticQueryResult[];
  totalFound: number;
  processingTime: number;
}

export class SemanticQueryService {
  private qdrantService: QdrantStorageService | null = null;
  private initializationPromise: Promise<void>;

  constructor(qdrantConfig?: {
    url?: string;
    collectionName?: string;
    vectorSize?: number;
    distance?: 'Cosine' | 'Euclidean' | 'Dot';
  }) {
    // Use centralized connection manager to discover working Qdrant URL
    this.initializationPromise = this.initializeWithConnectionManager(qdrantConfig);
  }

  private async initializeWithConnectionManager(qdrantConfig?: {
    url?: string;
    collectionName?: string;
    vectorSize?: number;
    distance?: 'Cosine' | 'Euclidean' | 'Dot';
  }): Promise<void> {
    try {
      const { getQdrantUrl } = await import('./qdrant-connection-manager.js');

      // Discover working Qdrant URL
      const discoveredUrl = await getQdrantUrl({ url: qdrantConfig?.url });

      if (!discoveredUrl) {
        throw new Error(
          'No working Qdrant URL discovered. Cannot initialize SemanticQueryService.'
        );
      }

      const config = {
        url: discoveredUrl, // ONLY use verified URL - NO FALLBACKS
        collectionName: qdrantConfig?.collectionName || 'dataproc_knowledge',
        vectorSize: qdrantConfig?.vectorSize || 384,
        distance: qdrantConfig?.distance || ('Cosine' as const),
      };

      this.qdrantService = new QdrantStorageService(config);

      // Initialize the Qdrant service and ensure collection is ready
      await this.qdrantService.initialize();

      // Log successful initialization
      logger.info(`🔍 [SEMANTIC-QUERY] SemanticQueryService initialized with URL: ${config.url}`);
    } catch (error) {
      console.error('Failed to initialize SemanticQueryService with connection manager:', error);
      // Keep qdrantService as null to indicate initialization failure
    }
  }

  /**
   * Ensure the service is initialized before use
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initializationPromise) {
      await this.initializationPromise;
    }
  }

  async initialize(): Promise<void> {
    // QdrantStorageService initializes collection automatically when needed
    // No explicit initialization required
  }

  /**
   * Query stored cluster data using natural language
   */
  async queryClusterData(
    query: string,
    options: {
      limit?: number;
      projectId?: string;
      region?: string;
      clusterName?: string;
    } = {}
  ): Promise<QueryResponse> {
    const startTime = Date.now();

    try {
      // Ensure service is initialized
      await this.ensureInitialized();

      // Check if Qdrant service is available
      if (!this.qdrantService) {
        logger.warn('Qdrant service not available, returning empty results');
        return {
          query,
          results: [],
          totalFound: 0,
          processingTime: Date.now() - startTime,
        };
      }

      // Search for relevant stored data
      const searchResults = await this.qdrantService.searchSimilar(query, options.limit || 5);

      // Filter by project/region/cluster if specified
      const filteredResults = this.filterResults(searchResults, options);

      // Extract relevant information based on query type
      const processedResults = await this.processQueryResults(query, filteredResults);

      return {
        query,
        results: processedResults,
        totalFound: processedResults.length,
        processingTime: Date.now() - startTime,
      };
    } catch (error) {
      logger.error('Semantic query failed:', error);
      return {
        query,
        results: [],
        totalFound: 0,
        processingTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Specialized query for pip packages
   */
  async queryPipPackages(
    options: {
      projectId?: string;
      region?: string;
      clusterName?: string;
    } = {}
  ): Promise<QueryResponse> {
    return this.queryClusterData('pip packages python dependencies dataproc:pip.packages', {
      ...options,
      limit: 10,
    });
  }

  /**
   * Specialized query for machine types and hardware configuration
   */
  async queryHardwareConfig(
    options: {
      projectId?: string;
      region?: string;
      clusterName?: string;
    } = {}
  ): Promise<QueryResponse> {
    return this.queryClusterData('machine type hardware configuration cpu memory disk', {
      ...options,
      limit: 10,
    });
  }

  /**
   * Specialized query for network and security configuration
   */
  async queryNetworkConfig(
    options: {
      projectId?: string;
      region?: string;
      clusterName?: string;
    } = {}
  ): Promise<QueryResponse> {
    return this.queryClusterData('network subnet security firewall vpc', {
      ...options,
      limit: 10,
    });
  }

  /**
   * Specialized query for software and initialization actions
   */
  async querySoftwareConfig(
    options: {
      projectId?: string;
      region?: string;
      clusterName?: string;
    } = {}
  ): Promise<QueryResponse> {
    return this.queryClusterData('software initialization actions scripts properties', {
      ...options,
      limit: 10,
    });
  }

  private filterResults(
    results: QdrantSearchResult[],
    options: {
      projectId?: string;
      region?: string;
      clusterName?: string;
    }
  ): QdrantSearchResult[] {
    return results.filter((result) => {
      const metadata = result.metadata || {};

      if (options.projectId && metadata.projectId !== options.projectId) {
        return false;
      }

      if (options.region && metadata.region !== options.region) {
        return false;
      }

      if (options.clusterName && metadata.clusterName !== options.clusterName) {
        return false;
      }

      return true;
    });
  }

  private async processQueryResults(
    query: string,
    results: QdrantSearchResult[]
  ): Promise<SemanticQueryResult[]> {
    const processedResults: SemanticQueryResult[] = [];

    for (const result of results) {
      try {
        const metadata = result.metadata || {};
        const data = result.data || {};

        // Extract relevant information based on query type
        const extractedInfo = this.extractRelevantInfo(query, data);

        processedResults.push({
          clusterId: `${metadata.projectId || 'unknown'}-${metadata.region || 'unknown'}-${metadata.clusterName || 'unknown'}`,
          clusterName: metadata.clusterName || 'unknown',
          projectId: metadata.projectId || 'unknown',
          region: metadata.region || 'unknown',
          matchedContent: this.getMatchedContent(query, data),
          confidence: result.score || 0,
          extractedInfo,
        });
      } catch (error) {
        logger.warn('Failed to process query result:', error);
      }
    }

    return processedResults.sort((a, b) => b.confidence - a.confidence);
  }

  private extractRelevantInfo(query: string, data: unknown): ExtractedInfo {
    const lowerQuery = query.toLowerCase();

    // Pip packages extraction
    if (
      lowerQuery.includes('pip') ||
      lowerQuery.includes('package') ||
      lowerQuery.includes('python')
    ) {
      return this.extractPipPackages(data);
    }

    // Machine type extraction
    if (
      lowerQuery.includes('machine') ||
      lowerQuery.includes('hardware') ||
      lowerQuery.includes('cpu')
    ) {
      return this.extractMachineConfig(data);
    }

    // Network configuration extraction
    if (
      lowerQuery.includes('network') ||
      lowerQuery.includes('subnet') ||
      lowerQuery.includes('vpc')
    ) {
      return this.extractNetworkConfig(data);
    }

    // Software configuration extraction
    if (
      lowerQuery.includes('software') ||
      lowerQuery.includes('initialization') ||
      lowerQuery.includes('script')
    ) {
      return this.extractSoftwareConfig(data);
    }

    // Default: return summary
    return this.extractSummary(data);
  }

  private extractPipPackages(data: unknown): ExtractedInfo {
    try {
      const clusterData = data as ClusterData;
      const pipPackages =
        clusterData?.config?.softwareConfig?.properties?.['dataproc:pip.packages'];
      if (pipPackages) {
        const packages = pipPackages.split(',').map((pkg: string) => pkg.trim());
        return {
          type: 'pip_packages',
          packages,
          count: packages.length,
          rawValue: pipPackages,
        };
      }
    } catch (error) {
      logger.warn('Failed to extract pip packages:', error);
    }
    return { type: 'pip_packages', packages: [], count: 0 };
  }

  private extractMachineConfig(data: unknown): ExtractedInfo {
    try {
      const clusterData = data as ClusterData;
      const config = clusterData?.config;
      return {
        type: 'machine_config',
        master: {
          instances: config?.masterConfig?.numInstances,
          machineType: this.extractMachineType(config?.masterConfig?.machineTypeUri || ''),
          diskSize: config?.masterConfig?.diskConfig?.bootDiskSizeGb,
          diskType: config?.masterConfig?.diskConfig?.bootDiskType,
        },
        workers: {
          instances: config?.workerConfig?.numInstances,
          machineType: this.extractMachineType(config?.workerConfig?.machineTypeUri || ''),
          diskSize: config?.workerConfig?.diskConfig?.bootDiskSizeGb,
          diskType: config?.workerConfig?.diskConfig?.bootDiskType,
        },
        secondaryWorkers: config?.secondaryWorkerConfig
          ? {
              instances: config.secondaryWorkerConfig.numInstances,
              machineType: this.extractMachineType(
                config.secondaryWorkerConfig.machineTypeUri || ''
              ),
              preemptible: config.secondaryWorkerConfig.isPreemptible,
            }
          : null,
      };
    } catch (error) {
      logger.warn('Failed to extract machine config:', error);
    }
    return { type: 'machine_config' };
  }

  private extractNetworkConfig(data: unknown): ExtractedInfo {
    try {
      const clusterData = data as ClusterData;
      const gceConfig = clusterData?.config?.gceClusterConfig;
      return {
        type: 'network_config',
        zone: gceConfig?.zoneUri,
        subnet: gceConfig?.subnetworkUri,
        internalIpOnly: gceConfig?.internalIpOnly,
        serviceAccount: gceConfig?.serviceAccount,
        tags: gceConfig?.tags || [],
        shieldedInstance: gceConfig?.shieldedInstanceConfig,
      };
    } catch (error) {
      logger.warn('Failed to extract network config:', error);
    }
    return { type: 'network_config' };
  }

  private extractSoftwareConfig(data: unknown): ExtractedInfo {
    try {
      const clusterData = data as ClusterData;
      const softwareConfig = clusterData?.config?.softwareConfig;
      const initActions = (clusterData as any)?.config?.initializationActions || [];

      return {
        type: 'software_config',
        imageVersion: softwareConfig?.imageVersion,
        optionalComponents: softwareConfig?.optionalComponents || [],
        initializationActions: initActions.map((action: any) => ({
          script: action.executableFile,
          timeout: action.executionTimeout,
        })),
        keyProperties: this.extractKeyProperties(softwareConfig?.properties || {}),
      };
    } catch (error) {
      logger.warn('Failed to extract software config:', error);
    }
    return { type: 'software_config' };
  }

  private extractSummary(data: unknown): ExtractedInfo {
    try {
      const clusterData = data as ClusterData;
      return {
        type: 'cluster_summary',
        name: clusterData?.clusterName,
        status: (clusterData as any)?.status?.state,
        created: (clusterData as any)?.status?.stateStartTime,
        workers: clusterData?.config?.workerConfig?.numInstances,
        machineType: this.extractMachineType(
          clusterData?.config?.workerConfig?.machineTypeUri || ''
        ),
      };
    } catch (error) {
      logger.warn('Failed to extract summary:', error);
    }
    return { type: 'cluster_summary' };
  }

  private extractMachineType(machineTypeUri: string): string {
    if (!machineTypeUri) return 'unknown';
    const parts = machineTypeUri.split('/');
    return parts[parts.length - 1] || 'unknown';
  }

  private extractKeyProperties(properties: Record<string, string>): Record<string, string> {
    const keyProps: Record<string, string> = {};

    // Extract important properties
    const importantKeys = [
      'dataproc:pip.packages',
      'spark:spark.executor.memory',
      'spark:spark.executor.cores',
      'yarn:yarn.nodemanager.resource.memory-mb',
      'yarn:yarn.nodemanager.resource.cpu-vcores',
    ];

    for (const key of importantKeys) {
      if (properties[key]) {
        keyProps[key] = properties[key];
      }
    }

    return keyProps;
  }

  private getMatchedContent(query: string, data: unknown): string {
    // Return a snippet of the matched content for context
    try {
      const dataStr = JSON.stringify(data, null, 2);
      const lowerQuery = query.toLowerCase();
      const lowerData = dataStr.toLowerCase();

      // Find the position of query terms in the data
      const queryTerms = lowerQuery.split(' ').filter((term) => term.length > 2);
      let bestMatch = '';
      // Track best score for potential future use
      // let bestScore = 0;

      for (const term of queryTerms) {
        const index = lowerData.indexOf(term);
        if (index !== -1) {
          const start = Math.max(0, index - 100);
          const end = Math.min(dataStr.length, index + 200);
          const snippet = dataStr.substring(start, end);

          if (snippet.length > bestMatch.length) {
            bestMatch = snippet;
            // bestScore++;
          }
        }
      }

      return bestMatch || dataStr.substring(0, 200) + '...';
    } catch (error) {
      return 'Content extraction failed';
    }
  }
}
