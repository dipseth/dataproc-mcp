/**
 * Knowledge Indexer Service V2 - Dynamic Insights Edition
 *
 * Enhanced version with dynamic field analysis and pattern-based insights.
 * Provides intelligent data extraction and indexing capabilities for Dataproc infrastructure.
 *
 * NEW FEATURES:
 * - Dynamic field discovery and analysis
 * - Pattern-based insights generation
 * - User-configurable focus areas
 * - Statistical analysis of numerical fields
 * - Automatic recommendation generation
 *
 * CORE FEATURES:
 * - Builds comprehensive knowledge base of cluster configurations
 * - Extracts meaningful information from job outputs
 * - Tracks job submission patterns and performance metrics
 * - Indexes error patterns and troubleshooting information
 * - Enables natural language queries against stored data
 */

import { QdrantStorageService } from './qdrant-storage.js';
import { TransformersEmbeddingService } from './transformers-embeddings.js';
import { ClusterConfig } from '../types/cluster-config.js';
import { QueryResultResponse as ApiQueryResultResponse } from '../types/response.js';
import { ErrorInfo } from '../types/dataproc-responses.js';
import { logger } from '../utils/logger.js';
// Removed unused performance import

// Core data interfaces
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
  results?: ApiQueryResultResponse;
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

// Dynamic analysis interfaces
interface FieldAnalysis {
  fieldName: string;
  fieldType: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'date';
  sampleValues: any[];
  uniqueCount: number;
  totalCount: number;
  statistics?: {
    min?: number;
    max?: number;
    avg?: number;
    median?: number;
    distribution?: Record<string, number>;
  };
}

interface DataPattern {
  category: string;
  insights: string[];
  metrics: Record<string, any>;
  confidence: number;
}

interface DynamicInsightResult {
  totalDocuments: number;
  fieldAnalysis: FieldAnalysis[];
  patterns: DataPattern[];
  recommendations: string[];
  focusAnalysis?: Record<string, any>;
}

