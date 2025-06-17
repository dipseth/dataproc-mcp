/**
 * Dataproc Prompt Generator
 * Core orchestrator for the enhanced prompt system that integrates with
 * all existing MCP infrastructure components
 */

import {
  DataprocPromptGeneratorConfig,
  PromptContext,
  PromptTemplate,
  EnhancedPrompt,
  ResolvedPrompt,
  KnowledgeResults,
  ProfileParameters,
  CachedPrompt,
  PromptMetadata,
  ValidationResult,
} from '../types/enhanced-prompts.js';
import { TemplatingIntegration } from '../services/templating-integration.js';
import { KnowledgeIndexer } from '../services/knowledge-indexer.js';
import { ProfileManager } from '../services/profile.js';
import { ParameterInjector } from '../services/parameter-injector.js';
import { DynamicResolver } from '../services/dynamic-resolver.js';
import { DefaultParameterManager } from '../services/default-params.js';
import { KnowledgeReindexer } from '../services/knowledge-reindexer.js';
// import { SecurityContext as _SecurityContext } from '../types/templating.js';
import { logger } from '../utils/logger.js';

/**
 * Default configuration for the prompt generator
 */
const DEFAULT_CONFIG: DataprocPromptGeneratorConfig = {
  enableTemplating: true,
  enableKnowledgeIntegration: true,
  enableProfileIntegration: true,
  cacheConfig: {
    enableCaching: true,
    defaultTtlMs: 300000, // 5 minutes
    maxCacheSize: 1000,
  },
  dynamicResolution: {
    executeAtGenerationTime: true,
    timeoutMs: 10000, // 10 seconds
  },
  reindexing: {
    enableScheduledReindexing: true,
    intervalMs: 6 * 60 * 60 * 1000, // 6 hours
    batchSize: 100,
    maxRetries: 3,
  },
};

/**
 * Dataproc Prompt Generator class
 * Orchestrates all prompt generation activities with full MCP integration
 */
export class DataprocPromptGenerator {
  private config: DataprocPromptGeneratorConfig;
  private templatingIntegration?: TemplatingIntegration;
  private knowledgeIndexer?: KnowledgeIndexer;
  private profileManager?: ProfileManager;
  private parameterInjector?: ParameterInjector;
  private dynamicResolver?: DynamicResolver;
  private defaultParameterManager?: DefaultParameterManager;
  private knowledgeReindexer?: KnowledgeReindexer;

  private promptCache: Map<string, CachedPrompt> = new Map();
  private promptTemplates: Map<string, PromptTemplate> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  private metrics = {
    totalGenerations: 0,
    cacheHits: 0,
    cacheMisses: 0,
    averageGenerationTimeMs: 0,
    knowledgeQueriesExecuted: 0,
    dynamicFunctionsExecuted: 0,
    errors: 0,
  };

  constructor(
    config?: Partial<DataprocPromptGeneratorConfig>,
    dependencies?: {
      templatingIntegration?: TemplatingIntegration;
      knowledgeIndexer?: KnowledgeIndexer;
      profileManager?: ProfileManager;
      parameterInjector?: ParameterInjector;
      dynamicResolver?: DynamicResolver;
      defaultParameterManager?: DefaultParameterManager;
    }
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Set dependencies
    if (dependencies) {
      this.templatingIntegration = dependencies.templatingIntegration;
      this.knowledgeIndexer = dependencies.knowledgeIndexer;
      this.profileManager = dependencies.profileManager;
      this.parameterInjector = dependencies.parameterInjector;
      this.dynamicResolver = dependencies.dynamicResolver;
      this.defaultParameterManager = dependencies.defaultParameterManager;
    }

    // Initialize knowledge reindexer if knowledge integration is enabled
    if (this.config.enableKnowledgeIntegration && this.knowledgeIndexer) {
      this.knowledgeReindexer = new KnowledgeReindexer(
        this.knowledgeIndexer,
        this.config.reindexing
      );
    }

    // Start cache cleanup interval
    if (this.config.cacheConfig.enableCaching) {
      this.cleanupInterval = setInterval(
        () => this.cleanupCache(),
        60000 // Every minute
      );
    }

    logger.info('DataprocPromptGenerator: Initialized with config', this.config);
  }

