#!/usr/bin/env node

/**
 * Standalone authentication debug test script
 * Tests authentication strategies outside of MCP to isolate timeout issues
 */

import { createJobClient, createDataprocClient, getGcloudAccessToken } from './build/config/credentials.js';
import { getServerConfig } from './build/config/server.js';

// Enable debug logging
process.env.LOG_LEVEL = 'debug';

async function testAuthentication() {
  console.log('='.repeat(80));
  console.log('AUTHENTICATION DEBUG TEST SCRIPT');
  console.log('='.repeat(80));
  
  const startTime = Date.now();
  
  try {
    // Test 1: Direct gcloud token acquisition
    console.log('\n1. Testing direct gcloud token acquisition...');
    const tokenStartTime = Date.now();
    const token = getGcloudAccessToken();
    const tokenDuration = Date.now() - tokenStartTime;
    console.log(`✅ Direct gcloud token: ${tokenDuration}ms (token length: ${token.length})`);
    
    // Test 2: Server config loading
    console.log('\n2. Testing server config loading...');
    const configStartTime = Date.now();
    const config = await getServerConfig();
    const configDuration = Date.now() - configStartTime;
    console.log(`✅ Server config loaded: ${configDuration}ms`);
    
    // Test 3: Cluster client creation (working operation)
    console.log('\n3. Testing cluster client creation...');
    const clusterClientStartTime = Date.now();
    const clusterClient = await createDataprocClient({ region: 'us-central1' });
    const clusterClientDuration = Date.now() - clusterClientStartTime;
    console.log(`✅ Cluster client created: ${clusterClientDuration}ms`);
    
    // Test 4: Job client creation (problematic operation)
    console.log('\n4. Testing job client creation...');
    const jobClientStartTime = Date.now();
    const jobClient = await createJobClient({ region: 'us-central1' });
    const jobClientDuration = Date.now() - jobClientStartTime;
    console.log(`✅ Job client created: ${jobClientDuration}ms`);
    
    // Test 5: Simple API call with job client
    console.log('\n5. Testing simple API call with job client...');
    const apiTestStartTime = Date.now();
    
    // Create a minimal job request that should fail quickly (invalid cluster)
    const testRequest = {
      projectId: 'test-project-invalid',
      region: 'us-central1',
      job: {
        placement: { clusterName: 'nonexistent-cluster' },
        hiveJob: {
          queryList: { queries: ['SELECT 1'] }
        }
      }
    };
    
    try {
      await jobClient.submitJob(testRequest);
      console.log('❌ Unexpected success with invalid project');
    } catch (apiError) {
      const apiTestDuration = Date.now() - apiTestStartTime;
      console.log(`✅ API call failed as expected: ${apiTestDuration}ms (${apiError.message.substring(0, 100)}...)`);
    }
    
    const totalDuration = Date.now() - startTime;
    console.log('\n' + '='.repeat(80));
    console.log(`TOTAL TEST DURATION: ${totalDuration}ms`);
    console.log('='.repeat(80));
    
  } catch (error) {
    const totalDuration = Date.now() - startTime;
    console.error('\n' + '='.repeat(80));
    console.error(`❌ TEST FAILED after ${totalDuration}ms`);
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    console.error('='.repeat(80));
    process.exit(1);
  }
}

// Add timeout to catch hanging operations
const TIMEOUT_MS = 30000; // 30 seconds
const timeoutId = setTimeout(() => {
  console.error('\n' + '='.repeat(80));
  console.error(`❌ TEST TIMED OUT after ${TIMEOUT_MS}ms`);
  console.error('This indicates a hanging operation in authentication or client creation');
  console.error('='.repeat(80));
  process.exit(1);
}, TIMEOUT_MS);

testAuthentication()
  .then(() => {
    clearTimeout(timeoutId);
    console.log('\n✅ All tests completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    clearTimeout(timeoutId);
    console.error('\n❌ Test script failed:', error);
    process.exit(1);
  });