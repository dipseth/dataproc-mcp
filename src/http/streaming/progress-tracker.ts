/**
 * Progress Tracker for HTTP streaming operations
 * Manages progress updates and notifications for long-running operations
 */

import { ConnectionManager, ProgressUpdate } from './connection-manager.js';
import { logger } from '../../utils/logger.js';

/**
 * Progress stage information
 */
export interface ProgressStage {
  id: string;
  name: string;
  description: string;
  weight: number; // Relative weight for progress calculation
  status: 'pending' | 'active' | 'completed' | 'error';
  startTime?: Date;
  endTime?: Date;
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * Progress tracking configuration
 */
export interface ProgressConfig {
  operationId: string;
  operationName: string;
  clientId?: string;
  stages: ProgressStage[];
  enableBroadcast?: boolean;
  updateInterval?: number;
}

/**
 * Progress tracker for managing operation progress
 */
export class ProgressTracker {
  private config: ProgressConfig;
  private connectionManager: ConnectionManager;
  private currentStageIndex: number = 0;
  private startTime: Date;
  private lastUpdateTime: Date;
  private updateTimer: NodeJS.Timeout | null = null;

  constructor(config: ProgressConfig, connectionManager: ConnectionManager) {
    this.config = config;
    this.connectionManager = connectionManager;
    this.startTime = new Date();
    this.lastUpdateTime = new Date();

    logger.debug(`ProgressTracker: Created for operation ${config.operationId}`, {
      stages: config.stages.length,
      clientId: config.clientId,
    });

    // Start periodic updates if interval is configured
    if (config.updateInterval && config.updateInterval > 0) {
      this.startPeriodicUpdates();
    }
  }

  /**
   * Start the operation and send initial progress
   */
  start(): void {
    this.sendUpdate({
      type: 'progress',
      data: {
        operationId: this.config.operationId,
        operationName: this.config.operationName,
        status: 'started',
        progress: 0,
        currentStage: this.config.stages[0]?.name || 'Starting',
        stages: this.config.stages.map(stage => ({
          id: stage.id,
          name: stage.name,
          status: stage.status,
        })),
        startTime: this.startTime,
      },
      timestamp: new Date(),
      clientId: this.config.clientId,
    });

    logger.debug(`ProgressTracker: Started operation ${this.config.operationId}`);
  }

  /**
   * Update progress for the current stage
   */
  updateStage(stageId: string, status: ProgressStage['status'], metadata?: Record<string, any>): void {
    const stage = this.config.stages.find(s => s.id === stageId);
    if (!stage) {
      logger.warn(`ProgressTracker: Stage ${stageId} not found`);
      return;
    }

    const previousStatus = stage.status;
    stage.status = status;
    stage.metadata = { ...stage.metadata, ...metadata };

    if (status === 'active' && previousStatus !== 'active') {
      stage.startTime = new Date();
    } else if ((status === 'completed' || status === 'error') && !stage.endTime) {
      stage.endTime = new Date();
    }

    // Update current stage index
    const stageIndex = this.config.stages.findIndex(s => s.id === stageId);
    if (stageIndex !== -1) {
      this.currentStageIndex = stageIndex;
    }

    this.sendProgressUpdate();

    logger.debug(`ProgressTracker: Updated stage ${stageId} to ${status}`, {
      operationId: this.config.operationId,
      metadata,
    });
  }

  /**
   * Mark a stage as completed
   */
  completeStage(stageId: string, metadata?: Record<string, any>): void {
    this.updateStage(stageId, 'completed', metadata);
  }

  /**
   * Mark a stage as failed
   */
  failStage(stageId: string, error: string, metadata?: Record<string, any>): void {
    this.updateStage(stageId, 'error', { ...metadata, error });
  }

  /**
   * Complete the entire operation
   */
  complete(result?: any): void {
    // Mark any remaining stages as completed
    this.config.stages.forEach(stage => {
      if (stage.status === 'pending' || stage.status === 'active') {
        stage.status = 'completed';
        stage.endTime = new Date();
      }
    });

    this.sendUpdate({
      type: 'result',
      data: {
        operationId: this.config.operationId,
        operationName: this.config.operationName,
        status: 'completed',
        progress: 100,
        result,
        duration: Date.now() - this.startTime.getTime(),
        stages: this.config.stages,
        endTime: new Date(),
      },
      timestamp: new Date(),
      clientId: this.config.clientId,
    });

    this.cleanup();

    logger.debug(`ProgressTracker: Completed operation ${this.config.operationId}`);
  }

  /**
   * Fail the entire operation
   */
  fail(error: string, metadata?: Record<string, any>): void {
    this.sendUpdate({
      type: 'error',
      data: {
        operationId: this.config.operationId,
        operationName: this.config.operationName,
        status: 'error',
        progress: this.calculateProgress(),
        error,
        metadata,
        duration: Date.now() - this.startTime.getTime(),
        stages: this.config.stages,
        endTime: new Date(),
      },
      timestamp: new Date(),
      clientId: this.config.clientId,
    });

    this.cleanup();

    logger.error(`ProgressTracker: Failed operation ${this.config.operationId}:`, error);
  }

