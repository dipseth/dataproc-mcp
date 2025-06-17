/**
 * Dynamic Function Implementations
 * Provides runtime function execution for enhanced prompt templates
 */

import { KnowledgeIndexer } from '../services/knowledge-indexer.js';
import { JobTracker } from '../services/job-tracker.js';
import { QdrantStorageService } from '../services/qdrant-storage.js';
import { FunctionExecutionResult, DynamicResolutionContext } from '../types/dynamic-templating.js';

export interface DynamicFunctionExecutor {
  execute(
    functionName: string,
    args: string[],
    context: DynamicResolutionContext
  ): Promise<FunctionExecutionResult>;
}

/**
 * Implementation of dynamic functions for enhanced prompts
 */
export class EnhancedPromptDynamicFunctions implements DynamicFunctionExecutor {
  private knowledgeIndexer?: KnowledgeIndexer;
  private jobTracker?: JobTracker;
  private qdrantStorage?: QdrantStorageService;
  private cache = new Map<string, { result: any; timestamp: number; ttl: number }>();

  constructor(
    knowledgeIndexer?: KnowledgeIndexer,
    jobTracker?: JobTracker,
    qdrantStorage?: QdrantStorageService
  ) {
    this.knowledgeIndexer = knowledgeIndexer;
    this.jobTracker = jobTracker;
    this.qdrantStorage = qdrantStorage;
  }

