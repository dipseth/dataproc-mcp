/**
 * Enhanced Prompt handlers for MCP server
 * Handles prompt listing and execution with enhanced prompt system
 */

import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../utils/logger.js';
import SecurityMiddleware from '../security/middleware.js';
import { getPromptTemplatesService } from '../services/prompt-templates.js';
import { DataprocPromptGenerator } from '../prompts/prompt-generator.js';
import {
  ENHANCED_PROMPT_TEMPLATES,
  TEMPLATE_REGISTRY,
} from '../prompts/enhanced-prompt-templates.js';
import { PromptContext } from '../types/enhanced-prompts.js';

// Global enhanced prompt generator instance
let enhancedPromptGenerator: DataprocPromptGenerator | null = null;

/**
 * Initialize the enhanced prompt generator
 */
export function initializeEnhancedPromptGenerator(generator: DataprocPromptGenerator) {
  enhancedPromptGenerator = generator;
}

/**
 * Get the enhanced prompt generator instance
 */
function getEnhancedPromptGenerator(): DataprocPromptGenerator | null {
  return enhancedPromptGenerator;
}

/**
 * Handle list prompts request
 */
export async function handleListPrompts() {
  SecurityMiddleware.checkRateLimit('list_prompts');

  // Try enhanced prompts first, fall back to legacy prompts
  const enhancedGenerator = getEnhancedPromptGenerator();

  if (enhancedGenerator) {
    // Return enhanced prompts
    const enhancedPrompts = ENHANCED_PROMPT_TEMPLATES.map((template) => ({
      name: template.id,
      title: template.id.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
      description: template.description,
      arguments: template.parameters.map((param) => ({
        name: param.name,
        description: param.description,
        required: param.required,
      })),
    }));

    SecurityMiddleware.auditLog('Enhanced prompts listed', {
      tool: 'list_prompts',
      count: enhancedPrompts.length,
      type: 'enhanced',
    });

    return { prompts: enhancedPrompts };
  }

  // Fall back to legacy prompt service
  const promptService = getPromptTemplatesService();
  if (!promptService) {
    throw new McpError(
      ErrorCode.InternalError,
      'Neither enhanced nor legacy prompt service is available'
    );
  }

  const templates = promptService.getTemplates();

  SecurityMiddleware.auditLog('Legacy prompts listed', {
    tool: 'list_prompts',
    count: templates.length,
    type: 'legacy',
  });

  return {
    prompts: templates.map((template) => ({
      name: template.name,
      title: template.title,
      description: template.description,
      arguments: Object.entries(template.argsSchema.shape).map(([name, schema]) => ({
        name,
        description: (schema as any)._def?.description || `${name} parameter`,
        required: !(schema as any).isOptional(),
      })),
    })),
  };
}

/**
 * Handle get prompt request
 */
