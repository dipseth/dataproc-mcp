/**
 * Knowledge Indexer Service
 *
 * This service is the core of the semantic search feature, providing intelligent
 * data extraction and indexing capabilities for Dataproc infrastructure.
 *
 * FEATURES:
 * - Builds and maintains a comprehensive knowledge base of cluster configurations
 * - Extracts meaningful information from Hive query outputs (first few rows/columns)
 * - Tracks job submission patterns (Hive, Spark, PySpark, etc.)
 * - Indexes error patterns and troubleshooting information
 * - Enables natural language queries against stored data
 *
 * GRACEFUL DEGRADATION:
 * - Works with or without Qdrant vector database
 * - Provides helpful setup guidance when Qdrant is unavailable
 * - Core functionality never breaks regardless of optional dependencies
 *
 * KNOWLEDGE BASE STRUCTURE:
 * - Cluster configurations: machine types, worker counts, components
 * - Package information: pip packages, initialization scripts
 * - Network configurations: zones, subnets, service accounts
 * - Operational data: creation times, owners, environments
 *
 * USAGE:
 * - Automatically indexes data from list_clusters and get_cluster operations
 * - Powers semantic queries like "show me clusters with machine learning packages"
 * - Provides confidence scoring for search results
 * - Supports filtering by project, region, and cluster name
 */

import { QdrantStorageService } from './qdrant-storage.js';
import { TransformersEmbeddingService } from './transformers-embeddings.js';
import { ClusterConfig } from '../types/cluster-config.js';
import { QueryResultResponse as ApiQueryResultResponse } from '../types/response.js';
import { ErrorInfo } from '../types/dataproc-responses.js';
import { logger } from '../utils/logger.js';

// Type for cluster data that includes metadata beyond just config
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

export interface ClusterKnowledge {
  clusterName: string;
  projectId: string;
  region: string;
  firstSeen: string;
  lastSeen: string;
  configurations: {
    machineTypes: string[];
    workerCounts: number[];
    components: string[];
    pipelines: string[];
    owners: string[];
    imageVersions: string[];
  };
  pipPackages: string[];
  initializationScripts: string[];
  networkConfig: {
    zones: string[];
    subnets: string[];
    serviceAccounts: string[];
  };
}

export interface JobKnowledge {
  jobId: string;
  jobType: 'hive' | 'spark' | 'pyspark' | 'presto' | 'other';
  clusterName: string;
  projectId: string;
  region: string;
  submissionTime: string;
  query?: string;
  status: string;
  duration?: number;
  results?: ApiQueryResultResponse; // Add results property
  outputSample?: {
    columns: string[];
    rows: unknown[][];
    totalRows?: number;
  };
  errorInfo?: {
    errorType: string;
    errorMessage: string;
    stackTrace?: string;
    commonCause?: string;
    suggestedFix?: string;
  };
}

export interface ErrorPattern {
  errorType: string;
  pattern: string;
  frequency: number;
  commonCauses: string[];
  suggestedFixes: string[];
  relatedClusters: string[];
  relatedJobTypes: string[];
  examples: {
    jobId: string;
    clusterName: string;
    timestamp: string;
    context: string;
  }[];
}

interface FormattedSearchResult {
  type: string;
  confidence: number;
  data: ClusterKnowledge | JobKnowledge | ErrorPattern;
  summary: string;
}

export class KnowledgeIndexer {
  private qdrantService: QdrantStorageService;
  private embeddingService: TransformersEmbeddingService;
  private clusterKnowledge: Map<string, ClusterKnowledge> = new Map();
  private jobKnowledge: Map<string, JobKnowledge> = new Map();
  private errorPatterns: Map<string, ErrorPattern> = new Map();

  constructor(qdrantConfig?: {
    url?: string;
    collectionName?: string;
    vectorSize?: number;
    distance?: 'Cosine' | 'Euclidean' | 'Dot';
  }) {
    // Initialize with placeholder config - will be updated during initialization
    const config = {
      url: qdrantConfig?.url || 'http://localhost:6333',
      collectionName: qdrantConfig?.collectionName || 'dataproc_knowledge',
      vectorSize: qdrantConfig?.vectorSize || 384,
      distance: qdrantConfig?.distance || ('Cosine' as const),
    };

    this.qdrantService = new QdrantStorageService(config);
    this.embeddingService = new TransformersEmbeddingService();
  }

