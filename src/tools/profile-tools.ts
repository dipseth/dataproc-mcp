/**
 * Profile management tool definitions
 * Extracted from main server file for better organization
 */

export const profileTools = [
  // New tool: list available profiles
  {
    name: 'list_profiles',
    description: 'List available cluster configuration profiles',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'Optional: Google Cloud Project ID' },
        region: { type: 'string', description: 'Optional: Google Cloud region' },
        category: { type: 'string', description: 'Optional: Filter by category' },
      },
      required: [],
    },
  },

  // New tool: get profile details
  {
    name: 'get_profile',
    description: 'Get details for a specific cluster configuration profile',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'Optional: Google Cloud Project ID' },
        region: { type: 'string', description: 'Optional: Google Cloud region' },
        profileId: { type: 'string', description: 'ID of the profile' },
      },
      required: ['profileId'],
    },
  },
];
