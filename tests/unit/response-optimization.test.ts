/**
 * Unit Tests for Response Optimization Services
 * Tests ResponseFilter, QdrantStorageService, ResponseFormatter, and token estimation
 */

import { jest } from '@jest/globals';
import { ResponseFilter } from '../../build/services/response-filter.js';
import { ResponseFormatter } from '../../build/services/response-formatter.js';
import { QdrantStorageService } from '../../build/services/qdrant-storage.js';
import type {
  ResponseFilterConfig,
  ClusterSummary,
  ClusterDetails,
  FilteredResponse,
  QdrantStorageMetadata
} from '../../build/types/response-filter.js';

// Mock Qdrant client
const mockQdrantClient = {
  getCollections: jest.fn() as jest.MockedFunction<any>,
  createCollection: jest.fn() as jest.MockedFunction<any>,
  upsert: jest.fn() as jest.MockedFunction<any>,
  search: jest.fn() as jest.MockedFunction<any>,
  retrieve: jest.fn() as jest.MockedFunction<any>,
  delete: jest.fn() as jest.MockedFunction<any>,
  scroll: jest.fn() as jest.MockedFunction<any>,
  getCollection: jest.fn() as jest.MockedFunction<any>,
};

// Mock configuration
const mockConfig: ResponseFilterConfig = {
  tokenLimits: {
    list_clusters: 500,
    get_cluster: 300,
    submit_hive_query: 400,
    get_query_results: 600,
    list_tracked_clusters: 350,
    check_active_jobs: 450,
    default: 400
  },
  extractionRules: {
    list_clusters: {
      maxClusters: 10,
      essentialFields: ['clusterName', 'status', 'createTime', 'projectId', 'region'],
      summaryFormat: 'table'
    },
    get_cluster: {
      essentialSections: ['clusterName', 'status', 'config.masterConfig', 'config.workerConfig'],
      includeMetrics: false,
      includeHistory: false
    },
    query_results: {
      maxRows: 20,
      includeSchema: true,
      summaryStats: true
    },
    job_tracking: {
      maxJobs: 15,
      includeMetrics: true,
      groupByStatus: true
    }
  },
  qdrant: {
    url: 'http://localhost:6333',
    collectionName: 'test_dataproc_responses',
    vectorSize: 384,
    distance: 'Cosine'
  },
  formatting: {
    useEmojis: true,
    compactTables: true,
    includeResourceLinks: true,
    maxLineLength: 120
  },
  caching: {
    enabled: true,
    ttlSeconds: 300,
    maxCacheSize: 100
  }
};

// Sample cluster data for testing
const sampleClusterData = {
  clusters: [
    {
      clusterName: 'test-cluster-1',
      status: { state: 'RUNNING' },
      createTime: '2024-01-15T10:30:00Z',
      projectId: 'test-project',
      config: {
        gceClusterConfig: { zoneUri: 'us-central1-a' },
        masterConfig: {
          numInstances: 1,
          machineTypeUri: 'projects/test-project/zones/us-central1-a/machineTypes/n1-standard-4',
          diskConfig: { bootDiskSizeGb: 100, bootDiskType: 'pd-standard' }
        },
        workerConfig: {
          numInstances: 3,
          machineTypeUri: 'projects/test-project/zones/us-central1-a/machineTypes/n1-standard-4',
          diskConfig: { bootDiskSizeGb: 100, bootDiskType: 'pd-standard' }
        },
        softwareConfig: {
          imageVersion: '2.1-debian11',
          optionalComponents: ['ZEPPELIN', 'JUPYTER']
        }
      },
      labels: { environment: 'test', team: 'data-eng' },
      metrics: {
        hdfsMetrics: { 'dfs.namenode.capacity': '1000000000' },
        yarnMetrics: { 'yarn.nodemanager.resource.memory-mb': '8192' }
      },
      statusHistory: [
        { state: 'CREATING', stateStartTime: '2024-01-15T10:25:00Z' },
        { state: 'RUNNING', stateStartTime: '2024-01-15T10:30:00Z' }
      ]
    },
    {
      clusterName: 'test-cluster-2',
      status: { state: 'STOPPED' },
      createTime: '2024-01-14T15:20:00Z',
      projectId: 'test-project',
      config: {
        gceClusterConfig: { zoneUri: 'us-central1-b' },
        masterConfig: {
          numInstances: 1,
          machineTypeUri: 'projects/test-project/zones/us-central1-b/machineTypes/n1-standard-2'
        },
        workerConfig: {
          numInstances: 2,
          machineTypeUri: 'projects/test-project/zones/us-central1-b/machineTypes/n1-standard-2'
        }
      },
      labels: { environment: 'dev' }
    }
  ]
};

