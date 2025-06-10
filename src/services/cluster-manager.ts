/**
 * Cluster Manager service for Dataproc operations
 * Integrates the cluster service with profile management and tracking
 */

import { ClusterConfig } from '../types/cluster-config.js';
import { ClusterInfo, ClusterListResponse } from '../types/response.js';
import { ProfileInfo } from '../types/profile.js';
import { ProfileManager } from './profile.js';
import { ClusterTracker } from './tracker.js';
import { protos } from '@google-cloud/dataproc';
import {
  createCluster,
  createClusterFromYaml,
  deleteCluster,
  getCluster,
  listClusters,
} from './cluster.js';
import { getDataprocConfigFromYaml } from '../config/yaml.js';

/**
 * Cluster Manager class for integrating cluster operations with profile management and tracking
 */
export class ClusterManager {
  private profileManager: ProfileManager;
  private clusterTracker: ClusterTracker;

  /**
   * Creates a new ClusterManager instance
   * @param profileManager Profile manager instance
   * @param clusterTracker Cluster tracker instance
   */
  constructor(profileManager: ProfileManager, clusterTracker: ClusterTracker) {
    this.profileManager = profileManager;
    this.clusterTracker = clusterTracker;
  }

  /**
   * Lists all available cluster profiles
   * @returns Array of profile information
   */
  listProfiles(): ProfileInfo[] {
    return this.profileManager.getAllProfiles();
  }

  /**
   * Gets a profile by ID
   * @param profileId Profile ID
   * @returns Profile information or undefined if not found
   */
  getProfile(profileId: string): ProfileInfo | undefined {
    return this.profileManager.getProfile(profileId);
  }

  /**
   * Gets profiles by category
   * @param category Category to filter by
   * @returns Array of profile information
   */
  getProfilesByCategory(category: string): ProfileInfo[] {
    return this.profileManager.getProfilesByCategory(category);
  }

  /**
   * Creates a cluster from a profile
   * @param projectId GCP project ID
   * @param region Dataproc region
   * @param profileId Profile ID
   * @param clusterNameOverride Optional override for the cluster name
   * @param configOverrides Optional overrides for the cluster configuration
   * @returns Created cluster details
   */
  async createClusterFromProfile(
    projectId: string,
    region: string,
    profileId: string,
    clusterNameOverride?: string,
    configOverrides?: Partial<ClusterConfig>
  ): Promise<import('@google-cloud/dataproc').protos.google.cloud.dataproc.v1.ICluster> {
    if (process.env.LOG_LEVEL === 'debug')
      console.error('[DEBUG] ClusterManager: Creating cluster from profile:', profileId);

    // Get the profile
    const profile = this.profileManager.getProfile(profileId);

    if (!profile) {
      throw new Error(`Profile not found: ${profileId}`);
    }

    // Use the profile's cluster configuration directly (no need to re-read YAML)
    const clusterName = profile.name;
    const config = (profile.clusterConfig as ClusterConfig) || {};
    const labels = profile.labels || {};

    if (process.env.LOG_LEVEL === 'debug') {
      console.error('[DEBUG] ClusterManager: Profile ID:', profile.id);
      console.error('[DEBUG] ClusterManager: Using profile cluster name:', clusterName);
      console.error(
        '[DEBUG] ClusterManager: Using profile config:',
        JSON.stringify(config, null, 2)
      );
      console.error(
        '[DEBUG] ClusterManager: Using profile labels:',
        JSON.stringify(labels, null, 2)
      );
    }

    // Apply overrides
    const finalClusterName = clusterNameOverride || clusterName;
    const finalConfig: ClusterConfig = configOverrides ? { ...config, ...configOverrides } : config;

    // Add labels to the config so they get passed to the API
    // labels are passed as a separate argument to createCluster

    if (process.env.LOG_LEVEL === 'debug') {
      console.error('[DEBUG] ClusterManager: Final cluster name:', finalClusterName);
      console.error('[DEBUG] ClusterManager: Final config:', JSON.stringify(finalConfig, null, 2));
    }

    // Create the cluster
    const response = await createCluster(
      projectId,
      region,
      finalClusterName,
      finalConfig,
      undefined,
      undefined,
      labels
    );

    // Update profile usage
    this.profileManager.updateProfileUsage(profileId);

    // Track the cluster
    if (response && response.clusterUuid) {
      this.clusterTracker.trackClusterFromProfile(response.clusterUuid, finalClusterName, profile, {
        projectId,
        region,
        createdAt: new Date().toISOString(),
      });
    }

    return response;
  }

