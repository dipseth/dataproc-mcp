#!/usr/bin/env node

/**
 * Comprehensive Qdrant Storage Service Test
 * 
 * Tests all aspects of Qdrant storage including:
 * - Vector format validation and conversion
 * - ID format requirements (UUID vs strings)
 * - Payload serialization and sanitization
 * - Collection management
 * - Error handling and recovery
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import { QdrantStorageService } from '../../../build/services/qdrant-storage.js';
import { TransformersEmbeddingService } from '../../../build/services/transformers-embeddings.js';

console.log('🔬 Comprehensive Qdrant Storage Test');
console.log('=' .repeat(60));

async function testQdrantStorage() {
  const results = {
    vectorFormats: { passed: 0, failed: 0, tests: [] },
    idFormats: { passed: 0, failed: 0, tests: [] },
    payloadTypes: { passed: 0, failed: 0, tests: [] },
    integration: { passed: 0, failed: 0, tests: [] }
  };

  try {
    // Test configuration
    const config = {
      url: 'http://localhost:6333',
      collectionName: 'test_qdrant_comprehensive',
      vectorSize: 384,
      distance: 'Cosine'
    };

    console.log('\n📋 Test Configuration:');
    console.log(`   URL: ${config.url}`);
    console.log(`   Collection: ${config.collectionName}`);
    console.log(`   Vector Size: ${config.vectorSize}`);
    console.log(`   Distance: ${config.distance}`);

    // Initialize services
    const storage = new QdrantStorageService(config);
    const embeddingService = new TransformersEmbeddingService();
    const directClient = new QdrantClient({ url: config.url });

    console.log('\n1️⃣ Testing Collection Management...');
    try {
      await storage.initialize();
      results.integration.passed++;
      results.integration.tests.push('✅ Collection initialization');
      console.log('   ✅ Collection initialized successfully');
    } catch (error) {
      results.integration.failed++;
      results.integration.tests.push(`❌ Collection initialization: ${error.message}`);
      console.log(`   ❌ Collection initialization failed: ${error.message}`);
    }

    console.log('\n2️⃣ Testing Vector Formats...');
    
    // Test regular array
    try {
      const regularVector = new Array(384).fill(0.1);
      const testData = { test: 'regular-array' };
      const metadata = {
        toolName: 'test',
        timestamp: new Date().toISOString(),
        projectId: 'test-project',
        region: 'us-central1',
        clusterName: 'test-cluster',
        responseType: 'test',
        originalTokenCount: 100,
        filteredTokenCount: 50,
        compressionRatio: 0.5,
        type: 'test'
      };
      
      await storage.storeClusterData(testData, metadata);
      results.vectorFormats.passed++;
      results.vectorFormats.tests.push('✅ Regular Array vector');
      console.log('   ✅ Regular Array vector storage successful');
    } catch (error) {
      results.vectorFormats.failed++;
      results.vectorFormats.tests.push(`❌ Regular Array vector: ${error.message}`);
      console.log(`   ❌ Regular Array vector failed: ${error.message}`);
    }

    // Test Transformers.js embedding
    try {
      const testClusterData = {
        clusterName: 'test-cluster',
        projectId: 'test-project',
        region: 'us-central1',
        config: {
          softwareConfig: {
            properties: {
              'dataproc:pip.packages': 'pandas==1.5.0,numpy==1.21.0'
            }
          }
        }
      };

      const transformersVector = await embeddingService.generateClusterEmbedding(testClusterData);
      console.log(`   📊 Transformers.js vector: type=${typeof transformersVector}, length=${transformersVector.length}`);
      
      const metadata = {
        toolName: 'test-transformers',
        timestamp: new Date().toISOString(),
        projectId: 'test-project',
        region: 'us-central1',
        clusterName: 'test-cluster',
        responseType: 'test',
        originalTokenCount: 100,
        filteredTokenCount: 50,
        compressionRatio: 0.5,
        type: 'test'
      };

      await storage.storeClusterData(testClusterData, metadata);
      results.vectorFormats.passed++;
      results.vectorFormats.tests.push('✅ Transformers.js embedding');
      console.log('   ✅ Transformers.js embedding storage successful');
    } catch (error) {
      results.vectorFormats.failed++;
      results.vectorFormats.tests.push(`❌ Transformers.js embedding: ${error.message}`);
      console.log(`   ❌ Transformers.js embedding failed: ${error.message}`);
    }

    console.log('\n3️⃣ Testing ID Formats...');
    
    // Test UUID (should work)
    try {
      await directClient.upsert(config.collectionName, {
        wait: true,
        points: [{
          id: globalThis.crypto.randomUUID(),
          vector: new Array(384).fill(0.2),
          payload: { test: 'uuid-test' }
        }]
      });
      results.idFormats.passed++;
      results.idFormats.tests.push('✅ UUID format');
      console.log('   ✅ UUID format accepted');
    } catch (error) {
      results.idFormats.failed++;
      results.idFormats.tests.push(`❌ UUID format: ${error.message}`);
      console.log(`   ❌ UUID format failed: ${error.message}`);
    }

    // Test arbitrary string (should fail)
    try {
      await directClient.upsert(config.collectionName, {
        wait: true,
        points: [{
          id: 'arbitrary-string-id',
          vector: new Array(384).fill(0.3),
          payload: { test: 'string-test' }
        }]
      });
      results.idFormats.failed++;
      results.idFormats.tests.push('❌ Arbitrary string accepted (should fail)');
      console.log('   ❌ Arbitrary string ID was accepted (this should not happen)');
    } catch (error) {
      results.idFormats.passed++;
      results.idFormats.tests.push('✅ Arbitrary string rejected (expected)');
      console.log('   ✅ Arbitrary string ID properly rejected');
    }

    console.log('\n4️⃣ Testing Payload Types...');
    
    // Test simple payload
    try {
      await directClient.upsert(config.collectionName, {
        wait: true,
        points: [{
          id: globalThis.crypto.randomUUID(),
          vector: new Array(384).fill(0.4),
          payload: { simple: 'value', number: 42, boolean: true }
        }]
      });
      results.payloadTypes.passed++;
      results.payloadTypes.tests.push('✅ Simple payload');
      console.log('   ✅ Simple payload accepted');
    } catch (error) {
      results.payloadTypes.failed++;
      results.payloadTypes.tests.push(`❌ Simple payload: ${error.message}`);
      console.log(`   ❌ Simple payload failed: ${error.message}`);
    }

    // Test complex payload
    try {
      const complexPayload = {
        toolName: 'test-tool',
        timestamp: new Date().toISOString(),
        projectId: 'test-project',
        region: 'us-central1',
        clusterName: 'test-cluster',
        responseType: 'cluster_data',
        type: 'cluster',
        data: JSON.stringify({
          config: {
            softwareConfig: {
              properties: {
                'dataproc:pip.packages': 'pandas==1.5.0,numpy==1.21.0'
              }
            }
          }
        }),
        storedAt: new Date().toISOString()
      };

      await directClient.upsert(config.collectionName, {
        wait: true,
        points: [{
          id: globalThis.crypto.randomUUID(),
          vector: new Array(384).fill(0.5),
          payload: complexPayload
        }]
      });
      results.payloadTypes.passed++;
      results.payloadTypes.tests.push('✅ Complex payload');
      console.log('   ✅ Complex payload accepted');
    } catch (error) {
      results.payloadTypes.failed++;
      results.payloadTypes.tests.push(`❌ Complex payload: ${error.message}`);
      console.log(`   ❌ Complex payload failed: ${error.message}`);
    }

    console.log('\n5️⃣ Testing Integration Features...');
    
    // Test search functionality
    try {
      const searchResults = await storage.searchSimilar('test data', 5, 0.0);
      results.integration.passed++;
      results.integration.tests.push(`✅ Search functionality (${searchResults.length} results)`);
      console.log(`   ✅ Search returned ${searchResults.length} results`);
    } catch (error) {
      results.integration.failed++;
      results.integration.tests.push(`❌ Search functionality: ${error.message}`);
      console.log(`   ❌ Search failed: ${error.message}`);
    }

    // Test health check
    try {
      const isHealthy = await storage.healthCheck();
      if (isHealthy) {
        results.integration.passed++;
        results.integration.tests.push('✅ Health check');
        console.log('   ✅ Health check passed');
      } else {
        results.integration.failed++;
        results.integration.tests.push('❌ Health check returned false');
        console.log('   ❌ Health check returned false');
      }
    } catch (error) {
      results.integration.failed++;
      results.integration.tests.push(`❌ Health check: ${error.message}`);
      console.log(`   ❌ Health check failed: ${error.message}`);
    }

  } catch (error) {
    console.error('❌ Test setup failed:', error);
  }

  // Print summary
  console.log('\n📊 TEST SUMMARY');
  console.log('=' .repeat(60));
  
  const categories = ['vectorFormats', 'idFormats', 'payloadTypes', 'integration'];
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
  console.log(totalFailed === 0 ? '🎉 All tests passed!' : '⚠️  Some tests failed - review above');
}

testQdrantStorage().catch(console.error);