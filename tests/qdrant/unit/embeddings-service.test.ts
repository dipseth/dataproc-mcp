#!/usr/bin/env node

/**
 * Test the modern Transformers.js embedding service
 */

import { TransformersEmbeddingService } from '../../../build/services/transformers-embeddings.js';

interface TestClusterData {
  clusterName: string;
  projectId: string;
  region: string;
  config: {
    softwareConfig?: {
      properties?: Record<string, string>;
      optionalComponents?: string[];
    };
    masterConfig?: {
      machineTypeUri?: string;
      numInstances?: number;
    };
  };
  labels: Record<string, string>;
  [key: string]: unknown;
}

async function testTransformersEmbeddings(): Promise<void> {
  console.log('🤖 **Testing Transformers.js Embedding Service**\n');

  const embeddingService = new TransformersEmbeddingService();

  // Test cluster data similar to what we get from GCP - using proper types
  const testClusterData: TestClusterData = {
    clusterName: 'test-pandas-cluster',
    projectId: 'test-project',
    region: 'us-central1',
    config: {
      softwareConfig: {
        properties: {
          'dataproc:pip.packages': 'pandas==1.3.5,numpy==1.21.6,scikit-learn==1.0.2,matplotlib==3.5.1'
        },
        optionalComponents: ['ZEPPELIN', 'JUPYTER']
      },
      masterConfig: {
        machineTypeUri: 'projects/test/zones/us-central1-f/machineTypes/n1-standard-8',
        numInstances: 1
      }
    },
    labels: {
      service: 'data-science',
      team: 'ml-team',
      environment: 'production'
    }
  };

  console.log('1. Training model with test cluster data...');
  embeddingService.trainOnClusterData(testClusterData);

  const stats = embeddingService.getStats();
  console.log(`   📊 Model stats: ${stats.modelName}, ${stats.documentsProcessed} docs processed`);

  console.log('\n2. Testing embedding generation...');
  
  // Test queries that should match our cluster data
  const queries = [
    'pandas numpy data science',
    'python machine learning packages',
    'jupyter notebook zeppelin',
    'n1-standard-8 compute',
    'ml-team production environment'
  ];

  for (const query of queries) {
    console.log(`   🔍 Testing query: "${query}"`);
    try {
      const embedding = await embeddingService.generateEmbedding(query);
      const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
      console.log(`      ✅ Vector generated: ${embedding.length}D, magnitude: ${magnitude.toFixed(4)}`);
    } catch (error) {
      console.log(`      ❌ Error: ${error}`);
    }
  }

  console.log('\n3. Testing cluster data embedding...');
  try {
    const clusterEmbedding = await embeddingService.generateClusterEmbedding(testClusterData);
    const clusterMagnitude = Math.sqrt(clusterEmbedding.reduce((sum, val) => sum + val * val, 0));
    console.log(`   ✅ Cluster embedding: ${clusterEmbedding.length}D, magnitude: ${clusterMagnitude.toFixed(4)}`);
  } catch (error) {
    console.log(`   ❌ Error: ${error}`);
  }

  console.log('\n4. Testing training data search...');
  const searchResults = embeddingService.searchTrainingData('pandas');
  console.log(`   📋 Found ${searchResults.length} training examples with 'pandas'`);
  
  if (searchResults.length > 0) {
    console.log(`   📝 Sample: ${searchResults[0].extractedText.substring(0, 100)}...`);
  }

  console.log('\n5. Saving training data...');
  embeddingService.saveTrainingDataNow();
  console.log('   ✅ Training data saved');

  console.log('\n6. Sample training data:');
  const samples = embeddingService.getSampleTrainingData(1);
  if (samples.length > 0) {
    console.log(`   📄 Cluster: ${samples[0].clusterName}`);
    console.log(`   📄 Text: ${samples[0].extractedText}`);
  }

  console.log('\n✅ Transformers.js embedding service test complete!');
}

testTransformersEmbeddings().catch(console.error);