  /**
   * Initialize with connection discovery
   */
  private async initializeWithConnectionManager(qdrantConfig?: {
    url?: string;
    collectionName?: string;
    vectorSize?: number;
    distance?: 'Cosine' | 'Euclidean' | 'Dot';
  }): Promise<void> {
    try {
      const { getQdrantUrl } = await import('./qdrant-connection-manager.js');

      // Discover working Qdrant URL
      const discoveredUrl = await getQdrantUrl({ url: qdrantConfig?.url });

      if (!discoveredUrl) {
        throw new Error('No working Qdrant URL discovered. Cannot initialize KnowledgeIndexer.');
      }

      const config = {
        url: discoveredUrl, // ONLY use verified URL - NO FALLBACKS
        collectionName: qdrantConfig?.collectionName || 'dataproc_knowledge',
        vectorSize: qdrantConfig?.vectorSize || 384,
        distance: qdrantConfig?.distance || ('Cosine' as const),
      };

      // Recreate QdrantStorageService with discovered URL
      this.qdrantService = new QdrantStorageService(config);

      logger.info(`🧠 [KNOWLEDGE-INDEXER] Initialized with URL: ${config.url}`);
    } catch (error) {
      logger.error('Failed to initialize KnowledgeIndexer with connection manager:', error);
      throw error;
    }
  }

  /**
   * Initialize the knowledge indexer (ensures Qdrant collection exists)
   */
  async initialize(qdrantConfig?: {
    url?: string;
    collectionName?: string;
    vectorSize?: number;
    distance?: 'Cosine' | 'Euclidean' | 'Dot';
  }): Promise<void> {
    try {
      // First, discover the working Qdrant URL
      await this.initializeWithConnectionManager(qdrantConfig);

      // Then initialize the underlying Qdrant service
      await this.qdrantService.initialize();
      logger.info('🧠 Knowledge indexer initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize knowledge indexer:', error);
      throw error;
    }
  }

  /**
   * Get collection information for debugging
   */
  getCollectionInfo(): { collectionName: string; url: string } {
    return {
      collectionName: 'dataproc_knowledge', // Hard-coded since config is private
      url: 'configured', // Can't access private config
    };
  }

  /**
   * Index cluster configuration when first encountered
   */
  async indexClusterConfiguration(clusterData: ClusterData): Promise<void> {
    try {
      const clusterName = clusterData.clusterName || 'unknown';
      const projectId = clusterData.projectId || 'unknown';
      const region = this.extractRegion(clusterData);
      const key = `${projectId}/${region}/${clusterName}`;

      let knowledge = this.clusterKnowledge.get(key);
      const now = new Date().toISOString();

      if (!knowledge) {
        // First time seeing this cluster
        knowledge = {
          clusterName,
          projectId,
          region,
          firstSeen: now,
          lastSeen: now,
          configurations: {
            machineTypes: [],
            workerCounts: [],
            components: [],
            pipelines: [],
            owners: [],
            imageVersions: [],
          },
          pipPackages: [],
          initializationScripts: [],
          networkConfig: {
            zones: [],
            subnets: [],
            serviceAccounts: [],
          },
        };

        logger.info(`🆕 New cluster discovered: ${clusterName} in ${projectId}/${region}`);
      } else {
        knowledge.lastSeen = now;
      }

      // Extract and update configuration knowledge
      this.updateClusterKnowledge(knowledge, clusterData);

      // Store in memory and Qdrant
      this.clusterKnowledge.set(key, knowledge);
      await this.storeClusterKnowledge(knowledge);
    } catch (error) {
      logger.error('Failed to index cluster configuration:', error);
    }
  }

