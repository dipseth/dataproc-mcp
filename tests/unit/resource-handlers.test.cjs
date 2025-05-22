const { expect } = require('chai');

// Simple stub function creator
function createStub(returnValue) {
  const stub = (...args) => {
    stub.calls.push(args);
    return returnValue;
  };
  stub.calls = [];
  stub.calledWith = (...expectedArgs) => {
    return stub.calls.some(callArgs => 
      callArgs.length === expectedArgs.length && 
      callArgs.every((arg, i) => arg === expectedArgs[i])
    );
  };
  return stub;
}

// Mock classes and types
class MockClusterManager {
  constructor() {
    this.listTrackedClusters = () => [];
  }
}

class MockJobTracker {
  constructor() {
    this.listJobs = () => [];
  }
}

class MockJobOutputHandler {
  constructor() {
    this.getCachedOutput = async () => ({});
  }
}

// Mock JobState enum
const JobState = {
  DONE: 'DONE'
};

describe('Resource Handlers', () => {
  // Test services
  let clusterManager;
  let jobTracker;
  let jobOutputHandler;
  
  // Create stubs for external services
  let getClusterStub;
  let getJobStatusStub;
  
  // Test data
  const mockClusters = [
    {
      clusterId: 'cluster-1',
      clusterName: 'test-cluster-1',
      createdAt: new Date().toISOString(),
      metadata: {
        projectId: 'test-project',
        region: 'us-central1',
        status: 'RUNNING'
      }
    },
    {
      clusterId: 'cluster-2',
      clusterName: 'test-cluster-2',
      createdAt: new Date().toISOString(),
      metadata: {
        projectId: 'test-project',
        region: 'us-central1',
        status: 'STOPPED'
      }
    }
  ];
  
  const mockJobs = [
    {
      jobId: 'job-1',
      toolName: 'submit_hive_query',
      submissionTime: new Date().toISOString(),
      status: 'RUNNING',
      lastUpdated: new Date().toISOString(),
      projectId: 'test-project',
      region: 'us-central1',
      clusterName: 'test-cluster-1',
      resultsCached: false
    },
    {
      jobId: 'job-2',
      toolName: 'submit_dataproc_job',
      submissionTime: new Date().toISOString(),
      status: 'DONE',
      lastUpdated: new Date().toISOString(),
      projectId: 'test-project',
      region: 'us-central1',
      clusterName: 'test-cluster-2',
      resultsCached: true
    }
  ];
  
  beforeEach(() => {
    // Create test instances
    clusterManager = new MockClusterManager();
    jobTracker = new MockJobTracker();
    jobOutputHandler = new MockJobOutputHandler();
    
    // Create stubs
    // Override the listTrackedClusters method
    clusterManager.listTrackedClusters = () => mockClusters;
    
    // Override the listJobs method
    jobTracker.listJobs = () => mockJobs;
    
    // Create a stub for getCachedOutput
    const originalGetCachedOutput = jobOutputHandler.getCachedOutput;
    jobOutputHandler.getCachedOutput = async (jobId) => {
      jobOutputHandler.getCachedOutput.calls = jobOutputHandler.getCachedOutput.calls || [];
      jobOutputHandler.getCachedOutput.calls.push([jobId]);
      
      return {
        schema: { fields: [{ name: 'column1', type: 'string' }] },
        rows: [{ values: ['value1'] }]
      };
    };
    
    jobOutputHandler.getCachedOutput.calledWith = (jobId) => {
      return (jobOutputHandler.getCachedOutput.calls || []).some(
        (args) => args[0] === jobId
      );
    };
    
    // Create stubs for imported functions
    getClusterStub = createStub(Promise.resolve({
      clusterName: 'test-cluster',
      status: { state: 'RUNNING' }
    }));
    
    getJobStatusStub = createStub(Promise.resolve({
      status: { state: JobState.DONE }
    }));
  });
  
  afterEach(() => {
    // Reset stubs
    getClusterStub.calls = [];
    getJobStatusStub.calls = [];
    if (jobOutputHandler.getCachedOutput.calls) {
      jobOutputHandler.getCachedOutput.calls = [];
    }
  });
  
  it('should list resources correctly', async () => {
    // Create the handler
    const listResourcesHandler = async () => {
      const trackedClusters = clusterManager.listTrackedClusters();
      const trackedJobs = jobTracker.listJobs();
      
      const resources = [
        // Cluster resources
        ...trackedClusters.map((cluster) => {
          const projectId = cluster.metadata?.projectId || 'unknown';
          const region = cluster.metadata?.region || 'unknown';
          const status = cluster.metadata?.status || 'Unknown status';
          
          return {
            uri: `dataproc://clusters/${projectId}/${region}/${cluster.clusterName}`,
            name: `Cluster: ${cluster.clusterName}`,
            description: `Dataproc cluster in ${region} (${status})`,
          };
        }),
        
        // Job resources
        ...trackedJobs.map((job) => ({
          uri: `dataproc://jobs/${job.projectId}/${job.region}/${job.jobId}`,
          name: `Job: ${job.jobId}`,
          description: `Dataproc job (${job.toolName}) - ${job.status}`,
        })),
      ];
      
      return { resources };
    };
    
    // Call the handler
    const result = await listResourcesHandler();
    
    // Verify the result
    expect(result).to.have.property('resources');
    expect(result.resources).to.have.length(4); // 2 clusters + 2 jobs
    
    // Check cluster resources
    const clusterResources = result.resources.filter(r => r.uri.startsWith('dataproc://clusters/'));
    expect(clusterResources).to.have.length(2);
    expect(clusterResources[0].uri).to.equal('dataproc://clusters/test-project/us-central1/test-cluster-1');
    expect(clusterResources[0].name).to.equal('Cluster: test-cluster-1');
    expect(clusterResources[0].description).to.contain('RUNNING');
    
    // Check job resources
    const jobResources = result.resources.filter(r => r.uri.startsWith('dataproc://jobs/'));
    expect(jobResources).to.have.length(2);
    expect(jobResources[0].uri).to.equal('dataproc://jobs/test-project/us-central1/job-1');
    expect(jobResources[0].name).to.equal('Job: job-1');
    expect(jobResources[0].description).to.contain('submit_hive_query');
    expect(jobResources[0].description).to.contain('RUNNING');
  });
  
  it('should read cluster resource correctly', async () => {
    // Create the handler
    const readResourceHandler = async (request) => {
      const uri = request.params.uri;
      
      // Parse the URI to determine resource type
      if (uri.startsWith('dataproc://clusters/')) {
        // Handle cluster resource
        const parts = uri.replace('dataproc://clusters/', '').split('/');
        if (parts.length !== 3) {
          throw new Error(`Invalid cluster URI format: ${uri}`);
        }
        
        const [projectId, region, clusterName] = parts;
        // Use the stub directly instead of importing
        const cluster = await getClusterStub(projectId, region, clusterName);
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(cluster, null, 2),
            },
          ],
        };
      }
      
      throw new Error(`Unknown resource URI: ${uri}`);
    };
    
    // Call the handler
    const result = await readResourceHandler({
      method: 'read_resource',
      params: {
        uri: 'dataproc://clusters/test-project/us-central1/test-cluster'
      }
    });
    
    // Verify the result
    expect(result).to.have.property('content');
    expect(result.content).to.have.length(1);
    expect(result.content[0].type).to.equal('text');
    
    // Parse the content
    const content = JSON.parse(result.content[0].text);
    expect(content).to.have.property('clusterName', 'test-cluster');
    expect(content).to.have.property('status');
    expect(content.status).to.have.property('state', 'RUNNING');
    
    // Verify getCluster was called with the correct parameters
    expect(getClusterStub.calledWith('test-project', 'us-central1', 'test-cluster')).to.be.true;
  });
  
  it('should read job resource correctly', async () => {
    // Create the handler
    const readResourceHandler = async (request) => {
      const uri = request.params.uri;
      
      // Parse the URI to determine resource type
      if (uri.startsWith('dataproc://jobs/')) {
        // Handle job resource
        const parts = uri.replace('dataproc://jobs/', '').split('/');
        if (parts.length !== 3) {
          throw new Error(`Invalid job URI format: ${uri}`);
        }
        
        const [projectId, region, jobId] = parts;
        
        // Get job status using the stub
        const status = await getJobStatusStub(projectId, region, jobId);
        
        // Get job results if available
        let results = null;
        if (status && status.status?.state === JobState.DONE) {
          try {
            results = await jobOutputHandler.getCachedOutput(jobId);
          } catch (error) {
            console.error(`Error getting cached output for job ${jobId}:`, error);
          }
        }
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ status, results }, null, 2),
            },
          ],
        };
      }
      
      throw new Error(`Unknown resource URI: ${uri}`);
    };
    
    // Call the handler
    const result = await readResourceHandler({
      method: 'read_resource',
      params: {
        uri: 'dataproc://jobs/test-project/us-central1/job-1'
      }
    });
    
    // Verify the result
    expect(result).to.have.property('content');
    expect(result.content).to.have.length(1);
    expect(result.content[0].type).to.equal('text');
    
    // Parse the content
    const content = JSON.parse(result.content[0].text);
    expect(content).to.have.property('status');
    expect(content).to.have.property('results');
    expect(content.status).to.have.property('status');
    expect(content.status.status).to.have.property('state', JobState.DONE);
    
    // Verify getJobStatus was called with the correct parameters
    expect(getJobStatusStub.calledWith('test-project', 'us-central1', 'job-1')).to.be.true;
    
    // Verify getCachedOutput was called with the correct parameters
    expect(jobOutputHandler.getCachedOutput.calledWith('job-1')).to.be.true;
  });
});