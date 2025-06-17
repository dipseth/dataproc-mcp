/**
 * Cluster management service for Dataproc operations
 */

import { ClusterControllerClient, protos } from '@google-cloud/dataproc';
type Cluster = protos.google.cloud.dataproc.v1.ICluster;
type Operation = protos.google.longrunning.IOperation;
import { getGcloudAccessTokenWithConfig } from '../config/credentials.js';
import { getDataprocConfigFromYaml } from '../config/yaml.js';
import { ClusterConfig } from '../types/cluster-config.js';
import { deepMerge } from '../utils/object-utils.js';
// For ESM compatibility with node-fetch
import fetch from 'node-fetch';

/**
 * Creates a new Dataproc cluster
 * @param projectId GCP project ID
 * @param region Dataproc region
 * @param clusterName Name for the new cluster
 * @param clusterConfig Optional cluster configuration
 * @param client Optional pre-configured Dataproc client
 * @returns Created cluster details
 */
export async function createCluster(
  projectId: string,
  region: string,
  clusterName: string,
  clusterConfig?: ClusterConfig,
  _client?: ClusterControllerClient,
  ____impersonateServiceAccount?: string,
  labels?: Record<string, string> // Add labels parameter
): Promise<Cluster> {
  if (process.env.LOG_LEVEL === 'debug')
    console.error('[DEBUG] createCluster: Starting with params:', {
      projectId,
      region,
      clusterName,
    });

  try {
    // Convert our ClusterConfig to the format expected by the Dataproc API
    const apiConfig: ClusterConfig = {};

    if (clusterConfig) {
      // Copy all properties from our config to the API config
      // This ensures all configuration sections (including metastoreConfig) are properly applied
      // Fixes issue #17: Metastore configuration from profile not applied during cluster creation
      Object.assign(apiConfig, clusterConfig);
    }

    // Use the REST API directly instead of the client library to avoid authentication issues
    if (process.env.LOG_LEVEL === 'debug')
      console.error('[DEBUG] createCluster: Using REST API directly via createClusterWithRest');
    return await createClusterWithRest(projectId, region, clusterName, apiConfig, labels); // Pass labels to createClusterWithRest
  } catch (error) {
    console.error('[DEBUG] createCluster: Error encountered:', error);
    if (error instanceof Error) {
      throw new Error(`Error creating cluster: ${error.message}`);
    }
    throw new Error('Unknown error creating cluster');
  }
}

/**
 * Creates a new Dataproc cluster using the REST API directly
 * This bypasses the client libraries and uses a token from gcloud CLI
 * @param projectId GCP project ID
 * @param region Dataproc region
 * @param clusterName Name for the new cluster
 * @param clusterConfig Cluster configuration
 * @returns Created cluster details
 */
export async function createClusterWithRest(
  projectId: string,
  region: string,
  clusterName: string,
  clusterConfig: ClusterConfig,
  labels?: Record<string, string> // Add labels as a separate parameter
): Promise<Cluster> {
  if (process.env.LOG_LEVEL === 'debug')
    console.error('[DEBUG] createClusterWithRest: Getting token from gcloud CLI with config');
  const token = await getGcloudAccessTokenWithConfig();

  const url = `https://${region}-dataproc.googleapis.com/v1/projects/${projectId}/regions/${region}/clusters`;

  // Prepare the request body according to Dataproc REST API specification
  const requestBody: {
    projectId: string;
    clusterName: string;
    config: ClusterConfig;
    labels?: Record<string, string>;
  } = {
    projectId,
    clusterName,
    config: clusterConfig,
  };

  // Add labels at the top level if they exist
  if (labels) {
    requestBody.labels = labels;
  }

  if (process.env.LOG_LEVEL === 'debug') {
    console.error('[DEBUG] createClusterWithRest: Making REST API request to:', url);
    console.error(
      '[DEBUG] createClusterWithRest: Request body:',
      JSON.stringify(requestBody, null, 2)
    );
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[DEBUG] createClusterWithRest: API error:', response.status, errorText);
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const result = (await response.json()) as Cluster; // Explicitly cast to Cluster
    if (process.env.LOG_LEVEL === 'debug')
      console.error('[DEBUG] createClusterWithRest: API request successful');
    return result;
  } catch (error) {
    console.error('[DEBUG] createClusterWithRest: Error:', error);
    if (error instanceof Error) {
      throw new Error(`Error creating cluster with REST API: ${error.message}`);
    }
    throw new Error('Unknown error creating cluster with REST API');
  }
}

