/**
 * Cluster Tracker service for Dataproc operations
 * Maintains the relationship between running clusters and their configurations
 */

import fs from 'fs/promises';
import path from 'path';
import {
  ClusterTrackingInfo,
  ClusterTrackerConfig,
  ProfileInfo,
  StateStore,
} from '../types/profile.js';

// Default configuration
const DEFAULT_CONFIG: ClusterTrackerConfig = {
  stateFilePath: './state/dataproc-state.json',
  stateSaveInterval: 60000, // 1 minute
};

/**
 * Cluster Tracker class for maintaining relationships between clusters and profiles
 */
export class ClusterTracker {
  private config: ClusterTrackerConfig;
  private clusters: Map<string, ClusterTrackingInfo> = new Map();
  private saveInterval?: NodeJS.Timeout;

  /**
   * Creates a new ClusterTracker instance
   * @param config Configuration for the cluster tracker
   */
  constructor(config?: Partial<ClusterTrackerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initializes the cluster tracker
   * Creates the state directory if it doesn't exist
   * Loads the state from disk
   * Starts the state save interval if configured
   */
  async initialize(): Promise<void> {
    if (process.env.LOG_LEVEL === 'debug')
      console.error('[DEBUG] ClusterTracker: Initializing with config:', this.config);

    try {
      // Create the state directory if it doesn't exist
      await fs.mkdir(path.dirname(this.config.stateFilePath), { recursive: true });

      // Load the state from disk
      await this.loadState();

      // Start the state save interval if configured
      if (this.config.stateSaveInterval) {
        this.saveInterval = setInterval(() => {
          this.saveState().catch((error) => {
            console.error('[ERROR] ClusterTracker: Error saving state:', error);
          });
        }, this.config.stateSaveInterval);
      }

      if (process.env.LOG_LEVEL === 'debug')
        console.error('[DEBUG] ClusterTracker: Initialization complete');
    } catch (error) {
      console.error('[ERROR] ClusterTracker: Initialization error:', error);
      throw error;
    }
  }

  /**
   * Stops the cluster tracker
   * Saves the state to disk
   * Clears the state save interval
   */
  async stop(): Promise<void> {
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
      this.saveInterval = undefined;
    }

    await this.saveState();
  }

  /**
   * Loads the state from disk
   */
  async loadState(): Promise<void> {
    try {
      // Check if the state file exists
      try {
        await fs.access(this.config.stateFilePath);
      } catch (error) {
        // State file doesn't exist, create an empty state
        await this.saveState();
        return;
      }

      // Read the state file
      const stateJson = await fs.readFile(this.config.stateFilePath, 'utf8');
      const state = JSON.parse(stateJson) as StateStore;

      // Import clusters
      this.clusters.clear();
      for (const [clusterId, clusterInfo] of Object.entries(state.clusters || {})) {
        this.clusters.set(clusterId, clusterInfo);
      }

      if (process.env.LOG_LEVEL === 'debug')
        console.error(
          `[DEBUG] ClusterTracker: Loaded ${this.clusters.size} tracked clusters from state`
        );
    } catch (error) {
      console.error('[ERROR] ClusterTracker: Error loading state:', error);
      throw error;
    }
  }

  /**
   * Saves the state to disk
   */
  async saveState(): Promise<void> {
    try {
      // Create the state object
      const state: StateStore = {
        clusters: this.exportClusters(),
        profiles: {}, // Profiles are managed by the ProfileManager
      };

      // Write the state file
      await fs.writeFile(this.config.stateFilePath, JSON.stringify(state, null, 2), 'utf8');

      if (process.env.LOG_LEVEL === 'debug')
        console.error('[DEBUG] ClusterTracker: State saved to disk');
    } catch (error) {
      console.error('[ERROR] ClusterTracker: Error saving state:', error);
      throw error;
    }
  }

  /**
   * Tracks a cluster
   * @param clusterId Cluster ID (UUID)
   * @param clusterName Cluster name
   * @param profileId Optional profile ID
   * @param profilePath Optional profile path
   * @param metadata Optional metadata
   */
  trackCluster(
    clusterId: string,
    clusterName: string,
    profileId?: string,
    profilePath?: string,
    metadata?: Record<string, unknown>
  ): void {
    const trackingInfo: ClusterTrackingInfo = {
      clusterId,
      clusterName,
      profileId,
      profilePath,
      createdAt: new Date().toISOString(),
      metadata,
    };

    this.clusters.set(clusterId, trackingInfo);

    if (process.env.LOG_LEVEL === 'debug')
      console.error(`[DEBUG] ClusterTracker: Tracking cluster ${clusterName} (${clusterId})`);
  }

  /**
   * Tracks a cluster created from a profile
   * @param clusterId Cluster ID (UUID)
   * @param clusterName Cluster name
   * @param profile Profile information
   * @param metadata Optional metadata
   */
  trackClusterFromProfile(
    clusterId: string,
    clusterName: string,
    profile: ProfileInfo,
    metadata?: Record<string, unknown>
  ): void {
    this.trackCluster(clusterId, clusterName, profile.id, profile.path, {
      ...metadata,
      profileName: profile.name,
      profileCategory: profile.category,
    });
  }

  /**
   * Untracks a cluster
   * @param clusterId Cluster ID (UUID)
   */
  untrackCluster(clusterId: string): void {
    const cluster = this.clusters.get(clusterId);

    if (cluster) {
      this.clusters.delete(clusterId);
      if (process.env.LOG_LEVEL === 'debug')
        console.error(
          `[DEBUG] ClusterTracker: Untracked cluster ${cluster.clusterName} (${clusterId})`
        );
    }
  }

  /**
   * Gets all tracked clusters
   * @returns Array of cluster tracking information
   */
  getAllTrackedClusters(): ClusterTrackingInfo[] {
    return Array.from(this.clusters.values());
  }

  /**
   * Gets a tracked cluster by ID
   * @param clusterId Cluster ID (UUID)
   * @returns Cluster tracking information or undefined if not found
   */
  getTrackedCluster(clusterId: string): ClusterTrackingInfo | undefined {
    return this.clusters.get(clusterId);
  }

  /**
   * Gets tracked clusters by profile ID
   * @param profileId Profile ID
   * @returns Array of cluster tracking information
   */
  getTrackedClustersByProfile(profileId: string): ClusterTrackingInfo[] {
    return Array.from(this.clusters.values()).filter((cluster) => cluster.profileId === profileId);
  }

  /**
   * Exports clusters to a state store
   * @returns Map of cluster IDs to cluster tracking information
   */
  exportClusters(): Record<string, ClusterTrackingInfo> {
    const result: Record<string, ClusterTrackingInfo> = {};

    for (const [clusterId, cluster] of this.clusters.entries()) {
      result[clusterId] = cluster;
    }

    return result;
  }

  /**
   * Imports clusters from a state store
   * @param clusters Map of cluster IDs to cluster tracking information
   */
  importClusters(clusters: Record<string, ClusterTrackingInfo>): void {
    for (const [clusterId, cluster] of Object.entries(clusters)) {
      this.clusters.set(clusterId, cluster);
    }
  }
}
