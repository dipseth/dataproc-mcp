/**
 * Enhanced AsyncQueryPoller Service - Production Ready Implementation
 *
 * PROJECT_MEMHASH: e4f2e4de-1ff6-43f4-bdf3-2a8c90387c63
 * File: src/services/async-query-poller.ts
 *
 * This implementation uses modern Node.js patterns validated with Context7:
 * - node:timers/promises for async iterators
 * - EventEmitter for loose coupling
 * - AbortController for graceful shutdown
 * - Comprehensive error handling with retries
 * - Concurrency control and batch processing
 */

import { JobTracker } from './job-tracker.js';
import { logger } from '../utils/logger.js';
import { setInterval } from 'node:timers/promises';
import { EventEmitter } from 'node:events';

export interface QueryInfo {
  jobId: string;
  projectId: string;
  region: string;
  toolName: string;
  submissionTime: string;
  status: string;
}

export interface AsyncQueryPollerConfig {
  intervalMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  enableCleanup?: boolean;
  cleanupIntervalMs?: number;
  maxConcurrentPolls?: number;
}

export interface PollerStatus {
  isPolling: boolean;
  activeQueries: number;
  autoUpdateJobs: number;
  concurrentPolls: number;
  config: AsyncQueryPollerConfig;
  uptime?: number;
  lastPollTime?: string;
  totalPolls?: number;
  errorCount?: number;
}

export interface StatusChangeEvent {
  jobId: string;
  oldStatus: string;
  newStatus: string;
  timestamp: string;
}

export interface JobErrorEvent {
  jobId: string;
  error: Error;
  retryCount: number;
  timestamp: string;
}

export class AsyncQueryPoller extends EventEmitter {
  private pollingController: AbortController | null = null;
  private cleanupController: AbortController | null = null;
  private activeQueries: Map<string, QueryInfo> = new Map();
  private jobTracker: JobTracker;
  private config: AsyncQueryPollerConfig;
  private isPolling: boolean = false;
  private concurrentPolls: number = 0;
  private startTime: number = 0;
  private totalPolls: number = 0;
  private errorCount: number = 0;
  private lastPollTime: string = '';

  constructor(jobTracker: JobTracker, config: AsyncQueryPollerConfig = {}) {
    super();
    this.jobTracker = jobTracker;
    this.config = {
      intervalMs: parseInt(process.env.POLL_INTERVAL_MS || '30000'),
      maxRetries: parseInt(process.env.MAX_RETRIES || '3'),
      retryDelayMs: parseInt(process.env.RETRY_DELAY_MS || '5000'),
      enableCleanup: process.env.ENABLE_CLEANUP !== 'false',
      cleanupIntervalMs: parseInt(process.env.CLEANUP_INTERVAL_MS || '300000'),
      maxConcurrentPolls: parseInt(process.env.MAX_CONCURRENT_POLLS || '10'),
      ...config,
    };

    logger.debug('AsyncQueryPoller: Initialized with enhanced config:', this.config);

    // Set up error handling
    this.on('error', (error) => {
      this.errorCount++;
      logger.error('AsyncQueryPoller: Unhandled error:', error);
    });
  }