/**
 * Creates a Dataproc cluster from a YAML configuration file
 * @param projectId GCP project ID
 * @param region Dataproc region
 * @param yamlPath Path to the YAML configuration file
 * @param overrides Optional runtime configuration overrides
 * @returns Created cluster details
 */
export async function createClusterFromYaml(
  projectId: string,
  region: string,
  yamlPath: string,
  overrides?: Partial<ClusterConfig> & {
    clusterName?: string;
    region?: string;
    labels?: Record<string, string>;
  }
): Promise<import('@google-cloud/dataproc').protos.google.cloud.dataproc.v1.ICluster> {
  if (process.env.LOG_LEVEL === 'debug')
    console.error('[DEBUG] createClusterFromYaml: Starting with params:', {
      projectId,
      region,
      yamlPath,
    });

  try {
    // Load the cluster configuration from YAML
    const configData = await getDataprocConfigFromYaml(yamlPath);
    if (process.env.LOG_LEVEL === 'debug')
      console.error('[DEBUG] createClusterFromYaml: Loaded config from YAML');

    // Apply any runtime overrides to the config object
    if (overrides) {
      if (process.env.LOG_LEVEL === 'debug')
        console.error('[DEBUG] createClusterFromYaml: Applying overrides');

      // Apply overrides to the config object
      // No config property on overrides; skip this block

      // Apply other overrides
      if (overrides.clusterName) {
        configData.clusterName = overrides.clusterName;
      }

      if (overrides.region) {
        configData.region = overrides.region;
      }

      if (overrides.labels) {
        configData.labels = deepMerge(configData.labels || {}, overrides.labels);
      }
    }

    // Use the region from the config if not provided in the parameters
    const clusterRegion = region || configData.region;
    if (!clusterRegion) {
      throw new Error('Region must be specified either in the YAML config or as a parameter');
    }

    // Create the cluster - pass the complete config including labels
    if (process.env.LOG_LEVEL === 'debug')
      console.error(
        '[DEBUG] createClusterFromYaml: Creating cluster with name:',
        configData.clusterName
      );

    // Prepare the complete cluster configuration including labels
    // Labels need to be passed as a separate property since they're at cluster level, not config level
    const completeConfig: ClusterConfig = { ...configData.config };
    if (configData.labels) {
      // Do not assign labels to completeConfig; pass as argument to createCluster
    }

    if (process.env.LOG_LEVEL === 'debug') {
      console.error(
        '[DEBUG] createClusterFromYaml: Complete config with labels:',
        JSON.stringify(completeConfig, null, 2)
      );
    }

    return await createCluster(
      projectId,
      clusterRegion,
      configData.clusterName,
      completeConfig,
      undefined,
      undefined,
      configData.labels
    ); // Pass labels to the new parameter
  } catch (error) {
    console.error('[DEBUG] createClusterFromYaml: Error encountered:', error);
    if (error instanceof Error) {
      throw new Error(`Error creating cluster from YAML: ${error.message}`);
    }
    throw new Error('Unknown error creating cluster from YAML');
  }
}

/**
 * Lists Dataproc clusters in a project and region
 * @param projectId GCP project ID
 * @param region Dataproc region
 * @param filter Optional filter string
 * @param pageSize Optional page size
 * @param pageToken Optional page token for pagination
 * @returns List of clusters
 */
export async function listClusters(
  projectId: string,
  region: string,
  filter?: string,
  pageSize?: number,
  pageToken?: string
): Promise<protos.google.cloud.dataproc.v1.IListClustersResponse> {
  if (process.env.LOG_LEVEL === 'debug')
    console.error('[DEBUG] listClusters: Starting with params:', {
      projectId,
      region,
      filter,
      pageSize,
      pageToken,
    });

  try {
    // Use the REST API directly instead of the client library to avoid authentication issues
    if (process.env.LOG_LEVEL === 'debug')
      console.error('[DEBUG] listClusters: Using REST API directly via listClustersWithRest');
    return await listClustersWithRest(projectId, region, filter, pageSize, pageToken);
  } catch (error) {
    console.error('[DEBUG] listClusters: Error encountered:', error);
    if (error instanceof Error) {
      throw new Error(`Error listing clusters: ${error.message}`);
    }
    throw new Error('Unknown error listing clusters');
  }
}

/**
 * Lists Dataproc clusters in a project and region using the REST API directly
 * This bypasses the client libraries and uses a token from gcloud CLI
 * @param projectId GCP project ID
 * @param region Dataproc region
 * @param filter Optional filter string
 * @param pageSize Optional page size
 * @param pageToken Optional page token for pagination
 * @returns List of clusters
 */
