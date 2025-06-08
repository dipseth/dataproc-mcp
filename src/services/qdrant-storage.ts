/**
 * QdrantStorageService
 *
 * Handles storage and retrieval of full response data in Qdrant vector database.
 * This service is a key component of the semantic search feature, providing
 * vector storage and similarity search capabilities.
 *
 * KEY FEATURES:
 * - Automatic collection creation and management
 * - Vector embedding storage using Transformers.js
 * - Similarity search with configurable distance metrics
 * - Metadata storage for filtering and context
 * - Graceful error handling and connection management
 *
 * COLLECTIONS MANAGED:
 * - dataproc_knowledge: Extracted cluster knowledge and configurations
 * - dataproc_responses: Full API responses for token optimization
 *
 * VECTOR OPERATIONS:
 * - Store: Converts text to embeddings and stores with metadata
 * - Search: Performs similarity search with confidence scoring
 * - Retrieve: Gets stored data by ID or similarity
 * - Update: Modifies existing vectors and metadata
 *
 * GRACEFUL DEGRADATION:
 * - Detects Qdrant availability automatically
 * - Provides meaningful error messages when unavailable
 * - Allows core functionality to continue without vector storage
 * - Supports optional enhancement pattern
 *
 * CONFIGURATION:
 * - URL: Default http://localhost:6334 (configurable)
 * - Vector Size: 384 dimensions (Transformers.js compatible)
 * - Distance: Cosine similarity (configurable: Cosine, Euclidean, Dot)
 * - Collections: Auto-created with proper vector configuration
 *
 * USAGE PATTERNS:
 * - Called by KnowledgeIndexer to store extracted cluster data
 * - Used by SemanticQueryService for similarity searches
 * - Integrated with ResponseFilter for token optimization
 * - Supports both knowledge base and response caching use cases
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import { QdrantStorageMetadata } from '../types/response-filter.js';
import { TransformersEmbeddingService } from './transformers-embeddings.js';
import { logger } from '../utils/logger.js';
import {
  QdrantPayload,
  QdrantQueryResultPayload,
  QdrantClusterPayload,
  QdrantJobPayload,
  CompressionConfig,
} from '../types/qdrant-payload.js';
import { CompressionService } from './compression.js';
import { GenericQdrantConverter, createGenericConverter } from './generic-converter.js';

export interface QdrantConfig {
  url: string;
  apiKey?: string;
  collectionName: string;
  vectorSize: number;
  distance: 'Cosine' | 'Euclidean' | 'Dot';
  compression?: Partial<CompressionConfig>;
}

export class QdrantStorageService {
  private client: QdrantClient;
  private config: QdrantConfig;
  private collectionInitialized = false;
  private embeddingService: TransformersEmbeddingService;
  private compressionService: CompressionService;
  private genericConverter: GenericQdrantConverter;

  /**
   * Get the Qdrant client for direct access
   */
  public getQdrantClient(): QdrantClient {
    return this.client;
  }

  /**
   * Get the collection name
   */
  public getCollectionName(): string {
    return this.config.collectionName;
  }

  constructor(config: QdrantConfig) {
    this.config = config;
    this.client = new QdrantClient({
      url: config.url,
      apiKey: config.apiKey,
    });
    // Use singleton pattern to prevent multiple Transformers.js instances
    this.embeddingService = TransformersEmbeddingService.getInstance();
    this.compressionService = new CompressionService(config.compression);
    this.genericConverter = createGenericConverter(this.compressionService);
  }

  /**
   * Initialize Qdrant collection if it doesn't exist
   */
  async ensureCollection(): Promise<void> {
    if (this.collectionInitialized) return;

    try {
      // Test basic connectivity first
      await this.client.getCollections();

      // Check if collection exists
      const collections = await this.client.getCollections();
      const exists = collections.collections?.some(
        (col) => col.name === this.config.collectionName
      );

      if (!exists) {
        // Create collection
        await this.client.createCollection(this.config.collectionName, {
          vectors: {
            size: this.config.vectorSize,
            distance: this.config.distance === 'Euclidean' ? 'Euclid' : this.config.distance,
          },
        });
        logger.info(`✅ Created Qdrant collection: ${this.config.collectionName}`);
      } else {
        logger.info(`✅ Qdrant collection exists: ${this.config.collectionName}`);
      }

      this.collectionInitialized = true;
    } catch (error) {
      logger.error('Failed to initialize Qdrant collection:', error);
      throw new Error(`Qdrant collection initialization failed: ${error}`);
    }
  }

  /**
   * Initialize the service and ensure collection is ready
   */
  async initialize(): Promise<void> {
    await this.ensureCollection();
  }

  /**
   * Store cluster data with metadata and return resource URI
   * Enhanced with structured payload and compression support
   */
  async storeClusterData(data: unknown, metadata: QdrantStorageMetadata): Promise<string> {
    try {
      console.log('[DEBUG] storeClusterData called with:');
      console.log('[DEBUG] - data type:', typeof data);
      console.log(
        '[DEBUG] - data keys:',
        data && typeof data === 'object' ? Object.keys(data) : 'N/A'
      );
      console.log('[DEBUG] - metadata type:', typeof metadata);
      console.log('[DEBUG] - metadata keys:', Object.keys(metadata));

      await this.ensureCollection();

      // Train the embedding model with this cluster data
      this.embeddingService.trainOnClusterData(data as any);

      // Generate a unique ID for this storage
      const id = this.generateId(metadata);

      // Generate embedding vector - use local method as fallback for Transformers.js issues
      let vector: number[];
      try {
        const rawVector = await this.embeddingService.generateClusterEmbedding(data as any);

        // Ensure vector is a proper number array (fix for ERR_INVALID_ARG_TYPE)
        if (Array.isArray(rawVector)) {
          vector = rawVector;
        } else if (rawVector && typeof rawVector === 'object' && 'length' in rawVector) {
          // Convert array-like object (Float32Array, etc.) to regular array
          vector = Array.from(rawVector as ArrayLike<number>);
        } else {
          throw new Error('Invalid vector format from embedding service');
        }

        // Validate vector format
        if (!Array.isArray(vector) || vector.length !== this.config.vectorSize) {
          throw new Error(
            `Invalid vector: expected array of length ${this.config.vectorSize}, got ${typeof vector} of length ${vector?.length}`
          );
        }

        // Validate all elements are numbers
        if (!vector.every((v) => typeof v === 'number' && !isNaN(v) && isFinite(v))) {
          throw new Error('Vector contains invalid numeric values');
        }

        // Validate vector is not all zeros (indicates Transformers.js failure)
        const isZeroVector = vector.every((v) => v === 0);
        if (isZeroVector) {
          logger.warn('Transformers.js returned zero vector, using local embedding generation');
          vector = this.generateEmbedding(data);
        }
      } catch (error) {
        logger.warn('Transformers.js embedding failed, using local embedding generation:', error);
        vector = this.generateEmbedding(data);
      }

      // Create structured payload based on data type
      const payload = await this.createStructuredPayload(data, metadata);

      // Store in Qdrant with detailed logging
      logger.info(`🔍 Attempting to store in Qdrant:`);
      logger.info(`   Collection: ${this.config.collectionName}`);
      logger.info(`   ID: ${id} (type: ${typeof id})`);
      logger.info(`   Vector length: ${vector.length} (type: ${typeof vector})`);
      logger.info(`   Vector sample: [${vector.slice(0, 3).join(', ')}...]`);
      logger.info(`   Payload keys: ${Object.keys(payload).join(', ')}`);

      // Sanitize payload to ensure it's properly serializable (fix for ERR_INVALID_ARG_TYPE)
      const sanitizedPayload = this.sanitizePayload(payload);

      // Ensure vector is in the correct format for Qdrant
      const validatedVector = this.validateAndConvertVector(vector);

      const upsertData = {
        wait: true,
        points: [
          {
            id: id, // UUID string (already validated)
            vector: validatedVector, // Properly formatted vector
            payload: sanitizedPayload,
          },
        ],
      };

      logger.debug(`🔍 Full upsert data structure:`, {
        collectionName: this.config.collectionName,
        pointsCount: upsertData.points.length,
        idType: typeof upsertData.points[0].id,
        vectorType: typeof upsertData.points[0].vector,
        vectorLength: upsertData.points[0].vector.length,
        payloadKeys: Object.keys(upsertData.points[0].payload),
      });

      await this.client.upsert(this.config.collectionName, upsertData);

      const stats = this.embeddingService.getStats();
      const compressionInfo = payload.isCompressed
        ? ` | Compressed: ${this.compressionService.formatSize(payload.originalSize || 0)} → ${this.compressionService.formatSize(payload.compressedSize || 0)}`
        : '';

      logger.info(
        `📊 Stored ${metadata.responseType} ${metadata.clusterName} | Model: ${stats.modelName}, ${stats.documentsProcessed} docs processed${compressionInfo}`
      );

      // Return resource URI for MCP access
      return this.formatResourceUri(id, metadata);
    } catch (error) {
      logger.error('Failed to store data in Qdrant:', error);
      throw new Error(`Qdrant storage failed: ${error}`);
    }
  }

  /**
   * Create structured payload based on data type with compression support
   * Now uses the generic converter with fallback to legacy methods
   */
  private async createStructuredPayload(
    data: unknown,
    metadata: QdrantStorageMetadata
  ): Promise<QdrantPayload> {
    // Try generic converter first for supported types
    if (data && typeof data === 'object' && data !== null) {
      try {
        const result = await this.genericConverter.convert(data as Record<string, any>, metadata);

        logger.debug('Used generic converter for payload creation', {
          type: metadata.type,
          responseType: metadata.responseType,
          fieldsProcessed: result.metadata.fieldsProcessed,
          compressionRatio: result.metadata.compressionRatio,
        });

        return result.payload as QdrantPayload;
      } catch (error) {
        logger.warn('Generic converter failed, falling back to legacy methods', {
          error: error instanceof Error ? error.message : String(error),
          type: metadata.type,
          responseType: metadata.responseType,
        });
      }
    }

    // Fallback to legacy conversion methods
    const basePayload = {
      ...metadata,
      storedAt: new Date().toISOString(),
    };

    // Handle different data types with structured payloads (legacy)
    if (metadata.responseType === 'query_results' && metadata.type === 'query_result') {
      return await this.createQueryResultPayload(data, basePayload);
    } else if (metadata.responseType === 'cluster_data' || metadata.type === 'cluster') {
      return await this.createClusterPayload(data, basePayload);
    } else if (metadata.type === 'job' || metadata.responseType === 'job_submission') {
      return await this.createJobPayload(data, basePayload);
    } else {
      // Fallback to legacy format with compression
      return await this.createLegacyPayload(data, basePayload);
    }
  }

  /**
   * Create structured query result payload
   */
  private async createQueryResultPayload(
    data: any,
    basePayload: any
  ): Promise<QdrantQueryResultPayload> {
    const queryData = data as any;

    // Extract structured fields
    const schema = queryData.schema;
    const rows = queryData.rows;
    const summary = queryData.summary;
    const searchableContent = queryData.searchableContent;

    // Compress large data fields if needed (with null/undefined safety)
    const schemaCompression = await this.compressionService.compressIfNeeded(schema || {});
    const rowsCompression = await this.compressionService.compressIfNeeded(rows || []);

    const payload: QdrantQueryResultPayload = {
      ...basePayload,
      jobId: queryData.jobId || basePayload.jobId || 'unknown',
      contentType: queryData.contentType || 'structured_data',
      totalRows: queryData.totalRows || (Array.isArray(rows) ? rows.length : 0),
      schemaFields: queryData.schemaFields || schema?.fields?.length || 0,
      dataSize: queryData.dataSize || JSON.stringify(data).length,

      // Store structured data
      schema: schemaCompression.data,
      rows: rowsCompression.data,
      summary,
      searchableContent,

      // Compression metadata
      isCompressed: schemaCompression.isCompressed || rowsCompression.isCompressed,
      compressionType: schemaCompression.compressionType || rowsCompression.compressionType,
      originalSize: (schemaCompression.originalSize || 0) + (rowsCompression.originalSize || 0),
      compressedSize:
        (schemaCompression.compressedSize || 0) + (rowsCompression.compressedSize || 0),
    };

    return payload;
  }

  /**
   * Create structured cluster payload
   */
  private async createClusterPayload(data: any, basePayload: any): Promise<QdrantClusterPayload> {
    const clusterData = data as any;

    // Extract cluster-specific fields
    const clusterConfig = clusterData.config || clusterData.clusterConfig;
    const machineTypes =
      clusterData.machineTypes ||
      clusterData.config?.masterConfig ||
      clusterData.config?.workerConfig;
    const networkConfig = clusterData.networkConfig || clusterData.config?.networkConfig;
    const softwareConfig = clusterData.softwareConfig || clusterData.config?.softwareConfig;

    // Compress large configuration data (with null/undefined safety)
    const configCompression = await this.compressionService.compressIfNeeded(clusterConfig || {});

    const payload: QdrantClusterPayload = {
      ...basePayload,

      // Store structured data
      clusterConfig: configCompression.data,
      machineTypes,
      networkConfig,
      softwareConfig,

      // Compression metadata
      isCompressed: configCompression.isCompressed,
      compressionType: configCompression.compressionType,
      originalSize: configCompression.originalSize,
      compressedSize: configCompression.compressedSize,
    };

    return payload;
  }

  /**
   * Create structured job payload
   */
  private async createJobPayload(data: any, basePayload: any): Promise<QdrantJobPayload> {
    const jobData = data as any;

    // Compress large results data (with null/undefined safety)
    const resultsCompression = await this.compressionService.compressIfNeeded(
      jobData.results || {}
    );

    const payload: QdrantJobPayload = {
      ...basePayload,
      jobId: jobData.jobId || basePayload.jobId || 'unknown',
      jobType: jobData.jobType || 'unknown',
      status: jobData.status || 'unknown',
      submissionTime: jobData.submissionTime || new Date().toISOString(),
      duration: jobData.duration,
      query: jobData.query,
      results: resultsCompression.data,
      error: jobData.error,

      // Compression metadata
      isCompressed: resultsCompression.isCompressed,
      compressionType: resultsCompression.compressionType,
      originalSize: resultsCompression.originalSize,
      compressedSize: resultsCompression.compressedSize,
    };

    return payload;
  }

  /**
   * Create legacy payload format with compression (for backward compatibility)
   */
  private async createLegacyPayload(data: any, basePayload: any): Promise<QdrantPayload> {
    const dataCompression = await this.compressionService.compressIfNeeded(data);

    const payload: QdrantPayload = {
      ...basePayload,
      data:
        typeof dataCompression.data === 'string'
          ? dataCompression.data
          : JSON.stringify(dataCompression.data),

      // Compression metadata
      isCompressed: dataCompression.isCompressed,
      compressionType: dataCompression.compressionType,
      originalSize: dataCompression.originalSize,
      compressedSize: dataCompression.compressedSize,
    } as QdrantPayload;

    return payload;
  }

  /**
   * Retrieve data by ID with decompression support
   */
  async retrieveById(id: string): Promise<unknown | null> {
    try {
      await this.ensureCollection();

      const result = await this.client.retrieve(this.config.collectionName, {
        ids: [id],
        with_payload: true,
      });

      if (result.length === 0) {
        return null;
      }

      const point = result[0];
      const payload = point.payload as QdrantPayload;

      if (!payload) {
        return null;
      }

      // Robust data reconstruction with comprehensive type handling
      return await this.reconstructDataRobustly(payload, id);
    } catch (error) {
      console.error('Failed to retrieve data from Qdrant:', error);
      return null;
    }
  }

  /**
   * Robust data reconstruction that handles all types and ensures everything has a type
   */
  private async reconstructDataRobustly(payload: any, id: string): Promise<any> {
    try {
      // Step 1: Determine the correct type with intelligent detection
      const detectedType = this.detectDataType(payload);
      
      // Step 2: Attempt structured reconstruction based on detected type
      let reconstructedData = await this.attemptStructuredReconstruction(payload, detectedType);
      
      // Step 3: If structured reconstruction fails, try legacy format
      if (!reconstructedData && payload.data) {
        reconstructedData = await this.attemptLegacyReconstruction(payload);
      }
      
      // Step 4: If all else fails, return raw payload with type correction
      if (!reconstructedData) {
        reconstructedData = await this.createFallbackData(payload, detectedType);
      }
      
      // Step 5: Ensure the result always has a type
      if (reconstructedData && typeof reconstructedData === 'object') {
        reconstructedData.type = detectedType;
        reconstructedData.reconstructionMethod = this.getReconstructionMethod(payload);
        reconstructedData.qdrantId = id;
      }
      
      return reconstructedData;
    } catch (error) {
      console.error(`Failed to reconstruct data for ID ${id}:`, error);
      return {
        type: 'unknown',
        error: 'Reconstruction failed',
        originalPayload: payload,
        qdrantId: id,
        reconstructionMethod: 'error_fallback'
      };
    }
  }

  /**
   * Intelligent type detection based on payload structure and content
   */
  private detectDataType(payload: any): string {
    // Priority 1: Explicit type in payload
    if (payload.type) {
      return payload.type;
    }
    
    // Priority 2: Detect by structure signatures
    if ('schema' in payload && 'rows' in payload) {
      return 'query_result';
    }
    
    if ('clusterConfig' in payload || 'clusterName' in payload) {
      return 'cluster';
    }
    
    if ('jobId' in payload || 'jobType' in payload) {
      return 'job';
    }
    
    if ('errorType' in payload || 'errorMessage' in payload) {
      return 'error';
    }
    
    // Priority 3: Detect by tool name in metadata
    if (payload.toolName && typeof payload.toolName === 'string') {
      if (payload.toolName.includes('cluster') || payload.toolName === 'get_cluster' || payload.toolName === 'list_clusters') {
        return 'cluster';
      }
      if (payload.toolName.includes('job') || payload.toolName.includes('hive') || payload.toolName.includes('spark')) {
        return 'job';
      }
      if (payload.toolName.includes('query')) {
        return 'query_result';
      }
    }
    
    // Priority 4: Detect by response type
    if (payload.responseType && typeof payload.responseType === 'string') {
      if (payload.responseType.includes('cluster')) {
        return 'cluster';
      }
      if (payload.responseType.includes('job')) {
        return 'job';
      }
      if (payload.responseType.includes('query')) {
        return 'query_result';
      }
    }
    
    // Priority 5: Analyze data content if available
    if (payload.data) {
      try {
        const dataStr = typeof payload.data === 'string' ? payload.data : JSON.stringify(payload.data);
        if (dataStr.includes('clusterName') || dataStr.includes('clusterUuid')) {
          return 'cluster';
        }
        if (dataStr.includes('jobId') || dataStr.includes('jobType')) {
          return 'job';
        }
        if (dataStr.includes('schema') && dataStr.includes('rows')) {
          return 'query_result';
        }
      } catch (e) {
        // Ignore parsing errors
      }
    }
    
    return 'unknown';
  }

  /**
   * Attempt structured reconstruction based on detected type
   */
  private async attemptStructuredReconstruction(payload: any, type: string): Promise<any> {
    try {
      switch (type) {
        case 'query_result':
          if ('schema' in payload) {
            return await this.reconstructQueryResult(payload as QdrantQueryResultPayload);
          }
          break;
          
        case 'cluster':
          if ('clusterConfig' in payload) {
            return await this.reconstructClusterData(payload as QdrantClusterPayload);
          }
          break;
          
        case 'job':
          if ('jobId' in payload) {
            return await this.reconstructJobData(payload as QdrantJobPayload);
          }
          break;
          
        default:
          // For unknown types, try to reconstruct as generic data
          return await this.reconstructGenericData(payload);
      }
    } catch (error) {
      console.warn(`Structured reconstruction failed for type ${type}:`, error);
    }
    
    return null;
  }

  /**
   * Attempt legacy format reconstruction
   */
  private async attemptLegacyReconstruction(payload: any): Promise<any> {
    try {
      return await this.compressionService.decompressIfNeeded(
        payload.data,
        payload.isCompressed || false,
        payload.compressionType
      );
    } catch (error) {
      console.warn('Legacy reconstruction failed:', error);
      return null;
    }
  }

  /**
   * Create fallback data when all reconstruction methods fail
   */
  private async createFallbackData(payload: any, type: string): Promise<any> {
    return {
      type,
      fallbackData: true,
      availableFields: Object.keys(payload),
      metadata: {
        projectId: payload.projectId,
        region: payload.region,
        clusterName: payload.clusterName,
        jobId: payload.jobId,
        toolName: payload.toolName,
        responseType: payload.responseType,
        timestamp: payload.timestamp,
        storedAt: payload.storedAt
      },
      rawPayload: payload
    };
  }

  /**
   * Reconstruct generic data for unknown types
   */
  private async reconstructGenericData(payload: any): Promise<any> {
    const result: any = {
      type: payload.type || 'generic',
      timestamp: payload.timestamp,
      storedAt: payload.storedAt,
      toolName: payload.toolName,
      responseType: payload.responseType
    };
    
    // Copy all non-system fields
    const systemFields = ['isCompressed', 'compressionType', 'originalSize', 'compressedSize'];
    for (const [key, value] of Object.entries(payload)) {
      if (!systemFields.includes(key) && value !== undefined) {
        result[key] = value;
      }
    }
    
    return result;
  }

  /**
   * Get the reconstruction method used
   */
  private getReconstructionMethod(payload: any): string {
    if ('schema' in payload && 'rows' in payload) {
      return 'structured_query_result';
    }
    if ('clusterConfig' in payload) {
      return 'structured_cluster';
    }
    if ('jobId' in payload && 'jobType' in payload) {
      return 'structured_job';
    }
    if (payload.data) {
      return 'legacy_decompression';
    }
    return 'fallback_generic';
  }

  /**
   * Reconstruct query result from structured payload
   */
  private async reconstructQueryResult(payload: QdrantQueryResultPayload): Promise<any> {
    const schema = await this.compressionService.decompressIfNeeded(
      payload.schema,
      payload.isCompressed || false,
      payload.compressionType
    );

    const rows = await this.compressionService.decompressIfNeeded(
      payload.rows,
      payload.isCompressed || false,
      payload.compressionType
    );

    return {
      jobId: payload.jobId,
      projectId: payload.projectId,
      region: payload.region,
      timestamp: payload.timestamp,
      contentType: payload.contentType,
      totalRows: payload.totalRows,
      schemaFields: payload.schemaFields,
      dataSize: payload.dataSize,
      schema,
      rows,
      summary: payload.summary,
      searchableContent: payload.searchableContent,
    };
  }

  /**
   * Reconstruct cluster data from structured payload
   */
  private async reconstructClusterData(payload: QdrantClusterPayload): Promise<any> {
    const clusterConfig = await this.compressionService.decompressIfNeeded(
      payload.clusterConfig,
      payload.isCompressed || false,
      payload.compressionType
    );

    return {
      clusterName: payload.clusterName,
      projectId: payload.projectId,
      region: payload.region,
      config: clusterConfig,
      clusterConfig,
      machineTypes: payload.machineTypes,
      networkConfig: payload.networkConfig,
      softwareConfig: payload.softwareConfig,
    };
  }

  /**
   * Reconstruct job data from structured payload
   */
  private async reconstructJobData(payload: QdrantJobPayload): Promise<any> {
    const results = await this.compressionService.decompressIfNeeded(
      payload.results,
      payload.isCompressed || false,
      payload.compressionType
    );

    return {
      jobId: payload.jobId,
      jobType: payload.jobType,
      clusterName: payload.clusterName,
      projectId: payload.projectId,
      region: payload.region,
      status: payload.status,
      submissionTime: payload.submissionTime,
      duration: payload.duration,
      query: payload.query,
      results,
      error: payload.error,
    };
  }

  /**
   * Search for similar responses
   */
  async searchSimilar(
    queryData: unknown,
    limit: number = 5,
    scoreThreshold: number = 0.0
  ): Promise<Array<{ id: string; score: number; metadata: QdrantStorageMetadata; data: unknown }>> {
    try {
      await this.ensureCollection();

      // Generate query vector with fallback for Transformers.js issues
      let queryVector: number[];
      try {
        if (typeof queryData === 'string') {
          queryVector = await this.embeddingService.generateEmbedding(queryData);
        } else {
          queryVector = await this.embeddingService.generateClusterEmbedding(queryData as any);
        }

        // Validate vector is not all zeros (indicates Transformers.js failure)
        const isZeroVector = queryVector.every((v) => v === 0);
        if (isZeroVector) {
          logger.warn(
            'Transformers.js returned zero vector for search, using local embedding generation'
          );
          queryVector = this.generateEmbedding(queryData);
        }
      } catch (error) {
        logger.warn(
          'Transformers.js embedding failed for search, using local embedding generation:',
          error
        );
        queryVector = this.generateEmbedding(queryData);
      }

      const searchResult = await this.client.search(this.config.collectionName, {
        vector: queryVector,
        limit,
        score_threshold: scoreThreshold,
        with_payload: true,
      });

      return searchResult.map((point) => ({
        id: String(point.id),
        score: point.score || 0,
        metadata: point.payload as unknown as QdrantStorageMetadata,
        data: point.payload?.data ? JSON.parse(point.payload.data as string) : null,
      }));
    } catch (error) {
      console.error('Failed to search Qdrant:', error);
      return [];
    }
  }

  /**
   * Retrieve raw Qdrant document with full payload (for enhanced query_knowledge tool)
   */
  async retrieveRawDocument(id: string): Promise<{
    id: string;
    payload: QdrantPayload;
    vector?: number[];
    metadata?: {
      compressionStatus: 'compressed' | 'uncompressed';
      compressionType?: string;
      originalSize?: number;
      compressedSize?: number;
      compressionRatio?: number;
      clusterName: string;
      projectId: string;
      region: string;
      timestamp: string;
      dataType: string;
    };
  } | null> {
    try {
      await this.ensureCollection();

      logger.info(
        `🔍 Attempting to retrieve raw document with ID: ${id} from collection: ${this.config.collectionName}`
      );

      const result = await this.client.retrieve(this.config.collectionName, {
        ids: [id],
        with_payload: true,
        with_vector: true,
      });

      logger.info(`📊 Qdrant retrieve result: found ${result.length} documents`);

      if (result.length === 0) {
        logger.warn(`❌ No document found with ID: ${id}`);
        return null;
      }

      const point = result[0];
      const payload = point.payload as QdrantPayload;

      logger.debug(`📄 Retrieved payload type: ${payload?.type || 'unknown'}`);
      logger.debug(`📄 Payload keys: ${payload ? Object.keys(payload).join(', ') : 'none'}`);

      if (!payload) {
        logger.warn(`❌ Retrieved document has no payload for ID: ${id}`);
        return null;
      }

      // Extract metadata
      const metadata = {
        compressionStatus: payload.isCompressed
          ? ('compressed' as const)
          : ('uncompressed' as const),
        compressionType: payload.compressionType,
        originalSize: payload.originalSize,
        compressedSize: payload.compressedSize,
        compressionRatio: payload.compressionRatio,
        clusterName: payload.clusterName || 'unknown',
        projectId: payload.projectId || 'unknown',
        region: payload.region || 'unknown',
        timestamp: payload.timestamp || payload.storedAt || 'unknown',
        dataType: payload.type || 'unknown',
      };

      return {
        id: String(point.id),
        payload,
        vector: point.vector as number[],
        metadata,
      };
    } catch (error) {
      console.error('Failed to retrieve raw document from Qdrant:', error);
      return null;
    }
  }

  /**
   * Delete stored data by ID
   */
  async deleteById(id: string): Promise<boolean> {
    try {
      await this.ensureCollection();

      await this.client.delete(this.config.collectionName, {
        wait: true,
        points: [id],
      });

      return true;
    } catch (error) {
      console.error('Failed to delete from Qdrant:', error);
      return false;
    }
  }

  /**
   * Get collection statistics
   */
  async getStats(): Promise<unknown> {
    try {
      await this.ensureCollection();

      const info = await this.client.getCollection(this.config.collectionName);
      return {
        pointsCount: info.points_count,
        vectorsCount: info.vectors_count,
        indexedVectorsCount: info.indexed_vectors_count,
        status: info.status,
      };
    } catch (error) {
      console.error('Failed to get Qdrant stats:', error);
      return null;
    }
  }

  /**
   * Clean up old entries based on TTL
   */
  async cleanup(maxAgeHours: number = 24): Promise<number> {
    try {
      await this.ensureCollection();

      const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000).toISOString();

      // Search for old entries
      const oldEntries = await this.client.scroll(this.config.collectionName, {
        filter: {
          must: [
            {
              range: {
                key: 'storedAt',
                lt: cutoffTime,
              },
            },
          ],
        },
        limit: 1000,
        with_payload: false,
      });

      if (oldEntries.points.length === 0) {
        return 0;
      }

      // Delete old entries
      const idsToDelete = oldEntries.points.map((point) => String(point.id));
      await this.client.delete(this.config.collectionName, {
        wait: true,
        points: idsToDelete,
      });

      console.log(`Cleaned up ${idsToDelete.length} old Qdrant entries`);
      return idsToDelete.length;
    } catch (error) {
      console.error('Failed to cleanup Qdrant:', error);
      return 0;
    }
  }

  /**
   * Generate a unique ID for storage
   * Qdrant requires IDs to be either unsigned integers or UUIDs
   */
  private generateId(_metadata: QdrantStorageMetadata): string {
    // DIAGNOSTIC: Log ID generation
    const uuid = globalThis.crypto.randomUUID();
    console.log('[DEBUG] generateId called - generating UUID:', uuid);
    console.log('[DEBUG] ID type:', typeof uuid);
    console.log(
      '[DEBUG] ID format validation:',
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid)
    );

    // Generate a proper UUID for Qdrant (required format)
    return uuid;
  }

  /**
   * Generate embedding vector from data (simple hash-based approach for prototype)
   * In production, this should use a proper embedding model
   */
  private generateEmbedding(data: unknown): number[] {
    const text = JSON.stringify(data);
    const vector = new Array(this.config.vectorSize).fill(0);

    // Simple hash-based embedding generation
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      const index = charCode % this.config.vectorSize;
      vector[index] += Math.sin(charCode * 0.1) * 0.1;
    }

    // Normalize vector
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      for (let i = 0; i < vector.length; i++) {
        vector[i] /= magnitude;
      }
    }

    return vector;
  }

  /**
   * Format resource URI for MCP access
   */
  private formatResourceUri(id: string, metadata: QdrantStorageMetadata): string {
    const parts = ['dataproc', 'stored', metadata.toolName];

    if (metadata.projectId) parts.push(metadata.projectId);
    if (metadata.region) parts.push(metadata.region);
    if (metadata.clusterName) parts.push(metadata.clusterName);

    parts.push(id);

    return parts.join('/');
  }

  /**
   * Parse resource URI to extract ID and metadata
   */
  parseResourceUri(uri: string): { id: string; metadata: Partial<QdrantStorageMetadata> } | null {
    try {
      const parts = uri.split('/');

      if (parts.length < 4 || parts[0] !== 'dataproc' || parts[1] !== 'stored') {
        return null;
      }

      const id = parts[parts.length - 1];
      const toolName = parts[2];

      const metadata: Partial<QdrantStorageMetadata> = { toolName };

      if (parts.length > 4) metadata.projectId = parts[3];
      if (parts.length > 5) metadata.region = parts[4];
      if (parts.length > 6) metadata.clusterName = parts[5];

      return { id, metadata };
    } catch (error) {
      console.error('Failed to parse resource URI:', error);
      return null;
    }
  }

  /**
   * Validate and convert vector to ensure it's in the correct format for Qdrant
   */
  private validateAndConvertVector(vector: number[]): number[] {
    // Ensure vector is a proper array of numbers
    if (!Array.isArray(vector)) {
      throw new Error(`Vector must be an array, got ${typeof vector}`);
    }

    if (vector.length !== this.config.vectorSize) {
      throw new Error(`Vector length must be ${this.config.vectorSize}, got ${vector.length}`);
    }

    // Ensure all elements are finite numbers
    const validatedVector = vector.map((value, index) => {
      if (typeof value !== 'number' || !isFinite(value)) {
        throw new Error(
          `Vector element at index ${index} must be a finite number, got ${typeof value}: ${value}`
        );
      }
      return Number(value); // Ensure it's a proper number
    });

    return validatedVector;
  }

  /**
   * Sanitize payload to ensure it's properly serializable and doesn't cause ERR_INVALID_ARG_TYPE
   */
  private sanitizePayload(payload: any): Record<string, any> {
    try {
      // First, try to serialize and deserialize to catch any circular references
      const serialized = JSON.stringify(payload);
      const deserialized = JSON.parse(serialized);

      // Ensure all values are primitive types or simple objects
      const sanitized: Record<string, any> = {};

      for (const [key, value] of Object.entries(deserialized)) {
        if (value === null || value === undefined) {
          sanitized[key] = value;
        } else if (
          typeof value === 'string' ||
          typeof value === 'number' ||
          typeof value === 'boolean'
        ) {
          sanitized[key] = value;
        } else if (Array.isArray(value)) {
          // Ensure array elements are serializable
          sanitized[key] = value.map((item) =>
            typeof item === 'object' ? JSON.stringify(item) : item
          );
        } else if (typeof value === 'object') {
          // Convert complex objects to strings to avoid serialization issues
          sanitized[key] = JSON.stringify(value);
        } else {
          // Convert anything else to string
          sanitized[key] = String(value);
        }
      }

      return sanitized;
    } catch (error) {
      logger.error('Failed to sanitize payload:', error);
      // Fallback: create a minimal payload
      return {
        toolName: payload.toolName || 'unknown',
        timestamp: payload.timestamp || new Date().toISOString(),
        projectId: payload.projectId || 'unknown',
        region: payload.region || 'unknown',
        clusterName: payload.clusterName || 'unknown',
        responseType: payload.responseType || 'unknown',
        type: payload.type || 'unknown',
        storedAt: new Date().toISOString(),
        data: typeof payload.data === 'string' ? payload.data : JSON.stringify(payload.data || {}),
        error: 'Payload sanitization failed',
      };
    }
  }
  /**
   * Health check for Qdrant connection
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.client.getCollections();
      return true;
    } catch (error) {
      console.error('Qdrant health check failed:', error);
      return false;
    }
  }

  /**
   * Graceful shutdown - cleanup Qdrant client connections
   */
  async shutdown(): Promise<void> {
    logger.info('🔄 [MUTEX-DEBUG] QdrantStorageService: Initiating graceful shutdown');

    try {
      // Reset collection initialization flag
      this.collectionInitialized = false;
      logger.debug('🔄 [MUTEX-DEBUG] QdrantStorageService: Collection initialization flag reset');

      // Shutdown embedding service FIRST to avoid circular dependencies
      if (this.embeddingService) {
        logger.info('🔄 [MUTEX-DEBUG] QdrantStorageService: Shutting down embedding service FIRST');
        try {
          await this.embeddingService.shutdown();
          logger.info('🔄 [MUTEX-DEBUG] QdrantStorageService: Embedding service shutdown SUCCESS');
        } catch (embeddingError) {
          logger.error(
            '🔄 [MUTEX-DEBUG] QdrantStorageService: Embedding service shutdown FAILED:',
            embeddingError
          );
          // Continue with cleanup
        }
        this.embeddingService = null as any;
      }

      // Note: QdrantClient from @qdrant/js-client-rest doesn't expose a close() method
      // but we can clear the client reference to help with garbage collection
      if (this.client) {
        logger.debug('🔄 [MUTEX-DEBUG] QdrantStorageService: Clearing client reference');
        // The client will be garbage collected, which should close any underlying connections
        (this.client as any) = null;
      }

      // Clear other service references
      if (this.compressionService) {
        logger.debug(
          '🔄 [MUTEX-DEBUG] QdrantStorageService: Clearing compression service reference'
        );
        this.compressionService = null as any;
      }

      if (this.genericConverter) {
        logger.debug('🔄 [MUTEX-DEBUG] QdrantStorageService: Clearing generic converter reference');
        this.genericConverter = null as any;
      }

      logger.info('🔄 [MUTEX-DEBUG] QdrantStorageService: Graceful shutdown completed');
    } catch (error) {
      logger.error('🔄 [MUTEX-DEBUG] QdrantStorageService: Error during shutdown:', error);
      // Don't re-throw to prevent cascading failures
      logger.warn(
        '🔄 [MUTEX-DEBUG] Continuing shutdown despite errors to prevent mutex lock issues'
      );
    }
  }
}