  /**
   * Set service dependencies (for late initialization)
   */
  setDependencies(dependencies: {
    templatingIntegration?: TemplatingIntegration;
    knowledgeIndexer?: KnowledgeIndexer;
    profileManager?: ProfileManager;
    parameterInjector?: ParameterInjector;
    dynamicResolver?: DynamicResolver;
    defaultParameterManager?: DefaultParameterManager;
  }): void {
    Object.assign(this, dependencies);

    // Initialize knowledge reindexer if not already done
    if (
      this.config.enableKnowledgeIntegration &&
      this.knowledgeIndexer &&
      !this.knowledgeReindexer
    ) {
      this.knowledgeReindexer = new KnowledgeReindexer(
        this.knowledgeIndexer,
        this.config.reindexing
      );
    }

    logger.debug('DataprocPromptGenerator: Dependencies updated');
  }

  /**
   * Register a prompt template
   */
  registerTemplate(template: PromptTemplate): void {
    // Validate template
    const validation = this.validateTemplate(template);
    if (!validation.valid) {
      throw new Error(
        `Template validation failed: ${validation.errors.map((e) => e.message).join(', ')}`
      );
    }

    this.promptTemplates.set(template.id, template);
    logger.debug(`DataprocPromptGenerator: Registered template ${template.id}`);
  }

  /**
   * Generate an enhanced prompt
   */
  async generatePrompt(promptId: string, context: PromptContext): Promise<EnhancedPrompt> {
    const startTime = Date.now();
    this.metrics.totalGenerations++;

    try {
      // Check cache first
      if (this.config.cacheConfig.enableCaching) {
        const cached = this.getCachedPrompt(promptId, context);
        if (cached) {
          this.metrics.cacheHits++;
          cached.hitCount++;
          cached.lastAccess = new Date();
          return cached.prompt;
        }
        this.metrics.cacheMisses++;
      }

      // Get template
      const template = this.promptTemplates.get(promptId);
      if (!template) {
        throw new Error(`Template not found: ${promptId}`);
      }

      // Build complete context
      const enhancedContext = await this.buildPromptContext(context, template);

      // Resolve template with all integrations
      const resolvedPrompt = await this.resolvePromptTemplate(template, enhancedContext);

      // Build final prompt
      const enhancedPrompt = this.buildFinalPrompt(template, resolvedPrompt, enhancedContext);

      // Cache the result
      if (this.config.cacheConfig.enableCaching) {
        this.cachePrompt(promptId, context, enhancedPrompt);
      }

      // Update metrics
      const generationTime = Date.now() - startTime;
      this.updateMetrics(generationTime, resolvedPrompt);

      logger.debug(`DataprocPromptGenerator: Generated prompt ${promptId} in ${generationTime}ms`);
      return enhancedPrompt;
    } catch (error) {
      this.metrics.errors++;
      logger.error(`DataprocPromptGenerator: Error generating prompt ${promptId}`, error);
      throw error;
    }
  }

  /**
   * Resolve prompt template with all integrations
   */
  async resolvePromptTemplate(
    template: PromptTemplate,
    context: PromptContext
  ): Promise<ResolvedPrompt> {
    const startTime = Date.now();
    let content = template.template;

    // Step 1: Execute knowledge queries
    const knowledgeResults = await this.executeKnowledgeQueries(template, context);

    // Step 2: Resolve profile parameters
    const profileParameters = await this.resolveProfileParameters(context);

    // Step 3: Resolve template parameters using parameter injector
    let resolvedParameters: Record<string, unknown> = { ...context.userParameters };

    if (this.config.enableTemplating && this.parameterInjector) {
      try {
        const parameterSet = await this.parameterInjector.injectParameters(
          {
            id: template.id,
            pattern: 'dataproc://prompt/{promptId}',
            description: template.description,
            category: 'prompt' as any,
            parameters: template.parameters.map((p) => ({
              name: p.name,
              type: p.type,
              required: p.required,
              source: p.source,
              description: p.description,
              validation: p.validation,
            })),
          },
          {
            templateId: template.id,
            toolName: context.toolName,
            environment: context.environment,
            profileId: context.profileId,
            userOverrides: context.userParameters,
            securityContext: context.securityContext,
          }
        );

        if (parameterSet.validation.valid) {
          resolvedParameters = parameterSet.resolved;
        }
      } catch (error) {
        logger.warn(
          'DataprocPromptGenerator: Parameter injection failed, using user parameters',
          error
        );
      }
    }

    // Step 4: Resolve dynamic functions
    if (this.config.dynamicResolution.executeAtGenerationTime) {
      content = await this.resolveDynamicFunctions(
        content,
        context,
        knowledgeResults,
        profileParameters
      );
    }

    // Step 5: Replace template variables
    content = this.replaceTemplateVariables(
      content,
      resolvedParameters,
      knowledgeResults,
      profileParameters
    );

    const resolutionTimeMs = Date.now() - startTime;

    return {
      content,
      resolvedParameters,
      knowledgeResults,
      profileParameters,
      resolutionTimeMs,
      cacheHit: false,
    };
  }

