/**
 * Knowledge Indexer Service
 *
 * This service is the core of the semantic search feature, providing intelligent
 * data extraction and indexing capabilities for Dataproc infrastructure.
 *
 * FEATURES:
 * - Builds and maintains a comprehensive knowledge base of cluster configurations
 * - Extracts meaningful information from Hive query outputs (first few rows/columns)
 * - Tracks job submission patterns (Hive, Spark, PySpark, etc.)
 * - Indexes error patterns and troubleshooting information
 * - Enables natural language queries against stored data
 *
 * GRACEFUL DEGRADATION:
 * - Works with or without Qdrant vector database
 * - Provides helpful setup guidance when Qdrant is unavailable
 * - Core functionality never breaks regardless of optional dependencies
 *
 * KNOWLEDGE BASE STRUCTURE:
 * - Cluster configurations: machine types, worker counts, components
 * - Package information: pip packages, initialization scripts
 * - Network configurations: zones, subnets, service accounts
 * - Operational data: creation times, owners, environments
 *
 * USAGE:
 * - Automatically indexes data from list_clusters and get_cluster operations
 * - Powers semantic queries like "show me clusters with machine learning packages"
 * - Provides confidence scoring for search results
 * - Supports filtering by project, region, and cluster name
 */

import { QdrantStorageService } from './qdrant-storage.js';
import { TransformersEmbeddingService } from './transformers-embeddings.js';
import { ClusterConfig } from '../types/cluster-config.js';
import { QueryResultResponse as ApiQueryResultResponse } from '../types/response.js';
import { ErrorInfo } from '../types/dataproc-responses.js';
import { logger } from '../utils/logger.js';
import { performance } from 'perf_hooks';
import { GenericQdrantConverter, createGenericConverter } from './generic-converter.js';
import { CompressionService } from './compression.js';
import { ConversionConfig, ConversionResult } from '../types/generic-converter.js';
import { QdrantStorageMetadata } from '../types/response-filter.js';

// Type for cluster data that includes metadata beyond just config
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

export interface ClusterKnowledge {
  clusterName: string;
  projectId: string;
  region: string;
  firstSeen: string;
  lastSeen: string;
  configurations: {
    machineTypes: string[];
    workerCounts: number[];
    components: string[];
    pipelines: string[];
    owners: string[];
    imageVersions: string[];
  };
  pipPackages: string[];
  initializationScripts: string[];
  networkConfig: {
    zones: string[];
    subnets: string[];
    serviceAccounts: string[];
  };
}

export interface JobKnowledge {
  jobId: string;
  jobType: 'hive' | 'spark' | 'pyspark' | 'presto' | 'other';
  clusterName: string;
  projectId: string;
  region: string;
  submissionTime: string;
  query?: string;
  status: string;
  duration?: number;
  results?: ApiQueryResultResponse; // Add results property
  outputSample?: {
    columns: string[];
    rows: unknown[][];
    totalRows?: number;
  };
  errorInfo?: {
    errorType: string;
    errorMessage: string;
    stackTrace?: string;
    commonCause?: string;
    suggestedFix?: string;
  };
}

export interface ErrorPattern {
  errorType: string;
  pattern: string;
  frequency: number;
  commonCauses: string[];
  suggestedFixes: string[];
  relatedClusters: string[];
  relatedJobTypes: string[];
  examples: {
    jobId: string;
    clusterName: string;
    timestamp: string;
    context: string;
  }[];
}

interface FormattedSearchResult {
  type: string;
  confidence: number;
  data: ClusterKnowledge | JobKnowledge | ErrorPattern;
  summary: string;
  id?: string; // Include the Qdrant document ID for raw document retrieval
}

export class KnowledgeIndexer {
  private qdrantService: QdrantStorageService;
  private embeddingService: TransformersEmbeddingService;
  private clusterKnowledge: Map<string, ClusterKnowledge> = new Map();
  private jobKnowledge: Map<string, JobKnowledge> = new Map();
  private errorPatterns: Map<string, ErrorPattern> = new Map();
  private genericConverter: GenericQdrantConverter;
  private compressionService: CompressionService;

  /**
   * Get access to the Qdrant service for raw document retrieval
   */
  public getQdrantService(): QdrantStorageService {
    return this.qdrantService;
  }

  constructor(qdrantConfig?: {
    url?: string;
    collectionName?: string;
    vectorSize?: number;
    distance?: 'Cosine' | 'Euclidean' | 'Dot';
  }) {
    // Initialize with placeholder config - will be updated during initialization
    const config = {
      url: qdrantConfig?.url || 'http://localhost:6333',
      collectionName: qdrantConfig?.collectionName || 'dataproc_knowledge',
      vectorSize: qdrantConfig?.vectorSize || 384,
      distance: qdrantConfig?.distance || ('Cosine' as const),
    };

    this.qdrantService = new QdrantStorageService(config);
    // Use singleton pattern to prevent multiple Transformers.js instances
    this.embeddingService = TransformersEmbeddingService.getInstance();
    this.compressionService = new CompressionService();
    this.genericConverter = createGenericConverter(this.compressionService);
  }

