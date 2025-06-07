/**
 * Dynamic Resolver Service
 * Parses and resolves dynamic template functions like {{job_output()}} and {{qdrant_query()}}
 */

import {
  FunctionCall,
  DynamicResolutionContext,
  DynamicCacheEntry,
  FunctionExecutionResult,
  DynamicResolverConfig,
  DynamicResolverMetrics,
  DynamicResolutionError,
  DynamicFunctionType,
} from '../types/dynamic-templating.js';
import { TemplateResolutionContext } from '../types/templating.js';
import { logger } from '../utils/logger.js';

/**
 * Default configuration for dynamic resolver
 */
const DEFAULT_CONFIG: DynamicResolverConfig = {
  enableCaching: true,
  defaultTtlMs: 300000, // 5 minutes
  maxCacheSize: 1000,
  executionTimeoutMs: 10000, // 10 seconds
  enableMetrics: true,
  jobOutput: {
    defaultTimeoutMs: 30000, // 30 seconds
    waitForCompletion: false,
    cacheTtlMs: 600000, // 10 minutes
  },
  qdrantQuery: {
    defaultMinConfidence: 0.7,
    defaultMaxResults: 5,
    cacheTtlMs: 1800000, // 30 minutes
  },
};

/**
 * Dynamic Resolver class for parsing and executing template functions
 */
export class DynamicResolver {
  private config: DynamicResolverConfig;
  private cache: Map<string, DynamicCacheEntry> = new Map();
  private metrics: DynamicResolverMetrics;
  private context?: DynamicResolutionContext;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config?: Partial<DynamicResolverConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.metrics = this.initializeMetrics();

    // Start cache cleanup interval
    if (this.config.enableCaching) {
      this.cleanupInterval = setInterval(() => this.cleanupCache(), 60000); // Every minute
    }

