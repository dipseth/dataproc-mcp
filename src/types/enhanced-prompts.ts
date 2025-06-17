/**
 * Enhanced Prompt System Types
 * Defines interfaces for the sophisticated prompt generation system
 */

import { SecurityContext } from './templating.js';
// import { TemplateResolutionContext as _TemplateResolutionContext } from './templating.js';

/**
 * Enhanced prompt configuration
 */
export interface DataprocPromptGeneratorConfig {
  enableTemplating: boolean;
  enableKnowledgeIntegration: boolean;
  enableProfileIntegration: boolean;
  cacheConfig: {
    enableCaching: boolean;
    defaultTtlMs: number;
    maxCacheSize: number;
  };
  dynamicResolution: {
    executeAtGenerationTime: boolean;
    timeoutMs: number;
  };
  reindexing: {
    enableScheduledReindexing: boolean;
    intervalMs: number;
    batchSize: number;
    maxRetries: number;
  };
}

/**
 * Prompt context for generation
 */
export interface PromptContext {
  // Core context
  promptId: string;
  toolName: string;
  userParameters: Record<string, unknown>;

  // Environment context
  environment?: string;
  profileId?: string;
  projectId?: string;
  region?: string;

  // Knowledge context
  knowledgeQueries?: KnowledgeQuery[];
  semanticContext?: string[];

  // Template context
  templateOverrides?: Record<string, unknown>;
  dynamicFunctions?: DynamicFunction[];

  // Security context
  securityContext: SecurityContext;

  // Metadata
  requestId?: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Knowledge query specification
 */
export interface KnowledgeQuery {
  type: 'semantic' | 'tag-based' | 'hybrid';
  query: string;
  filters?: Record<string, unknown>;
  limit?: number;
  minConfidence?: number;
}

/**
 * Dynamic function specification
 */
export interface DynamicFunction {
  name: 'job_output' | 'qdrant_query' | 'profile_config' | 'cluster_status';
  args: string[];
  cacheKey?: string;
  ttl?: number;
}

/**
 * Enhanced prompt template
 */
export interface PromptTemplate {
  id: string;
  category: 'template-enhanced' | 'knowledge-driven' | 'resource-integrated' | 'fully-integrated';
  description: string;
  template: string;

  parameters: PromptParameter[];
  knowledgeQueries?: KnowledgeQuery[];
  dynamicFunctions?: DynamicFunction[];
  resourceAccess?: ResourceAccess[];
  templateResolution?: TemplateResolutionConfig;

  validation?: PromptValidation;
  metadata?: Record<string, unknown>;
}

/**
 * Prompt parameter definition
 */
export interface PromptParameter {
  name: string;
  type: 'string' | 'number' | 'boolean';
  required: boolean;
  source: 'gcp' | 'profile' | 'template' | 'tool';
  defaultValue?: unknown;
  description?: string;
  validation?: ParameterValidation;
}

/**
 * Resource access specification
 */
export interface ResourceAccess {
  uri: string;
  purpose: string;
  cacheKey?: string;
  ttl?: number;
}

/**
 * Template resolution configuration
 */
export interface TemplateResolutionConfig {
  enableParameterInjection: boolean;
  enableDynamicFunctions: boolean;
  cacheResults: boolean;
  timeoutMs?: number;
}

/**
 * Prompt validation rules
 */
export interface PromptValidation {
  requiredParameters?: string[];
  parameterConstraints?: Record<string, ParameterValidation>;
  customValidator?: (context: PromptContext) => ValidationResult;
}

/**
 * Parameter validation rules
 */
export interface ParameterValidation {
  min?: number;
  max?: number;
  pattern?: string;
  enum?: unknown[];
  customValidator?: (value: unknown) => boolean;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

/**
 * Validation error
 */
export interface ValidationError {
  code: string;
  message: string;
  parameter?: string;
  severity: 'error' | 'critical';
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  code: string;
  message: string;
  parameter?: string;
}

/**
 * Enhanced prompt result
 */
export interface EnhancedPrompt {
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: {
      type: 'text' | 'image';
      text?: string;
      data?: string;
      mimeType?: string;
    };
  }>;
  metadata: PromptMetadata;
}

/**
 * Prompt generation metadata
 */
export interface PromptMetadata {
  promptId: string;
  generationTimeMs: number;
  templateUsed: string;
  parametersResolved: Record<string, unknown>;
  knowledgeQueriesExecuted: number;
  dynamicFunctionsExecuted: number;
  cacheHit: boolean;
  validation: ValidationResult;
  timestamp: Date;
}

/**
 * Cached prompt entry
 */
export interface CachedPrompt {
  prompt: EnhancedPrompt;
  context: PromptContext;
  timestamp: Date;
  ttl: number;
  hitCount: number;
  lastAccess: Date;
}

/**
 * Knowledge query result
 */
export interface KnowledgeResults {
  results: Array<{
    type: string;
    confidence: number;
    data: unknown;
    summary: string;
  }>;
  totalResults: number;
  executionTimeMs: number;
}

/**
 * Profile parameters result
 */
export interface ProfileParameters {
  parameters: Record<string, unknown>;
  profileId: string;
  category: string;
  source: string;
}

/**
 * Resolved prompt result
 */
export interface ResolvedPrompt {
  content: string;
  resolvedParameters: Record<string, unknown>;
  knowledgeResults: KnowledgeResults;
  profileParameters: ProfileParameters;
  resolutionTimeMs: number;
  cacheHit: boolean;
}

/**
 * Reindexing configuration
 */
export interface ReindexingConfig {
  enableScheduledReindexing: boolean;
  intervalMs: number;
  batchSize: number;
  maxRetries: number;
  enableIncrementalIndexing: boolean;
  retentionDays: number;
  compressionEnabled: boolean;
}

/**
 * Reindexing status
 */
export interface ReindexingStatus {
  isRunning: boolean;
  lastRun: Date | null;
  nextRun: Date | null;
  totalDocuments: number;
  documentsProcessed: number;
  errors: string[];
  performance: {
    averageDocumentsPerSecond: number;
    totalTimeMs: number;
    memoryUsageMB: number;
  };
}

/**
 * Reindexing metrics
 */
export interface ReindexingMetrics {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  averageRunTimeMs: number;
  documentsIndexed: number;
  documentsUpdated: number;
  documentsDeleted: number;
  lastError?: string;
  lastErrorTime?: Date;
}
