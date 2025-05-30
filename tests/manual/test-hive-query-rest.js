/**
 * Test script for submitting a Hive query to a Dataproc cluster using direct REST API calls
 */
// Enable debug logging
process.env.DEBUG = '*';

import { getGcloudAccessToken } from '../../build/config/credentials.js';
import fetch from 'node-fetch';

// Parameters from the task
const projectId = 'example-project-id';
const region = 'us-central1';
const clusterName = 'example-cluster';
const query = "SELECT * FROM example_table WHERE submitted_date >= '2025-01-01' LIMIT 10;";

async function submitHiveQueryWithRest() {
  console.log('[DEBUG] submitHiveQueryWithRest: Starting with params:', {
    projectId,
    region,
    clusterName,
    queryLength: query.length
  });
  
  console.log('[DEBUG] submitHiveQueryWithRest: Getting token from gcloud CLI');
  const token = getGcloudAccessToken();
  
  // Ensure the URL is correctly formed with the full domain and :submit suffix
  const url = `https://${region}-dataproc.googleapis.com/v1/projects/${projectId}/regions/${region}/jobs:submit`;
  
  console.log('[DEBUG] submitHiveQueryWithRest: Making REST API request to:', url);
  console.log('[DEBUG] submitHiveQueryWithRest: Request method: POST');
  console.log('[DEBUG] submitHiveQueryWithRest: Authorization header: Bearer [token]');
  
  // Create the Hive job configuration
  const hiveJob = {
    queryList: {
      queries: [query],
    },
  };
  
  // Create the job submission request
  const requestBody = {
    job: {
      placement: {
        clusterName,
      },
      hiveJob,
      labels: {
        'created-by': 'dataproc-mcp-server',
      },
    },
  };
  
  console.log('[DEBUG] submitHiveQueryWithRest: Request body:', JSON.stringify(requestBody, null, 2));
  
  // Log the full request details
  console.log('[DEBUG] submitHiveQueryWithRest: Making fetch request with:');
  console.log('- URL:', url);
  console.log('- Method: POST');
  console.log('- Headers: Authorization and Content-Type');
  console.log('- Body length:', JSON.stringify(requestBody).length);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    console.log('[DEBUG] submitHiveQueryWithRest: Received response with status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[DEBUG] submitHiveQueryWithRest: API error:', response.status, errorText);
      console.error('[DEBUG] submitHiveQueryWithRest: Response headers:', JSON.stringify(Object.fromEntries([...response.headers]), null, 2));
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();
    console.log('[DEBUG] submitHiveQueryWithRest: API request successful');
    return result;
  } catch (error) {
    console.error('[DEBUG] submitHiveQueryWithRest: Error:', error);
    throw error;
  }
}

async function testHiveQuery() {
  console.log('[DEBUG] testHiveQuery: script started');
  console.log(`Submitting query to cluster: ${clusterName}`);
  console.log(`Project ID: ${projectId}`);
  console.log(`Region: ${region}`);
  console.log(`Query: ${query}`);

  try {
    // Submit the query using direct REST API
    console.log('[DEBUG] testHiveQuery: Submitting query using direct REST API...');
    const job = await submitHiveQueryWithRest();
    
    console.log('Query submitted successfully!');
    console.log('Job ID:', job.reference?.jobId);
    
    return job;
  } catch (error) {
    console.error('[DEBUG] testHiveQuery: error caught');
    console.error('Error executing Hive query:', error);
    throw error;
  }
}

// Execute the test
(async () => {
  try {
    await testHiveQuery();
    console.log('Test completed successfully');
  } catch (err) {
    console.error('Test failed:', err && err.message ? err.message : err);
    process.exit(1);
  }
})();