    logger.debug('DynamicResolver: Initialized with config', this.config);
  }

  /**
   * Set the resolution context (services needed for function execution)
   */
  setContext(context: DynamicResolutionContext): void {
    this.context = context;
    logger.debug('DynamicResolver: Context set');
  }

  /**
   * Main entry point: resolve dynamic parameters in a parameter set
   */
  async resolveDynamicParameters(
    parameters: Record<string, unknown>,
    templateContext: TemplateResolutionContext
  ): Promise<Record<string, unknown>> {
    const startTime = Date.now();

    if (!this.context) {
      throw new Error('DynamicResolver: Context not set. Call setContext() first.');
    }

    // Update template context in resolution context
    this.context.templateContext = templateContext;

    const resolved: Record<string, unknown> = {};
    const resolutionPromises: Promise<void>[] = [];

    // Process each parameter
    for (const [key, value] of Object.entries(parameters)) {
      if (typeof value === 'string' && this.containsDynamicFunction(value)) {
        // Resolve dynamic function asynchronously
        resolutionPromises.push(
          this.resolveParameterValue(key, value).then((resolvedValue) => {
            resolved[key] = resolvedValue;
          })
        );
      } else {
        // Static value, copy as-is
        resolved[key] = value;
      }
    }

    // Wait for all dynamic resolutions to complete
    await Promise.all(resolutionPromises);

    const resolutionTime = Date.now() - startTime;
    logger.debug(
      `DynamicResolver: Resolved ${resolutionPromises.length} dynamic parameters in ${resolutionTime}ms`
    );

    return resolved;
  }

  /**
   * Check if a string contains dynamic function calls
   */
  private containsDynamicFunction(value: string): boolean {
    return /\{\{[^}]+\}\}/.test(value);
  }

  /**
   * Resolve a single parameter value that may contain dynamic functions
   */
  private async resolveParameterValue(key: string, value: string): Promise<unknown> {
    const functionCalls = this.parseFunctionCalls(value);

    if (functionCalls.length === 0) {
      return value; // No functions found
    }

    if (functionCalls.length === 1 && functionCalls[0].original === value) {
      // Single function call that is the entire value
      const result = await this.executeFunction(functionCalls[0]);
      return result.value;
    }

    // Multiple functions or mixed content - replace each function with its result
    let resolvedValue = value;
    for (const functionCall of functionCalls) {
      const result = await this.executeFunction(functionCall);
      resolvedValue = resolvedValue.replace(functionCall.original, String(result.value));
    }

    return resolvedValue;
  }

  /**
   * Parse function calls from a template string
   */
  parseFunctionCalls(template: string): FunctionCall[] {
    const functionCalls: FunctionCall[] = [];
    const regex = /\{\{([^}]+)\}\}/g;
    let match;

    while ((match = regex.exec(template)) !== null) {
      const fullMatch = match[0];
      const functionContent = match[1].trim();

      try {
        const parsed = this.parseSingleFunction(functionContent);
        if (parsed) {
          functionCalls.push({
            ...parsed,
            original: fullMatch,
            position: {
              start: match.index,
              end: match.index + fullMatch.length,
            },
          });
        }
      } catch (error) {
        logger.warn(`DynamicResolver: Failed to parse function "${functionContent}":`, error);
        // Continue parsing other functions
      }
    }

    return functionCalls;
  }

  /**
   * Parse a single function call string
   */
  private parseSingleFunction(
    functionContent: string
  ): Omit<FunctionCall, 'original' | 'position'> | null {
    // Match function_name(arg1, arg2, ...)
    const match = functionContent.match(/^(\w+)\s*\(\s*(.*?)\s*\)$/);
    if (!match) {
      return null;
    }

    const [, functionName, argsString] = match;

    // Validate function name
    if (!this.isValidFunctionName(functionName)) {
      throw new Error(`Unknown function: ${functionName}`);
    }

    // Parse arguments
    const args = this.parseArguments(argsString);

    return {
      name: functionName as DynamicFunctionType,
      args,
    };
  }

  /**
   * Check if function name is valid
   */
  private isValidFunctionName(name: string): name is DynamicFunctionType {
    return ['job_output', 'qdrant_query'].includes(name);
  }

  /**
   * Parse function arguments from string
   */
  private parseArguments(argsString: string): string[] {
    if (!argsString.trim()) {
      return [];
    }

    const args: string[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';
    let depth = 0;

    for (let i = 0; i < argsString.length; i++) {
      const char = argsString[i];
      const prevChar = i > 0 ? argsString[i - 1] : '';

      if (!inQuotes && (char === '"' || char === "'")) {
        inQuotes = true;
        quoteChar = char;
        current += char;
      } else if (inQuotes && char === quoteChar && prevChar !== '\\') {
        inQuotes = false;
        quoteChar = '';
        current += char;
      } else if (!inQuotes && char === '(') {
        depth++;
        current += char;
      } else if (!inQuotes && char === ')') {
        depth--;
        current += char;
      } else if (!inQuotes && char === ',' && depth === 0) {
        args.push(this.cleanArgument(current));
        current = '';
      } else {
        current += char;
      }
    }

    if (current.trim()) {
      args.push(this.cleanArgument(current));
    }

    return args;
  }

  /**
   * Clean and validate a single argument
   */
  private cleanArgument(arg: string): string {
    const cleaned = arg.trim();

    // Remove surrounding quotes if present
    if (
      (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
      (cleaned.startsWith("'") && cleaned.endsWith("'"))
    ) {
      return cleaned.slice(1, -1);
    }

    return cleaned;
  }

  /**
   * Execute a parsed function call
   */
  private async executeFunction(functionCall: FunctionCall): Promise<FunctionExecutionResult> {
    const startTime = Date.now();

    // Check cache first
    if (this.config.enableCaching) {
      const cached = this.getCachedResult(functionCall);
      if (cached) {
        this.updateMetrics(functionCall.name, true, Date.now() - startTime, true);
        return {
          value: cached.value,
          success: true,
          executionTimeMs: Date.now() - startTime,
          cached: true,
          metadata: cached.metadata,
        };
      }
    }

    try {
      // Import and execute the appropriate function
      const { TemplateFunctions } = await import('./template-functions.js');
      const templateFunctions = new TemplateFunctions(this.context!);

      let result: unknown;

      switch (functionCall.name) {
        case 'job_output':
          if (functionCall.args.length !== 2) {
            throw new Error(
              `job_output requires exactly 2 arguments, got ${functionCall.args.length}`
            );
          }
          result = await templateFunctions.jobOutput(functionCall.args[0], functionCall.args[1]);
          break;

        case 'qdrant_query':
          if (functionCall.args.length !== 2) {
            throw new Error(
              `qdrant_query requires exactly 2 arguments, got ${functionCall.args.length}`
            );
          }
          result = await templateFunctions.qdrantQuery(functionCall.args[0], functionCall.args[1]);
          break;

        default:
          throw new Error(`Unsupported function: ${functionCall.name}`);
      }

      const executionTime = Date.now() - startTime;

      // Cache the result
      if (this.config.enableCaching) {
        this.cacheResult(functionCall, result, executionTime);
      }

      this.updateMetrics(functionCall.name, true, executionTime, false);

      return {
        value: result,
        success: true,
        executionTimeMs: executionTime,
        cached: false,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.updateMetrics(functionCall.name, false, executionTime, false);

      logger.error(`DynamicResolver: Function execution failed for ${functionCall.name}:`, error);

      throw new DynamicResolutionError(
        `Failed to execute ${functionCall.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        functionCall,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get cached result for a function call
   */
  private getCachedResult(functionCall: FunctionCall): DynamicCacheEntry | null {
    const cacheKey = this.createCacheKey(functionCall);
    const cached = this.cache.get(cacheKey);

    if (!cached) {
      return null;
    }

    // Check if cache entry is still valid
    const age = Date.now() - cached.timestamp.getTime();
    if (age > cached.ttl) {
      this.cache.delete(cacheKey);
      return null;
    }

    return cached;
  }

  /**
   * Cache a function result
   */
  private cacheResult(functionCall: FunctionCall, value: unknown, executionTimeMs: number): void {
    const cacheKey = this.createCacheKey(functionCall);
    const ttl = this.getTtlForFunction(functionCall.name);

    const cacheEntry: DynamicCacheEntry = {
      value,
      timestamp: new Date(),
      ttl,
      functionCall,
      metadata: {
        resolutionTimeMs: executionTimeMs,
        source: 'fresh',
      },
    };

    this.cache.set(cacheKey, cacheEntry);

    // Enforce cache size limit
    if (this.cache.size > this.config.maxCacheSize) {
      this.evictOldestCacheEntry();
    }
  }

  /**
   * Create cache key for a function call
   */
  private createCacheKey(functionCall: FunctionCall): string {
    return `${functionCall.name}:${functionCall.args.join(':')}`;
  }

  /**
   * Get TTL for a specific function type
   */
  private getTtlForFunction(functionName: DynamicFunctionType): number {
    switch (functionName) {
      case 'job_output':
        return this.config.jobOutput.cacheTtlMs;
      case 'qdrant_query':
        return this.config.qdrantQuery.cacheTtlMs;
      default:
        return this.config.defaultTtlMs;
    }
  }

  /**
   * Evict oldest cache entry
   */
  private evictOldestCacheEntry(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp.getTime() < oldestTime) {
        oldestTime = entry.timestamp.getTime();
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      const age = now - entry.timestamp.getTime();
      if (age > entry.ttl) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug(`DynamicResolver: Cleaned up ${cleanedCount} expired cache entries`);
    }
  }

  /**
   * Update metrics
   */
  private updateMetrics(
    functionName: DynamicFunctionType,
    success: boolean,
    executionTimeMs: number,
    cached: boolean
  ): void {
    if (!this.config.enableMetrics) {
      return;
    }

    this.metrics.totalCalls++;

    if (success) {
      this.metrics.successfulResolutions++;
    } else {
      this.metrics.failedResolutions++;
    }

    if (cached) {
      this.metrics.cacheHits++;
    } else {
      this.metrics.cacheMisses++;
    }

    // Update average resolution time
    const totalTime =
      this.metrics.averageResolutionTimeMs * (this.metrics.totalCalls - 1) + executionTimeMs;
    this.metrics.averageResolutionTimeMs = totalTime / this.metrics.totalCalls;

    // Update function-specific metrics
    const funcMetrics = this.metrics.functionMetrics[functionName];
    funcMetrics.calls++;

    if (success) {
      funcMetrics.successes++;
    } else {
      funcMetrics.failures++;
    }

    // Update function average time
    const funcTotalTime = funcMetrics.averageTimeMs * (funcMetrics.calls - 1) + executionTimeMs;
    funcMetrics.averageTimeMs = funcTotalTime / funcMetrics.calls;
  }

  /**
   * Initialize metrics structure
   */
  private initializeMetrics(): DynamicResolverMetrics {
    return {
      totalCalls: 0,
      successfulResolutions: 0,
      failedResolutions: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageResolutionTimeMs: 0,
      functionMetrics: {
        job_output: {
          calls: 0,
          successes: 0,
          failures: 0,
          averageTimeMs: 0,
        },
        qdrant_query: {
          calls: 0,
          successes: 0,
          failures: 0,
          averageTimeMs: 0,
          averageConfidence: 0,
        },
      },
    };
  }

  /**
   * Get current metrics
   */
  getMetrics(): DynamicResolverMetrics {
    return { ...this.metrics };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    logger.debug('DynamicResolver: Cache cleared');
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
      size: this.cache.size,
      maxSize: this.config.maxCacheSize,
      hitRate,
    };
  }

  /**
   * Graceful shutdown - cleanup intervals and resources
   */
  async shutdown(): Promise<void> {
    logger.info('DynamicResolver: Initiating graceful shutdown');

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      logger.debug('DynamicResolver: Cleanup interval stopped');
    }

    // Clear cache
    this.cache.clear();

    logger.info('DynamicResolver: Shutdown complete');
  }
}