export async function listClustersWithRest(
  projectId: string,
  region: string,
  filter?: string,
  pageSize?: number,
  pageToken?: string
): Promise<protos.google.cloud.dataproc.v1.IListClustersResponse> {
  if (process.env.LOG_LEVEL === 'debug')
    console.error('[DEBUG] listClustersWithRest: Getting token from gcloud CLI with config');
  const token = await getGcloudAccessTokenWithConfig();

  // Build the URL with query parameters
  let url = `https://${region}-dataproc.googleapis.com/v1/projects/${projectId}/regions/${region}/clusters`;

  // Add query parameters if provided
  const queryParams = new URLSearchParams();
  if (filter) queryParams.append('filter', filter);
  if (pageSize) queryParams.append('pageSize', pageSize.toString());
  if (pageToken) queryParams.append('pageToken', pageToken);

  // Append query parameters to URL if any exist
  const queryString = queryParams.toString();
  if (queryString) {
    url += `?${queryString}`;
  }

  if (process.env.LOG_LEVEL === 'debug')
    console.error('[DEBUG] listClustersWithRest: Making REST API request to:', url);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[DEBUG] listClustersWithRest: API error:', response.status, errorText);
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const result = (await response.json()) as protos.google.cloud.dataproc.v1.IListClustersResponse;
    if (process.env.LOG_LEVEL === 'debug')
      console.error('[DEBUG] listClustersWithRest: API request successful');
    return result;
  } catch (error) {
    console.error('[DEBUG] listClustersWithRest: Error:', error);
    if (error instanceof Error) {
      throw new Error(`Error listing clusters with REST API: ${error.message}`);
    }
    throw new Error('Unknown error listing clusters with REST API');
  }
}

/**
 * Gets details for a specific Dataproc cluster using the REST API directly
 * This bypasses the client libraries and uses a token from gcloud CLI
 * @param projectId GCP project ID
 * @param region Dataproc region
 * @param clusterName Name of the cluster
 * @returns Cluster details
 */
export async function getClusterWithRest(
  projectId: string,
  region: string,
  clusterName: string
): Promise<Cluster> {
  if (process.env.LOG_LEVEL === 'debug')
    console.error('[DEBUG] getClusterWithRest: Getting token from gcloud CLI with config');
  const token = await getGcloudAccessTokenWithConfig();

  const url = `https://${region}-dataproc.googleapis.com/v1/projects/${projectId}/regions/${region}/clusters/${clusterName}`;

  if (process.env.LOG_LEVEL === 'debug')
    console.error('[DEBUG] getClusterWithRest: Making REST API request to:', url);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[DEBUG] getClusterWithRest: API error:', response.status, errorText);
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const result = (await response.json()) as Cluster;
    if (process.env.LOG_LEVEL === 'debug')
      console.error('[DEBUG] getClusterWithRest: API request successful');
    return result;
  } catch (error) {
    console.error('[DEBUG] getClusterWithRest: Error:', error);
    if (error instanceof Error) {
      throw new Error(`Error getting cluster details with REST API: ${error.message}`);
    }
    throw new Error('Unknown error getting cluster details with REST API');
  }
}

/**
 * Gets details for a specific Dataproc cluster
 * @param projectId GCP project ID
 * @param region Dataproc region
 * @param clusterName Name of the cluster
 * @returns Cluster details
 */
export async function getCluster(
  projectId: string,
  region: string,
  clusterName: string,
  ___impersonateServiceAccount?: string
): Promise<Cluster> {
  if (process.env.LOG_LEVEL === 'debug')
    console.error('[DEBUG] getCluster: Starting with params:', { projectId, region, clusterName });

  try {
    // Use the REST API directly instead of the client library to avoid authentication issues
    if (process.env.LOG_LEVEL === 'debug')
      console.error('[DEBUG] getCluster: Using REST API directly via getClusterWithRest');
    return await getClusterWithRest(projectId, region, clusterName);
  } catch (error) {
    console.error('[DEBUG] getCluster: Error encountered:', error);
    if (error instanceof Error) {
      throw new Error(`Error getting cluster details: ${error.message}`);
    }
    throw new Error('Unknown error getting cluster details');
  }
}

/**
 * Deletes a Dataproc cluster using the REST API directly
 * This bypasses the client libraries and uses a token from gcloud CLI
 * @param projectId GCP project ID
 * @param region Dataproc region
 * @param clusterName Name of the cluster to delete
 * @returns Operation details
 */
