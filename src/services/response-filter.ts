/**
 * ResponseFilter Service
 * Filters and optimizes MCP responses based on token limits and extraction rules
 */

import { promises as fs } from 'fs';
import path from 'path';
import {
  FilteredResponse,
  ClusterSummary,
  ClusterDetails,
  ResponseFilterConfig,
  QdrantStorageMetadata,
} from '../types/response-filter.js';
import { ResponseFormatter } from './response-formatter.js';
import { QdrantStorageService } from './qdrant-storage.js';
import { QdrantManager } from './qdrant-manager.js';

export class ResponseFilter {
  private config: ResponseFilterConfig;
  private formatter: ResponseFormatter;
  private storage: QdrantStorageService | null;
  private qdrantManager: QdrantManager;
  private storageInitialized = false;
  private static instance: ResponseFilter;

  constructor(config: ResponseFilterConfig) {
    this.config = config;
    this.formatter = new ResponseFormatter(config);
    this.storage = null;
    this.qdrantManager = new QdrantManager({
      autoStart: true,
      preferredPort: 6333,
    });

    // Initialize Qdrant storage asynchronously with error handling
    this.initializeStorage(config.qdrant);
  }

  /**
   * Initialize Qdrant storage with graceful fallback and auto-startup
   */
  private async initializeStorage(qdrantConfig: any): Promise<void> {
    if (this.storageInitialized) return;

    try {
      // Try to auto-start Qdrant if not running
      const qdrantUrl = await this.qdrantManager.autoStart();

      if (qdrantUrl) {
        // Update config with actual URL
        const actualConfig = {
          ...qdrantConfig,
          url: qdrantUrl,
        };

        this.storage = new QdrantStorageService(actualConfig);

        // Test connection
        const isHealthy = await this.storage.healthCheck();
        if (!isHealthy) {
          console.warn('Qdrant auto-started but health check failed, disabling storage');
          this.storage = null;
        } else {
          console.log(`✅ Qdrant auto-started and connected successfully at ${qdrantUrl}`);
        }
      } else {
        // Try with original config (maybe user has Qdrant running elsewhere)
        this.storage = new QdrantStorageService(qdrantConfig);

        const isHealthy = await this.storage.healthCheck();
        if (!isHealthy) {
          console.warn('Qdrant not available and auto-start failed, disabling storage');
          this.storage = null;
        } else {
          console.log('Qdrant storage connected to existing instance');
        }
      }
    } catch (error) {
      console.warn('Qdrant storage unavailable, continuing without storage:', error);
      this.storage = null;
    }

    this.storageInitialized = true;
  }

  /**
   * Get singleton instance with loaded configuration
   */
  static async getInstance(): Promise<ResponseFilter> {
    if (!ResponseFilter.instance) {
      const config = await ResponseFilter.loadConfig();
      ResponseFilter.instance = new ResponseFilter(config);
    }
    return ResponseFilter.instance;
  }

  /**
   * Load configuration from file
   */
  private static async loadConfig(): Promise<ResponseFilterConfig> {
    try {
      const configPath = path.join(process.cwd(), 'config', 'response-filter.json');
      const configData = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(configData) as ResponseFilterConfig;

      // Validate required fields
      ResponseFilter.validateConfig(config);

      return config;
    } catch (error) {
      console.warn('Failed to load response filter config, using defaults:', error);
      return ResponseFilter.getDefaultConfig();
    }
  }

  /**
   * Validate configuration structure
   */
  private static validateConfig(config: any): void {
    const required = ['tokenLimits', 'extractionRules', 'qdrant', 'formatting'];
    for (const field of required) {
      if (!config[field]) {
        throw new Error(`Missing required config field: ${field}`);
      }
    }
  }

