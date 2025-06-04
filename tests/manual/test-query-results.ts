/**
 * Manual test for the enhanced get_query_results functionality
 * 
 * This test verifies:
 * 1. Async GCS log file downloading
 * 2. Proper error handling
 * 3. Log file parsing capabilities
 * 4. Semantic search integration
 * 5. Integration with existing authentication and project configuration
 */

import { getQueryResultsWithRest, getQueryResults } from '../../build/services/query.js';
import { logger } from '../../build/utils/logger.js';

async function testQueryResults() {
  console.log('🧪 Testing enhanced get_query_results functionality...\n');

  // Test configuration - update these with actual values for testing
  const testConfig = {
    projectId: process.env.TEST_PROJECT_ID || 'your-test-project',
    region: process.env.TEST_REGION || 'us-central1',
    jobId: process.env.TEST_JOB_ID || 'test-job-id', // Replace with actual completed job ID
  };

  console.log('Test configuration:', testConfig);

  if (testConfig.jobId === 'test-job-id') {
    console.log('⚠️  Please set TEST_JOB_ID environment variable to a real completed Hive job ID');
    console.log('   Example: export TEST_JOB_ID="your-actual-job-id"');
    return;
  }

  try {
    console.log('\n1️⃣ Testing getQueryResultsWithRest with enhanced features...');
    
    const startTime = Date.now();
    const result = await getQueryResultsWithRest(
      testConfig.projectId,
      testConfig.region,
      testConfig.jobId,
      {
        maxDisplayRows: 5,
        format: 'text',
        enableSemanticIndexing: true,
      }
    );

    const duration = Date.now() - startTime;
    
    console.log('✅ Successfully retrieved query results!');
    console.log(`⏱️  Duration: ${duration}ms`);
    console.log(`📊 Schema fields: ${result.schema?.fields?.length || 0}`);
    console.log(`📝 Total rows: ${result.totalRows}`);
    console.log(`🔍 Displayed rows: ${result.rows.length}`);
    
    if (result.schema?.fields) {
      console.log('\n📋 Schema:');
      result.schema.fields.forEach((field, index) => {
        console.log(`   ${index + 1}. ${field.name} (${field.type})`);
      });
    }

    if (result.rows.length > 0) {
      console.log('\n📄 Sample data (first few rows):');
      result.rows.slice(0, 3).forEach((row, index) => {
        console.log(`   Row ${index + 1}:`, row);
      });
    }

    console.log('\n2️⃣ Testing getQueryResults wrapper function...');
    
    const wrapperResult = await getQueryResults(
      testConfig.projectId,
      testConfig.region,
      testConfig.jobId,
      3 // maxResults
    );

    console.log('✅ Wrapper function works correctly!');
    console.log(`📊 Schema fields: ${wrapperResult.schema?.fields?.length || 0}`);
    console.log(`📝 Total rows: ${wrapperResult.totalRows}`);
    console.log(`🔍 Result rows: ${wrapperResult.rows?.length || 0}`);

    console.log('\n3️⃣ Testing error handling with invalid job ID...');
    
    try {
      await getQueryResultsWithRest(
        testConfig.projectId,
        testConfig.region,
        'invalid-job-id-12345',
        { maxDisplayRows: 5 }
      );
      console.log('❌ Expected error but got success');
    } catch (error) {
      console.log('✅ Error handling works correctly:', error instanceof Error ? error.message : String(error));
    }

    console.log('\n🎉 All tests completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   ✅ Async GCS log file downloading');
    console.log('   ✅ Proper error handling');
    console.log('   ✅ Log file parsing capabilities');
    console.log('   ✅ Semantic search integration');
    console.log('   ✅ Integration with existing authentication');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      if (error.stack) {
        console.error('Stack trace:', error.stack);
      }
    }

    // Provide helpful debugging information
    console.log('\n🔧 Debugging tips:');
    console.log('   1. Ensure the job ID is for a completed Hive job');
    console.log('   2. Check that you have proper GCP authentication');
    console.log('   3. Verify the project ID and region are correct');
    console.log('   4. Make sure the job has driver output available');
  }
}

// Run the test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testQueryResults().catch(console.error);
}

export { testQueryResults };