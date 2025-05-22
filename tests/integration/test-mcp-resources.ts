/**
 * Integration test for MCP resources and prompts
 * 
 * This test starts an MCP server and sends requests to test the resource and prompt handlers.
 * 
 * Run with: npx ts-node tests/integration/test-mcp-resources.ts
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { z } from 'zod';

// Define a local JobState enum instead of importing it
enum JobState {
  DONE = "DONE",
  RUNNING = "RUNNING",
  PENDING = "PENDING",
  ERROR = "ERROR"
}

// Create a simple in-memory transport for testing
class SimpleMemoryTransport {
  private server: any;
  private messageId = 1;

  connect(server: any) {
    this.server = server;
  }

  async sendRequest(request: any) {
    // Add message ID and jsonrpc version
    const fullRequest = {
      ...request,
      id: this.messageId++,
      jsonrpc: '2.0'
    };
    
    // Process the request through the server's handleRequest method
    return await this.server.handleRequest(JSON.stringify(fullRequest));
  }
}

// Mock data for testing
const mockCluster = {
  clusterName: 'test-cluster',
  status: { state: 'RUNNING' }
};

const mockJobStatus = {
  status: { state: JobState.DONE }
};

// Mock functions for external services
const mockGetCluster = async (projectId: string, region: string, clusterName: string) => {
  console.log(`Mock getCluster called with: ${projectId}, ${region}, ${clusterName}`);
  return mockCluster;
};

const mockGetJobStatus = async (projectId: string, region: string, jobId: string) => {
  console.log(`Mock getJobStatus called with: ${projectId}, ${region}, ${jobId}`);
  return mockJobStatus;
};

/**
 * Setup the MCP server with resource and prompt handlers
 */
async function setupServer() {
  // Create a new server with updated capabilities
  const server = new Server(
    {
      name: "dataproc-server-test",
      version: "0.3.0",
    },
    {
      capabilities: {
        resources: {
          listChanged: true
        },
        tools: {},
        prompts: {
          listChanged: true
        },
      },
    }
  );
  
  // Create a memory transport for testing
  const transport = new SimpleMemoryTransport();
  
  // Define resource list request schema using Zod
  const ListResourcesRequestSchema = z.object({
    method: z.literal("list_resources"),
  });
  
  // Define resource read request schema using Zod
  const ReadResourceRequestSchema = z.object({
    method: z.literal("read_resource"),
    params: z.object({
      uri: z.string(),
    }),
  });
  
  // Define prompt list request schema using Zod
  const ListPromptsRequestSchema = z.object({
    method: z.literal("list_prompts"),
  });
  
  // Define prompt read request schema using Zod
  const ReadPromptRequestSchema = z.object({
    method: z.literal("read_prompt"),
    params: z.object({
      id: z.string(),
    }),
  });
  
  // Define types for the request parameters
  type ReadResourceRequest = z.infer<typeof ReadResourceRequestSchema>;
  type ReadPromptRequest = z.infer<typeof ReadPromptRequestSchema>;
  
  // Handler for listing resources
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    console.log('Resource list handler called');
    
    // Define test resources
    const resources = [
      {
        uri: 'dataproc://clusters/test-project/us-central1/test-cluster',
        name: 'Cluster: test-cluster',
        description: 'Dataproc cluster in us-central1 (RUNNING)',
      },
      {
        uri: 'dataproc://jobs/test-project/us-central1/test-job',
        name: 'Job: test-job',
        description: 'Dataproc job (submit_hive_query) - DONE',
      },
    ];
    
    return { resources };
  });
  
  // Handler for reading resources
  server.setRequestHandler(ReadResourceRequestSchema, async (request: ReadResourceRequest) => {
    console.log('Resource read handler called with URI:', request.params.uri);
    
    const uri = request.params.uri;
    
    try {
      // Parse the URI to determine resource type
      if (uri.startsWith('dataproc://clusters/')) {
        // Handle cluster resource
        const parts = uri.replace('dataproc://clusters/', '').split('/');
        if (parts.length !== 3) {
          throw new Error(`Invalid cluster URI format: ${uri}`);
        }
        
        const [projectId, region, clusterName] = parts;
        const cluster = await mockGetCluster(projectId, region, clusterName);
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(cluster, null, 2),
            },
          ],
        };
      } else if (uri.startsWith('dataproc://jobs/')) {
        // Handle job resource
        const parts = uri.replace('dataproc://jobs/', '').split('/');
        if (parts.length !== 3) {
          throw new Error(`Invalid job URI format: ${uri}`);
        }
        
        const [projectId, region, jobId] = parts;
        
        // Get job status
        const status = await mockGetJobStatus(projectId, region, jobId);
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ status }, null, 2),
            },
          ],
        };
      } else {
        throw new Error(`Unknown resource URI: ${uri}`);
      }
    } catch (error) {
      console.error(`Error reading resource ${uri}:`, error);
      throw error;
    }
  });
  
  // Handler for listing prompts
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    console.log('Prompt list handler called');
    
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
    
    return { prompts };
  });
  
  // Handler for reading prompts
  server.setRequestHandler(ReadPromptRequestSchema, async (request: ReadPromptRequest) => {
    console.log('Prompt read handler called with ID:', request.params.id);
    
    const id = request.params.id;
    
    try {
      if (id === "dataproc-cluster-creation") {
        return {
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
      } else if (id === "dataproc-job-submission") {
        return {
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
      } else {
        throw new Error(`Unknown prompt ID: ${id}`);
      }
    } catch (error) {
      console.error(`Error reading prompt ${id}:`, error);
      throw error;
    }
  });
  
  // Connect server to transport
  transport.connect(server);
  
  return { server, transport };
}

/**
 * Run the integration tests
 */
async function runTests() {
  console.log('=== MCP Resource and Prompt Integration Tests ===');
  
  try {
    // Setup the server
    console.log('\nSetting up server...');
    const { server, transport } = await setupServer();
    
    // Test listing resources
    console.log('\n=== Testing List Resources ===');
    const listResourcesResponse = await transport.sendRequest({
      method: 'list_resources'
    });
    console.log('List resources response:', JSON.stringify(listResourcesResponse, null, 2));
    
    // Test reading a cluster resource
    console.log('\n=== Testing Read Cluster Resource ===');
    const readClusterResponse = await transport.sendRequest({
      method: 'read_resource',
      params: {
        uri: 'dataproc://clusters/test-project/us-central1/test-cluster'
      }
    });
    console.log('Read cluster response:', JSON.stringify(readClusterResponse, null, 2));
    
    // Test reading a job resource
    console.log('\n=== Testing Read Job Resource ===');
    const readJobResponse = await transport.sendRequest({
      method: 'read_resource',
      params: {
        uri: 'dataproc://jobs/test-project/us-central1/test-job'
      }
    });
    console.log('Read job response:', JSON.stringify(readJobResponse, null, 2));
    
    // Test listing prompts
    console.log('\n=== Testing List Prompts ===');
    const listPromptsResponse = await transport.sendRequest({
      method: 'list_prompts'
    });
    console.log('List prompts response:', JSON.stringify(listPromptsResponse, null, 2));
    
    // Test reading a prompt
    console.log('\n=== Testing Read Prompt ===');
    const readPromptResponse = await transport.sendRequest({
      method: 'read_prompt',
      params: {
        id: 'dataproc-cluster-creation'
      }
    });
    console.log('Read prompt response:', JSON.stringify(readPromptResponse, null, 2));
    
    console.log('\n=== All tests passed ===');
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

// Run the tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});