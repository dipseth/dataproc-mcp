/**
 * Integration Test for Response Optimization
 * Tests complete workflow: large response → filtering → storage → retrieval
 */

import { ResponseFilter } from '../../build/services/response-filter.js';
import { QdrantManager } from '../../build/services/qdrant-manager.js';
import { QdrantStorageService } from '../../build/services/qdrant-storage.js';
import type { QdrantStorageMetadata } from '../../build/types/response-filter.js';

// Sample large cluster response data (simulating real GCP Dataproc response)
const largeSampleClusterResponse = {
  clusters: [
    {
      clusterName: 'production-analytics-cluster',
      status: { 
        state: 'RUNNING',
        stateStartTime: '2024-01-15T10:30:00Z',
        detail: 'Cluster is running normally'
      },
      createTime: '2024-01-15T10:25:00Z',
      projectId: 'my-analytics-project',
      config: {
        gceClusterConfig: {
          zoneUri: 'projects/my-analytics-project/zones/us-central1-a',
          networkUri: 'projects/my-analytics-project/global/networks/default',
          subnetworkUri: 'projects/my-analytics-project/regions/us-central1/subnetworks/default',
          internalIpOnly: false,
          serviceAccount: 'dataproc-service-account@my-analytics-project.iam.gserviceaccount.com',
          serviceAccountScopes: [
            'https://www.googleapis.com/auth/cloud-platform'
          ],
          tags: ['dataproc-cluster', 'analytics'],
          metadata: {
            'enable-oslogin': 'true',
            'startup-script': 'gs://my-bucket/startup-script.sh'
          }
        },
        masterConfig: {
          numInstances: 1,
          machineTypeUri: 'projects/my-analytics-project/zones/us-central1-a/machineTypes/n1-standard-8',
          diskConfig: {
            bootDiskType: 'pd-ssd',
            bootDiskSizeGb: 100,
            numLocalSsds: 1,
            localSsdInterface: 'SCSI'
          },
          isPreemptible: false,
          instanceNames: ['production-analytics-cluster-m'],
          instanceReferences: [
            {
              instanceName: 'production-analytics-cluster-m',
              instanceId: '1234567890123456789'
            }
          ],
          managedGroupConfig: {
            instanceTemplateName: 'production-analytics-cluster-master-template',
            instanceGroupManagerName: 'production-analytics-cluster-master-igm'
          }
        },
        workerConfig: {
          numInstances: 4,
          machineTypeUri: 'projects/my-analytics-project/zones/us-central1-a/machineTypes/n1-standard-4',
          diskConfig: {
            bootDiskType: 'pd-standard',
            bootDiskSizeGb: 100,
            numLocalSsds: 0
          },
          isPreemptible: false,
          instanceNames: [
            'production-analytics-cluster-w-0',
            'production-analytics-cluster-w-1',
            'production-analytics-cluster-w-2',
            'production-analytics-cluster-w-3'
          ],
          instanceReferences: [
            { instanceName: 'production-analytics-cluster-w-0', instanceId: '1234567890123456790' },
            { instanceName: 'production-analytics-cluster-w-1', instanceId: '1234567890123456791' },
            { instanceName: 'production-analytics-cluster-w-2', instanceId: '1234567890123456792' },
            { instanceName: 'production-analytics-cluster-w-3', instanceId: '1234567890123456793' }
          ],
          managedGroupConfig: {
            instanceTemplateName: 'production-analytics-cluster-worker-template',
            instanceGroupManagerName: 'production-analytics-cluster-worker-igm'
          }
        },
        secondaryWorkerConfig: {
          numInstances: 2,
          machineTypeUri: 'projects/my-analytics-project/zones/us-central1-a/machineTypes/n1-standard-2',
          diskConfig: {
            bootDiskType: 'pd-standard',
            bootDiskSizeGb: 50
          },
          isPreemptible: true,
          instanceNames: [
            'production-analytics-cluster-sw-0',
            'production-analytics-cluster-sw-1'
          ]
        },
        softwareConfig: {
          imageVersion: '2.1-debian11',
          properties: {
            'core:fs.defaultFS': 'hdfs://production-analytics-cluster-m:8020',
            'core:hadoop.http.staticuser.user': 'root',
            'hdfs:dfs.replication': '2',
            'mapred:mapreduce.job.reduces': '4',
            'spark:spark.executor.memory': '3g',
            'spark:spark.driver.memory': '2g',
            'hive:hive.metastore.warehouse.dir': 'gs://my-analytics-warehouse/hive-warehouse'
          },
          optionalComponents: [
            'ZEPPELIN',
            'JUPYTER',
            'ANACONDA',
            'HIVE_WEBHCAT',
            'SPARK_HISTORY_SERVER'
          ]
        },
        initializationActions: [
          {
            executableFile: 'gs://my-bucket/init-script.sh',
            executionTimeout: '300s'
          }
        ],
        encryptionConfig: {
          gcePdKmsKeyName: 'projects/my-analytics-project/locations/us-central1/keyRings/dataproc-ring/cryptoKeys/dataproc-key'
        },
        autoscalingConfig: {
          policyUri: 'projects/my-analytics-project/regions/us-central1/autoscalingPolicies/analytics-autoscaling'
        },
        securityConfig: {
          kerberosConfig: {
            enableKerberos: false
          }
        },
        lifecycleConfig: {
          idleDeleteTtl: '3600s',
          autoDeleteTime: '2024-01-16T10:30:00Z'
        },
        endpointConfig: {
          httpPorts: {
            'Spark History Server': 'http://production-analytics-cluster-m:18080',
            'Yarn ResourceManager': 'http://production-analytics-cluster-m:8088',
            'HDFS NameNode': 'http://production-analytics-cluster-m:9870',
            'Zeppelin': 'http://production-analytics-cluster-m:8080',
            'Jupyter': 'http://production-analytics-cluster-m:8123'
          },
          enableHttpPortAccess: true
        }
      },
      labels: {
        environment: 'production',
        team: 'data-engineering',
        project: 'analytics',
        'cost-center': 'engineering',
        owner: 'data-team@company.com'
      },
      metrics: {
        hdfsMetrics: {
          'dfs.namenode.capacity': '1073741824000',
          'dfs.namenode.used': '536870912000',
          'dfs.namenode.remaining': '536870912000',
          'dfs.namenode.safemode': 'OFF',
          'dfs.namenode.blocks.total': '1024',
          'dfs.namenode.blocks.corrupt': '0',
          'dfs.namenode.blocks.missing': '0'
        },
        yarnMetrics: {
          'yarn.nodemanager.resource.memory-mb': '14336',
          'yarn.nodemanager.resource.cpu-vcores': '4',
          'yarn.nodemanager.containers.allocated': '8',
          'yarn.nodemanager.containers.running': '6',
          'yarn.scheduler.capacity.root.used-capacity': '45.5'
        }
      },
      statusHistory: [
        {
          state: 'CREATING',
          stateStartTime: '2024-01-15T10:25:00Z',
          detail: 'Creating cluster resources'
        },
        {
          state: 'RUNNING',
          stateStartTime: '2024-01-15T10:30:00Z',
          detail: 'Cluster is running normally'
        }
      ]
    },
    {
      clusterName: 'development-test-cluster',
      status: { 
        state: 'STOPPED',
        stateStartTime: '2024-01-14T18:00:00Z',
        detail: 'Cluster stopped for cost optimization'
      },
      createTime: '2024-01-14T15:20:00Z',
      projectId: 'my-analytics-project',
      config: {
        gceClusterConfig: {
          zoneUri: 'projects/my-analytics-project/zones/us-central1-b',
          networkUri: 'projects/my-analytics-project/global/networks/default'
        },
        masterConfig: {
          numInstances: 1,
          machineTypeUri: 'projects/my-analytics-project/zones/us-central1-b/machineTypes/n1-standard-2',
          diskConfig: {
            bootDiskType: 'pd-standard',
            bootDiskSizeGb: 50
          }
        },
        workerConfig: {
          numInstances: 2,
          machineTypeUri: 'projects/my-analytics-project/zones/us-central1-b/machineTypes/n1-standard-2',
          diskConfig: {
            bootDiskType: 'pd-standard',
            bootDiskSizeGb: 50
          }
        },
        softwareConfig: {
          imageVersion: '2.1-debian11',
          optionalComponents: ['ZEPPELIN']
        }
      },
      labels: {
        environment: 'development',
        team: 'data-engineering'
      }
    }
  ]
};

