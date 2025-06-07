/**
 * Knowledge base and analytics handlers
 * Extracted from main server file for better organization
 */

import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../utils/logger.js';
import SecurityMiddleware from '../security/middleware.js';
import {
  QueryClusterDataSchema,
  GetClusterInsightsSchema,
  GetJobAnalyticsSchema,
  QueryKnowledgeSchema,
} from '../validation/schemas.js';
import { KnowledgeIndexer } from '../services/knowledge-indexer.js';
import { SemanticQueryService } from '../services/semantic-query.js';
import { TemplatingIntegration } from '../services/templating-integration.js';
import { DefaultParameterManager } from '../services/default-params.js';

export interface KnowledgeHandlerDependencies {
  knowledgeIndexer?: KnowledgeIndexer;
  semanticQueryService?: SemanticQueryService;
  templatingIntegration?: TemplatingIntegration;
  defaultParamManager?: DefaultParameterManager;
}

export async function handleQueryClusterData(args: any, deps: KnowledgeHandlerDependencies) {
  // Apply security middleware
  SecurityMiddleware.checkRateLimit(`query_cluster_data:${JSON.stringify(args)}`);

  // Sanitize input
  const sanitizedArgs = SecurityMiddleware.sanitizeObject(args);

  // Validate input with Zod schema
  let validatedArgs;
  try {
    validatedArgs = SecurityMiddleware.validateInput(QueryClusterDataSchema, sanitizedArgs);
  } catch (error) {
    SecurityMiddleware.auditLog(
      'Input validation failed',
      {
        tool: 'query_cluster_data',
        error: error instanceof Error ? error.message : 'Unknown error',
        args: SecurityMiddleware.sanitizeForLogging(args),
      },
      'warn'
    );
    throw new McpError(
      ErrorCode.InvalidParams,
      error instanceof Error ? error.message : 'Invalid input'
    );
  }

  // Get default parameters if not provided
  let { projectId, region } = validatedArgs;
  const { query, clusterName, limit } = validatedArgs;

  if (!projectId && deps.defaultParamManager) {
    try {
      projectId = deps.defaultParamManager.getParameterValue('projectId');
    } catch (error) {
      // Ignore error, parameter is optional
    }
  }

  if (!region && deps.defaultParamManager) {
    try {
      region = deps.defaultParamManager.getParameterValue('region');
    } catch (error) {
      // Ignore error, parameter is optional
    }
  }

  // Audit log the operation
  SecurityMiddleware.auditLog('Cluster data query initiated', {
    tool: 'query_cluster_data',
    queryLength: query.length,
    projectId,
    region,
    clusterName,
    limit,
  });

  if (!deps.knowledgeIndexer) {
    return {
      content: [
        {
          type: 'text',
          text: '🔍 **Cluster Data Query**\n\n⚠️ Knowledge indexer not available. Semantic search requires Qdrant vector database.\n\n💡 **To enable semantic search:**\n- Start Qdrant: `docker run -p 6334:6333 qdrant/qdrant`\n- Restart the MCP server',
        },
      ],
    };
  }

  try {
    const results = await deps.knowledgeIndexer.queryKnowledge(query, {
      type: 'cluster',
      projectId,
      region,
      limit,
    });

    SecurityMiddleware.auditLog('Cluster data query completed', {
      tool: 'query_cluster_data',
      queryLength: query.length,
      resultCount: results.length,
    });

    if (results.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `🔍 **Cluster Data Query**: "${query}"\n\n❌ **No results found**\n\nTry:\n- Different keywords\n- Broader search terms\n- Check if clusters have been indexed`,
          },
        ],
      };
    }

    let response = `🔍 **Cluster Data Query**: "${query}"\n`;
    response += `📊 **Found**: ${results.length} matching results\n\n`;

    results.forEach((result, index) => {
      const data = result.data as any;
      response += `**${index + 1}. ${data.clusterName || 'Unknown'}** (${data.projectId || 'Unknown'}/${data.region || 'Unknown'})\n`;
      response += `   🎯 Confidence: ${(result.confidence * 100).toFixed(1)}%\n`;

      if (data.configurations?.machineTypes?.length > 0) {
        response += `   🖥️  Machine types: ${data.configurations.machineTypes.join(', ')}\n`;
      }

      if (data.configurations?.components?.length > 0) {
        response += `   🔧 Components: ${data.configurations.components.join(', ')}\n`;
      }

      response += '\n';
    });

    return {
      content: [
        {
          type: 'text',
          text: response,
        },
      ],
    };
  } catch (error) {
    SecurityMiddleware.auditLog(
      'Cluster data query failed',
      {
        tool: 'query_cluster_data',
        query,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      'error'
    );

    logger.error('MCP query_cluster_data: Error:', error);
    throw error;
  }
}

