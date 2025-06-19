/**
 * Initialization Manager
 *
 * Handles the complex initialization sequence for all MCP server components.
 * Extracted from index.ts to improve maintainability and reduce file size.
 */

// Global type declaration for Node.js global object
declare global {
  // eslint-disable-next-line no-var
  var DATAPROC_CONFIG_DIR: string;
}

import { logger } from '../utils/logger.js';
import { DefaultParameterManager } from './default-params.js';
import { ProfileManager } from './profile.js';
import { ClusterTracker } from './tracker.js';
import { ClusterManager } from './cluster-manager.js';
import { JobTracker } from './job-tracker.js';
import { JobOutputHandler } from './job-output-handler.js';
import { AsyncQueryPoller } from './async-query-poller.js';
import { ResponseFilter } from './response-filter.js';
import { QdrantManager } from './qdrant-manager.js';
import { SemanticQueryService } from './semantic-query.js';
import { KnowledgeIndexer } from './knowledge-indexer.js';
import { MockDataLoader } from './mock-data-loader.js'; // Only used for testing
import { getStartupStatus } from './startup-status.js';
import { getConfigFilePath, logConfigPathDiagnostics } from '../utils/config-path-resolver.js';
import * as fs from 'fs';

export interface InitializedServices {
  profileManager: ProfileManager;
  clusterTracker: ClusterTracker;
  clusterManager: ClusterManager;
  jobTracker: JobTracker;
  jobOutputHandler: JobOutputHandler;
  asyncQueryPoller: AsyncQueryPoller;
  defaultParamManager?: DefaultParameterManager;
  responseFilter?: ResponseFilter;
  qdrantManager?: QdrantManager;
  semanticQueryService?: SemanticQueryService;
  knowledgeIndexer?: KnowledgeIndexer;
}

export class InitializationManager {
  private services: Partial<InitializedServices> = {};

  /**
   * Initialize default parameter manager
   */
  async initializeDefaultParams(): Promise<DefaultParameterManager | undefined> {
    try {
      // Use centralized configuration path resolution
      const defaultParamsPath = getConfigFilePath('default-params.json');

      if (process.env.LOG_LEVEL === 'debug') {
        logConfigPathDiagnostics('InitializationManager.DefaultParams');
      }

      if (fs.existsSync(defaultParamsPath)) {
        const defaultParamsConfig = JSON.parse(fs.readFileSync(defaultParamsPath, 'utf8'));
        this.services.defaultParamManager = new DefaultParameterManager(defaultParamsConfig);
        logger.info(`✅ [INIT] Default parameters loaded from: ${defaultParamsPath}`);
        return this.services.defaultParamManager;
      } else {
        logger.info(`ℹ️ [INIT] No default parameters file found at: ${defaultParamsPath}`);
      }
    } catch (error) {
      logger.warn('⚠️ [INIT] Could not load default parameters:', error);
    }
    return undefined;
  }

  /**
   * Initialize core services (always required)
   */
  async initializeCoreServices(): Promise<void> {
    try {
      // Initialize profile manager with server configuration
      const { getServerConfig } = await import('../config/server.js');
      const serverConfig = await getServerConfig();
      this.services.profileManager = new ProfileManager(serverConfig.profileManager);
      await this.services.profileManager.initialize();

      // Initialize cluster tracker
      this.services.clusterTracker = new ClusterTracker();

      // Initialize cluster manager (requires profile manager and tracker)
      this.services.clusterManager = new ClusterManager(
        this.services.profileManager!,
        this.services.clusterTracker!
      );

      // Initialize job tracker
      this.services.jobTracker = new JobTracker();

      // Initialize job output handler
      this.services.jobOutputHandler = new JobOutputHandler();

      // Initialize async query poller (requires job tracker)
      this.services.asyncQueryPoller = new AsyncQueryPoller(this.services.jobTracker!);

      logger.info('✅ [INIT] Core services initialized');
    } catch (error) {
      logger.error('❌ [INIT] Failed to initialize core services:', error);
      throw error;
    }
  }

  /**
   * Initialize response optimization services (Qdrant-dependent)
   */
  async initializeResponseOptimization(): Promise<void> {
    const startupStatus = getStartupStatus();

    try {
      // STEP 1: Discover the working Qdrant URL FIRST - NO FALLBACKS
      const { QdrantConnectionManager } = await import('./qdrant-connection-manager.js');
      const connectionManager = QdrantConnectionManager.getInstance();

      const discoveredQdrantUrl = await connectionManager.discoverQdrantUrl();
      if (!discoveredQdrantUrl) {
        throw new Error('No working Qdrant instance found. Please start Qdrant first.');
      }

      logger.info(`🎯 [GLOBAL-QDRANT] Using verified URL for ALL services: ${discoveredQdrantUrl}`);

      // Use centralized configuration path resolution for response filter
      const responseFilterConfigPath = getConfigFilePath('response-filter.json');

      if (process.env.LOG_LEVEL === 'debug') {
        logConfigPathDiagnostics('InitializationManager.ResponseOptimization');
      }

      if (fs.existsSync(responseFilterConfigPath)) {
        const responseFilterConfig = JSON.parse(fs.readFileSync(responseFilterConfigPath, 'utf8'));

        // Initialize ResponseFilter
        await this.initializeResponseFilter(responseFilterConfig, startupStatus);

        // Initialize SemanticQueryService
        await this.initializeSemanticQuery(discoveredQdrantUrl, startupStatus);

        // Initialize KnowledgeIndexer
        await this.initializeKnowledgeIndexer(discoveredQdrantUrl, startupStatus);

        // Perform health check to update Qdrant connection status
        await startupStatus.performHealthCheck();
      } else {
        this.markServicesAsFailed(startupStatus, 'Configuration file not found');
      }
    } catch (error) {
      this.markServicesAsFailed(startupStatus, `Initialization error: ${error}`);
    }
  }

