// Simple test to fetch and parse Dataproc job output using jobId and driverControlFilesUri

import { getDataprocJobResults } from './build/services/job.js';

const jobId = '65c60e00-7549-44e4-82d8-0fbab0a9ceba';
const projectId = 'prj-grp-data-sci-prod-b425';
const region = 'us-central1';

async function run() {
  try {
    console.log('Fetching job results for jobId:', jobId);
    const results = await getDataprocJobResults({
      projectId,
      region,
      jobId,
      format: 'text',
      wait: true
    });

    console.log('\nJob details:');
    console.log(JSON.stringify({
      reference: results.reference,
      placement: results.placement,
      hiveJob: results.hiveJob,
      status: results.status,
      statusHistory: results.statusHistory,
      driverControlFilesUri: results.driverControlFilesUri,
      driverOutputResourceUri: results.driverOutputResourceUri,
      jobUuid: results.jobUuid,
      done: results.done
    }, null, 2));

    if (results.parsedOutput) {
      console.log('\nParsed output:');
      console.log(JSON.stringify(results.parsedOutput, null, 2));
    } else {
      console.log('\n❌ TEST FAILED: No parsed output found');
    }
  } catch (err) {
    console.error('Error fetching job results:', err);
  }
}

run();