  /**
   * Start the background polling service using modern Node.js async iterators
   */
  async startPolling(): Promise<void> {
    if (this.isPolling) {
      logger.warn('AsyncQueryPoller: Polling already started');
      return;
    }

    this.isPolling = true;
    this.startTime = Date.now();
    this.pollingController = new AbortController();

    try {
      logger.info(`AsyncQueryPoller: Starting polling with ${this.config.intervalMs}ms interval`);

      // Use modern Node.js timers/promises for better async handling
      const startTime = Date.now();

      for await (const _interval of setInterval(this.config.intervalMs!, startTime, {
        signal: this.pollingController.signal,
      })) {
        void _interval; // Explicitly ignore the interval value
        this.lastPollTime = new Date().toISOString();
        this.totalPolls++;

        try {
          await this.pollActiveQueries();
        } catch (error) {
          this.errorCount++;
          logger.error('AsyncQueryPoller: Error during polling cycle:', error);
          this.emit('pollError', { error, timestamp: new Date().toISOString() });
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        logger.info('AsyncQueryPoller: Polling stopped via abort signal');
      } else {
        logger.error('AsyncQueryPoller: Polling error:', error);
        this.emit('error', error);
      }
    } finally {
      this.isPolling = false;
    }

    // Start cleanup interval if enabled
    if (this.config.enableCleanup) {
      this.startCleanupInterval();
    }
  }

  /**
   * Start cleanup interval using modern async patterns
   */
  private async startCleanupInterval(): Promise<void> {
    if (this.cleanupController) {
      return; // Already running
    }

    this.cleanupController = new AbortController();

    try {
      logger.debug('AsyncQueryPoller: Starting cleanup interval');

      for await (const _cleanup of setInterval(this.config.cleanupIntervalMs!, Date.now(), {
        signal: this.cleanupController.signal,
      })) {
        void _cleanup; // Explicitly ignore the cleanup value
        const beforeCount = this.jobTracker.getAutoUpdateJobs().length;
        this.jobTracker.cleanupCompletedAutoUpdateJobs();
        const afterCount = this.jobTracker.getAutoUpdateJobs().length;

        if (beforeCount !== afterCount) {
          logger.debug(
            `AsyncQueryPoller: Cleanup removed ${beforeCount - afterCount} completed jobs`
          );
        }

        this.emit('cleanup', {
          activeQueries: this.activeQueries.size,
          autoUpdateJobs: afterCount,
          cleanedUp: beforeCount - afterCount,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        logger.error('AsyncQueryPoller: Cleanup interval error:', error);
      }
    }
  }

  /**
   * Stop the background polling service with proper cleanup
   */
  stopPolling(): void {
    logger.info('AsyncQueryPoller: Stopping polling service');

    if (this.pollingController) {
      this.pollingController.abort();
      this.pollingController = null;
    }

    if (this.cleanupController) {
      this.cleanupController.abort();
      this.cleanupController = null;
    }

    this.isPolling = false;
    this.emit('stopped', {
      uptime: this.getUptime(),
      totalPolls: this.totalPolls,
      errorCount: this.errorCount,
    });
  }

  /**
   * Add a query to the active polling list
   */
  addQuery(queryInfo: QueryInfo): void {
    this.activeQueries.set(queryInfo.jobId, queryInfo);
    this.jobTracker.enableAutoUpdate(queryInfo.jobId);

    logger.debug(`AsyncQueryPoller: Added query ${queryInfo.jobId} for ${queryInfo.toolName}`);
    this.emit('queryAdded', {
      queryInfo,
      totalActive: this.activeQueries.size,
      timestamp: new Date().toISOString(),
    });

    // Start polling if not already started
    if (!this.isPolling) {
      this.startPolling().catch((error) => {
        logger.error('AsyncQueryPoller: Failed to start polling:', error);
        this.emit('error', error);
      });
    }
  }

  /**
   * Remove a query from active polling
   */
  removeQuery(jobId: string): void {
    const queryInfo = this.activeQueries.get(jobId);
    this.activeQueries.delete(jobId);
    this.jobTracker.disableAutoUpdate(jobId);

    logger.debug(`AsyncQueryPoller: Removed query ${jobId} from active polling`);
    this.emit('queryRemoved', {
      jobId,
      queryInfo,
      totalActive: this.activeQueries.size,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get current polling status with enhanced metrics
   */
  getStatus(): PollerStatus {
    return {
      isPolling: this.isPolling,
      activeQueries: this.activeQueries.size,
      autoUpdateJobs: this.jobTracker.getAutoUpdateJobs().length,
      concurrentPolls: this.concurrentPolls,
      config: this.config,
      uptime: this.getUptime(),
      lastPollTime: this.lastPollTime,
      totalPolls: this.totalPolls,
      errorCount: this.errorCount,
    };
  }

  /**
   * Register a new query for tracking
   */
  registerQuery(queryInfo: Omit<QueryInfo, 'status'>): void {
    const fullQueryInfo: QueryInfo = {
      ...queryInfo,
      status: 'PENDING',
    };

    this.activeQueries.set(queryInfo.jobId, fullQueryInfo);
    this.jobTracker.enableAutoUpdate(queryInfo.jobId);

    logger.info(`AsyncQueryPoller: Registered query ${queryInfo.jobId} for auto-tracking`);
  }

  /**
   * Unregister a query from tracking
   */
  unregisterQuery(jobId: string): void {
    if (this.activeQueries.has(jobId)) {
      this.activeQueries.delete(jobId);
      this.jobTracker.disableAutoUpdate(jobId);
      logger.info(`AsyncQueryPoller: Unregistered query ${jobId} from auto-tracking`);
    } else {
      logger.warn(`AsyncQueryPoller: Cannot unregister non-existent query ${jobId}`);
    }
  }

  /**
   * Get query information for a specific job ID
   */
  getQueryInfo(jobId: string): QueryInfo | undefined {
    return this.activeQueries.get(jobId);
  }

  /**
   * Get uptime in milliseconds
   */
  private getUptime(): number {
    return this.startTime > 0 ? Date.now() - this.startTime : 0;
  }

  /**
   * Enhanced polling loop with concurrency control and error handling
   */
  private async pollActiveQueries(): Promise<void> {
    const autoUpdateJobs = this.jobTracker.getAutoUpdateJobs();

    if (autoUpdateJobs.length === 0) {
      logger.debug('AsyncQueryPoller: No jobs to poll');
      return;
    }

    // Implement concurrency control to prevent API overwhelming
    const batchSize = Math.min(this.config.maxConcurrentPolls!, autoUpdateJobs.length);
    const batches: string[][] = [];

    for (let i = 0; i < autoUpdateJobs.length; i += batchSize) {
      batches.push(autoUpdateJobs.slice(i, i + batchSize));
    }

    logger.debug(
      `AsyncQueryPoller: Polling ${autoUpdateJobs.length} jobs in ${batches.length} batches`
    );

    let successCount = 0;
    let errorCount = 0;

    for (const batch of batches) {
      const updatePromises = batch.map((jobId) =>
        this.updateQueryStatusWithRetry(jobId)
          .then(() => {
            successCount++;
          })
          .catch(() => {
            errorCount++;
          })
      );

      // Use Promise.allSettled to handle individual failures gracefully
      await Promise.allSettled(updatePromises);
    }

    this.emit('pollCompleted', {
      jobsPolled: autoUpdateJobs.length,
      batchCount: batches.length,
      successCount,
      errorCount,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Update status for a specific job with retry logic
   */
  private async updateQueryStatusWithRetry(jobId: string, retryCount: number = 0): Promise<void> {
    try {
      this.concurrentPolls++;
      await this.updateQueryStatus(jobId);
    } catch (error) {
      if (retryCount < this.config.maxRetries!) {
        logger.warn(
          `AsyncQueryPoller: Retrying job ${jobId} (attempt ${retryCount + 1}/${this.config.maxRetries})`
        );

        // Exponential backoff for retries
        const delay = this.config.retryDelayMs! * Math.pow(2, retryCount);
        await new Promise((resolve) => setTimeout(resolve, delay));

        return this.updateQueryStatusWithRetry(jobId, retryCount + 1);
      } else {
        const jobError: JobErrorEvent = {
          jobId,
          error: error as Error,
          retryCount,
          timestamp: new Date().toISOString(),
        };

        logger.error(`AsyncQueryPoller: Max retries exceeded for job ${jobId}:`, error);
        this.emit('jobError', jobError);
        throw error;
      }
    } finally {
      this.concurrentPolls--;
    }
  }

  /**
   * Update status for a specific job with enhanced error handling
   */
  private async updateQueryStatus(jobId: string): Promise<void> {
    const job = this.jobTracker.getJob(jobId);
    if (!job) {
      logger.warn(`AsyncQueryPoller: Job ${jobId} not found in tracker`);
      this.removeQuery(jobId);
      return;
    }

    // Only poll jobs that are still running
    if (!['RUNNING', 'PENDING'].includes(job.status)) {
      logger.debug(`AsyncQueryPoller: Job ${jobId} is ${job.status}, removing from polling`);
      this.removeQuery(jobId);
      return;
    }

    try {
      const newStatus = await this.checkJobStatus(job.projectId, job.region, jobId);

      if (newStatus !== job.status) {
        // Calculate job duration if completed
        let duration: number | undefined;
        if (['COMPLETED', 'DONE'].includes(newStatus) && job.submissionTime) {
          duration = Date.now() - new Date(job.submissionTime).getTime();
        }

        // Update job with new status and duration
        this.jobTracker.addOrUpdateJob({
          ...job,
          status: newStatus,
          lastUpdated: new Date().toISOString(),
          ...(duration && { duration }),
        });

        this.notifyStatusChange(jobId, job.status, newStatus);

        // Remove from polling if job is complete
        const completedStates = ['COMPLETED', 'DONE', 'FAILED', 'CANCELLED', 'ERROR'];
        if (completedStates.includes(newStatus)) {
          this.removeQuery(jobId);

          // Enhanced completion notification
          if (['COMPLETED', 'DONE'].includes(newStatus)) {
            const durationStr = duration ? ` in ${Math.round(duration / 1000)}s` : '';
            const toolStr = job.toolName ? ` (${job.toolName})` : '';
            logger.info(
              `🎉 AsyncQueryPoller: Job ${jobId}${toolStr} COMPLETED successfully${durationStr}!`
            );

            // Emit completion event for potential future integrations
            this.emit('jobCompleted', {
              jobId,
              projectId: job.projectId,
              region: job.region,
              toolName: job.toolName,
              duration,
              finalStatus: newStatus,
              completedAt: new Date().toISOString(),
            });
          } else {
            logger.warn(`⚠️ AsyncQueryPoller: Job ${jobId} finished with status ${newStatus}`);
          }
        }
      }
    } catch (error) {
      logger.error(`AsyncQueryPoller: Failed to check status for job ${jobId}:`, error);
      throw error; // Re-throw for retry logic
    }
  }

  /**
   * Check job status using existing Dataproc API integration with enhanced error handling
   */
  private async checkJobStatus(projectId: string, region: string, jobId: string): Promise<string> {
    try {
      // Use existing query service for status checking
      const { getJobStatus } = await import('./query.js');
      const jobStatus = await getJobStatus(projectId, region, jobId);

      // Map Dataproc API status to our internal status with comprehensive mapping
      const apiState = jobStatus.status?.state;
      switch (apiState) {
        case 'PENDING':
        case 'SETUP_DONE':
          return 'PENDING';
        case 'RUNNING':
          return 'RUNNING';
        case 'DONE':
          return 'COMPLETED';
        case 'ERROR':
        case 'ATTEMPT_FAILURE':
          return 'FAILED';
        case 'CANCELLED':
        case 'CANCEL_PENDING':
        case 'CANCEL_STARTED':
          return 'CANCELLED';
        default:
          logger.warn(`AsyncQueryPoller: Unknown API state '${apiState}' for job ${jobId}`);
          return apiState || 'UNKNOWN';
      }
    } catch (error) {
      logger.error(`AsyncQueryPoller: Error checking job status for ${jobId}:`, error);
      throw error;
    }
  }

  /**
   * Enhanced status change notification with event emission
   */
  private notifyStatusChange(jobId: string, oldStatus: string, newStatus: string): void {
    const statusChange: StatusChangeEvent = {
      jobId,
      oldStatus,
      newStatus,
      timestamp: new Date().toISOString(),
    };

    logger.info(`AsyncQueryPoller: Job ${jobId} status changed: ${oldStatus} → ${newStatus}`);
    this.emit('statusChange', statusChange);
  }

  /**
   * Graceful shutdown with proper cleanup
   */
  async shutdown(): Promise<void> {
    logger.info('AsyncQueryPoller: Initiating graceful shutdown');

    this.stopPolling();

    // Wait for any ongoing polls to complete with timeout
    const shutdownTimeout = 30000; // 30 seconds
    const startTime = Date.now();

    while (this.concurrentPolls > 0 && Date.now() - startTime < shutdownTimeout) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    if (this.concurrentPolls > 0) {
      logger.warn(
        `AsyncQueryPoller: Shutdown timeout reached with ${this.concurrentPolls} polls still active`
      );
    }

    this.removeAllListeners();
    logger.info('AsyncQueryPoller: Shutdown complete');
  }

  /**
   * Get health check information
   */
  getHealthCheck(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: {
      isPolling: boolean;
      activeQueries: number;
      errorRate: number;
      uptime: number;
      lastPoll: string;
    };
  } {
    const errorRate = this.totalPolls > 0 ? this.errorCount / this.totalPolls : 0;

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (errorRate > 0.5) {
      status = 'unhealthy';
    } else if (errorRate > 0.1) {
      status = 'degraded';
    }

    return {
      status,
      details: {
        isPolling: this.isPolling,
        activeQueries: this.activeQueries.size,
        errorRate,
        uptime: this.getUptime(),
        lastPoll: this.lastPollTime,
      },
    };
  }
}
