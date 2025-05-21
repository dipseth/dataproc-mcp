// This is a simple script to verify that the fix works by using the MCP server
// It doesn't import the TypeScript modules directly, avoiding module resolution issues

import { execSync } from 'child_process';
import { spawn } from 'child_process';

console.log('Verifying the fix for getDataprocJobResults function');
console.log('---------------------------------------------------');

// Step 1: Start the server in the background
console.log('Step 1: Building and starting the server...');
try {
  // Build the server first
  execSync('npm run build', { stdio: 'inherit' });
  
  // Start the server in the background
  const serverProcess = spawn('node', ['build/index.js'], {
    detached: true,
    stdio: 'ignore'
  });
  
  // Unref the child process so it can run independently
  serverProcess.unref();
  
  console.log('Server started in the background');
  
  // Give the server a moment to start up
  console.log('Waiting for server to start...');
  execSync('sleep 3');
  
  // Step 2: Use the MCP tool to submit a job
  console.log('\nStep 2: Submitting a test job...');
  const submitResult = execSync(`
    curl -s -X POST http://localhost:3000/tools/submit_dataproc_job -H "Content-Type: application/json" -d '{
      "projectId": "prj-grp-data-sci-prod-b425",
      "region": "us-central1",
      "clusterName": "pricing-api-v202504002",
      "jobType": "hive",
      "jobConfig": {
        "queryList": {
          "queries": ["SELECT \\"test\\" as column1, 123 as column2 LIMIT 1;"]
        }
      },
      "async": false
    }'
  `);
  
  const jobResult = JSON.parse(submitResult);
  console.log('Job submitted successfully!');
  console.log('Job ID:', jobResult.jobId);
  
  // Step 3: Get the job results using our fixed function
  console.log('\nStep 3: Getting job results...');
  const resultsResponse = execSync(`
    curl -s -X POST http://localhost:3000/tools/get_job_results -H "Content-Type: application/json" -d '{
      "projectId": "prj-grp-data-sci-prod-b425",
      "region": "us-central1",
      "jobId": "${jobResult.jobId}"
    }'
  `);
  
  const results = JSON.parse(resultsResponse);
  console.log('Job results retrieved successfully!');
  
  // Step 4: Verify the results
  console.log('\nStep 4: Verifying results...');
  if (results.parsedOutput) {
    console.log('✅ TEST PASSED: Successfully retrieved and parsed job output');
    console.log('Parsed output:', JSON.stringify(results.parsedOutput, null, 2));
  } else {
    console.log('❌ TEST FAILED: Could not retrieve parsed output');
    console.log('Raw results:', JSON.stringify(results, null, 2));
  }
  
  // Step 5: Clean up - kill the server
  console.log('\nStep 5: Cleaning up...');
  execSync('pkill -f "node build/index.js"', { stdio: 'inherit' });
  
  console.log('\nVerification complete!');
} catch (error) {
  console.error('Error during verification:', error.message);
  console.error('Command output:', error.stdout ? error.stdout.toString() : 'No output');
  
  // Try to clean up the server process if it's still running
  try {
    execSync('pkill -f "node build/index.js"', { stdio: 'ignore' });
  } catch (cleanupError) {
    // Ignore cleanup errors
  }
  
  process.exit(1);
}