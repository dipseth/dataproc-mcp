/**
 * QdrantConnectionManager
 *
 * Centralized Qdrant connection management with auto-discovery.
 * Solves the port configuration mismatch issue by providing a single
 * source of truth for Qdrant connectivity across all services.
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import { logger } from '../utils/logger.js';

export interface QdrantConnectionConfig {
  url?: string;
  ports?: number[];
  connectionTimeout?: number;
  retryAttempts?: number;
}

export class QdrantConnectionManager {
  private static instance: QdrantConnectionManager;
  private discoveredUrl: string | null = null;
  private connectionTested = false;
  private config: Required<QdrantConnectionConfig>;

  private constructor(config: QdrantConnectionConfig = {}) {
    this.config = {
      url: config.url || process.env.QDRANT_URL || '',
      ports: config.ports || [6333, 6335, 6334], // Priority order based on discovery
      connectionTimeout: config.connectionTimeout || 5000,
      retryAttempts: config.retryAttempts || 3,
    };
  }

  static getInstance(config?: QdrantConnectionConfig): QdrantConnectionManager {
    if (!QdrantConnectionManager.instance) {
      QdrantConnectionManager.instance = new QdrantConnectionManager(config);
    }
    return QdrantConnectionManager.instance;
  }

  /**
   * Discover and return working Qdrant URL
   */
  async discoverQdrantUrl(): Promise<string | null> {
    if (this.connectionTested && this.discoveredUrl) {
      return this.discoveredUrl;
    }

    // Try explicit URL first (environment variable or config)
    if (this.config.url && this.config.url !== '') {
      if (await this.testConnection(this.config.url)) {
        this.discoveredUrl = this.config.url;
        this.connectionTested = true;
        logger.info(`✅ [QDRANT-DISCOVERY] Connected via configured URL: ${this.config.url}`);
        await this.logQdrantInfo(this.config.url);
        return this.discoveredUrl;
      }
    }

    // Auto-discover by trying ports in priority order
    for (const port of this.config.ports) {
      const url = `http://localhost:${port}`;
      if (await this.testConnection(url)) {
        this.discoveredUrl = url;
        this.connectionTested = true;
        logger.info(
          `✅ [QDRANT-DISCOVERY] SUCCESS! Auto-discovered working Qdrant on port ${port}`
        );
        await this.logQdrantInfo(url);
        return this.discoveredUrl;
      }
    }

    this.connectionTested = true;
    logger.debug('❌ [QDRANT-DISCOVERY] No working Qdrant instance found on any configured port');
    return null;
  }

  /**
   * Get the discovered Qdrant URL (cached result)
   */
  getQdrantUrl(): string | null {
    return this.discoveredUrl;
  }

  /**
   * Test if Qdrant is accessible at given URL
   */
  private async testConnection(url: string): Promise<boolean> {
    try {
      const client = new QdrantClient({ url });

      // Test basic connectivity with timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Connection timeout')), this.config.connectionTimeout);
      });

      const connectPromise = client.getCollections();

      await Promise.race([connectPromise, timeoutPromise]);
      return true;
    } catch (error) {
      logger.debug(`Qdrant connection test failed for ${url}: ${error}`);
      return false;
    }
  }

  /**
   * Reset connection state (for testing or reconfiguration)
   */
  reset(): void {
    this.discoveredUrl = null;
    this.connectionTested = false;
  }

  /**
   * Get connection statistics
   */
  getConnectionInfo(): {
    url: string | null;
    tested: boolean;
    configuredPorts: number[];
  } {
    return {
      url: this.discoveredUrl,
      tested: this.connectionTested,
      configuredPorts: this.config.ports,
    };
  }

  /**
   * Log comprehensive Qdrant information including dashboard URLs and data locations
   */
  private async logQdrantInfo(url: string): Promise<void> {
    try {
      const { QdrantClient } = await import('@qdrant/js-client-rest');
      const client = new QdrantClient({ url });

      // Get collections and log dashboard URLs
      const collections = await client.getCollections();

      logger.info('🎯 [QDRANT-INFO] ═══════════════════════════════════════════════════════════');
      logger.info(`🎯 [QDRANT-INFO] Qdrant Instance: ${url}`);
      logger.info(`🎯 [QDRANT-INFO] Dashboard URL: ${this.getDashboardUrl(url)}`);
      logger.info(`🎯 [QDRANT-INFO] Data Location: ${this.getDataLocation(url)}`);
      logger.info('🎯 [QDRANT-INFO] ═══════════════════════════════════════════════════════════');

      if (collections.collections && collections.collections.length > 0) {
        logger.info('📊 [QDRANT-COLLECTIONS] Available Collections:');
        collections.collections.forEach((col) => {
          const dashboardCollectionUrl = `${this.getDashboardUrl(url)}#/collections/${col.name}`;
          logger.info(`   📁 ${col.name}`);
          logger.info(`      🌐 Dashboard: ${dashboardCollectionUrl}`);
        });

        // Highlight specific collections we care about
        const knowledgeCol = collections.collections.find((c) => c.name === 'dataproc_knowledge');
        const queryResultsCol = collections.collections.find(
          (c) => c.name === 'dataproc_query_results'
        );
        const exampleTestCol = collections.collections.find(
          (c) => c.name === 'dataproc_example_test'
        );

        logger.info('🎯 [QDRANT-COLLECTIONS] Key Collections Status:');
        if (knowledgeCol) {
          logger.info(
            `   ✅ dataproc_knowledge (MAIN): ${this.getDashboardUrl(url)}#/collections/dataproc_knowledge`
          );
        } else {
          logger.info('   ⚠️  dataproc_knowledge (MAIN): Not found (will be created on first use)');
        }

        if (queryResultsCol) {
          logger.info(
            `   ✅ dataproc_query_results: ${this.getDashboardUrl(url)}#/collections/dataproc_query_results`
          );
        } else {
          logger.info('   ⚠️  dataproc_query_results: Not found (will be created on first use)');
        }

        if (exampleTestCol) {
          logger.info(
            `   ✅ dataproc_example_test (TEST): ${this.getDashboardUrl(url)}#/collections/dataproc_example_test`
          );
        } else {
          logger.info(
            '   ⚠️  dataproc_example_test (TEST): Not found (will be created with mock data)'
          );
        }
      } else {
        logger.info('📊 [QDRANT-COLLECTIONS] No collections found - will be created as needed');
      }

      logger.info('🎯 [QDRANT-INFO] ═══════════════════════════════════════════════════════════');
    } catch (error) {
      logger.error('❌ [QDRANT-INFO] Failed to retrieve Qdrant information:', error);
    }
  }

  /**
   * Get dashboard URL for the Qdrant instance
   */
  private getDashboardUrl(url: string): string {
    // Extract port from URL and construct dashboard URL
    const urlObj = new URL(url);
    return `http://localhost:${urlObj.port}/dashboard`;
  }

  /**
   * Get data location information
   */
  private getDataLocation(url: string): string {
    const urlObj = new URL(url);
    const port = urlObj.port;

    // Check if this looks like a Docker setup
    if (port === '6333') {
      return 'Docker volume: qdrant_storage (if using docker-compose) or local path if native install';
    } else if (port === '6334' || port === '6335') {
      return `Local Qdrant instance on port ${port} - check Qdrant config for data directory`;
    } else {
      return `Custom Qdrant instance on port ${port} - check instance configuration`;
    }
  }
}

/**
 * Convenience function to get Qdrant URL for services
 */
export async function getQdrantUrl(config?: QdrantConnectionConfig): Promise<string | null> {
  const manager = QdrantConnectionManager.getInstance(config);
  return await manager.discoverQdrantUrl();
}

/**
 * Convenience function to get cached Qdrant URL (no discovery)
 */
export function getCachedQdrantUrl(): string | null {
  const manager = QdrantConnectionManager.getInstance();
  return manager.getQdrantUrl();
}
