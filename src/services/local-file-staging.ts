/**
 * Local File Staging Service for automatic file upload to GCS
 * Handles detection, staging, and transformation of job configurations
 */

import { GCSService } from './gcs.js';
import { DefaultParameterManager } from './default-params.js';
import { logger } from '../utils/logger.js';
import path from 'path';

export interface StagingConfig {
  baseDirectory: string;
  stagingBucket?: string;
  cleanupPolicy: 'immediate' | 'after-job' | 'scheduled';
  fileNamePrefix: string;
}

export interface StagedFile {
  localPath: string;
  gcsUri: string;
  uploadedAt: Date;
  jobId?: string;
}

export class LocalFileStagingService {
  private gcsService: GCSService;
  private defaultParamManager?: DefaultParameterManager;
  private stagedFiles: Map<string, StagedFile> = new Map();

  // File patterns that indicate local files
  private static readonly LOCAL_FILE_PATTERNS = [
    /^\/[^/].*\.(py|jar|sql|R)$/, // Absolute paths
    /^\.\/.*\.(py|jar|sql|R)$/, // Relative paths starting with ./
    /^[^/gs:].*\.(py|jar|sql|R)$/, // Simple filenames (no path separators, not GCS URIs)
    /\{@([^}]+)\}/g, // Template syntax {@local_file_path}
  ];

  constructor(defaultParamManager?: DefaultParameterManager) {
    this.gcsService = new GCSService();
    this.defaultParamManager = defaultParamManager;
  }

  /**
   * Detect local file paths in job configuration
   * @param jobConfig Job configuration object
   * @returns Array of detected local file paths
   */
  detectLocalFiles(jobConfig: any): string[] {
    const localFiles: string[] = [];

    // Recursively search through the job config
    const searchObject = (obj: any, path: string = ''): void => {
      if (typeof obj === 'string') {
        // Check for template syntax first
        const templateMatches = obj.match(/\{@([^}]+)\}/g);
        if (templateMatches) {
          templateMatches.forEach((match) => {
            const filePath = match.slice(2, -1); // Remove {@ and }
            localFiles.push(filePath);
            logger.debug(
              `LocalFileStagingService: Found template file path: ${filePath} at ${path}`
            );
          });
          return;
        }

        // Check for direct local file patterns
        for (const pattern of LocalFileStagingService.LOCAL_FILE_PATTERNS) {
          if (pattern.test(obj) && !obj.startsWith('gs://')) {
            localFiles.push(obj);
            logger.debug(`LocalFileStagingService: Found local file path: ${obj} at ${path}`);
            break;
          }
        }
      } else if (Array.isArray(obj)) {
        obj.forEach((item, index) => searchObject(item, `${path}[${index}]`));
      } else if (obj && typeof obj === 'object') {
        Object.keys(obj).forEach((key) => searchObject(obj[key], `${path}.${key}`));
      }
    };

    searchObject(jobConfig);

    // Remove duplicates
    return [...new Set(localFiles)];
  }

  /**
   * Resolve file path relative to base directory
   * @param filePath File path to resolve
   * @returns Absolute file path
   */
  private resolveFilePath(filePath: string): string {
    // If already absolute, return as-is
    if (path.isAbsolute(filePath)) {
      return filePath;
    }

    // Get base directory from config or default
    let baseDirectory: string;
    try {
      baseDirectory =
        (this.defaultParamManager?.getParameterValue('baseDirectory') as string) || '.';
    } catch {
      baseDirectory = '.';
    }

    // If baseDirectory is relative, resolve it relative to the config directory
    if (!path.isAbsolute(baseDirectory)) {
      // Get the config directory from environment variable
      const configPath = process.env.DATAPROC_CONFIG_PATH;
      if (configPath) {
        const configDir = path.dirname(configPath);
        baseDirectory = path.resolve(configDir, baseDirectory);
      } else {
        // Fallback to current working directory
        baseDirectory = path.resolve(process.cwd(), baseDirectory);
      }
    }

    return path.resolve(baseDirectory, filePath);
  }

  /**
   * Generate unique GCS path for staged file
   * @param localPath Local file path
   * @param stagingBucket Staging bucket name
   * @returns GCS URI for staged file
   */
  private generateStagedPath(localPath: string, stagingBucket: string): string {
    const fileName = path.basename(localPath);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const uniqueFileName = `mcp-staging-${timestamp}-${fileName}`;
    return `gs://${stagingBucket}/mcp-staging/${uniqueFileName}`;
  }

  /**
   * Stage files to GCS and return mapping
   * @param localPaths Array of local file paths
   * @param clusterName Optional cluster name to get staging bucket from
   * @returns Promise that resolves to mapping of local path -> GCS URI
   */
  async stageFiles(localPaths: string[], clusterName?: string): Promise<Map<string, string>> {
    const fileMapping = new Map<string, string>();

    if (localPaths.length === 0) {
      return fileMapping;
    }

    logger.debug(`LocalFileStagingService: Staging ${localPaths.length} files`);

    // Get staging bucket
    let stagingBucket: string;

    // Try to get from configuration first
    let configuredBucket: string | undefined;
    try {
      configuredBucket = this.defaultParamManager?.getParameterValue('stagingBucket') as string;
    } catch {
      configuredBucket = undefined;
    }

    if (configuredBucket) {
      stagingBucket = configuredBucket;
      logger.debug(`LocalFileStagingService: Using configured staging bucket: ${stagingBucket}`);
    } else if (clusterName) {
      // Try to discover from cluster
      let projectId: string | undefined;
      let region: string | undefined;

      try {
        projectId = this.defaultParamManager?.getParameterValue('projectId') as string;
        region = this.defaultParamManager?.getParameterValue('region') as string;
      } catch {
        // Parameters not available
      }

      if (projectId && region) {
        try {
          stagingBucket = await this.gcsService.discoverStagingBucketFromCluster(
            projectId,
            region,
            clusterName
          );
          logger.debug(
            `LocalFileStagingService: Discovered staging bucket from cluster: ${stagingBucket}`
          );
        } catch (error) {
          logger.warn(
            `LocalFileStagingService: Failed to discover staging bucket from cluster: ${error}`
          );
          stagingBucket = `${projectId}-dataproc-staging`;
        }
      } else {
        throw new Error('Missing projectId or region for staging bucket discovery');
      }
    } else {
      throw new Error('No staging bucket configured and no cluster name provided for discovery');
    }

    // Stage each file
    for (const localPath of localPaths) {
      try {
        const resolvedPath = this.resolveFilePath(localPath);
        const gcsUri = this.generateStagedPath(resolvedPath, stagingBucket);

        logger.debug(`LocalFileStagingService: Staging ${resolvedPath} -> ${gcsUri}`);

        await this.gcsService.uploadFile(resolvedPath, gcsUri);

        // Track the staged file
        const stagedFile: StagedFile = {
          localPath: resolvedPath,
          gcsUri,
          uploadedAt: new Date(),
        };
        this.stagedFiles.set(localPath, stagedFile);
        fileMapping.set(localPath, gcsUri);

        logger.debug(`LocalFileStagingService: Successfully staged ${resolvedPath} to ${gcsUri}`);
      } catch (error) {
        logger.error(`LocalFileStagingService: Failed to stage file ${localPath}:`, error);
        throw new Error(
          `Failed to stage file ${localPath}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    return fileMapping;
  }

  /**
   * Transform job config with GCS URIs
   * @param jobConfig Original job configuration
   * @param fileMapping Mapping of local paths to GCS URIs
   * @returns Transformed job configuration
   */
  transformJobConfig(jobConfig: any, fileMapping: Map<string, string>): any {
    // Deep clone the job config to avoid modifying the original
    const transformedConfig = JSON.parse(JSON.stringify(jobConfig));

    // Recursively transform the config
    const transformObject = (obj: any): any => {
      if (typeof obj === 'string') {
        // Handle template syntax
        let transformed = obj;
        for (const [localPath, gcsUri] of fileMapping.entries()) {
          // Replace template syntax
          const templatePattern = `{@${localPath}}`;
          if (transformed.includes(templatePattern)) {
            transformed = transformed.replace(templatePattern, gcsUri);
            logger.debug(
              `LocalFileStagingService: Transformed template ${templatePattern} -> ${gcsUri}`
            );
          }

          // Replace direct file paths
          if (transformed === localPath) {
            transformed = gcsUri;
            logger.debug(
              `LocalFileStagingService: Transformed direct path ${localPath} -> ${gcsUri}`
            );
          }
        }
        return transformed;
      } else if (Array.isArray(obj)) {
        return obj.map((item) => transformObject(item));
      } else if (obj && typeof obj === 'object') {
        const result: any = {};
        for (const [key, value] of Object.entries(obj)) {
          result[key] = transformObject(value);
        }
        return result;
      }
      return obj;
    };

    return transformObject(transformedConfig);
  }

  /**
   * Cleanup staged files for a job
   * @param jobId Job ID to cleanup files for
   */
  async cleanupStagedFiles(jobId: string): Promise<void> {
    logger.debug(`LocalFileStagingService: Cleaning up staged files for job ${jobId}`);

    // For now, just remove from tracking
    // In a production implementation, you might want to actually delete the files from GCS
    for (const [localPath, stagedFile] of this.stagedFiles.entries()) {
      if (stagedFile.jobId === jobId) {
        this.stagedFiles.delete(localPath);
        logger.debug(`LocalFileStagingService: Removed tracking for ${localPath}`);
      }
    }
  }

  /**
   * Get all staged files
   * @returns Map of staged files
   */
  getStagedFiles(): Map<string, StagedFile> {
    return new Map(this.stagedFiles);
  }
}
