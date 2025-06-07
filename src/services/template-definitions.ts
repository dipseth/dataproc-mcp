/**
 * Core template definitions for MCP Resource Templating
 * Implements the template hierarchy based on the architecture analysis
 */

import { TemplateDefinition } from '../types/templating.js';

/**
 * Core GCP templates affecting 15/21 tools (71%)
 */
export const GCP_CORE_TEMPLATES: TemplateDefinition[] = [
  {
    id: 'gcp-base',
    pattern: 'dataproc://gcp/{projectId}/{region}',
    description: 'Base GCP resource template with project and region parameters',
    category: 'gcp',
    parameters: [
      {
        name: 'projectId',
        type: 'string',
        required: true,
        source: 'gcp',
        description: 'Google Cloud Project ID',
        validation: {
          pattern: '^[a-z][a-z0-9-]{4,28}[a-z0-9]$',
          min: 6,
          max: 30,
        },
      },
      {
        name: 'region',
        type: 'string',
        required: true,
        source: 'gcp',
        description: 'Google Cloud region (e.g., us-central1)',
        validation: {
          pattern: '^[a-z]+-[a-z]+[0-9]+$',
        },
      },
    ],
    queryParameters: [
      {
        name: 'verbose',
        type: 'boolean',
        expansion: 'form',
        required: false,
        defaultValue: false,
        description: 'Enable verbose response output',
      },
    ],
  },

  {
    id: 'gcp-clusters',
    pattern: 'dataproc://gcp/{projectId}/{region}/clusters{?filter,pageSize,pageToken,verbose}',
    description: 'GCP clusters listing with pagination and filtering',
    category: 'gcp',
    parentTemplate: 'gcp-base',
    parameters: [],
    queryParameters: [
      {
        name: 'filter',
        type: 'string',
        expansion: 'form',
        required: false,
        description: 'Filter expression for clusters',
      },
      {
        name: 'pageSize',
        type: 'number',
        expansion: 'form',
        required: false,
        defaultValue: 50,
        description: 'Number of clusters per page',
      },
      {
        name: 'pageToken',
        type: 'string',
        expansion: 'form',
        required: false,
        description: 'Token for pagination',
      },
    ],
  },

  {
    id: 'gcp-jobs',
    pattern: 'dataproc://gcp/{projectId}/{region}/jobs{?state,clusterName,maxResults,pageToken}',
    description: 'GCP jobs listing with filtering and pagination',
    category: 'gcp',
    parentTemplate: 'gcp-base',
    parameters: [],
    queryParameters: [
      {
        name: 'state',
        type: 'string',
        expansion: 'form',
        required: false,
        description: 'Job state filter (PENDING, RUNNING, DONE, etc.)',
      },
      {
        name: 'clusterName',
        type: 'string',
        expansion: 'form',
        required: false,
        description: 'Filter jobs by cluster name',
      },
      {
        name: 'maxResults',
        type: 'number',
        expansion: 'form',
        required: false,
        defaultValue: 100,
        description: 'Maximum number of jobs to return',
      },
    ],
  },
];

/**
 * Cluster operation templates affecting 10/21 tools (48%)
 */
