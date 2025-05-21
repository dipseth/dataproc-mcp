# Manual Test Instructions for Dataproc Job Results Fix

This document provides instructions for manually testing the fix for the `getDataprocJobResults` function.

## Prerequisites

1. Make sure you have built the server:
   ```
   npm run build
   ```

2. Start the server using the MCP inspector:
   ```
   npx @modelcontextprotocol/inspector build/index.js
   ```

## Test Steps

1. **Submit a test job**

   Open a new terminal and run:
   ```bash
   curl -X POST http://localhost:6274/tools/submit_dataproc_job -H "Content-Type: application/json" -d '{
     "projectId": "prj-grp-data-sci-prod-b425",
     "region": "us-central1",
     "clusterName": "pricing-api-v202504002",
     "jobType": "hive",
     "jobConfig": {
       "queryList": {
         "queries": ["SELECT \"test\" as column1, 123 as column2 LIMIT 1;"]
       }
     },
     "async": false
   }'
   ```

   This will submit a simple Hive query job and return a job ID.

2. **Get the job results**

   Using the job ID from the previous step, run:
   ```bash
   curl -X POST http://localhost:6274/tools/get_job_results -H "Content-Type: application/json" -d '{
     "projectId": "prj-grp-data-sci-prod-b425",
     "region": "us-central1",
     "jobId": "YOUR_JOB_ID_HERE"
   }'
   ```

   Replace `YOUR_JOB_ID_HERE` with the actual job ID from step 1.

## Expected Results

The response from the `get_job_results` call should include a `parsedOutput` field with the properly processed job results. This indicates that our fix is working correctly.

The `parsedOutput` should contain:
- A `tables` array with at least one table
- The table should have `columns` including "column1" and "column2"
- The table should have `rows` with values "test" and 123

## What Was Fixed

The original issue was in `src/services/job.ts` where:
1. `GCSService.downloadFile` was being called incorrectly as a static method
2. It was passing bucket and path as separate parameters instead of a single GCS URI
3. It was trying to pass a Buffer directly to the processing function

The fix replaced this manual code with a call to the existing `outputHandler.getJobOutput` method, which properly handles downloading and parsing job outputs.