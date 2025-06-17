/**
 * MCP Prompt Templates Service
 * Implements reusable prompt templates with context-aware completions
 * Following MCP SDK 1.12.3 best practices
 */

import { z } from 'zod';
import { logger } from '../utils/logger.js';
import { DefaultParameterManager } from './default-params.js';
import { ProfileManager } from './profile.js';

/**
 * Prompt template definition with completions
 */
export interface PromptTemplateDefinition {
  name: string;
  title: string;
  description: string;
  argsSchema: z.ZodObject<any>;
  handler: (args: any) => {
    messages: Array<{
      role: 'user' | 'assistant' | 'system';
      content: {
        type: 'text' | 'image';
        text?: string;
        data?: string;
        mimeType?: string;
      };
    }>;
  };
}

/**
 * Prompt Templates Service
 */
export class PromptTemplatesService {
  private templates: Map<string, PromptTemplateDefinition> = new Map();
  private defaultParamManager?: DefaultParameterManager;
  private profileManager?: ProfileManager;

  constructor(defaultParamManager?: DefaultParameterManager, profileManager?: ProfileManager) {
    this.defaultParamManager = defaultParamManager;
    this.profileManager = profileManager;
    this.initializeTemplates();
  }

  /**
   * Initialize built-in prompt templates
   */
  private initializeTemplates(): void {
    // Dataproc Query Analysis Template
    this.registerTemplate({
      name: 'analyze-dataproc-query',
      title: 'Analyze Dataproc Query',
      description: 'Analyze Hive/Spark queries for optimization and best practices',
      argsSchema: z.object({
        query: z.string().describe('SQL/HiveQL query to analyze'),
        queryType: z.enum(['hive', 'spark', 'presto', 'auto']).optional(),
        clusterName: z.string().optional(),
        optimizationLevel: z.enum(['basic', 'advanced', 'expert']).optional(),
      }),
      handler: ({ query, queryType, clusterName, optimizationLevel }) => ({
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text:
                `Please analyze this ${queryType || 'SQL'} query for optimization opportunities and best practices:\n\n` +
                `**Query:**\n\`\`\`sql\n${query}\n\`\`\`\n\n` +
                `**Context:**\n` +
                `- Query Type: ${queryType || 'auto-detect'}\n` +
                `- Cluster: ${clusterName || 'not specified'}\n` +
                `- Analysis Level: ${optimizationLevel || 'basic'}\n\n` +
                `**Please provide:**\n` +
                `1. Query performance analysis\n` +
                `2. Optimization suggestions\n` +
                `3. Best practices recommendations\n` +
                `4. Potential issues or warnings`,
            },
          },
        ],
      }),
    });

    // Cluster Configuration Template
    this.registerTemplate({
      name: 'design-dataproc-cluster',
      title: 'Design Dataproc Cluster',
      description: 'Generate cluster configuration recommendations based on workload requirements',
      argsSchema: z.object({
        workloadType: z.enum(['analytics', 'ml', 'streaming', 'batch', 'mixed']),
        dataSize: z.enum(['small', 'medium', 'large', 'xlarge']),
        budget: z.enum(['low', 'medium', 'high', 'unlimited']),
        region: z.string().optional(),
        requirements: z.string().optional().describe('Specific requirements or constraints'),
      }),
      handler: ({ workloadType, dataSize, budget, region, requirements }) => ({
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text:
                `Design an optimal Dataproc cluster configuration for the following requirements:\n\n` +
                `**Workload Requirements:**\n` +
                `- Type: ${workloadType}\n` +
                `- Data Size: ${dataSize}\n` +
                `- Budget: ${budget}\n` +
                `- Region: ${region || 'flexible'}\n` +
                `- Additional Requirements: ${requirements || 'none specified'}\n\n` +
                `**Please provide:**\n` +
                `1. Recommended cluster configuration (machine types, disk sizes, etc.)\n` +
                `2. Estimated costs and performance characteristics\n` +
                `3. Scaling recommendations\n` +
                `4. Security and networking considerations\n` +
                `5. Sample YAML configuration`,
            },
          },
        ],
      }),
    });

    // Troubleshooting Template
    this.registerTemplate({
      name: 'troubleshoot-dataproc-issue',
      title: 'Troubleshoot Dataproc Issue',
      description: 'Get help diagnosing and resolving Dataproc cluster or job issues',
      argsSchema: z.object({
        issueType: z.enum([
          'job-failure',
          'cluster-startup',
          'performance',
          'connectivity',
          'other',
        ]),
        errorMessage: z.string().optional().describe('Error message or symptoms'),
        jobId: z.string().optional().describe('Job ID if applicable'),
        clusterName: z.string().optional(),
        timeline: z.string().optional().describe('When did the issue start?'),
        context: z.string().optional().describe('What were you trying to do?'),
      }),
      handler: ({ issueType, errorMessage, jobId, clusterName, timeline, context }) => ({
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text:
                `Help me troubleshoot this Dataproc issue:\n\n` +
                `**Issue Details:**\n` +
                `- Type: ${issueType}\n` +
                `- Error Message: ${errorMessage || 'not provided'}\n` +
                `- Job ID: ${jobId || 'not applicable'}\n` +
                `- Cluster: ${clusterName || 'not specified'}\n` +
                `- Timeline: ${timeline || 'not specified'}\n` +
                `- Context: ${context || 'not provided'}\n\n` +
                `**Please provide:**\n` +
                `1. Likely root causes\n` +
                `2. Step-by-step troubleshooting guide\n` +
                `3. Diagnostic commands to run\n` +
                `4. Prevention strategies\n` +
                `5. Relevant documentation links`,
            },
          },
        ],
      }),
    });

    // Query Generation Template
    this.registerTemplate({
      name: 'generate-dataproc-query',
      title: 'Generate Dataproc Query',
      description: 'Generate optimized Hive/Spark queries based on requirements',
      argsSchema: z.object({
        queryPurpose: z.string().describe('What you want to accomplish with the query'),
        tableNames: z.string().optional().describe('Comma-separated list of table names'),
        queryType: z.enum(['select', 'insert', 'update', 'create', 'analyze']),
        dialect: z.enum(['hive', 'spark-sql', 'presto']),
        performance: z.enum(['standard', 'optimized', 'high-performance']),
      }),
      handler: ({ queryPurpose, tableNames, queryType, dialect, performance }) => ({
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text:
                `Generate an optimized ${dialect} query for the following requirements:\n\n` +
                `**Requirements:**\n` +
                `- Purpose: ${queryPurpose}\n` +
                `- Tables: ${tableNames || 'to be determined'}\n` +
                `- Query Type: ${queryType}\n` +
                `- Dialect: ${dialect}\n` +
                `- Performance Level: ${performance}\n\n` +
                `**Please provide:**\n` +
                `1. Complete, runnable query\n` +
                `2. Query explanation and logic\n` +
                `3. Performance optimization notes\n` +
                `4. Alternative approaches if applicable\n` +
                `5. Expected execution considerations`,
            },
          },
        ],
      }),
    });

    logger.info(`Initialized ${this.templates.size} prompt templates`);
  }

  /**
   * Register a new prompt template
   */
  registerTemplate(template: PromptTemplateDefinition): void {
    this.templates.set(template.name, template);
    logger.debug(`Registered prompt template: ${template.name}`);
  }

  /**
   * Get all available templates
   */
  getTemplates(): PromptTemplateDefinition[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get template by name
   */
  getTemplate(name: string): PromptTemplateDefinition | undefined {
    return this.templates.get(name);
  }

  /**
   * Get cluster suggestions for completions
   */
  private async getClusterSuggestions(partial: string): Promise<string[]> {
    // In a real implementation, this would query recent clusters or profiles
    const commonClusters = [
      'analytics-cluster',
      'ml-training-cluster',
      'data-processing-cluster',
      'spark-cluster',
      'hive-cluster',
      'streaming-cluster',
    ];

    return commonClusters.filter((cluster) =>
      cluster.toLowerCase().includes(partial.toLowerCase())
    );
  }

  /**
   * Execute a prompt template
   */
  executeTemplate(name: string, args: any): ReturnType<PromptTemplateDefinition['handler']> | null {
    const template = this.templates.get(name);
    if (!template) {
      logger.warn(`Template not found: ${name}`);
      return null;
    }

    try {
      // Validate arguments
      const validatedArgs = template.argsSchema.parse(args);
      return template.handler(validatedArgs);
    } catch (error) {
      logger.error(`Error executing template ${name}:`, error);
      throw error;
    }
  }

  /**
   * Get completion suggestions for a template argument
   */
  async getCompletions(
    templateName: string,
    argumentName: string,
    partialValue: string,
    _context?: { arguments?: Record<string, any> }
  ): Promise<string[]> {
    const template = this.templates.get(templateName);
    if (!template) {
      return [];
    }

    // This would integrate with the completable() system from the schema
    // For now, return basic suggestions
    const suggestions: Record<string, string[]> = {
      queryType: ['hive', 'spark', 'presto', 'auto'],
      workloadType: ['analytics', 'ml', 'streaming', 'batch', 'mixed'],
      dataSize: ['small', 'medium', 'large', 'xlarge'],
      budget: ['low', 'medium', 'high', 'unlimited'],
      issueType: ['job-failure', 'cluster-startup', 'performance', 'connectivity', 'other'],
      dialect: ['hive', 'spark-sql', 'presto'],
      performance: ['standard', 'optimized', 'high-performance'],
    };

    const baseSuggestions = suggestions[argumentName] || [];
    return baseSuggestions.filter((s) => s.toLowerCase().includes(partialValue.toLowerCase()));
  }
}

/**
 * Global prompt templates service instance
 */
let promptTemplatesService: PromptTemplatesService | undefined;

/**
 * Initialize global prompt templates service
 */
export function initializePromptTemplatesService(
  defaultParamManager?: DefaultParameterManager,
  profileManager?: ProfileManager
): PromptTemplatesService {
  if (!promptTemplatesService) {
    promptTemplatesService = new PromptTemplatesService(defaultParamManager, profileManager);
  }
  return promptTemplatesService;
}

/**
 * Get global prompt templates service
 */
export function getPromptTemplatesService(): PromptTemplatesService | undefined {
  return promptTemplatesService;
}
