// Mock test for the JobOutputHandler functionality
import { JobOutputHandler } from './build/src/services/job-output-handler.js';
import fs from 'fs';
import path from 'path';

// Create a sample output file if it doesn't exist
const outputDir = './output/test-job';
const outputFile = path.join(outputDir, 'driveroutput.000000000');
const gcsUri = `gs://mock-bucket/jobs/test-job/driveroutput.000000000`;

// Sample Hive output content
const sampleOutput = `
+---------------+---------------+
| column1       | column2       |
+---------------+---------------+
| test          | 123           |
+---------------+---------------+
1 row selected (0.123 seconds)
`;

// Mock the GCSService to avoid actual GCS calls
class MockGCSService {
  async getFileMetadata() {
    return {
      name: 'driveroutput.000000000',
      size: sampleOutput.length,
      contentType: 'text/plain',
      updated: new Date(),
      md5Hash: 'mock-hash'
    };
  }

  async downloadFile() {
    return Buffer.from(sampleOutput);
  }

  parseUri(uri) {
    return { bucket: 'mock-bucket', path: 'jobs/test-job/driveroutput.000000000', uri };
  }

  async detectOutputFormat() {
    return 'text';
  }
}

// Create a subclass of JobOutputHandler with our mock GCS service
class TestJobOutputHandler extends JobOutputHandler {
  constructor() {
    super();
    this.gcsService = new MockGCSService();
  }
}

async function runTest() {
  try {
    console.log('Testing JobOutputHandler with mock data...');
    
    // Create an instance of our test handler
    const outputHandler = new TestJobOutputHandler();
    
    // Test the getJobOutput method
    console.log('Getting job output...');
    const output = await outputHandler.getJobOutput(
      gcsUri,
      'text',
      {
        useCache: false,
        parseNumbers: true
      }
    );
    
    console.log('\nJob output retrieved:');
    console.log(JSON.stringify(output, null, 2));
    
    // Verify the output structure
    if (output && output.tables && output.tables.length > 0) {
      const table = output.tables[0];
      if (table.columns.includes('column1') && table.columns.includes('column2')) {
        console.log('\n✅ TEST PASSED: Output correctly parsed with expected structure');
      } else {
        console.log('\n❌ TEST FAILED: Output structure is not as expected');
      }
    } else {
      console.log('\n❌ TEST FAILED: Output does not contain tables');
    }
    
    // This simulates what the fixed getDataprocJobResults function does
    console.log('\nSimulating fixed getDataprocJobResults function...');
    const jobDetails = {
      driverOutputResourceUri: gcsUri,
      status: { state: 'DONE' },
      jobId: 'test-job-id'
    };
    
    // This is similar to what the fixed code does
    const parsedOutput = await outputHandler.getJobOutput(
      jobDetails.driverOutputResourceUri,
      'text',
      { useCache: true }
    );
    
    const results = {
      ...jobDetails,
      parsedOutput
    };
    
    console.log('\nSimulated job results:');
    console.log(JSON.stringify(results, null, 2));
    
    if (results.parsedOutput) {
      console.log('\n✅ TEST PASSED: Fixed code approach successfully retrieves and parses output');
    } else {
      console.log('\n❌ TEST FAILED: Fixed code approach failed to retrieve parsed output');
    }
    
  } catch (error) {
    console.error('\n❌ TEST FAILED with error:', error.message);
    console.error('Error details:', error);
  }
}

runTest();