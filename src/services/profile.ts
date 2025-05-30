/**
 * Profile Manager service for Dataproc cluster configurations
 * Responsible for discovering and managing cluster configuration profiles
 */

import fs from 'fs/promises';
import path from 'path';
import { readYamlConfig, YamlClusterConfig } from '../config/yaml.js';
import { ProfileInfo, ProfileManagerConfig } from '../types/profile.js';
import { DefaultParameterManager } from './default-params.js';

// Default configuration
const DEFAULT_CONFIG: ProfileManagerConfig = {
  rootConfigPath: './configs',
  profileScanInterval: 300000, // 5 minutes
  defaultParameters: {
    environment: 'production',
    validateParameters: true,
  },
};

/**
 * Profile Manager class for discovering and managing cluster configuration profiles
 */
export class ProfileManager {
  private config: ProfileManagerConfig;
  private profiles: Map<string, ProfileInfo> = new Map();
  private scanInterval?: NodeJS.Timeout;
  private parameterManager?: DefaultParameterManager;

  /**
   * Creates a new ProfileManager instance
   * @param config Configuration for the profile manager
   * @param parameterManager Optional DefaultParameterManager instance
   */
  constructor(config?: Partial<ProfileManagerConfig>, parameterManager?: DefaultParameterManager) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.parameterManager = parameterManager;
  }

  /**
   * Initializes the profile manager
   * Creates the root config directory if it doesn't exist
   * Starts the profile scan interval if configured
   */
  async initialize(): Promise<void> {
    if (process.env.LOG_LEVEL === 'debug') {
      console.error('[DEBUG] ProfileManager: Initializing with config:', this.config);
    }

    try {
      // Create the root config directory if it doesn't exist
      await fs.mkdir(this.config.rootConfigPath, { recursive: true });

      // Scan for profiles
      await this.scanProfiles();

      // Start the profile scan interval if configured
      if (this.config.profileScanInterval) {
        this.scanInterval = setInterval(() => {
          this.scanProfiles().catch((error) => {
            console.error('[ERROR] ProfileManager: Error scanning profiles:', error);
          });
        }, this.config.profileScanInterval);
      }

      if (process.env.LOG_LEVEL === 'debug') {
        console.error('[DEBUG] ProfileManager: Initialization complete');
      }
    } catch (error) {
      console.error('[ERROR] ProfileManager: Initialization error:', error);
      throw error;
    }
  }

  /**
   * Stops the profile manager
   * Clears the profile scan interval
   */
  stop(): void {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = undefined;
    }
  }

  /**
   * Scans for profiles in the root config directory
   * Recursively searches for YAML files and extracts profile information
   */
  async scanProfiles(): Promise<void> {
    if (process.env.LOG_LEVEL === 'debug') {
      console.error(
        '[DEBUG] ProfileManager: Scanning for profiles in:',
        this.config.rootConfigPath
      );
    }

    try {
      // Clear existing profiles
      this.profiles.clear();

      // Recursively scan for profiles
      await this.scanDirectory(this.config.rootConfigPath);

      if (process.env.LOG_LEVEL === 'debug') {
        console.error(`[DEBUG] ProfileManager: Found ${this.profiles.size} profiles`);
      }
    } catch (error) {
      console.error('[ERROR] ProfileManager: Error scanning profiles:', error);
      throw error;
    }
  }

  /**
   * Recursively scans a directory for YAML files
   * @param dirPath Directory path to scan
   * @param relativePath Relative path from the root config directory
   */
  private async scanDirectory(dirPath: string, relativePath: string = ''): Promise<void> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const entryPath = path.join(dirPath, entry.name);
        const entryRelativePath = path.join(relativePath, entry.name);

        if (entry.isDirectory()) {
          // Recursively scan subdirectories
          await this.scanDirectory(entryPath, entryRelativePath);
        } else if (entry.isFile() && entry.name.endsWith('.yaml')) {
          // Process YAML files
          await this.processYamlFile(entryPath, entryRelativePath);
        }
      }
    } catch (error) {
      console.error(`[ERROR] ProfileManager: Error scanning directory ${dirPath}:`, error);
      throw error;
    }
  }

  /**
   * Processes a YAML file and extracts profile information
   * @param filePath Path to the YAML file
   * @param relativePath Relative path from the root config directory
   */
  private async processYamlFile(filePath: string, relativePath: string): Promise<void> {
    try {
      // Read and parse the YAML file
      const yamlConfig = await readYamlConfig(filePath);

      // Extract profile information
      const profileInfo = this.extractProfileInfo(yamlConfig, filePath, relativePath);

      // Validate parameters if enabled
      if (this.config.defaultParameters?.validateParameters && this.parameterManager) {
        this.validateProfileParameters(profileInfo);
      }

      // Add the profile to the map
      this.profiles.set(profileInfo.id, profileInfo);

      if (process.env.LOG_LEVEL === 'debug') {
        console.error(`[DEBUG] ProfileManager: Processed profile: ${profileInfo.id}`);
      }
    } catch (error) {
      console.error(`[ERROR] ProfileManager: Error processing YAML file ${filePath}:`, error);
      // Don't throw, just log the error and continue
    }
  }

  /**
   * Extracts profile information from a YAML configuration
   * @param yamlConfig YAML cluster configuration
   * @param filePath Path to the YAML file
   * @param relativePath Relative path from the root config directory
   * @returns Profile information
   */
  private extractProfileInfo(
    yamlConfig: YamlClusterConfig,
    filePath: string,
    relativePath: string
  ): ProfileInfo {
    // Extract the category from the relative path
    const category = path.dirname(relativePath) !== '.' ? path.dirname(relativePath) : 'default';

    // Generate a unique ID for the profile
    const id =
      category !== 'default'
        ? `${category}/${path.basename(relativePath, '.yaml')}`
        : path.basename(relativePath, '.yaml');

    // Extract metadata from the YAML
    const metadata: Record<string, any> = {};

    let clusterName: string;
    let parameters: Record<string, any> | undefined;

    // Check if it's the traditional format
    if ('cluster' in yamlConfig) {
      // Traditional format
      const traditionalConfig =
        yamlConfig as import('../config/yaml.js').TraditionalYamlClusterConfig;
      clusterName = traditionalConfig.cluster.name;

      // Add description if available
      if (traditionalConfig.cluster.config?.description) {
        metadata.description = traditionalConfig.cluster.config.description;
      }

      // Extract parameters from traditional config
      parameters = traditionalConfig.cluster.parameters;
    } else {
      // Enhanced format
      const projectId = Object.keys(yamlConfig)[0];
      const projectConfig = yamlConfig[projectId];

      // Use the filename without extension as the cluster name
      clusterName = path.basename(filePath, '.yaml') + '-cluster';

      // Add project ID to metadata
      metadata.projectId = projectId;

      // Add tags and labels to metadata if available
      if (projectConfig.tags) {
        metadata.tags = projectConfig.tags;
      }

      if (projectConfig.labels) {
        metadata.labels = projectConfig.labels;
      }

      // Add description if available in either snake_case or camelCase
      const config = projectConfig.cluster_config || projectConfig.clusterConfig;
      if (config?.description) {
        metadata.description = config.description;
      }

      // Extract parameters from enhanced config
      parameters = config?.parameters;
    }

    // Create the profile info
    return {
      id,
      name: clusterName,
      path: filePath,
      category,
      timesUsed: 0,
      metadata,
      parameters,
    };
  }

  /**
   * Validates profile parameters against the parameter manager
   * @param profile Profile to validate
   */
  private validateProfileParameters(profile: ProfileInfo): void {
    if (!this.parameterManager || !profile.parameters) {
      return;
    }

    try {
      // Validate each parameter
      for (const [name, value] of Object.entries(profile.parameters)) {
        const paramDef = this.parameterManager.getParameterDefinition(name);
        if (!paramDef) {
          console.warn(`[WARN] Unknown parameter "${name}" in profile "${profile.id}"`);
          continue;
        }

        // Use the parameter manager's validation
        this.parameterManager.updateEnvironmentParameters(profile.id, { [name]: value });
      }
    } catch (error) {
      console.error(`[ERROR] Parameter validation failed for profile "${profile.id}":`, error);
      throw error;
    }
  }

  /**
   * Gets resolved parameters for a profile
   * @param profileId Profile ID
   * @returns Resolved parameters including defaults and overrides
   */
  getProfileParameters(profileId: string): Record<string, any> {
    const profile = this.profiles.get(profileId);
    if (!profile) {
      throw new Error(`Profile ${profileId} not found`);
    }

    if (!this.parameterManager) {
      return profile.parameters || {};
    }

    // Get default parameters for the configured environment
    const environment = this.config.defaultParameters?.environment;
    const defaults = this.parameterManager.getAllParameters(environment);

    // Merge with profile-specific overrides
    return {
      ...defaults,
      ...profile.parameters,
    };
  }

  /**
   * Gets all profiles
   * @returns Array of profile information
   */
  getAllProfiles(): ProfileInfo[] {
    return Array.from(this.profiles.values());
  }

  /**
   * Gets a profile by ID
   * @param id Profile ID
   * @returns Profile information or undefined if not found
   */
  getProfile(id: string): ProfileInfo | undefined {
    return this.profiles.get(id);
  }

  /**
   * Gets profiles by category
   * @param category Category to filter by
   * @returns Array of profile information
   */
  getProfilesByCategory(category: string): ProfileInfo[] {
    return Array.from(this.profiles.values()).filter((profile) => profile.category === category);
  }

  /**
   * Updates profile usage statistics
   * @param id Profile ID
   */
  updateProfileUsage(id: string): void {
    const profile = this.profiles.get(id);

    if (profile) {
      profile.lastUsed = new Date().toISOString();
      profile.timesUsed += 1;
    }
  }

  /**
   * Imports profiles from a state store
   * @param profiles Map of profile IDs to profile information
   */
  importProfiles(profiles: Record<string, ProfileInfo>): void {
    for (const [id, profile] of Object.entries(profiles)) {
      // Only import usage statistics for existing profiles
      const existingProfile = this.profiles.get(id);

      if (existingProfile) {
        existingProfile.lastUsed = profile.lastUsed;
        existingProfile.timesUsed = profile.timesUsed;
      }
    }
  }

  /**
   * Exports profiles to a state store
   * @returns Map of profile IDs to profile information
   */
  exportProfiles(): Record<string, ProfileInfo> {
    const result: Record<string, ProfileInfo> = {};

    for (const [id, profile] of this.profiles.entries()) {
      result[id] = profile;
    }

    return result;
  }
}
