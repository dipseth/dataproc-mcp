/**
 * ResponseFilter Service
 * Filters and optimizes MCP responses based on token limits and extraction rules
 *
 * PHASE 2 ENHANCEMENT: Generic Converter Integration
 * - Integrated quickConvert() for simple conversions
 * - Added createGenericConverter() for complex configurations
 * - Enhanced error handling with fallback mechanisms
 * - Performance logging and metrics tracking
 * - Type-safe field mappings with automatic compression
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
import {
  DataprocApiResponse,
  DataprocJob,
  ExtractedQueryData,
  ResponseFilterConfigInput,
  isClusterResponse,
  isJobResponse,
  isQueryResultData,
  isValidQdrantConfig,
} from '../types/dataproc-responses.js';
import { ResponseFormatter } from './response-formatter.js';
import { QdrantStorageService } from './qdrant-storage.js';
import { QdrantManager } from './qdrant-manager.js';
import {
  GenericQdrantConverter,
  createGenericConverter,
  quickConvert,
} from './generic-converter.js';
import { CompressionService } from './compression.js';
import { ConversionConfig } from '../types/generic-converter.js';
import { performance } from 'perf_hooks';
import { logger } from '../utils/logger.js';

export class ResponseFilter {
  private config: ResponseFilterConfig;
  private formatter: ResponseFormatter;
  private storage: QdrantStorageService | null;
  private qdrantManager: QdrantManager;
  private storageInitialized = false;
  private static instance: ResponseFilter;

  // Phase 2: Generic Converter Integration
  private genericConverter: GenericQdrantConverter;
  private compressionService: CompressionService;

  constructor(config: ResponseFilterConfig) {
    this.config = config;
    this.formatter = new ResponseFormatter(config);
    this.storage = null;
    this.qdrantManager = new QdrantManager({
      autoStart: false, // DISABLED: Use centralized Qdrant discovery instead
      preferredPort: 6333,
    });

    // Phase 2: Initialize Generic Converter Integration
    this.compressionService = new CompressionService();
    this.genericConverter = createGenericConverter(this.compressionService);

    // Initialize Qdrant storage asynchronously with error handling
    this.initializeStorage(config.qdrant);
  }

  /**
   * Initialize Qdrant storage with graceful fallback and auto-startup
   */
  private async initializeStorage(qdrantConfig: Record<string, unknown>): Promise<void> {
    if (this.storageInitialized) return;

    try {
      // Use centralized Qdrant URL discovery instead of auto-start
      const { QdrantConnectionManager } = await import('./qdrant-connection-manager.js');
      const connectionManager = QdrantConnectionManager.getInstance();
      const qdrantUrl = await connectionManager.discoverQdrantUrl();

      if (qdrantUrl) {
        // Update config with discovered URL and validate
        const actualConfig = {
          ...qdrantConfig,
          url: qdrantUrl,
        };

        if (isValidQdrantConfig(actualConfig)) {
          this.storage = new QdrantStorageService(actualConfig);
        } else {
          console.warn('Invalid Qdrant configuration after auto-start, disabling storage');
          this.storage = null;
          return;
        }

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
        if (isValidQdrantConfig(qdrantConfig)) {
          this.storage = new QdrantStorageService(qdrantConfig);
          console.log(
            `🔍 [DEBUG] ResponseFilter initialized with Qdrant collection: ${qdrantConfig.collectionName}`
          );

          const isHealthy = await this.storage.healthCheck();
          if (!isHealthy) {
            console.warn('Qdrant not available via centralized discovery, disabling storage');
            this.storage = null;
          } else {
            console.log('Qdrant storage connected to existing instance');
          }
        } else {
          console.warn('Invalid Qdrant configuration provided, disabling storage');
          this.storage = null;
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
      // Try to use the same directory as the main server config
      let configPath: string;

      // eslint-disable-next-line no-undef
      if (global.DATAPROC_CONFIG_DIR) {
        // Use the same directory as server_main.json
        // eslint-disable-next-line no-undef
        configPath = path.join(global.DATAPROC_CONFIG_DIR, 'response-filter.json');
        console.log(
          `[INFO] Looking for response-filter.json in server config directory: ${configPath}`
        );
      } else {
        // Fallback to the old behavior
        configPath = path.join(process.cwd(), 'config', 'response-filter.json');
        console.log(`[INFO] Fallback: Looking for response-filter.json in: ${configPath}`);
      }

      const configData = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(configData) as ResponseFilterConfig;

      // Validate required fields
      ResponseFilter.validateConfig(config);

      console.log(`[SUCCESS] Loaded response filter configuration from: ${configPath}`);
      return config;
    } catch (error) {
      console.warn('Failed to load response filter config, using defaults:', error);
      return ResponseFilter.getDefaultConfig();
    }
  }

  /**
   * Validate configuration structure
   */
  private static validateConfig(config: ResponseFilterConfigInput): void {
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
        collectionName: 'dataproc_knowledge', // Unified collection for all Dataproc data
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
    originalResponse: DataprocApiResponse,
    metadata?: Partial<QdrantStorageMetadata>,
    semanticQuery?: string
  ): Promise<FilteredResponse> {
    try {
      const originalTokens = this.estimateTokens(JSON.stringify(originalResponse));
      const tokenLimit =
        this.config.tokenLimits[toolName as keyof typeof this.config.tokenLimits] ||
        this.config.tokenLimits.default;

      // STEP 1: Always store the full response in Qdrant first
      let resourceUri: string | undefined;
      if (this.config.caching.enabled && this.storage) {
        try {
          const storageMetadata: QdrantStorageMetadata = {
            toolName,
            timestamp: new Date().toISOString(),
            responseType: 'full_response',
            originalTokenCount: originalTokens,
            filteredTokenCount: 0, // Will be updated later
            compressionRatio: 0, // Will be updated later
            ...metadata,
          };

          resourceUri = await this.storage.storeClusterData(originalResponse, storageMetadata);
        } catch (error) {
          console.warn('Failed to store data in Qdrant, continuing without storage:', error);
        }
      }

      // STEP 2: Generate standard filtered response first
      let standardContent: string;
      let extractedData: unknown;

      // If response is already within limits and no semantic query, return as-is
      if (originalTokens <= tokenLimit && !semanticQuery) {
        return {
          type: 'full',
          content: JSON.stringify(originalResponse, null, 2),
          fullDataAvailable: !!resourceUri,
          tokensSaved: 0,
        };
      }

      // Extract essentials based on tool type

      switch (toolName) {
        case 'list_clusters':
        case 'list_tracked_clusters':
          extractedData = await this.extractClusterEssentials(originalResponse);
          standardContent = this.formatter.formatClusterSummary(
            extractedData as ClusterSummary[],
            originalTokens - this.estimateTokens(JSON.stringify(extractedData))
          );
          break;

        case 'get_cluster':
          extractedData = await this.extractSingleClusterEssentials(originalResponse);
          standardContent = this.formatter.formatClusterDetails(
            extractedData as ClusterDetails,
            originalTokens - this.estimateTokens(JSON.stringify(extractedData))
          );
          break;

        case 'submit_hive_query':
        case 'get_query_results': {
          extractedData = await this.extractQueryEssentials(originalResponse);
          const queryData = extractedData as ExtractedQueryData;
          standardContent = this.formatter.formatQueryResults(
            queryData.results,
            queryData.schema,
            queryData.stats,
            originalTokens - this.estimateTokens(JSON.stringify(extractedData))
          );
          break;
        }

        case 'check_active_jobs':
        case 'get_job_status':
          extractedData = this.extractJobEssentials(originalResponse);
          standardContent = this.formatter.formatJobSummary(
            extractedData as DataprocJob[],
            originalTokens - this.estimateTokens(JSON.stringify(extractedData))
          );
          break;

        default:
          // Generic filtering - truncate and summarize
          extractedData = await this.genericExtraction(originalResponse, tokenLimit);
          standardContent = JSON.stringify(extractedData, null, 2);
      }

      // STEP 3: If there's a semantic query, add semantic search results
      if (semanticQuery && this.storage && resourceUri) {
        try {
          console.log(
            `🔍 [DEBUG] Semantic query: "${semanticQuery}" - searching with threshold 0.1`
          );
          const semanticResults = await this.storage.searchSimilar(semanticQuery, 5, 0.1);
          console.log(`🔍 [DEBUG] Semantic search returned ${semanticResults.length} results`);

          if (semanticResults.length > 0) {
            const relevantData = semanticResults[0].data;
            const extractedContent = this.extractSemanticContent(semanticQuery, relevantData);

            // Combine standard content with semantic results
            const combinedContent = `${standardContent}\n\n---\n\n## 🔍 Semantic Search Results\n\n${extractedContent}`;
            const combinedTokens = this.estimateTokens(combinedContent);

            return {
              type: 'semantic',
              content: combinedContent,
              summary: `${this.generateSummary(extractedData, toolName)} + Semantic search for: "${semanticQuery}"`,
              resourceUri,
              fullDataAvailable: true,
              tokensSaved: originalTokens - combinedTokens,
            };
          }
        } catch (error) {
          console.warn('Semantic search failed, showing standard results only:', error);
        }
      }

      const filteredTokens = this.estimateTokens(standardContent);
      const tokensSaved = originalTokens - filteredTokens;

      // Update the stored metadata with filtering information
      if (resourceUri && this.storage) {
        try {
          // Note: In a production system, you'd want to update the metadata
          // For now, we'll just log that filtering was applied
          console.log(`Applied standard filtering, saved ${tokensSaved} tokens`);
        } catch (error) {
          console.warn('Failed to update metadata:', error);
        }
      }

      return {
        type: 'filtered',
        content: standardContent,
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
   * Phase 2: Enhanced with Generic Converter Integration
   */
  private async extractClusterEssentials(response: DataprocApiResponse): Promise<ClusterSummary[]> {
    const startTime = performance.now();

    try {
      const clusters = isClusterResponse(response)
        ? response.clusters || [response.cluster].filter(Boolean)
        : [];
      const maxClusters = this.config.extractionRules.list_clusters.maxClusters;
      const essentialFields = this.config.extractionRules.list_clusters.essentialFields;

      const results: ClusterSummary[] = [];

      for (const cluster of clusters.slice(0, maxClusters)) {
        if (!cluster) {
          results.push({
            clusterName: 'unknown',
            status: 'unknown',
            createTime: new Date().toISOString(),
            projectId: 'unknown',
            region: 'unknown',
          });
          continue;
        }

        try {
          // Phase 2: Use quickConvert for automatic field mapping and compression
          const metadata: QdrantStorageMetadata = {
            toolName: 'extractClusterEssentials',
            timestamp: new Date().toISOString(),
            responseType: 'cluster_summary',
            originalTokenCount: JSON.stringify(cluster).length / 4,
            filteredTokenCount: 0,
            compressionRatio: 1,
            projectId: cluster.projectId || 'unknown',
            region: this.extractRegion(cluster),
            clusterName: cluster.clusterName || (cluster as any).name || 'unknown',
            type: 'cluster',
          };

          const conversionResult = await quickConvert(cluster, metadata, this.compressionService);

          // Extract essential fields from converted payload
          // Extract status properly - always get the state string
          let statusString = 'unknown';
          if (conversionResult.payload.status) {
            statusString =
              typeof conversionResult.payload.status === 'string'
                ? conversionResult.payload.status
                : (conversionResult.payload.status as any)?.state || 'unknown';
          } else if ((cluster.status as any)?.state) {
            statusString = (cluster.status as any).state;
          } else if (typeof cluster.status === 'string') {
            statusString = cluster.status;
          }

          const summary: ClusterSummary = {
            clusterName: conversionResult.payload.clusterName || (cluster as any).name || 'unknown',
            status: statusString,
            createTime:
              conversionResult.payload.createTime ||
              (cluster.status as any)?.stateStartTime ||
              cluster.createTime ||
              new Date().toISOString(),
            projectId: conversionResult.payload.projectId || 'unknown',
            region: conversionResult.payload.region || this.extractRegion(cluster),
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

          results.push(summary);

          logger.debug('🔄 [RESPONSE-FILTER] Cluster extraction with generic converter', {
            clusterName: summary.clusterName,
            compressionRatio: conversionResult.metadata.compressionRatio,
            processingTime: `${conversionResult.metadata.processingTime.toFixed(2)}ms`,
          });
        } catch (conversionError) {
          // Fallback to manual extraction on conversion failure
          logger.warn('Generic converter failed for cluster, using manual extraction', {
            error:
              conversionError instanceof Error ? conversionError.message : String(conversionError),
            clusterName: cluster.clusterName || 'unknown',
          });

          const summary: ClusterSummary = {
            clusterName: cluster.clusterName || (cluster as any).name || 'unknown',
            status: (cluster.status as any)?.state || cluster.status || 'unknown',
            createTime:
              (cluster.status as any)?.stateStartTime ||
              cluster.createTime ||
              new Date().toISOString(),
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

          results.push(summary);
        }
      }

      const totalTime = performance.now() - startTime;
      logger.debug('🔄 [RESPONSE-FILTER] Cluster essentials extraction completed', {
        clustersProcessed: results.length,
        totalTime: `${totalTime.toFixed(2)}ms`,
      });

      return results;
    } catch (error) {
      // Complete fallback to original manual method
      logger.error('Complete failure in extractClusterEssentials, using original method', {
        error: error instanceof Error ? error.message : String(error),
      });

      const clusters = isClusterResponse(response)
        ? response.clusters || [response.cluster].filter(Boolean)
        : [];
      const maxClusters = this.config.extractionRules.list_clusters.maxClusters;
      const essentialFields = this.config.extractionRules.list_clusters.essentialFields;

      return clusters.slice(0, maxClusters).map((cluster) => {
        if (!cluster) {
          return {
            clusterName: 'unknown',
            status: 'unknown',
            createTime: new Date().toISOString(),
            projectId: 'unknown',
            region: 'unknown',
          };
        }

        const summary: ClusterSummary = {
          clusterName: cluster.clusterName || (cluster as any).name || 'unknown',
          status:
            (cluster.status as any)?.state ||
            (typeof cluster.status === 'string' ? cluster.status : 'unknown'),
          createTime:
            (cluster.status as any)?.stateStartTime ||
            cluster.createTime ||
            new Date().toISOString(),
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
  }

  /**
   * Extract essential information for single cluster details
   * Phase 2: Enhanced with Generic Converter Integration
   */
  private async extractSingleClusterEssentials(
    response: DataprocApiResponse
  ): Promise<ClusterDetails> {
    const startTime = performance.now();

    try {
      // Helper function to detect if response has cluster wrapper structure
      const hasClusterWrapper = (resp: any): boolean => {
        return resp && typeof resp === 'object' && ('cluster' in resp || 'clusters' in resp);
      };

      let cluster: any;

      if (hasClusterWrapper(response)) {
        // Response has cluster wrapper structure
        cluster = (response as any).cluster || (response as any).clusters?.[0];
      } else if (response && typeof response === 'object' && (response as any).clusterName) {
        // Response IS the cluster data directly
        cluster = response;
      } else {
        // Fallback for non-cluster responses
        return {
          clusterName: 'unknown',
          projectId: 'unknown',
          region: 'unknown',
          status: 'unknown',
          createTime: new Date().toISOString(),
          config: {},
        };
      }

      if (!cluster) {
        return {
          clusterName: 'unknown',
          projectId: 'unknown',
          region: 'unknown',
          status: 'unknown',
          createTime: new Date().toISOString(),
          config: {},
        };
      }

      try {
        // Phase 2: Use createGenericConverter for complex configuration extraction
        const metadata: QdrantStorageMetadata = {
          toolName: 'extractSingleClusterEssentials',
          timestamp: new Date().toISOString(),
          responseType: 'cluster_details',
          originalTokenCount: JSON.stringify(cluster).length / 4,
          filteredTokenCount: 0,
          compressionRatio: 1,
          projectId: cluster.projectId || 'unknown',
          region: this.extractRegion(cluster),
          clusterName: cluster.clusterName || cluster.name || 'unknown',
          type: 'cluster',
        };

        const config: ConversionConfig<any> = {
          fieldMappings: {
            clusterName: 'clusterName',
            projectId: 'projectId',
            region: 'region',
            status: 'status',
            createTime: 'createTime',
          },
          transformations: {
            clusterName: (value: any) => value || cluster.name || 'unknown',
            projectId: (value: any) => value || 'unknown',
            region: (value: any) => value || this.extractRegion(cluster),
            status: (value: any) => value?.state || value || 'unknown',
            createTime: (value: any) => value?.stateStartTime || value || new Date().toISOString(),
          },
          compressionRules: {
            fields: ['config', 'metrics', 'statusHistory'],
            sizeThreshold: 5120, // 5KB
            compressionType: 'gzip',
          },
        };

        const conversionResult = await this.genericConverter.convert(cluster, metadata, config);
        const essentialSections = this.config.extractionRules.get_cluster.essentialSections;

        const details: ClusterDetails = {
          clusterName: (conversionResult.payload as any).clusterName || 'unknown',
          projectId: (conversionResult.payload as any).projectId || 'unknown',
          region: (conversionResult.payload as any).region || 'unknown',
          status: (conversionResult.payload as any).status || 'unknown',
          createTime: (conversionResult.payload as any).createTime || new Date().toISOString(),
          config: {},
        };

        // Extract configuration sections using converted data
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

        const processingTime = performance.now() - startTime;
        logger.debug('🔄 [RESPONSE-FILTER] Single cluster extraction with generic converter', {
          clusterName: details.clusterName,
          compressionRatio: conversionResult.metadata.compressionRatio,
          processingTime: `${processingTime.toFixed(2)}ms`,
        });

        return details;
      } catch (conversionError) {
        // Fallback to manual extraction on conversion failure
        logger.warn('Generic converter failed for single cluster, using manual extraction', {
          error:
            conversionError instanceof Error ? conversionError.message : String(conversionError),
          clusterName: cluster.clusterName || cluster.name || 'unknown',
        });

        const essentialSections = this.config.extractionRules.get_cluster.essentialSections;

        const details: ClusterDetails = {
          clusterName: cluster.clusterName || cluster.name || 'unknown',
          projectId: cluster.projectId || 'unknown',
          region: this.extractRegion(cluster),
          status: cluster.status?.state || cluster.status || 'unknown',
          createTime:
            (cluster.status as any)?.stateStartTime ||
            cluster.createTime ||
            new Date().toISOString(),
          config: {},
        };

        // Extract configuration sections
        if (
          essentialSections.includes('config.masterConfig') &&
          (cluster as any).config?.masterConfig
        ) {
          details.config.masterConfig = {
            numInstances: (cluster as any).config.masterConfig.numInstances,
            machineTypeUri: (cluster as any).config.masterConfig.machineTypeUri,
            diskConfig: (cluster as any).config.masterConfig.diskConfig,
          };
        }

        if (
          essentialSections.includes('config.workerConfig') &&
          (cluster as any).config?.workerConfig
        ) {
          details.config.workerConfig = {
            numInstances: (cluster as any).config.workerConfig.numInstances,
            machineTypeUri: (cluster as any).config.workerConfig.machineTypeUri,
            diskConfig: (cluster as any).config.workerConfig.diskConfig,
          };
        }

        if (
          essentialSections.includes('config.softwareConfig') &&
          (cluster as any).config?.softwareConfig
        ) {
          details.config.softwareConfig = {
            imageVersion: (cluster as any).config.softwareConfig.imageVersion,
            optionalComponents: (cluster as any).config.softwareConfig.optionalComponents,
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
    } catch (error) {
      // Complete fallback to original manual method
      logger.error('Complete failure in extractSingleClusterEssentials, using original method', {
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        clusterName: 'unknown',
        projectId: 'unknown',
        region: 'unknown',
        status: 'unknown',
        createTime: new Date().toISOString(),
        config: {},
      };
    }
  }

  /**
   * Extract essential query/job result information
   * Phase 2: Enhanced with Generic Converter Integration
   */
  private async extractQueryEssentials(response: DataprocApiResponse): Promise<ExtractedQueryData> {
    const startTime = performance.now();

    try {
      const maxRows = this.config.extractionRules.query_results.maxRows;
      const includeSchema = this.config.extractionRules.query_results.includeSchema;
      const summaryStats = this.config.extractionRules.query_results.summaryStats;

      if (!isQueryResultData(response)) {
        return {};
      }

      try {
        // Phase 2: Use quickConvert for automatic field mapping and compression
        const metadata: QdrantStorageMetadata = {
          toolName: 'extractQueryEssentials',
          timestamp: new Date().toISOString(),
          responseType: 'query_results',
          originalTokenCount: JSON.stringify(response).length / 4,
          filteredTokenCount: 0,
          compressionRatio: 1,
          projectId: (response as any).projectId || 'unknown',
          region: (response as any).region || 'unknown',
          clusterName: (response as any).clusterName || 'unknown',
          type: 'query',
        };

        const conversionResult = await quickConvert(response, metadata, this.compressionService);
        const payload = conversionResult.payload as any;

        const extracted: ExtractedQueryData = {};

        // Extract results with automatic compression
        if (payload.results || payload.rows || response.results || response.rows) {
          const results = payload.results || payload.rows || response.results || response.rows;
          extracted.results = Array.isArray(results) ? results.slice(0, maxRows) : results;
        }

        // Extract schema
        if (includeSchema && (payload.schema || response.schema)) {
          extracted.schema = payload.schema || response.schema;
        }

        // Extract statistics with enhanced field mapping
        if (summaryStats) {
          extracted.stats = {
            totalRows:
              payload.totalRows || payload.numRows || response.totalRows || response.numRows,
            executionTime:
              payload.executionTime ||
              payload.elapsedTime ||
              response.executionTime ||
              response.elapsedTime,
            bytesProcessed:
              payload.bytesProcessed ||
              payload.totalBytesProcessed ||
              response.bytesProcessed ||
              response.totalBytesProcessed,
            jobId:
              payload.jobId ||
              payload.reference?.jobId ||
              response.jobId ||
              response.reference?.jobId,
          };
        }

        const processingTime = performance.now() - startTime;
        logger.debug('🔄 [RESPONSE-FILTER] Query extraction with generic converter', {
          jobId: extracted.stats?.jobId || 'unknown',
          compressionRatio: conversionResult.metadata.compressionRatio,
          processingTime: `${processingTime.toFixed(2)}ms`,
        });

        return extracted;
      } catch (conversionError) {
        // Fallback to manual extraction on conversion failure
        logger.warn('Generic converter failed for query results, using manual extraction', {
          error:
            conversionError instanceof Error ? conversionError.message : String(conversionError),
          jobId: (response as any).jobId || 'unknown',
        });

        const extracted: ExtractedQueryData = {};

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
    } catch (error) {
      // Complete fallback to original manual method
      logger.error('Complete failure in extractQueryEssentials, using original method', {
        error: error instanceof Error ? error.message : String(error),
      });

      const maxRows = this.config.extractionRules.query_results.maxRows;
      const includeSchema = this.config.extractionRules.query_results.includeSchema;
      const summaryStats = this.config.extractionRules.query_results.summaryStats;

      const extracted: ExtractedQueryData = {};

      if (isQueryResultData(response)) {
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
      }

      return extracted;
    }
  }

  /**
   * Extract essential job information
   */
  private extractJobEssentials(response: DataprocApiResponse): DataprocJob[] {
    if (!isJobResponse(response)) {
      return [];
    }

    const jobs = response.jobs || [];
    const maxJobs = this.config.extractionRules.job_tracking.maxJobs;

    return jobs.slice(0, maxJobs).map((job) => ({
      ...job,
      statusHistory: job.statusHistory?.slice(0, 2), // Recent history only
      hiveJob: job.hiveJob
        ? { queryList: { queries: job.hiveJob.queryList?.queries?.slice(0, 1) } }
        : undefined,
      sparkJob: job.sparkJob ? { mainClass: job.sparkJob.mainClass } : undefined,
      pysparkJob: job.pysparkJob
        ? { mainPythonFileUri: job.pysparkJob.mainPythonFileUri }
        : undefined,
    }));
  }

  /**
   * Generic extraction for unknown response types
   * Phase 2: Enhanced with Generic Converter Integration
   */
  private async genericExtraction(
    response: DataprocApiResponse,
    tokenLimit: number
  ): Promise<unknown> {
    const startTime = performance.now();

    try {
      const responseStr = JSON.stringify(response);
      const maxLength = tokenLimit * 4; // Convert tokens to approximate characters

      if (responseStr.length <= maxLength) {
        return response;
      }

      try {
        // Phase 2: Use quickConvert for intelligent compression and field optimization
        const metadata: QdrantStorageMetadata = {
          toolName: 'genericExtraction',
          timestamp: new Date().toISOString(),
          responseType: 'generic',
          originalTokenCount: responseStr.length / 4,
          filteredTokenCount: 0,
          compressionRatio: 1,
          projectId: (response as any).projectId || 'unknown',
          region: (response as any).region || 'unknown',
          clusterName: (response as any).clusterName || 'unknown',
          type: 'generic',
        };

        const conversionResult = await quickConvert(
          response as any,
          metadata,
          this.compressionService
        );

        // Check if conversion resulted in size reduction
        const convertedStr = JSON.stringify(conversionResult.payload);
        if (convertedStr.length <= maxLength) {
          const processingTime = performance.now() - startTime;
          logger.debug('🔄 [RESPONSE-FILTER] Generic extraction with compression successful', {
            originalSize: responseStr.length,
            compressedSize: convertedStr.length,
            compressionRatio: conversionResult.metadata.compressionRatio,
            processingTime: `${processingTime.toFixed(2)}ms`,
          });

          return conversionResult.payload;
        }

        // If still too large, apply additional truncation to compressed data
        logger.debug(
          '🔄 [RESPONSE-FILTER] Generic extraction applying additional truncation after compression',
          {
            originalSize: responseStr.length,
            compressedSize: convertedStr.length,
            targetSize: maxLength,
          }
        );

        return this.applyStructuralTruncation(conversionResult.payload, maxLength);
      } catch (conversionError) {
        // Fallback to manual truncation on conversion failure
        logger.warn('Generic converter failed for generic extraction, using manual truncation', {
          error:
            conversionError instanceof Error ? conversionError.message : String(conversionError),
          responseSize: responseStr.length,
        });

        return this.applyStructuralTruncation(response, maxLength);
      }
    } catch (error) {
      // Complete fallback to original manual method
      logger.error('Complete failure in genericExtraction, using original method', {
        error: error instanceof Error ? error.message : String(error),
      });

      const responseStr = JSON.stringify(response);
      const maxLength = tokenLimit * 4;

      if (responseStr.length <= maxLength) {
        return response;
      }

      return this.applyStructuralTruncation(response, maxLength);
    }
  }

  /**
   * Apply structural truncation while preserving data integrity
   */
  private applyStructuralTruncation(response: unknown, maxLength: number): unknown {
    try {
      // Try to preserve structure while truncating
      if (Array.isArray(response)) {
        const itemSize = Math.floor(maxLength / response.length);
        return response.map((item) => {
          const itemStr = JSON.stringify(item);
          if (itemStr.length <= itemSize) return item;

          // Try to truncate gracefully
          try {
            return JSON.parse(itemStr.substring(0, itemSize - 10) + '"}');
          } catch {
            return { truncated: true, originalSize: itemStr.length };
          }
        });
      }

      // For objects, truncate string representation
      const responseStr = JSON.stringify(response);
      try {
        return JSON.parse(responseStr.substring(0, maxLength - 10) + '}');
      } catch {
        return {
          truncated: true,
          originalSize: responseStr.length,
          preview: responseStr.substring(0, Math.min(500, maxLength - 100)),
        };
      }
    } catch (error) {
      return {
        error: 'Truncation failed',
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Helper: Extract region from cluster object
   */
  private extractRegion(cluster: unknown): string {
    const clusterObj = cluster as any;
    if (clusterObj?.region) return clusterObj.region;
    if (clusterObj?.config?.gceClusterConfig?.zoneUri) {
      const parts = clusterObj.config.gceClusterConfig.zoneUri.split('/');
      const zone = parts[parts.length - 1];
      return zone.substring(0, zone.lastIndexOf('-')); // Convert zone to region
    }
    return 'unknown';
  }

  /**
   * Helper: Extract machine type from cluster configuration
   */
  private extractMachineTypeFromCluster(cluster: unknown): string | undefined {
    const clusterObj = cluster as any;
    return (
      clusterObj?.config?.masterConfig?.machineTypeUri ||
      clusterObj?.config?.workerConfig?.machineTypeUri
    );
  }

  /**
   * Generate a brief summary of the filtered data
   */
  private generateSummary(data: unknown, toolName: string): string {
    switch (toolName) {
      case 'list_clusters':
      case 'list_tracked_clusters':
        return `Found ${Array.isArray(data) ? data.length : 0} clusters`;

      case 'get_cluster': {
        const clusterData = data as any;
        return `Cluster ${clusterData?.clusterName || 'unknown'} (${clusterData?.status || 'unknown'})`;
      }

      case 'check_active_jobs':
        return `Found ${Array.isArray(data) ? data.length : 0} jobs`;

      default:
        return 'Response filtered and optimized';
    }
  }

  /**
   * Extract semantic content based on user query
   */
  private extractSemanticContent(query: string, data: unknown): string {
    const lowerQuery = query.toLowerCase();

    try {
      // Convert data to searchable text
      const dataStr = JSON.stringify(data, null, 2);

      // Pip packages extraction
      if (
        lowerQuery.includes('pip') ||
        lowerQuery.includes('package') ||
        lowerQuery.includes('python')
      ) {
        return this.extractPipPackagesContent(data);
      }

      // Machine type extraction
      if (
        lowerQuery.includes('machine') ||
        lowerQuery.includes('hardware') ||
        lowerQuery.includes('cpu')
      ) {
        return this.extractMachineTypeContent(data);
      }

      // Network configuration extraction
      if (
        lowerQuery.includes('network') ||
        lowerQuery.includes('subnet') ||
        lowerQuery.includes('vpc')
      ) {
        return this.extractNetworkContent(data);
      }

      // Software configuration extraction
      if (
        lowerQuery.includes('software') ||
        lowerQuery.includes('initialization') ||
        lowerQuery.includes('script')
      ) {
        return this.extractSoftwareContent(data);
      }

      // Default: return relevant sections based on query terms
      const queryTerms = lowerQuery.split(' ').filter((term) => term.length > 2);
      const relevantSections: string[] = [];

      for (const term of queryTerms) {
        const regex = new RegExp(term, 'gi');
        const matches = dataStr.match(regex);
        if (matches) {
          // Find context around matches
          const lines = dataStr.split('\n');
          lines.forEach((line, index) => {
            if (regex.test(line)) {
              const start = Math.max(0, index - 2);
              const end = Math.min(lines.length, index + 3);
              const context = lines.slice(start, end).join('\n');
              relevantSections.push(context);
            }
          });
        }
      }

      if (relevantSections.length > 0) {
        return `**Semantic Search Results for "${query}":**\n\n${relevantSections.join('\n\n---\n\n')}`;
      }

      // Fallback: return formatted summary
      return `**Search Results for "${query}":**\n\n${dataStr.substring(0, 1000)}${dataStr.length > 1000 ? '...' : ''}`;
    } catch (error) {
      console.error('Failed to extract semantic content:', error);
      return `**Search Results for "${query}":**\n\nError extracting content: ${error}`;
    }
  }

  private extractPipPackagesContent(data: unknown): string {
    try {
      const dataObj = data as unknown;
      const lines: string[] = ['**🐍 Python Pip Packages:**\n'];

      // Look for pip packages in various locations
      const pipPackages = this.findPipPackages(dataObj);

      if (pipPackages.length > 0) {
        lines.push('**Installed Packages:**');
        pipPackages.forEach((pkg) => {
          lines.push(`- ${pkg}`);
        });
      } else {
        lines.push('No pip packages found in this response.');
      }

      return lines.join('\n');
    } catch (error) {
      return `Error extracting pip packages: ${error}`;
    }
  }

  private extractMachineTypeContent(data: unknown): string {
    try {
      const dataObj = data as any;
      const lines: string[] = ['**🖥️ Machine Configuration:**\n'];

      // Extract machine types from cluster config
      const machineTypes = this.findMachineTypes(dataObj);

      if (machineTypes.length > 0) {
        machineTypes.forEach((config) => {
          lines.push(`**${config.type}:**`);
          lines.push(`- Machine Type: ${config.machineType}`);
          lines.push(`- Instances: ${config.instances}`);
          if (config.diskSize) lines.push(`- Disk: ${config.diskSize}GB ${config.diskType || ''}`);
          lines.push('');
        });
      } else {
        lines.push('No machine configuration found in this response.');
      }

      return lines.join('\n');
    } catch (error) {
      return `Error extracting machine configuration: ${error}`;
    }
  }

  private extractNetworkContent(data: unknown): string {
    try {
      const dataObj = data as any;
      const lines: string[] = ['**🌐 Network Configuration:**\n'];

      const networkConfig = this.findNetworkConfig(dataObj);

      if (networkConfig) {
        if (networkConfig.zone) lines.push(`- Zone: ${networkConfig.zone}`);
        if (networkConfig.subnet) lines.push(`- Subnet: ${networkConfig.subnet}`);
        if (networkConfig.network) lines.push(`- Network: ${networkConfig.network}`);
        if (networkConfig.serviceAccount)
          lines.push(`- Service Account: ${networkConfig.serviceAccount}`);
        if (networkConfig.internalIpOnly !== undefined)
          lines.push(`- Internal IP Only: ${networkConfig.internalIpOnly}`);
        if (networkConfig.tags && networkConfig.tags.length > 0) {
          lines.push(`- Tags: ${networkConfig.tags.join(', ')}`);
        }
      } else {
        lines.push('No network configuration found in this response.');
      }

      return lines.join('\n');
    } catch (error) {
      return `Error extracting network configuration: ${error}`;
    }
  }

  private extractSoftwareContent(data: unknown): string {
    try {
      const dataObj = data as any;
      const lines: string[] = ['**📦 Software Configuration:**\n'];

      const softwareConfig = this.findSoftwareConfig(dataObj);

      if (softwareConfig) {
        if (softwareConfig.imageVersion)
          lines.push(`- Image Version: ${softwareConfig.imageVersion}`);
        if (softwareConfig.components && softwareConfig.components.length > 0) {
          lines.push(`- Optional Components: ${softwareConfig.components.join(', ')}`);
        }
        if (softwareConfig.initActions && softwareConfig.initActions.length > 0) {
          lines.push('- Initialization Actions:');
          softwareConfig.initActions.forEach((action: string) => {
            lines.push(`  - ${action}`);
          });
        }
        if (softwareConfig.properties && Object.keys(softwareConfig.properties).length > 0) {
          lines.push('- Properties:');
          Object.entries(softwareConfig.properties).forEach(([key, value]) => {
            lines.push(`  - ${key}: ${value}`);
          });
        }
      } else {
        lines.push('No software configuration found in this response.');
      }

      return lines.join('\n');
    } catch (error) {
      return `Error extracting software configuration: ${error}`;
    }
  }

  private findPipPackages(data: any): string[] {
    const packages: string[] = [];

    // Recursive search for pip packages
    const search = (obj: any) => {
      if (typeof obj === 'object' && obj !== null) {
        for (const [key, value] of Object.entries(obj)) {
          if (key.includes('pip.packages') && typeof value === 'string') {
            const pkgs = value.split(',').map((pkg) => pkg.trim());
            packages.push(...pkgs);
          } else if (typeof value === 'object') {
            search(value);
          }
        }
      }
    };

    search(data);
    return [...new Set(packages)]; // Remove duplicates
  }

  private findMachineTypes(data: any): Array<{
    type: string;
    machineType: string;
    instances: number;
    diskSize?: number;
    diskType?: string;
  }> {
    const configs: Array<{
      type: string;
      machineType: string;
      instances: number;
      diskSize?: number;
      diskType?: string;
    }> = [];

    // Look for cluster configurations
    const search = (obj: any, path: string = '') => {
      if (typeof obj === 'object' && obj !== null) {
        // Check for master config
        if (obj.masterConfig) {
          const config = obj.masterConfig;
          if (config.machineTypeUri) {
            configs.push({
              type: 'Master',
              machineType: this.extractMachineTypeFromUri(config.machineTypeUri),
              instances: config.numInstances || 1,
              diskSize: config.diskConfig?.bootDiskSizeGb,
              diskType: config.diskConfig?.bootDiskType,
            });
          }
        }

        // Check for worker config
        if (obj.workerConfig) {
          const config = obj.workerConfig;
          if (config.machineTypeUri) {
            configs.push({
              type: 'Worker',
              machineType: this.extractMachineTypeFromUri(config.machineTypeUri),
              instances: config.numInstances || 0,
              diskSize: config.diskConfig?.bootDiskSizeGb,
              diskType: config.diskConfig?.bootDiskType,
            });
          }
        }

        // Recurse into nested objects
        for (const value of Object.values(obj)) {
          if (typeof value === 'object') {
            search(value, path);
          }
        }
      }
    };

    search(data);
    return configs;
  }

  private findNetworkConfig(data: any): any {
    let networkConfig: any = {};

    const search = (obj: any) => {
      if (typeof obj === 'object' && obj !== null) {
        // Look for GCE cluster config
        if (obj.gceClusterConfig) {
          const gceConfig = obj.gceClusterConfig;
          networkConfig = {
            zone: gceConfig.zoneUri ? this.extractZoneFromUri(gceConfig.zoneUri) : undefined,
            subnet: gceConfig.subnetworkUri,
            network: gceConfig.networkUri,
            serviceAccount: gceConfig.serviceAccount,
            internalIpOnly: gceConfig.internalIpOnly,
            tags: gceConfig.tags,
          };
        }

        // Recurse into nested objects
        for (const value of Object.values(obj)) {
          if (typeof value === 'object') {
            search(value);
          }
        }
      }
    };

    search(data);
    return Object.keys(networkConfig).length > 0 ? networkConfig : null;
  }

  private findSoftwareConfig(data: any): any {
    let softwareConfig: any = {};

    const search = (obj: any) => {
      if (typeof obj === 'object' && obj !== null) {
        // Look for software config
        if (obj.softwareConfig) {
          const config = obj.softwareConfig;
          softwareConfig = {
            imageVersion: config.imageVersion,
            components: config.optionalComponents,
            properties: config.properties,
          };
        }

        // Look for initialization actions
        if (obj.initializationActions) {
          softwareConfig.initActions = obj.initializationActions.map(
            (action: any) => action.executableFile
          );
        }

        // Recurse into nested objects
        for (const value of Object.values(obj)) {
          if (typeof value === 'object') {
            search(value);
          }
        }
      }
    };

    search(data);
    return Object.keys(softwareConfig).length > 0 ? softwareConfig : null;
  }

  private extractMachineTypeFromUri(uri: string): string {
    if (!uri) return 'unknown';
    const parts = uri.split('/');
    return parts[parts.length - 1] || 'unknown';
  }

  private extractZoneFromUri(uri: string): string {
    if (!uri) return 'unknown';
    const match = uri.match(/zones\/([^/]+)/);
    return match ? match[1] : 'unknown';
  }

  /**
   * Phase 2: Get conversion metrics for monitoring and performance tracking
   */
  getConversionMetrics() {
    return this.genericConverter.getMetrics();
  }

  /**
   * Phase 2: Reset conversion metrics
   */
  resetConversionMetrics(): void {
    this.genericConverter.resetMetrics();
  }

  /**
   * Phase 2: Get compression service for external access
   */
  getCompressionService() {
    return this.compressionService;
  }
}