  /**
   * Creates a cluster from a YAML file and tracks it
   * @param projectId GCP project ID
   * @param region Dataproc region
   * @param yamlPath Path to the YAML configuration file
   * @param overrides Optional runtime configuration overrides
   * @returns Created cluster details
   */
  async createAndTrackClusterFromYaml(
    projectId: string,
    region: string,
    yamlPath: string,
    overrides?: Partial<ClusterConfig>
  ): Promise<import('@google-cloud/dataproc').protos.google.cloud.dataproc.v1.ICluster> {
    if (process.env.LOG_LEVEL === 'debug')
      console.error('[DEBUG] ClusterManager: Creating cluster from YAML:', yamlPath);

    // Read the YAML configuration
    const { clusterName } = await getDataprocConfigFromYaml(yamlPath);

    // Create the cluster
    const response = await createClusterFromYaml(projectId, region, yamlPath, overrides);

    // Track the cluster
    if (response && response.clusterUuid) {
      this.clusterTracker.trackCluster(
        response.clusterUuid,
        clusterName,
        undefined, // No profile ID
        yamlPath, // But we do have the YAML path
        {
          projectId,
          region,
          createdAt: new Date().toISOString(),
        }
      );
    }

    return response;
  }

  /**
   * Lists clusters with tracking information
   * @param projectId GCP project ID
   * @param region Dataproc region
   * @param filter Optional filter string
   * @param pageSize Optional page size
   * @param pageToken Optional page token for pagination
   * @returns List of clusters with tracking information
   */
  async listClustersWithTracking(
    projectId: string,
    region: string,
    filter?: string,
    pageSize?: number,
    pageToken?: string
  ): Promise<ClusterListResponse> {
    if (process.env.LOG_LEVEL === 'debug')
      console.error('[DEBUG] ClusterManager: Listing clusters with tracking info');

    // Get clusters from Dataproc
    const response = await listClusters(projectId, region, filter, pageSize, pageToken);

    // Get all tracked clusters
    const trackedClusters = this.clusterTracker.getAllTrackedClusters();

    // Add tracking information to the clusters
    const enhancedClusters: ClusterInfo[] = (response.clusters || []).map(
      (cluster: protos.google.cloud.dataproc.v1.ICluster) => {
        const trackedCluster = trackedClusters.find((tc) => tc.clusterId === cluster.clusterUuid);

        // Map ICluster to ClusterInfo, extracting createTime from status
        const clusterInfo: ClusterInfo = {
          projectId: cluster.projectId || '',
          clusterName: cluster.clusterName || '',
          status: (cluster.status?.state || 'UNKNOWN') as string,
          createTime: cluster.status?.stateStartTime?.toString() || '', // Convert ITimestamp to string
          labels: cluster.labels || {},
          metrics: {
            hdfsMetrics: cluster.metrics?.hdfsMetrics
              ? Object.fromEntries(
                  Object.entries(cluster.metrics.hdfsMetrics).map(([k, v]) => [k, String(v)])
                )
              : undefined,
            yarnMetrics: cluster.metrics?.yarnMetrics
              ? Object.fromEntries(
                  Object.entries(cluster.metrics.yarnMetrics).map(([k, v]) => [k, String(v)])
                )
              : undefined,
          },
          statusHistory: (cluster.statusHistory || []).map((history) => ({
            state: (history.state || 'UNKNOWN') as string,
            stateStartTime: history.stateStartTime?.toString() || '',
            detail: history.detail || undefined,
            substate: (history.substate || undefined) as string | undefined,
          })),
          clusterUuid: cluster.clusterUuid || '',
        };

        if (trackedCluster) {
          // Add tracking information to the cluster
          return {
            ...clusterInfo,
            labels: {
              ...clusterInfo.labels,
              trackedByMcp: 'true',
              profileId: trackedCluster.profileId || 'none',
            },
            // Add tracking metadata to the cluster
            metadata: {
              trackedByMcp: true,
              profileId: trackedCluster.profileId,
              profilePath: trackedCluster.profilePath,
              createdAt: trackedCluster.createdAt,
              ...trackedCluster.metadata,
            },
          };
        }

        return clusterInfo;
      }
    );

    return {
      clusters: enhancedClusters,
      nextPageToken: response.nextPageToken as string | undefined,
    };
  }