  /**
   * Get default configuration
   */
  private static getDefaultConfig(): ResponseFilterConfig {
    return {
      tokenLimits: {
        list_clusters: 500,
        get_cluster: 300,
        submit_hive_query: 400,
        get_query_results: 600,
        list_tracked_clusters: 350,
        check_active_jobs: 450,
        default: 400,
      },
      extractionRules: {
        list_clusters: {
          maxClusters: 10,
          essentialFields: ['clusterName', 'status', 'createTime', 'projectId', 'region'],
          summaryFormat: 'table',
        },
        get_cluster: {
          essentialSections: ['clusterName', 'status', 'config'],
          includeMetrics: false,
          includeHistory: false,
        },
        query_results: {
          maxRows: 20,
          includeSchema: true,
          summaryStats: true,
        },
        job_tracking: {
          maxJobs: 15,
          includeMetrics: true,
          groupByStatus: true,
        },
      },
      qdrant: {
        url: 'http://localhost:6333',
        collectionName: 'dataproc_responses',
        vectorSize: 384,
        distance: 'Cosine',
      },
      formatting: {
        useEmojis: true,
        compactTables: true,
        includeResourceLinks: true,
        maxLineLength: 120,
      },
      caching: {
        enabled: true,
        ttlSeconds: 300,
        maxCacheSize: 100,
      },
    };
  }

  /**
   * Retrieve stored response from Qdrant by resource ID
   */
  async getStoredResponse(resourceId: string): Promise<any | null> {
    if (!this.storage) {
      throw new Error('Qdrant storage not available');
    }

    try {
      return await this.storage.retrieveById(resourceId);
    } catch (error) {
      console.error('Failed to retrieve stored response:', error);
      return null;
    }
  }

  /**
   * Main response filtering method
   */
  async filterResponse(
    toolName: string,
    originalResponse: any,
    metadata?: Partial<QdrantStorageMetadata>
  ): Promise<FilteredResponse> {
    try {
      const originalTokens = this.estimateTokens(JSON.stringify(originalResponse));
      const tokenLimit =
        this.config.tokenLimits[toolName as keyof typeof this.config.tokenLimits] ||
        this.config.tokenLimits.default;

      // If response is already within limits, return as-is
      if (originalTokens <= tokenLimit) {
        return {
          type: 'full',
          content: JSON.stringify(originalResponse, null, 2),
          fullDataAvailable: false,
          tokensSaved: 0,
        };
      }

      // Extract essentials based on tool type
      let extractedData: any;
      let formattedContent: string;

      switch (toolName) {
        case 'list_clusters':
        case 'list_tracked_clusters':
          extractedData = this.extractClusterEssentials(originalResponse);
          formattedContent = this.formatter.formatClusterSummary(
            extractedData,
            originalTokens - this.estimateTokens(JSON.stringify(extractedData))
          );
          break;

        case 'get_cluster':
          extractedData = this.extractSingleClusterEssentials(originalResponse);
          formattedContent = this.formatter.formatClusterDetails(
            extractedData,
            originalTokens - this.estimateTokens(JSON.stringify(extractedData))
          );
          break;

        case 'submit_hive_query':
        case 'get_query_results':
          extractedData = this.extractQueryEssentials(originalResponse);
          formattedContent = this.formatter.formatQueryResults(
            extractedData.results,
            extractedData.schema,
            extractedData.stats,
            originalTokens - this.estimateTokens(JSON.stringify(extractedData))
          );
          break;

        case 'check_active_jobs':
        case 'get_job_status':
          extractedData = this.extractJobEssentials(originalResponse);
          formattedContent = this.formatter.formatJobSummary(
            extractedData,
            originalTokens - this.estimateTokens(JSON.stringify(extractedData))
          );
          break;

        default:
          // Generic filtering - truncate and summarize
          extractedData = this.genericExtraction(originalResponse, tokenLimit);
          formattedContent = JSON.stringify(extractedData, null, 2);
      }

      const filteredTokens = this.estimateTokens(formattedContent);
      const tokensSaved = originalTokens - filteredTokens;

      // Store full data in Qdrant if enabled and available
      let resourceUri: string | undefined;
      if (this.config.caching.enabled && this.storage) {
        try {
          const storageMetadata: QdrantStorageMetadata = {
            toolName,
            timestamp: new Date().toISOString(),
            responseType: 'filtered',
            originalTokenCount: originalTokens,
            filteredTokenCount: filteredTokens,
            compressionRatio: tokensSaved / originalTokens,
            ...metadata,
          };

          resourceUri = await this.storage.storeClusterData(originalResponse, storageMetadata);
        } catch (error) {
          console.warn('Failed to store data in Qdrant, continuing without storage:', error);
          // Continue without storage - don't fail the entire operation
        }
      }

      return {
        type: 'filtered',
        content: formattedContent,
        summary: this.generateSummary(extractedData, toolName),
        resourceUri,
        fullDataAvailable: !!resourceUri,
        tokensSaved,
      };
    } catch (error) {
      console.error('Error filtering response:', error);

      // Fallback to truncated original
      const truncated = JSON.stringify(originalResponse, null, 2).substring(0, 2000) + '...';
      return {
        type: 'summary',
        content: truncated,
        fullDataAvailable: false,
        tokensSaved: 0,
      };
    }
  }