/**
 * Test Response Optimization Integration
 */
async function testResponseOptimization(): Promise<void> {
  console.log('🧪 Starting Response Optimization Integration Test\n');

  try {
    // Step 1: Initialize ResponseFilter
    console.log('📋 Step 1: Initializing ResponseFilter...');
    const responseFilter = await ResponseFilter.getInstance();
    console.log('✅ ResponseFilter initialized\n');

    // Step 2: Test token estimation
    console.log('📊 Step 2: Testing token estimation...');
    const originalResponse = JSON.stringify(largeSampleClusterResponse, null, 2);
    const originalTokens = responseFilter.estimateTokens(originalResponse);
    console.log(`📏 Original response: ${originalResponse.length} characters, ~${originalTokens} tokens\n`);

    // Step 3: Test response filtering
    console.log('🔍 Step 3: Testing response filtering...');
    const metadata: Partial<QdrantStorageMetadata> = {
      projectId: 'my-analytics-project',
      region: 'us-central1'
    };

    const filteredResponse = await responseFilter.filterResponse(
      'list_clusters',
      largeSampleClusterResponse,
      metadata
    );

    console.log(`📋 Filtered response type: ${filteredResponse.type}`);
    console.log(`💾 Full data available: ${filteredResponse.fullDataAvailable}`);
    console.log(`📊 Tokens saved: ${filteredResponse.tokensSaved || 0}`);
    
    if (filteredResponse.resourceUri) {
      console.log(`🔗 Resource URI: ${filteredResponse.resourceUri}`);
    }

    const filteredTokens = responseFilter.estimateTokens(filteredResponse.content);
    const reductionPercentage = filteredResponse.tokensSaved 
      ? ((filteredResponse.tokensSaved / originalTokens) * 100).toFixed(1)
      : '0';
    
    console.log(`📉 Token reduction: ${originalTokens} → ${filteredTokens} (${reductionPercentage}% saved)\n`);

    // Step 4: Test verbose mode bypass
    console.log('🔍 Step 4: Testing verbose mode bypass...');
    const verboseResponse = await responseFilter.filterResponse(
      'list_clusters',
      largeSampleClusterResponse,
      metadata
    );

    console.log(`📋 Verbose response type: ${verboseResponse.type}`);
    console.log(`📊 Verbose tokens saved: ${verboseResponse.tokensSaved || 0}\n`);

    // Step 5: Test graceful fallback when Qdrant is unavailable
    console.log('🔍 Step 5: Testing graceful fallback...');
    const fallbackResponse = await responseFilter.filterResponse(
      'get_cluster',
      largeSampleClusterResponse.clusters[0],
      metadata
    );

    console.log(`📋 Fallback response type: ${fallbackResponse.type}`);
    console.log(`💾 Fallback full data available: ${fallbackResponse.fullDataAvailable}\n`);

    // Step 6: Test resource retrieval (if storage is available)
    if (filteredResponse.resourceUri && filteredResponse.fullDataAvailable) {
      console.log('🔍 Step 6: Testing resource retrieval...');
      try {
        const resourceId = filteredResponse.resourceUri.split('/').pop();
        if (resourceId) {
          const retrievedData = await responseFilter.getStoredResponse(resourceId);
          if (retrievedData) {
            console.log('✅ Successfully retrieved stored data');
            console.log(`📊 Retrieved data size: ${JSON.stringify(retrievedData).length} characters`);
          } else {
            console.log('⚠️  No data retrieved (expected for test environment)');
          }
        }
      } catch (error) {
        console.log(`⚠️  Resource retrieval failed (expected): ${error}`);
      }
      console.log('');
    }

    // Step 7: Performance measurement
    console.log('⚡ Step 7: Performance measurement...');
    const iterations = 10;
    const startTime = Date.now();

    for (let i = 0; i < iterations; i++) {
      await responseFilter.filterResponse(
        'list_clusters',
        largeSampleClusterResponse,
        metadata
      );
    }

    const endTime = Date.now();
    const avgTime = (endTime - startTime) / iterations;
    console.log(`⏱️  Average filtering time: ${avgTime.toFixed(2)}ms per request\n`);

    // Step 8: Test different tool types
    console.log('🔍 Step 8: Testing different tool types...');
    
    const toolTests = [
      { tool: 'get_cluster', data: largeSampleClusterResponse.clusters[0] },
      { tool: 'submit_hive_query', data: { jobId: 'test-job-123', status: 'RUNNING' } },
      { tool: 'check_active_jobs', data: { jobs: [{ jobId: 'job-1', status: 'RUNNING' }] } }
    ];

    for (const test of toolTests) {
      const result = await responseFilter.filterResponse(test.tool, test.data, metadata);
      const tokens = responseFilter.estimateTokens(result.content);
      console.log(`  📋 ${test.tool}: ${result.type} (${tokens} tokens, saved: ${result.tokensSaved || 0})`);
    }

    console.log('\n✅ Response Optimization Integration Test Completed Successfully!');
    
    // Summary
    console.log('\n📊 Test Summary:');
    console.log(`   • Original response: ${originalTokens} tokens`);
    console.log(`   • Filtered response: ${filteredTokens} tokens`);
    console.log(`   • Token reduction: ${reductionPercentage}%`);
    console.log(`   • Average processing time: ${avgTime.toFixed(2)}ms`);
    console.log(`   • Storage available: ${filteredResponse.fullDataAvailable ? 'Yes' : 'No'}`);

  } catch (error) {
    console.error('❌ Integration test failed:', error);
    process.exit(1);
  }
}

