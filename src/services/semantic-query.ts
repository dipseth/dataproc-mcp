/**
 * Semantic Query Service for Qdrant-stored cluster data
 * 
 * Enables natural language queries against stored cluster configurations
 * without requiring verbose responses.
 */

import { QdrantStorageService } from './qdrant-storage.js';
import { logger } from '../utils/logger.js';

export interface SemanticQueryResult {
  clusterId: string;
  clusterName: string;
  projectId: string;
  region: string;
  matchedContent: string;
  confidence: number;
  extractedInfo: any;
}

export interface QueryResponse {
  query: string;
  results: SemanticQueryResult[];
  totalFound: number;
  processingTime: number;
}

export class SemanticQueryService {
  private qdrantService: QdrantStorageService;

  constructor(qdrantConfig?: {
    url?: string;
    collectionName?: string;
    vectorSize?: number;
    distance?: 'Cosine' | 'Euclidean' | 'Dot';
  }) {
    const config = {
      url: qdrantConfig?.url || 'http://localhost:6333',
      collectionName: qdrantConfig?.collectionName || 'dataproc_responses',
      vectorSize: qdrantConfig?.vectorSize || 384,
      distance: qdrantConfig?.distance || 'Cosine' as const
    };
    
    this.qdrantService = new QdrantStorageService(config);
  }

  async initialize(): Promise<void> {
    // QdrantStorageService initializes collection automatically when needed
    // No explicit initialization required
  }

