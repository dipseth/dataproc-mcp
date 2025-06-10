/**
 * Type definitions for cluster profile management
 */

/**
 * Represents a cluster configuration profile
 */
export interface ProfileInfo {
  /**
   * Unique identifier for the profile (e.g., "dev/small")
   */
  id: string;

  /**
   * Human-readable name for the profile
   */
  name: string;

  /**
   * Path to the YAML configuration file
   */
  path: string;

  /**
   * Category of the profile (e.g., "development", "production")
   */
  category: string;

  /**
   * When the profile was last used to create a cluster
   */
  lastUsed?: string;

  /**
   * Number of times the profile has been used
   */
  timesUsed: number;

  /**
   * Additional metadata for the profile
   */
  metadata?: Record<string, unknown>;

  /**
   * Profile-specific parameter overrides
   */
  parameters?: Record<string, unknown>;

  /**
   * Full cluster configuration from the YAML file
   */
  clusterConfig?: Record<string, unknown>;

  /**
   * Region specified in the profile
   */
  region?: string;

  /**
   * Labels from the profile
   */
  labels?: Record<string, string>;
}

/**
 * Represents a tracked cluster and its relationship to a profile
 */
export interface ClusterTrackingInfo {
  /**
   * Unique identifier for the cluster (UUID)
   */
  clusterId: string;

  /**
   * Name of the cluster
   */
  clusterName: string;

  /**
   * ID of the profile used to create the cluster
   */
  profileId?: string;

  /**
   * Path to the profile YAML used to create the cluster
   */
  profilePath?: string;

  /**
   * When the cluster was created
   */
  createdAt: string;

  /**
   * Additional metadata for the tracked cluster
   */
  metadata?: Record<string, unknown>;
}

/**
 * State store for profiles and tracked clusters
 */
export interface StateStore {
  /**
   * Map of cluster IDs to tracking info
   */
  clusters: Record<string, ClusterTrackingInfo>;

  /**
   * Map of profile IDs to profile info
   */
  profiles: Record<string, ProfileInfo>;
}

/**
 * Configuration for the profile manager
 */
export interface ProfileManagerConfig {
  /**
   * Root directory for cluster configuration profiles
   */
  rootConfigPath: string;

  /**
   * How often to scan for profile changes (milliseconds)
   */
  profileScanInterval?: number;

  /**
   * Default parameter configuration
   */
  defaultParameters?: {
    /**
     * Environment to use for parameter resolution
     */
    environment?: string;

    /**
     * Whether to validate parameters against definitions
     */
    validateParameters?: boolean;
  };
}

/**
 * Configuration for the cluster tracker
 */
export interface ClusterTrackerConfig {
  /**
   * Location of the state persistence file
   */
  stateFilePath: string;

  /**
   * How often to save state to disk (milliseconds)
   */
  stateSaveInterval?: number;
}
