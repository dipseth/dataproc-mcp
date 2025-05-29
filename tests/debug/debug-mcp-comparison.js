#!/usr/bin/env node

/**
 * MCP vs Direct Comparison Test
 * Compares authentication timing inside MCP vs direct execution
 */

import { submitHiveQuery, getJobStatus } from './src/services/query.js';

// Enable debug logging
process.env.LOG_LEVEL = 'debug';

async function testDirectExecution() {
  console.log('='.repeat(80));
  console.log('DIRECT EXECUTION TEST (Outside MCP)');
  console.log('='.repeat(80));
  
  const startTime = Date.now();
  
  try {
    // Test parameters (use invalid values to fail quickly)
    const projectId = 'test-project-invalid';
    const region = 'us-central1';
    const clusterName = 'nonexistent-cluster';
    const query = 'SELECT 1';
    
    console.log('\n1. Testing submitHiveQuery (should fail quickly with invalid project)...');
    const submitStartTime = Date.now();
    
    try {
      await submitHiveQuery(projectId, region, clusterName, query, {}, true);
      console.log('❌ Unexpected success with invalid project');
    } catch (error) {
      const submitDuration = Date.now() - submitStartTime;
      console.log(`✅ submitHiveQuery failed as expected: ${submitDuration}ms`);
      console.log(`   Error: ${error.message.substring(0, 100)}...`);
    }
    
    console.log('\n2. Testing getJobStatus (should fail quickly with invalid project)...');
    const statusStartTime = Date.now();
    
    try {
      await getJobStatus(projectId, region, 'fake-job-id');
      console.log('❌ Unexpected success with invalid project');
    } catch (error) {
      const statusDuration = Date.now() - statusStartTime;
      console.log(`✅ getJobStatus failed as expected: ${statusDuration}ms`);
      console.log(`   Error: ${error.message.substring(0, 100)}...`);
    }
    
    const totalDuration = Date.now() - startTime;
    console.log('\n' + '='.repeat(80));
    console.log(`TOTAL DIRECT TEST DURATION: ${totalDuration}ms`);
    console.log('='.repeat(80));
    
  } catch (error) {
    const totalDuration = Date.now() - startTime;
    console.error('\n' + '='.repeat(80));
    console.error(`❌ DIRECT TEST FAILED after ${totalDuration}ms`);
    console.error('Error:', error.message);
    console.error('='.repeat(80));
  }
}

// Add timeout to catch hanging operations
const TIMEOUT_MS = 60000; // 60 seconds
const timeoutId = setTimeout(() => {
  console.error('\n' + '='.repeat(80));
  console.error(`❌ DIRECT TEST TIMED OUT after ${TIMEOUT_MS}ms`);
  console.error('This indicates a hanging operation outside of MCP context');
  console.error('='.repeat(80));
  process.exit(1);
}, TIMEOUT_MS);

testDirectExecution()
  .then(() => {
    clearTimeout(timeoutId);
    console.log('\n✅ Direct execution test completed');
    console.log('\nNow test the same operations through MCP Inspector to compare timing...');
    process.exit(0);
  })
  .catch((error) => {
    clearTimeout(timeoutId);
    console.error('\n❌ Direct execution test failed:', error);
    process.exit(1);
  });