  /**
   * Index job submission and results
   */
  async indexJobSubmission(jobData: {
    jobId: string;
    jobType: string;
    clusterName: string;
    projectId: string;
    region: string;
    query?: string;
    status: string;
    submissionTime?: string;
    duration?: number;
    results?: unknown;
    error?: unknown;
  }): Promise<void> {
    try {
      const jobKnowledge: JobKnowledge = {
        jobId: jobData.jobId,
        jobType: this.normalizeJobType(jobData.jobType),
        clusterName: jobData.clusterName,
        projectId: jobData.projectId,
        region: jobData.region,
        submissionTime: jobData.submissionTime || new Date().toISOString(),
        query: jobData.query,
        status: jobData.status,
        duration: jobData.duration,
      };

      // Extract output sample if available
      if (jobData.results) {
        jobKnowledge.outputSample = this.extractOutputSample(jobData.results);
      }

      // Extract error information if available
      if (jobData.error) {
        jobKnowledge.errorInfo = this.extractErrorInfo(jobData.error);
        await this.indexErrorPattern(jobKnowledge.errorInfo, jobKnowledge);
      }

      // Store job knowledge
      this.jobKnowledge.set(jobData.jobId, jobKnowledge);
      await this.storeJobKnowledge(jobKnowledge);

      logger.info(`📝 Indexed ${jobData.jobType} job: ${jobData.jobId} on ${jobData.clusterName}`);
    } catch (error) {
      logger.error('Failed to index job submission:', error);
    }
  }

  /**
   * Query knowledge base using natural language
   */
  async queryKnowledge(
    query: string,
    options: {
      type?: 'clusters' | 'cluster' | 'jobs' | 'job' | 'errors' | 'error' | 'all';
      limit?: number;
      projectId?: string;
      region?: string;
    } = {}
  ): Promise<FormattedSearchResult[]> {
    try {
      if (process.env.LOG_LEVEL === 'debug') {
        console.error(
          `[DEBUG] KnowledgeIndexer.queryKnowledge: Query="${query}", Type="${options.type}"`
        );
      }

      const searchResults = await this.qdrantService.searchSimilar(query, options.limit || 10);

      if (process.env.LOG_LEVEL === 'debug') {
        console.error(
          `[DEBUG] KnowledgeIndexer.queryKnowledge: Found ${searchResults.length} initial results`
        );
        searchResults.forEach((result, i) => {
          const storedType = (result.data as { type?: string })?.type || result.metadata?.type;
          console.error(
            `[DEBUG] Result ${i}: Type="${storedType}", Score=${result.score}, ID=${result.id}`
          );
        });
      }

      // Filter by type if specified with flexible matching
      let filteredResults = searchResults;
      if (options.type && options.type !== 'all') {
        filteredResults = searchResults.filter((result) => {
          // Extract type from the stored data or metadata
          const storedType = (result.data as { type?: string })?.type || result.metadata?.type;

          // Flexible type matching - handle both singular/plural and case variations
          if (!storedType) {
            if (process.env.LOG_LEVEL === 'debug') {
              console.error(
                `[DEBUG] KnowledgeIndexer.queryKnowledge: Result ${result.id} has no type, filtering out`
              );
            }
            return false;
          }

          const normalizedStoredType = storedType.toLowerCase();
          const normalizedQueryType = (options.type || '').toLowerCase();

          // Direct match
          if (normalizedStoredType === normalizedQueryType) return true;

          // Handle singular/plural variations
          const singularForms = {
            clusters: 'cluster',
            jobs: 'job',
            errors: 'error',
          };

          const pluralForms = {
            cluster: 'clusters',
            job: 'jobs',
            error: 'errors',
          };

          // Check if query type matches stored type in singular/plural form
          if (singularForms[normalizedQueryType] === normalizedStoredType) return true;
          if (pluralForms[normalizedQueryType] === normalizedStoredType) return true;

          return false;
        });
      }

      // Filter by project/region if specified
      if (options.projectId) {
        filteredResults = filteredResults.filter(
          (result) => result.metadata?.projectId === options.projectId
        );
      }

      if (options.region) {
        filteredResults = filteredResults.filter(
          (result) => result.metadata?.region === options.region
        );
      }

      if (process.env.LOG_LEVEL === 'debug') {
        console.error(
          `[DEBUG] KnowledgeIndexer.queryKnowledge: After filtering: ${filteredResults.length} results`
        );
        filteredResults.forEach((result, i) => {
          const storedType = (result.data as { type?: string })?.type || result.metadata?.type;
          console.error(
            `[DEBUG] Final Result ${i}: Type="${storedType}", Score=${result.score}, JobId=${(result.data as { jobId?: string })?.jobId || 'N/A'}`
          );
        });
      }

      const formattedResults: FormattedSearchResult[] = filteredResults.map((result) => {
        const dataType =
          (result.data as { type?: string })?.type || result.metadata?.type || 'unknown';
        // Type guard to ensure proper typing
        let typedData: ClusterKnowledge | JobKnowledge | ErrorPattern;
        if (dataType === 'job') {
          typedData = result.data as JobKnowledge;
        } else if (dataType === 'cluster') {
          typedData = result.data as ClusterKnowledge;
        } else if (dataType === 'error') {
          typedData = result.data as ErrorPattern;
        } else {
          // Fallback for unknown types - cast as JobKnowledge
          typedData = result.data as JobKnowledge;
        }

        return {
          type: dataType,
          confidence: result.score,
          data: typedData,
          summary: this.generateResultSummary(result.data, dataType),
        };
      });

      return formattedResults;
    } catch (error) {
      logger.error('Failed to query knowledge base:', error);
      return [];
    }
  }

