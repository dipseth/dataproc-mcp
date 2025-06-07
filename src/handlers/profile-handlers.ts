/**
 * Profile management handlers
 * Extracted from main server file for better organization
 */

import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../utils/logger.js';
import SecurityMiddleware from '../security/middleware.js';
import {
  ListProfilesSchema,
  GetProfileSchema,
  ListTrackedClustersSchema,
} from '../validation/schemas.js';
import { ProfileManager } from '../services/profile.js';
import { ClusterTracker } from '../services/tracker.js';
import { TemplatingIntegration } from '../services/templating-integration.js';
import { DefaultParameterManager } from '../services/default-params.js';

export interface ProfileHandlerDependencies {
  profileManager?: ProfileManager;
  clusterTracker?: ClusterTracker;
  templatingIntegration?: TemplatingIntegration;
  defaultParamManager?: DefaultParameterManager;
}

export async function handleListProfiles(args: any, deps: ProfileHandlerDependencies) {
  // Apply security middleware
  SecurityMiddleware.checkRateLimit(`list_profiles:${JSON.stringify(args)}`);

  // Sanitize input
  const sanitizedArgs = SecurityMiddleware.sanitizeObject(args);

  // Validate input with Zod schema
  let validatedArgs;
  try {
    validatedArgs = SecurityMiddleware.validateInput(ListProfilesSchema, sanitizedArgs);
  } catch (error) {
    SecurityMiddleware.auditLog(
      'Input validation failed',
      {
        tool: 'list_profiles',
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
  const { category } = validatedArgs;

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
  SecurityMiddleware.auditLog('Profile list requested', {
    tool: 'list_profiles',
    projectId,
    region,
    category,
  });

  if (!deps.profileManager) {
    throw new McpError(ErrorCode.InternalError, 'Profile manager not available');
  }

  try {
    const profiles = category
      ? deps.profileManager.getProfilesByCategory(category)
      : deps.profileManager.getAllProfiles();

    SecurityMiddleware.auditLog('Profile list completed', {
      tool: 'list_profiles',
      category,
      profileCount: profiles.length,
    });

    return {
      content: [
        {
          type: 'text',
          text: `Available profiles${category ? ` in category "${category}"` : ''}:\n${JSON.stringify(SecurityMiddleware.sanitizeForLogging(profiles), null, 2)}`,
        },
      ],
    };
  } catch (error) {
    SecurityMiddleware.auditLog(
      'Profile list failed',
      {
        tool: 'list_profiles',
        category,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      'error'
    );

    logger.error('MCP list_profiles: Error from profileManager:', error);
    throw error;
  }
}

export async function handleGetProfile(args: any, deps: ProfileHandlerDependencies) {
  // Apply security middleware
  SecurityMiddleware.checkRateLimit(`get_profile:${JSON.stringify(args)}`);

  // Sanitize input
  const sanitizedArgs = SecurityMiddleware.sanitizeObject(args);

  // Validate input with Zod schema
  let validatedArgs;
  try {
    validatedArgs = SecurityMiddleware.validateInput(GetProfileSchema, sanitizedArgs);
  } catch (error) {
    SecurityMiddleware.auditLog(
      'Input validation failed',
      {
        tool: 'get_profile',
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
  const { profileId } = validatedArgs;

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
  SecurityMiddleware.auditLog('Profile details requested', {
    tool: 'get_profile',
    projectId,
    region,
    profileId,
  });

  if (!deps.profileManager) {
    throw new McpError(ErrorCode.InternalError, 'Profile manager not available');
  }

  try {
    const profile = await deps.profileManager.getProfile(profileId);

    SecurityMiddleware.auditLog('Profile details completed', {
      tool: 'get_profile',
      profileId,
      found: !!profile,
    });

    return {
      content: [
        {
          type: 'text',
          text: `Profile "${profileId}" details:\n${JSON.stringify(SecurityMiddleware.sanitizeForLogging(profile), null, 2)}`,
        },
      ],
    };
  } catch (error) {
    SecurityMiddleware.auditLog(
      'Profile details failed',
      {
        tool: 'get_profile',
        profileId,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      'error'
    );

    logger.error('MCP get_profile: Error from profileManager:', error);
    throw error;
  }
}

export async function handleListTrackedClusters(args: any, deps: ProfileHandlerDependencies) {
  // Apply security middleware
  SecurityMiddleware.checkRateLimit(`list_tracked_clusters:${JSON.stringify(args)}`);

  // Sanitize input
  const sanitizedArgs = SecurityMiddleware.sanitizeObject(args);

  // Validate input with Zod schema
  let validatedArgs;
  try {
    validatedArgs = SecurityMiddleware.validateInput(ListTrackedClustersSchema, sanitizedArgs);
  } catch (error) {
    SecurityMiddleware.auditLog(
      'Input validation failed',
      {
        tool: 'list_tracked_clusters',
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
  const { profileId } = validatedArgs;

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
  SecurityMiddleware.auditLog('Tracked clusters list requested', {
    tool: 'list_tracked_clusters',
    projectId,
    region,
    profileId,
  });

  if (!deps.clusterTracker) {
    throw new McpError(ErrorCode.InternalError, 'Cluster tracker not available');
  }

  try {
    const trackedClusters = profileId
      ? deps.clusterTracker.getTrackedClustersByProfile(profileId)
      : deps.clusterTracker.getAllTrackedClusters();

    SecurityMiddleware.auditLog('Tracked clusters list completed', {
      tool: 'list_tracked_clusters',
      profileId,
      clusterCount: trackedClusters.length,
    });

    return {
      content: [
        {
          type: 'text',
          text: `Tracked clusters${profileId ? ` for profile "${profileId}"` : ''}:\n${JSON.stringify(SecurityMiddleware.sanitizeForLogging(trackedClusters), null, 2)}`,
        },
      ],
    };
  } catch (error) {
    SecurityMiddleware.auditLog(
      'Tracked clusters list failed',
      {
        tool: 'list_tracked_clusters',
        profileId,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      'error'
    );

    logger.error('MCP list_tracked_clusters: Error from clusterTracker:', error);
    throw error;
  }
}
