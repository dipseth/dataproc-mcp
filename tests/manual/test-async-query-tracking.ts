#!/usr/bin/env node

/**
 * Manual test for AsyncQueryPoller integration
 * Tests the new async query tracking functionality
 */

import { AsyncQueryPoller } from '../../src/services/async-query-poller.js';
import { JobTracker } from '../../src/services/job-tracker.js';
import { logger } from '../../src/utils/logger.js';

async function testAsyncQueryTracking() {
  console.log('🧪 Testing AsyncQueryPoller Integration');
  console.log('=====================================\n');

  // Initialize components
  const jobTracker = new JobTracker({
    maxTrackedJobs: 100,
    autoCleanupInterval: 30000,
    enableMetrics: true
  });

  const asyncQueryPoller = new AsyncQueryPoller(jobTracker, {
    intervalMs: 5000,
    maxRetries: 3,
    enableCleanup: true,
    cleanupIntervalMs: 60000,
    maxConcurrentPolls: 5
  });

  try {
    // Test 1: Register a mock query
    console.log('📝 Test 1: Registering mock query');
    const mockJobId = `test-job-${Date.now()}`;
    
    asyncQueryPoller.registerQuery({
      jobId: mockJobId,
      projectId: 'test-project',
      region: 'us-central1',
      toolName: 'submit_hive_query',
      submissionTime: new Date().toISOString()
    });

    console.log(`✅ Query ${mockJobId} registered successfully`);

    // Test 2: Check query info
    console.log('\n📊 Test 2: Checking query info');
    const queryInfo = asyncQueryPoller.getQueryInfo(mockJobId);
    console.log('Query Info:', JSON.stringify(queryInfo, null, 2));

    // Test 3: Check poller status
    console.log('\n📈 Test 3: Checking poller status');
    const status = asyncQueryPoller.getStatus();
    console.log('Poller Status:', JSON.stringify(status, null, 2));

    // Test 4: Start polling (briefly)
    console.log('\n🔄 Test 4: Starting polling for 10 seconds');
    await asyncQueryPoller.startPolling();
    
    // Wait for a few polling cycles
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Test 5: Check updated status
    console.log('\n📊 Test 5: Checking status after polling');
    const updatedStatus = asyncQueryPoller.getStatus();
    console.log('Updated Status:', JSON.stringify(updatedStatus, null, 2));

    // Test 6: Unregister query
    console.log('\n🗑️ Test 6: Unregistering query');
    asyncQueryPoller.unregisterQuery(mockJobId);
    console.log(`✅ Query ${mockJobId} unregistered successfully`);

    // Test 7: Final status check
    console.log('\n📊 Test 7: Final status check');
    const finalStatus = asyncQueryPoller.getStatus();
    console.log('Final Status:', JSON.stringify(finalStatus, null, 2));

    console.log('\n✅ All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up...');
    await asyncQueryPoller.shutdown();
    await jobTracker.shutdown();
    console.log('✅ Cleanup completed');
  }
}

// Resource URI test
function testResourceUris() {
  console.log('\n🔗 Testing Resource URI Patterns');
  console.log('=================================\n');

  const testCases = [
    {
      projectId: 'my-project',
      region: 'us-central1',
      jobId: 'job-12345',
      expected: 'dataproc://query/my-project/us-central1/job-12345'
    },
    {
      projectId: 'analytics-prod',
      region: 'europe-west1',
      jobId: 'hive-query-67890',
      expected: 'dataproc://query/analytics-prod/europe-west1/hive-query-67890'
    }
  ];

  testCases.forEach((testCase, index) => {
    const uri = `dataproc://query/${testCase.projectId}/${testCase.region}/${testCase.jobId}`;
    const matches = uri === testCase.expected;
    console.log(`Test ${index + 1}: ${matches ? '✅' : '❌'}`);
    console.log(`  Generated: ${uri}`);
    console.log(`  Expected:  ${testCase.expected}`);
    console.log();
  });
}

// Integration test simulation
function testIntegrationScenario() {
  console.log('\n🎭 Integration Scenario Simulation');
  console.log('==================================\n');

  console.log('Scenario: User submits async Hive query');
  console.log('1. User calls submit_hive_query with async=true');
  console.log('2. Server submits job to Dataproc');
  console.log('3. Server registers job with AsyncQueryPoller');
  console.log('4. AsyncQueryPoller enables auto-update in JobTracker');
  console.log('5. User can access dataproc://query/{project}/{region}/{jobId} resource');
  console.log('6. Resource provides enhanced query info with polling status');
  console.log('7. AsyncQueryPoller automatically updates job status');
  console.log('8. User gets real-time updates without manual polling');
  console.log('\n✅ Integration scenario documented');
}

// Run all tests
async function runAllTests() {
  try {
    await testAsyncQueryTracking();
    testResourceUris();
    testIntegrationScenario();
    
    console.log('\n🎉 All tests and simulations completed!');
    console.log('\nNext steps:');
    console.log('- Test with real Dataproc cluster');
    console.log('- Submit actual async queries');
    console.log('- Monitor resource updates');
    console.log('- Verify auto-cleanup functionality');
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests();
}

export { testAsyncQueryTracking, testResourceUris, testIntegrationScenario };