export const CLUSTER_OPERATION_TEMPLATES: TemplateDefinition[] = [
  {
    id: 'gcp-cluster-base',
    pattern: 'dataproc://gcp/{projectId}/{region}/cluster/{clusterName}',
    description: 'Base cluster resource template',
    category: 'cluster',
    parentTemplate: 'gcp-base',
    parameters: [
      {
        name: 'clusterName',
        type: 'string',
        required: true,
        source: 'tool',
        description: 'Dataproc cluster name',
        validation: {
          pattern: '^[a-z]([a-z0-9-]*[a-z0-9])?$',
          min: 1,
          max: 54,
        },
      },
    ],
  },

  {
    id: 'gcp-cluster-status',
    pattern:
      'dataproc://gcp/{projectId}/{region}/cluster/{clusterName}/status{?verbose,semanticQuery}',
    description: 'Cluster status and details with semantic query support',
    category: 'cluster',
    parentTemplate: 'gcp-cluster-base',
    parameters: [],
    queryParameters: [
      {
        name: 'semanticQuery',
        type: 'string',
        expansion: 'form',
        required: false,
        description: 'Natural language query for cluster information',
      },
    ],
  },

  {
    id: 'gcp-cluster-jobs',
    pattern:
      'dataproc://gcp/{projectId}/{region}/cluster/{clusterName}/jobs{?state,maxResults,pageToken}',
    description: 'Jobs running on a specific cluster',
    category: 'cluster',
    parentTemplate: 'gcp-cluster-base',
    parameters: [],
    queryParameters: [
      {
        name: 'state',
        type: 'string',
        expansion: 'form',
        required: false,
        description: 'Filter jobs by state',
      },
      {
        name: 'maxResults',
        type: 'number',
        expansion: 'form',
        required: false,
        defaultValue: 50,
        description: 'Maximum number of jobs to return',
      },
    ],
  },

  {
    id: 'gcp-cluster-zeppelin',
    pattern: 'dataproc://gcp/{projectId}/{region}/cluster/{clusterName}/zeppelin',
    description: 'Zeppelin notebook URL for cluster',
    category: 'cluster',
    parentTemplate: 'gcp-cluster-base',
    parameters: [],
  },

  {
    id: 'gcp-cluster-delete',
    pattern: 'dataproc://gcp/{projectId}/{region}/cluster/{clusterName}/delete',
    description: 'Cluster deletion endpoint',
    category: 'cluster',
    parentTemplate: 'gcp-cluster-base',
    parameters: [],
  },

  {
    id: 'gcp-cluster-hive',
    pattern:
      'dataproc://gcp/{projectId}/{region}/cluster/{clusterName}/hive{?query,async,verbose,queryOptions}',
    description: 'Hive query submission on cluster',
    category: 'cluster',
    parentTemplate: 'gcp-cluster-base',
    parameters: [],
    queryParameters: [
      {
        name: 'query',
        type: 'string',
        expansion: 'form',
        required: true,
        description: 'Hive query to execute',
      },
      {
        name: 'async',
        type: 'boolean',
        expansion: 'form',
        required: false,
        defaultValue: false,
        description: 'Execute query asynchronously',
      },
      {
        name: 'queryOptions',
        type: 'string',
        expansion: 'form',
        required: false,
        description: 'JSON-encoded query options',
      },
    ],
  },
];

/**
 * Job operation templates affecting 6/21 tools (29%)
 */
export const JOB_OPERATION_TEMPLATES: TemplateDefinition[] = [
  {
    id: 'gcp-job-base',
    pattern: 'dataproc://gcp/{projectId}/{region}/job/{jobId}',
    description: 'Base job resource template',
    category: 'job',
    parentTemplate: 'gcp-base',
    parameters: [
      {
        name: 'jobId',
        type: 'string',
        required: true,
        source: 'tool',
        description: 'Dataproc job identifier',
        validation: {
          pattern: '^[a-zA-Z0-9_-]+$',
          min: 1,
          max: 100,
        },
      },
    ],
  },

  {
    id: 'gcp-job-status',
    pattern: 'dataproc://gcp/{projectId}/{region}/job/{jobId}/status{?verbose}',
    description: 'Job status and execution details',
    category: 'job',
    parentTemplate: 'gcp-job-base',
    parameters: [],
  },

  {
    id: 'gcp-job-results',
    pattern: 'dataproc://gcp/{projectId}/{region}/job/{jobId}/results{?maxResults,pageToken}',
    description: 'Job execution results with pagination',
    category: 'job',
    parentTemplate: 'gcp-job-base',
    parameters: [],
    queryParameters: [
      {
        name: 'maxResults',
        type: 'number',
        expansion: 'form',
        required: false,
        defaultValue: 10,
        description: 'Maximum number of result rows to return',
      },
      {
        name: 'pageToken',
        type: 'string',
        expansion: 'form',
        required: false,
        description: 'Token for result pagination',
      },
    ],
  },

  {
    id: 'gcp-job-logs',
    pattern: 'dataproc://gcp/{projectId}/{region}/job/{jobId}/logs{?logType,maxLines}',
    description: 'Job execution logs',
    category: 'job',
    parentTemplate: 'gcp-job-base',
    parameters: [],
    queryParameters: [
      {
        name: 'logType',
        type: 'string',
        expansion: 'form',
        required: false,
        defaultValue: 'all',
        description: 'Type of logs to retrieve (stdout, stderr, all)',
      },
      {
        name: 'maxLines',
        type: 'number',
        expansion: 'form',
        required: false,
        defaultValue: 1000,
        description: 'Maximum number of log lines to return',
      },
    ],
  },
];

