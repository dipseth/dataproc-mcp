/**
 * Mock Data Loader Service
 *
 * Provides realistic sample data for testing and demonstration of the MCP integration.
 * Loads automatically during development/testing mode to populate Qdrant collections
 * with meaningful data that showcases both query_knowledge and get_query_results functionality.
 */

import { KnowledgeIndexer } from './knowledge-indexer.js';
import { logger } from '../utils/logger.js';

export interface MockJobData {
  jobId: string;
  jobType: 'hive' | 'spark' | 'pyspark' | 'presto';
  clusterName: string;
  projectId: string;
  region: string;
  query: string;
  status: string;
  submissionTime: string;
  duration?: number;
  results?: {
    schema?: {
      fields: Array<{ name: string; type: string }>;
    };
    rows: unknown[][];
    totalRows?: number;
  };
  error?: {
    errorType: string;
    errorMessage: string;
    stackTrace?: string;
  };
}

export interface MockClusterData {
  clusterName: string;
  projectId: string;
  region: string;
  config?: {
    masterConfig?: {
      machineTypeUri?: string;
      numInstances?: number;
    };
    workerConfig?: {
      machineTypeUri?: string;
      numInstances?: number;
    };
    softwareConfig?: {
      imageVersion?: string;
      properties?: Record<string, string>;
      optionalComponents?: string[];
    };
    initializationActions?: Array<{
      executableFile?: string;
      executionTimeout?: string;
    }>;
  };
  labels?: Record<string, string>;
  status?: {
    state?: string;
    stateStartTime?: string;
  };
  [key: string]: unknown; // Index signature to match ClusterData interface
}

export class MockDataLoader {
  private knowledgeIndexer: KnowledgeIndexer;

  constructor(knowledgeIndexer: KnowledgeIndexer) {
    this.knowledgeIndexer = knowledgeIndexer;
  }

  /**
   * Load all mock data into the knowledge base
   */
  async loadMockData(): Promise<void> {
    try {
      logger.info('🎭 [MOCK-DATA] Loading sample data for testing and demonstration...');

      // Load mock clusters first
      const mockClusters = this.generateMockClusters();
      for (const cluster of mockClusters) {
        await this.knowledgeIndexer.indexClusterConfiguration(cluster);
      }

      // Load mock jobs with realistic query results
      const mockJobs = this.generateMockJobs();
      for (const job of mockJobs) {
        await this.knowledgeIndexer.indexJobSubmission({
          jobId: job.jobId,
          jobType: job.jobType,
          clusterName: job.clusterName,
          projectId: job.projectId,
          region: job.region,
          query: job.query,
          status: job.status,
          submissionTime: job.submissionTime,
          duration: job.duration,
          results: job.results,
          error: job.error,
        });
      }

      logger.info(
        `🎭 [MOCK-DATA] Successfully loaded ${mockClusters.length} clusters and ${mockJobs.length} jobs`
      );
      logger.info(
        '🎭 [MOCK-DATA] Try queries like: "machine learning clusters", "failed jobs", "sales data analysis"'
      );
    } catch (error) {
      logger.error('🎭 [MOCK-DATA] Failed to load mock data:', error);
    }
  }