export async function deleteClusterWithRest(
  projectId: string,
  region: string,
  clusterName: string
): Promise<Operation> {
  if (process.env.LOG_LEVEL === 'debug')
    console.error('[DEBUG] deleteClusterWithRest: Getting token from gcloud CLI with config');
  const token = await getGcloudAccessTokenWithConfig();

  const url = `https://${region}-dataproc.googleapis.com/v1/projects/${projectId}/regions/${region}/clusters/${clusterName}`;

  if (process.env.LOG_LEVEL === 'debug')
    console.error('[DEBUG] deleteClusterWithRest: Making REST API request to:', url);

  try {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[DEBUG] deleteClusterWithRest: API error:', response.status, errorText);
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const result = (await response.json()) as Operation;
    if (process.env.LOG_LEVEL === 'debug')
      console.error('[DEBUG] deleteClusterWithRest: API request successful');
    return result;
  } catch (error) {
    console.error('[DEBUG] deleteClusterWithRest: Error:', error);
    if (error instanceof Error) {
      throw new Error(`Error deleting cluster with REST API: ${error.message}`);
    }
    throw new Error('Unknown error deleting cluster with REST API');
  }
}

/**
 * Deletes a Dataproc cluster using the fallback service account (fallback for permission issues)
 * @param projectId GCP project ID
 * @param region Dataproc region
 * @param clusterName Name of the cluster to delete
 * @returns Operation details
 */
export async function deleteClusterWithFallback(
  projectId: string,
  region: string,
  clusterName: string
): Promise<Operation> {
  if (process.env.LOG_LEVEL === 'debug')
    console.error(
      '[DEBUG] deleteClusterWithFallback: Using fallback service account for cluster deletion'
    );

  // Import here to avoid circular dependency
  const { getFallbackAccessToken } = await import('../config/credentials.js');
  const token = await getFallbackAccessToken();

  const url = `https://${region}-dataproc.googleapis.com/v1/projects/${projectId}/regions/${region}/clusters/${clusterName}`;

  if (process.env.LOG_LEVEL === 'debug')
    console.error(
      '[DEBUG] deleteClusterWithFallback: Making REST API request with fallback token to:',
      url
    );

  try {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[DEBUG] deleteClusterWithFallback: API error:', response.status, errorText);
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const result = (await response.json()) as Operation;
    if (process.env.LOG_LEVEL === 'debug')
      console.error(
        '[DEBUG] deleteClusterWithFallback: API request successful with fallback account'
      );
    return result;
  } catch (error) {
    console.error('[DEBUG] deleteClusterWithFallback: Error:', error);
    if (error instanceof Error) {
      throw new Error(`Error deleting cluster with fallback: ${error.message}`);
    }
    throw new Error('Unknown error deleting cluster with fallback');
  }
}

/**
 * Deletes a Dataproc cluster
 * @param projectId GCP project ID
 * @param region Dataproc region
 * @param clusterName Name of the cluster to delete
 * @returns Operation details
 */
export async function deleteCluster(
  projectId: string,
  region: string,
  clusterName: string
): Promise<import('@google-cloud/dataproc').protos.google.longrunning.IOperation> {
  if (process.env.LOG_LEVEL === 'debug')
    console.error('[DEBUG] deleteCluster: Starting with params:', {
      projectId,
      region,
      clusterName,
    });

  try {
    // Try with current authentication first
    if (process.env.LOG_LEVEL === 'debug')
      console.error('[DEBUG] deleteCluster: Using REST API directly via deleteClusterWithRest');
    return await deleteClusterWithRest(projectId, region, clusterName);
  } catch (error) {
    console.error('[DEBUG] deleteCluster: Primary deletion failed:', error);

    // Check if this is a permission error for cluster deletion
    if (
      error instanceof Error &&
      (error.message.includes('dataproc.clusters.delete') ||
        error.message.includes('PERMISSION_DENIED') ||
        error.message.includes('403'))
    ) {
      console.error(
        '[DEBUG] deleteCluster: Permission denied detected, attempting MWAA fallback...'
      );

      try {
        // Fallback to configured fallback service account
        console.error(
          '[DEBUG] deleteCluster: Falling back to configured fallback service account for cluster deletion'
        );
        return await deleteClusterWithFallback(projectId, region, clusterName);
      } catch (fallbackError) {
        console.error(
          '[DEBUG] deleteCluster: Fallback service account also failed:',
          fallbackError
        );
        if (fallbackError instanceof Error) {
          throw new Error(
            `Error deleting cluster (both primary and fallback failed): Primary: ${error.message}, Fallback: ${fallbackError.message}`
          );
        }
        throw new Error(
          `Error deleting cluster (both primary and fallback failed): ${error.message}`
        );
      }
    }

    // If not a permission error, throw the original error
    if (error instanceof Error) {
      throw new Error(`Error deleting cluster: ${error.message}`);
    }
    throw new Error('Unknown error deleting cluster');
  }
}