  /**
   * Send a custom status update
   */
  sendStatus(message: string, metadata?: Record<string, any>): void {
    this.sendUpdate({
      type: 'status',
      data: {
        operationId: this.config.operationId,
        operationName: this.config.operationName,
        status: 'running',
        message,
        metadata,
        progress: this.calculateProgress(),
      },
      timestamp: new Date(),
      clientId: this.config.clientId,
    });
  }

  /**
   * Calculate overall progress percentage
   */
  private calculateProgress(): number {
    const totalWeight = this.config.stages.reduce((sum, stage) => sum + stage.weight, 0);
    const completedWeight = this.config.stages
      .filter(stage => stage.status === 'completed')
      .reduce((sum, stage) => sum + stage.weight, 0);

    return totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0;
  }

  /**
   * Send progress update
   */
  private sendProgressUpdate(): void {
    const currentStage = this.config.stages[this.currentStageIndex];
    
    this.sendUpdate({
      type: 'progress',
      data: {
        operationId: this.config.operationId,
        operationName: this.config.operationName,
        status: 'running',
        progress: this.calculateProgress(),
        currentStage: currentStage?.name || 'Unknown',
        currentStageStatus: currentStage?.status || 'unknown',
        stages: this.config.stages.map(stage => ({
          id: stage.id,
          name: stage.name,
          status: stage.status,
          startTime: stage.startTime,
          endTime: stage.endTime,
        })),
      },
      timestamp: new Date(),
      clientId: this.config.clientId,
    });
  }

  /**
   * Send update to client(s)
   */
  private sendUpdate(update: ProgressUpdate): void {
    this.lastUpdateTime = new Date();

    if (this.config.clientId) {
      this.connectionManager.sendToClient(this.config.clientId, update);
    }

    if (this.config.enableBroadcast) {
      this.connectionManager.broadcast(update);
    }
  }

  /**
   * Start periodic progress updates
   */
  private startPeriodicUpdates(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
    }

    this.updateTimer = setInterval(() => {
      // Only send periodic updates if operation is still running
      const hasActiveStages = this.config.stages.some(
        stage => stage.status === 'active' || stage.status === 'pending'
      );

      if (hasActiveStages) {
        this.sendProgressUpdate();
      }
    }, this.config.updateInterval);
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
  }

  /**
   * Get current operation status
   */
  getStatus() {
    return {
      operationId: this.config.operationId,
      operationName: this.config.operationName,
      progress: this.calculateProgress(),
      currentStage: this.config.stages[this.currentStageIndex],
      stages: this.config.stages,
      startTime: this.startTime,
      lastUpdateTime: this.lastUpdateTime,
      duration: Date.now() - this.startTime.getTime(),
    };
  }
}

/**
 * Create a new progress tracker
 */
export function createProgressTracker(
  config: ProgressConfig,
  connectionManager: ConnectionManager
): ProgressTracker {
  return new ProgressTracker(config, connectionManager);
}

/**
 * Create standard stages for common operations
 */
export function createStandardStages(operation: 'cluster_create' | 'job_submit' | 'query_execute'): ProgressStage[] {
  switch (operation) {
    case 'cluster_create':
      return [
        { id: 'validate', name: 'Validating Configuration', description: 'Validating cluster configuration', weight: 10, status: 'pending' },
        { id: 'create', name: 'Creating Cluster', description: 'Creating Dataproc cluster', weight: 70, status: 'pending' },
        { id: 'verify', name: 'Verifying Cluster', description: 'Verifying cluster is ready', weight: 20, status: 'pending' },
      ];
    
    case 'job_submit':
      return [
        { id: 'validate', name: 'Validating Job', description: 'Validating job configuration', weight: 10, status: 'pending' },
        { id: 'submit', name: 'Submitting Job', description: 'Submitting job to cluster', weight: 20, status: 'pending' },
        { id: 'execute', name: 'Executing Job', description: 'Job is running on cluster', weight: 60, status: 'pending' },
        { id: 'complete', name: 'Completing Job', description: 'Finalizing job execution', weight: 10, status: 'pending' },
      ];
    
    case 'query_execute':
      return [
        { id: 'parse', name: 'Parsing Query', description: 'Parsing and validating query', weight: 10, status: 'pending' },
        { id: 'execute', name: 'Executing Query', description: 'Running query on cluster', weight: 80, status: 'pending' },
        { id: 'results', name: 'Fetching Results', description: 'Retrieving query results', weight: 10, status: 'pending' },
      ];
    
    default:
      return [
        { id: 'start', name: 'Starting', description: 'Starting operation', weight: 10, status: 'pending' },
        { id: 'process', name: 'Processing', description: 'Processing request', weight: 80, status: 'pending' },
        { id: 'complete', name: 'Completing', description: 'Finalizing operation', weight: 10, status: 'pending' },
      ];
  }
}