  /**
   * Generate realistic mock cluster configurations
   */
  private generateMockClusters(): MockClusterData[] {
    const baseTime = new Date('2024-12-01T10:00:00Z');

    return [
      {
        clusterName: 'ml-training-cluster',
        projectId: 'data-science-prod',
        region: 'us-central1',
        config: {
          masterConfig: {
            machineTypeUri:
              'projects/data-science-prod/zones/us-central1-b/machineTypes/n1-standard-4',
            numInstances: 1,
          },
          workerConfig: {
            machineTypeUri:
              'projects/data-science-prod/zones/us-central1-b/machineTypes/n1-highmem-8',
            numInstances: 4,
          },
          softwareConfig: {
            imageVersion: '2.1-debian11',
            optionalComponents: ['JUPYTER', 'ANACONDA'],
            properties: {
              'spark:spark.sql.adaptive.enabled': 'true',
              'spark:spark.sql.adaptive.coalescePartitions.enabled': 'true',
            },
          },
          initializationActions: [
            {
              executableFile: 'gs://data-science-prod/scripts/install-ml-packages.sh',
              executionTimeout: '300s',
            },
          ],
        },
        labels: {
          environment: 'production',
          team: 'data-science',
          purpose: 'machine-learning',
        },
        status: {
          state: 'RUNNING',
          stateStartTime: new Date(baseTime.getTime() + 1000 * 60 * 30).toISOString(),
        },
      },
      {
        clusterName: 'analytics-cluster',
        projectId: 'business-analytics',
        region: 'us-east1',
        config: {
          masterConfig: {
            machineTypeUri:
              'projects/business-analytics/zones/us-east1-c/machineTypes/n1-standard-2',
            numInstances: 1,
          },
          workerConfig: {
            machineTypeUri:
              'projects/business-analytics/zones/us-east1-c/machineTypes/n1-standard-4',
            numInstances: 3,
          },
          softwareConfig: {
            imageVersion: '2.0-debian10',
            optionalComponents: ['HIVE_WEBHCAT', 'PRESTO'],
          },
        },
        labels: {
          environment: 'production',
          team: 'business-intelligence',
          purpose: 'analytics',
        },
        status: {
          state: 'RUNNING',
          stateStartTime: new Date(baseTime.getTime() + 1000 * 60 * 45).toISOString(),
        },
      },
      {
        clusterName: 'dev-testing-cluster',
        projectId: 'development-sandbox',
        region: 'us-west2',
        config: {
          masterConfig: {
            machineTypeUri:
              'projects/development-sandbox/zones/us-west2-a/machineTypes/n1-standard-1',
            numInstances: 1,
          },
          workerConfig: {
            machineTypeUri:
              'projects/development-sandbox/zones/us-west2-a/machineTypes/n1-standard-2',
            numInstances: 2,
          },
          softwareConfig: {
            imageVersion: '2.1-debian11',
            optionalComponents: ['ZEPPELIN'],
          },
        },
        labels: {
          environment: 'development',
          team: 'engineering',
          purpose: 'testing',
        },
        status: {
          state: 'RUNNING',
          stateStartTime: new Date(baseTime.getTime() + 1000 * 60 * 60).toISOString(),
        },
      },
    ];
  }

