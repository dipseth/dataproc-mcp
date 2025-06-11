/**
 * Modern Embedding Service using Transformers.js
 *
 * Uses state-of-the-art sentence transformers for semantic embeddings
 * with continuous learning capabilities for Dataproc cluster data
 */

import { pipeline } from '@huggingface/transformers';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { getStateFilePath } from '../utils/config-path-resolver.js';
import {
  GenericQdrantConverter,
  createGenericConverter,
  quickConvert,
} from './generic-converter.js';
import { CompressionService } from './compression.js';
import { QdrantStorageMetadata } from '../types/response-filter.js';
import { ClusterConfig } from '../types/cluster-config.js';
import { logger } from '../utils/logger.js';

// Type definitions for better type safety - using unknown for complex Transformers.js types
// Type guard for tensor-like results
interface TensorLike {
  tolist?: () => unknown;
  data?: ArrayLike<number>;
}

function isTensorLike(obj: unknown): obj is TensorLike {
  return typeof obj === 'object' && obj !== null;
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

export interface EmbeddingStats {
  modelName: string;
  documentsProcessed: number;
  lastUpdated: string;
  vectorSize: number;
  cacheSize: number;
}

export interface TrainingData {
  clusterId: string;
  clusterName: string;
  projectId: string;
  region: string;
  extractedText: string;
  timestamp: string;
}

export class TransformersEmbeddingService {
  private static instance: TransformersEmbeddingService | null = null;
  private static instanceCount = 0;

  private pipeline: unknown = null;
  private modelName: string;
  private vectorSize: number;
  private trainingDataPath: string;
  private trainingData: TrainingData[] = [];
  private documentsProcessed: number = 0;
  private isShuttingDown = false;

  // Phase 3: Generic Converter Integration
  private genericConverter: GenericQdrantConverter;
  private compressionService: CompressionService;

  constructor(
    modelName: string = 'Xenova/all-MiniLM-L6-v2', // 384-dimensional embeddings
    trainingDataPath?: string
  ) {
    TransformersEmbeddingService.instanceCount++;
    logger.info(
      `🔄 [MUTEX-DEBUG] TransformersEmbeddingService instance #${TransformersEmbeddingService.instanceCount} created`
    );

    this.modelName = modelName;
    this.vectorSize = 384; // Standard for all-MiniLM-L6-v2
    this.trainingDataPath = trainingDataPath || getStateFilePath('embedding-training-data.json');

    // Phase 3: Initialize Generic Converter Integration
    this.compressionService = new CompressionService();
    this.genericConverter = createGenericConverter(this.compressionService);

    this.loadTrainingData();
  }

  /**
   * Get singleton instance to prevent multiple Transformers.js models
   */
  public static getInstance(
    modelName: string = 'Xenova/all-MiniLM-L6-v2',
    trainingDataPath?: string
  ): TransformersEmbeddingService {
    if (!TransformersEmbeddingService.instance) {
      logger.info('🔄 [MUTEX-DEBUG] Creating singleton TransformersEmbeddingService instance');
      TransformersEmbeddingService.instance = new TransformersEmbeddingService(
        modelName,
        trainingDataPath
      );
    } else {
      logger.info('🔄 [MUTEX-DEBUG] Reusing existing TransformersEmbeddingService singleton');
    }
    return TransformersEmbeddingService.instance;
  }

  /**
   * Clear singleton instance (for testing)
   */
  public static clearInstance(): void {
    logger.info('🔄 [MUTEX-DEBUG] Clearing TransformersEmbeddingService singleton instance');
    TransformersEmbeddingService.instance = null;
    TransformersEmbeddingService.instanceCount = 0;
  }

  /**
   * Initialize the embedding pipeline (lazy loading)
   */
  private async initializePipeline(): Promise<void> {
    if (this.pipeline === null) {
      logger.info(`🤖 Loading Transformers.js model: ${this.modelName}`);

      try {
        this.pipeline = (await pipeline('feature-extraction', this.modelName, {
          // Use quantized model for better performance
          dtype: 'q8',
          // Cache models locally
          cache_dir: getStateFilePath('transformers-cache'),
        })) as unknown;

        logger.info(`✅ Model loaded successfully: ${this.modelName}`);
      } catch (error) {
        logger.error('Failed to load Transformers.js model:', error);
        throw new Error(`Failed to initialize embedding model: ${error}`);
      }
    }
  }

  /**
   * Load existing training data
   */
  private loadTrainingData(): void {
    if (existsSync(this.trainingDataPath)) {
      try {
        const data = readFileSync(this.trainingDataPath, 'utf8');
        const parsed = JSON.parse(data);
        this.trainingData = parsed.trainingData || [];
        this.documentsProcessed = parsed.documentsProcessed || 0;

        logger.info(`📚 Loaded ${this.trainingData.length} training examples`);
      } catch (error) {
        logger.warn('Failed to load training data, starting fresh:', error);
        this.trainingData = [];
        this.documentsProcessed = 0;
      }
    }
  }

  /**
   * Save training data to disk
   */
  private saveTrainingData(): void {
    try {
      const data = {
        trainingData: this.trainingData,
        documentsProcessed: this.documentsProcessed,
        lastUpdated: new Date().toISOString(),
        modelName: this.modelName,
      };

      writeFileSync(this.trainingDataPath, JSON.stringify(data, null, 2));
      logger.debug('💾 Training data saved');
    } catch (error) {
      logger.error('Failed to save training data:', error);
    }
  }

  /**
   * Extract comprehensive text from cluster data for embedding
   * Phase 3: Enhanced with Generic Converter Integration
   */
  private async extractClusterText(clusterData: ClusterData): Promise<string> {
    const startTime = Date.now();

    try {
      // Phase 3: Use quickConvert for automatic text extraction
      const metadata: QdrantStorageMetadata = {
        toolName: 'extractClusterText',
        timestamp: new Date().toISOString(),
        responseType: 'text_extraction',
        originalTokenCount: 0,
        filteredTokenCount: 0,
        compressionRatio: 1.0,
        type: 'text_extraction',
      };

      const conversionResult = await quickConvert(
        clusterData as Record<string, any>,
        metadata,
        this.compressionService
      );
      const payload = conversionResult.payload as any;

      const textParts: string[] = [];

      // Extract text using converted payload with intelligent field mapping
      if (payload.clusterName) textParts.push(`cluster ${payload.clusterName}`);
      if (payload.projectId) textParts.push(`project ${payload.projectId}`);
      if (payload.region) textParts.push(`region ${payload.region}`);

      // Labels - very important for semantic search
      if (payload.labels) {
        Object.entries(payload.labels).forEach(([key, value]) => {
          textParts.push(`${key} ${value}`);
        });
      }

      // Software configuration - enhanced extraction
      const softwareConfig = payload.config?.softwareConfig || payload.softwareConfig;
      if (softwareConfig?.properties) {
        Object.entries(softwareConfig.properties).forEach(([key, value]) => {
          if (key.includes('pip.packages') && typeof value === 'string') {
            // Extract package names for better semantic matching
            const packages = value.split(',').map((pkg: string) => {
              const [name] = pkg.trim().split('==');
              return name.trim();
            });
            textParts.push(`python packages: ${packages.join(' ')}`);
            textParts.push(`pip install ${packages.join(' ')}`);
          } else {
            textParts.push(`${key} ${value}`);
          }
        });
      }

      // Machine configuration with automatic field extraction
      const masterConfig = payload.config?.masterConfig || payload.masterConfig;
      const workerConfig = payload.config?.workerConfig || payload.workerConfig;

      if (masterConfig?.machineTypeUri) {
        const machineType = masterConfig.machineTypeUri.split('/').pop();
        if (machineType) {
          textParts.push(`machine type ${machineType}`);
          textParts.push(`compute ${machineType}`);
        }
      }

      if (workerConfig?.machineTypeUri) {
        const machineType = workerConfig.machineTypeUri.split('/').pop();
        if (machineType) {
          textParts.push(`worker machine ${machineType}`);
        }
      }

      // Optional components
      if (softwareConfig?.optionalComponents) {
        softwareConfig.optionalComponents.forEach((comp: string) => {
          textParts.push(`component ${comp.toLowerCase()}`);
          textParts.push(comp.toLowerCase());
        });
      }

      // Network and disk configuration
      if (masterConfig?.diskConfig) {
        const diskConfig = masterConfig.diskConfig;
        if (diskConfig.bootDiskSizeGb) {
          textParts.push(`disk ${diskConfig.bootDiskSizeGb}GB`);
        }
        if (diskConfig.bootDiskType) {
          textParts.push(`disk type ${diskConfig.bootDiskType}`);
        }
      }

      const processingTime = Date.now() - startTime;
      logger.debug(
        `🔄 [TRANSFORMERS-EMBEDDINGS] extractClusterText with generic converter: ${processingTime}ms, compression: ${conversionResult.metadata.compressionRatio.toFixed(2)}`
      );

      return textParts.join(' ');
    } catch (error) {
      logger.warn(
        'Generic converter failed for text extraction, falling back to manual method:',
        error
      );
      return this.extractClusterTextManual(clusterData);
    }
  }

  /**
   * Manual fallback method for text extraction
   */
  private extractClusterTextManual(clusterData: ClusterData): string {
    const textParts: string[] = [];

    // Basic cluster info
    if (clusterData.clusterName) textParts.push(`cluster ${clusterData.clusterName}`);
    if (clusterData.projectId) textParts.push(`project ${clusterData.projectId}`);
    if (clusterData.region) textParts.push(`region ${clusterData.region}`);

    // Labels - very important for semantic search
    if (clusterData.labels) {
      Object.entries(clusterData.labels).forEach(([key, value]) => {
        textParts.push(`${key} ${value}`);
      });
    }

    // Software configuration - the goldmine for pip packages!
    if (clusterData.config?.softwareConfig?.properties) {
      Object.entries(clusterData.config.softwareConfig.properties).forEach(([key, value]) => {
        if (key.includes('pip.packages') && typeof value === 'string') {
          // Extract package names for better semantic matching
          const packages = value.split(',').map((pkg) => {
            const [name] = pkg.trim().split('==');
            return name.trim();
          });
          textParts.push(`python packages: ${packages.join(' ')}`);
          textParts.push(`pip install ${packages.join(' ')}`);
        } else {
          textParts.push(`${key} ${value}`);
        }
      });
    }

    // Machine configuration
    if (clusterData.config?.masterConfig?.machineTypeUri) {
      const machineType = clusterData.config.masterConfig.machineTypeUri.split('/').pop();
      if (machineType) {
        textParts.push(`machine type ${machineType}`);
        textParts.push(`compute ${machineType}`);
      }
    }

    if (clusterData.config?.workerConfig?.machineTypeUri) {
      const machineType = clusterData.config.workerConfig.machineTypeUri.split('/').pop();
      if (machineType) {
        textParts.push(`worker machine ${machineType}`);
      }
    }

    // Optional components
    if (clusterData.config?.softwareConfig?.optionalComponents) {
      clusterData.config.softwareConfig.optionalComponents.forEach((comp: string) => {
        textParts.push(`component ${comp.toLowerCase()}`);
        textParts.push(comp.toLowerCase());
      });
    }

    // Network and disk configuration
    if (clusterData.config?.masterConfig?.diskConfig) {
      const diskConfig = clusterData.config.masterConfig.diskConfig;
      if (diskConfig.bootDiskSizeGb) {
        textParts.push(`disk ${diskConfig.bootDiskSizeGb}GB`);
      }
      if (diskConfig.bootDiskType) {
        textParts.push(`disk type ${diskConfig.bootDiskType}`);
      }
    }

    return textParts.join(' ');
  }

  /**
   * Train the model with new cluster data (store for future fine-tuning)
   * Phase 3: Enhanced with Generic Converter Integration
   */
  public async trainOnClusterData(clusterData: ClusterData): Promise<void> {
    const extractedText = await this.extractClusterText(clusterData);

    if (extractedText.trim().length === 0) {
      logger.warn('No text extracted from cluster data');
      return;
    }

    const trainingExample: TrainingData = {
      clusterId: `${clusterData.projectId}-${clusterData.region}-${clusterData.clusterName}`,
      clusterName: clusterData.clusterName || 'unknown',
      projectId: clusterData.projectId || 'unknown',
      region: clusterData.region || 'unknown',
      extractedText,
      timestamp: new Date().toISOString(),
    };

    // Add to training data (keep last 1000 examples)
    this.trainingData.push(trainingExample);
    if (this.trainingData.length > 1000) {
      this.trainingData = this.trainingData.slice(-1000);
    }

    this.documentsProcessed++;

    logger.debug(`🎓 Stored training data for cluster: ${clusterData.clusterName}`);

    // Save training data periodically
    if (this.documentsProcessed % 5 === 0) {
      this.saveTrainingData();
    }
  }

  /**
   * Generate semantic embedding using Transformers.js
   */
  public async generateEmbedding(text: string): Promise<number[]> {
    await this.initializePipeline();

    try {
      // Use the feature-extraction pipeline with proper pooling and normalization
      if (!this.pipeline) {
        throw new Error('Pipeline not initialized');
      }

      const result = await (this.pipeline as any)(text, {
        pooling: 'mean',
        normalize: true,
      });

      // Convert tensor to array - handle nested structure with type safety
      let embedding: number[];

      if (!isTensorLike(result)) {
        throw new Error('Unexpected embedding result type');
      }

      if (result.tolist && typeof result.tolist === 'function') {
        const listResult = result.tolist();
        // Handle nested array structure [[embedding]]
        if (Array.isArray(listResult) && Array.isArray(listResult[0])) {
          embedding = listResult[0] as number[];
        } else if (Array.isArray(listResult)) {
          embedding = listResult as number[];
        } else {
          throw new Error('Unexpected tolist result format');
        }
      } else if (Array.isArray(result)) {
        // Handle nested array structure [[embedding]]
        embedding = Array.isArray(result[0]) ? (result[0] as number[]) : (result as number[]);
      } else if (result.data) {
        embedding = Array.from(result.data as ArrayLike<number>);
      } else {
        throw new Error('Unexpected embedding format');
      }

      // Ensure we have the right vector size
      if (embedding.length !== this.vectorSize) {
        logger.warn(`Expected vector size ${this.vectorSize}, got ${embedding.length}`);
      }

      // DIAGNOSTIC: Check embedding quality
      const isZeroVector = embedding.every((v) => v === 0);
      const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));

      if (isZeroVector) {
        logger.error(
          `❌ [DIAGNOSTIC] Generated zero vector for text: "${text.substring(0, 100)}..."`
        );
      } else {
        logger.info(
          `✅ [DIAGNOSTIC] Generated valid embedding - magnitude: ${magnitude.toFixed(6)} for text: "${text.substring(0, 50)}..."`
        );
      }

      return embedding;
    } catch (error) {
      logger.error(
        `❌ [DIAGNOSTIC] Failed to generate embedding for text: "${text.substring(0, 100)}..."`,
        error
      );
      // Return zero vector as fallback
      const zeroVector = new Array(this.vectorSize).fill(0);
      logger.warn(`🔄 [DIAGNOSTIC] Returning zero vector fallback (length: ${zeroVector.length})`);
      return zeroVector;
    }
  }

  /**
   * Generate embeddings for cluster data with semantic enhancement
   * Phase 3: Enhanced with Generic Converter Integration
   */
  public async generateClusterEmbedding(clusterData: ClusterData): Promise<number[]> {
    const text = await this.extractClusterText(clusterData);
    return this.generateEmbedding(text);
  }

  /**
   * Get model statistics
   */
  public getStats(): EmbeddingStats {
    return {
      modelName: this.modelName,
      documentsProcessed: this.documentsProcessed,
      lastUpdated: new Date().toISOString(),
      vectorSize: this.vectorSize,
      cacheSize: this.trainingData.length,
    };
  }

  /**
   * Search training data for similar clusters (for debugging)
   */
  public searchTrainingData(query: string, limit: number = 5): TrainingData[] {
    const queryLower = query.toLowerCase();

    return this.trainingData
      .filter((data) => data.extractedText.toLowerCase().includes(queryLower))
      .slice(0, limit);
  }

  /**
   * Force save training data
   */
  public saveTrainingDataNow(): void {
    this.saveTrainingData();
  }

  /**
   * Get sample training data for inspection
   */
  public getSampleTrainingData(limit: number = 3): TrainingData[] {
    return this.trainingData.slice(-limit);
  }

  // Phase 3: Generic Converter Integration Utility Methods

  /**
   * Get conversion metrics from the generic converter
   */
  getConversionMetrics() {
    return this.genericConverter.getMetrics();
  }

  /**
   * Reset conversion metrics
   */
  resetConversionMetrics(): void {
    this.genericConverter.resetMetrics();
  }

  /**
   * Get compression service for external access
   */
  getCompressionService(): CompressionService {
    return this.compressionService;
  }

  /**
   * Test generic converter integration with sample cluster data
   */
  async testGenericConverterIntegration(): Promise<{
    success: boolean;
    metrics: any;
    extractedText?: string;
    error?: string;
  }> {
    try {
      const sampleClusterData: ClusterData = {
        clusterName: 'test-embedding-cluster',
        projectId: 'test-project',
        region: 'us-central1',
        config: {
          softwareConfig: {
            properties: {
              'dataproc:pip.packages': 'pandas==1.3.0,numpy==1.21.0,scikit-learn==0.24.2',
            },
            optionalComponents: ['JUPYTER', 'ZEPPELIN'],
          },
          masterConfig: {
            machineTypeUri: 'zones/us-central1-a/machineTypes/n1-standard-4',
            diskConfig: {
              bootDiskSizeGb: 100,
              bootDiskType: 'pd-standard',
            },
          },
        },
        labels: {
          environment: 'test',
          team: 'data-science',
        },
      };

      const extractedText = await this.extractClusterText(sampleClusterData);
      const metrics = this.getConversionMetrics();

      return {
        success: true,
        metrics,
        extractedText,
      };
    } catch (error) {
      return {
        success: false,
        metrics: this.getConversionMetrics(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Graceful shutdown - cleanup AI model pipeline and worker threads
   */
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn('🔄 [MUTEX-DEBUG] TransformersEmbeddingService: Already shutting down, skipping');
      return;
    }

    this.isShuttingDown = true;
    logger.info('🔄 [MUTEX-DEBUG] TransformersEmbeddingService: Initiating graceful shutdown');

    try {
      // Save any pending training data
      this.saveTrainingData();
      logger.debug('🔄 [MUTEX-DEBUG] TransformersEmbeddingService: Training data saved');

      // Clear the pipeline to release worker threads
      if (this.pipeline) {
        logger.info(
          '🔄 [MUTEX-DEBUG] TransformersEmbeddingService: Disposing AI model pipeline - CRITICAL STEP'
        );

        try {
          // Force garbage collection before disposal
          if (typeof global !== 'undefined' && (global as any).gc) {
            (global as any).gc();
            logger.debug('🔄 [MUTEX-DEBUG] Forced garbage collection before pipeline disposal');
          }

          // Try to dispose the pipeline if it has a dispose method
          if (typeof (this.pipeline as any).dispose === 'function') {
            logger.debug('🔄 [MUTEX-DEBUG] Calling pipeline.dispose()...');
            await (this.pipeline as any).dispose();
            logger.info('🔄 [MUTEX-DEBUG] Pipeline disposed via dispose() - SUCCESS');
          } else {
            logger.warn(
              '🔄 [MUTEX-DEBUG] Pipeline has no dispose() method - potential resource leak'
            );
          }

          // Try alternative cleanup methods
          if (typeof (this.pipeline as any).terminate === 'function') {
            logger.debug('🔄 [MUTEX-DEBUG] Calling pipeline.terminate()...');
            await (this.pipeline as any).terminate();
            logger.info('🔄 [MUTEX-DEBUG] Pipeline terminated via terminate() - SUCCESS');
          }

          // Clear the pipeline reference
          this.pipeline = null;
          logger.info('🔄 [MUTEX-DEBUG] Pipeline reference cleared - SUCCESS');

          // Force another garbage collection after disposal
          if (typeof global !== 'undefined' && (global as any).gc) {
            (global as any).gc();
            logger.debug('🔄 [MUTEX-DEBUG] Forced garbage collection after pipeline disposal');
          }

          // Add a small delay to allow worker threads to fully terminate
          await new Promise((resolve) => setTimeout(resolve, 200));
          logger.debug('🔄 [MUTEX-DEBUG] Waited 200ms for worker thread cleanup');
        } catch (pipelineError) {
          logger.error('🔄 [MUTEX-DEBUG] Error disposing pipeline:', pipelineError);
          // Continue with cleanup even if pipeline disposal fails
          this.pipeline = null;
        }
      } else {
        logger.debug('🔄 [MUTEX-DEBUG] No pipeline to dispose');
      }

      // Clear training data cache
      this.trainingData = [];
      logger.debug('🔄 [MUTEX-DEBUG] Training data cache cleared');

      // Clear singleton instance if this is the singleton
      if (TransformersEmbeddingService.instance === this) {
        logger.info('🔄 [MUTEX-DEBUG] Clearing singleton instance');
        TransformersEmbeddingService.clearInstance();
      }

      logger.info('🔄 [MUTEX-DEBUG] TransformersEmbeddingService: Graceful shutdown completed');
    } catch (error) {
      logger.error('🔄 [MUTEX-DEBUG] TransformersEmbeddingService: Error during shutdown:', error);
      // Don't re-throw to prevent cascading failures
      logger.warn(
        '🔄 [MUTEX-DEBUG] Continuing shutdown despite errors to prevent mutex lock issues'
      );
    } finally {
      this.isShuttingDown = false;
    }
  }
}
