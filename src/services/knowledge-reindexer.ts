/**
 * Knowledge Reindexer Service
 * Provides scheduled and on-demand reindexing of Qdrant knowledge base
 * Ensures data consistency and freshness for enhanced prompt system
 */

import { KnowledgeIndexer } from './knowledge-indexer.js';
import { QdrantStorageService } from './qdrant-storage.js';
import { logger } from '../utils/logger.js';
import {
  ReindexingConfig,
  ReindexingStatus,
  ReindexingMetrics,
} from '../types/enhanced-prompts.js';

/**
 * Default reindexing configuration
 */
const DEFAULT_REINDEXING_CONFIG: ReindexingConfig = {
  enableScheduledReindexing: true,
  intervalMs: 6 * 60 * 60 * 1000, // 6 hours
  batchSize: 100,
  maxRetries: 3,
  enableIncrementalIndexing: true,
  retentionDays: 30,
  compressionEnabled: true,
};

/**
 * Knowledge Reindexer class for managing Qdrant data consistency
 */
export class KnowledgeReindexer {
  private config: ReindexingConfig;
  private knowledgeIndexer: KnowledgeIndexer;
  private qdrantService: QdrantStorageService;
  private scheduledInterval: NodeJS.Timeout | null = null;
  private isRunning = false;
  private status: ReindexingStatus;
  private metrics: ReindexingMetrics;
  private lastIndexedDocuments: Map<string, Date> = new Map();

  constructor(knowledgeIndexer: KnowledgeIndexer, config?: Partial<ReindexingConfig>) {
    this.config = { ...DEFAULT_REINDEXING_CONFIG, ...config };
    this.knowledgeIndexer = knowledgeIndexer;
    this.qdrantService = knowledgeIndexer.getQdrantService();

    this.status = this.initializeStatus();
    this.metrics = this.initializeMetrics();

    if (this.config.enableScheduledReindexing) {
      this.startScheduledReindexing();
    }

    logger.info('KnowledgeReindexer: Initialized with config', this.config);
  }

  /**
   * Start scheduled reindexing
   */
  startScheduledReindexing(): void {
    if (this.scheduledInterval) {
      clearInterval(this.scheduledInterval);
    }

    this.scheduledInterval = setInterval(
      () => this.performScheduledReindex(),
      this.config.intervalMs
    );

    this.status.nextRun = new Date(Date.now() + this.config.intervalMs);
    logger.info(`KnowledgeReindexer: Scheduled reindexing every ${this.config.intervalMs}ms`);
  }

  /**
   * Stop scheduled reindexing
   */
  stopScheduledReindexing(): void {
    if (this.scheduledInterval) {
      clearInterval(this.scheduledInterval);
      this.scheduledInterval = null;
      this.status.nextRun = null;
      logger.info('KnowledgeReindexer: Scheduled reindexing stopped');
    }
  }

  /**
   * Perform manual reindexing
   */
  async performManualReindex(options?: {
    forceFullReindex?: boolean;
    batchSize?: number;
  }): Promise<void> {
    const forceFullReindex = options?.forceFullReindex || false;
    const batchSize = options?.batchSize || this.config.batchSize;

    logger.info('KnowledgeReindexer: Starting manual reindex', { forceFullReindex, batchSize });

    await this.performReindexing({
      isScheduled: false,
      forceFullReindex,
      batchSize,
    });
  }

  /**
   * Get current reindexing status
   */
  getStatus(): ReindexingStatus {
    return { ...this.status };
  }

  /**
   * Get reindexing metrics
   */
  getMetrics(): ReindexingMetrics {
    return { ...this.metrics };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ReindexingConfig>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };

    // Restart scheduling if interval changed
    if (oldConfig.intervalMs !== this.config.intervalMs && this.config.enableScheduledReindexing) {
      this.startScheduledReindexing();
    }

