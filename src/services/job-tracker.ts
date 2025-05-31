import { TrackedJobInfo, EnhancedJobTrackerConfig, JobMetrics } from '../types/job-tracker.js';
import { logger } from '../utils/logger.js';

export class JobTracker {
  private jobs: Map<string, TrackedJobInfo> = new Map();
  private autoUpdateJobs: Set<string> = new Set();
  private config: EnhancedJobTrackerConfig;
  private metrics: JobMetrics;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: EnhancedJobTrackerConfig = {}) {
    this.config = {
      maxTrackedJobs: 1000,
      autoCleanupInterval: 3600000, // 1 hour
      enableMetrics: true,
      ...config,
    };

    this.metrics = {
      totalJobs: 0,
      activeJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      autoUpdateJobs: 0,
    };

    logger.debug('JobTracker: Initialized with enhanced auto-update capabilities');

    // Start automatic cleanup if enabled
    if (this.config.autoCleanupInterval && this.config.autoCleanupInterval > 0) {
      this.startAutoCleanup();
    }
  }

  /**
   * ENHANCED: Adds or updates a job with auto-update integration and metrics
   */
  addOrUpdateJob(jobInfo: Partial<TrackedJobInfo> & { jobId: string }): void {
    const now = new Date().toISOString();
    const existingJob = this.jobs.get(jobInfo.jobId);
    const isNewJob = !existingJob;

    const updatedJob: TrackedJobInfo = {
      ...existingJob,
      ...jobInfo,
      lastUpdated: now,
      submissionTime: existingJob?.submissionTime || now,
      status: jobInfo.status || existingJob?.status || 'UNKNOWN',
      toolName: jobInfo.toolName || existingJob?.toolName || 'UNKNOWN',
      projectId: jobInfo.projectId || existingJob?.projectId || 'UNKNOWN',
      region: jobInfo.region || existingJob?.region || 'UNKNOWN',
      clusterName: jobInfo.clusterName || existingJob?.clusterName || 'UNKNOWN',
    };

    this.jobs.set(jobInfo.jobId, updatedJob);

    // Update metrics
    if (this.config.enableMetrics) {
      this.updateMetrics(updatedJob, existingJob, isNewJob);
    }

    // Log auto-update status
    const autoUpdateStatus = this.isAutoUpdateEnabled(jobInfo.jobId)
      ? 'auto-update enabled'
      : 'manual tracking';
    logger.debug(
      `JobTracker: Job ${jobInfo.jobId} ${isNewJob ? 'added' : 'updated'}. Status: ${updatedJob.status} (${autoUpdateStatus})`
    );

    // Enforce max tracked jobs limit
    const maxTrackedJobs =
      typeof this.config.maxTrackedJobs === 'number' ? this.config.maxTrackedJobs : 1000;
    if (this.jobs.size > maxTrackedJobs) {
      this.cleanupOldestJobs();
    }
  }

  /**
   * NEW: Enable automatic status updates for a job
   */
  enableAutoUpdate(jobId: string): void {
    if (!this.jobs.has(jobId)) {
      logger.warn(`JobTracker: Cannot enable auto-update for non-existent job ${jobId}`);
      return;
    }

    this.autoUpdateJobs.add(jobId);
    this.updateAutoUpdateMetrics();
    logger.debug(`JobTracker: Auto-update enabled for job ${jobId}`);
  }

  /**
   * NEW: Disable automatic status updates for a job
   */
  disableAutoUpdate(jobId: string): void {
    this.autoUpdateJobs.delete(jobId);
    this.updateAutoUpdateMetrics();
    logger.debug(`JobTracker: Auto-update disabled for job ${jobId}`);
  }

  /**
   * NEW: Get list of jobs with auto-update enabled
   */
  getAutoUpdateJobs(): string[] {
    return Array.from(this.autoUpdateJobs);
  }

  /**
   * NEW: Check if auto-update is enabled for a job
   */
  isAutoUpdateEnabled(jobId: string): boolean {
    return this.autoUpdateJobs.has(jobId);
  }

  /**
   * EXISTING: Retrieves a specific job by its ID.
   */
  getJob(jobId: string): TrackedJobInfo | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * EXISTING: Lists all tracked jobs.
   */
  listJobs(): TrackedJobInfo[] {
    return Array.from(this.jobs.values());
  }

  /**
   * NEW: Get jobs filtered by auto-update status
   */
  getJobsByAutoUpdateStatus(autoUpdate: boolean): TrackedJobInfo[] {
    return this.listJobs().filter((job) => this.isAutoUpdateEnabled(job.jobId) === autoUpdate);
  }

  /**
   * NEW: Get active jobs (RUNNING or PENDING) with auto-update enabled
   */
  getActiveAutoUpdateJobs(): TrackedJobInfo[] {
    return this.listJobs().filter(
      (job) => this.isAutoUpdateEnabled(job.jobId) && ['RUNNING', 'PENDING'].includes(job.status)
    );
  }

  /**
   * NEW: Get jobs by status
   */
  getJobsByStatus(status: string): TrackedJobInfo[] {
    return this.listJobs().filter((job) => job.status === status);
  }

  /**
   * NEW: Get jobs by tool name
   */
  getJobsByTool(toolName: string): TrackedJobInfo[] {
    return this.listJobs().filter((job) => job.toolName === toolName);
  }

  /**
   * NEW: Get jobs by project and region
   */
  getJobsByLocation(projectId: string, region: string): TrackedJobInfo[] {
    return this.listJobs().filter((job) => job.projectId === projectId && job.region === region);
  }

  /**
   * NEW: Clean up completed jobs from auto-update tracking
   */
  cleanupCompletedAutoUpdateJobs(): number {
    const completedStates = ['COMPLETED', 'DONE', 'FAILED', 'CANCELLED', 'ERROR'];
    let cleanedCount = 0;

    for (const jobId of this.autoUpdateJobs) {
      const job = this.getJob(jobId);
      if (job && completedStates.includes(job.status)) {
        this.disableAutoUpdate(jobId);
        cleanedCount++;
        logger.debug(`JobTracker: Auto-cleanup disabled auto-update for completed job ${jobId}`);
      }
    }

    if (cleanedCount > 0) {
      logger.info(`JobTracker: Cleaned up ${cleanedCount} completed auto-update jobs`);
    }

    return cleanedCount;
  }

  /**
   * NEW: Get current metrics
   */
  getMetrics(): JobMetrics {
    if (this.config.enableMetrics) {
      this.recalculateMetrics();
    }
    return { ...this.metrics };
  }

  /**
   * NEW: Get health status
   */
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: {
      totalJobs: number;
      activeJobs: number;
      autoUpdateJobs: number;
      failureRate: number;
      memoryUsage: string;
    };
  } {
    const metrics = this.getMetrics();
    const failureRate = metrics.totalJobs > 0 ? metrics.failedJobs / metrics.totalJobs : 0;

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    const maxTrackedJobs =
      typeof this.config.maxTrackedJobs === 'number' ? this.config.maxTrackedJobs : 1000;
    if (failureRate > 0.5 || metrics.totalJobs > maxTrackedJobs * 0.9) {
      status = 'unhealthy';
    } else if (failureRate > 0.2 || metrics.totalJobs > maxTrackedJobs * 0.7) {
      status = 'degraded';
    }

    return {
      status,
      details: {
        totalJobs: metrics.totalJobs,
        activeJobs: metrics.activeJobs,
        autoUpdateJobs: metrics.autoUpdateJobs,
        failureRate,
        memoryUsage: `${this.jobs.size} jobs tracked`,
      },
    };
  }

  /**
   * EXISTING: Clears all tracked jobs (e.g., on session end).
   */
  clearJobs(): void {
    this.jobs.clear();
    this.autoUpdateJobs.clear();
    if (this.config.enableMetrics) {
      this.recalculateMetrics();
    }
    logger.debug('JobTracker: All jobs cleared.');
  }

  /**
   * NEW: Remove old jobs to maintain size limit
   */
  private cleanupOldestJobs(): void {
    const jobs = this.listJobs();
    const sortedJobs = jobs.sort(
      (a, b) => new Date(a.lastUpdated).getTime() - new Date(b.lastUpdated).getTime()
    );

    const maxTrackedJobs =
      typeof this.config.maxTrackedJobs === 'number' ? this.config.maxTrackedJobs : 1000;
    const toRemove = sortedJobs.slice(0, jobs.length - maxTrackedJobs + 100);

    for (const job of toRemove) {
      // Don't remove jobs with auto-update enabled
      if (!this.isAutoUpdateEnabled(job.jobId)) {
        this.jobs.delete(job.jobId);
        logger.debug(`JobTracker: Removed old job ${job.jobId} to maintain size limit`);
      }
    }
  }

  /**
   * NEW: Start automatic cleanup interval
   */
  private startAutoCleanup(): void {
    this.cleanupInterval = setInterval(
      () => {
        const cleaned = this.cleanupCompletedAutoUpdateJobs();
        this.cleanupOldestJobs();

        if (this.config.enableMetrics) {
          this.recalculateMetrics();
        }

        logger.debug(`JobTracker: Auto-cleanup completed, cleaned ${cleaned} jobs`);
      },
      typeof this.config.autoCleanupInterval === 'number' ? this.config.autoCleanupInterval : 60000
    );

    logger.info(
      `JobTracker: Auto-cleanup started with ${this.config.autoCleanupInterval}ms interval`
    );
  }

  /**
   * NEW: Stop automatic cleanup
   */
  stopAutoCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      logger.info('JobTracker: Auto-cleanup stopped');
    }
  }

  /**
   * NEW: Update metrics when job changes
   */
  private updateMetrics(
    updatedJob: TrackedJobInfo,
    existingJob?: TrackedJobInfo,
    isNewJob: boolean = false
  ): void {
    if (!this.config.enableMetrics) return;

    if (isNewJob) {
      this.metrics.totalJobs++;
    }

    // Update status-based metrics
    if (existingJob && existingJob.status !== updatedJob.status) {
      // Remove from old status count
      this.decrementStatusMetric(existingJob.status);
      // Add to new status count
      this.incrementStatusMetric(updatedJob.status);
    } else if (isNewJob) {
      this.incrementStatusMetric(updatedJob.status);
    }

    this.updateAutoUpdateMetrics();
  }

  /**
   * NEW: Increment status-based metrics
   */
  private incrementStatusMetric(status: string): void {
    switch (status) {
      case 'RUNNING':
      case 'PENDING':
        this.metrics.activeJobs++;
        break;
      case 'COMPLETED':
      case 'DONE':
        this.metrics.completedJobs++;
        break;
      case 'FAILED':
      case 'ERROR':
      case 'CANCELLED':
        this.metrics.failedJobs++;
        break;
    }
  }

  /**
   * NEW: Decrement status-based metrics
   */
  private decrementStatusMetric(status: string): void {
    switch (status) {
      case 'RUNNING':
      case 'PENDING':
        this.metrics.activeJobs = Math.max(0, this.metrics.activeJobs - 1);
        break;
      case 'COMPLETED':
      case 'DONE':
        this.metrics.completedJobs = Math.max(0, this.metrics.completedJobs - 1);
        break;
      case 'FAILED':
      case 'ERROR':
      case 'CANCELLED':
        this.metrics.failedJobs = Math.max(0, this.metrics.failedJobs - 1);
        break;
    }
  }

  /**
   * NEW: Update auto-update job metrics
   */
  private updateAutoUpdateMetrics(): void {
    this.metrics.autoUpdateJobs = this.autoUpdateJobs.size;
  }

  /**
   * NEW: Recalculate all metrics from current job state
   */
  private recalculateMetrics(): void {
    const jobs = this.listJobs();

    this.metrics = {
      totalJobs: jobs.length,
      activeJobs: jobs.filter((job) => ['RUNNING', 'PENDING'].includes(job.status)).length,
      completedJobs: jobs.filter((job) => ['COMPLETED', 'DONE'].includes(job.status)).length,
      failedJobs: jobs.filter((job) => ['FAILED', 'ERROR', 'CANCELLED'].includes(job.status))
        .length,
      autoUpdateJobs: this.autoUpdateJobs.size,
    };

    // Calculate average job duration for completed jobs
    const completedJobs = jobs.filter((job) =>
      ['COMPLETED', 'DONE', 'FAILED', 'ERROR', 'CANCELLED'].includes(job.status)
    );

    if (completedJobs.length > 0) {
      const totalDuration = completedJobs.reduce((sum, job) => {
        const start = new Date(job.submissionTime).getTime();
        const end = new Date(job.lastUpdated).getTime();
        return sum + (end - start);
      }, 0);

      this.metrics.averageJobDuration = totalDuration / completedJobs.length;
    }
  }

  /**
   * NEW: Graceful shutdown
   */
  async shutdown(): Promise<void> {
    logger.info('JobTracker: Initiating graceful shutdown');

    this.stopAutoCleanup();

    // Export final state for potential recovery
    const finalState = {
      jobs: this.listJobs(),
      autoUpdateJobs: this.getAutoUpdateJobs(),
      metrics: this.getMetrics(),
    };
    logger.info(
      `JobTracker: Final state - ${finalState.jobs.length} jobs, ${finalState.autoUpdateJobs.length} auto-update jobs`
    );

    logger.info('JobTracker: Shutdown complete');
  }
}