export async function handleGetClusterInsights(args: any, deps: KnowledgeHandlerDependencies) {
  // Apply security middleware
  SecurityMiddleware.checkRateLimit(`get_cluster_insights:${JSON.stringify(args)}`);

  // Sanitize input
  const sanitizedArgs = SecurityMiddleware.sanitizeObject(args);

  // Validate input with Zod schema
  let validatedArgs;
  try {
    validatedArgs = SecurityMiddleware.validateInput(GetClusterInsightsSchema, sanitizedArgs);
  } catch (error) {
    SecurityMiddleware.auditLog(
      'Input validation failed',
      {
        tool: 'get_cluster_insights',
        error: error instanceof Error ? error.message : 'Unknown error',
        args: SecurityMiddleware.sanitizeForLogging(args),
      },
      'warn'
    );
    throw new McpError(
      ErrorCode.InvalidParams,
      error instanceof Error ? error.message : 'Invalid input'
    );
  }

  // Get default parameters if not provided
  let { projectId, region } = validatedArgs;

  if (!projectId && deps.defaultParamManager) {
    try {
      projectId = deps.defaultParamManager.getParameterValue('projectId');
    } catch (error) {
      // Ignore error, parameter is optional
    }
  }

  if (!region && deps.defaultParamManager) {
    try {
      region = deps.defaultParamManager.getParameterValue('region');
    } catch (error) {
      // Ignore error, parameter is optional
    }
  }

  // Audit log the operation
  SecurityMiddleware.auditLog('Cluster insights requested', {
    tool: 'get_cluster_insights',
    projectId,
    region,
  });

  if (!deps.knowledgeIndexer) {
    return {
      content: [
        {
          type: 'text',
          text: '📊 **Cluster Insights**\n\n⚠️ Knowledge indexer not available. Insights require Qdrant vector database.\n\n💡 **To enable insights:**\n- Start Qdrant: `docker run -p 6334:6333 qdrant/qdrant`\n- Restart the MCP server',
        },
      ],
    };
  }

  try {
    // Get cluster insights from knowledge indexer
    const insights = await deps.knowledgeIndexer.getClusterInsights();

    SecurityMiddleware.auditLog('Cluster insights completed', {
      tool: 'get_cluster_insights',
      clusterCount: insights.totalClusters,
    });

    let response = '📊 **Cluster Discovery Insights**\n\n';
    response += `🏗️  **Total Clusters**: ${insights.totalClusters}\n`;
    response += `🏢 **Projects**: ${insights.uniqueProjects}\n`;
    response += `🌍 **Regions**: ${insights.uniqueRegions}\n\n`;

    if (insights.commonMachineTypes.length > 0) {
      response += `🖥️  **Machine Types**:\n`;
      insights.commonMachineTypes.slice(0, 10).forEach((mt) => {
        response += `   • ${mt}\n`;
      });
      if (insights.commonMachineTypes.length > 10) {
        response += `   ... and ${insights.commonMachineTypes.length - 10} more\n`;
      }
      response += '\n';
    }

    if (insights.commonComponents.length > 0) {
      response += `🔧 **Components**:\n`;
      insights.commonComponents.slice(0, 10).forEach((comp) => {
        response += `   • ${comp}\n`;
      });
      if (insights.commonComponents.length > 10) {
        response += `   ... and ${insights.commonComponents.length - 10} more\n`;
      }
      response += '\n';
    }

    response += `📅 **Last Updated**: ${new Date().toISOString()}`;

    return {
      content: [
        {
          type: 'text',
          text: response,
        },
      ],
    };
  } catch (error) {
    SecurityMiddleware.auditLog(
      'Cluster insights failed',
      {
        tool: 'get_cluster_insights',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      'error'
    );

    logger.error('MCP get_cluster_insights: Error:', error);

    // Fallback response
    return {
      content: [
        {
          type: 'text',
          text: '📊 **Cluster Insights**\n\n⚠️ Unable to retrieve insights at this time. This may be due to:\n- Qdrant not running\n- No clusters indexed yet\n- Service initialization in progress',
        },
      ],
    };
  }
}

export async function handleGetJobAnalytics(args: any, deps: KnowledgeHandlerDependencies) {
  // Apply security middleware
  SecurityMiddleware.checkRateLimit(`get_job_analytics:${JSON.stringify(args)}`);

  // Sanitize input
  const sanitizedArgs = SecurityMiddleware.sanitizeObject(args);

  // Validate input with Zod schema
  let validatedArgs;
  try {
    validatedArgs = SecurityMiddleware.validateInput(GetJobAnalyticsSchema, sanitizedArgs);
  } catch (error) {
    SecurityMiddleware.auditLog(
      'Input validation failed',
      {
        tool: 'get_job_analytics',
        error: error instanceof Error ? error.message : 'Unknown error',
        args: SecurityMiddleware.sanitizeForLogging(args),
      },
      'warn'
    );
    throw new McpError(
      ErrorCode.InvalidParams,
      error instanceof Error ? error.message : 'Invalid input'
    );
  }

  // Get default parameters if not provided
  let { projectId, region } = validatedArgs;

  if (!projectId && deps.defaultParamManager) {
    try {
      projectId = deps.defaultParamManager.getParameterValue('projectId');
    } catch (error) {
      // Ignore error, parameter is optional
    }
  }

  if (!region && deps.defaultParamManager) {
    try {
      region = deps.defaultParamManager.getParameterValue('region');
    } catch (error) {
      // Ignore error, parameter is optional
    }
  }

  // Audit log the operation
  SecurityMiddleware.auditLog('Job analytics requested', {
    tool: 'get_job_analytics',
    projectId,
    region,
  });

  if (!deps.knowledgeIndexer) {
    return {
      content: [
        {
          type: 'text',
          text: '📈 **Job Analytics**\n\n⚠️ Knowledge indexer not available. Analytics require Qdrant vector database.\n\n💡 **To enable analytics:**\n- Start Qdrant: `docker run -p 6334:6333 qdrant/qdrant`\n- Restart the MCP server',
        },
      ],
    };
  }

  try {
    // Get job analytics from knowledge indexer
    const analytics = await deps.knowledgeIndexer.getJobTypeAnalytics();

    SecurityMiddleware.auditLog('Job analytics completed', {
      tool: 'get_job_analytics',
      analyticsAvailable: !!analytics,
    });

    let response = '📈 **Job Submission Analytics**\n\n';

    if (analytics && typeof analytics === 'object') {
      const jobTypeDistribution = analytics.jobTypeDistribution || {};
      const totalJobs =
        analytics.totalJobs ||
        Object.values(jobTypeDistribution).reduce(
          (sum: number, count: any) => sum + (typeof count === 'number' ? count : 0),
          0
        );

      response += `🚀 **Total Jobs**: ${totalJobs}\n`;
      response += `📊 **Success Rate**: ${(analytics.successRate * 100).toFixed(1)}%\n\n`;

      if (Object.keys(jobTypeDistribution).length > 0) {
        response += `🔧 **Job Types**:\n`;
        Object.entries(jobTypeDistribution).forEach(([type, count]) => {
          response += `   • ${type}: ${count} jobs\n`;
        });
        response += '\n';
      }

      if (analytics.commonErrors && analytics.commonErrors.length > 0) {
        response += `⚠️  **Common Errors**:\n`;
        analytics.commonErrors.slice(0, 5).forEach((error: any) => {
          response += `   • ${error.pattern} (${error.frequency || 'unknown'} occurrences)\n`;
        });
        response += '\n';
      }
    } else {
      response += `⚠️ **Analytics data not available**\n\n`;
    }

    response += `📅 **Last Updated**: ${new Date().toISOString()}`;

    return {
      content: [
        {
          type: 'text',
          text: response,
        },
      ],
    };
  } catch (error) {
    SecurityMiddleware.auditLog(
      'Job analytics failed',
      {
        tool: 'get_job_analytics',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      'error'
    );

    logger.error('MCP get_job_analytics: Error:', error);

    // Fallback response
    return {
      content: [
        {
          type: 'text',
          text: '📈 **Job Analytics**\n\n⚠️ Unable to retrieve analytics at this time. This may be due to:\n- Qdrant not running\n- No jobs indexed yet\n- Service initialization in progress',
        },
      ],
    };
  }
}

export async function handleQueryKnowledge(args: any, deps: KnowledgeHandlerDependencies) {
  // Apply security middleware
  SecurityMiddleware.checkRateLimit(`query_knowledge:${JSON.stringify(args)}`);

  // Sanitize input
  const sanitizedArgs = SecurityMiddleware.sanitizeObject(args);

  // Validate input with Zod schema
  let validatedArgs;
  try {
    validatedArgs = SecurityMiddleware.validateInput(QueryKnowledgeSchema, sanitizedArgs);
  } catch (error) {
    SecurityMiddleware.auditLog(
      'Input validation failed',
      {
        tool: 'query_knowledge',
        error: error instanceof Error ? error.message : 'Unknown error',
        args: SecurityMiddleware.sanitizeForLogging(args),
      },
      'warn'
    );
    throw new McpError(
      ErrorCode.InvalidParams,
      error instanceof Error ? error.message : 'Invalid input'
    );
  }

  // Get default parameters if not provided
  let { projectId, region } = validatedArgs;
  const { query, type, limit, includeRawDocument } = validatedArgs;

  if (!projectId && deps.defaultParamManager) {
    try {
      projectId = deps.defaultParamManager.getParameterValue('projectId');
    } catch (error) {
      // Ignore error, parameter is optional
    }
  }

  if (!region && deps.defaultParamManager) {
    try {
      region = deps.defaultParamManager.getParameterValue('region');
    } catch (error) {
      // Ignore error, parameter is optional
    }
  }

  // Audit log the operation
  SecurityMiddleware.auditLog('Knowledge query initiated', {
    tool: 'query_knowledge',
    queryLength: query.length,
    type,
    projectId,
    region,
    limit,
    includeRawDocument,
  });

  if (!deps.knowledgeIndexer) {
    return {
      content: [
        {
          type: 'text',
          text: '🧠 **Knowledge Base Query**\n\n⚠️ Knowledge indexer not available. Semantic search requires Qdrant vector database.\n\n💡 **To enable knowledge search:**\n- Start Qdrant: `docker run -p 6334:6333 qdrant/qdrant`\n- Restart the MCP server',
        },
      ],
    };
  }

  try {
    const results = await deps.knowledgeIndexer.queryKnowledge(query, {
      type: type as any,
      projectId,
      region,
      limit,
    });

    SecurityMiddleware.auditLog('Knowledge query completed', {
      tool: 'query_knowledge',
      queryLength: query.length,
      type,
      resultCount: results.length,
    });

    if (results.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `🧠 **Knowledge Query**: "${query}"\n🔍 **Type**: ${type}\n\n❌ **No results found**\n\nTry:\n- Different keywords\n- Broader search terms\n- Different type filter\n- Check if data has been indexed`,
          },
        ],
      };
    }

    let response = `🧠 **Knowledge Query**: "${query}"\n`;
    response += `🔍 **Type**: ${type}\n`;
    response += `📊 **Found**: ${results.length} matching results\n\n`;

    results.forEach((result, index) => {
      const data = result.data as any;
      if (!data) {
        response += `**${index + 1}. [No Data]**\n`;
        response += `   🎯 Confidence: ${(result.confidence * 100).toFixed(1)}%\n`;
        response += `   ⚠️ Warning: Result has null data\n`;
        return;
      }

      response += `**${index + 1}. ${data.clusterName || data.jobId || 'Unknown'}**\n`;
      response += `   🎯 Confidence: ${(result.confidence * 100).toFixed(1)}%\n`;

      if (data.projectId) response += `   🏢 Project: ${data.projectId}\n`;
      if (data.region) response += `   🌍 Region: ${data.region}\n`;
      if (data.jobType) response += `   🔧 Job Type: ${data.jobType}\n`;
      if (data.status) response += `   📊 Status: ${data.status}\n`;

      response += '\n';
    });

    if (includeRawDocument && results.length > 0) {
      response += `\n📄 **Raw Document Sample** (first result):\n`;
      response += `\`\`\`json\n${JSON.stringify(results[0], null, 2)}\n\`\`\``;
    }

    return {
      content: [
        {
          type: 'text',
          text: response,
        },
      ],
    };
  } catch (error) {
    SecurityMiddleware.auditLog(
      'Knowledge query failed',
      {
        tool: 'query_knowledge',
        query,
        type,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      'error'
    );

    logger.error('MCP query_knowledge: Error:', error);
    throw error;
  }
}