  /**
   * Generate realistic mock job data with query results
   */
  private generateMockJobs(): MockJobData[] {
    const baseTime = new Date('2024-12-01T10:00:00Z');

    return [
      {
        jobId: 'job-ml-feature-extraction-001',
        jobType: 'hive',
        clusterName: 'ml-training-cluster',
        projectId: 'data-science-prod',
        region: 'us-central1',
        query:
          'SELECT customer_id, AVG(purchase_amount) as avg_purchase, COUNT(*) as total_orders FROM sales_data WHERE purchase_date >= "2024-01-01" GROUP BY customer_id ORDER BY avg_purchase DESC LIMIT 100',
        status: 'DONE',
        submissionTime: new Date(baseTime.getTime() + 1000 * 60 * 35).toISOString(),
        duration: 45000,
        results: {
          schema: {
            fields: [
              { name: 'customer_id', type: 'STRING' },
              { name: 'avg_purchase', type: 'DOUBLE' },
              { name: 'total_orders', type: 'BIGINT' },
            ],
          },
          rows: [
            ['CUST_001', 1250.75, 15],
            ['CUST_002', 980.5, 12],
            ['CUST_003', 875.25, 8],
            ['CUST_004', 750.0, 10],
            ['CUST_005', 650.8, 6],
          ],
          totalRows: 100,
        },
      },
      {
        jobId: 'job-sales-analysis-002',
        jobType: 'hive',
        clusterName: 'analytics-cluster',
        projectId: 'business-analytics',
        region: 'us-east1',
        query:
          'SELECT product_category, SUM(revenue) as total_revenue, COUNT(DISTINCT customer_id) as unique_customers FROM sales_fact sf JOIN product_dim pd ON sf.product_id = pd.product_id WHERE sale_date BETWEEN "2024-11-01" AND "2024-11-30" GROUP BY product_category ORDER BY total_revenue DESC',
        status: 'DONE',
        submissionTime: new Date(baseTime.getTime() + 1000 * 60 * 50).toISOString(),
        duration: 32000,
        results: {
          schema: {
            fields: [
              { name: 'product_category', type: 'STRING' },
              { name: 'total_revenue', type: 'DOUBLE' },
              { name: 'unique_customers', type: 'BIGINT' },
            ],
          },
          rows: [
            ['Electronics', 125000.5, 450],
            ['Clothing', 89000.25, 320],
            ['Home & Garden', 67500.75, 280],
            ['Books', 45000.0, 150],
            ['Sports', 38000.8, 200],
          ],
          totalRows: 5,
        },
      },
      {
        jobId: 'job-spark-processing-003',
        jobType: 'spark',
        clusterName: 'ml-training-cluster',
        projectId: 'data-science-prod',
        region: 'us-central1',
        query:
          'spark.sql("SELECT user_id, session_duration, page_views FROM user_sessions WHERE session_date >= current_date() - 7").write.mode("overwrite").saveAsTable("weekly_user_activity")',
        status: 'DONE',
        submissionTime: new Date(baseTime.getTime() + 1000 * 60 * 65).toISOString(),
        duration: 78000,
        results: {
          schema: {
            fields: [
              { name: 'rows_processed', type: 'BIGINT' },
              { name: 'execution_time_ms', type: 'BIGINT' },
            ],
          },
          rows: [[2500000, 78000]],
          totalRows: 1,
        },
      },
      {
        jobId: 'job-failed-analysis-004',
        jobType: 'hive',
        clusterName: 'dev-testing-cluster',
        projectId: 'development-sandbox',
        region: 'us-west2',
        query: 'SELECT * FROM non_existent_table WHERE invalid_column = "test"',
        status: 'ERROR',
        submissionTime: new Date(baseTime.getTime() + 1000 * 60 * 70).toISOString(),
        duration: 5000,
        error: {
          errorType: 'TABLE_NOT_FOUND',
          errorMessage: 'Table or view not found: non_existent_table',
          stackTrace:
            'org.apache.hadoop.hive.ql.metadata.HiveException: Table or view not found: non_existent_table\n\tat org.apache.hadoop.hive.ql.metadata.Hive.getTable(Hive.java:1274)',
        },
      },
      {
        jobId: 'job-presto-aggregation-005',
        jobType: 'presto',
        clusterName: 'analytics-cluster',
        projectId: 'business-analytics',
        region: 'us-east1',
        query:
          'SELECT region, AVG(order_value) as avg_order_value, STDDEV(order_value) as order_value_stddev FROM orders WHERE order_date >= date("2024-10-01") GROUP BY region HAVING COUNT(*) > 100',
        status: 'DONE',
        submissionTime: new Date(baseTime.getTime() + 1000 * 60 * 80).toISOString(),
        duration: 28000,
        results: {
          schema: {
            fields: [
              { name: 'region', type: 'VARCHAR' },
              { name: 'avg_order_value', type: 'DOUBLE' },
              { name: 'order_value_stddev', type: 'DOUBLE' },
            ],
          },
          rows: [
            ['North America', 156.75, 45.2],
            ['Europe', 142.3, 38.9],
            ['Asia Pacific', 134.5, 42.15],
            ['Latin America', 98.25, 28.75],
          ],
          totalRows: 4,
        },
      },
    ];
  }

  /**
   * Check if mock data should be loaded (development/testing mode)
   */
  static shouldLoadMockData(): boolean {
    // Load mock data in development or when explicitly requested
    return (
      process.env.NODE_ENV === 'development' ||
      process.env.LOAD_MOCK_DATA === 'true' ||
      process.env.LOG_LEVEL === 'debug'
    );
  }
}