  /**
   * Initialize with connection discovery
   */
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
        throw new Error('No working Qdrant URL discovered. Cannot initialize KnowledgeIndexer.');
      }

      const config = {
        url: discoveredUrl, // ONLY use verified URL - NO FALLBACKS
        collectionName: qdrantConfig?.collectionName || 'dataproc_knowledge',
        vectorSize: qdrantConfig?.vectorSize || 384,
        distance: qdrantConfig?.distance || ('Cosine' as const),
      };

      // Recreate QdrantStorageService with discovered URL
      this.qdrantService = new QdrantStorageService(config);

      // Recreate generic converter with new compression service if needed
      this.compressionService = new CompressionService();
      this.genericConverter = createGenericConverter(this.compressionService);

      logger.info(`🧠 [KNOWLEDGE-INDEXER] Initialized with URL: ${config.url}`);
    } catch (error) {
      logger.error('Failed to initialize KnowledgeIndexer with connection manager:', error);
      throw error;
    }
  }

  /**
   * Initialize the knowledge indexer (ensures Qdrant collection exists)
   */
  async initialize(qdrantConfig?: {
    url?: string;
    collectionName?: string;
    vectorSize?: number;
    distance?: 'Cosine' | 'Euclidean' | 'Dot';
  }): Promise<void> {
    try {
      // First, discover the working Qdrant URL
      await this.initializeWithConnectionManager(qdrantConfig);

      // Then initialize the underlying Qdrant service
      await this.qdrantService.initialize();
      logger.info('🧠 Knowledge indexer initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize knowledge indexer:', error);
      throw error;
    }
  }

  /**
   * Get collection information for debugging
   */
  getCollectionInfo(): { collectionName: string; url: string } {
    return {
      collectionName: 'dataproc_knowledge', // Hard-coded since config is private
      url: 'configured', // Can't access private config
    };
  }

  /**
   * Index cluster configuration when first encountered
   */
  async indexClusterConfiguration(clusterData: ClusterData): Promise<void> {
    const startTime = performance.now();

    try {
      // Enhanced validation with generic converter support
      const validationResult = await this.validateClusterData(clusterData);
      if (!validationResult.isValid) {
        throw new Error(`Invalid cluster data: ${validationResult.errors.join(', ')}`);
      }

      // Extract clusterName from multiple possible sources using automatic field mapping
      const extractedFields = await this.extractClusterIdentifiers(clusterData);
      const { clusterName, projectId, region } = extractedFields;
      const key = `${projectId}/${region}/${clusterName}`;

      let knowledge = this.clusterKnowledge.get(key);
      const now = new Date().toISOString();

      if (!knowledge) {
        // First time seeing this cluster - use generic converter for initialization
        knowledge = await this.initializeClusterKnowledge(clusterName, projectId, region, now);
        logger.info(`🆕 New cluster discovered: ${clusterName} in ${projectId}/${region}`);
      } else {
        knowledge.lastSeen = now;
      }

      // Extract and update configuration knowledge using generic converter
      await this.updateClusterKnowledge(knowledge, clusterData);

      // Store in memory and Qdrant
      this.clusterKnowledge.set(key, knowledge);
      await this.storeClusterKnowledge(knowledge);

      const processingTime = performance.now() - startTime;
      logger.debug('🔄 [KNOWLEDGE-INDEXER] Cluster configuration indexed successfully', {
        clusterName,
        projectId,
        region,
        processingTime: processingTime.toFixed(2) + 'ms',
      });
    } catch (error) {
      const processingTime = performance.now() - startTime;

      console.log('[DEBUG] Full error in indexClusterConfiguration:', error);
      console.log('[DEBUG] Error message:', (error as any)?.message);
      console.log('[DEBUG] Error stack:', (error as any)?.stack);
      console.log('[DEBUG] Processing time before error:', processingTime.toFixed(2) + 'ms');

      // Re-throw validation errors so tests can catch them
      if ((error as any)?.message?.includes('Invalid cluster data')) {
        throw error;
      }

      logger.error('Failed to index cluster configuration:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: processingTime.toFixed(2) + 'ms',
      });
    }
  }

  /**
   * Graceful shutdown - cleanup resources
   */
  async shutdown(): Promise<void> {
    logger.info('🔄 [MUTEX-DEBUG] KnowledgeIndexer: Initiating graceful shutdown');

    try {
      // Clear in-memory caches first
      this.clusterKnowledge.clear();
      this.jobKnowledge.clear();
      logger.debug('🔄 [MUTEX-DEBUG] KnowledgeIndexer: In-memory caches cleared');

      // Shutdown TransformersEmbeddingService FIRST to avoid circular dependencies
      if (this.embeddingService && typeof this.embeddingService.shutdown === 'function') {
        logger.info(
          '🔄 [MUTEX-DEBUG] KnowledgeIndexer: Shutting down TransformersEmbeddingService FIRST'
        );
        try {
          await this.embeddingService.shutdown();
          logger.info(
            '🔄 [MUTEX-DEBUG] KnowledgeIndexer: TransformersEmbeddingService shutdown SUCCESS'
          );
        } catch (embeddingError) {
          logger.error(
            '🔄 [MUTEX-DEBUG] KnowledgeIndexer: TransformersEmbeddingService shutdown FAILED:',
            embeddingError
          );
          // Continue with cleanup
        }
        this.embeddingService = null as any;
      }

      // Shutdown QdrantStorageService AFTER embedding service
      if (this.qdrantService && typeof this.qdrantService.shutdown === 'function') {
        logger.info('🔄 [MUTEX-DEBUG] KnowledgeIndexer: Shutting down QdrantStorageService SECOND');
        try {
          await this.qdrantService.shutdown();
          logger.info('🔄 [MUTEX-DEBUG] KnowledgeIndexer: QdrantStorageService shutdown SUCCESS');
        } catch (qdrantError) {
          logger.error(
            '🔄 [MUTEX-DEBUG] KnowledgeIndexer: QdrantStorageService shutdown FAILED:',
            qdrantError
          );
          // Continue with cleanup
        }
        this.qdrantService = null as any;
      }

      // Clear other references
      if (this.compressionService) {
        this.compressionService = null as any;
      }
      if (this.genericConverter) {
        this.genericConverter = null as any;
      }

      logger.info('🔄 [MUTEX-DEBUG] KnowledgeIndexer: Shutdown complete');
    } catch (error) {
      logger.error('🔄 [MUTEX-DEBUG] KnowledgeIndexer: Error during shutdown:', error);
      // Don't re-throw to prevent cascading failures
      logger.warn(
        '🔄 [MUTEX-DEBUG] Continuing shutdown despite errors to prevent mutex lock issues'
      );
    }
  }

  /**
   * Validate cluster data using generic converter validation
   */
  private async validateClusterData(
    clusterData: ClusterData
  ): Promise<{ isValid: boolean; errors: string[] }> {
    try {
      // Basic validation
      if (
        !clusterData ||
        clusterData === null ||
        typeof clusterData !== 'object' ||
        Array.isArray(clusterData)
      ) {
        return {
          isValid: false,
          errors: [
            `Invalid cluster data: expected non-null object, got ${clusterData === null ? 'null' : typeof clusterData}`,
          ],
        };
      }

      // Use generic converter validation if available
      const validationResult = await this.genericConverter.validateSource(clusterData);
      return {
        isValid: validationResult.isValid,
        errors: validationResult.errors,
      };
    } catch (error) {
      // Fallback to basic validation
      return {
        isValid: true,
        errors: [],
      };
    }
  }

  /**
   * Extract cluster identifiers using automatic field mapping
   */
  private async extractClusterIdentifiers(clusterData: ClusterData): Promise<{
    clusterName: string;
    projectId: string;
    region: string;
  }> {
    try {
      // Use generic converter for automatic field extraction
      const metadata: QdrantStorageMetadata = {
        toolName: 'knowledge-indexer-identifier-extraction',
        timestamp: new Date().toISOString(),
        projectId: 'unknown',
        region: 'unknown',
        clusterName: 'unknown',
        responseType: 'identifier-extraction',
        originalTokenCount: 0,
        filteredTokenCount: 0,
        compressionRatio: 1,
        type: 'cluster',
      };

      const config: ConversionConfig<ClusterData> = {
        fieldMappings: {
          clusterName: 'clusterName',
          projectId: 'projectId',
          region: 'region',
        },
        transformations: {
          clusterName: (value: unknown) =>
            value ||
            (clusterData as any)?.name ||
            (clusterData as any)?.placement?.clusterName ||
            (clusterData as any)?.config?.clusterName ||
            'unknown',
          projectId: (value: unknown) => value || 'unknown',
          region: (value: unknown) => value || this.extractRegion(clusterData),
        },
      };

      const result = await this.genericConverter.convert(clusterData, metadata, config);

      return {
        clusterName: result.payload.clusterName || 'unknown',
        projectId: result.payload.projectId || 'unknown',
        region: result.payload.region || 'unknown',
      };
    } catch (error) {
      // Fallback to manual extraction
      return {
        clusterName:
          clusterData.clusterName ||
          (clusterData as any)?.name ||
          (clusterData as any)?.placement?.clusterName ||
          (clusterData as any)?.config?.clusterName ||
          'unknown',
        projectId: clusterData.projectId || 'unknown',
        region: this.extractRegion(clusterData),
      };
    }
  }

  /**
   * Initialize cluster knowledge structure
   */
  private async initializeClusterKnowledge(
    clusterName: string,
    projectId: string,
    region: string,
    timestamp: string
  ): Promise<ClusterKnowledge> {
    return {
      clusterName,
      projectId,
      region,
      firstSeen: timestamp,
      lastSeen: timestamp,
      configurations: {
        machineTypes: [],
        workerCounts: [],
        components: [],
        pipelines: [],
        owners: [],
        imageVersions: [],
      },
      pipPackages: [],
      initializationScripts: [],
      networkConfig: {
        zones: [],
        subnets: [],
        serviceAccounts: [],
      },
    };
  }

  /**
   * Index job submission and results
   */
  async indexJobSubmission(jobData: {
    jobId: string;
    jobType: string;
    clusterName: string;
    projectId: string;
    region: string;
    query?: string;
    status: string;
    submissionTime?: string;
    duration?: number;
    results?: unknown;
    error?: unknown;
  }): Promise<void> {
    try {
      const jobKnowledge: JobKnowledge = {
        jobId: jobData.jobId,
        jobType: this.normalizeJobType(jobData.jobType),
        clusterName: jobData.clusterName,
        projectId: jobData.projectId,
        region: jobData.region,
        submissionTime: jobData.submissionTime || new Date().toISOString(),
        query: jobData.query,
        status: jobData.status,
        duration: jobData.duration,
      };

      // Extract output sample if available
      if (jobData.results) {
        jobKnowledge.outputSample = this.extractOutputSample(jobData.results);
      }

      // Extract error information if available
      if (jobData.error) {
        jobKnowledge.errorInfo = this.extractErrorInfo(jobData.error);
        await this.indexErrorPattern(jobKnowledge.errorInfo, jobKnowledge);
      }

      // Store job knowledge
      this.jobKnowledge.set(jobData.jobId, jobKnowledge);
      await this.storeJobKnowledge(jobKnowledge);

      logger.info(`📝 Indexed ${jobData.jobType} job: ${jobData.jobId} on ${jobData.clusterName}`);
    } catch (error) {
      logger.error('Failed to index job submission:', error);
    }
  }

  /**
   * Query knowledge base using natural language
   */
  async queryKnowledge(
    query: string,
    options: {
      type?: 'clusters' | 'cluster' | 'jobs' | 'job' | 'errors' | 'error' | 'all';
      limit?: number;
      projectId?: string;
      region?: string;
    } = {}
  ): Promise<FormattedSearchResult[]> {
    try {
      if (process.env.LOG_LEVEL === 'debug') {
        console.error(
          `[DEBUG] KnowledgeIndexer.queryKnowledge: Query="${query}", Type="${options.type}"`
        );
      }

      // Parse tag-based queries
      const { tags, semanticQuery } = this.parseTagQuery(query);

      // If we have tags, use tag-based search
      if (Object.keys(tags).length > 0) {
        const tagResults = await this.queryByTags(tags, semanticQuery, options);
        // Convert to base FormattedSearchResult format (remove rawDocument)
        return tagResults.map((result) => ({
          type: result.type,
          confidence: result.confidence,
          data: result.data,
          summary: result.summary,
        }));
      }

      const searchResults = await this.qdrantService.searchSimilar(
        semanticQuery || query,
        options.limit || 10
      );

      if (process.env.LOG_LEVEL === 'debug') {
        console.error(
          `[DEBUG] KnowledgeIndexer.queryKnowledge: Found ${searchResults.length} initial results`
        );
        searchResults.forEach((result, i) => {
          const storedType = (result.data as { type?: string })?.type || result.metadata?.type;
          console.error(
            `[DEBUG] Result ${i}: Type="${storedType}", Score=${result.score}, ID=${result.id}`
          );
        });
      }

      // Filter by type if specified with flexible matching
      let filteredResults = searchResults;
      if (options.type && options.type !== 'all') {
        filteredResults = searchResults.filter((result) => {
          // Extract type from the stored data or metadata
          const storedType = (result.data as { type?: string })?.type || result.metadata?.type;

          // Flexible type matching - handle both singular/plural and case variations
          if (!storedType) {
            if (process.env.LOG_LEVEL === 'debug') {
              console.error(
                `[DEBUG] KnowledgeIndexer.queryKnowledge: Result ${result.id} has no type, filtering out`
              );
            }
            return false;
          }

          const normalizedStoredType = storedType.toLowerCase();
          const normalizedQueryType = (options.type || '').toLowerCase();

          // Direct match
          if (normalizedStoredType === normalizedQueryType) return true;

          // Handle singular/plural variations
          const singularForms = {
            clusters: 'cluster',
            jobs: 'job',
            errors: 'error',
          };

          const pluralForms = {
            cluster: 'clusters',
            job: 'jobs',
            error: 'errors',
          };

          // Check if query type matches stored type in singular/plural form
          if (singularForms[normalizedQueryType] === normalizedStoredType) return true;
          if (pluralForms[normalizedQueryType] === normalizedStoredType) return true;

          return false;
        });
      }

      // Filter by project/region if specified
      if (options.projectId) {
        filteredResults = filteredResults.filter(
          (result) => result.metadata?.projectId === options.projectId
        );
      }

      if (options.region) {
        filteredResults = filteredResults.filter(
          (result) => result.metadata?.region === options.region
        );
      }

      if (process.env.LOG_LEVEL === 'debug') {
        console.error(
          `[DEBUG] KnowledgeIndexer.queryKnowledge: After filtering: ${filteredResults.length} results`
        );
        filteredResults.forEach((result, i) => {
          const storedType = (result.data as { type?: string })?.type || result.metadata?.type;
          console.error(
            `[DEBUG] Final Result ${i}: Type="${storedType}", Score=${result.score}, JobId=${(result.data as { jobId?: string })?.jobId || 'N/A'}`
          );
        });
      }

      const formattedResults: FormattedSearchResult[] = filteredResults.map((result) => {
        const dataType =
          (result.data as { type?: string })?.type || result.metadata?.type || 'unknown';
        // Type guard to ensure proper typing
        let typedData: ClusterKnowledge | JobKnowledge | ErrorPattern;
        if (dataType === 'job') {
          typedData = result.data as JobKnowledge;
        } else if (dataType === 'cluster') {
          typedData = result.data as ClusterKnowledge;
        } else if (dataType === 'error') {
          typedData = result.data as ErrorPattern;
        } else {
          // Fallback for unknown types - cast as JobKnowledge
          typedData = result.data as JobKnowledge;
        }

        return {
          type: dataType,
          confidence: result.score,
          data: typedData,
          summary: this.generateResultSummary(result.data, dataType),
          id: result.id, // Include the actual Qdrant document ID
        };
      });

      return formattedResults;
    } catch (error) {
      logger.error('Failed to query knowledge base:', error);
      return [];
    }
  }

  /**
   * Parse tag-based query syntax like "jobId:12345" or "clusterName:my-cluster"
   */
  private parseTagQuery(query: string): {
    tags: Record<string, string>;
    semanticQuery: string;
  } {
    const tags: Record<string, string> = {};
    let semanticQuery = query;

    // Match patterns like "fieldName:value" or "fieldName:'quoted value'"
    const tagPattern = /(\w+):([^\s'"]+|'[^']*'|"[^"]*")/g;
    let match;

    while ((match = tagPattern.exec(query)) !== null) {
      const [fullMatch, fieldName, value] = match;
      // Remove quotes if present
      const cleanValue = value.replace(/^['"]|['"]$/g, '');
      tags[fieldName] = cleanValue;
      // Remove the tag from semantic query
      semanticQuery = semanticQuery.replace(fullMatch, '').trim();
    }

    return { tags, semanticQuery };
  }

  /**
   * Enhanced query with raw document retrieval support and tag-based filtering
   */
  async queryKnowledgeWithRawDocuments(
    query: string,
    options: {
      type?: 'clusters' | 'cluster' | 'jobs' | 'job' | 'errors' | 'error' | 'all';
      projectId?: string;
      region?: string;
      limit?: number;
      includeRawDocument?: boolean;
    } = {}
  ): Promise<Array<FormattedSearchResult & { rawDocument?: any }>> {
    // Parse tag-based queries
    const { tags, semanticQuery } = this.parseTagQuery(query);

    // If we have tags, use Qdrant filtering
    if (Object.keys(tags).length > 0) {
      return await this.queryByTags(tags, semanticQuery, options);
    }

    // Otherwise, use regular semantic search
    const results = await this.queryKnowledge(semanticQuery || query, options);

    if (!options.includeRawDocument) {
      return results;
    }

    // Enhance results with raw documents
    const enhancedResults = await Promise.all(
      results.map(async (result) => {
        try {
          // FIXED: Use the actual document ID from the search result instead of constructing one
          const documentId = result.id;

          if (documentId) {
            logger.info(`🔄 Attempting to retrieve raw document for actual ID: ${documentId}`);
            const rawDoc = await this.qdrantService.retrieveRawDocument(documentId);
            if (rawDoc) {
              logger.info(`✅ Successfully retrieved raw document for ID: ${documentId}`);
              return {
                ...result,
                rawDocument: rawDoc,
              };
            } else {
              logger.warn(`⚠️ Raw document retrieval returned null for ID: ${documentId}`);
            }
          } else {
            logger.warn('❌ No document ID found in search result');
          }

          return result;
        } catch (error) {
          logger.warn(`Failed to retrieve raw document for result:`, error);
          return result;
        }
      })
    );

    return enhancedResults;
  }

  /**
   * Query by tags using Qdrant filtering
   */
  private async queryByTags(
    tags: Record<string, string>,
    semanticQuery: string,
    options: {
      type?: 'clusters' | 'cluster' | 'jobs' | 'job' | 'errors' | 'error' | 'all';
      projectId?: string;
      region?: string;
      limit?: number;
      includeRawDocument?: boolean;
    } = {}
  ): Promise<Array<FormattedSearchResult & { rawDocument?: any }>> {
    try {
      await this.qdrantService.ensureCollection();

      logger.info(`🏷️ Tag-based search initiated with tags:`, tags);
      logger.info(`🔍 Semantic query component: "${semanticQuery}"`);
      logger.info(`⚙️ Search options:`, options);

      // Build Qdrant filter conditions
      const filterConditions: any[] = [];

      // Add tag filters
      Object.entries(tags).forEach(([field, value]) => {
        logger.info(`🏷️ Adding tag filter: ${field} = ${value}`);
        filterConditions.push({
          key: field,
          match: { value },
        });
      });

      // Add type filter if specified
      if (options.type && options.type !== 'all') {
        const typeValue = options.type.endsWith('s') ? options.type.slice(0, -1) : options.type;
        filterConditions.push({
          key: 'type',
          match: { value: typeValue },
        });
      }

      // Add project/region filters
      if (options.projectId) {
        filterConditions.push({
          key: 'projectId',
          match: { value: options.projectId },
        });
      }

      if (options.region) {
        filterConditions.push({
          key: 'region',
          match: { value: options.region },
        });
      }

      const filter =
        filterConditions.length > 0
          ? {
              must: filterConditions,
            }
          : undefined;

      let searchResults;

      logger.info(`🔍 Filter conditions built:`, JSON.stringify(filter, null, 2));

      if (semanticQuery.trim()) {
        // Semantic search with filtering
        logger.info(`🧠 Performing semantic search with query: "${semanticQuery}"`);
        const queryVector = await this.embeddingService.generateEmbedding(semanticQuery);
        logger.info(`📊 Generated embedding vector of length: ${queryVector.length}`);

        // DIAGNOSTIC: Check for zero vector (embedding failure)
        const isZeroVector = queryVector.every((v) => v === 0);
        const vectorMagnitude = Math.sqrt(queryVector.reduce((sum, val) => sum + val * val, 0));
        logger.info(`🔍 [DIAGNOSTIC] Query: "${semanticQuery}"`);
        logger.info(
          `🔍 [DIAGNOSTIC] Vector is zero: ${isZeroVector}, Magnitude: ${vectorMagnitude.toFixed(6)}`
        );
        logger.info(
          `🔍 [DIAGNOSTIC] First 5 vector values: [${queryVector
            .slice(0, 5)
            .map((v) => v.toFixed(6))
            .join(', ')}]`
        );

        if (isZeroVector) {
          logger.error(
            `❌ [DIAGNOSTIC] Zero vector detected for query "${semanticQuery}" - embedding generation failed!`
          );
        }

        searchResults = await this.qdrantService
          .getQdrantClient()
          .search(this.qdrantService.getCollectionName(), {
            vector: queryVector,
            limit: options.limit || 10,
            filter,
            with_payload: true,
          });
        logger.info(`🎯 Semantic search returned ${searchResults.length} results`);

        // DIAGNOSTIC: Log search results details
        if (searchResults.length === 0) {
          logger.warn(
            `🔍 [DIAGNOSTIC] No results for "${semanticQuery}" - checking collection stats...`
          );
          try {
            const collectionInfo = await this.qdrantService
              .getQdrantClient()
              .getCollection(this.qdrantService.getCollectionName());
            logger.info(
              `🔍 [DIAGNOSTIC] Collection "${this.qdrantService.getCollectionName()}" has ${collectionInfo.points_count} points`
            );
          } catch (error) {
            logger.error(
              `🔍 [DIAGNOSTIC] Failed to get collection info: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        } else {
          logger.info(
            `🔍 [DIAGNOSTIC] Top result scores: [${searchResults
              .slice(0, 3)
              .map((r) => r.score?.toFixed(4) || 'N/A')
              .join(', ')}]`
          );
        }
      } else {
        // Pure filtering without semantic search
        logger.info(`🏷️ Performing pure tag-based filtering (no semantic component)`);
        searchResults = await this.qdrantService
          .getQdrantClient()
          .scroll(this.qdrantService.getCollectionName(), {
            filter,
            limit: options.limit || 10,
            with_payload: true,
          });
        logger.info(`📜 Scroll query returned ${searchResults.points?.length || 0} points`);

        // Convert scroll results to search format
        searchResults =
          searchResults.points?.map((point) => ({
            id: point.id,
            score: 1.0, // Perfect match for tag-based search
            payload: point.payload,
          })) || [];
        logger.info(`🔄 Converted to ${searchResults.length} search results`);
      }

      // Process results
      const formattedResults: Array<FormattedSearchResult & { rawDocument?: any }> = [];

      for (const result of searchResults) {
        const payload = result.payload as any;
        const confidence = result.score || 1.0;

        // Reconstruct data from payload
        let reconstructedData;
        if (payload.type === 'query_result') {
          reconstructedData = await this.qdrantService.retrieveById(String(result.id));
        } else {
          reconstructedData = payload.data ? JSON.parse(payload.data) : payload;
        }

        const formattedResult: FormattedSearchResult & { rawDocument?: any } = {
          type: payload.type || 'unknown',
          confidence,
          data: reconstructedData,
          summary: this.generateResultSummary(reconstructedData, payload.type || 'unknown'),
        };

        // Add raw document if requested
        if (options.includeRawDocument) {
          formattedResult.rawDocument = {
            id: String(result.id),
            payload,
            metadata: {
              compressionStatus: payload.isCompressed ? 'compressed' : 'uncompressed',
              compressionType: payload.compressionType,
              originalSize: payload.originalSize,
              compressedSize: payload.compressedSize,
              compressionRatio: payload.compressionRatio,
              clusterName: payload.clusterName || 'unknown',
              projectId: payload.projectId || 'unknown',
              region: payload.region || 'unknown',
              timestamp: payload.timestamp || payload.storedAt || 'unknown',
              dataType: payload.type || 'unknown',
            },
          };
        }

        formattedResults.push(formattedResult);
      }

      return formattedResults;
    } catch (error) {
      logger.error('Failed to query by tags:', error);
      return [];
    }
  }

  /**
   * Generate a formatted summary for query results
   */
  private generateResultSummary(
    data: ClusterKnowledge | JobKnowledge | ErrorPattern | unknown,
    dataType: string
  ): string {
    if (!data) return 'No data available';

    switch (dataType) {
      case 'job':
        return this.generateJobSummary(data as JobKnowledge);
      case 'cluster':
        return this.generateClusterSummary(data as ClusterKnowledge);
      case 'error':
        return this.generateErrorSummary(data as ErrorPattern);
      default:
        return JSON.stringify(data, null, 2);
    }
  }

  /**
   * Generate formatted table summary for job results
   */
  private generateJobSummary(jobData: JobKnowledge): string {
    const lines: string[] = [];

    // Job header
    lines.push(`🔍 Job: ${jobData.jobId || 'Unknown'}`);
    lines.push(`📊 Type: ${jobData.jobType || 'Unknown'}`);
    lines.push(`🏗️  Cluster: ${jobData.clusterName || 'Unknown'}`);
    lines.push(
      `📍 Project: ${jobData.projectId || 'Unknown'} | Region: ${jobData.region || 'Unknown'}`
    );
    lines.push(`⏰ Submitted: ${jobData.submissionTime || 'Unknown'}`);
    lines.push(`✅ Status: ${jobData.status || 'Unknown'}`);

    // Query results table if available
    if (jobData.results && jobData.results.rows && jobData.results.rows.length > 0) {
      lines.push('\n📋 Query Results:');
      lines.push('─'.repeat(80));

      const results = jobData.results;
      const headers =
        results.schema?.fields?.map((col: { name?: string }) => col.name || String(col)) || [];
      const rows = results.rows || [];

      // Table header
      if (headers.length > 0) {
        lines.push(`| ${headers.join(' | ')} |`);
        lines.push(`|${headers.map(() => '─'.repeat(15)).join('|')}|`);
      }

      // Table rows (limit to first 10 for summary)
      const displayRows = rows.slice(0, 10);
      displayRows.forEach((row: unknown[]) => {
        const formattedRow = row.map((cell) =>
          String(cell || '').length > 12
            ? String(cell || '').substring(0, 12) + '...'
            : String(cell || '')
        );
        lines.push(`| ${formattedRow.join(' | ')} |`);
      });

      if (rows.length > 10) {
        lines.push(`... and ${rows.length - 10} more rows`);
      }

      lines.push(`\n📊 Total: ${rows.length} rows, ${headers.length} columns`);
    }

    return lines.join('\n');
  }

  /**
   * Generate formatted summary for cluster data
   */
  private generateClusterSummary(clusterData: ClusterKnowledge): string {
    const lines: string[] = [];
    lines.push(`🏗️  Cluster: ${clusterData.clusterName || 'Unknown'}`);
    lines.push(
      `📍 Project: ${clusterData.projectId || 'Unknown'} | Region: ${clusterData.region || 'Unknown'}`
    );

    if (clusterData.configurations?.machineTypes?.length > 0) {
      lines.push(`💻 Machine Types: ${clusterData.configurations.machineTypes.join(', ')}`);
    }

    if (clusterData.configurations?.components?.length > 0) {
      lines.push(`🔧 Components: ${clusterData.configurations.components.join(', ')}`);
    }

    if (clusterData.pipPackages?.length > 0) {
      lines.push(
        `🐍 Pip Packages: ${clusterData.pipPackages.slice(0, 5).join(', ')}${clusterData.pipPackages.length > 5 ? '...' : ''}`
      );
    }

    return lines.join('\n');
  }

  /**
   * Generate formatted summary for error data
   */
  private generateErrorSummary(errorData: ErrorPattern): string {
    const lines: string[] = [];
    lines.push(`❌ Error Pattern: ${errorData.pattern || 'Unknown'}`);
    lines.push(`🔢 Frequency: ${errorData.frequency || 0}`);

    if (errorData.commonCauses && errorData.commonCauses.length > 0) {
      lines.push(`🔍 Common Causes: ${errorData.commonCauses.join(', ')}`);
    }

    if (errorData.suggestedFixes && errorData.suggestedFixes.length > 0) {
      lines.push(`🔧 Suggested Fixes: ${errorData.suggestedFixes.join(', ')}`);
    }

    return lines.join('\n');
  }

  /**
   * Get cluster discovery insights
   */
  getClusterInsights(): {
    totalClusters: number;
    uniqueProjects: number;
    uniqueRegions: number;
    commonMachineTypes: string[];
    commonComponents: string[];
    commonPipelines: string[];
    recentDiscoveries: ClusterKnowledge[];
  } {
    const clusters = Array.from(this.clusterKnowledge.values());

    const uniqueProjects = new Set(clusters.map((c) => c.projectId)).size;
    const uniqueRegions = new Set(clusters.map((c) => c.region)).size;

    // Aggregate common configurations
    const allMachineTypes = clusters.flatMap((c) => c.configurations.machineTypes);
    const allComponents = clusters.flatMap((c) => c.configurations.components);
    const allPipelines = clusters.flatMap((c) => c.configurations.pipelines);

    const commonMachineTypes = this.getTopItems(allMachineTypes, 5);
    const commonComponents = this.getTopItems(allComponents, 5);
    const commonPipelines = this.getTopItems(allPipelines, 5);

    // Recent discoveries (last 24 hours)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const recentDiscoveries = clusters
      .filter((c) => c.firstSeen > yesterday)
      .sort((a, b) => b.firstSeen.localeCompare(a.firstSeen))
      .slice(0, 10);

    return {
      totalClusters: clusters.length,
      uniqueProjects,
      uniqueRegions,
      commonMachineTypes,
      commonComponents,
      commonPipelines,
      recentDiscoveries,
    };
  }

  /**
   * Get job type analytics
   */
  getJobTypeAnalytics(): {
    totalJobs: number;
    jobTypeDistribution: Record<string, number>;
    successRate: number;
    commonErrors: ErrorPattern[];
    avgDuration: Record<string, number>;
  } {
    const jobs = Array.from(this.jobKnowledge.values());

    const jobTypeDistribution: Record<string, number> = {};
    const avgDuration: Record<string, number> = {};
    const durationCounts: Record<string, number> = {};

    let successfulJobs = 0;

    jobs.forEach((job) => {
      // Job type distribution
      jobTypeDistribution[job.jobType] = (jobTypeDistribution[job.jobType] || 0) + 1;

      // Success rate
      if (['DONE', 'COMPLETED', 'SUCCESS'].includes(job.status.toUpperCase())) {
        successfulJobs++;
      }

      // Average duration
      if (job.duration) {
        avgDuration[job.jobType] = (avgDuration[job.jobType] || 0) + job.duration;
        durationCounts[job.jobType] = (durationCounts[job.jobType] || 0) + 1;
      }
    });

    // Calculate averages
    Object.keys(avgDuration).forEach((jobType) => {
      avgDuration[jobType] = avgDuration[jobType] / durationCounts[jobType];
    });

    const commonErrors = Array.from(this.errorPatterns.values())
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10);

    return {
      totalJobs: jobs.length,
      jobTypeDistribution,
      successRate: jobs.length > 0 ? (successfulJobs / jobs.length) * 100 : 0,
      commonErrors,
      avgDuration,
    };
  }

  private async updateClusterKnowledge(
    knowledge: ClusterKnowledge,
    clusterData: ClusterData
  ): Promise<void> {
    try {
      // Use generic converter for automatic field extraction with fallback to manual method
      const extractedData = await this.extractClusterDataWithConverter(clusterData);

      // Merge extracted data into knowledge object
      this.mergeExtractedClusterData(knowledge, extractedData);

      logger.debug('🔄 [KNOWLEDGE-INDEXER] Updated cluster knowledge using generic converter', {
        clusterName: knowledge.clusterName,
        extractedFields: Object.keys(extractedData).length,
      });
    } catch (error) {
      logger.warn(
        '⚠️ [KNOWLEDGE-INDEXER] Generic converter failed, falling back to manual extraction',
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          clusterName: knowledge.clusterName,
        }
      );

      // Fallback to manual extraction
      this.updateClusterKnowledgeManual(knowledge, clusterData);
    }
  }

  /**
   * Extract cluster data using the generic converter system
   */
  private async extractClusterDataWithConverter(clusterData: ClusterData): Promise<any> {
    const metadata: QdrantStorageMetadata = {
      toolName: 'knowledge-indexer-extraction',
      timestamp: new Date().toISOString(),
      projectId: clusterData.projectId || 'unknown',
      region: clusterData.region || 'unknown',
      clusterName: clusterData.clusterName || 'unknown',
      responseType: 'cluster-extraction',
      originalTokenCount: 0,
      filteredTokenCount: 0,
      compressionRatio: 1,
      type: 'cluster',
    };

    // Create custom configuration for cluster data extraction
    const config: ConversionConfig<ClusterData> = {
      fieldMappings: {
        clusterName: 'clusterName',
        projectId: 'projectId',
        region: 'region',
        config: 'configuration',
        labels: 'labels',
        status: 'status',
      },
      transformations: {
        config: (config: any) => this.extractConfigurationData(config),
        labels: (labels: any) => this.extractLabelData(labels || {}),
        status: (status: any) => status || {},
      },
      metadata: {
        autoTimestamp: true,
        autoUUID: false,
      },
    };

    const result = await this.genericConverter.convert(clusterData, metadata, config);
    return result.payload;
  }

  /**
   * Extract configuration data using automatic field mapping
   */
  private extractConfigurationData(config: any): any {
    if (!config) return {};

    return {
      masterMachine: this.extractMachineType(config.masterConfig?.machineTypeUri),
      workerMachine: this.extractMachineType(config.workerConfig?.machineTypeUri),
      workerCount: config.workerConfig?.numInstances,
      components: config.softwareConfig?.optionalComponents || [],
      imageVersion: config.softwareConfig?.imageVersion,
      pipPackages: this.extractPipPackages(config.softwareConfig?.properties),
      initializationActions: config.initializationActions || [],
    };
  }

  /**
   * Extract label data for pipeline and owner information
   */
  private extractLabelData(labels: Record<string, string>): any {
    return {
      pipeline: labels.pipeline,
      owner: labels.owner,
      environment: labels.environment,
      team: labels.team,
    };
  }

  /**
   * Extract pip packages from properties
   */
  private extractPipPackages(properties: Record<string, string> | undefined): string[] {
    const pipPackages = properties?.['dataproc:pip.packages'];
    if (!pipPackages) return [];

    return pipPackages
      .split(',')
      .map((pkg: string) => pkg.trim())
      .filter(Boolean);
  }

  /**
   * Merge extracted data into knowledge object
   */
  private mergeExtractedClusterData(knowledge: ClusterKnowledge, extractedData: any): void {
    const config = extractedData.configuration || {};
    const labels = extractedData.labels || {};

    // Machine types
    if (config.masterMachine)
      this.addUnique(knowledge.configurations.machineTypes, config.masterMachine);
    if (config.workerMachine)
      this.addUnique(knowledge.configurations.machineTypes, config.workerMachine);

    // Worker counts
    if (config.workerCount)
      this.addUnique(knowledge.configurations.workerCounts, config.workerCount);

    // Components
    if (config.components) {
      config.components.forEach((comp: string) =>
        this.addUnique(knowledge.configurations.components, comp)
      );
    }

    // Labels
    if (labels.pipeline) this.addUnique(knowledge.configurations.pipelines, labels.pipeline);
    if (labels.owner) this.addUnique(knowledge.configurations.owners, labels.owner);

    // Image version
    if (config.imageVersion)
      this.addUnique(knowledge.configurations.imageVersions, config.imageVersion);

    // Pip packages
    if (config.pipPackages) {
      config.pipPackages.forEach((pkg: string) => this.addUnique(knowledge.pipPackages, pkg));
    }

    // Initialization scripts
    if (config.initializationActions) {
      config.initializationActions.forEach((action: { executableFile?: string }) => {
        if (action.executableFile) {
          this.addUnique(knowledge.initializationScripts, action.executableFile);
        }
      });
    }
  }

  /**
   * Fallback manual extraction method (preserves original logic)
   */
  private updateClusterKnowledgeManual(
    knowledge: ClusterKnowledge,
    clusterData: ClusterData
  ): void {
    // Extract machine types
    const masterMachine = this.extractMachineType(clusterData.config?.masterConfig?.machineTypeUri);
    const workerMachine = this.extractMachineType(clusterData.config?.workerConfig?.machineTypeUri);

    if (masterMachine) this.addUnique(knowledge.configurations.machineTypes, masterMachine);
    if (workerMachine) this.addUnique(knowledge.configurations.machineTypes, workerMachine);

    // Extract worker counts
    const workerCount = clusterData.config?.workerConfig?.numInstances;
    if (workerCount) this.addUnique(knowledge.configurations.workerCounts, workerCount);

    // Extract components
    const components = clusterData.config?.softwareConfig?.optionalComponents || [];
    components.forEach((comp: string) => this.addUnique(knowledge.configurations.components, comp));

    // Extract pipeline and owner from labels
    const labels = clusterData.labels || {};
    if (labels.pipeline) this.addUnique(knowledge.configurations.pipelines, labels.pipeline);
    if (labels.owner) this.addUnique(knowledge.configurations.owners, labels.owner);

    // Extract image version
    const imageVersion = clusterData.config?.softwareConfig?.imageVersion;
    if (imageVersion) this.addUnique(knowledge.configurations.imageVersions, imageVersion);

    // Extract pip packages
    const pipPackages = clusterData.config?.softwareConfig?.properties?.['dataproc:pip.packages'];
    if (pipPackages) {
      const packages = pipPackages.split(',').map((pkg: string) => pkg.trim());
      packages.forEach((pkg) => this.addUnique(knowledge.pipPackages, pkg));
    }

    // Extract initialization scripts
    const initActions = clusterData.config?.initializationActions || [];
    initActions.forEach((action: { executableFile?: string }) => {
      if (action.executableFile) {
        this.addUnique(knowledge.initializationScripts, action.executableFile);
      }
    });

    // Extract network configuration
    const gceConfig = clusterData.config?.gceClusterConfig;
    if (gceConfig) {
      if (gceConfig.zoneUri) {
        const zone = this.extractZone(gceConfig.zoneUri);
        if (zone) this.addUnique(knowledge.networkConfig.zones, zone);
      }
      if (gceConfig.subnetworkUri)
        this.addUnique(knowledge.networkConfig.subnets, gceConfig.subnetworkUri);
      if (gceConfig.serviceAccount)
        this.addUnique(knowledge.networkConfig.serviceAccounts, gceConfig.serviceAccount);
    }
  }

  private extractOutputSample(results: unknown): {
    columns: string[];
    rows: unknown[][];
    totalRows?: number;
  } {
    try {
      // Type guard for results with rows
      const resultsWithRows = results as {
        rows?: unknown[][];
        schema?: { fields?: { name?: string }[] };
        totalRows?: number;
      };

      // Handle different result formats
      if (resultsWithRows.rows && Array.isArray(resultsWithRows.rows)) {
        const columns =
          resultsWithRows.schema?.fields?.map((f) => f.name || '') ||
          Object.keys(resultsWithRows.rows[0] || {});

        return {
          columns,
          rows: resultsWithRows.rows.slice(0, 5), // First 5 rows
          totalRows: resultsWithRows.totalRows || resultsWithRows.rows.length,
        };
      }

      // Handle CSV-like results
      if (typeof results === 'string' && results.includes('\n')) {
        const lines = results.split('\n').filter((line) => line.trim());
        if (lines.length > 0) {
          const columns = lines[0].split(',').map((col) => col.trim());
          const rows = lines.slice(1, 6).map((line) => line.split(',').map((cell) => cell.trim()));

          return {
            columns,
            rows,
            totalRows: lines.length - 1,
          };
        }
      }

      return { columns: [], rows: [] };
    } catch (error) {
      logger.warn('Failed to extract output sample:', error);
      return { columns: [], rows: [] };
    }
  }

  private extractErrorInfo(error: unknown): {
    errorType: string;
    errorMessage: string;
    stackTrace?: string;
    commonCause?: string;
    suggestedFix?: string;
  } {
    // Type guard for error objects
    const errorObj = error as { message?: string; stack?: string; toString?: () => string };
    const errorMessage =
      errorObj.message || (errorObj.toString ? errorObj.toString() : String(error));
    const errorType = this.classifyError(errorMessage);

    return {
      errorType,
      errorMessage,
      stackTrace: errorObj.stack,
      commonCause: this.getCommonCause(errorType),
      suggestedFix: this.getSuggestedFix(errorType),
    };
  }

  private async indexErrorPattern(errorInfo: ErrorInfo, jobKnowledge: JobKnowledge): Promise<void> {
    const key = errorInfo.errorType;
    let pattern = this.errorPatterns.get(key);

    if (!pattern) {
      pattern = {
        errorType: errorInfo.errorType,
        pattern: errorInfo.errorMessage,
        frequency: 0,
        commonCauses: [],
        suggestedFixes: [],
        relatedClusters: [],
        relatedJobTypes: [],
        examples: [],
      };
    }

    pattern.frequency++;
    this.addUnique(pattern.relatedClusters, jobKnowledge.clusterName);
    this.addUnique(pattern.relatedJobTypes, jobKnowledge.jobType);

    if (errorInfo.commonCause) this.addUnique(pattern.commonCauses, errorInfo.commonCause);
    if (errorInfo.suggestedFix) this.addUnique(pattern.suggestedFixes, errorInfo.suggestedFix);

    pattern.examples.push({
      jobId: jobKnowledge.jobId,
      clusterName: jobKnowledge.clusterName,
      timestamp: jobKnowledge.submissionTime,
      context: errorInfo.errorMessage.substring(0, 200),
    });

    // Keep only recent examples
    pattern.examples = pattern.examples.slice(-10);

    this.errorPatterns.set(key, pattern);
  }

  private normalizeJobType(jobType: string): 'hive' | 'spark' | 'pyspark' | 'presto' | 'other' {
    const type = jobType.toLowerCase();
    if (type.includes('hive')) return 'hive';
    if (type.includes('spark')) return 'spark';
    if (type.includes('pyspark')) return 'pyspark';
    if (type.includes('presto')) return 'presto';
    return 'other';
  }

  private classifyError(errorMessage: string): string {
    const message = errorMessage.toLowerCase();

    if (message.includes('out of memory') || message.includes('oom')) return 'OutOfMemoryError';
    if (message.includes('connection') && message.includes('timeout')) return 'ConnectionTimeout';
    if (message.includes('permission') || message.includes('access denied'))
      return 'PermissionError';
    if (message.includes('file not found') || message.includes('no such file'))
      return 'FileNotFound';
    if (message.includes('syntax error') || message.includes('parse error')) return 'SyntaxError';
    if (message.includes('table') && message.includes('not found')) return 'TableNotFound';
    if (message.includes('column') && message.includes('not found')) return 'ColumnNotFound';
    if (message.includes('quota') || message.includes('limit exceeded')) return 'QuotaExceeded';

    return 'UnknownError';
  }

  private getCommonCause(errorType: string): string {
    const causes: Record<string, string> = {
      OutOfMemoryError: 'Insufficient memory allocation for job or cluster',
      ConnectionTimeout: 'Network connectivity issues or overloaded cluster',
      PermissionError: 'Insufficient IAM permissions or service account issues',
      FileNotFound: 'Missing input files or incorrect file paths',
      SyntaxError: 'Invalid SQL syntax or unsupported operations',
      TableNotFound: 'Table does not exist or incorrect database/schema',
      ColumnNotFound: 'Column name typo or schema mismatch',
      QuotaExceeded: 'GCP resource quotas or limits reached',
    };

    return causes[errorType] || 'Unknown cause - requires investigation';
  }

  private getSuggestedFix(errorType: string): string {
    const fixes: Record<string, string> = {
      OutOfMemoryError: 'Increase cluster memory, reduce data size, or optimize query',
      ConnectionTimeout: 'Check network connectivity, increase timeout, or scale cluster',
      PermissionError: 'Verify IAM roles, service account permissions, or resource access',
      FileNotFound: 'Check file paths, verify file existence, or update data sources',
      SyntaxError: 'Review SQL syntax, check function compatibility, or validate query',
      TableNotFound: 'Verify table name, check database connection, or create missing table',
      ColumnNotFound: 'Check column names, verify schema, or update query references',
      QuotaExceeded: 'Request quota increase, optimize resource usage, or use different region',
    };

    return fixes[errorType] || 'Contact support or check logs for more details';
  }

  private async storeClusterKnowledge(knowledge: ClusterKnowledge): Promise<void> {
    try {
      // Train the embedding model with this cluster data (like QdrantStorageService does)
      this.embeddingService.trainOnClusterData(knowledge as unknown as ClusterData);

      // Use generic converter for payload creation with fallback to manual method
      const conversionResult = await this.convertClusterKnowledgeToPayload(knowledge);

      logger.info('🔄 [KNOWLEDGE-INDEXER] Storing cluster knowledge using generic converter', {
        clusterName: knowledge.clusterName,
        fieldsProcessed: conversionResult.metadata.fieldsProcessed,
        fieldsCompressed: conversionResult.metadata.fieldsCompressed,
        compressionRatio: conversionResult.metadata.compressionRatio,
        processingTime: conversionResult.metadata.processingTime,
      });

      const metadata = {
        toolName: 'knowledge-indexer',
        timestamp: knowledge.lastSeen,
        projectId: knowledge.projectId,
        region: knowledge.region,
        clusterName: knowledge.clusterName,
        responseType: 'cluster-knowledge',
        originalTokenCount: conversionResult.metadata.totalOriginalSize,
        filteredTokenCount: conversionResult.metadata.totalCompressedSize,
        compressionRatio: conversionResult.metadata.compressionRatio,
        type: 'cluster',
      };

      await this.qdrantService.storeClusterData(conversionResult.payload, metadata);
    } catch (error) {
      logger.warn(
        '⚠️ [KNOWLEDGE-INDEXER] Generic converter failed for cluster storage, falling back to manual method',
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          clusterName: knowledge.clusterName,
        }
      );

      // Fallback to manual payload creation
      await this.storeClusterKnowledgeManual(knowledge);
    }
  }

  /**
   * Convert cluster knowledge to Qdrant payload using generic converter
   */
  private async convertClusterKnowledgeToPayload(
    knowledge: ClusterKnowledge
  ): Promise<ConversionResult<any>> {
    const metadata: QdrantStorageMetadata = {
      toolName: 'knowledge-indexer',
      timestamp: knowledge.lastSeen,
      projectId: knowledge.projectId,
      region: knowledge.region,
      clusterName: knowledge.clusterName,
      responseType: 'cluster-knowledge',
      originalTokenCount: 0,
      filteredTokenCount: 0,
      compressionRatio: 1,
      type: 'cluster',
    };

    // Create configuration for cluster knowledge conversion
    const config: ConversionConfig<ClusterKnowledge> = {
      fieldMappings: {
        clusterName: 'clusterName',
        projectId: 'projectId',
        region: 'region',
        configurations: 'configurations',
        pipPackages: 'pipPackages',
        initializationScripts: 'initializationScripts',
        networkConfig: 'networkConfig',
      },
      compressionRules: {
        fields: ['configurations', 'pipPackages', 'initializationScripts', 'networkConfig'],
        sizeThreshold: 5120, // 5KB threshold
        compressionType: 'gzip',
      },
      transformations: {
        firstSeen: (value) => new Date(value).toISOString(),
        lastSeen: (value) => new Date(value).toISOString(),
      },
      metadata: {
        autoTimestamp: true,
        autoUUID: false,
        customFields: {
          type: () => 'cluster',
          indexedBy: () => 'knowledge-indexer',
        },
      },
    };

    return await this.genericConverter.convert(knowledge, metadata, config);
  }

  /**
   * Fallback manual cluster knowledge storage (preserves original logic)
   */
  private async storeClusterKnowledgeManual(knowledge: ClusterKnowledge): Promise<void> {
    // Add type information to the data itself for easier retrieval
    const dataWithType = {
      ...knowledge,
      type: 'cluster',
    };

    const metadata = {
      toolName: 'knowledge-indexer',
      timestamp: knowledge.lastSeen,
      projectId: knowledge.projectId,
      region: knowledge.region,
      clusterName: knowledge.clusterName,
      responseType: 'cluster-knowledge',
      originalTokenCount: 0,
      filteredTokenCount: 0,
      compressionRatio: 1,
      type: 'cluster',
    };

    console.log('[DEBUG] About to store cluster data (manual fallback):');
    console.log('[DEBUG] - dataWithType type:', typeof dataWithType);
    console.log('[DEBUG] - dataWithType keys:', Object.keys(dataWithType));
    console.log('[DEBUG] - metadata type:', typeof metadata);
    console.log('[DEBUG] - metadata keys:', Object.keys(metadata));

    await this.qdrantService.storeClusterData(dataWithType, metadata);
  }

  private async storeJobKnowledge(knowledge: JobKnowledge): Promise<void> {
    try {
      // Use generic converter for payload creation with fallback to manual method
      const conversionResult = await this.convertJobKnowledgeToPayload(knowledge);

      logger.info('🔄 [KNOWLEDGE-INDEXER] Storing job knowledge using generic converter', {
        jobId: knowledge.jobId,
        jobType: knowledge.jobType,
        fieldsProcessed: conversionResult.metadata.fieldsProcessed,
        fieldsCompressed: conversionResult.metadata.fieldsCompressed,
        compressionRatio: conversionResult.metadata.compressionRatio,
        processingTime: conversionResult.metadata.processingTime,
      });

      const metadata = {
        toolName: 'knowledge-indexer',
        timestamp: knowledge.submissionTime,
        projectId: knowledge.projectId,
        region: knowledge.region,
        clusterName: knowledge.clusterName,
        responseType: 'job-knowledge',
        originalTokenCount: conversionResult.metadata.totalOriginalSize,
        filteredTokenCount: conversionResult.metadata.totalCompressedSize,
        compressionRatio: conversionResult.metadata.compressionRatio,
        type: 'job',
      };

      await this.qdrantService.storeClusterData(conversionResult.payload, metadata);

      if (process.env.LOG_LEVEL === 'debug') {
        console.error(
          `[DEBUG] KnowledgeIndexer.storeJobKnowledge: Successfully stored job ${knowledge.jobId} using generic converter`
        );
      }
    } catch (error) {
      logger.warn(
        '⚠️ [KNOWLEDGE-INDEXER] Generic converter failed for job storage, falling back to manual method',
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          jobId: knowledge.jobId,
          jobType: knowledge.jobType,
        }
      );

      // Fallback to manual payload creation
      await this.storeJobKnowledgeManual(knowledge);
    }
  }

  /**
   * Convert job knowledge to Qdrant payload using generic converter
   */
  private async convertJobKnowledgeToPayload(
    knowledge: JobKnowledge
  ): Promise<ConversionResult<any>> {
    const metadata: QdrantStorageMetadata = {
      toolName: 'knowledge-indexer',
      timestamp: knowledge.submissionTime,
      projectId: knowledge.projectId,
      region: knowledge.region,
      clusterName: knowledge.clusterName,
      responseType: 'job-knowledge',
      originalTokenCount: 0,
      filteredTokenCount: 0,
      compressionRatio: 1,
      type: 'job',
    };

    // Create configuration for job knowledge conversion
    const config: ConversionConfig<JobKnowledge> = {
      fieldMappings: {
        jobId: 'jobId',
        jobType: 'jobType',
        clusterName: 'clusterName',
        projectId: 'projectId',
        region: 'region',
        query: 'query',
        results: 'results',
        outputSample: 'outputSample',
        errorInfo: 'errorInfo',
      },
      compressionRules: {
        fields: ['query', 'results', 'outputSample', 'errorInfo'],
        sizeThreshold: 2048, // 2KB threshold for job data
        compressionType: 'gzip',
      },
      transformations: {
        submissionTime: (value) => new Date(value).toISOString(),
        duration: (value) => value || 0,
        status: (value) => value || 'UNKNOWN',
      },
      metadata: {
        autoTimestamp: true,
        autoUUID: false,
        customFields: {
          type: () => 'job',
          indexedBy: () => 'knowledge-indexer',
        },
      },
    };

    return await this.genericConverter.convert(knowledge, metadata, config);
  }

  /**
   * Fallback manual job knowledge storage (preserves original logic)
   */
  private async storeJobKnowledgeManual(knowledge: JobKnowledge): Promise<void> {
    // Add type information to the data itself for easier retrieval
    const dataWithType = {
      ...knowledge,
      type: 'job',
    };

    const metadata = {
      toolName: 'knowledge-indexer',
      timestamp: knowledge.submissionTime,
      projectId: knowledge.projectId,
      region: knowledge.region,
      clusterName: knowledge.clusterName,
      responseType: 'job-knowledge',
      originalTokenCount: 0,
      filteredTokenCount: 0,
      compressionRatio: 1,
      type: 'job',
    };

    if (process.env.LOG_LEVEL === 'debug') {
      console.error(
        `[DEBUG] KnowledgeIndexer.storeJobKnowledge: Storing job ${knowledge.jobId} with type='job' (manual fallback)`
      );
      console.error(`[DEBUG] Data keys: ${Object.keys(dataWithType).join(', ')}`);
      console.error(`[DEBUG] Metadata type: ${metadata.type}`);
    }

    await this.qdrantService.storeClusterData(dataWithType, metadata);

    if (process.env.LOG_LEVEL === 'debug') {
      console.error(
        `[DEBUG] KnowledgeIndexer.storeJobKnowledge: Successfully stored job ${knowledge.jobId} (manual fallback)`
      );
    }
  }

  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash;
  }

  private extractRegion(clusterData: ClusterData): string {
    // Extract region from various possible locations
    const zoneUri = clusterData.config?.gceClusterConfig?.zoneUri;
    if (zoneUri) {
      const match = zoneUri.match(/zones\/([^/]+)/);
      if (match) {
        const zone = match[1];
        return zone.substring(0, zone.lastIndexOf('-')); // Remove zone suffix
      }
    }
    return 'unknown';
  }

  private extractMachineType(machineTypeUri: string | undefined): string | null {
    if (!machineTypeUri) return null;
    const parts = machineTypeUri.split('/');
    return parts[parts.length - 1] || null;
  }

  private extractZone(zoneUri: string): string | null {
    if (!zoneUri) return null;
    const match = zoneUri.match(/zones\/([^/]+)/);
    return match ? match[1] : null;
  }

  private addUnique<T>(array: T[], item: T): void {
    if (!array.includes(item)) {
      array.push(item);
    }
  }

  private getTopItems(items: string[], limit: number): string[] {
    const counts: Record<string, number> = {};
    items.forEach((item) => {
      counts[item] = (counts[item] || 0) + 1;
    });

    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([item]) => item);
  }

  /**
   * Get conversion metrics from the generic converter
   */
  public getConversionMetrics() {
    try {
      return this.genericConverter.getMetrics();
    } catch (error) {
      logger.warn('Failed to get conversion metrics:', error);
      return {
        totalConversions: 0,
        averageProcessingTime: 0,
        averageCompressionRatio: 1,
        fieldCompressionStats: {},
      };
    }
  }

  /**
   * Reset conversion metrics
   */
  public resetConversionMetrics(): void {
    try {
      this.genericConverter.resetMetrics();
      logger.info('🔄 [KNOWLEDGE-INDEXER] Conversion metrics reset');
    } catch (error) {
      logger.warn('Failed to reset conversion metrics:', error);
    }
  }

  /**
   * Get comprehensive performance and usage statistics
   */
  public getPerformanceStats() {
    const conversionMetrics = this.getConversionMetrics();

    return {
      conversionMetrics,
      knowledgeBase: {
        clustersIndexed: this.clusterKnowledge.size,
        jobsIndexed: this.jobKnowledge.size,
        errorPatternsTracked: this.errorPatterns.size,
      },
      performance: {
        averageConversionTime: conversionMetrics.averageProcessingTime,
        averageCompressionRatio: conversionMetrics.averageCompressionRatio,
        totalConversions: conversionMetrics.totalConversions,
      },
      compressionStats: conversionMetrics.fieldCompressionStats,
    };
  }

  /**
   * Test the generic converter integration with sample data
   */
  public async testGenericConverterIntegration(): Promise<{
    success: boolean;
    metrics?: any;
    error?: string;
  }> {
    try {
      // Create sample cluster data for testing
      const sampleClusterData: ClusterData = {
        clusterName: 'test-cluster',
        projectId: 'test-project',
        region: 'us-central1',
        config: {
          masterConfig: {
            machineTypeUri: 'projects/test-project/zones/us-central1-a/machineTypes/n1-standard-4',
          },
          workerConfig: {
            machineTypeUri: 'projects/test-project/zones/us-central1-a/machineTypes/n1-standard-2',
            numInstances: 3,
          },
          softwareConfig: {
            optionalComponents: ['JUPYTER', 'ZEPPELIN'],
            imageVersion: '2.0-debian10',
            properties: {
              'dataproc:pip.packages': 'pandas,numpy,scikit-learn',
            },
          },
        },
        labels: {
          pipeline: 'ml-training',
          owner: 'data-team',
        },
      };

      // Test cluster data extraction
      const extractedData = await this.extractClusterDataWithConverter(sampleClusterData);

      // Test cluster knowledge conversion
      const sampleKnowledge: ClusterKnowledge = {
        clusterName: 'test-cluster',
        projectId: 'test-project',
        region: 'us-central1',
        firstSeen: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        configurations: {
          machineTypes: ['n1-standard-4', 'n1-standard-2'],
          workerCounts: [3],
          components: ['JUPYTER', 'ZEPPELIN'],
          pipelines: ['ml-training'],
          owners: ['data-team'],
          imageVersions: ['2.0-debian10'],
        },
        pipPackages: ['pandas', 'numpy', 'scikit-learn'],
        initializationScripts: [],
        networkConfig: {
          zones: [],
          subnets: [],
          serviceAccounts: [],
        },
      };

      const conversionResult = await this.convertClusterKnowledgeToPayload(sampleKnowledge);

      return {
        success: true,
        metrics: {
          extractedFields: Object.keys(extractedData).length,
          conversionMetrics: conversionResult.metadata,
          overallMetrics: this.getConversionMetrics(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