/**
 * Knowledge base templates affecting 4/21 tools (19%)
 */
export const KNOWLEDGE_BASE_TEMPLATES: TemplateDefinition[] = [
  {
    id: 'knowledge-base',
    pattern: 'dataproc://knowledge/{type}',
    description: 'Base knowledge base resource template',
    category: 'knowledge',
    parameters: [
      {
        name: 'type',
        type: 'string',
        required: true,
        source: 'tool',
        description: 'Knowledge base type',
        validation: {
          enum: ['clusters', 'cluster', 'jobs', 'job', 'errors', 'error', 'all'],
        },
      },
    ],
  },

  {
    id: 'knowledge-query',
    pattern: 'dataproc://knowledge/{type}/query{?query,limit,includeRawDocument,projectId,region}',
    description: 'Knowledge base semantic search',
    category: 'knowledge',
    parentTemplate: 'knowledge-base',
    parameters: [],
    queryParameters: [
      {
        name: 'query',
        type: 'string',
        expansion: 'form',
        required: true,
        description: 'Natural language search query',
      },
      {
        name: 'limit',
        type: 'number',
        expansion: 'form',
        required: false,
        defaultValue: 10,
        description: 'Maximum number of results to return',
      },
      {
        name: 'includeRawDocument',
        type: 'boolean',
        expansion: 'form',
        required: false,
        defaultValue: false,
        description: 'Include raw document data in response',
      },
      {
        name: 'projectId',
        type: 'string',
        expansion: 'form',
        required: false,
        description: 'Filter results by project ID',
      },
      {
        name: 'region',
        type: 'string',
        expansion: 'form',
        required: false,
        description: 'Filter results by region',
      },
    ],
  },

  {
    id: 'knowledge-analytics-clusters',
    pattern: 'dataproc://knowledge/analytics/clusters{?projectId,region}',
    description: 'Cluster analytics and insights',
    category: 'knowledge',
    parameters: [],
    queryParameters: [
      {
        name: 'projectId',
        type: 'string',
        expansion: 'form',
        required: false,
        description: 'Filter analytics by project ID',
      },
      {
        name: 'region',
        type: 'string',
        expansion: 'form',
        required: false,
        description: 'Filter analytics by region',
      },
    ],
  },

  {
    id: 'knowledge-analytics-jobs',
    pattern: 'dataproc://knowledge/analytics/jobs{?projectId,region}',
    description: 'Job analytics and performance metrics',
    category: 'knowledge',
    parameters: [],
    queryParameters: [
      {
        name: 'projectId',
        type: 'string',
        expansion: 'form',
        required: false,
        description: 'Filter analytics by project ID',
      },
      {
        name: 'region',
        type: 'string',
        expansion: 'form',
        required: false,
        description: 'Filter analytics by region',
      },
    ],
  },
];

/**
 * Profile management templates
 */