  /**
   * Execute knowledge queries for the template
   */
  private async executeKnowledgeQueries(
    template: PromptTemplate,
    context: PromptContext
  ): Promise<KnowledgeResults> {
    if (
      !this.config.enableKnowledgeIntegration ||
      !this.knowledgeIndexer ||
      !template.knowledgeQueries
    ) {
      return {
        results: [],
        totalResults: 0,
        executionTimeMs: 0,
      };
    }

    const startTime = Date.now();
    const allResults: any[] = [];

    try {
      for (const query of template.knowledgeQueries) {
        this.metrics.knowledgeQueriesExecuted++;

        // Replace template variables in query
        const resolvedQuery = this.replaceTemplateVariables(
          query.query,
          context.userParameters,
          { results: [], totalResults: 0, executionTimeMs: 0 },
          { parameters: {}, profileId: '', category: '', source: '' }
        );

        const results = await this.knowledgeIndexer.queryKnowledge(resolvedQuery, {
          type: query.type === 'semantic' ? 'all' : (query.type as any),
          projectId: context.projectId,
          region: context.region,
          limit: query.limit || 5,
        });

        allResults.push(...results);
      }

      return {
        results: allResults,
        totalResults: allResults.length,
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      logger.warn('DataprocPromptGenerator: Knowledge query execution failed', error);
      return {
        results: [],
        totalResults: 0,
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Resolve profile parameters
   */
  private async resolveProfileParameters(context: PromptContext): Promise<ProfileParameters> {
    if (!this.config.enableProfileIntegration || !this.profileManager || !context.profileId) {
      return {
        parameters: {},
        profileId: '',
        category: '',
        source: 'none',
      };
    }

    try {
      const profile = await this.profileManager.getProfile(context.profileId);
      return {
        parameters: this.profileManager.getProfileParameters(context.profileId),
        profileId: context.profileId,
        category: profile?.category || '',
        source: 'profile',
      };
    } catch (error) {
      logger.warn('DataprocPromptGenerator: Profile parameter resolution failed', error);
      return {
        parameters: {},
        profileId: context.profileId,
        category: '',
        source: 'error',
      };
    }
  }

  /**
   * Resolve dynamic functions in template content
   */
  private async resolveDynamicFunctions(
    content: string,
    context: PromptContext,
    knowledgeResults: KnowledgeResults,
    profileParameters: ProfileParameters
  ): Promise<string> {
    if (!this.dynamicResolver) {
      return content;
    }

    try {
      // Set up dynamic context
      if (this.dynamicResolver.setContext && this.knowledgeIndexer) {
        // Note: We need jobTracker and asyncQueryPoller for full dynamic context
        // For now, we'll create a minimal context with available services
        const dynamicContext = {
          knowledgeIndexer: this.knowledgeIndexer,
          templateContext: {
            templateId: context.promptId,
            toolName: context.toolName,
            environment: context.environment,
            profileId: context.profileId,
            userOverrides: context.userParameters,
            securityContext: context.securityContext,
          },
        } as any; // Type assertion for now until we have all required services

        this.dynamicResolver.setContext(dynamicContext);
      }

      // Parse and resolve dynamic functions
      const functionCalls = this.dynamicResolver.parseFunctionCalls(content);

      for (const functionCall of functionCalls) {
        this.metrics.dynamicFunctionsExecuted++;

        // Execute function and replace in content
        try {
          const result = await this.executeDynamicFunction(
            functionCall,
            context,
            knowledgeResults,
            profileParameters
          );
          content = content.replace(functionCall.original, String(result));
        } catch (error) {
          logger.warn(
            `DataprocPromptGenerator: Dynamic function ${functionCall.name} failed`,
            error
          );
          content = content.replace(functionCall.original, `[Error: ${functionCall.name} failed]`);
        }
      }

      return content;
    } catch (error) {
      logger.warn('DataprocPromptGenerator: Dynamic function resolution failed', error);
      return content;
    }
  }

  /**
   * Execute a single dynamic function
   */
  private async executeDynamicFunction(
    functionCall: any,
    context: PromptContext,
    knowledgeResults: KnowledgeResults,
    profileParameters: ProfileParameters
  ): Promise<unknown> {
    switch (functionCall.name) {
      case 'qdrant_query':
        if (this.knowledgeIndexer && functionCall.args.length >= 1) {
          const query = functionCall.args[0];
          const options = functionCall.args[1] ? this.parseQueryOptions(functionCall.args[1]) : {};
          const results = await this.knowledgeIndexer.queryKnowledge(query, options);
          return this.formatKnowledgeResults(results);
        }
        return '[No knowledge indexer available]';

      case 'profile_config':
        if (this.profileManager && functionCall.args.length >= 1) {
          const configKey = functionCall.args[0];
          const profileConfig = profileParameters.parameters[configKey];
          return profileConfig ? JSON.stringify(profileConfig, null, 2) : '[Config not found]';
        }
        return '[No profile manager available]';

      case 'job_output':
        // This would integrate with job tracking system
        return '[Job output integration not implemented]';

      case 'cluster_status':
        // This would integrate with cluster tracking system
        return '[Cluster status integration not implemented]';

      default:
        throw new Error(`Unknown dynamic function: ${functionCall.name}`);
    }
  }

  /**
   * Parse query options from string
   */
  private parseQueryOptions(optionsString: string): any {
    const options: any = {};

    // Parse "limit:3 type:job" format
    const parts = optionsString.split(' ');
    for (const part of parts) {
      const [key, value] = part.split(':');
      if (key && value) {
        if (key === 'limit') {
          options.limit = parseInt(value);
        } else if (key === 'type') {
          options.type = value;
        } else {
          options[key] = value;
        }
      }
    }

    return options;
  }

  /**
   * Format knowledge results for template insertion
   */
  private formatKnowledgeResults(results: any[]): string {
    if (results.length === 0) {
      return '[No relevant examples found]';
    }

    return results
      .map((result, index) => {
        const confidence = (result.confidence * 100).toFixed(1);
        return `${index + 1}. ${result.summary} (${confidence}% confidence)`;
      })
      .join('\n');
  }

  /**
   * Replace template variables in content
   */
  private replaceTemplateVariables(
    content: string,
    parameters: Record<string, unknown>,
    _knowledgeResults: KnowledgeResults,
    _profileParameters: ProfileParameters
  ): string {
    // Replace {{variable}} patterns
    return content.replace(/\{\{([^}]+)\}\}/g, (match, variable) => {
      const trimmed = variable.trim();

      // Handle conditional expressions like {{variable || 'default'}}
      if (trimmed.includes('||')) {
        const [varName, defaultValue] = trimmed.split('||').map((s) => s.trim());
        const value = parameters[varName];
        if (value !== undefined && value !== null && value !== '') {
          return String(value);
        }
        // Remove quotes from default value
        return defaultValue.replace(/^['"]|['"]$/g, '');
      }

      // Simple variable replacement
      const value = parameters[trimmed];
      return value !== undefined ? String(value) : match;
    });
  }

  /**
   * Build complete prompt context
   */
  private async buildPromptContext(
    context: PromptContext,
    template: PromptTemplate
  ): Promise<PromptContext> {
    const enhancedContext = { ...context };

    // Add default parameters if available
    if (this.defaultParameterManager) {
      try {
        const defaults = this.defaultParameterManager.getAllParameters(context.environment);
        enhancedContext.projectId = enhancedContext.projectId || (defaults.projectId as string);
        enhancedContext.region = enhancedContext.region || (defaults.region as string);
      } catch (error) {
        logger.debug('DataprocPromptGenerator: Could not get default parameters', error);
      }
    }

    // Add template-specific knowledge queries
    if (template.knowledgeQueries) {
      enhancedContext.knowledgeQueries = [
        ...(enhancedContext.knowledgeQueries || []),
        ...template.knowledgeQueries,
      ];
    }

    // Add template-specific dynamic functions
    if (template.dynamicFunctions) {
      enhancedContext.dynamicFunctions = [
        ...(enhancedContext.dynamicFunctions || []),
        ...template.dynamicFunctions,
      ];
    }

    return enhancedContext;
  }

  /**
   * Build final enhanced prompt
   */
  private buildFinalPrompt(
    template: PromptTemplate,
    resolvedPrompt: ResolvedPrompt,
    _context: PromptContext
  ): EnhancedPrompt {
    const metadata: PromptMetadata = {
      promptId: template.id,
      generationTimeMs: resolvedPrompt.resolutionTimeMs,
      templateUsed: template.id,
      parametersResolved: resolvedPrompt.resolvedParameters,
      knowledgeQueriesExecuted: resolvedPrompt.knowledgeResults.totalResults,
      dynamicFunctionsExecuted: template.dynamicFunctions?.length || 0,
      cacheHit: resolvedPrompt.cacheHit,
      validation: { valid: true, errors: [], warnings: [] },
      timestamp: new Date(),
    };

    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: resolvedPrompt.content,
          },
        },
      ],
      metadata,
    };
  }

  /**
   * Validate template
   */
  private validateTemplate(template: PromptTemplate): ValidationResult {
    const errors: any[] = [];
    const warnings: any[] = [];

    if (!template.id) {
      errors.push({ code: 'MISSING_ID', message: 'Template ID is required', severity: 'error' });
    }

    if (!template.template) {
      errors.push({
        code: 'MISSING_TEMPLATE',
        message: 'Template content is required',
        severity: 'error',
      });
    }

    if (!template.parameters || template.parameters.length === 0) {
      warnings.push({ code: 'NO_PARAMETERS', message: 'Template has no parameters defined' });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Cache management methods
   */
  private getCachedPrompt(promptId: string, context: PromptContext): CachedPrompt | null {
    const cacheKey = this.createCacheKey(promptId, context);
    const cached = this.promptCache.get(cacheKey);

    if (!cached) {
      return null;
    }

    // Check if cache entry is still valid
    const age = Date.now() - cached.timestamp.getTime();
    if (age > cached.ttl) {
      this.promptCache.delete(cacheKey);
      return null;
    }

    return cached;
  }

  private cachePrompt(promptId: string, context: PromptContext, prompt: EnhancedPrompt): void {
    const cacheKey = this.createCacheKey(promptId, context);
    const cached: CachedPrompt = {
      prompt,
      context,
      timestamp: new Date(),
      ttl: this.config.cacheConfig.defaultTtlMs,
      hitCount: 0,
      lastAccess: new Date(),
    };

    this.promptCache.set(cacheKey, cached);

    // Enforce cache size limit
    if (this.promptCache.size > this.config.cacheConfig.maxCacheSize) {
      this.evictOldestCacheEntry();
    }
  }

  private createCacheKey(promptId: string, context: PromptContext): string {
    const keyParts = [
      promptId,
      context.toolName,
      context.environment || 'default',
      context.profileId || 'none',
      JSON.stringify(context.userParameters),
    ];
    return keyParts.join('|');
  }

  private evictOldestCacheEntry(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.promptCache.entries()) {
      if (entry.lastAccess.getTime() < oldestTime) {
        oldestTime = entry.lastAccess.getTime();
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.promptCache.delete(oldestKey);
    }
  }

  private cleanupCache(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.promptCache.entries()) {
      const age = now - entry.timestamp.getTime();
      if (age > entry.ttl) {
        this.promptCache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug(`DataprocPromptGenerator: Cleaned up ${cleanedCount} expired cache entries`);
    }
  }

  /**
   * Update metrics
   */
  private updateMetrics(generationTimeMs: number, _resolvedPrompt: ResolvedPrompt): void {
    // Update average generation time
    const totalTime =
      this.metrics.averageGenerationTimeMs * (this.metrics.totalGenerations - 1) + generationTimeMs;
    this.metrics.averageGenerationTimeMs = totalTime / this.metrics.totalGenerations;
  }

  /**
   * Get metrics
   */
  getMetrics(): typeof this.metrics {
    return { ...this.metrics };
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
  } {
    const totalRequests = this.metrics.cacheHits + this.metrics.cacheMisses;
    const hitRate = totalRequests > 0 ? this.metrics.cacheHits / totalRequests : 0;

    return {
      size: this.promptCache.size,
      maxSize: this.config.cacheConfig.maxCacheSize,
      hitRate,
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.promptCache.clear();
    logger.debug('DataprocPromptGenerator: Cache cleared');
  }

  /**
   * Get reindexing status
   */
  getReindexingStatus(): any {
    return this.knowledgeReindexer?.getStatus() || null;
  }

  /**
   * Trigger manual reindexing
   */
  async triggerReindexing(options?: { forceFullReindex?: boolean }): Promise<void> {
    if (this.knowledgeReindexer) {
      await this.knowledgeReindexer.performManualReindex(options);
    } else {
      throw new Error('Knowledge reindexer not available');
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    logger.info('DataprocPromptGenerator: Initiating graceful shutdown');

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    if (this.knowledgeReindexer) {
      await this.knowledgeReindexer.shutdown();
    }

    this.promptCache.clear();
    logger.info('DataprocPromptGenerator: Shutdown complete');
  }
}
