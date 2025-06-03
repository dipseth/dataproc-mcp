#!/usr/bin/env node

/**
 * Direct test of Qdrant collection creation and storage
 */

import { QdrantStorageService } from '../../src/services/qdrant-storage.js';

async function testQdrantDirect() {
  console.log('🔧 **Testing Qdrant Direct Storage**\n');

  const qdrantService = new QdrantStorageService({
    url: 'http://localhost:6334',
    collectionName: 'test_dataproc_responses',
    vectorSize: 384,
    distance: 'Cosine'
  });

  try {
    // Test 1: Store some fake cluster data
    console.log('1. Testing storeClusterData...');
    const fakeClusterData = {
      clusterName: 'test-cluster',
      projectId: 'test-project',
      region: 'us-central1',
      config: {
        softwareConfig: {
          properties: {
            'dataproc:pip.packages': 'pandas==1.3.5,numpy==1.21.6'
          }
        }
      }
    };

    const metadata = {
      toolName: 'test',
      timestamp: new Date().toISOString(),
      projectId: 'test-project',
      region: 'us-central1',
      clusterName: 'test-cluster',
      responseType: 'cluster_list',
      originalTokenCount: 1000,
      filteredTokenCount: 500,
      compressionRatio: 0.5
    };

    await qdrantService.storeClusterData(fakeClusterData, metadata);
    console.log('✅ Data stored successfully');

    // Test 2: Search for the data
    console.log('\n2. Testing searchSimilar...');
    const results = await qdrantService.searchSimilar('pandas numpy', 5);
    console.log(`📊 Found ${results.length} results`);
    
    results.forEach((result, index) => {
      console.log(`   ${index + 1}. Score: ${result.score}, Cluster: ${result.metadata?.clusterName}`);
    });

  } catch (error) {
    console.error('❌ Test failed:', error);
    
    // Additional debugging
    console.log('\n🔍 **Debug Info:**');
    console.log('- Qdrant URL:', 'http://localhost:6334');
    console.log('- Collection Name:', 'test_dataproc_responses');
    
    if (error instanceof Error) {
      console.log('- Error Message:', error.message);
      console.log('- Error Stack:', error.stack?.split('\n')[0]);
    }
  }
}

testQdrantDirect().catch(console.error);