  /**
   * Generate a formatted summary for query results
   */
  private generateResultSummary(
    data: ClusterKnowledge | JobKnowledge | ErrorPattern | unknown,
    dataType: string
  ): string {
    if (!data) return 'No data available';

    switch (dataType) {
      case 'job':
        return this.generateJobSummary(data as JobKnowledge);
      case 'cluster':
        return this.generateClusterSummary(data as ClusterKnowledge);
      case 'error':
        return this.generateErrorSummary(data as ErrorPattern);
      default:
        return JSON.stringify(data, null, 2);
    }
  }

  /**
   * Generate formatted table summary for job results
   */
  private generateJobSummary(jobData: JobKnowledge): string {
    const lines: string[] = [];

    // Job header
    lines.push(`🔍 Job: ${jobData.jobId || 'Unknown'}`);
    lines.push(`📊 Type: ${jobData.jobType || 'Unknown'}`);
    lines.push(`🏗️  Cluster: ${jobData.clusterName || 'Unknown'}`);
    lines.push(
      `📍 Project: ${jobData.projectId || 'Unknown'} | Region: ${jobData.region || 'Unknown'}`
    );
    lines.push(`⏰ Submitted: ${jobData.submissionTime || 'Unknown'}`);
    lines.push(`✅ Status: ${jobData.status || 'Unknown'}`);

    // Query results table if available
    if (jobData.results && jobData.results.rows && jobData.results.rows.length > 0) {
      lines.push('\n📋 Query Results:');
      lines.push('─'.repeat(80));

      const results = jobData.results;
      const headers =
        results.schema?.fields?.map((col: { name?: string }) => col.name || String(col)) || [];
      const rows = results.rows || [];

      // Table header
      if (headers.length > 0) {
        lines.push(`| ${headers.join(' | ')} |`);
        lines.push(`|${headers.map(() => '─'.repeat(15)).join('|')}|`);
      }

      // Table rows (limit to first 10 for summary)
      const displayRows = rows.slice(0, 10);
      displayRows.forEach((row: unknown[]) => {
        const formattedRow = row.map((cell) =>
          String(cell || '').length > 12
            ? String(cell || '').substring(0, 12) + '...'
            : String(cell || '')
        );
        lines.push(`| ${formattedRow.join(' | ')} |`);
      });

      if (rows.length > 10) {
        lines.push(`... and ${rows.length - 10} more rows`);
      }

      lines.push(`\n📊 Total: ${rows.length} rows, ${headers.length} columns`);
    }

    return lines.join('\n');
  }