  /**
   * Gets cluster details with tracking information
   * @param projectId GCP project ID
   * @param region Dataproc region
   * @param clusterName Cluster name
   * @returns Cluster details with tracking information
   */
  async getClusterWithTracking(
    projectId: string,
    region: string,
    clusterName: string
  ): Promise<
    import('@google-cloud/dataproc').protos.google.cloud.dataproc.v1.ICluster | undefined
  > {
    if (process.env.LOG_LEVEL === 'debug')
      console.error('[DEBUG] ClusterManager: Getting cluster with tracking info:', clusterName);

    // Get cluster details from Dataproc
    const cluster = await getCluster(projectId, region, clusterName);

    if (!cluster || !cluster.clusterUuid) {
      return cluster;
    }

    // Get tracked cluster
    const trackedCluster = this.clusterTracker.getTrackedCluster(cluster.clusterUuid);

    if (trackedCluster) {
      // Add tracking information to the cluster
      return {
        ...cluster,
        labels: {
          ...cluster.labels,
          trackedByMcp: 'true',
          profileId: trackedCluster.profileId || 'none',
        },
        // Add tracking metadata to the cluster (not part of ICluster)
        metadata: {
          trackedByMcp: true,
          profileId: trackedCluster.profileId,
          profilePath: trackedCluster.profilePath,
          createdAt: trackedCluster.createdAt,
          ...trackedCluster.metadata,
        },
      } as object;
    }

    return cluster;
  }

  /**
   * Lists all tracked clusters
   * @returns Array of tracked clusters
   */
  listTrackedClusters() {
    return this.clusterTracker.getAllTrackedClusters();
  }

  /**
   * Gets tracked clusters by profile
   * @param profileId Profile ID
   * @returns Array of tracked clusters
   */
  getTrackedClustersByProfile(profileId: string) {
    return this.clusterTracker.getTrackedClustersByProfile(profileId);
  }

  /**
   * Deletes a cluster and removes it from tracking
   * @param projectId GCP project ID
   * @param region Dataproc region
   * @param clusterName Cluster name
   * @returns Operation details
   */
  async deleteCluster(
    projectId: string,
    region: string,
    clusterName: string
  ): Promise<import('@google-cloud/dataproc').protos.google.longrunning.IOperation> {
    if (process.env.LOG_LEVEL === 'debug')
      console.error('[DEBUG] ClusterManager: Deleting cluster:', clusterName);

    try {
      // Get cluster details first to get the UUID
      const cluster = await getCluster(projectId, region, clusterName);

      // Delete the cluster
      const response = await deleteCluster(projectId, region, clusterName);

      // If the cluster has a UUID and is tracked, untrack it
      if (cluster && cluster.clusterUuid) {
        const trackedCluster = this.clusterTracker.getTrackedCluster(cluster.clusterUuid);

        if (trackedCluster) {
          this.clusterTracker.untrackCluster(cluster.clusterUuid);
          if (process.env.LOG_LEVEL === 'debug')
            console.error(
              `[DEBUG] ClusterManager: Untracked cluster ${clusterName} (${cluster.clusterUuid})`
            );
        }
      }

      return response;
    } catch (error) {
      console.error('[DEBUG] ClusterManager: Error deleting cluster:', error);
      throw error;
    }
  }
}