  /**
   * Query stored cluster data using natural language
   */
  async queryClusterData(query: string, options: {
    limit?: number;
    projectId?: string;
    region?: string;
    clusterName?: string;
  } = {}): Promise<QueryResponse> {
    const startTime = Date.now();
    
    try {
      // Search for relevant stored data
      const searchResults = await this.qdrantService.searchSimilar(query, options.limit || 5);
      
      // Filter by project/region/cluster if specified
      const filteredResults = this.filterResults(searchResults, options);
      
      // Extract relevant information based on query type
      const processedResults = await this.processQueryResults(query, filteredResults);
      
      return {
        query,
        results: processedResults,
        totalFound: processedResults.length,
        processingTime: Date.now() - startTime
      };
    } catch (error) {
      logger.error('Semantic query failed:', error);
      return {
        query,
        results: [],
        totalFound: 0,
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Specialized query for pip packages
   */
  async queryPipPackages(options: {
    projectId?: string;
    region?: string;
    clusterName?: string;
  } = {}): Promise<QueryResponse> {
    return this.queryClusterData('pip packages python dependencies dataproc:pip.packages', {
      ...options,
      limit: 10
    });
  }

  /**
   * Specialized query for machine types and hardware configuration
   */
  async queryHardwareConfig(options: {
    projectId?: string;
    region?: string;
    clusterName?: string;
  } = {}): Promise<QueryResponse> {
    return this.queryClusterData('machine type hardware configuration cpu memory disk', {
      ...options,
      limit: 10
    });
  }

  /**
   * Specialized query for network and security configuration
   */
  async queryNetworkConfig(options: {
    projectId?: string;
    region?: string;
    clusterName?: string;
  } = {}): Promise<QueryResponse> {
    return this.queryClusterData('network subnet security firewall vpc', {
      ...options,
      limit: 10
    });
  }

  /**
   * Specialized query for software and initialization actions
   */
  async querySoftwareConfig(options: {
    projectId?: string;
    region?: string;
    clusterName?: string;
  } = {}): Promise<QueryResponse> {
    return this.queryClusterData('software initialization actions scripts properties', {
      ...options,
      limit: 10
    });
  }

  private filterResults(results: any[], options: {
    projectId?: string;
    region?: string;
    clusterName?: string;
  }): any[] {
    return results.filter(result => {
      const metadata = result.metadata || {};
      
      if (options.projectId && metadata.projectId !== options.projectId) {
        return false;
      }
      
      if (options.region && metadata.region !== options.region) {
        return false;
      }
      
      if (options.clusterName && metadata.clusterName !== options.clusterName) {
        return false;
      }
      
      return true;
    });
  }

  private async processQueryResults(query: string, results: any[]): Promise<SemanticQueryResult[]> {
    const processedResults: SemanticQueryResult[] = [];
    
    for (const result of results) {
      try {
        const metadata = result.metadata || {};
        const data = result.data || {};
        
        // Extract relevant information based on query type
        const extractedInfo = this.extractRelevantInfo(query, data);
        
        processedResults.push({
          clusterId: metadata.clusterId || 'unknown',
          clusterName: metadata.clusterName || 'unknown',
          projectId: metadata.projectId || 'unknown',
          region: metadata.region || 'unknown',
          matchedContent: this.getMatchedContent(query, data),
          confidence: result.score || 0,
          extractedInfo
        });
      } catch (error) {
        logger.warn('Failed to process query result:', error);
      }
    }
    
    return processedResults.sort((a, b) => b.confidence - a.confidence);
  }

  private extractRelevantInfo(query: string, data: any): any {
    const lowerQuery = query.toLowerCase();
    
    // Pip packages extraction
    if (lowerQuery.includes('pip') || lowerQuery.includes('package') || lowerQuery.includes('python')) {
      return this.extractPipPackages(data);
    }
    
    // Machine type extraction
    if (lowerQuery.includes('machine') || lowerQuery.includes('hardware') || lowerQuery.includes('cpu')) {
      return this.extractMachineConfig(data);
    }
    
    // Network configuration extraction
    if (lowerQuery.includes('network') || lowerQuery.includes('subnet') || lowerQuery.includes('vpc')) {
      return this.extractNetworkConfig(data);
    }
    
    // Software configuration extraction
    if (lowerQuery.includes('software') || lowerQuery.includes('initialization') || lowerQuery.includes('script')) {
      return this.extractSoftwareConfig(data);
    }
    
    // Default: return summary
    return this.extractSummary(data);
  }

  private extractPipPackages(data: any): any {
    try {
      const pipPackages = data?.config?.softwareConfig?.properties?.['dataproc:pip.packages'];
      if (pipPackages) {
        const packages = pipPackages.split(',').map((pkg: string) => pkg.trim());
        return {
          type: 'pip_packages',
          packages,
          count: packages.length,
          rawValue: pipPackages
        };
      }
    } catch (error) {
      logger.warn('Failed to extract pip packages:', error);
    }
    return { type: 'pip_packages', packages: [], count: 0 };
  }

  private extractMachineConfig(data: any): any {
    try {
      const config = data?.config;
      return {
        type: 'machine_config',
        master: {
          instances: config?.masterConfig?.numInstances,
          machineType: this.extractMachineType(config?.masterConfig?.machineTypeUri),
          diskSize: config?.masterConfig?.diskConfig?.bootDiskSizeGb,
          diskType: config?.masterConfig?.diskConfig?.bootDiskType
        },
        workers: {
          instances: config?.workerConfig?.numInstances,
          machineType: this.extractMachineType(config?.workerConfig?.machineTypeUri),
          diskSize: config?.workerConfig?.diskConfig?.bootDiskSizeGb,
          diskType: config?.workerConfig?.diskConfig?.bootDiskType
        },
        secondaryWorkers: config?.secondaryWorkerConfig ? {
          instances: config.secondaryWorkerConfig.numInstances,
          machineType: this.extractMachineType(config.secondaryWorkerConfig.machineTypeUri),
          preemptible: config.secondaryWorkerConfig.isPreemptible
        } : null
      };
    } catch (error) {
      logger.warn('Failed to extract machine config:', error);
    }
    return { type: 'machine_config' };
  }

  private extractNetworkConfig(data: any): any {
    try {
      const gceConfig = data?.config?.gceClusterConfig;
      return {
        type: 'network_config',
        zone: gceConfig?.zoneUri,
        subnet: gceConfig?.subnetworkUri,
        internalIpOnly: gceConfig?.internalIpOnly,
        serviceAccount: gceConfig?.serviceAccount,
        tags: gceConfig?.tags || [],
        shieldedInstance: gceConfig?.shieldedInstanceConfig
      };
    } catch (error) {
      logger.warn('Failed to extract network config:', error);
    }
    return { type: 'network_config' };
  }

  private extractSoftwareConfig(data: any): any {
    try {
      const softwareConfig = data?.config?.softwareConfig;
      const initActions = data?.config?.initializationActions || [];
      
      return {
        type: 'software_config',
        imageVersion: softwareConfig?.imageVersion,
        optionalComponents: softwareConfig?.optionalComponents || [],
        initializationActions: initActions.map((action: any) => ({
          script: action.executableFile,
          timeout: action.executionTimeout
        })),
        keyProperties: this.extractKeyProperties(softwareConfig?.properties || {})
      };
    } catch (error) {
      logger.warn('Failed to extract software config:', error);
    }
    return { type: 'software_config' };
  }

  private extractSummary(data: any): any {
    try {
      return {
        type: 'cluster_summary',
        name: data?.clusterName,
        status: data?.status?.state,
        created: data?.status?.stateStartTime,
        workers: data?.config?.workerConfig?.numInstances,
        machineType: this.extractMachineType(data?.config?.workerConfig?.machineTypeUri)
      };
    } catch (error) {
      logger.warn('Failed to extract summary:', error);
    }
    return { type: 'cluster_summary' };
  }

  private extractMachineType(machineTypeUri: string): string {
    if (!machineTypeUri) return 'unknown';
    const parts = machineTypeUri.split('/');
    return parts[parts.length - 1] || 'unknown';
  }

  private extractKeyProperties(properties: Record<string, string>): Record<string, string> {
    const keyProps: Record<string, string> = {};
    
    // Extract important properties
    const importantKeys = [
      'dataproc:pip.packages',
      'spark:spark.executor.memory',
      'spark:spark.executor.cores',
      'yarn:yarn.nodemanager.resource.memory-mb',
      'yarn:yarn.nodemanager.resource.cpu-vcores'
    ];
    
    for (const key of importantKeys) {
      if (properties[key]) {
        keyProps[key] = properties[key];
      }
    }
    
    return keyProps;
  }

  private getMatchedContent(query: string, data: any): string {
    // Return a snippet of the matched content for context
    try {
      const dataStr = JSON.stringify(data, null, 2);
      const lowerQuery = query.toLowerCase();
      const lowerData = dataStr.toLowerCase();
      
      // Find the position of query terms in the data
      const queryTerms = lowerQuery.split(' ').filter(term => term.length > 2);
      let bestMatch = '';
      let bestScore = 0;
      
      for (const term of queryTerms) {
        const index = lowerData.indexOf(term);
        if (index !== -1) {
          const start = Math.max(0, index - 100);
          const end = Math.min(dataStr.length, index + 200);
          const snippet = dataStr.substring(start, end);
          
          if (snippet.length > bestMatch.length) {
            bestMatch = snippet;
            bestScore++;
          }
        }
      }
      
      return bestMatch || dataStr.substring(0, 200) + '...';
    } catch (error) {
      return 'Content extraction failed';
    }
  }
}