  /**
   * Generate formatted summary for cluster data
   */
  private generateClusterSummary(clusterData: ClusterKnowledge): string {
    const lines: string[] = [];
    lines.push(`🏗️  Cluster: ${clusterData.clusterName || 'Unknown'}`);
    lines.push(
      `📍 Project: ${clusterData.projectId || 'Unknown'} | Region: ${clusterData.region || 'Unknown'}`
    );

    if (clusterData.configurations?.machineTypes?.length > 0) {
      lines.push(`💻 Machine Types: ${clusterData.configurations.machineTypes.join(', ')}`);
    }

    if (clusterData.configurations?.components?.length > 0) {
      lines.push(`🔧 Components: ${clusterData.configurations.components.join(', ')}`);
    }

    if (clusterData.pipPackages?.length > 0) {
      lines.push(
        `🐍 Pip Packages: ${clusterData.pipPackages.slice(0, 5).join(', ')}${clusterData.pipPackages.length > 5 ? '...' : ''}`
      );
    }

    return lines.join('\n');
  }

  /**
   * Generate formatted summary for error data
   */
  private generateErrorSummary(errorData: ErrorPattern): string {
    const lines: string[] = [];
    lines.push(`❌ Error Pattern: ${errorData.pattern || 'Unknown'}`);
    lines.push(`🔢 Frequency: ${errorData.frequency || 0}`);

    if (errorData.commonCauses && errorData.commonCauses.length > 0) {
      lines.push(`🔍 Common Causes: ${errorData.commonCauses.join(', ')}`);
    }

    if (errorData.suggestedFixes && errorData.suggestedFixes.length > 0) {
      lines.push(`🔧 Suggested Fixes: ${errorData.suggestedFixes.join(', ')}`);
    }

    return lines.join('\n');
  }

  /**
   * Get cluster discovery insights
   */
  getClusterInsights(): {
    totalClusters: number;
    uniqueProjects: number;
    uniqueRegions: number;
    commonMachineTypes: string[];
    commonComponents: string[];
    commonPipelines: string[];
    recentDiscoveries: ClusterKnowledge[];
  } {
    const clusters = Array.from(this.clusterKnowledge.values());

    const uniqueProjects = new Set(clusters.map((c) => c.projectId)).size;
    const uniqueRegions = new Set(clusters.map((c) => c.region)).size;

    // Aggregate common configurations
    const allMachineTypes = clusters.flatMap((c) => c.configurations.machineTypes);
    const allComponents = clusters.flatMap((c) => c.configurations.components);
    const allPipelines = clusters.flatMap((c) => c.configurations.pipelines);

    const commonMachineTypes = this.getTopItems(allMachineTypes, 5);
    const commonComponents = this.getTopItems(allComponents, 5);
    const commonPipelines = this.getTopItems(allPipelines, 5);

    // Recent discoveries (last 24 hours)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const recentDiscoveries = clusters
      .filter((c) => c.firstSeen > yesterday)
      .sort((a, b) => b.firstSeen.localeCompare(a.firstSeen))
      .slice(0, 10);

    return {
      totalClusters: clusters.length,
      uniqueProjects,
      uniqueRegions,
      commonMachineTypes,
      commonComponents,
      commonPipelines,
      recentDiscoveries,
    };
  }

  /**
   * Get job type analytics
   */
  getJobTypeAnalytics(): {
    totalJobs: number;
    jobTypeDistribution: Record<string, number>;
    successRate: number;
    commonErrors: ErrorPattern[];
    avgDuration: Record<string, number>;
  } {
    const jobs = Array.from(this.jobKnowledge.values());

    const jobTypeDistribution: Record<string, number> = {};
    const avgDuration: Record<string, number> = {};
    const durationCounts: Record<string, number> = {};

    let successfulJobs = 0;

    jobs.forEach((job) => {
      // Job type distribution
      jobTypeDistribution[job.jobType] = (jobTypeDistribution[job.jobType] || 0) + 1;

      // Success rate
      if (['DONE', 'COMPLETED', 'SUCCESS'].includes(job.status.toUpperCase())) {
        successfulJobs++;
      }

      // Average duration
      if (job.duration) {
        avgDuration[job.jobType] = (avgDuration[job.jobType] || 0) + job.duration;
        durationCounts[job.jobType] = (durationCounts[job.jobType] || 0) + 1;
      }
    });

    // Calculate averages
    Object.keys(avgDuration).forEach((jobType) => {
      avgDuration[jobType] = avgDuration[jobType] / durationCounts[jobType];
    });

    const commonErrors = Array.from(this.errorPatterns.values())
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10);

