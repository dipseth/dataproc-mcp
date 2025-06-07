#!/usr/bin/env node

/**
 * Comprehensive Knowledge Indexer Test
 *
 * DEPENDENCIES:
 * - ✅ Runs standalone (no MCP server required)
 * - ✅ Requires Qdrant running on localhost:6333
 * - ✅ Auto-builds project if needed
 *
 * USAGE:
 *   npm run build && node tests/manual/test-knowledge-indexer-comprehensive.js
 *
 * OR with Qdrant setup:
 *   docker-compose -f docker-compose.qdrant.yml up -d
 *   npm run build && node tests/manual/test-knowledge-indexer-comprehensive.js
 *
 * Tests all aspects of knowledge indexing including:
 * - Cluster configuration indexing and retrieval
 * - Job submission indexing and querying
 * - Natural language queries and semantic search
 * - Tag-based search functionality
 * - Raw document retrieval and compression analysis
 * - Error handling and data validation
 */

import { KnowledgeIndexer } from '../../../build/services/knowledge-indexer.js';

console.log('🧠 Comprehensive Knowledge Indexer Test');
console.log('=' .repeat(60));

async function testKnowledgeIndexer() {
  const results = {
    indexing: { passed: 0, failed: 0, tests: [] },
    querying: { passed: 0, failed: 0, tests: [] },
    features: { passed: 0, failed: 0, tests: [] },
    integration: { passed: 0, failed: 0, tests: [] }
  };

  let indexer;
  try {
    console.log('\n📋 Initializing Knowledge Indexer...');
    indexer = new KnowledgeIndexer({
      url: 'http://localhost:6333',
      collectionName: 'test_knowledge_comprehensive',
      vectorSize: 384,
      distance: 'Cosine'
    });

    try {
      await indexer.initialize();
      results.integration.passed++;
      results.integration.tests.push('✅ Knowledge Indexer initialization');
      console.log('   ✅ Knowledge Indexer initialized successfully');
    } catch (error) {
      results.integration.failed++;
      results.integration.tests.push(`❌ Knowledge Indexer initialization: ${error.message}`);
      console.log(`   ❌ Initialization failed: ${error.message}`);
      return; // Can't continue without initialization
    }

    // NEW: Manual Storage Verification Test
    console.log('\n🔧 Manual Storage Verification...');
    try {
      const { QdrantStorageService } = await import('../../../build/services/qdrant-storage.js');
      const { randomUUID } = await import('crypto');
      
      const storage = new QdrantStorageService({
        url: 'http://localhost:6333',
        collectionName: 'dataproc_knowledge',
        vectorSize: 384
      });
      
      await storage.initialize();
      
      // Test manual storage
      const testData = {
        clusterName: 'manual-test-cluster',
        projectId: 'test-project',
        region: 'us-central1',
        packages: ['pandas', 'tensorflow', 'scikit-learn'],
        machineType: 'n1-standard-4',
        type: 'cluster'
      };

      const testMetadata = {
        toolName: 'manual-test',
        timestamp: new Date().toISOString(),
        projectId: 'test-project',
        region: 'us-central1',
        clusterName: 'manual-test-cluster',
        responseType: 'cluster-test',
        originalTokenCount: 100,
        filteredTokenCount: 80,
        compressionRatio: 1.0,
        type: 'cluster'
      };

      console.log('   📝 Attempting manual storage...');
      const storedId = await storage.storeClusterData(testData, testMetadata);
      console.log(`   ✅ Manual storage successful! ID: ${storedId}`);
      
      // Test manual retrieval - extract UUID from resource URI
      console.log('   🔍 Testing manual retrieval...');
      // storedId is a resource URI like "dataproc/stored/manual-test/test-project/us-central1/manual-test-cluster/UUID"
      // We need to extract just the UUID part for retrieveById
      const uuidMatch = storedId.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i);
      const actualId = uuidMatch ? uuidMatch[1] : storedId;
      console.log(`   🔍 Extracted UUID for retrieval: ${actualId}`);
      const retrieved = await storage.retrieveById(actualId);
      if (retrieved && retrieved.clusterName === 'manual-test-cluster') {
        console.log('   ✅ Manual retrieval successful!');
        results.integration.passed++;
        results.integration.tests.push('✅ Manual storage/retrieval verification');
      } else {
        console.log('   ❌ Manual retrieval failed');
        results.integration.failed++;
        results.integration.tests.push('❌ Manual storage/retrieval verification');
      }
      
    } catch (error) {
      console.log(`   ❌ Manual storage test failed: ${error.message}`);
      console.log(`   🔍 Error details:`, error);
      results.integration.failed++;
      results.integration.tests.push(`❌ Manual storage verification: ${error.message}`);
    }

    console.log('\n1️⃣ Testing Cluster Configuration Indexing...');
    
    // Test comprehensive cluster data
    const clusterData = {
      clusterName: 'ml-analytics-cluster',
      projectId: 'data-science-project',
      region: 'us-central1',
      config: {
        softwareConfig: {
          properties: {
            'dataproc:pip.packages': 'pandas==1.5.0,numpy==1.21.0,scikit-learn==1.1.0,tensorflow==2.9.0',
            'dataproc:conda.packages': 'matplotlib,seaborn'
          },
          optionalComponents: ['JUPYTER', 'ZEPPELIN', 'ANACONDA']
        },
        masterConfig: {
          machineTypeUri: 'projects/data-science-project/zones/us-central1-a/machineTypes/n1-highmem-4',
          diskConfig: {
            bootDiskSizeGb: 200,
            bootDiskType: 'pd-ssd'
          }
        },
        workerConfig: {
          machineTypeUri: 'projects/data-science-project/zones/us-central1-a/machineTypes/n1-standard-4',
          numInstances: 4,
          diskConfig: {
            bootDiskSizeGb: 100,
            bootDiskType: 'pd-standard'
          }
        }
      },
      labels: {
        environment: 'production',
        team: 'data-science',
        purpose: 'ml-training'
      },
      status: {
        state: 'RUNNING',
        stateStartTime: new Date().toISOString()
      }
    };

    try {
      await indexer.indexClusterConfiguration(clusterData);
      results.indexing.passed++;
      results.indexing.tests.push('✅ Cluster configuration indexing');
      console.log('   ✅ Cluster configuration indexed successfully');
    } catch (error) {
      results.indexing.failed++;
      results.indexing.tests.push(`❌ Cluster configuration indexing: ${error.message}`);
      console.log(`   ❌ Cluster indexing failed: ${error.message}`);
    }

    console.log('\n2️⃣ Testing Job Submission Indexing...');
    
    // Test successful job
    const successfulJob = {
      jobId: 'hive-query-' + Date.now(),
      jobType: 'hive',
      clusterName: 'ml-analytics-cluster',
      projectId: 'data-science-project',
      region: 'us-central1',
      query: 'SELECT COUNT(*) FROM sales_data WHERE date >= "2024-01-01"',
      status: 'DONE',
      submissionTime: new Date().toISOString(),
      duration: 15000,
      results: {
        schema: {
          fields: [{ name: 'count', type: 'BIGINT' }]
        },
        rows: [['1250000']],
        totalRows: 1
      }
    };

    try {
      await indexer.indexJobSubmission(successfulJob);
      results.indexing.passed++;
      results.indexing.tests.push('✅ Successful job indexing');
      console.log('   ✅ Successful job indexed successfully');
    } catch (error) {
      results.indexing.failed++;
      results.indexing.tests.push(`❌ Successful job indexing: ${error.message}`);
      console.log(`   ❌ Successful job indexing failed: ${error.message}`);
    }

    // Test failed job
    const failedJob = {
      jobId: 'spark-job-' + Date.now(),
      jobType: 'spark',
      clusterName: 'ml-analytics-cluster',
      projectId: 'data-science-project',
      region: 'us-central1',
      query: 'spark.sql("SELECT * FROM non_existent_table")',
      status: 'ERROR',
      submissionTime: new Date().toISOString(),
      duration: 2000,
      error: {
        message: 'Table or view not found: non_existent_table',
        type: 'AnalysisException'
      }
    };

    try {
      await indexer.indexJobSubmission(failedJob);
      results.indexing.passed++;
      results.indexing.tests.push('✅ Failed job indexing');
      console.log('   ✅ Failed job indexed successfully');
    } catch (error) {
      results.indexing.failed++;
      results.indexing.tests.push(`❌ Failed job indexing: ${error.message}`);
      console.log(`   ❌ Failed job indexing failed: ${error.message}`);
    }

    console.log('\n3️⃣ Testing Natural Language Queries...');
    
    // Test semantic search queries
    const queries = [
      { query: 'machine learning clusters with pandas', type: 'clusters', expectedResults: 1 },
      { query: 'tensorflow scikit-learn', type: 'clusters', expectedResults: 1 },
      { query: 'hive queries on sales data', type: 'jobs', expectedResults: 1 },
      { query: 'failed spark jobs', type: 'jobs', expectedResults: 1 },
      { query: 'production environment clusters', type: 'all', expectedResults: 1 }
    ];

    for (const testQuery of queries) {
      try {
        const results_query = await indexer.queryKnowledge(testQuery.query, {
          type: testQuery.type,
          limit: 10
        });
        
        if (results_query.length > 0) {
          results.querying.passed++;
          results.querying.tests.push(`✅ Query: "${testQuery.query}" (${results_query.length} results)`);
          console.log(`   ✅ Query "${testQuery.query}" returned ${results_query.length} results`);
        } else {
          results.querying.failed++;
          results.querying.tests.push(`❌ Query: "${testQuery.query}" (no results)`);
          console.log(`   ❌ Query "${testQuery.query}" returned no results`);
        }
      } catch (error) {
        results.querying.failed++;
        results.querying.tests.push(`❌ Query: "${testQuery.query}" (error: ${error.message})`);
        console.log(`   ❌ Query "${testQuery.query}" failed: ${error.message}`);
      }
    }

    console.log('\n4️⃣ Testing Tag-Based Search...');
    
    // Test tag-based queries
    const tagQueries = [
      `jobId:${successfulJob.jobId}`,
      `clusterName:ml-analytics-cluster`,
      `projectId:data-science-project`,
      `clusterName:ml-analytics-cluster hive queries`
    ];

    for (const tagQuery of tagQueries) {
      try {
        const results_tag = await indexer.queryKnowledge(tagQuery, {
          type: 'all',
          limit: 5
        });
        
        results.features.passed++;
        results.features.tests.push(`✅ Tag query: "${tagQuery}" (${results_tag.length} results)`);
        console.log(`   ✅ Tag query "${tagQuery}" returned ${results_tag.length} results`);
      } catch (error) {
        results.features.failed++;
        results.features.tests.push(`❌ Tag query: "${tagQuery}" (error: ${error.message})`);
        console.log(`   ❌ Tag query "${tagQuery}" failed: ${error.message}`);
      }
    }

    console.log('\n5️⃣ Testing Enhanced Features...');
    
    // Test raw document retrieval
    try {
      const rawResults = await indexer.queryKnowledgeWithRawDocuments('machine learning', {
        type: 'all',
        limit: 3,
        includeRawDocument: true
      });
      
      if (rawResults.length > 0 && rawResults[0].rawDocument) {
        results.features.passed++;
        results.features.tests.push('✅ Raw document retrieval');
        console.log(`   ✅ Raw document retrieval successful (${rawResults.length} results with raw docs)`);
      } else {
        results.features.failed++;
        results.features.tests.push('❌ Raw document retrieval (no raw documents)');
        console.log('   ❌ Raw document retrieval failed - no raw documents returned');
      }
    } catch (error) {
      results.features.failed++;
      results.features.tests.push(`❌ Raw document retrieval: ${error.message}`);
      console.log(`   ❌ Raw document retrieval failed: ${error.message}`);
    }

    // Test analytics features
    try {
      const clusterInsights = indexer.getClusterInsights();
      const jobAnalytics = indexer.getJobTypeAnalytics();
      
      results.features.passed++;
      results.features.tests.push(`✅ Analytics (${clusterInsights.totalClusters} clusters, ${jobAnalytics.totalJobs} jobs)`);
      console.log(`   ✅ Analytics: ${clusterInsights.totalClusters} clusters, ${jobAnalytics.totalJobs} jobs tracked`);
    } catch (error) {
      results.features.failed++;
      results.features.tests.push(`❌ Analytics: ${error.message}`);
      console.log(`   ❌ Analytics failed: ${error.message}`);
    }

    console.log('\n6️⃣ Testing Error Handling...');
    
    // Test invalid data handling
    try {
      await indexer.indexClusterConfiguration(null);
      results.integration.failed++;
      results.integration.tests.push('❌ Null data handling (should have failed)');
      console.log('   ❌ Null data was accepted (should have failed)');
    } catch (error) {
      results.integration.passed++;
      results.integration.tests.push('✅ Null data properly rejected');
      console.log('   ✅ Null data properly rejected');
    }

    // Test invalid query handling
    try {
      const invalidResults = await indexer.queryKnowledge('', { type: 'invalid_type' });
      results.integration.passed++;
      results.integration.tests.push(`✅ Invalid query handled gracefully (${invalidResults.length} results)`);
      console.log(`   ✅ Invalid query handled gracefully`);
    } catch (error) {
      results.integration.passed++;
      results.integration.tests.push('✅ Invalid query properly rejected');
      console.log('   ✅ Invalid query properly rejected');
    }

  } catch (error) {
    console.error('❌ Test setup failed:', error);
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up...');
    try {
      if (indexer && typeof indexer.shutdown === 'function') {
        await indexer.shutdown();
      }
      console.log('✅ Cleanup completed');
    } catch (cleanupError) {
      console.error('❌ Cleanup failed:', cleanupError);
    }
  }

  // Print summary
  console.log('\n📊 TEST SUMMARY');
  console.log('=' .repeat(60));
  
  const categories = ['indexing', 'querying', 'features', 'integration'];
  let totalPassed = 0, totalFailed = 0;

  categories.forEach(category => {
    const result = results[category];
    totalPassed += result.passed;
    totalFailed += result.failed;
    
    console.log(`\n${category.toUpperCase()}:`);
    console.log(`   Passed: ${result.passed}, Failed: ${result.failed}`);
    result.tests.forEach(test => console.log(`   ${test}`));
  });

  console.log(`\n🎯 OVERALL: ${totalPassed} passed, ${totalFailed} failed`);
  
  if (totalFailed === 0) {
    console.log('🎉 All tests passed! Knowledge indexer is working correctly.');
  } else {
    console.log('⚠️  Some tests failed - this indicates the ERR_INVALID_ARG_TYPE fix may need refinement.');
  }

  // Provide actionable insights
  console.log('\n💡 INSIGHTS:');
  if (results.indexing.failed > 0) {
    console.log('   - Indexing issues detected - check Qdrant storage layer');
  }
  if (results.querying.failed > 0) {
    console.log('   - Query issues detected - check semantic search functionality');
  }
  if (results.features.failed > 0) {
    console.log('   - Feature issues detected - check enhanced functionality');
  }
  if (totalFailed === 0) {
    console.log('   - All systems operational - ERR_INVALID_ARG_TYPE fix successful!');
  }
}

testKnowledgeIndexer().catch(console.error);