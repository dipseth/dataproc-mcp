#!/bin/bash

# This script tests the getDataprocJobResults function fix
# It assumes the server is already running using:
# npx @modelcontextprotocol/inspector build/index.js

# Set environment variables for testing
export TEST_PROJECT_ID="prj-grp-data-sci-prod-b425"
export TEST_REGION="us-central1"
export TEST_CLUSTER="cool-idea-api-v202504002"

echo "Testing getDataprocJobResults fix..."
echo "====================================="
echo "Submitting a test job..."

# Submit a test job
SUBMIT_RESPONSE=$(curl -s -X POST http://localhost:6274/tools/submit_dataproc_job -H "Content-Type: application/json" -d '{
  "projectId": "'$TEST_PROJECT_ID'",
  "region": "'$TEST_REGION'",
  "clusterName": "'$TEST_CLUSTER'",
  "jobType": "hive",
  "jobConfig": {
    "queryList": {
      "queries": ["SELECT \"test\" as column1, 123 as column2 LIMIT 1;"]
    }
  },
  "async": false
}')

# Extract job ID from response
JOB_ID=$(echo $SUBMIT_RESPONSE | grep -o '"jobId":"[^"]*"' | cut -d'"' -f4)

if [ -z "$JOB_ID" ]; then
  echo "Failed to get job ID from response:"
  echo "$SUBMIT_RESPONSE"
  exit 1
fi

echo "Job submitted successfully with ID: $JOB_ID"
echo "Getting job results..."

# Get job results
RESULTS_RESPONSE=$(curl -s -X POST http://localhost:6274/tools/get_job_results -H "Content-Type: application/json" -d '{
  "projectId": "'$TEST_PROJECT_ID'",
  "region": "'$TEST_REGION'",
  "jobId": "'$JOB_ID'"
}')

# Check if parsedOutput exists in the response
if echo "$RESULTS_RESPONSE" | grep -q "parsedOutput"; then
  echo "✅ TEST PASSED: Successfully retrieved and parsed job output"
  echo "Results preview:"
  echo "$RESULTS_RESPONSE" | grep -o '"parsedOutput":{[^}]*}' | head -n 20
else
  echo "❌ TEST FAILED: Could not retrieve parsed output"
  echo "Raw response:"
  echo "$RESULTS_RESPONSE"
  exit 1
fi

echo "Test completed successfully!"