  /**
   * Execute a dynamic function with caching support
   */
  async execute(
    functionName: string,
    args: string[],
    context: DynamicResolutionContext
  ): Promise<FunctionExecutionResult> {
    const cacheKey = this.generateCacheKey(functionName, args, context);

    // Check cache first
    const cached = this.getCachedResult(cacheKey);
    if (cached) {
      return {
        value: cached,
        success: true,
        cached: true,
        executionTimeMs: 0,
      };
    }

    const startTime = Date.now();

    try {
      let result: any;

      switch (functionName) {
        case 'qdrant_query':
          result = await this.executeQdrantQuery(args, context);
          break;
        case 'job_output':
          result = await this.executeJobOutput(args, context);
          break;
        case 'cluster_status':
          result = await this.executeClusterStatus(args, context);
          break;
        case 'profile_config':
          result = await this.executeProfileConfig(args, context);
          break;
        default:
          throw new Error(`Unknown dynamic function: ${functionName}`);
      }

      const executionTime = Date.now() - startTime;

      // Cache the result with default TTL of 30 minutes
      this.setCachedResult(cacheKey, result, 1800000);

      return {
        value: result,
        success: true,
        cached: false,
        executionTimeMs: executionTime,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      return {
        value: null,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        cached: false,
        executionTimeMs: executionTime,
      };
    }
  }

  /**
   * Execute Qdrant semantic search query
   */
  private async executeQdrantQuery(
    args: string[],
    _context: DynamicResolutionContext
  ): Promise<string> {
    if (!this.qdrantStorage) {
      return '<!-- Qdrant storage service not available -->';
    }

    if (args.length < 1) {
      throw new Error('qdrant_query requires at least 1 argument: query');
    }

    const query = args[0];
    // const _filters = args[1] ? this.parseFilters(args[1]) : {};
    const limit = this.extractLimit(args[1]) || 5;

    try {
      const results = await this.qdrantStorage.searchSimilar(query, limit, 0.6);

      if (!results || results.length === 0) {
        return '<!-- No relevant results found -->';
      }

      // Format results for prompt inclusion
      return this.formatQdrantResults(results, query);
    } catch (error) {
      console.error('Qdrant query failed:', error);
      return `<!-- Qdrant query failed: ${error instanceof Error ? error.message : 'Unknown error'} -->`;
    }
  }

  /**
   * Execute job output retrieval
   */
  private async executeJobOutput(
    args: string[],
    context: DynamicResolutionContext
  ): Promise<string> {
    if (args.length < 1) {
      throw new Error('job_output requires at least 1 argument: jobId');
    }

    const jobId = args[0];
    const fieldPath = args[1]; // Optional field path using dot notation (e.g., 'results.rows[0].column_name')
    const analysisType = args[2] || 'summary';

    if (!jobId || jobId === 'not applicable') {
      return '<!-- No job ID provided -->';
    }

    try {
      // First, try to get job information from JobTracker
      if (this.jobTracker) {
        const trackedJob = this.jobTracker.getJob(jobId);
        if (trackedJob) {
          // If job is still running, return status
          if (['RUNNING', 'PENDING'].includes(trackedJob.status)) {
            return `**Job Status**: ${trackedJob.status}\n**Info**: Job is still running. Results not yet available.`;
          }

          // If job failed, return error information
          if (['FAILED', 'ERROR', 'CANCELLED'].includes(trackedJob.status)) {
            return `**Job Status**: ${trackedJob.status}\n**Error**: Job did not complete successfully.`;
          }
        }
      }

      // Try to get job results from Qdrant storage
      if (this.qdrantStorage) {
        const results = await this.qdrantStorage.searchSimilar(`jobId:${jobId}`, 5, 0.7);

        if (results && results.length > 0) {
          // Extract data from the best matching result
          const bestResult = results[0];
          let jobData = bestResult.data;

          // Apply field path extraction if specified
          if (fieldPath && jobData) {
            jobData = this.extractFieldPath(jobData, fieldPath);
          }

          return this.formatJobOutput([{ payload: jobData }], analysisType);
        }
      }

      // Fallback: Try to get job results using query service
      try {
        const { getQueryResults } = await import('../services/query.js');

        // Extract project and region from context if available
        const projectId =
          context.templateContext?.userOverrides?.projectId ||
          context.templateContext?.userOverrides?.project_id ||
          context.templateContext?.metadata?.projectId ||
          'unknown';
        const region =
          context.templateContext?.userOverrides?.region ||
          context.templateContext?.metadata?.region ||
          'us-central1';

        const queryResults = await getQueryResults(
          String(projectId),
          String(region),
          jobId,
          10 // maxResults
        );

        if (queryResults && queryResults.rows && queryResults.rows.length > 0) {
          let resultData = queryResults;

          // Apply field path extraction if specified
          if (fieldPath) {
            resultData = this.extractFieldPath(resultData, fieldPath);
          }

          return this.formatJobOutput([{ payload: resultData }], analysisType);
        }
      } catch (queryError) {
        console.warn('Failed to retrieve job results via query service:', queryError);
      }

      return '<!-- No job output found -->';
    } catch (error) {
      console.error('Job output retrieval failed:', error);
      return `<!-- Job output retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'} -->`;
    }
  }

  /**
   * Execute cluster status check
   */
  private async executeClusterStatus(
    args: string[],
    context: DynamicResolutionContext
  ): Promise<string> {
    if (args.length < 1) {
      throw new Error('cluster_status requires at least 1 argument: clusterName');
    }

    const clusterName = args[0];
    const infoType = args[1] || 'general';

    if (!clusterName || clusterName === 'not specified') {
      return '<!-- No cluster name provided -->';
    }

    try {
      // Extract project and region from context
      const projectId =
        context.templateContext?.userOverrides?.projectId ||
        context.templateContext?.userOverrides?.project_id ||
        context.templateContext?.metadata?.projectId;
      const region =
        context.templateContext?.userOverrides?.region || context.templateContext?.metadata?.region;

      // Try to get real-time cluster status from cluster service
      if (projectId && region) {
        try {
          const { getCluster } = await import('../services/cluster.js');
          const clusterDetails = await getCluster(String(projectId), String(region), clusterName);

          if (clusterDetails) {
            return this.formatClusterStatus([{ payload: clusterDetails }], infoType);
          }
        } catch (clusterError) {
          console.warn('Failed to get real-time cluster status:', clusterError);
        }
      }

      // Fallback: Search for cluster information in Qdrant
      if (this.qdrantStorage) {
        const results = await this.qdrantStorage.searchSimilar(
          `clusterName:${clusterName}`,
          3,
          0.7
        );

        if (results && results.length > 0) {
          return this.formatClusterStatus(
            results.map((r) => ({ payload: r.data })),
            infoType
          );
        }
      }

      return '<!-- No cluster information found -->';
    } catch (error) {
      console.error('Cluster status check failed:', error);
      return `<!-- Cluster status check failed: ${error instanceof Error ? error.message : 'Unknown error'} -->`;
    }
  }

  /**
   * Execute profile configuration retrieval
   */
  private async executeProfileConfig(
    args: string[],
    _context: DynamicResolutionContext
  ): Promise<string> {
    if (args.length < 1) {
      throw new Error('profile_config requires at least 1 argument: profileId');
    }

    const profileId = args[0];
    const configPath = args[1]; // Optional path notation (e.g., 'clusterConfig.softwareConfig.components')
    const configType = args[2] || 'general';

    if (!profileId) {
      return '<!-- No profile ID provided -->';
    }

    try {
      // Try to get profile from ProfileManager if available
      // Import ProfileManager dynamically to avoid circular dependencies
      try {
        const { ProfileManager } = await import('../services/profile.js');

        // Create a ProfileManager instance (it will scan for profiles)
        const profileManager = new ProfileManager();
        await profileManager.initialize();

        const profile = profileManager.getProfile(profileId);

        if (profile) {
          let profileData = profile;

          // Apply path extraction if specified
          if (configPath) {
            profileData = this.extractFieldPath(profile, configPath);
          }

          return this.formatProfileConfig(profileData, configType);
        }
      } catch (profileError) {
        console.warn('Failed to access ProfileManager:', profileError);
      }

      // Fallback: Search for profile information in Qdrant
      if (this.qdrantStorage) {
        const results = await this.qdrantStorage.searchSimilar(
          `profileId:${profileId} OR profile:${profileId}`,
          2,
          0.7
        );

        if (results && results.length > 0) {
          let profileData = results[0].data;

          // Apply path extraction if specified
          if (configPath) {
            profileData = this.extractFieldPath(profileData, configPath);
          }

          return this.formatProfileConfig(profileData, configType);
        }
      }

      return `<!-- Profile ${profileId} not found -->`;
    } catch (error) {
      console.error('Profile configuration retrieval failed:', error);
      return `<!-- Profile configuration retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'} -->`;
    }
  }

  /**
   * Parse filter string into filter object
   */
  private parseFilters(filterString: string): Record<string, any> {
    const filters: Record<string, any> = {};

    // Parse filters like "limit:3 type:job"
    const parts = filterString.split(' ');
    for (const part of parts) {
      if (part.includes(':')) {
        const [key, value] = part.split(':');
        if (key !== 'limit') {
          // limit is handled separately
          filters[key] = value;
        }
      }
    }

    return filters;
  }

  /**
   * Extract limit from filter string
   */
  private extractLimit(filterString?: string): number | undefined {
    if (!filterString) return undefined;

    const limitMatch = filterString.match(/limit:(\d+)/);
    return limitMatch ? parseInt(limitMatch[1], 10) : undefined;
  }

  /**
   * Format Qdrant search results for prompt inclusion
   */
  private formatQdrantResults(results: any[], _query: string): string {
    const formattedResults = results
      .map((result, index) => {
        const score = result.score ? ` (relevance: ${(result.score * 100).toFixed(1)}%)` : '';
        const content = result.payload?.content || result.payload?.text || 'No content available';
        const metadata = result.payload?.metadata
          ? ` | ${JSON.stringify(result.payload.metadata)}`
          : '';

        return `**Result ${index + 1}**${score}:\n${content}${metadata}`;
      })
      .join('\n\n');

    return `\`\`\`\n${formattedResults}\n\`\`\``;
  }

  /**
   * Format job output for prompt inclusion
   */
  private formatJobOutput(results: any[], analysisType: string): string {
    const jobData = results[0]?.payload || {};

    if (analysisType === 'error-analysis') {
      const errors =
        jobData.errors ||
        jobData.error ||
        jobData.status?.details ||
        'No error information available';
      const status = jobData.status?.state || jobData.status || 'Unknown';
      const logs = jobData.logs || jobData.driverOutputResourceUri || 'No logs available';

      return `**Job Status**: ${status}\n**Error Details**: ${errors}\n**Relevant Logs**:\n\`\`\`\n${logs}\n\`\`\``;
    }

    // Handle structured query results
    if (jobData.schema && jobData.rows) {
      const rowCount = jobData.totalRows || jobData.rows.length;
      const fieldCount = jobData.schema.fields?.length || 0;

      let output = `**Query Results Summary**:\n`;
      output += `- Total Rows: ${rowCount}\n`;
      output += `- Fields: ${fieldCount}\n`;

      if (jobData.schema.fields && jobData.schema.fields.length > 0) {
        output += `- Schema: ${jobData.schema.fields.map((f: any) => f.name).join(', ')}\n`;
      }

      if (jobData.rows && jobData.rows.length > 0) {
        output += `\n**Sample Data**:\n\`\`\`\n`;
        const sampleRows = jobData.rows.slice(0, 3);
        sampleRows.forEach((row: any, index: number) => {
          output += `Row ${index + 1}: ${Array.isArray(row) ? row.join(' | ') : JSON.stringify(row)}\n`;
        });
        if (jobData.rows.length > 3) {
          output += `... and ${jobData.rows.length - 3} more rows\n`;
        }
        output += `\`\`\``;
      }

      return output;
    }

    // Default summary format
    const status = jobData.status?.state || jobData.status || 'Unknown';
    const output = jobData.output || jobData.result || jobData.rows || 'No output available';

    return `**Job Status**: ${status}\n**Output**:\n\`\`\`\n${typeof output === 'string' ? output : JSON.stringify(output, null, 2)}\n\`\`\``;
  }

  /**
   * Format cluster status for prompt inclusion
   */
  private formatClusterStatus(results: any[], infoType: string): string {
    const clusterData = results[0]?.payload || {};

    if (infoType === 'optimization-hints') {
      // Extract machine types from cluster configuration
      const masterConfig = clusterData.config?.masterConfig;
      const workerConfig = clusterData.config?.workerConfig;
      const machineTypes: string[] = [];

      if (masterConfig?.machineTypeUri) {
        machineTypes.push(`Master: ${masterConfig.machineTypeUri.split('/').pop()}`);
      }
      if (workerConfig?.machineTypeUri) {
        machineTypes.push(`Worker: ${workerConfig.machineTypeUri.split('/').pop()}`);
      }

      const components = clusterData.config?.softwareConfig?.optionalComponents || [];
      const diskConfig = workerConfig?.diskConfig || masterConfig?.diskConfig;

      let hints = `**Machine Types**: ${machineTypes.length > 0 ? machineTypes.join(', ') : 'Not available'}\n`;
      hints += `**Components**: ${components.length > 0 ? components.join(', ') : 'Basic Hadoop/Spark'}\n`;

      if (diskConfig) {
        hints += `**Disk**: ${diskConfig.bootDiskSizeGb || 'default'}GB boot, ${diskConfig.bootDiskType || 'standard'} type\n`;
      }

      return hints;
    }

    // Default general format
    const status = clusterData.status?.state || clusterData.status || 'Unknown';
    const clusterName = clusterData.clusterName || 'Unknown';
    const zone = clusterData.config?.gceClusterConfig?.zoneUri?.split('/').pop() || 'Unknown';

    let info = `**Cluster**: ${clusterName}\n`;
    info += `**Status**: ${status}\n`;
    info += `**Zone**: ${zone}\n`;

    if (clusterData.config?.masterConfig) {
      const masterCount = clusterData.config.masterConfig.numInstances || 1;
      info += `**Master Nodes**: ${masterCount}\n`;
    }

    if (clusterData.config?.workerConfig) {
      const workerCount = clusterData.config.workerConfig.numInstances || 0;
      info += `**Worker Nodes**: ${workerCount}\n`;
    }

    return info;
  }

  /**
   * Format profile configuration for prompt inclusion
   */
  private formatProfileConfig(profileData: any, configType: string): string {
    if (configType === 'cluster-templates') {
      const clusterConfig = profileData.clusterConfig || profileData.config;
      if (clusterConfig) {
        return `**Cluster Configuration Template**:\n\`\`\`yaml\n${JSON.stringify(clusterConfig, null, 2)}\n\`\`\``;
      }
      return `**No cluster templates available in profile**`;
    }

    if (configType === 'parameters') {
      const parameters = profileData.parameters || {};
      if (Object.keys(parameters).length > 0) {
        let output = `**Profile Parameters**:\n`;
        Object.entries(parameters).forEach(([key, value]) => {
          output += `- ${key}: ${value}\n`;
        });
        return output;
      }
      return `**No parameters defined in profile**`;
    }

    // Default general format
    const profileInfo = {
      id: profileData.id,
      name: profileData.name,
      category: profileData.category,
      region: profileData.region,
      timesUsed: profileData.timesUsed,
      lastUsed: profileData.lastUsed,
      metadata: profileData.metadata,
    };

    return `**Profile Information**:\n\`\`\`yaml\n${JSON.stringify(profileInfo, null, 2)}\n\`\`\``;
  }

  /**
   * Generate cache key for function call
   */
  private generateCacheKey(
    functionName: string,
    args: string[],
    context: DynamicResolutionContext
  ): string {
    const argsHash = args.join('|');
    const contextHash = JSON.stringify(context.templateContext || {});
    return `${functionName}:${argsHash}:${contextHash}`;
  }

  /**
   * Get cached result if valid
   */
  private getCachedResult(cacheKey: string): any | null {
    const cached = this.cache.get(cacheKey);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > cached.ttl) {
      this.cache.delete(cacheKey);
      return null;
    }

    return cached.result;
  }

