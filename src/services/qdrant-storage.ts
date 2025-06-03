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

export interface QdrantConfig {
  url: string;
  apiKey?: string;
  collectionName: string;
  vectorSize: number;
  distance: 'Cosine' | 'Euclidean' | 'Dot';
}

export class QdrantStorageService {
  private client: QdrantClient;
  private config: QdrantConfig;
  private collectionInitialized = false;
  private embeddingService: TransformersEmbeddingService;

  constructor(config: QdrantConfig) {
    this.config = config;
    this.client = new QdrantClient({
      url: config.url,
      apiKey: config.apiKey,
    });
    this.embeddingService = new TransformersEmbeddingService();
  }

  /**
   * Initialize Qdrant collection if it doesn't exist
   */
  async ensureCollection(): Promise<void> {
    if (this.collectionInitialized) return;

    try {
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
        console.log(`Created Qdrant collection: ${this.config.collectionName}`);
      }

      this.collectionInitialized = true;
    } catch (error) {
      console.error('Failed to initialize Qdrant collection:', error);
      throw new Error(`Qdrant collection initialization failed: ${error}`);
    }
  }

  /**
   * Store cluster data with metadata and return resource URI
   */
  async storeClusterData(data: unknown, metadata: QdrantStorageMetadata): Promise<string> {
    try {
      await this.ensureCollection();

      // Train the embedding model with this cluster data
      this.embeddingService.trainOnClusterData(data as any);

      // Generate a unique ID for this storage
      const id = this.generateId(metadata);

      // Generate embedding vector using the trained model
      const vector = await this.embeddingService.generateClusterEmbedding(data as any);

      // Prepare payload with metadata and data
      const payload = {
        ...metadata,
        data: JSON.stringify(data),
        storedAt: new Date().toISOString(),
      };

      // Store in Qdrant
      await this.client.upsert(this.config.collectionName, {
        wait: true,
        points: [
          {
            id,
            vector,
            payload,
          },
        ],
      });

      const stats = this.embeddingService.getStats();
      logger.info(
        `📊 Stored cluster ${metadata.clusterName} | Model: ${stats.modelName}, ${stats.documentsProcessed} docs processed`
      );

      // Return resource URI for MCP access
      return this.formatResourceUri(id, metadata);
    } catch (error) {
      logger.error('Failed to store data in Qdrant:', error);
      throw new Error(`Qdrant storage failed: ${error}`);
    }
  }

  /**
   * Retrieve data by ID
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
      if (point.payload?.data) {
        return JSON.parse(point.payload.data as string);
      }

      return null;
    } catch (error) {
      console.error('Failed to retrieve data from Qdrant:', error);
      return null;
    }
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

      const queryVector = await this.embeddingService.generateEmbedding(
        typeof queryData === 'string' ? queryData : JSON.stringify(queryData)
      );

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
   */
  private generateId(_metadata: QdrantStorageMetadata): string {
    // Generate a proper UUID for Qdrant
    return globalThis.crypto.randomUUID();
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
}