  /**
   * Estimate token count (1 token ≈ 4 characters)
   */
  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Extract essential cluster information for list operations
   */
  private extractClusterEssentials(response: any): ClusterSummary[] {
    const clusters = response.clusters || response || [];
    const maxClusters = this.config.extractionRules.list_clusters.maxClusters;
    const essentialFields = this.config.extractionRules.list_clusters.essentialFields;

    return clusters.slice(0, maxClusters).map((cluster: any) => {
      const summary: ClusterSummary = {
        clusterName: cluster.clusterName || cluster.name || 'unknown',
        status: cluster.status?.state || cluster.status || 'unknown',
        createTime:
          cluster.status?.stateStartTime || cluster.createTime || new Date().toISOString(),
        projectId: cluster.projectId || 'unknown',
        region: this.extractRegion(cluster),
      };

      // Add optional fields if present and requested
      if (essentialFields.includes('machineType')) {
        summary.machineType = this.extractMachineTypeFromCluster(cluster);
      }

      if (essentialFields.includes('numWorkers')) {
        summary.numWorkers = cluster.config?.workerConfig?.numInstances || 0;
      }

      if (essentialFields.includes('labels') && cluster.labels) {
        summary.labels = cluster.labels;
      }

      return summary;
    });
  }

  /**
   * Extract essential information for single cluster details
   */
  private extractSingleClusterEssentials(response: any): ClusterDetails {
    const cluster = response.cluster || response;
    const essentialSections = this.config.extractionRules.get_cluster.essentialSections;

    const details: ClusterDetails = {
      clusterName: cluster.clusterName || cluster.name || 'unknown',
      projectId: cluster.projectId || 'unknown',
      region: this.extractRegion(cluster),
      status: cluster.status?.state || cluster.status || 'unknown',
      createTime: cluster.status?.stateStartTime || cluster.createTime || new Date().toISOString(),
      config: {},
    };

    // Extract configuration sections
    if (essentialSections.includes('config.masterConfig') && cluster.config?.masterConfig) {
      details.config.masterConfig = {
        numInstances: cluster.config.masterConfig.numInstances,
        machineTypeUri: cluster.config.masterConfig.machineTypeUri,
        diskConfig: cluster.config.masterConfig.diskConfig,
      };
    }

    if (essentialSections.includes('config.workerConfig') && cluster.config?.workerConfig) {
      details.config.workerConfig = {
        numInstances: cluster.config.workerConfig.numInstances,
        machineTypeUri: cluster.config.workerConfig.machineTypeUri,
        diskConfig: cluster.config.workerConfig.diskConfig,
      };
    }

    if (essentialSections.includes('config.softwareConfig') && cluster.config?.softwareConfig) {
      details.config.softwareConfig = {
        imageVersion: cluster.config.softwareConfig.imageVersion,
        optionalComponents: cluster.config.softwareConfig.optionalComponents,
      };
    }

    // Add labels if requested
    if (essentialSections.includes('labels') && cluster.labels) {
      details.labels = cluster.labels;
    }

    // Add metrics if enabled
    if (this.config.extractionRules.get_cluster.includeMetrics && cluster.metrics) {
      details.metrics = cluster.metrics;
    }

    // Add status history if enabled
    if (this.config.extractionRules.get_cluster.includeHistory && cluster.statusHistory) {
      details.statusHistory = cluster.statusHistory.slice(0, 5); // Limit to recent history
    }

    return details;
  }