export const PROFILE_TEMPLATES: TemplateDefinition[] = [
  {
    id: 'profile-base',
    pattern: 'dataproc://profile/{category}/{profileName}',
    description: 'Base profile resource template',
    category: 'profile',
    parameters: [
      {
        name: 'category',
        type: 'string',
        required: true,
        source: 'profile',
        description: 'Profile category',
        validation: {
          enum: ['development', 'production', 'staging', 'testing'],
        },
      },
      {
        name: 'profileName',
        type: 'string',
        required: true,
        source: 'profile',
        description: 'Profile name identifier',
        validation: {
          pattern: '^[a-z][a-z0-9-]*[a-z0-9]$',
          min: 1,
          max: 50,
        },
      },
    ],
  },

  {
    id: 'profile-config',
    pattern: 'dataproc://profile/{category}/{profileName}/config',
    description: 'Profile configuration details',
    category: 'profile',
    parentTemplate: 'profile-base',
    parameters: [],
  },

  {
    id: 'profile-parameters',
    pattern: 'dataproc://profile/{category}/{profileName}/parameters',
    description: 'Profile parameter overrides',
    category: 'profile',
    parentTemplate: 'profile-base',
    parameters: [],
  },
];

/**
 * All template definitions organized by category
 */
export const ALL_TEMPLATE_DEFINITIONS: Record<string, TemplateDefinition[]> = {
  gcp: GCP_CORE_TEMPLATES,
  cluster: CLUSTER_OPERATION_TEMPLATES,
  job: JOB_OPERATION_TEMPLATES,
  knowledge: KNOWLEDGE_BASE_TEMPLATES,
  profile: PROFILE_TEMPLATES,
};

/**
 * Flattened array of all template definitions
 */
export const TEMPLATE_DEFINITIONS: TemplateDefinition[] = [
  ...GCP_CORE_TEMPLATES,
  ...CLUSTER_OPERATION_TEMPLATES,
  ...JOB_OPERATION_TEMPLATES,
  ...KNOWLEDGE_BASE_TEMPLATES,
  ...PROFILE_TEMPLATES,
];

/**
 * Template mapping by tool name (based on analysis)
 */
export const TOOL_TEMPLATE_MAPPING: Record<string, string[]> = {
  // Cluster management tools (7 tools)
  start_dataproc_cluster: ['gcp-cluster-base'],
  create_cluster_from_yaml: ['gcp-base'],
  create_cluster_from_profile: ['gcp-base', 'profile-base'],
  list_clusters: ['gcp-clusters'],
  get_cluster: ['gcp-cluster-status'],
  delete_cluster: ['gcp-cluster-delete'],
  list_tracked_clusters: ['gcp-base'],

  // Job management tools (8 tools)
  submit_hive_query: ['gcp-cluster-hive'],
  get_query_status: ['gcp-job-status'],
  get_query_results: ['gcp-job-results'],
  submit_dataproc_job: ['gcp-cluster-base'],
  get_job_status: ['gcp-job-status'],
  get_job_results: ['gcp-job-results'],
  get_zeppelin_url: ['gcp-cluster-zeppelin'],
  check_active_jobs: ['gcp-jobs'],

  // Profile management tools (2 tools)
  list_profiles: ['profile-base'],
  get_profile: ['profile-config'],

  // Knowledge/Analytics tools (4 tools)
  query_cluster_data: ['knowledge-query'],
  get_cluster_insights: ['knowledge-analytics-clusters'],
  get_job_analytics: ['knowledge-analytics-jobs'],
  query_knowledge: ['knowledge-query'],
};

/**
 * Get templates for a specific tool
 */
export function getTemplatesForTool(toolName: string): TemplateDefinition[] {
  const templateIds = TOOL_TEMPLATE_MAPPING[toolName] || [];
  return templateIds
    .map((id) => TEMPLATE_DEFINITIONS.find((t) => t.id === id))
    .filter((t): t is TemplateDefinition => t !== undefined);
}

/**
 * Get template by ID
 */
export function getTemplateById(templateId: string): TemplateDefinition | undefined {
  return TEMPLATE_DEFINITIONS.find((t) => t.id === templateId);
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: string): TemplateDefinition[] {
  return ALL_TEMPLATE_DEFINITIONS[category] || [];
}
