// Simple script to test the getDataprocJobResults function directly
import { submitDataprocJob, getDataprocJobResults } from './build/services/job.js';

// Test configuration
const config = {
  projectId: 'prj-grp-data-sci-prod-b425',
  region: 'us-central1',
  clusterName: 'ds-pnp-aog-search-cluster'
};

// Simple test query
const query = `
  SELECT 
    'test' as column1,
    123 as column2
  LIMIT 1;
`;

async function runTest() {
  try {
    // Instead of submitting a new job, use an existing job ID
    const jobId = '65c60e00-7549-44e4-82d8-0fbab0a9ceba';
    console.log(`Using existing job ID: ${jobId}`);

    // Get results using the fixed function
    console.log('\nGetting job results...');
    
    // Add explicit logging for the service account being used
    console.log('Using service account for impersonation:',
      'grpn-sa-ds-mwaa-dataproc@prj-grp-central-sa-prod-0b25.iam.gserviceaccount.com');
    
    try {
      const results = await getDataprocJobResults({
        projectId: config.projectId,
        region: config.region,
        jobId: jobId,
        format: 'text',
        wait: true  // Add wait parameter to ensure job completion
      });
      
      // Log the keys in the results object
      console.log('Result keys:', Object.keys(results));
      
      // Check if driverOutputResourceUri exists
      if (results.driverOutputResourceUri) {
        console.log('Driver output URI:', results.driverOutputResourceUri);
      } else {
        console.log('No driver output URI found in results');
      }
      
      // Verify results
      console.log('\nJob results received:');
      console.log('Has parsedOutput:', !!results.parsedOutput);
      
      if (results.parsedOutput) {
        console.log('\nParsed output:', JSON.stringify(results.parsedOutput, null, 2));
        console.log('\n✅ TEST PASSED: Successfully retrieved and parsed job output');
      } else {
        console.log('\n❌ TEST FAILED: Could not retrieve parsed output');
        console.log('Raw results:', JSON.stringify(results, null, 2));
      }
    } catch (error) {
      console.error('\n❌ TEST FAILED with error:', error.message);
      console.error('Error details:', error);
    }
  } catch (error) {
    console.error('\n❌ TEST FAILED with error:', error.message);
    console.error('Error details:', error);
  }
}

runTest();