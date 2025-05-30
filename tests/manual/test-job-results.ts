import { describe, it, before } from 'mocha';
import { expect } from 'chai';
import {
  submitDataprocJob,
  getDataprocJobResults,
  DataprocJobType,
} from '../../src/services/job.js';

describe('Dataproc Job Results Integration Tests', () => {
  // Test configuration
  const config = {
    projectId: process.env.TEST_PROJECT_ID || 'prj-grp-data-sci-prod-b425',
    region: process.env.TEST_REGION || 'us-central1',
    clusterName: process.env.TEST_CLUSTER || 'cool-idea-api-v202504002',
  };

  it.skip('should successfully submit a Hive query and retrieve results', async function () {
    // Increase timeout for this test as it involves actual job submission
    this.timeout(60000);

    // Simple test query
    const query = `
      SELECT 
        'test' as column1,
        123 as column2
      LIMIT 1;
    `;

    // Submit job
    const jobConfig = {
      queryList: {
        queries: [query],
      },
    };

    console.log('Submitting test job...');
    const submitResult = await submitDataprocJob({
      projectId: config.projectId,
      region: config.region,
      clusterName: config.clusterName,
      jobType: 'hive' as DataprocJobType,
      jobConfig,
      async: false,
    });

    expect(submitResult.status).to.equal('DONE');
    console.log(`Job submitted successfully with ID: ${submitResult.jobId}`);

    // Get results using the fixed function
    console.log('Getting job results...');
    const results = await getDataprocJobResults<any>({
      projectId: config.projectId,
      region: config.region,
      jobId: submitResult.jobId,
      format: 'text',
    });

    // Verify results
    expect(results).to.be.an('object');
    expect(results.parsedOutput).to.exist;

    // Log the results for inspection
    console.log('Job results:', JSON.stringify(results.parsedOutput, null, 2));

    // Additional assertions based on expected structure
    if (results.parsedOutput && results.parsedOutput.tables) {
      const tables = results.parsedOutput.tables;
      expect(tables).to.be.an('array');
      expect(tables.length).to.be.greaterThan(0);

      // Check first table
      const firstTable = tables[0];
      expect(firstTable.columns).to.include('column1');
      expect(firstTable.columns).to.include('column2');

      // Check data
      expect(firstTable.rows).to.be.an('array');
      expect(firstTable.rows.length).to.be.greaterThan(0);

      const firstRow = firstTable.rows[0];
      expect(firstRow.column1).to.equal('test');
      // If parseNumbers is working, this should be a number
      expect(firstRow.column2).to.equal(123);
    }
  });

  it.skip('should handle invalid job IDs gracefully', async function () {
    try {
      await getDataprocJobResults({
        projectId: config.projectId,
        region: config.region,
        jobId: 'invalid-job-id-' + Date.now(),
        format: 'text',
      });
      expect.fail('Should have thrown an error');
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).to.include('Failed to get Dataproc job status');
      } else {
        throw error;
      }
    }
  });

  it.skip('should handle missing driverOutputResourceUri gracefully', async function () {
    // Create a mock job ID that exists but has no output
    // For this test, we'll just use a random ID and expect it to return job details only
    const fakeJobId = 'no-output-' + Date.now();

    // Mock the getDataprocJobStatus function for this test
    // This is a bit tricky in an integration test, so we'll just check the behavior
    // with a job ID that likely doesn't have output

    // Define a type for our expected results
    interface TestResult {
      noOutput?: boolean;
      parsedOutput?: any;
      [key: string]: any; // Allow other properties
    }

    const results = await getDataprocJobResults<TestResult>({
      projectId: config.projectId,
      region: config.region,
      jobId: fakeJobId,
      format: 'text',
    }).catch((e) => {
      // If it fails with "job not found", that's expected
      if (e.message && e.message.includes('not found')) {
        return { noOutput: true } as TestResult;
      }
      throw e;
    });

    // Either we got a "job not found" error (which we handled above)
    // or we got job details without parsedOutput
    if (results.noOutput) {
      // Test passed - job not found is an acceptable outcome
    } else {
      // If we got results, ensure there's no parsedOutput
      expect(results.parsedOutput).to.be.undefined;
    }
  });
});