    return {
      totalJobs: jobs.length,
      jobTypeDistribution,
      successRate: jobs.length > 0 ? (successfulJobs / jobs.length) * 100 : 0,
      commonErrors,
      avgDuration,
    };
  }

  private updateClusterKnowledge(knowledge: ClusterKnowledge, clusterData: ClusterData): void {
    // Extract machine types
    const masterMachine = this.extractMachineType(clusterData.config?.masterConfig?.machineTypeUri);
    const workerMachine = this.extractMachineType(clusterData.config?.workerConfig?.machineTypeUri);

    if (masterMachine) this.addUnique(knowledge.configurations.machineTypes, masterMachine);
    if (workerMachine) this.addUnique(knowledge.configurations.machineTypes, workerMachine);

    // Extract worker counts
    const workerCount = clusterData.config?.workerConfig?.numInstances;
    if (workerCount) this.addUnique(knowledge.configurations.workerCounts, workerCount);

    // Extract components
    const components = clusterData.config?.softwareConfig?.optionalComponents || [];
    components.forEach((comp: string) => this.addUnique(knowledge.configurations.components, comp));

    // Extract pipeline and owner from labels
    const labels = clusterData.labels || {};
    if (labels.pipeline) this.addUnique(knowledge.configurations.pipelines, labels.pipeline);
    if (labels.owner) this.addUnique(knowledge.configurations.owners, labels.owner);

    // Extract image version
    const imageVersion = clusterData.config?.softwareConfig?.imageVersion;
    if (imageVersion) this.addUnique(knowledge.configurations.imageVersions, imageVersion);

    // Extract pip packages
    const pipPackages = clusterData.config?.softwareConfig?.properties?.['dataproc:pip.packages'];
    if (pipPackages) {
      const packages = pipPackages.split(',').map((pkg: string) => pkg.trim());
      packages.forEach((pkg) => this.addUnique(knowledge.pipPackages, pkg));
    }

    // Extract initialization scripts
    const initActions = clusterData.config?.initializationActions || [];
    initActions.forEach((action: { executableFile?: string }) => {
      if (action.executableFile) {
        this.addUnique(knowledge.initializationScripts, action.executableFile);
      }
    });

    // Extract network configuration
    const gceConfig = clusterData.config?.gceClusterConfig;
    if (gceConfig) {
      if (gceConfig.zoneUri) {
        const zone = this.extractZone(gceConfig.zoneUri);
        if (zone) this.addUnique(knowledge.networkConfig.zones, zone);
      }
      if (gceConfig.subnetworkUri)
        this.addUnique(knowledge.networkConfig.subnets, gceConfig.subnetworkUri);
      if (gceConfig.serviceAccount)
        this.addUnique(knowledge.networkConfig.serviceAccounts, gceConfig.serviceAccount);
    }
  }

  private extractOutputSample(results: unknown): {
    columns: string[];
    rows: unknown[][];
    totalRows?: number;
  } {
    try {
      // Type guard for results with rows
      const resultsWithRows = results as {
        rows?: unknown[][];
        schema?: { fields?: { name?: string }[] };
        totalRows?: number;
      };

      // Handle different result formats
      if (resultsWithRows.rows && Array.isArray(resultsWithRows.rows)) {
        const columns =
          resultsWithRows.schema?.fields?.map((f) => f.name || '') ||
          Object.keys(resultsWithRows.rows[0] || {});

        return {
          columns,
          rows: resultsWithRows.rows.slice(0, 5), // First 5 rows
          totalRows: resultsWithRows.totalRows || resultsWithRows.rows.length,
        };
      }

      // Handle CSV-like results
      if (typeof results === 'string' && results.includes('\n')) {
        const lines = results.split('\n').filter((line) => line.trim());
        if (lines.length > 0) {
          const columns = lines[0].split(',').map((col) => col.trim());
          const rows = lines.slice(1, 6).map((line) => line.split(',').map((cell) => cell.trim()));

          return {
            columns,
            rows,
            totalRows: lines.length - 1,
          };
        }
      }

      return { columns: [], rows: [] };
    } catch (error) {
      logger.warn('Failed to extract output sample:', error);
      return { columns: [], rows: [] };
    }
  }

  private extractErrorInfo(error: unknown): {
    errorType: string;
    errorMessage: string;
    stackTrace?: string;
    commonCause?: string;
    suggestedFix?: string;
  } {
    // Type guard for error objects
    const errorObj = error as { message?: string; stack?: string; toString?: () => string };
    const errorMessage =
      errorObj.message || (errorObj.toString ? errorObj.toString() : String(error));
    const errorType = this.classifyError(errorMessage);

    return {
      errorType,
      errorMessage,
      stackTrace: errorObj.stack,
      commonCause: this.getCommonCause(errorType),
      suggestedFix: this.getSuggestedFix(errorType),
    };
  }

  private async indexErrorPattern(errorInfo: ErrorInfo, jobKnowledge: JobKnowledge): Promise<void> {
    const key = errorInfo.errorType;
    let pattern = this.errorPatterns.get(key);

    if (!pattern) {
      pattern = {
        errorType: errorInfo.errorType,
        pattern: errorInfo.errorMessage,
        frequency: 0,
        commonCauses: [],
        suggestedFixes: [],
        relatedClusters: [],
        relatedJobTypes: [],
        examples: [],
      };
    }

    pattern.frequency++;
    this.addUnique(pattern.relatedClusters, jobKnowledge.clusterName);
    this.addUnique(pattern.relatedJobTypes, jobKnowledge.jobType);

    if (errorInfo.commonCause) this.addUnique(pattern.commonCauses, errorInfo.commonCause);
    if (errorInfo.suggestedFix) this.addUnique(pattern.suggestedFixes, errorInfo.suggestedFix);

    pattern.examples.push({
      jobId: jobKnowledge.jobId,
      clusterName: jobKnowledge.clusterName,
      timestamp: jobKnowledge.submissionTime,
      context: errorInfo.errorMessage.substring(0, 200),
    });

    // Keep only recent examples
    pattern.examples = pattern.examples.slice(-10);

    this.errorPatterns.set(key, pattern);
  }

  private normalizeJobType(jobType: string): 'hive' | 'spark' | 'pyspark' | 'presto' | 'other' {
    const type = jobType.toLowerCase();
    if (type.includes('hive')) return 'hive';
    if (type.includes('spark')) return 'spark';
    if (type.includes('pyspark')) return 'pyspark';
    if (type.includes('presto')) return 'presto';
    return 'other';
  }

  private classifyError(errorMessage: string): string {
    const message = errorMessage.toLowerCase();

    if (message.includes('out of memory') || message.includes('oom')) return 'OutOfMemoryError';
    if (message.includes('connection') && message.includes('timeout')) return 'ConnectionTimeout';
    if (message.includes('permission') || message.includes('access denied'))
      return 'PermissionError';
    if (message.includes('file not found') || message.includes('no such file'))
      return 'FileNotFound';
    if (message.includes('syntax error') || message.includes('parse error')) return 'SyntaxError';
    if (message.includes('table') && message.includes('not found')) return 'TableNotFound';
    if (message.includes('column') && message.includes('not found')) return 'ColumnNotFound';
    if (message.includes('quota') || message.includes('limit exceeded')) return 'QuotaExceeded';

    return 'UnknownError';
  }

  private getCommonCause(errorType: string): string {
    const causes: Record<string, string> = {
      OutOfMemoryError: 'Insufficient memory allocation for job or cluster',
      ConnectionTimeout: 'Network connectivity issues or overloaded cluster',
      PermissionError: 'Insufficient IAM permissions or service account issues',
      FileNotFound: 'Missing input files or incorrect file paths',
      SyntaxError: 'Invalid SQL syntax or unsupported operations',
      TableNotFound: 'Table does not exist or incorrect database/schema',
      ColumnNotFound: 'Column name typo or schema mismatch',
      QuotaExceeded: 'GCP resource quotas or limits reached',
    };

    return causes[errorType] || 'Unknown cause - requires investigation';
  }

  private getSuggestedFix(errorType: string): string {
    const fixes: Record<string, string> = {
      OutOfMemoryError: 'Increase cluster memory, reduce data size, or optimize query',
      ConnectionTimeout: 'Check network connectivity, increase timeout, or scale cluster',
      PermissionError: 'Verify IAM roles, service account permissions, or resource access',
      FileNotFound: 'Check file paths, verify file existence, or update data sources',
      SyntaxError: 'Review SQL syntax, check function compatibility, or validate query',
      TableNotFound: 'Verify table name, check database connection, or create missing table',
      ColumnNotFound: 'Check column names, verify schema, or update query references',
      QuotaExceeded: 'Request quota increase, optimize resource usage, or use different region',
    };

    return fixes[errorType] || 'Contact support or check logs for more details';
  }

  private async storeClusterKnowledge(knowledge: ClusterKnowledge): Promise<void> {
    // Train the embedding model with this cluster data (like QdrantStorageService does)
    this.embeddingService.trainOnClusterData(knowledge as unknown as ClusterData);

    // Add type information to the data itself for easier retrieval
    const dataWithType = {
      ...knowledge,
      type: 'cluster',
    };

    const metadata = {
      toolName: 'knowledge-indexer',
      timestamp: knowledge.lastSeen,
      projectId: knowledge.projectId,
      region: knowledge.region,
      clusterName: knowledge.clusterName,
      responseType: 'cluster-knowledge',
      originalTokenCount: 0,
      filteredTokenCount: 0,
      compressionRatio: 1,
      type: 'cluster',
    };

    await this.qdrantService.storeClusterData(dataWithType, metadata);
  }

  private async storeJobKnowledge(knowledge: JobKnowledge): Promise<void> {
    // Add type information to the data itself for easier retrieval
    const dataWithType = {
      ...knowledge,
      type: 'job',
    };

    const metadata = {
      toolName: 'knowledge-indexer',
      timestamp: knowledge.submissionTime,
      projectId: knowledge.projectId,
      region: knowledge.region,
      clusterName: knowledge.clusterName,
      responseType: 'job-knowledge',
      originalTokenCount: 0,
      filteredTokenCount: 0,
      compressionRatio: 1,
      type: 'job',
    };

    if (process.env.LOG_LEVEL === 'debug') {
      console.error(
        `[DEBUG] KnowledgeIndexer.storeJobKnowledge: Storing job ${knowledge.jobId} with type='job'`
      );
      console.error(`[DEBUG] Data keys: ${Object.keys(dataWithType).join(', ')}`);
      console.error(`[DEBUG] Metadata type: ${metadata.type}`);
    }

    await this.qdrantService.storeClusterData(dataWithType, metadata);

    if (process.env.LOG_LEVEL === 'debug') {
      console.error(
        `[DEBUG] KnowledgeIndexer.storeJobKnowledge: Successfully stored job ${knowledge.jobId}`
      );
    }
  }

  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash;
  }

  private extractRegion(clusterData: ClusterData): string {
    // Extract region from various possible locations
    const zoneUri = clusterData.config?.gceClusterConfig?.zoneUri;
    if (zoneUri) {
      const match = zoneUri.match(/zones\/([^/]+)/);
      if (match) {
        const zone = match[1];
        return zone.substring(0, zone.lastIndexOf('-')); // Remove zone suffix
      }
    }
    return 'unknown';
  }

  private extractMachineType(machineTypeUri: string | undefined): string | null {
    if (!machineTypeUri) return null;
    const parts = machineTypeUri.split('/');
    return parts[parts.length - 1] || null;
  }

  private extractZone(zoneUri: string): string | null {
    if (!zoneUri) return null;
    const match = zoneUri.match(/zones\/([^/]+)/);
    return match ? match[1] : null;
  }

  private addUnique<T>(array: T[], item: T): void {
    if (!array.includes(item)) {
      array.push(item);
    }
  }

  private getTopItems(items: string[], limit: number): string[] {
    const counts: Record<string, number> = {};
    items.forEach((item) => {
      counts[item] = (counts[item] || 0) + 1;
    });

    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([item]) => item);
  }
}