  /**
   * Extract essential query/job result information
   */
  private extractQueryEssentials(response: any): any {
    const maxRows = this.config.extractionRules.query_results.maxRows;
    const includeSchema = this.config.extractionRules.query_results.includeSchema;
    const summaryStats = this.config.extractionRules.query_results.summaryStats;

    const extracted: any = {};

    // Extract results
    if (response.results || response.rows) {
      const results = response.results || response.rows;
      extracted.results = Array.isArray(results) ? results.slice(0, maxRows) : results;
    }

    // Extract schema
    if (includeSchema && response.schema) {
      extracted.schema = response.schema;
    }

    // Extract statistics
    if (summaryStats) {
      extracted.stats = {
        totalRows: response.totalRows || response.numRows,
        executionTime: response.executionTime || response.elapsedTime,
        bytesProcessed: response.bytesProcessed || response.totalBytesProcessed,
        jobId: response.jobId || response.reference?.jobId,
      };
    }

    return extracted;
  }

  /**
   * Extract essential job information
   */
  private extractJobEssentials(response: any): any[] {
    const jobs = response.jobs || response || [];
    const maxJobs = this.config.extractionRules.job_tracking.maxJobs;

    return jobs.slice(0, maxJobs).map((job: any) => ({
      reference: job.reference,
      placement: job.placement,
      status: job.status,
      statusHistory: job.statusHistory?.slice(0, 2), // Recent history only
      hiveJob: job.hiveJob ? { query: job.hiveJob.queryList?.queries?.[0] } : undefined,
      sparkJob: job.sparkJob ? { mainClass: job.sparkJob.mainClass } : undefined,
      pysparkJob: job.pysparkJob
        ? { mainPythonFileUri: job.pysparkJob.mainPythonFileUri }
        : undefined,
    }));
  }

  /**
   * Generic extraction for unknown response types
   */
  private genericExtraction(response: any, tokenLimit: number): any {
    const responseStr = JSON.stringify(response);
    const maxLength = tokenLimit * 4; // Convert tokens to approximate characters

    if (responseStr.length <= maxLength) {
      return response;
    }

    // Try to preserve structure while truncating
    if (Array.isArray(response)) {
      const itemSize = Math.floor(maxLength / response.length);
      return response.map((item) => {
        const itemStr = JSON.stringify(item);
        if (itemStr.length <= itemSize) return item;
        return JSON.parse(itemStr.substring(0, itemSize - 10) + '"}');
      });
    }

    // For objects, truncate string representation
    return JSON.parse(responseStr.substring(0, maxLength - 10) + '}');
  }

  /**
   * Helper: Extract region from cluster object
   */
  private extractRegion(cluster: any): string {
    if (cluster.region) return cluster.region;
    if (cluster.config?.gceClusterConfig?.zoneUri) {
      const parts = cluster.config.gceClusterConfig.zoneUri.split('/');
      const zone = parts[parts.length - 1];
      return zone.substring(0, zone.lastIndexOf('-')); // Convert zone to region
    }
    return 'unknown';
  }

  /**
   * Helper: Extract machine type from cluster configuration
   */
  private extractMachineTypeFromCluster(cluster: any): string | undefined {
    return (
      cluster.config?.masterConfig?.machineTypeUri || cluster.config?.workerConfig?.machineTypeUri
    );
  }

  /**
   * Generate a brief summary of the filtered data
   */
  private generateSummary(data: any, toolName: string): string {
    switch (toolName) {
      case 'list_clusters':
      case 'list_tracked_clusters':
        return `Found ${Array.isArray(data) ? data.length : 0} clusters`;

      case 'get_cluster':
        return `Cluster ${data.clusterName} (${data.status})`;

      case 'check_active_jobs':
        return `Found ${Array.isArray(data) ? data.length : 0} jobs`;

      default:
        return 'Response filtered and optimized';
    }
  }
}
