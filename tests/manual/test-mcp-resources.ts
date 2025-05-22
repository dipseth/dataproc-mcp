/**
 * Manual test for MCP resource and prompt handlers
 * 
 * This script tests the resource and prompt handlers by simulating MCP requests
 * and printing the responses. It doesn't require any testing framework.
 * 
 * Run with: npx ts-node tests/manual/test-mcp-resources.ts
 */

import { z } from 'zod';
import { ClusterManager } from '../../src/services/cluster-manager.js';
import { JobTracker } from '../../src/services/job-tracker.js';
import { ClusterTracker } from '../../src/services/tracker.js';
import { ProfileManager } from '../../src/services/profile.js';
import { JobOutputHandler } from '../../src/services/job-output-handler.js';
import { JobState } from '../../src/types/query.js';
import { getCluster } from '../../src/services/cluster.js';
import { getJobStatus } from '../../src/services/query.js';

// Define the schemas
const ListResourcesRequestSchema = z.object({
  method: z.literal("list_resources"),
});

const ReadResourceRequestSchema = z.object({
  method: z.literal("read_resource"),
  params: z.object({
    uri: z.string(),
  }),
});

const ListPromptsRequestSchema = z.object({
  method: z.literal("list_prompts"),
});

const ReadPromptRequestSchema = z.object({
  method: z.literal("read_prompt"),
  params: z.object({
    id: z.string(),
  }),
});

// Define types for the request parameters
type ReadResourceRequest = z.infer<typeof ReadResourceRequestSchema>;
type ReadPromptRequest = z.infer<typeof ReadPromptRequestSchema>;

/**
 * Test the resource list handler
 */
