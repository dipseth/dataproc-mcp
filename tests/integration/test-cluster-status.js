/**
 * Test script for checking Dataproc cluster status
 */
// Enable debug logging
process.env.DEBUG = '*';

import { getCluster } from '../../build/services/cluster.js';

// Parameters from the task
const projectId = 'example-project-id';
const region = 'us-central1';
const clusterName = 'example-cluster';
const impersonateServiceAccount = 'example-service-account@example-project.iam.gserviceaccount.com';

async function testClusterStatus() {
  console.log('[DEBUG] testClusterStatus: script started');
  console.log(`Checking status of cluster: ${clusterName}`);
  console.log(`Project ID: ${projectId}`);
  console.log(`Region: ${region}`);
  console.log(`Using service account for impersonation: ${impersonateServiceAccount}`);

  try {
    // Add more detailed logging to help diagnose issues
    console.log('[DEBUG] testClusterStatus: before getCluster');
    const result = await getCluster(
      projectId,
      region,
      clusterName,
      impersonateServiceAccount
    );
    console.log('Cluster status check successful!');
    console.log('Cluster details:', JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error('[DEBUG] testClusterStatus: error caught');
    console.error('Error checking cluster status:', error);
    if (error && error.details) {
      console.error('Error details:', error.details);
    }
    throw error;
  }
}

// Execute the test
(async () => {
  try {
    await testClusterStatus();
    console.log('Test completed successfully');
  } catch (err) {
    console.error('Test failed:', err && err.message ? err.message : err);
    process.exit(1);
  }
})();