interface FormattedSearchResult {
  type: string;
  confidence: number;
  data: ClusterKnowledge | JobKnowledge | ErrorPattern;
  summary: string;
  id?: string;
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
    const defaultConfig = {
      url: 'http://localhost:6333',
      collectionName: 'dataproc_knowledge',
      vectorSize: 384,
      distance: 'Cosine' as const
    };
    this.qdrantService = new QdrantStorageService({ ...defaultConfig, ...qdrantConfig });
    this.embeddingService = new TransformersEmbeddingService();
  }

  /**
   * Initialize the knowledge indexer (legacy compatibility)
   */
  async initialize(config?: {
    url?: string;
    collectionName?: string;
    vectorSize?: number;
    distance?: 'Cosine' | 'Euclidean' | 'Dot';
  }): Promise<void> {
    if (config) {
      // Reinitialize with new config if provided
      const fullConfig = {
        url: config.url || 'http://localhost:6333',
        collectionName: config.collectionName || 'dataproc_knowledge',
        vectorSize: config.vectorSize || 384,
        distance: config.distance || 'Cosine' as const
      };
      this.qdrantService = new QdrantStorageService(fullConfig);
    }
    
    // Ensure collection exists
    await this.qdrantService.ensureCollection();
    logger.info('🧠 Knowledge indexer initialized successfully');
  }

  /**
   * Index job submission (legacy compatibility)
   */
  async indexJobSubmission(jobData: {
    jobId: string;
    jobType: string;
    projectId: string;
    region: string;
    clusterName: string;
    query?: string;
    status: string;
    submissionTime?: string;
    results?: any;
    duration?: number;
    error?: any;
  }): Promise<void> {
    // Convert to our internal format and index
    await this.indexJobData({
      ...jobData,
      submissionTime: jobData.submissionTime || new Date().toISOString()
    });
  }

  /**
   * Index cluster configuration (legacy compatibility)
   */
  async indexClusterConfiguration(clusterData: any): Promise<void> {
    // Convert to our internal format and index
    await this.indexClusterData({
      clusterName: clusterData.clusterName,
      projectId: clusterData.projectId,
      region: clusterData.region,
      config: clusterData.config || clusterData,
      labels: clusterData.labels,
      status: clusterData.status
    });
  }

  /**
   * Get collection info (legacy compatibility)
   */
  getCollectionInfo(): { name: string; url: string; collectionName: string } {
    const collectionName = this.qdrantService.getCollectionName();
    return {
      name: collectionName,
      collectionName: collectionName,
      url: (this.qdrantService as any).config?.url || 'http://localhost:6333'
    };
  }

  /**
   * Get access to the Qdrant service for raw document retrieval
   */
  public getQdrantService(): QdrantStorageService {
    return this.qdrantService;
  }

  /**
   * Index cluster data with automatic field extraction
   */
  async indexClusterData(clusterData: ClusterData): Promise<void> {
    try {
      const key = `${clusterData.projectId}:${clusterData.region}:${clusterData.clusterName}`;
      let knowledge = this.clusterKnowledge.get(key);

      if (!knowledge) {
        knowledge = this.createClusterKnowledge(clusterData);
        this.clusterKnowledge.set(key, knowledge);
      } else {
        knowledge.lastSeen = new Date().toISOString();
      }

      await this.updateClusterKnowledge(knowledge, clusterData);
      await this.storeClusterKnowledge(knowledge);

      logger.info(`📝 Indexed cluster: ${clusterData.clusterName} in ${clusterData.projectId}/${clusterData.region}`);
    } catch (error) {
      logger.error('Failed to index cluster data:', error);
    }
  }

  /**
   * Index job data with automatic field extraction
   */
  async indexJobData(jobData: any): Promise<void> {
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
      logger.error('Failed to index job data:', error);
    }
  }

  /**
   * Enhanced cluster insights with dynamic analysis
   */
  async getDynamicClusterInsights(focusAreas?: string[]): Promise<DynamicInsightResult> {
    let clusters = Array.from(this.clusterKnowledge.values());
    
    if (clusters.length === 0) {
      const results = await this.queryKnowledge('type:cluster', { limit: 1000 });
      clusters = results.map(r => r.data as ClusterKnowledge);
    }

    if (clusters.length === 0) {
      return {
        totalDocuments: 0,
        fieldAnalysis: [],
        patterns: [],
        recommendations: ['No cluster data available for analysis']
      };
    }

    // Dynamic field analysis
    const fieldAnalysis = this.analyzeDataFields(clusters);
    
    // Pattern detection
    const patterns = this.detectClusterPatterns(clusters, fieldAnalysis);
    
    // Focus area analysis
    const focusAnalysis = focusAreas ? this.analyzeFocusAreas(clusters, focusAreas) : undefined;

    return {
      totalDocuments: clusters.length,
      fieldAnalysis: fieldAnalysis.slice(0, 20), // Limit to top 20 fields
      patterns,
      focusAnalysis,
      recommendations: this.generateClusterRecommendations(patterns, fieldAnalysis)
    };
  }

  /**
   * Enhanced job analytics with dynamic analysis
   */
  async getDynamicJobAnalytics(focusAreas?: string[]): Promise<DynamicInsightResult> {
    let jobs = Array.from(this.jobKnowledge.values());
    
    if (jobs.length === 0) {
      const results = await this.queryKnowledge('type:job', { limit: 1000 });
      jobs = results.map(r => r.data as JobKnowledge);
    }

    if (jobs.length === 0) {
      return {
        totalDocuments: 0,
        fieldAnalysis: [],
        patterns: [],
        recommendations: ['No job data available for analysis']
      };
    }

    // Dynamic field analysis
    const fieldAnalysis = this.analyzeDataFields(jobs);
    
    // Pattern detection
    const patterns = this.detectJobPatterns(jobs, fieldAnalysis);
    
    // Focus area analysis
    const focusAnalysis = focusAreas ? this.analyzeFocusAreas(jobs, focusAreas) : undefined;

    return {
      totalDocuments: jobs.length,
      fieldAnalysis: fieldAnalysis.slice(0, 20), // Limit to top 20 fields
      patterns,
      focusAnalysis,
      recommendations: this.generateJobRecommendations(patterns, fieldAnalysis)
    };
  }

  /**
   * Legacy compatibility methods
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

  /**
   * Query knowledge base with semantic search
   */
  async queryKnowledge(
    query: string,
    options: {
      type?: 'clusters' | 'cluster' | 'jobs' | 'job' | 'errors' | 'error' | 'all';
      projectId?: string;
      region?: string;
      limit?: number;
    } = {}
  ): Promise<FormattedSearchResult[]> {
    try {
      await this.qdrantService.ensureCollection();

      // Enhanced query parsing for tags
      const tags: { key: string; value: string }[] = [];
      let semanticQuery = query;

      const tagRegex = /(\w+):"([^"]+)"|(\w+):(\S+)/g;
      let match;
      while ((match = tagRegex.exec(query)) !== null) {
        const key = match[1] || match[3];
        const value = match[2] || match[4];
        tags.push({ key, value });
        semanticQuery = semanticQuery.replace(match[0], '').trim();
      }

      // Build Qdrant filter from tags
      const filterConditions: any[] = [];
      if (options.type && options.type !== 'all') {
        filterConditions.push({
          key: 'type',
          match: { value: this.singularize(options.type) },
        });
      }
      tags.forEach(tag => {
        filterConditions.push({
          key: tag.key,
          match: { value: tag.value },
        });
      });

      const filter: any = {
        must: filterConditions,
      };
      
      const queryVector = await this.embeddingService.generateEmbedding(semanticQuery || query);

      const searchResults = await this.qdrantService
        .getQdrantClient()
        .search(this.qdrantService.getCollectionName(), {
          vector: queryVector,
          limit: options.limit || 10,
          with_payload: true,
          filter: filterConditions.length > 0 ? filter : undefined,
        });

      // Format results
      const formattedResults: FormattedSearchResult[] = searchResults.map((result) => {
        const payload = result.payload as any;
        const dataType = payload?.type || 'unknown';
        return {
          id: result.id.toString(),
          type: dataType,
          confidence: result.score,
          data: payload as any,
          summary: this.generateResultSummary(payload, dataType),
        };
      });

      return formattedResults;
    } catch (error) {
      logger.error('Failed to query knowledge base:', error);
      return [];
    }
  }

  // ===== PRIVATE METHODS =====

  /**
   * Dynamic field analysis for any data type
   */
  private analyzeDataFields(documents: any[]): FieldAnalysis[] {
    const fieldStats: Record<string, any> = {};
    
    documents.forEach(doc => {
      this.extractFieldsRecursively(doc, '', fieldStats);
    });

    // Convert to analysis format
    const fieldAnalysis = Object.entries(fieldStats).map(([fieldName, stats]) => ({
      fieldName,
      fieldType: stats.type,
      sampleValues: stats.samples.slice(0, 5),
      uniqueCount: stats.unique.size,
      totalCount: stats.count,
      statistics: this.calculateFieldStatistics(stats)
    }));

    return fieldAnalysis.sort((a, b) => b.totalCount - a.totalCount);
  }

  /**
   * Recursively extract fields and their stats
   */
  private extractFieldsRecursively(obj: any, prefix: string, fieldStats: Record<string, any>): void {
    if (!obj) return;

    Object.entries(obj).forEach(([key, value]) => {
      const fieldName = prefix ? `${prefix}.${key}` : key;
      
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        this.extractFieldsRecursively(value, fieldName, fieldStats);
      } else {
        if (!fieldStats[fieldName]) {
          fieldStats[fieldName] = {
            count: 0,
            unique: new Set(),
            samples: [],
            type: this.getFieldType(value)
          };
        }
        fieldStats[fieldName].count++;
        fieldStats[fieldName].unique.add(JSON.stringify(value));
        if (fieldStats[fieldName].samples.length < 10) {
          fieldStats[fieldName].samples.push(value);
        }
      }
    });
  }

  /**
   * Get the type of a field value
   */
  private getFieldType(value: any): string {
    if (Array.isArray(value)) return 'array';
    if (value instanceof Date) return 'date';
    if (typeof value === 'object' && value !== null) return 'object';
    return typeof value;
  }

  /**
   * Calculate statistics for a field
   */
  private calculateFieldStatistics(stats: any): any {
    if (stats.type !== 'number' || stats.samples.length === 0) {
      return undefined;
    }

    const numericValues = stats.samples.filter((v: any) => typeof v === 'number');
    if (numericValues.length === 0) return undefined;

    const sum = numericValues.reduce((a: number, b: number) => a + b, 0);
    const avg = sum / numericValues.length;
    const min = Math.min(...numericValues);
    const max = Math.max(...numericValues);
    
    const sorted = [...numericValues].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

    return {
      min,
      max,
      avg,
      median,
      distribution: this.createNumericDistribution(numericValues)
    };
  }

  /**
   * Create a distribution for numeric values
   */
  private createNumericDistribution(values: number[]): Record<string, number> {
    if (values.length < 2) return {};
    
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    const numBins = Math.min(10, values.length);
    const binSize = range / numBins;
    
    const distribution: Record<string, number> = {};
    
    values.forEach(value => {
      const binIndex = binSize > 0 ? Math.floor((value - min) / binSize) : 0;
      const binStart = min + binIndex * binSize;
      const binEnd = binStart + binSize;
      const binName = `${binStart.toFixed(2)}-${binEnd.toFixed(2)}`;
      distribution[binName] = (distribution[binName] || 0) + 1;
    });
    
    return distribution;
  }

  /**
   * Detect patterns in cluster data
   */
  private detectClusterPatterns(clusters: any[], fieldAnalysis: FieldAnalysis[]): DataPattern[] {
    const patterns: DataPattern[] = [];

    // Example: Identify oversized/undersized clusters
    const machineTypeField = fieldAnalysis.find(f => f.fieldName.endsWith('masterConfig.machineTypeUri'));
    if (machineTypeField) {
      // ... pattern detection logic ...
    }

    return patterns;
  }

  /**
   * Detect patterns in job data
   */
  private detectJobPatterns(jobs: any[], fieldAnalysis: FieldAnalysis[]): DataPattern[] {
    const patterns: DataPattern[] = [];

    // Example: High failure rates for specific job types
    const jobTypeField = fieldAnalysis.find(f => f.fieldName === 'jobType');
    const statusField = fieldAnalysis.find(f => f.fieldName === 'status');

    if (jobTypeField && statusField) {
      // ... pattern detection logic ...
    }

    return patterns;
  }

  /**
   * Analyze specific focus areas in the data
   */
  private analyzeFocusAreas(data: any[], focusAreas: string[]): Record<string, any> {
    const analysis: Record<string, any> = {};
    focusAreas.forEach(area => {
      switch (area.toLowerCase()) {
        case 'performance':
          analysis.performance = this.analyzePerformance(data);
          break;
        case 'configuration':
          analysis.configuration = this.analyzeConfiguration(data);
          break;
        case 'errors':
          analysis.errors = this.analyzeErrors(data);
          break;
        case 'resources':
          analysis.resources = this.analyzeResources(data);
          break;
      }
    });
    return analysis;
  }

  private analyzePerformance(data: any[]): any {
    const performanceFields = data.flatMap(item => 
      Object.keys(item).filter(k => k.toLowerCase().includes('duration') || k.toLowerCase().includes('time'))
    );
    return { summary: `Found ${performanceFields.length} performance-related fields.` };
  }

  private analyzeConfiguration(data: any[]): any {
    const configFields = data.flatMap(item => 
      Object.keys(item).filter(k => k.toLowerCase().includes('config') || k.toLowerCase().includes('properties'))
    );
    return { summary: `Found ${configFields.length} configuration-related fields.` };
  }

  private analyzeErrors(data: any[]): any {
    const errorFields = data.flatMap(item => 
      Object.keys(item).filter(k => k.toLowerCase().includes('error') || k.toLowerCase().includes('fail'))
    );
    return { summary: `Found ${errorFields.length} error-related fields.` };
  }

  private analyzeResources(data: any[]): any {
    const resourceFields = data.flatMap(item => 
      Object.keys(item).filter(k => 
        k.toLowerCase().includes('memory') || 
        k.toLowerCase().includes('cpu') || 
        k.toLowerCase().includes('disk')
      )
    );
    return { summary: `Found ${resourceFields.length} resource-related fields.` };
  }

  /**
   * Generate recommendations based on cluster patterns
   */
  private generateClusterRecommendations(patterns: DataPattern[], fieldAnalysis: FieldAnalysis[]): string[] {
    const recommendations: string[] = [];
    
    // Example: Recommend standardizing machine types
    const machineTypes = fieldAnalysis.find(f => f.fieldName.endsWith('machineTypeUri'));
    if (machineTypes && machineTypes.uniqueCount > 5) {
      recommendations.push('Consider standardizing machine types to reduce configuration drift.');
    }

    return recommendations;
  }

  /**
   * Generate recommendations based on job patterns
   */
  private generateJobRecommendations(patterns: DataPattern[], _fieldAnalysis: FieldAnalysis[]): string[] {
    const recommendations: string[] = [];

    // Example: Investigate high failure rates
    const failureRate = patterns.find(p => p.category === 'High Failure Rate');
    if (failureRate) {
      recommendations.push(`Investigate high failure rate for ${failureRate.metrics.jobType} jobs.`);
    }

    return recommendations;
  }

  // ===== PRIVATE HELPER METHODS =====

  private createClusterKnowledge(clusterData: ClusterData): ClusterKnowledge {
    const now = new Date().toISOString();
    return {
      clusterName: clusterData.clusterName || 'unknown',
      projectId: clusterData.projectId || 'unknown',
      region: clusterData.region || 'unknown',
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
  }

  private async updateClusterKnowledge(knowledge: ClusterKnowledge, clusterData: ClusterData): Promise<void> {
    const config = clusterData.config;
    if (!config) return;

    // Update machine types
    const masterType = this.extractMachineType(config.masterConfig?.machineTypeUri);
    const workerType = this.extractMachineType(config.workerConfig?.machineTypeUri);
    if (masterType) this.addUnique(knowledge.configurations.machineTypes, masterType);
    if (workerType) this.addUnique(knowledge.configurations.machineTypes, workerType);

    // Update worker counts
    const workerCount = config.workerConfig?.numInstances;
    if (workerCount) this.addUnique(knowledge.configurations.workerCounts, workerCount);

    // Update components, image versions, etc.
    if (config.softwareConfig?.optionalComponents) {
      config.softwareConfig.optionalComponents.forEach(c => this.addUnique(knowledge.configurations.components, c));
    }
    if (config.softwareConfig?.imageVersion) {
      this.addUnique(knowledge.configurations.imageVersions, config.softwareConfig.imageVersion);
    }
    
    // ... more updates as needed
  }

  private async storeClusterKnowledge(knowledge: ClusterKnowledge): Promise<void> {
    const text = `Cluster: ${knowledge.clusterName}, Project: ${knowledge.projectId}, Region: ${knowledge.region}. Components: ${knowledge.configurations.components.join(', ')}. Machine types: ${knowledge.configurations.machineTypes.join(', ')}.`;
    const vector = await this.embeddingService.generateEmbedding(text);
    await this.qdrantService.getQdrantClient().upsert(this.qdrantService.getCollectionName(),{
      wait: true,
      points: [
        {
          id: `${knowledge.projectId}:${knowledge.region}:${knowledge.clusterName}`,
          vector,
          payload: { ...knowledge, type: 'cluster' },
        },
      ]
    });
  }

  private async storeJobKnowledge(knowledge: JobKnowledge): Promise<void> {
    const text = `Job: ${knowledge.jobId}, Type: ${knowledge.jobType}, Status: ${knowledge.status}. Query: ${knowledge.query || 'N/A'}`;
    const vector = await this.embeddingService.generateEmbedding(text);
    await this.qdrantService.getQdrantClient().upsert(this.qdrantService.getCollectionName(), {
      wait: true,
      points: [
        {
          id: knowledge.jobId,
          vector,
          payload: { ...knowledge, type: 'job' },
        },
      ]
    });
  }

  private normalizeJobType(jobType: string): 'hive' | 'spark' | 'pyspark' | 'presto' | 'other' {
    const lowerJobType = jobType.toLowerCase();
    if (lowerJobType.includes('hive')) return 'hive';
    if (lowerJobType.includes('spark')) return 'spark';
    if (lowerJobType.includes('pyspark')) return 'pyspark';
    if (lowerJobType.includes('presto')) return 'presto';
    return 'other';
  }

  private extractOutputSample(results: unknown): {
    columns: string[];
    rows: unknown[][];
    totalRows?: number;
  } | undefined {
    if (typeof results !== 'object' || results === null) return undefined;
    
    const res = results as ApiQueryResultResponse;
    if (!res.schema?.fields || !res.rows) return undefined;

    return {
      columns: res.schema.fields.map(s => s.name),
      rows: res.rows.slice(0, 10).map(r => (r as any).values || []),
      totalRows: res.totalRows
    };
  }

  private extractErrorInfo(error: unknown): {
    errorType: string;
    errorMessage: string;
    stackTrace?: string;
    commonCause?: string;
    suggestedFix?: string;
  } {
    if (typeof error === 'string') {
      const errorType = this.classifyError(error);
      return {
        errorType,
        errorMessage: error,
        commonCause: this.getCommonCause(errorType),
        suggestedFix: this.getSuggestedFix(errorType),
      };
    }
    if (error instanceof Error) {
      const errorType = this.classifyError(error.message);
      return {
        errorType,
        errorMessage: error.message,
        stackTrace: error.stack,
        commonCause: this.getCommonCause(errorType),
        suggestedFix: this.getSuggestedFix(errorType),
      };
    }
    const errInfo = error as ErrorInfo;
    return {
      errorType: errInfo.errorType || 'UnknownError',
      errorMessage: errInfo.errorMessage || 'No error message provided',
      stackTrace: errInfo.stackTrace,
      commonCause: errInfo.commonCause || this.getCommonCause(errInfo.errorType || ''),
      suggestedFix: errInfo.suggestedFix || this.getSuggestedFix(errInfo.errorType || ''),
    };
  }

  private async indexErrorPattern(errorInfo: any, jobKnowledge: JobKnowledge): Promise<void> {
    const patternKey = errorInfo.errorType;
    let pattern = this.errorPatterns.get(patternKey);

    if (!pattern) {
      pattern = {
        errorType: patternKey,
        pattern: errorInfo.errorMessage.substring(0, 100), // Simple pattern for now
        frequency: 0,
        commonCauses: [errorInfo.commonCause].filter(Boolean),
        suggestedFixes: [errorInfo.suggestedFix].filter(Boolean),
        relatedClusters: [],
        relatedJobTypes: [],
        examples: [],
      };
      this.errorPatterns.set(patternKey, pattern);
    }

    pattern.frequency++;
    this.addUnique(pattern.relatedClusters, jobKnowledge.clusterName);
    this.addUnique(pattern.relatedJobTypes, jobKnowledge.jobType);
    if (pattern.examples.length < 5) {
      pattern.examples.push({
        jobId: jobKnowledge.jobId,
        clusterName: jobKnowledge.clusterName,
        timestamp: new Date().toISOString(),
        context: `Job type: ${jobKnowledge.jobType}, Status: ${jobKnowledge.status}`,
      });
    }
  }

  private classifyError(errorMessage: string): string {
    if (errorMessage.includes('permission denied')) return 'PermissionDenied';
    if (errorMessage.includes('not found')) return 'NotFound';
    if (errorMessage.includes('timeout')) return 'Timeout';
    return 'GenericError';
  }

  private getCommonCause(errorType: string): string {
    const causes: Record<string, string> = {
      PermissionDenied: 'IAM permissions misconfiguration.',
      NotFound: 'Resource (e.g., table, file) does not exist.',
      Timeout: 'Network issue or overloaded cluster.',
    };
    return causes[errorType] || 'Unknown cause.';
  }

  private getSuggestedFix(errorType: string): string {
    const fixes: Record<string, string> = {
      PermissionDenied: 'Check service account roles and permissions.',
      NotFound: 'Verify resource paths and existence.',
      Timeout: 'Increase timeout settings or check cluster load.',
    };
    return fixes[errorType] || 'Check logs for more details.';
  }

  private extractMachineType(machineTypeUri: string | undefined): string | null {
    if (!machineTypeUri) return null;
    return machineTypeUri.split('/').pop() || null;
  }

  private addUnique<T>(array: T[], item: T): void {
    if (!array.includes(item)) {
      array.push(item);
    }
  }

  private getTopItems(items: string[], limit: number): string[] {
    const counts: Record<string, number> = {};
    items.forEach(item => {
      counts[item] = (counts[item] || 0) + 1;
    });
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([item]) => item);
  }

  private singularize(word: string): string {
    if (word.endsWith('s')) {
      return word.slice(0, -1);
    }
    return word;
  }

  private pluralize(word: string): string {
    if (!word.endsWith('s')) {
      return `${word}s`;
    }
    return word;
  }

  private generateResultSummary(payload: any, dataType: string): string {
    if (!payload) return 'No data available';
    switch (dataType) {
      case 'cluster':
        return `Cluster ${payload.clusterName} in ${payload.projectId}. Components: ${payload.configurations?.components?.join(', ') || 'N/A'}`;
      case 'job':
        return `Job ${payload.jobId} (${payload.jobType}) - Status: ${payload.status}`;
      case 'error':
        return `Error: ${payload.errorType} - Frequency: ${payload.frequency}`;
      default:
        return 'Unknown data type';
    }
  }
}