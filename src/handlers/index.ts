/**
 * Main handler registry
 * Combines all handlers from organized files
 */

import {
  handleStartDataprocCluster,
  handleCreateClusterFromYaml,
  handleCreateClusterFromProfile,
  handleListClusters,
  handleGetCluster,
  handleDeleteCluster,
  handleGetClusterEndpoints,
} from './cluster-handlers.js';
import {
  handleSubmitHiveQuery,
  handleSubmitDataprocJob,
  handleGetQueryStatus,
  handleGetJobStatus,
  handleGetQueryResults,
  handleGetJobResults,
  handleCheckActiveJobs,
  handleCancelDataprocJob,
} from './job-handlers.js';
import {
  handleListProfiles,
  handleGetProfile,
  handleListTrackedClusters,
  // ProfileHandlerDependencies,
} from './profile-handlers.js';
import {
  handleQueryClusterData,
  handleGetClusterInsights,
  handleGetJobAnalytics,
  handleQueryKnowledge,
  // KnowledgeHandlerDependencies,
} from './knowledge-handlers.js';

// Import types for the combined interface
import { DefaultParameterManager } from '../services/default-params.js';
import { ResponseFilter } from '../services/response-filter.js';
import { KnowledgeIndexer } from '../services/knowledge-indexer.js';
import { ProfileManager } from '../services/profile.js';
import { ClusterTracker } from '../services/tracker.js';
import { JobTracker } from '../services/job-tracker.js';
import { AsyncQueryPoller } from '../services/async-query-poller.js';
import { TemplatingIntegration } from '../services/templating-integration.js';
import { SemanticQueryService } from '../services/semantic-query.js';

// Combined dependencies interface
export interface AllHandlerDependencies {
  defaultParamManager?: DefaultParameterManager;
  responseFilter?: ResponseFilter;
  knowledgeIndexer?: KnowledgeIndexer;
  profileManager?: ProfileManager;
  clusterTracker?: ClusterTracker;
  jobTracker?: JobTracker;
  asyncQueryPoller?: AsyncQueryPoller;
  templatingIntegration?: TemplatingIntegration;
  semanticQueryService?: SemanticQueryService;
}

/**
 * Main handler function that routes to appropriate handlers
 */
export async function handleToolCall(toolName: string, args: any, deps: AllHandlerDependencies) {
  switch (toolName) {
    // Cluster handlers
    case 'start_dataproc_cluster':
      return handleStartDataprocCluster(args, deps);
    case 'create_cluster_from_yaml':
      return handleCreateClusterFromYaml(args, deps);
    case 'create_cluster_from_profile':
      return handleCreateClusterFromProfile(args, deps);
    case 'list_clusters':
      return handleListClusters(args, deps);
    case 'get_cluster':
      return handleGetCluster(args, deps);
    case 'delete_cluster':
      return handleDeleteCluster(args, deps);
    case 'list_tracked_clusters':
      return handleListTrackedClusters(args, deps);
    case 'get_cluster_endpoints':
      return handleGetClusterEndpoints(args, deps);

    // Job handlers
    case 'submit_hive_query':
      return handleSubmitHiveQuery(args, deps);
    case 'submit_dataproc_job':
      return handleSubmitDataprocJob(args, deps);
    case 'get_query_status':
      return handleGetQueryStatus(args, deps);
    case 'get_job_status':
      return handleGetJobStatus(args, deps);
    case 'get_query_results':
      return handleGetQueryResults(args, deps);
    case 'get_job_results':
      return handleGetJobResults(args, deps);
    case 'check_active_jobs':
      return handleCheckActiveJobs(args, deps);
    case 'cancel_dataproc_job':
      return handleCancelDataprocJob(args, deps);

    // Profile handlers
    case 'list_profiles':
      return handleListProfiles(args, deps);
    case 'get_profile':
      return handleGetProfile(args, deps);

    // Knowledge handlers
    case 'query_cluster_data':
      return handleQueryClusterData(args, deps);
    case 'get_cluster_insights':
      return handleGetClusterInsights(args, deps);
    case 'get_job_analytics':
      return handleGetJobAnalytics(args, deps);
    case 'query_knowledge':
      return handleQueryKnowledge(args, deps);

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

/**
 * Get all supported tool names
 */
export function getSupportedToolNames(): string[] {
  return [
    // Cluster tools
    'start_dataproc_cluster',
    'list_clusters',
    'get_cluster',
    'delete_cluster',
    'list_tracked_clusters',

    // Job tools
    'submit_hive_query',
    'get_query_status',
    'get_job_status',
    'get_query_results',
    'check_active_jobs',

    // Profile tools
    'list_profiles',
    'get_profile',

    // Knowledge tools
    'query_cluster_data',
    'get_cluster_insights',
    'get_job_analytics',
    'query_knowledge',
  ];
}

/**
 * Handler summary for debugging
 */
export const handlerSummary = {
  total: getSupportedToolNames().length,
  cluster: 8, // Added create_cluster_from_yaml, create_cluster_from_profile, get_cluster_endpoints
  job: 7, // Added submit_dataproc_job, get_job_status, get_job_results
  profile: 2,
  knowledge: 4,
};