export async function handleGetPrompt(args: any) {
  SecurityMiddleware.checkRateLimit(`get_prompt:${args.name}`);

  const sanitizedArgs = SecurityMiddleware.sanitizeObject(args) as any;
  const { name, arguments: promptArgs } = sanitizedArgs;

  if (!name || typeof name !== 'string') {
    throw new McpError(ErrorCode.InvalidParams, 'Prompt name is required');
  }

  // Try enhanced prompts first
  const enhancedGenerator = getEnhancedPromptGenerator();
  const enhancedTemplate = TEMPLATE_REGISTRY.get(name);

  if (enhancedGenerator && enhancedTemplate) {
    SecurityMiddleware.auditLog('Enhanced prompt executed', {
      tool: 'get_prompt',
      promptName: name,
      argsProvided: Object.keys(promptArgs || {}).length,
      type: 'enhanced',
      category: enhancedTemplate.category,
    });

    try {
      // Create prompt context from arguments
      const context: PromptContext = {
        promptId: name,
        toolName: 'get_prompt',
        userParameters: promptArgs || {},
        securityContext: {
          userId: 'mcp-user',
          source: 'mcp' as const,
          rateLimiting: {
            requestCount: 1,
            windowStart: new Date(),
          },
        },
        timestamp: new Date(),
        requestId: `prompt-${Date.now()}`,
        metadata: {
          source: 'mcp-prompt-handler',
        },
      };

      const result = await enhancedGenerator.generatePrompt(name, context);

      return {
        description: enhancedTemplate.description,
        messages: result.messages,
      };
    } catch (error) {
      logger.error(`Error executing enhanced prompt ${name}:`, error);
      throw new McpError(
        ErrorCode.InvalidParams,
        `Error executing enhanced prompt: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // Fall back to legacy prompt service
  const promptService = getPromptTemplatesService();
  if (!promptService) {
    throw new McpError(
      ErrorCode.InternalError,
      'Neither enhanced nor legacy prompt service is available'
    );
  }

  const template = promptService.getTemplate(name);
  if (!template) {
    throw new McpError(ErrorCode.InvalidParams, `Prompt not found: ${name}`);
  }

  SecurityMiddleware.auditLog('Legacy prompt executed', {
    tool: 'get_prompt',
    promptName: name,
    argsProvided: Object.keys(promptArgs || {}).length,
    type: 'legacy',
  });

  try {
    const result = promptService.executeTemplate(name, promptArgs || {});
    if (!result) {
      throw new McpError(ErrorCode.InternalError, `Failed to execute prompt: ${name}`);
    }

    return {
      description: template.description,
      messages: result.messages,
    };
  } catch (error) {
    logger.error(`Error executing legacy prompt ${name}:`, error);
    throw new McpError(
      ErrorCode.InvalidParams,
      `Error executing prompt: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Handle completion request for prompt arguments
 */
export async function handleCompletion(args: any) {
  SecurityMiddleware.checkRateLimit(`completion:${args.ref?.name}`);

  const sanitizedArgs = SecurityMiddleware.sanitizeObject(args) as any;
  const { ref, argument, context } = sanitizedArgs;

  if (!ref?.name || !argument?.name) {
    throw new McpError(ErrorCode.InvalidParams, 'Reference name and argument name are required');
  }

  // Check if this is an enhanced prompt
  const enhancedTemplate = TEMPLATE_REGISTRY.get(ref.name);

  if (enhancedTemplate) {
    // Provide completions for enhanced prompts
    const parameter = enhancedTemplate.parameters.find((p) => p.name === argument.name);

    if (parameter?.validation?.enum) {
      const completions = parameter.validation.enum;

      SecurityMiddleware.auditLog('Enhanced completion provided', {
        tool: 'completion',
        promptName: ref.name,
        argumentName: argument.name,
        completionCount: completions.length,
        type: 'enhanced',
      });

      return {
        completion: {
          values: completions.map((value) => ({ value, description: value })),
          total: completions.length,
          hasMore: false,
        },
      };
    }

    // For parameters without enum, provide empty completions
    return {
      completion: {
        values: [],
        total: 0,
        hasMore: false,
      },
    };
  }

  // Fall back to legacy prompt service
  const promptService = getPromptTemplatesService();
  if (!promptService) {
    throw new McpError(
      ErrorCode.InternalError,
      'Neither enhanced nor legacy prompt service is available'
    );
  }

  try {
    const completions = await promptService.getCompletions(
      ref.name,
      argument.name,
      argument.value || '',
      context
    );

    SecurityMiddleware.auditLog('Legacy completion provided', {
      tool: 'completion',
      promptName: ref.name,
      argumentName: argument.name,
      completionCount: completions.length,
      type: 'legacy',
    });

    return {
      completion: {
        values: completions.map((value) => ({ value, description: value })),
        total: completions.length,
        hasMore: false,
      },
    };
  } catch (error) {
    logger.error(`Error providing completions for ${ref.name}.${argument.name}:`, error);
    throw new McpError(
      ErrorCode.InternalError,
      `Error providing completions: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
