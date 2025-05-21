// Simple test script to verify the getDataprocJobResults function works
import { submitDataprocJob, getDataprocJobResults } from './src/services/job.js';

// Test configuration
const config = {
  projectId: process.env.TEST_PROJECT_ID || 'prj-grp-data-sci-prod-b425',
  region: process.env.TEST_REGION || 'us-central1',
  clusterName: process.env.TEST_CLUSTER || 'pricing-api-v202504002'
};

// Simple test query
const query = `
  SELECT 
    'test' as column1,
    123 as column2
  LIMIT 1;
`;

// Main test function
async function runTest() {
  try {
    console.log('Submitting test job...');
    const jobConfig = {
      queryList: {
        queries: [query]
      }
    };

    const submitResult = await submitDataprocJob({
      projectId: config.projectId,
      region: config.region,
      clusterName: config.clusterName,
      jobType: 'hive',
      jobConfig,
      async: false
    });

    console.log(`Job submitted successfully with ID: ${submitResult.jobId}`);
    console.log('Job status:', submitResult.status);

    // Get results using the fixed function
    console.log('Getting job results...');
    const results = await getDataprocJobResults({
      projectId: config.projectId,
      region: config.region,
      jobId: submitResult.jobId,
      format: 'text'
    });

    // Log the results
    console.log('Job results:');
    console.log(JSON.stringify(results, null, 2));

    if (results.parsedOutput) {
      console.log('✅ Test PASSED: Successfully retrieved and parsed job output');
    } else {
      console.log('❌ Test FAILED: Could not retrieve parsed output');
    }
  } catch (error) {
    console.error('Test failed with error:', error);
    process.exit(1);
  }
}

// Run the test
runTest();