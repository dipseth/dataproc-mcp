/**
 * Cluster operation handlers
 * Extracted from main server file for better organization
 */

import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../utils/logger.js';
import SecurityMiddleware from '../security/middleware.js';
import {
  StartDataprocClusterSchema,
  ListClustersSchema,
  GetClusterSchema,
  DeleteClusterSchema,
} from '../validation/schemas.js';
import { createCluster, deleteCluster, listClusters, getCluster } from '../services/cluster.js';
import { DefaultParameterManager } from '../services/default-params.js';
import { ResponseFilter } from '../services/response-filter.js';
import { KnowledgeIndexer } from '../services/knowledge-indexer.js';
import { ProfileManager } from '../services/profile.js';
import { ClusterTracker } from '../services/tracker.js';
import { TemplatingIntegration } from '../services/templating-integration.js';

export interface HandlerDependencies {
  defaultParamManager?: DefaultParameterManager;
  responseFilter?: ResponseFilter;
  knowledgeIndexer?: KnowledgeIndexer;
  profileManager?: ProfileManager;
  clusterTracker?: ClusterTracker;
  templatingIntegration?: TemplatingIntegration;
}

export async function handleStartDataprocCluster(args: any, deps: HandlerDependencies) {
  // Apply security middleware
  SecurityMiddleware.checkRateLimit(`start_dataproc_cluster:${JSON.stringify(args)}`);

  // Sanitize input
  const sanitizedArgs = SecurityMiddleware.sanitizeObject(args);

  // Validate input with Zod schema
  let validatedArgs;
  try {
    validatedArgs = SecurityMiddleware.validateInput(StartDataprocClusterSchema, sanitizedArgs);
  } catch (error) {
    SecurityMiddleware.auditLog(
      'Input validation failed',
      {
        tool: 'start_dataproc_cluster',
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
  const { clusterName, clusterConfig } = validatedArgs;
  let { projectId, region } = validatedArgs;

  if (!projectId && deps.defaultParamManager) {
    try {
      projectId = deps.defaultParamManager.getParameterValue('projectId');
    } catch (error) {
      // Ignore error, will be caught by validation below
    }
  }

  if (!region && deps.defaultParamManager) {
    try {
      region = deps.defaultParamManager.getParameterValue('region');
    } catch (error) {
      // Ignore error, will be caught by validation below
    }
  }

  // Validate required parameters after defaults
  if (!projectId || !region) {
    throw new McpError(ErrorCode.InvalidParams, 'Missing required parameters: projectId, region');
  }

  // Additional GCP constraint validation
  SecurityMiddleware.validateGCPConstraints({ projectId, region, clusterName });

  // Audit log the operation
  SecurityMiddleware.auditLog('Cluster creation initiated', {
    tool: 'start_dataproc_cluster',
    projectId,
    region,
    clusterName,
    hasConfig: !!clusterConfig,
  });

  logger.debug(
    'MCP start_dataproc_cluster: Called with validated params:',
    SecurityMiddleware.sanitizeForLogging({ projectId, region, clusterName, clusterConfig })
  );

  let response;
  try {
    response = await createCluster(projectId, region, clusterName, clusterConfig);

    // Track the cluster if clusterTracker is available
    // The clusterUuid is in response.metadata.clusterUuid for operation responses
    const clusterUuid = response?.metadata?.clusterUuid || response?.clusterUuid;
    if (response && clusterUuid && deps.clusterTracker) {
      logger.debug('MCP start_dataproc_cluster: Tracking cluster:', {
        clusterUuid,
        clusterName,
        projectId,
        region,
        responseType: response.metadata ? 'operation' : 'cluster',
      });

      deps.clusterTracker.trackCluster(
        clusterUuid,
        clusterName,
        undefined, // No profile ID for direct cluster creation
        undefined, // No profile path
        {
          projectId,
          region,
          createdAt: new Date().toISOString(),
          tool: 'start_dataproc_cluster',
        }
      );

      logger.debug('MCP start_dataproc_cluster: Cluster tracked successfully');
    } else {
      logger.debug('MCP start_dataproc_cluster: Cluster tracking skipped:', {
        hasResponse: !!response,
        hasClusterUuid: !!(response && clusterUuid),
        hasClusterTracker: !!deps.clusterTracker,
        responseStructure: response ? Object.keys(response) : 'no response',
      });
    }

    SecurityMiddleware.auditLog('Cluster creation completed', {
      tool: 'start_dataproc_cluster',
      projectId,
      region,
      clusterName,
      success: true,
    });

    logger.debug(
      'MCP start_dataproc_cluster: createCluster response:',
      SecurityMiddleware.sanitizeForLogging(response)
    );
  } catch (error) {
    SecurityMiddleware.auditLog(
      'Cluster creation failed',
      {
        tool: 'start_dataproc_cluster',
        projectId,
        region,
        clusterName,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      'error'
    );

    logger.error('MCP start_dataproc_cluster: Error from createCluster:', error);
    throw error;
  }

  return {
    content: [
      {
        type: 'text',
        text: `Cluster ${clusterName} started successfully in region ${region}.\nCluster details:\n${JSON.stringify(SecurityMiddleware.sanitizeForLogging(response), null, 2)}`,
      },
    ],
  };
}

export async function handleListClusters(args: any, deps: HandlerDependencies) {
  // Apply security middleware
  SecurityMiddleware.checkRateLimit(`list_clusters:${JSON.stringify(args)}`);

  // Sanitize input
  const sanitizedArgs = SecurityMiddleware.sanitizeObject(args);

  // Validate input with Zod schema
  let validatedArgs;
  try {
    validatedArgs = SecurityMiddleware.validateInput(ListClustersSchema, sanitizedArgs);
  } catch (error) {
    SecurityMiddleware.auditLog(
      'Input validation failed',
      {
        tool: 'list_clusters',
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
  const { filter, pageSize, pageToken } = validatedArgs;
  let { projectId, region } = validatedArgs;

  if (!projectId && deps.defaultParamManager) {
    try {
      projectId = deps.defaultParamManager.getParameterValue('projectId');
    } catch (error) {
      // Ignore error, will be caught by validation below
    }
  }

  if (!region && deps.defaultParamManager) {
    try {
      region = deps.defaultParamManager.getParameterValue('region');
    } catch (error) {
      // Ignore error, will be caught by validation below
    }
  }

  // Validate required parameters after defaults
  if (!projectId || !region) {
    throw new McpError(ErrorCode.InvalidParams, 'Missing required parameters: projectId, region');
  }

  // Additional GCP constraint validation
  SecurityMiddleware.validateGCPConstraints({ projectId, region });

  // Audit log the operation
  SecurityMiddleware.auditLog('Cluster list requested', {
    tool: 'list_clusters',
    projectId,
    region,
    hasFilter: !!filter,
    pageSize,
  });

  const response = await listClusters(projectId, region, filter, pageSize, pageToken);

  SecurityMiddleware.auditLog('Cluster list completed', {
    tool: 'list_clusters',
    projectId,
    region,
    clusterCount: Array.isArray(response?.clusters) ? response.clusters.length : 0,
  });

  // Index cluster knowledge if available
  if (deps.knowledgeIndexer && response?.clusters) {
    try {
      for (const cluster of response.clusters) {
        await deps.knowledgeIndexer.indexClusterConfiguration(cluster as any);
      }
      logger.info(`Indexed ${response.clusters.length} clusters for knowledge base`);
    } catch (indexError) {
      logger.warn('Failed to index cluster knowledge:', indexError);
    }
  }

  // Handle semantic query using KnowledgeIndexer if available
  if (args.semanticQuery && deps.knowledgeIndexer) {
    try {
      const queryResults = await deps.knowledgeIndexer.queryKnowledge(String(args.semanticQuery), {
        type: 'cluster',
        projectId: projectId ? String(projectId) : undefined,
        region: region ? String(region) : undefined,
        limit: 5,
      });

      if (queryResults.length === 0) {
        // Fall back to regular formatted response with semantic query note
        let fallbackText = `🔍 **Semantic Query**: "${args.semanticQuery}"\n❌ **No semantic results found**\n\n`;

        // Use the same response filtering logic as regular queries
        if (deps.responseFilter && !args.verbose) {
          try {
            const filteredResponse = await deps.responseFilter.filterResponse(
              'list_clusters',
              response,
              {
                toolName: 'list_clusters',
                timestamp: new Date().toISOString(),
                projectId,
                region,
                responseType: 'cluster_list',
                originalTokenCount: JSON.stringify(response).length,
                filteredTokenCount: 0,
                compressionRatio: 1.0,
              }
            );

            const formattedContent =
              filteredResponse.type === 'summary'
                ? filteredResponse.summary || filteredResponse.content
                : filteredResponse.content;

            fallbackText += formattedContent;
            fallbackText += `\n\n💡 **Note**: Semantic search requires Qdrant vector database. To enable:\n`;
            fallbackText += `- Start Qdrant: \`docker run -p 6334:6333 qdrant/qdrant\`\n`;
            fallbackText += `- Or use regular cluster operations without semantic queries`;
          } catch (filterError) {
            logger.warn('Response filtering failed in semantic fallback:', filterError);
            fallbackText += `📋 **Regular cluster list**:\n${JSON.stringify(SecurityMiddleware.sanitizeForLogging(response), null, 2)}`;
          }
        } else {
          fallbackText += `📋 **Regular cluster list**:\n${JSON.stringify(SecurityMiddleware.sanitizeForLogging(response), null, 2)}`;
        }

        return {
          content: [
            {
              type: 'text',
              text: fallbackText,
            },
          ],
        };
      }

      // Format semantic results
      let semanticResponse = `🔍 **Semantic Query**: "${args.semanticQuery}"\n`;
      semanticResponse += `📊 **Found**: ${queryResults.length} matching clusters\n\n`;

      queryResults.forEach((result, index) => {
        const data = result.data as any;
        semanticResponse += `**${index + 1}. ${data.clusterName}** (${data.projectId}/${data.region})\n`;
        semanticResponse += `   🎯 Confidence: ${(result.confidence * 100).toFixed(1)}%\n`;
        semanticResponse += `   📅 Last seen: ${data.lastSeen}\n`;

        // Show machine types if available
        if (data.configurations?.machineTypes?.length > 0) {
          semanticResponse += `   🖥️  Machine types: ${data.configurations.machineTypes.join(', ')}\n`;
        }

        // Show components if available
        if (data.configurations?.components?.length > 0) {
          semanticResponse += `   🔧 Components: ${data.configurations.components.join(', ')}\n`;
        }

        // Show pip packages if available
        if (data.configurations?.pipPackages?.length > 0) {
          const packages = data.configurations.pipPackages.slice(0, 5);
          semanticResponse += `   📦 Pip packages: ${packages.join(', ')}${data.configurations.pipPackages.length > 5 ? '...' : ''}\n`;
        }

        semanticResponse += '\n';
      });

      return {
        content: [
          {
            type: 'text',
            text: semanticResponse,
          },
        ],
      };
    } catch (semanticError) {
      logger.warn('Semantic query failed, falling back to regular response:', semanticError);
      // Continue with regular response below
    }
  }

  // Regular response handling
  if (deps.responseFilter && !args.verbose) {
    try {
      logger.debug('🔍 [DEBUG] Starting response filtering for list_clusters', {
        verbose: args.verbose,
        responseSize: JSON.stringify(response).length,
        hasResponseFilter: !!deps.responseFilter,
      });

      const filteredResponse = await deps.responseFilter.filterResponse('list_clusters', response, {
        toolName: 'list_clusters',
        timestamp: new Date().toISOString(),
        projectId,
        region,
        responseType: 'cluster_list',
        originalTokenCount: JSON.stringify(response).length,
        filteredTokenCount: 0,
        compressionRatio: 1.0,
      });

      logger.debug('🔍 [DEBUG] Response filtering completed', {
        filterType: filteredResponse.type,
        tokensSaved: filteredResponse.tokensSaved,
        contentLength: filteredResponse.content.length,
        hasContent: !!filteredResponse.content,
        hasSummary: !!filteredResponse.summary,
      });

      const formattedContent =
        filteredResponse.type === 'summary'
          ? filteredResponse.summary || filteredResponse.content
          : filteredResponse.content;

      logger.debug('🔍 [DEBUG] Using formatted content', {
        contentType: filteredResponse.type === 'summary' ? 'summary' : 'content',
        finalContentLength: formattedContent.length,
        contentPreview: formattedContent.substring(0, 200),
      });

      return {
        content: [
          {
            type: 'text',
            text: formattedContent,
          },
        ],
      };
    } catch (filterError) {
      logger.warn('Response filtering failed, returning raw response:', filterError);
      logger.debug('🔍 [DEBUG] Filter error details', {
        errorMessage: filterError instanceof Error ? filterError.message : String(filterError),
        errorStack: filterError instanceof Error ? filterError.stack : undefined,
      });
    }
  }

  return {
    content: [
      {
        type: 'text',
        text: `Clusters in project ${projectId}, region ${region}:\n${JSON.stringify(SecurityMiddleware.sanitizeForLogging(response), null, 2)}`,
      },
    ],
  };
}

export async function handleGetCluster(args: any, deps: HandlerDependencies) {
  // Apply security middleware
  SecurityMiddleware.checkRateLimit(`get_cluster:${JSON.stringify(args)}`);

  // Sanitize input
  const sanitizedArgs = SecurityMiddleware.sanitizeObject(args);

  // Validate input with Zod schema
  let validatedArgs;
  try {
    validatedArgs = SecurityMiddleware.validateInput(GetClusterSchema, sanitizedArgs);
  } catch (error) {
    SecurityMiddleware.auditLog(
      'Input validation failed',
      {
        tool: 'get_cluster',
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
  const { clusterName } = validatedArgs;
  let { projectId, region } = validatedArgs;

  if (!projectId && deps.defaultParamManager) {
    try {
      projectId = deps.defaultParamManager.getParameterValue('projectId');
    } catch (error) {
      // Ignore error, will be caught by validation below
    }
  }

  if (!region && deps.defaultParamManager) {
    try {
      region = deps.defaultParamManager.getParameterValue('region');
    } catch (error) {
      // Ignore error, will be caught by validation below
    }
  }

  // Validate required parameters after defaults
  if (!projectId || !region || !clusterName) {
    throw new McpError(
      ErrorCode.InvalidParams,
      'Missing required parameters: projectId, region, clusterName'
    );
  }

  // Additional GCP constraint validation
  SecurityMiddleware.validateGCPConstraints({ projectId, region, clusterName });

  // Audit log the operation
  SecurityMiddleware.auditLog('Cluster details requested', {
    tool: 'get_cluster',
    projectId,
    region,
    clusterName,
  });

  const response = await getCluster(String(projectId), String(region), String(clusterName));

  // Index cluster configuration for knowledge base
  if (deps.knowledgeIndexer && response) {
    try {
      await deps.knowledgeIndexer.indexClusterConfiguration(response as any);
    } catch (indexError) {
      logger.warn('Failed to index cluster configuration:', indexError);
    }
  }

  // Handle semantic query using KnowledgeIndexer if available
  if (args.semanticQuery && deps.knowledgeIndexer) {
    try {
      const queryResults = await deps.knowledgeIndexer.queryKnowledge(String(args.semanticQuery), {
        type: 'cluster',
        projectId: String(projectId),
        region: String(region),
        limit: 5,
      });

      if (queryResults.length === 0) {
        // Fall back to regular formatted response with semantic query note
        let fallbackText = `🔍 **Semantic Query**: "${args.semanticQuery}"\n❌ **No semantic results found for cluster ${clusterName}**\n\n`;

        // Use the same response filtering logic as regular queries
        if (deps.responseFilter && !args.verbose) {
          try {
            const filteredResponse = await deps.responseFilter.filterResponse(
              'get_cluster',
              response,
              {
                toolName: 'get_cluster',
                timestamp: new Date().toISOString(),
                projectId: String(projectId),
                region: String(region),
                clusterName: String(clusterName),
                responseType: 'cluster_details',
                originalTokenCount: JSON.stringify(response).length,
                filteredTokenCount: 0,
                compressionRatio: 1.0,
              }
            );

            const formattedContent =
              filteredResponse.type === 'summary'
                ? filteredResponse.summary || filteredResponse.content
                : filteredResponse.content;

            fallbackText += `📋 **Regular cluster details**:\n${formattedContent}`;
            fallbackText += `\n\n💡 **Note**: Semantic search requires Qdrant vector database. To enable:\n`;
            fallbackText += `- Start Qdrant: \`docker run -p 6334:6333 qdrant/qdrant\`\n`;
            fallbackText += `- Or use regular cluster operations without semantic queries`;
          } catch (filterError) {
            logger.warn('Response filtering failed in semantic fallback:', filterError);
            fallbackText += `📋 **Regular cluster details**:\n${JSON.stringify(response, null, 2)}`;
          }
        } else {
          fallbackText += `📋 **Regular cluster details**:\n${JSON.stringify(response, null, 2)}`;
        }

        return {
          content: [
            {
              type: 'text',
              text: fallbackText,
            },
          ],
        };
      }

      // Format semantic results
      let semanticResponse = `🔍 **Semantic Query**: "${args.semanticQuery}"\n`;
      semanticResponse += `🎯 **Target Cluster**: ${clusterName} (${projectId}/${region})\n`;
      semanticResponse += `📊 **Found**: ${queryResults.length} matching results\n\n`;

      queryResults.forEach((result, index) => {
        const data = result.data as any;
        semanticResponse += `**${index + 1}. ${data.clusterName}** (${data.projectId}/${data.region})\n`;
        semanticResponse += `   🎯 Confidence: ${(result.confidence * 100).toFixed(1)}%\n`;
        semanticResponse += `   📅 Last seen: ${data.lastSeen}\n`;

        // Show machine types if available
        if (data.configurations?.machineTypes?.length > 0) {
          semanticResponse += `   🖥️  Machine types: ${data.configurations.machineTypes.join(', ')}\n`;
        }

        // Show components if available
        if (data.configurations?.components?.length > 0) {
          semanticResponse += `   🔧 Components: ${data.configurations.components.join(', ')}\n`;
        }

        // Show pip packages if available
        if (data.configurations?.pipPackages?.length > 0) {
          const packages = data.configurations.pipPackages.slice(0, 5);
          semanticResponse += `   📦 Pip packages: ${packages.join(', ')}${data.configurations.pipPackages.length > 5 ? '...' : ''}\n`;
        }

        semanticResponse += '\n';
      });

      return {
        content: [
          {
            type: 'text',
            text: semanticResponse,
          },
        ],
      };
    } catch (semanticError) {
      logger.warn('Semantic query failed, falling back to regular response:', semanticError);
      // Continue with regular response below
    }
  }

  // Regular response handling
  if (deps.responseFilter && !args.verbose) {
    try {
      const filteredResponse = await deps.responseFilter.filterResponse('get_cluster', response, {
        toolName: 'get_cluster',
        timestamp: new Date().toISOString(),
        projectId: String(projectId),
        region: String(region),
        clusterName: String(clusterName),
        responseType: 'cluster_details',
        originalTokenCount: JSON.stringify(response).length,
        filteredTokenCount: 0,
        compressionRatio: 1.0,
      });

      const formattedContent =
        filteredResponse.type === 'summary'
          ? filteredResponse.summary || filteredResponse.content
          : filteredResponse.content;

      return {
        content: [
          {
            type: 'text',
            text: formattedContent,
          },
        ],
      };
    } catch (filterError) {
      logger.warn('Response filtering failed, returning raw response:', filterError);
    }
  }

  return {
    content: [
      {
        type: 'text',
        text: `Cluster ${clusterName} details:\n${JSON.stringify(response, null, 2)}`,
      },
    ],
  };
}

export async function handleDeleteCluster(args: any, deps: HandlerDependencies) {
  // Apply security middleware
  SecurityMiddleware.checkRateLimit(`delete_cluster:${JSON.stringify(args)}`);

  // Sanitize input
  const sanitizedArgs = SecurityMiddleware.sanitizeObject(args);

  // Validate input with Zod schema
  let validatedArgs;
  try {
    validatedArgs = SecurityMiddleware.validateInput(DeleteClusterSchema, sanitizedArgs);
  } catch (error) {
    SecurityMiddleware.auditLog(
      'Input validation failed',
      {
        tool: 'delete_cluster',
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
  const { clusterName } = validatedArgs;
  let { projectId, region } = validatedArgs;

  if (!projectId && deps.defaultParamManager) {
    try {
      projectId = deps.defaultParamManager.getParameterValue('projectId');
    } catch (error) {
      // Ignore error, will be caught by validation below
    }
  }

  if (!region && deps.defaultParamManager) {
    try {
      region = deps.defaultParamManager.getParameterValue('region');
    } catch (error) {
      // Ignore error, will be caught by validation below
    }
  }

  // Validate required parameters after defaults
  if (!projectId || !region) {
    throw new McpError(ErrorCode.InvalidParams, 'Missing required parameters: projectId, region');
  }

  // Additional GCP constraint validation
  SecurityMiddleware.validateGCPConstraints({ projectId, region, clusterName });

  // Audit log the operation
  SecurityMiddleware.auditLog('Cluster deletion initiated', {
    tool: 'delete_cluster',
    projectId,
    region,
    clusterName,
  });

  const response = await deleteCluster(projectId, region, clusterName);

  SecurityMiddleware.auditLog('Cluster deletion completed', {
    tool: 'delete_cluster',
    projectId,
    region,
    clusterName,
    success: true,
  });

  return {
    content: [
      {
        type: 'text',
        text: `Cluster ${clusterName} deletion initiated in region ${region}.\nDeletion details:\n${JSON.stringify(SecurityMiddleware.sanitizeForLogging(response), null, 2)}`,
      },
    ],
  };
}

/**
 * Create cluster from YAML configuration file
 */
export async function handleCreateClusterFromYaml(args: any, deps: HandlerDependencies) {
  // Apply security middleware
  SecurityMiddleware.checkRateLimit(`create_cluster_from_yaml:${JSON.stringify(args)}`);

  // Basic validation (sanitize only the input parameters, not the YAML data)
  const typedArgs = args as any;

  // Sanitize only the user-provided parameters
  if (typedArgs.yamlPath && typeof typedArgs.yamlPath === 'string') {
    typedArgs.yamlPath = SecurityMiddleware.sanitizeString(typedArgs.yamlPath);
  }
  if (!typedArgs.yamlPath || typeof typedArgs.yamlPath !== 'string') {
    throw new McpError(ErrorCode.InvalidParams, 'yamlPath is required and must be a string');
  }

  const { yamlPath, overrides } = typedArgs;

  try {
    // Use the proper YAML processing function that handles both formats
    const { getDataprocConfigFromYaml } = await import('../config/yaml.js');
    const yamlResult = await getDataprocConfigFromYaml(yamlPath);

    // Extract the properly processed configuration
    const { clusterName } = yamlResult;
    let clusterConfig = yamlResult.config;

    // Apply overrides if provided
    if (overrides && typeof overrides === 'object') {
      clusterConfig = { ...clusterConfig, ...overrides };
    }

    // Use existing cluster creation logic with properly extracted config
    // This will now include tracking since we updated handleStartDataprocCluster
    return handleStartDataprocCluster({ clusterName, clusterConfig }, deps);
  } catch (error) {
    logger.error('Failed to create cluster from YAML:', error);
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to create cluster from YAML: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Create cluster from profile
 */
export async function handleCreateClusterFromProfile(args: any, deps: HandlerDependencies) {
  // Apply security middleware
  SecurityMiddleware.checkRateLimit(`create_cluster_from_profile:${JSON.stringify(args)}`);

  // Basic validation (sanitize only the input parameters, not the profile data)
  const typedArgs = args as any;

  // Sanitize only the user-provided parameters
  if (typedArgs.profileName && typeof typedArgs.profileName === 'string') {
    typedArgs.profileName = SecurityMiddleware.sanitizeString(typedArgs.profileName);
  }
  if (typedArgs.clusterName && typeof typedArgs.clusterName === 'string') {
    typedArgs.clusterName = SecurityMiddleware.sanitizeString(typedArgs.clusterName);
  }
  if (!typedArgs.profileName || typeof typedArgs.profileName !== 'string') {
    throw new McpError(ErrorCode.InvalidParams, 'profileName is required and must be a string');
  }
  if (!typedArgs.clusterName || typeof typedArgs.clusterName !== 'string') {
    throw new McpError(ErrorCode.InvalidParams, 'clusterName is required and must be a string');
  }

  const { profileName, clusterName, overrides } = typedArgs;

  try {
    // Load profile configuration
    if (!deps.profileManager) {
      throw new McpError(ErrorCode.InternalError, 'Profile manager not available');
    }

    const profile = await deps.profileManager.getProfile(profileName);
    if (!profile) {
      throw new McpError(ErrorCode.InvalidParams, `Profile not found: ${profileName}`);
    }

    // Get cluster config from profile
    let clusterConfig = profile.clusterConfig || {};

    // Apply overrides if provided
    if (overrides && typeof overrides === 'object') {
      clusterConfig = { ...clusterConfig, ...overrides };
    }

    // Use existing cluster creation logic
    return handleStartDataprocCluster({ clusterName, clusterConfig }, deps);
  } catch (error) {
    logger.error('Failed to create cluster from profile:', error);
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to create cluster from profile: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get Zeppelin notebook URL for a cluster
 */
export async function handleGetZeppelinUrl(args: any, deps: HandlerDependencies) {
  // Apply security middleware
  SecurityMiddleware.checkRateLimit(`get_zeppelin_url:${JSON.stringify(args)}`);

  // Sanitize input
  const sanitizedArgs = SecurityMiddleware.sanitizeObject(args);

  // Basic validation
  const typedArgs = sanitizedArgs as any;
  if (!typedArgs.clusterName || typeof typedArgs.clusterName !== 'string') {
    throw new McpError(ErrorCode.InvalidParams, 'clusterName is required and must be a string');
  }

  const { clusterName } = typedArgs;

  try {
    // Get default parameters if not provided
    let projectId: string | undefined;
    let region: string | undefined;

    if (deps.defaultParamManager) {
      try {
        projectId = deps.defaultParamManager.getParameterValue('projectId') as string;
      } catch (error) {
        // Ignore error, will be caught by validation below
      }

      try {
        region = deps.defaultParamManager.getParameterValue('region') as string;
      } catch (error) {
        // Ignore error, will be caught by validation below
      }
    }

    // Validate required parameters after defaults
    if (!projectId || !region) {
      throw new McpError(ErrorCode.InvalidParams, 'Missing required parameters: projectId, region');
    }

    // Get cluster details to check if Zeppelin is enabled
    const cluster = await getCluster(projectId, region, clusterName);

    if (!cluster) {
      throw new McpError(ErrorCode.InvalidParams, `Cluster not found: ${clusterName}`);
    }

    // Check if Zeppelin is enabled in the cluster configuration
    const zeppelinEnabled = (cluster as any).config?.softwareConfig?.optionalComponents?.includes(
      'ZEPPELIN'
    );

    if (!zeppelinEnabled) {
      return {
        content: [
          {
            type: 'text',
            text: `Zeppelin is not enabled on cluster ${clusterName}. To enable Zeppelin, recreate the cluster with ZEPPELIN in the optional components.`,
          },
        ],
      };
    }

    // Construct Zeppelin URL
    const zeppelinUrl = `https://${clusterName}-m.${region}.c.${projectId}.internal:8080`;

    return {
      content: [
        {
          type: 'text',
          text: `Zeppelin notebook URL for cluster ${clusterName}:\n${zeppelinUrl}\n\nNote: This URL is accessible from within the VPC or through appropriate firewall rules.`,
        },
      ],
    };
  } catch (error) {
    logger.error('Failed to get Zeppelin URL:', error);
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to get Zeppelin URL: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