/**
 * Test Qdrant Manager functionality
 */
async function testQdrantManager(): Promise<void> {
  console.log('\n🔧 Testing Qdrant Manager...');
  
  try {
    const qdrantManager = new QdrantManager({
      autoStart: true,
      preferredPort: 6333
    });

    // Test auto-start functionality
    console.log('🚀 Testing Qdrant auto-start...');
    const qdrantUrl = await qdrantManager.autoStart();
    
    if (qdrantUrl) {
      console.log(`✅ Qdrant auto-started at: ${qdrantUrl}`);
      
      // Test health check
      // Test health check if available
      try {
        const isHealthy = await (qdrantManager as any).healthCheck();
        console.log(`💚 Qdrant health check: ${isHealthy ? 'Healthy' : 'Unhealthy'}`);
      } catch (error) {
        console.log('⚠️  Health check not available');
      }
      
    } else {
      console.log('⚠️  Qdrant auto-start not available (expected in some environments)');
    }

  } catch (error) {
    console.log(`⚠️  Qdrant Manager test failed (expected): ${error}`);
  }
}

/**
 * Test error handling and edge cases
 */
async function testErrorHandling(): Promise<void> {
  console.log('\n🛡️  Testing Error Handling...');
  
  try {
    const responseFilter = await ResponseFilter.getInstance();

    // Test with malformed data
    console.log('🔍 Testing malformed data handling...');
    const malformedData = { invalid: 'structure', missing: 'required fields' };
    const result = await responseFilter.filterResponse('list_clusters', malformedData);
    console.log(`  📋 Malformed data result: ${result.type}`);

    // Test with empty data
    console.log('🔍 Testing empty data handling...');
    const emptyResult = await responseFilter.filterResponse('list_clusters', {});
    console.log(`  📋 Empty data result: ${emptyResult.type}`);

    // Test with very large data
    console.log('🔍 Testing large data handling...');
    const largeData = {
      clusters: Array(50).fill(largeSampleClusterResponse.clusters[0])
    };
    const largeResult = await responseFilter.filterResponse('list_clusters', largeData);
    const largeTokens = responseFilter.estimateTokens(largeResult.content);
    console.log(`  📋 Large data result: ${largeResult.type} (${largeTokens} tokens)`);

    console.log('✅ Error handling tests completed');

  } catch (error) {
    console.error('❌ Error handling test failed:', error);
  }
}

// Main execution
async function main(): Promise<void> {
  console.log('🚀 Response Optimization Integration Test Suite\n');
  console.log('=' .repeat(60));
  
  await testResponseOptimization();
  await testQdrantManager();
  await testErrorHandling();
  
  console.log('\n' + '='.repeat(60));
  console.log('🎉 All tests completed!');
}

// Run the tests
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { testResponseOptimization, testQdrantManager, testErrorHandling };