import { describe, it, before, after } from 'mocha';
import { expect } from 'chai';
import {
  submitDataprocJob,
  getDataprocJobResults,
  DataprocJobType,
} from '../../src/services/job.js';
import { JobOutputHandler } from '../../src/services/job-output-handler.js';
import { GCSError } from '../../src/types/gcs-types.js';

describe('Job Output Handler Integration Tests', () => {
  // Test configuration
  const config = {
    projectId: process.env.TEST_PROJECT_ID || 'prj-grp-data-sci-prod-b425',
    region: process.env.TEST_REGION || 'us-central1',
    clusterName: process.env.TEST_CLUSTER || 'pricing-api-v202504002',
  };

  let outputHandler: JobOutputHandler;

  before(() => {
    outputHandler = new JobOutputHandler({
      enabled: true,
      maxFileSize: 1024 * 1024, // 1MB for testing
      totalSize: 5 * 1024 * 1024, // 5MB for testing
      ttl: 300, // 5 minutes
    });
  });

  after(() => {
    outputHandler.destroy();
  });

  it.skip('should successfully submit a Hive query and retrieve results with caching', async () => {
    // Test query
    const query = `
      SELECT 
        report_date,
        inventory_product_id,
        COUNT(*) as count
      FROM grp_gdoop_local_ds_db.ils_superset_v2_prod 
      WHERE report_date >= '2025-04-30'
      GROUP BY report_date, inventory_product_id
      LIMIT 5;
    `;

    // Submit job
    const jobConfig = {
      queryList: {
        queries: [query],
      },
    };

    const submitResult = await submitDataprocJob({
      projectId: config.projectId,
      region: config.region,
      clusterName: config.clusterName,
      jobType: 'hive' as DataprocJobType,
      jobConfig,
      async: false,
    });

    expect(submitResult.status).to.equal('DONE');

    // Get results with cache enabled
    const firstResults = await getDataprocJobResults<any[]>({
      projectId: config.projectId,
      region: config.region,
      jobId: submitResult.jobId,
      format: 'csv',
      useCache: true,
      parseNumbers: true,
    });

    expect(firstResults).to.be.an('array');
    expect(firstResults).to.have.length.greaterThan(0);

    // Check cache stats
    const stats = outputHandler.getCacheStats();
    expect(stats.hits).to.equal(0);
    expect(stats.size).to.be.greaterThan(0);

    // Get results again to verify caching
    const secondResults = await getDataprocJobResults<any[]>({
      projectId: config.projectId,
      region: config.region,
      jobId: submitResult.jobId,
      format: 'csv',
      useCache: true,
      parseNumbers: true,
    });

    expect(secondResults).to.deep.equal(firstResults);

    // Check cache hit
    const updatedStats = outputHandler.getCacheStats();
    expect(updatedStats.hits).to.equal(1);
  });

  it.skip('should handle invalid job results gracefully', async () => {
    try {
      await getDataprocJobResults({
        projectId: config.projectId,
        region: config.region,
        jobId: 'invalid-job-id',
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

  it.skip('should respect cache size limits', async () => {
    // Submit a job that produces large output
    const query = `
      SELECT *
      FROM grp_gdoop_local_ds_db.ils_superset_v2_prod 
      WHERE report_date >= '2025-04-30'
      LIMIT 1000;
    `;

    const jobConfig = {
      queryList: {
        queries: [query],
      },
    };

    const submitResult = await submitDataprocJob({
      projectId: config.projectId,
      region: config.region,
      clusterName: config.clusterName,
      jobType: 'hive' as DataprocJobType,
      jobConfig,
      async: false,
    });

    const results = await getDataprocJobResults<any[]>({
      projectId: config.projectId,
      region: config.region,
      jobId: submitResult.jobId,
      format: 'csv',
      useCache: true,
    });

    expect(results).to.be.an('array');

    const stats = outputHandler.getCacheStats();
    expect(stats.totalSize).to.be.lessThanOrEqual(5 * 1024 * 1024); // Should not exceed 5MB
  });
});
