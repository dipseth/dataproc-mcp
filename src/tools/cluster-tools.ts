/**
 * Cluster management tool definitions
 * Extracted from main server file for better organization
 */

export const clusterTools = [
  // Original tool
  {
    name: 'start_dataproc_cluster',
    description: 'Start a Google Cloud Dataproc cluster',
    inputSchema: {
      type: 'object',
      properties: {
        clusterName: { type: 'string', description: 'Name for the new cluster' },
        clusterConfig: {
          type: 'object',
          description: 'Optional: Dataproc cluster config (JSON object)',
        },
      },
      required: ['clusterName'],
    },
  },

  // New tool: create cluster from YAML
  {
    name: 'create_cluster_from_yaml',
    description: 'Create a Dataproc cluster using a YAML configuration file',
    inputSchema: {
      type: 'object',
      properties: {
        yamlPath: { type: 'string', description: 'Path to the YAML configuration file' },
        overrides: { type: 'object', description: 'Optional: Runtime configuration overrides' },
      },
      required: ['yamlPath'],
    },
  },

  // New tool: create cluster from profile
  {
    name: 'create_cluster_from_profile',
    description: 'Create a Dataproc cluster using a predefined profile',
    inputSchema: {
      type: 'object',
      properties: {
        profileName: { type: 'string', description: 'Name of the profile to use' },
        clusterName: { type: 'string', description: 'Name for the new cluster' },
        overrides: { type: 'object', description: 'Optional: Runtime configuration overrides' },
      },
      required: ['profileName', 'clusterName'],
    },
  },

  // New tool: list clusters
  {
    name: 'list_clusters',
    description: 'List Dataproc clusters in a project and region',
    inputSchema: {
      type: 'object',
      properties: {
        verbose: {
          type: 'boolean',
          description: 'Optional: Return full response without filtering (default: false)',
        },
        semanticQuery: {
          type: 'string',
          description:
            'Optional: Semantic query to extract specific information (e.g., "pip packages", "machine types", "network config")',
        },
      },
      required: [],
    },
  },

  // New tool: list tracked clusters
  {
    name: 'list_tracked_clusters',
    description: 'List clusters that were created and tracked by this MCP server',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'Optional: Google Cloud Project ID' },
        region: { type: 'string', description: 'Optional: Google Cloud region' },
        profileId: { type: 'string', description: 'Optional: Filter by profile ID' },
      },
      required: [],
    },
  },

  // New tool: get cluster details
  {
    name: 'get_cluster',
    description: 'Get details for a specific Dataproc cluster',
    inputSchema: {
      type: 'object',
      properties: {
        clusterName: { type: 'string', description: 'Name of the cluster' },
        verbose: {
          type: 'boolean',
          description: 'Optional: Return full response without filtering (default: false)',
        },
        semanticQuery: {
          type: 'string',
          description:
            'Optional: Semantic query to extract specific information (e.g., "pip packages", "machine types", "network config")',
        },
      },
      required: ['clusterName'],
    },
  },

  // New tool: delete cluster
  {
    name: 'delete_cluster',
    description: 'Delete a Dataproc cluster',
    inputSchema: {
      type: 'object',
      properties: {
        clusterName: { type: 'string', description: 'Name of the cluster to delete' },
      },
      required: ['clusterName'],
    },
  },

  // New tool: get Zeppelin notebook URL for a cluster
  {
    name: 'get_zeppelin_url',
    description: 'Get the Zeppelin notebook URL for a Dataproc cluster (if enabled).',
    inputSchema: {
      type: 'object',
      properties: {
        clusterName: { type: 'string', description: 'Name of the cluster' },
      },
      required: ['clusterName'],
    },
  },
];

export default clusterTools;
