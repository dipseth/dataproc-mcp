/**
 * Test script for Dataproc cluster creation using YAML configuration
 */
// Enable debug logging for google-auth-library and related modules
process.env.DEBUG = '*';

import { createClusterFromYaml } from '../../build/services/cluster.js';


// Parameters from the task
const projectId = 'example-project-id';
const region = 'us-central1';
const yamlPath = 'docs/examples/configs/cluster-config-corrected.yaml';
const impersonateServiceAccount = 'example-service-account@example-project.iam.gserviceaccount.com';

async function testClusterCreation() {
  console.log('[DEBUG] testClusterCreation: script started');
  console.log(`Testing cluster creation with YAML: ${yamlPath}`);
  console.log(`Project ID: ${projectId}`);
  console.log(`Region: ${region}`);

  try {
    // Add more detailed logging to help diagnose issues
    console.log('[DEBUG] testClusterCreation: before createClusterFromYaml');
    console.log('[DEBUG] Using impersonateServiceAccount:', impersonateServiceAccount);
    const result = await createClusterFromYaml(
      projectId,
      region,
      yamlPath,
      undefined,
      impersonateServiceAccount
    );
    console.log('Cluster creation successful!');
    console.log('Cluster details:', JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error('[DEBUG] testClusterCreation: error caught');
    console.error('Error creating cluster:', error);
    if (error && error.details) {
      console.error('Error details:', error.details);
    }
    throw error;
  }
}

// Execute the test
(async () => {
  try {
    await testClusterCreation();
    console.log('Test completed successfully');
  } catch (err) {
    console.error('Test failed:', err && err.message ? err.message : err);
    process.exit(1);
  }
})();