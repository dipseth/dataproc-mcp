/**
 * Modern Embedding Service using Transformers.js
 *
 * Uses state-of-the-art sentence transformers for semantic embeddings
 * with continuous learning capabilities for Dataproc cluster data
 */

import { pipeline } from '@huggingface/transformers';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { logger } from '../utils/logger.js';

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
  private pipeline: any = null;
  private modelName: string;
  private vectorSize: number;
  private trainingDataPath: string;
  private trainingData: TrainingData[] = [];
  private documentsProcessed: number = 0;

  constructor(
    modelName: string = 'Xenova/all-MiniLM-L6-v2', // 384-dimensional embeddings
    trainingDataPath?: string
  ) {
    this.modelName = modelName;
    this.vectorSize = 384; // Standard for all-MiniLM-L6-v2
    this.trainingDataPath =
      trainingDataPath || join(process.cwd(), 'state', 'embedding-training-data.json');

    this.loadTrainingData();
  }

  /**
   * Initialize the embedding pipeline (lazy loading)
   */
  private async initializePipeline(): Promise<void> {
    if (this.pipeline === null) {
      logger.info(`🤖 Loading Transformers.js model: ${this.modelName}`);

      try {
        this.pipeline = await pipeline('feature-extraction', this.modelName, {
          // Use quantized model for better performance
          dtype: 'q8',
          // Cache models locally
          cache_dir: join(process.cwd(), 'state', 'transformers-cache'),
        });

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
   */
  private extractClusterText(clusterData: any): string {
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
   */
  public trainOnClusterData(clusterData: any): void {
    const extractedText = this.extractClusterText(clusterData);

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
      const result = await this.pipeline(text, {
        pooling: 'mean',
        normalize: true,
      });

      // Convert tensor to array - handle nested structure
      let embedding: number[];
      if (result.tolist) {
        const listResult = result.tolist();
        // Handle nested array structure [[embedding]]
        embedding = Array.isArray(listResult[0]) ? listResult[0] : listResult;
      } else if (Array.isArray(result)) {
        // Handle nested array structure [[embedding]]
        embedding = Array.isArray(result[0]) ? result[0] : result;
      } else if (result.data) {
        embedding = Array.from(result.data);
      } else {
        throw new Error('Unexpected embedding format');
      }

      // Ensure we have the right vector size
      if (embedding.length !== this.vectorSize) {
        logger.warn(`Expected vector size ${this.vectorSize}, got ${embedding.length}`);
      }

      return embedding;
    } catch (error) {
      logger.error('Failed to generate embedding:', error);
      // Return zero vector as fallback
      return new Array(this.vectorSize).fill(0);
    }
  }

  /**
   * Generate embeddings for cluster data with semantic enhancement
   */
  public async generateClusterEmbedding(clusterData: any): Promise<number[]> {
    const text = this.extractClusterText(clusterData);
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
}