  /**
   * Initialize Response Filter
   */
  private async initializeResponseFilter(config: any, startupStatus: any): Promise<void> {
    try {
      this.services.responseFilter = new ResponseFilter(config);
      startupStatus.updateComponent('Response Filter', {
        status: 'OPERATIONAL',
        details: 'Configuration loaded',
      });
    } catch (error) {
      startupStatus.updateComponent('Response Filter', {
        status: 'FAILED',
        error: `Failed to initialize: ${error}`,
      });
    }
  }

  /**
   * Initialize Semantic Query Service
   */
  private async initializeSemanticQuery(
    discoveredQdrantUrl: string,
    startupStatus: any
  ): Promise<void> {
    try {
      startupStatus.updateComponent('Semantic Query', {
        status: 'INITIALIZING',
        details: 'Connecting to Qdrant...',
      });

      this.services.semanticQueryService = new SemanticQueryService({
        url: discoveredQdrantUrl,
        collectionName: 'dataproc_knowledge',
        vectorSize: 384,
        distance: 'Cosine',
      });
      await this.services.semanticQueryService.initialize();

      startupStatus.updateComponent('Semantic Query', {
        status: 'OPERATIONAL',
        details: 'Ready for natural language queries',
      });
    } catch (error) {
      startupStatus.updateComponent('Semantic Query', {
        status: 'FAILED',
        error: `Initialization failed: ${error}`,
      });
    }
  }

  /**
   * Initialize Knowledge Indexer with mock data support
   */
  private async initializeKnowledgeIndexer(
    discoveredQdrantUrl: string,
    startupStatus: any
  ): Promise<void> {
    try {
      startupStatus.updateComponent('Knowledge Indexer', {
        status: 'INITIALIZING',
        details: 'Setting up collection...',
      });

      this.services.knowledgeIndexer = new KnowledgeIndexer();

      await this.services.knowledgeIndexer.initialize({
        url: discoveredQdrantUrl,
        collectionName: 'dataproc_knowledge', // Main collection for real data
        vectorSize: 384,
        distance: 'Cosine',
      });

      // Main collection ready for real data
      startupStatus.updateComponent('Knowledge Indexer', {
        status: 'OPERATIONAL',
        details: 'Collection ready for real data',
      });

      // Set KnowledgeIndexer on AsyncQueryPoller for auto-indexing
      if (this.services.asyncQueryPoller) {
        this.services.asyncQueryPoller.setKnowledgeIndexer(this.services.knowledgeIndexer);
        logger.info('🔗 AsyncQueryPoller: KnowledgeIndexer integration enabled for auto-indexing');
      }
    } catch (error) {
      startupStatus.updateComponent('Knowledge Indexer', {
        status: 'FAILED',
        error: `Collection setup failed: ${error}`,
      });
    }
  }

  /**
   * Create test collection with mock data (for testing purposes only)
   * This method is available for test files but not used in main initialization
   */
  async createTestCollectionWithMockData(discoveredQdrantUrl: string): Promise<KnowledgeIndexer> {
    logger.info('🧪 [TEST-COLLECTION] Creating test collection for testing...');

    const testKnowledgeIndexer = new KnowledgeIndexer();
    await testKnowledgeIndexer.initialize({
      url: discoveredQdrantUrl,
      collectionName: 'dataproc_example_test',
      vectorSize: 384,
      distance: 'Cosine',
    });

    const testMockDataLoader = new MockDataLoader(testKnowledgeIndexer);
    await testMockDataLoader.loadMockData();

    logger.info('🧪 [TEST-COLLECTION] Test collection ready with mock data');

    return testKnowledgeIndexer;
  }

  /**
   * Mark services as failed when configuration is missing
   */
  private markServicesAsFailed(startupStatus: any, reason: string): void {
    startupStatus.updateComponent('Response Filter', {
      status: 'FAILED',
      error: reason,
      details: reason.includes('Configuration') ? 'Create config/response-filter.json' : undefined,
    });
    startupStatus.updateComponent('Semantic Query', {
      status: 'FAILED',
      error: reason,
    });
    startupStatus.updateComponent('Knowledge Indexer', {
      status: 'FAILED',
      error: reason,
    });
  }

  /**
   * Get all initialized services
   */
  getServices(): InitializedServices {
    return this.services as InitializedServices;
  }

  /**
   * Get a specific service
   */
  getService<K extends keyof InitializedServices>(
    serviceName: K
  ): InitializedServices[K] | undefined {
    return this.services[serviceName];
  }
}