async function testListResources(
  clusterManager: ClusterManager,
  jobTracker: JobTracker
) {
  console.log('\n=== Testing List Resources ===\n');
  
  try {
    // Get tracked clusters
    const trackedClusters = clusterManager.listTrackedClusters();
    console.log(`Found ${trackedClusters.length} tracked clusters`);
    
    // Get tracked jobs
    const trackedJobs = jobTracker.listJobs();
    console.log(`Found ${trackedJobs.length} tracked jobs`);
    
    // Build resource list
    const resources = [
      // Cluster resources
      ...trackedClusters.map((cluster) => {
        // Get project ID and region from metadata if available
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
    
    console.log('Resources:');
    console.log(JSON.stringify(resources, null, 2));
    
    return { resources };
  } catch (error) {
    console.error('Error listing resources:', error);
    throw error;
  }
}

/**
 * Test the resource read handler
 */
async function testReadResource(
  request: ReadResourceRequest,
  jobOutputHandler: JobOutputHandler
) {
  console.log('\n=== Testing Read Resource ===\n');
  console.log('Request:', JSON.stringify(request, null, 2));
  
  try {
    const uri = request.params.uri;
    
    // Parse the URI to determine resource type
    if (uri.startsWith('dataproc://clusters/')) {
      // Handle cluster resource
      const parts = uri.replace('dataproc://clusters/', '').split('/');
      if (parts.length !== 3) {
        throw new Error(`Invalid cluster URI format: ${uri}`);
      }
      
      const [projectId, region, clusterName] = parts;
      console.log(`Getting cluster: ${projectId}/${region}/${clusterName}`);
      
      try {
        const cluster = await getCluster(projectId, region, clusterName);
        
        const result = {
          content: [
            {
              type: "text",
              text: JSON.stringify(cluster, null, 2),
            },
          ],
        };
        
        console.log('Result:');
        console.log(JSON.stringify(result, null, 2));
        
        return result;
      } catch (error) {
        console.error(`Error getting cluster ${clusterName}:`, error);
        throw error;
      }
    } else if (uri.startsWith('dataproc://jobs/')) {
      // Handle job resource
      const parts = uri.replace('dataproc://jobs/', '').split('/');
      if (parts.length !== 3) {
        throw new Error(`Invalid job URI format: ${uri}`);
      }
      
      const [projectId, region, jobId] = parts;
      console.log(`Getting job: ${projectId}/${region}/${jobId}`);
      
      try {
        // Get job status
        const status = await getJobStatus(projectId, region, jobId);
        
        // Get job results if available
        let results = null;
        if (status && status.status?.state === JobState.DONE) {
          try {
            results = await jobOutputHandler.getCachedOutput(jobId);
          } catch (error) {
            console.error(`Error getting cached output for job ${jobId}:`, error);
          }
        }
        
        const result = {
          content: [
            {
              type: "text",
              text: JSON.stringify({ status, results }, null, 2),
            },
          ],
        };
        
        console.log('Result:');
        console.log(JSON.stringify(result, null, 2));
        
        return result;
      } catch (error) {
        console.error(`Error getting job ${jobId}:`, error);
        throw error;
      }
    } else {
      throw new Error(`Unknown resource URI: ${uri}`);
    }
  } catch (error) {
    console.error(`Error reading resource ${request.params.uri}:`, error);
    throw error;
  }
}

/**
 * Test the prompt list handler
 */
async function testListPrompts() {
  console.log('\n=== Testing List Prompts ===\n');
  
  try {
    // Define available prompts
    const prompts = [
      {
        id: "dataproc-cluster-creation",
        name: "Dataproc Cluster Creation",
        description: "Guidelines for creating Dataproc clusters",
      },
      {
        id: "dataproc-job-submission",
        name: "Dataproc Job Submission",
        description: "Guidelines for submitting jobs to Dataproc clusters",
      },
    ];
    
    console.log('Prompts:');
    console.log(JSON.stringify(prompts, null, 2));
    
    return { prompts };
  } catch (error) {
    console.error('Error listing prompts:', error);
    throw error;
  }
}

/**
 * Test the prompt read handler
 */
async function testReadPrompt(request: ReadPromptRequest) {
  console.log('\n=== Testing Read Prompt ===\n');
  console.log('Request:', JSON.stringify(request, null, 2));
  
  try {
    const id = request.params.id;
    
    if (id === "dataproc-cluster-creation") {
      const result = {
        content: [
          {
            type: "text",
            text: `# Dataproc Cluster Creation Guidelines

When creating a Dataproc cluster, consider the following:

1. **Region Selection**: Choose a region close to your data and users to minimize latency.
2. **Machine Types**: Select appropriate machine types based on your workload:
   - Standard machines for general-purpose workloads
   - High-memory machines for memory-intensive applications
   - High-CPU machines for compute-intensive tasks
3. **Cluster Size**: Start with a small cluster and scale as needed.
4. **Initialization Actions**: Use initialization actions to install additional software or configure the cluster.
5. **Network Configuration**: Configure VPC and firewall rules appropriately.
6. **Component Selection**: Choose only the components you need to minimize cluster startup time.
7. **Autoscaling**: Enable autoscaling for workloads with variable resource requirements.

For production workloads, consider using a predefined profile with the \`create_cluster_from_profile\` tool.`,
          },
        ],
      };
      
      console.log('Result:');
      console.log(JSON.stringify(result, null, 2));
      
      return result;
    } else if (id === "dataproc-job-submission") {
      const result = {
        content: [
          {
            type: "text",
            text: `# Dataproc Job Submission Guidelines

When submitting jobs to Dataproc, follow these best practices:

1. **Job Types**:
   - Use Hive for SQL-like queries on structured data
   - Use Spark for complex data processing
   - Use PySpark for Python-based data processing
   - Use Presto for interactive SQL queries

2. **Performance Optimization**:
   - Partition your data appropriately
   - Use appropriate file formats (Parquet, ORC)
   - Set appropriate executor memory and cores
   - Use caching for frequently accessed data

3. **Monitoring**:
   - Monitor job progress using the \`get_job_status\` tool
   - Retrieve results using the \`get_job_results\` or \`get_query_results\` tools

4. **Error Handling**:
   - Check job status before retrieving results
   - Handle job failures gracefully
   - Retry failed jobs with appropriate backoff

5. **Resource Management**:
   - Submit jobs to appropriately sized clusters
   - Consider using preemptible VMs for cost savings
   - Delete clusters when no longer needed`,
          },
        ],
      };
      
      console.log('Result:');
      console.log(JSON.stringify(result, null, 2));
      
      return result;
    } else {
      throw new Error(`Unknown prompt ID: ${id}`);
    }
  } catch (error) {
    console.error(`Error reading prompt ${request.params.id}:`, error);
    throw error;
  }
}

/**
 * Main function to run all tests
 */
async function main() {
  try {
    console.log('=== MCP Resource and Prompt Handler Tests ===');
    
    // Initialize services
    console.log('\nInitializing services...');
    const profileManager = new ProfileManager({ rootConfigPath: './profiles' });
    await profileManager.initialize();
    
    const clusterTracker = new ClusterTracker();
    await clusterTracker.initialize();
    
    const jobOutputHandler = new JobOutputHandler();
    const jobTracker = new JobTracker();
    const clusterManager = new ClusterManager(profileManager, clusterTracker);
    
    // Test resource handlers
    await testListResources(clusterManager, jobTracker);
    
    await testReadResource({
      method: 'read_resource',
      params: {
        uri: 'dataproc://clusters/test-project/us-central1/test-cluster'
      }
    }, jobOutputHandler);
    
    await testReadResource({
      method: 'read_resource',
      params: {
        uri: 'dataproc://jobs/test-project/us-central1/test-job'
      }
    }, jobOutputHandler);
    
    // Test prompt handlers
    await testListPrompts();
    
    await testReadPrompt({
      method: 'read_prompt',
      params: {
        id: 'dataproc-cluster-creation'
      }
    });
    
    await testReadPrompt({
      method: 'read_prompt',
      params: {
        id: 'dataproc-job-submission'
      }
    });
    
    console.log('\n=== All tests completed ===');
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

// Run the tests
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});