  /**
   * Set cached result with TTL
   */
  private setCachedResult(cacheKey: string, result: any, ttl: number): void {
    this.cache.set(cacheKey, {
      result,
      timestamp: Date.now(),
      ttl,
    });
  }

  /**
   * Clear expired cache entries
   */
  public clearExpiredCache(): void {
    const now = Date.now();
    for (const [key, cached] of this.cache.entries()) {
      if (now - cached.timestamp > cached.ttl) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys()),
    };
  }

  /**
   * Extract field value using dot notation path
   * Supports array indexing with [n] syntax
   */
  private extractFieldPath(data: any, path: string): any {
    if (!data || !path) {
      return data;
    }

    try {
      const parts = path.split('.');
      let current = data;

      for (const part of parts) {
        if (current === null || current === undefined) {
          return null;
        }

        // Handle array indexing like 'rows[0]' or 'items[2]'
        const arrayMatch = part.match(/^([^[]+)\[(\d+)\]$/);
        if (arrayMatch) {
          const [, arrayName, indexStr] = arrayMatch;
          const index = parseInt(indexStr, 10);

          if (current[arrayName] && Array.isArray(current[arrayName])) {
            current = current[arrayName][index];
          } else {
            return null;
          }
        } else {
          // Regular property access
          current = current[part];
        }
      }

      return current;
    } catch (error) {
      console.warn(`Failed to extract field path '${path}':`, error);
      return null;
    }
  }
}