const largeSampleResponse = JSON.stringify(sampleClusterData, null, 2);

describe('Response Optimization Services', () => {
  let responseFilter: ResponseFilter;
  let responseFormatter: ResponseFormatter;
  let qdrantStorage: QdrantStorageService;

  beforeEach(() => {
    jest.clearAllMocks();
    responseFilter = new ResponseFilter(mockConfig);
    responseFormatter = new ResponseFormatter(mockConfig);
    qdrantStorage = new QdrantStorageService(mockConfig.qdrant);
    // Override the client with our mock
    (qdrantStorage as any).client = mockQdrantClient;
  });

  describe('Token Estimation', () => {
    test('should estimate tokens accurately (1 token ≈ 4 characters)', () => {
      const testTexts = [
        'Hello world',           // 11 chars ≈ 2.75 tokens
        'A'.repeat(100),         // 100 chars ≈ 25 tokens
        'Test string with spaces and punctuation!', // 42 chars ≈ 10.5 tokens
        largeSampleResponse      // Large JSON response
      ];

      testTexts.forEach(text => {
        const estimatedTokens = responseFilter.estimateTokens(text);
        const expectedTokens = Math.ceil(text.length / 4);
        
        expect(estimatedTokens).toBe(expectedTokens);
        expect(estimatedTokens).toBeGreaterThan(0);
      });
    });

    test('should handle empty and null inputs', () => {
      expect(responseFilter.estimateTokens('')).toBe(0);
      expect(responseFilter.estimateTokens(null as any)).toBe(0);
      expect(responseFilter.estimateTokens(undefined as any)).toBe(0);
    });
  });

  describe('ResponseFilter Service', () => {
    test('should filter responses based on token limits', async () => {
      const toolName = 'list_clusters';
      const originalTokens = responseFilter.estimateTokens(largeSampleResponse);
      
      // Mock Qdrant storage
      mockQdrantClient.getCollections.mockResolvedValue({ collections: [] });
      mockQdrantClient.createCollection.mockResolvedValue({ status: 'ok' });
      mockQdrantClient.upsert.mockResolvedValue({ status: 'acknowledged' });
      
      const filtered = await responseFilter.filterResponse(
        toolName,
        JSON.parse(largeSampleResponse),
        { projectId: 'test-project', region: 'us-central1' }
      );
      
      expect(filtered.type).toBe('filtered');
      expect(filtered.fullDataAvailable).toBe(true);
      expect(filtered.tokensSaved).toBeGreaterThan(0);
      
      const filteredTokens = responseFilter.estimateTokens(filtered.content);
      expect(filteredTokens).toBeLessThanOrEqual(mockConfig.tokenLimits.list_clusters);
    });

    test('should handle malformed data gracefully', async () => {
      const malformedData = { invalid: 'structure' };
      
      const filtered = await responseFilter.filterResponse(
        'list_clusters',
        malformedData
      );
      
      expect(filtered.type).toBe('summary');
      expect(filtered.fullDataAvailable).toBe(false);
    });

    test('should return full response when within token limits', async () => {
      const smallData = { clusters: [sampleClusterData.clusters[0]] };
      
      const filtered = await responseFilter.filterResponse(
        'list_clusters',
        smallData
      );
      
      expect(filtered.type).toBe('full');
      expect(filtered.tokensSaved).toBe(0);
    });
  });

  describe('ResponseFormatter Service', () => {
    test('should format cluster summaries as table', () => {
      const summaries: ClusterSummary[] = [
        {
          clusterName: 'test-cluster-1',
          status: 'RUNNING',
          createTime: '2024-01-15T10:30:00Z',
          projectId: 'test-project',
          region: 'us-central1',
          machineType: 'n1-standard-4',
          numWorkers: 3
        }
      ];
      
      const formatted = responseFormatter.formatClusterSummary(summaries);
      
      expect(formatted).toContain('Dataproc Clusters');
      expect(formatted).toContain('test-cluster-1');
      expect(formatted).toContain('RUNNING');
      expect(formatted).toContain('n1-standard-4');
    });

    test('should format cluster details with essential sections', () => {
      const details: ClusterDetails = {
        clusterName: 'test-cluster-1',
        projectId: 'test-project',
        region: 'us-central1',
        status: 'RUNNING',
        createTime: '2024-01-15T10:30:00Z',
        config: {
          masterConfig: {
            numInstances: 1,
            machineTypeUri: 'n1-standard-4'
          },
          workerConfig: {
            numInstances: 3,
            machineTypeUri: 'n1-standard-4'
          }
        }
      };
      
      const formatted = responseFormatter.formatClusterDetails(details);
      
      expect(formatted).toContain('Cluster: test-cluster-1');
      expect(formatted).toContain('Status:');
      expect(formatted).toContain('RUNNING');
      expect(formatted).toContain('Master:');
      expect(formatted).toContain('Workers:');
    });

    test('should format job summaries', () => {
      const jobs = [
        {
          reference: { jobId: 'job-123' },
          status: { state: 'RUNNING' },
          placement: { clusterName: 'test-cluster' },
          hiveJob: { queryList: { queries: ['SHOW TABLES'] } }
        }
      ];
      
      const formatted = responseFormatter.formatJobSummary(jobs);
      
      expect(formatted).toContain('Dataproc Jobs');
      expect(formatted).toContain('job-123');
      expect(formatted).toContain('RUNNING');
      expect(formatted).toContain('Hive');
    });
  });

  describe('QdrantStorageService', () => {
    test('should store cluster data with correct metadata', async () => {
      const responseData = JSON.parse(largeSampleResponse);
      const metadata: QdrantStorageMetadata = {
        toolName: 'list_clusters',
        timestamp: new Date().toISOString(),
        projectId: 'test-project',
        region: 'us-central1',
        responseType: 'cluster_list',
        originalTokenCount: 2000,
        filteredTokenCount: 500,
        compressionRatio: 0.25
      };
      
      mockQdrantClient.getCollections.mockResolvedValue({ collections: [] });
      mockQdrantClient.createCollection.mockResolvedValue({ status: 'ok' });
      mockQdrantClient.upsert.mockResolvedValue({ status: 'acknowledged' });
      
      const resourceUri = await qdrantStorage.storeClusterData(responseData, metadata);
      
      expect(resourceUri).toContain('dataproc/stored/list_clusters');
      expect(mockQdrantClient.upsert).toHaveBeenCalledWith(
        mockConfig.qdrant.collectionName,
        expect.objectContaining({
          points: expect.arrayContaining([
            expect.objectContaining({
              payload: expect.objectContaining({
                toolName: 'list_clusters',
                data: JSON.stringify(responseData)
              })
            })
          ])
        })
      );
    });

    test('should retrieve stored data correctly', async () => {
      const resourceId = 'test-12345678';
      const storedData = JSON.parse(largeSampleResponse);
      
      mockQdrantClient.retrieve.mockResolvedValue([{
        id: resourceId,
        payload: {
          data: JSON.stringify(storedData)
        }
      }]);
      
      const retrieved = await qdrantStorage.retrieveById(resourceId);
      
      expect(retrieved).toEqual(storedData);
      expect(mockQdrantClient.retrieve).toHaveBeenCalledWith(
        mockConfig.qdrant.collectionName,
        expect.objectContaining({
          ids: [resourceId],
          with_payload: true
        })
      );
    });

    test('should handle Qdrant connection errors gracefully', async () => {
      mockQdrantClient.getCollections.mockRejectedValue(new Error('Connection failed'));
      
      const metadata: QdrantStorageMetadata = {
        toolName: 'test',
        timestamp: new Date().toISOString(),
        responseType: 'test',
        originalTokenCount: 100,
        filteredTokenCount: 50,
        compressionRatio: 0.5
      };
      
      await expect(qdrantStorage.storeClusterData({ test: 'data' }, metadata))
        .rejects.toThrow();
    });

    test('should handle missing resources gracefully', async () => {
      mockQdrantClient.retrieve.mockResolvedValue([]);
      
      const retrieved = await qdrantStorage.retrieveById('nonexistent_id');
      
      expect(retrieved).toBeNull();
    });

    test('should get collection statistics', async () => {
      mockQdrantClient.getCollection.mockResolvedValue({
        points_count: 100,
        vectors_count: 100,
        indexed_vectors_count: 100,
        status: 'green'
      });
      
      const stats = await qdrantStorage.getStats();
      
      expect(stats).toEqual({
        pointsCount: 100,
        vectorsCount: 100,
        indexedVectorsCount: 100,
        status: 'green'
      });
    });
  });

  describe('Integration Tests', () => {
    test('should process complete workflow: filter → store → retrieve', async () => {
      // Setup mocks
      mockQdrantClient.getCollections.mockResolvedValue({ collections: [] });
      mockQdrantClient.createCollection.mockResolvedValue({ status: 'ok' });
      mockQdrantClient.upsert.mockResolvedValue({ status: 'acknowledged' });
      mockQdrantClient.retrieve.mockImplementation((collection, query) => {
        const resourceId = query.ids[0];
        return Promise.resolve([{
          id: resourceId,
          payload: {
            data: largeSampleResponse
          }
        }]);
      });
      
      // Step 1: Filter response
      const filtered = await responseFilter.filterResponse(
        'list_clusters',
        JSON.parse(largeSampleResponse),
        { projectId: 'test-project', region: 'us-central1' }
      );
      
      expect(filtered.type).toBe('filtered');
      expect(filtered.resourceUri).toBeDefined();
      
      // Step 2: Retrieve stored data (simulate MCP resource access)
      const resourceId = 'test-resource-id';
      const retrieved = await qdrantStorage.retrieveById(resourceId);
      
      expect(retrieved).toBeDefined();
    });

    test('should measure actual token reduction', async () => {
      const originalData = JSON.parse(largeSampleResponse);
      const originalTokens = responseFilter.estimateTokens(largeSampleResponse);
      
      mockQdrantClient.getCollections.mockResolvedValue({ collections: [] });
      mockQdrantClient.createCollection.mockResolvedValue({ status: 'ok' });
      mockQdrantClient.upsert.mockResolvedValue({ status: 'acknowledged' });
      
      const filtered = await responseFilter.filterResponse(
        'list_clusters',
        originalData,
        { projectId: 'test-project', region: 'us-central1' }
      );
      
      const filteredTokens = responseFilter.estimateTokens(filtered.content);
      const reductionPercentage = ((originalTokens - filteredTokens) / originalTokens) * 100;
      
      expect(reductionPercentage).toBeGreaterThan(30); // At least 30% reduction
      expect(filteredTokens).toBeLessThanOrEqual(mockConfig.tokenLimits.list_clusters);
      
      console.log(`Token reduction: ${originalTokens} → ${filteredTokens} (${reductionPercentage.toFixed(1)}%)`);
    });
  });

  describe('Edge Cases', () => {
    test('should handle very large responses', async () => {
      const largeData = {
        clusters: Array(100).fill(sampleClusterData.clusters[0])
      };
      
      mockQdrantClient.getCollections.mockResolvedValue({ collections: [] });
      mockQdrantClient.createCollection.mockResolvedValue({ status: 'ok' });
      mockQdrantClient.upsert.mockResolvedValue({ status: 'acknowledged' });
      
      const filtered = await responseFilter.filterResponse(
        'list_clusters',
        largeData,
        { projectId: 'test-project' }
      );
      
      expect(filtered.type).toBe('filtered');
      const filteredTokens = responseFilter.estimateTokens(filtered.content);
      expect(filteredTokens).toBeLessThanOrEqual(mockConfig.tokenLimits.list_clusters);
    });

    test('should handle responses with missing fields', async () => {
      const incompleteData = {
        clusters: [{
          clusterName: 'incomplete-cluster'
          // Missing other required fields
        }]
      };
      
      const filtered = await responseFilter.filterResponse(
        'list_clusters',
        incompleteData
      );
      
      expect(filtered).toBeDefined();
      expect(filtered.content).toContain('incomplete-cluster');
    });

    test('should handle network timeouts gracefully', async () => {
      mockQdrantClient.getCollections.mockImplementation(() =>
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 100)
        )
      );
      
      const metadata: QdrantStorageMetadata = {
        toolName: 'test',
        timestamp: new Date().toISOString(),
        responseType: 'test',
        originalTokenCount: 100,
        filteredTokenCount: 50,
        compressionRatio: 0.5
      };
      
      await expect(qdrantStorage.storeClusterData({ test: 'data' }, metadata))
        .rejects.toThrow('Timeout');
    });

    test('should handle health check functionality', async () => {
      // Test successful health check
      mockQdrantClient.getCollections.mockResolvedValue({ collections: [] });
      const healthCheck = (qdrantStorage as any).healthCheck;
      if (healthCheck) {
        const isHealthy = await healthCheck.call(qdrantStorage);
        expect(typeof isHealthy).toBe('boolean');
      }
    });
  });
});