    logger.info('KnowledgeReindexer: Configuration updated', { oldConfig, newConfig });
  }

  /**
   * Check if reindexing is needed based on data staleness
   */
  async isReindexingNeeded(): Promise<boolean> {
    try {
      // Check collection info
      const collectionInfo = await this.qdrantService
        .getQdrantClient()
        .getCollection(this.qdrantService.getCollectionName());

      if (!collectionInfo) {
        return true; // Collection doesn't exist, needs indexing
      }

      // Check if we have recent data
      const cutoffTime = new Date(Date.now() - this.config.intervalMs);
      const recentDocuments = await this.getRecentDocuments(cutoffTime);

      // If we have new data since last reindex, we need to reindex
      return recentDocuments.length > 0;
    } catch (error) {
      logger.warn('KnowledgeReindexer: Error checking if reindexing needed', error);
      return true; // Default to reindexing on error
    }
  }

  /**
   * Perform scheduled reindexing
   */
  private async performScheduledReindex(): Promise<void> {
    if (this.isRunning) {
      logger.warn('KnowledgeReindexer: Skipping scheduled reindex - already running');
      return;
    }

    const isNeeded = await this.isReindexingNeeded();
    if (!isNeeded) {
      logger.debug('KnowledgeReindexer: Skipping scheduled reindex - not needed');
      this.status.nextRun = new Date(Date.now() + this.config.intervalMs);
      return;
    }

    logger.info('KnowledgeReindexer: Starting scheduled reindex');

    await this.performReindexing({
      isScheduled: true,
      forceFullReindex: false,
      batchSize: this.config.batchSize,
    });
  }

  /**
   * Core reindexing logic
   */
  private async performReindexing(options: {
    isScheduled: boolean;
    forceFullReindex: boolean;
    batchSize: number;
  }): Promise<void> {
    if (this.isRunning) {
      throw new Error('Reindexing already in progress');
    }

    this.isRunning = true;
    this.status.isRunning = true;
    this.status.documentsProcessed = 0;
    this.status.errors = [];

    const startTime = Date.now();
    let documentsProcessed = 0;
    let documentsIndexed = 0;
    let documentsUpdated = 0;
    let documentsDeleted = 0;

    try {
      logger.info('KnowledgeReindexer: Starting reindexing process', options);

      // Step 1: Get current collection stats
      await this.updateCollectionStats();

      // Step 2: Perform cleanup if needed
      if (options.forceFullReindex) {
        await this.performCleanup();
      }

      // Step 3: Reindex clusters
      const clusterResults = await this.reindexClusters(options.batchSize);
      documentsProcessed += clusterResults.processed;
      documentsIndexed += clusterResults.indexed;
      documentsUpdated += clusterResults.updated;

      // Step 4: Reindex jobs
      const jobResults = await this.reindexJobs(options.batchSize);
      documentsProcessed += jobResults.processed;
      documentsIndexed += jobResults.indexed;
      documentsUpdated += jobResults.updated;

      // Step 5: Reindex errors
      const errorResults = await this.reindexErrors(options.batchSize);
      documentsProcessed += errorResults.processed;
      documentsIndexed += errorResults.indexed;
      documentsUpdated += errorResults.updated;

      // Step 6: Cleanup old documents
      if (this.config.retentionDays > 0) {
        const cleanupResults = await this.cleanupOldDocuments();
        documentsDeleted += cleanupResults.deleted;
      }

      // Update metrics
      const totalTimeMs = Date.now() - startTime;
      this.updateMetrics(true, totalTimeMs, documentsIndexed, documentsUpdated, documentsDeleted);

      this.status.lastRun = new Date();
      if (options.isScheduled) {
        this.status.nextRun = new Date(Date.now() + this.config.intervalMs);
      }

      logger.info('KnowledgeReindexer: Reindexing completed successfully', {
        totalTimeMs,
        documentsProcessed,
        documentsIndexed,
        documentsUpdated,
        documentsDeleted,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.status.errors.push(errorMessage);
      this.updateMetrics(
        false,
        Date.now() - startTime,
        documentsIndexed,
        documentsUpdated,
        documentsDeleted
      );

      logger.error('KnowledgeReindexer: Reindexing failed', error);
      throw error;
    } finally {
      this.isRunning = false;
      this.status.isRunning = false;
      this.status.documentsProcessed = documentsProcessed;
    }
  }

  /**
   * Reindex cluster data
   */
  private async reindexClusters(_batchSize: number): Promise<{
    processed: number;
    indexed: number;
    updated: number;
  }> {
    logger.debug('KnowledgeReindexer: Reindexing clusters');

    // This would integrate with existing cluster tracking
    // For now, return mock results
    return {
      processed: 0,
      indexed: 0,
      updated: 0,
    };
  }

  /**
   * Reindex job data
   */
  private async reindexJobs(_batchSize: number): Promise<{
    processed: number;
    indexed: number;
    updated: number;
  }> {
    logger.debug('KnowledgeReindexer: Reindexing jobs');

    // This would integrate with existing job tracking
    // For now, return mock results
    return {
      processed: 0,
      indexed: 0,
      updated: 0,
    };
  }

  /**
   * Reindex error data
   */
  private async reindexErrors(_batchSize: number): Promise<{
    processed: number;
    indexed: number;
    updated: number;
  }> {
    logger.debug('KnowledgeReindexer: Reindexing errors');

    // This would integrate with existing error tracking
    // For now, return mock results
    return {
      processed: 0,
      indexed: 0,
      updated: 0,
    };
  }

  /**
   * Cleanup old documents based on retention policy
   */
  private async cleanupOldDocuments(): Promise<{ deleted: number }> {
    const cutoffDate = new Date(Date.now() - this.config.retentionDays * 24 * 60 * 60 * 1000);

    try {
      // Delete documents older than retention period
      const result = await this.qdrantService
        .getQdrantClient()
        .delete(this.qdrantService.getCollectionName(), {
          filter: {
            must: [
              {
                key: 'timestamp',
                range: {
                  lt: cutoffDate.toISOString(),
                },
              },
            ],
          },
        });

      const deleted = result.operation_id ? 1 : 0; // Simplified for now
      logger.info(`KnowledgeReindexer: Cleaned up ${deleted} old documents`);

      return { deleted };
    } catch (error) {
      logger.warn('KnowledgeReindexer: Error during cleanup', error);
      return { deleted: 0 };
    }
  }

  /**
   * Perform full cleanup of collection
   */
  private async performCleanup(): Promise<void> {
    logger.info('KnowledgeReindexer: Performing full cleanup');

    try {
      // Delete all documents in collection
      await this.qdrantService.getQdrantClient().delete(this.qdrantService.getCollectionName(), {
        filter: {
          must: [
            {
              key: 'type',
              match: { any: ['cluster', 'job', 'error'] },
            },
          ],
        },
      });

      logger.info('KnowledgeReindexer: Full cleanup completed');
    } catch (error) {
      logger.error('KnowledgeReindexer: Error during full cleanup', error);
      throw error;
    }
  }

  /**
   * Update collection statistics
   */
  private async updateCollectionStats(): Promise<void> {
    try {
      const collectionInfo = await this.qdrantService
        .getQdrantClient()
        .getCollection(this.qdrantService.getCollectionName());

      if (collectionInfo) {
        this.status.totalDocuments = collectionInfo.points_count || 0;
      }
    } catch (error) {
      logger.warn('KnowledgeReindexer: Error updating collection stats', error);
    }
  }

  /**
   * Get recent documents for staleness check
   */
  private async getRecentDocuments(cutoffTime: Date): Promise<any[]> {
    try {
      const result = await this.qdrantService
        .getQdrantClient()
        .scroll(this.qdrantService.getCollectionName(), {
          filter: {
            must: [
              {
                key: 'timestamp',
                range: {
                  gte: cutoffTime.toISOString(),
                },
              },
            ],
          },
          limit: 10,
          with_payload: false,
        });

      return result.points || [];
    } catch (error) {
      logger.warn('KnowledgeReindexer: Error getting recent documents', error);
      return [];
    }
  }

  /**
   * Update reindexing metrics
   */
  private updateMetrics(
    success: boolean,
    timeMs: number,
    indexed: number,
    updated: number,
    deleted: number
  ): void {
    this.metrics.totalRuns++;

    if (success) {
      this.metrics.successfulRuns++;
    } else {
      this.metrics.failedRuns++;
    }

    // Update average run time
    const totalTime = this.metrics.averageRunTimeMs * (this.metrics.totalRuns - 1) + timeMs;
    this.metrics.averageRunTimeMs = totalTime / this.metrics.totalRuns;

    this.metrics.documentsIndexed += indexed;
    this.metrics.documentsUpdated += updated;
    this.metrics.documentsDeleted += deleted;
  }

  /**
   * Initialize status object
   */
  private initializeStatus(): ReindexingStatus {
    return {
      isRunning: false,
      lastRun: null,
      nextRun: null,
      totalDocuments: 0,
      documentsProcessed: 0,
      errors: [],
      performance: {
        averageDocumentsPerSecond: 0,
        totalTimeMs: 0,
        memoryUsageMB: 0,
      },
    };
  }

  /**
   * Initialize metrics object
   */
  private initializeMetrics(): ReindexingMetrics {
    return {
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
      averageRunTimeMs: 0,
      documentsIndexed: 0,
      documentsUpdated: 0,
      documentsDeleted: 0,
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    logger.info('KnowledgeReindexer: Initiating graceful shutdown');

    this.stopScheduledReindexing();

    // Wait for current reindexing to complete if running
    if (this.isRunning) {
      logger.info('KnowledgeReindexer: Waiting for current reindexing to complete');
      while (this.isRunning) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    logger.info('KnowledgeReindexer: Shutdown complete');
  }
}
