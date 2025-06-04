/**
 * Startup Status Service
 *
 * Provides clean, actionable status reporting for MCP integration components.
 * Replaces cluttered debug messages with a single, clear summary.
 */

import { QdrantConnectionManager } from './qdrant-connection-manager.js';

export interface ComponentStatus {
  name: string;
  status: 'OPERATIONAL' | 'DEGRADED' | 'FAILED' | 'INITIALIZING';
  url?: string;
  details?: string;
  error?: string;
}

export interface IntegrationStatus {
  overall: 'FULLY_OPERATIONAL' | 'PARTIALLY_OPERATIONAL' | 'DEGRADED' | 'FAILED';
  components: ComponentStatus[];
  readyForQueries: boolean;
  nextSteps?: string[];
}

export class StartupStatusService {
  private static instance: StartupStatusService;
  private components: Map<string, ComponentStatus> = new Map();
  private statusReported = false;

  private constructor() {}

  static getInstance(): StartupStatusService {
    if (!StartupStatusService.instance) {
      StartupStatusService.instance = new StartupStatusService();
    }
    return StartupStatusService.instance;
  }

  /**
   * Update component status
   */
  updateComponent(name: string, status: Omit<ComponentStatus, 'name'>): void {
    this.components.set(name, { name, ...status });
  }

  /**
   * Get current integration status
   */
  getIntegrationStatus(): IntegrationStatus {
    const components = Array.from(this.components.values());

    // Determine overall status
    const operationalCount = components.filter((c) => c.status === 'OPERATIONAL').length;
    const failedCount = components.filter((c) => c.status === 'FAILED').length;
    const degradedCount = components.filter((c) => c.status === 'DEGRADED').length;

    let overall: IntegrationStatus['overall'];
    if (failedCount === components.length) {
      overall = 'FAILED';
    } else if (operationalCount === components.length) {
      overall = 'FULLY_OPERATIONAL';
    } else if (failedCount > 0 || degradedCount > 0) {
      overall = 'PARTIALLY_OPERATIONAL';
    } else {
      overall = 'DEGRADED';
    }

    // Check if ready for queries (Qdrant + KnowledgeIndexer + SemanticQuery)
    const qdrant = this.components.get('Qdrant Connection');
    const indexer = this.components.get('Knowledge Indexer');
    const semantic = this.components.get('Semantic Query');

    const readyForQueries =
      qdrant?.status === 'OPERATIONAL' &&
      indexer?.status === 'OPERATIONAL' &&
      semantic?.status === 'OPERATIONAL';

    // Generate next steps if needed
    const nextSteps: string[] = [];
    if (!readyForQueries) {
      if (qdrant?.status !== 'OPERATIONAL') {
        nextSteps.push('Start Qdrant: docker run -p 6333:6333 qdrant/qdrant');
      }
      if (indexer?.status !== 'OPERATIONAL') {
        nextSteps.push('Check knowledge indexer configuration');
      }
      if (semantic?.status !== 'OPERATIONAL') {
        nextSteps.push('Verify semantic query service initialization');
      }
    }

    return {
      overall,
      components,
      readyForQueries,
      nextSteps: nextSteps.length > 0 ? nextSteps : undefined,
    };
  }

  /**
   * Display clean startup summary (only once)
   */
  displayStartupSummary(): void {
    if (this.statusReported) return;

    const status = this.getIntegrationStatus();

    console.log('\n==========================================');
    console.log('🚀 MCP DATAPROC SERVER - INTEGRATION STATUS');
    console.log('==========================================');

    // Display component status
    status.components.forEach((component) => {
      const icon = this.getStatusIcon(component.status);
      const url = component.url ? ` (${component.url})` : '';
      const details = component.details ? ` - ${component.details}` : '';
      console.log(`${icon} ${component.name}:${url}${details}`);

      if (component.error) {
        console.log(`   ⚠️  ${component.error}`);
      }
    });

    console.log('');

    // Overall status
    const overallIcon = this.getOverallStatusIcon(status.overall);
    console.log(`${overallIcon} Integration Status: ${status.overall.replace('_', ' ')}`);

    // Query readiness
    if (status.readyForQueries) {
      console.log('📊 Ready to process query_knowledge requests');
    } else {
      console.log('⚠️  Query functionality limited - see next steps below');
    }

    // Next steps if needed
    if (status.nextSteps && status.nextSteps.length > 0) {
      console.log('\n🔧 Next Steps:');
      status.nextSteps.forEach((step, index) => {
        console.log(`   ${index + 1}. ${step}`);
      });
    }

    console.log('==========================================\n');

    this.statusReported = true;
  }

  /**
   * Force re-display of status (for testing)
   */
  forceDisplayStatus(): void {
    this.statusReported = false;
    this.displayStartupSummary();
  }

  /**
   * Get status icon for component
   */
  private getStatusIcon(status: ComponentStatus['status']): string {
    switch (status) {
      case 'OPERATIONAL':
        return '✅';
      case 'DEGRADED':
        return '⚠️';
      case 'FAILED':
        return '❌';
      case 'INITIALIZING':
        return '🔄';
      default:
        return '❓';
    }
  }

  /**
   * Get overall status icon
   */
  private getOverallStatusIcon(status: IntegrationStatus['overall']): string {
    switch (status) {
      case 'FULLY_OPERATIONAL':
        return '✅';
      case 'PARTIALLY_OPERATIONAL':
        return '⚠️';
      case 'DEGRADED':
        return '⚠️';
      case 'FAILED':
        return '❌';
      default:
        return '❓';
    }
  }

  /**
   * Perform integration health check
   */
  async performHealthCheck(): Promise<IntegrationStatus> {
    // Update Qdrant status
    try {
      const connectionManager = QdrantConnectionManager.getInstance();
      const qdrantUrl = await connectionManager.discoverQdrantUrl();

      if (qdrantUrl) {
        this.updateComponent('Qdrant Connection', {
          status: 'OPERATIONAL',
          url: qdrantUrl,
          details: 'Connected and responsive',
        });
      } else {
        this.updateComponent('Qdrant Connection', {
          status: 'FAILED',
          details: 'No working instance found',
          error: 'Try: docker run -p 6333:6333 qdrant/qdrant',
        });
      }
    } catch (error) {
      this.updateComponent('Qdrant Connection', {
        status: 'FAILED',
        error: `Connection failed: ${error}`,
      });
    }

    return this.getIntegrationStatus();
  }

  /**
   * Reset status for testing
   */
  reset(): void {
    this.components.clear();
    this.statusReported = false;
  }
}

/**
 * Convenience function to get startup status service
 */
export function getStartupStatus(): StartupStatusService {
  return StartupStatusService.getInstance();
}
