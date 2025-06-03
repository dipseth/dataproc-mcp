#!/usr/bin/env node

/**
 * Debug script to examine Qdrant collections and see what data is actually stored
 */

import { QdrantClient } from '@qdrant/js-client-rest';

async function debugQdrantCollections() {
  const client = new QdrantClient({
    url: 'http://localhost:6334',
  });

  console.log('🔍 **Qdrant Collection Debug Report**\n');

  try {
    // List all collections
    const collections = await client.getCollections();
    console.log('📊 **Available Collections:**');
    collections.collections.forEach(collection => {
      console.log(`   • ${collection.name}`);
    });
    console.log('');

    // Check each collection that might contain our data
    const collectionsToCheck = ['dataproc_responses', 'dataproc_knowledge'];
    
    for (const collectionName of collectionsToCheck) {
      try {
        console.log(`🔍 **Collection: ${collectionName}**`);
        
        // Get collection info
        const info = await client.getCollection(collectionName);
        console.log(`   📈 Points Count: ${info.points_count}`);
        console.log(`   📐 Vector Size: ${info.config?.params?.vectors?.size || 'N/A'}`);
        console.log(`   📏 Distance: ${info.config?.params?.vectors?.distance || 'N/A'}`);
        
        if (info.points_count && info.points_count > 0) {
          // Get some sample points
          const points = await client.scroll(collectionName, {
            limit: 5,
            with_payload: true,
            with_vector: false
          });
          
          console.log(`   📝 **Sample Points (${points.points.length}):**`);
          points.points.forEach((point, index) => {
            console.log(`      ${index + 1}. ID: ${point.id}`);
            console.log(`         Payload Keys: ${Object.keys(point.payload || {}).join(', ')}`);
            
            // Show specific payload details
            if (point.payload) {
              if (point.payload.toolName) {
                console.log(`         Tool: ${point.payload.toolName}`);
              }
              if (point.payload.responseType) {
                console.log(`         Type: ${point.payload.responseType}`);
              }
              if (point.payload.projectId) {
                console.log(`         Project: ${point.payload.projectId}`);
              }
              if (point.payload.clusterName) {
                console.log(`         Cluster: ${point.payload.clusterName}`);
              }
              if (point.payload.data) {
                const dataStr = typeof point.payload.data === 'string' 
                  ? point.payload.data.substring(0, 100) + '...'
                  : JSON.stringify(point.payload.data).substring(0, 100) + '...';
                console.log(`         Data: ${dataStr}`);
              }
            }
            console.log('');
          });
        } else {
          console.log(`   ❌ No points found in collection`);
        }
        
      } catch (error) {
        console.log(`   ❌ Collection ${collectionName} not found or error: ${error}`);
      }
      console.log('');
    }

    // Test search functionality
    console.log('🔍 **Testing Search Functionality**');
    
    for (const collectionName of collectionsToCheck) {
      try {
        const info = await client.getCollection(collectionName);
        if (info.points_count && info.points_count > 0) {
          console.log(`   Testing search in ${collectionName}...`);
          
          // Create a simple test vector (same size as collection)
          const vectorSize = (info.config?.params?.vectors as any)?.size || 384;
          const testVector = new Array(vectorSize).fill(0.1);
          
          const searchResult = await client.search(collectionName, {
            vector: testVector,
            limit: 3,
            with_payload: true
          });
          
          console.log(`   📊 Search returned ${searchResult.length} results`);
          searchResult.forEach((result, index) => {
            console.log(`      ${index + 1}. Score: ${result.score}, ID: ${result.id}`);
          });
        }
      } catch (error) {
        console.log(`   ❌ Search test failed for ${collectionName}: ${error}`);
      }
    }

  } catch (error) {
    console.error('❌ Failed to connect to Qdrant:', error);
    console.log('\n💡 **Troubleshooting:**');
    console.log('   • Is Qdrant running? Try: docker run -p 6333:6333 qdrant/qdrant');
    console.log('   • Check if the URL is correct (http://localhost:6333)');
    console.log('   • Verify network connectivity');
  }
}

// Run the debug script
debugQdrantCollections().catch(console.error);