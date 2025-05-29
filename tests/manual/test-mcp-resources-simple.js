/**
 * Simple test script for MCP resources and prompts
 *
 * This script demonstrates how to use the MCP resources and prompts functionality
 * without relying on any testing frameworks or mocking libraries.
 *
 * Run with: npx ts-node tests/manual/test-mcp-resources-simple.ts
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { z } from 'zod';
/**
 * Main function to demonstrate MCP resources and prompts
 */
async function main() {
    console.log('=== MCP Resources and Prompts Demo ===');
    try {
        // Create a new server with resource and prompt capabilities
        console.log('\nCreating server with resource and prompt capabilities...');
        const server = new Server({
            name: "dataproc-server-demo",
            version: "0.3.0",
        }, {
            capabilities: {
                resources: {
                    listChanged: true
                },
                tools: {},
                prompts: {
                    listChanged: true
                },
            },
        });
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
        // Handler for listing resources
        console.log('\nRegistering resource list handler...');
        server.setRequestHandler(ListResourcesRequestSchema, async () => {
            console.log('Resource list handler called');
            // Define sample resources
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
            console.log('Returning resources:', JSON.stringify(resources, null, 2));
            return { resources };
        });
        // Handler for reading resources
        console.log('\nRegistering resource read handler...');
        server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
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
                    console.log(`Getting cluster: ${projectId}/${region}/${clusterName}`);
                    // Return sample cluster data
                    const result = {
                        content: [
                            {
                                type: "text",
                                text: JSON.stringify({
                                    clusterName,
                                    projectId,
                                    region,
                                    status: { state: 'RUNNING' },
                                    config: {
                                        masterConfig: {
                                            machineType: 'n1-standard-4',
                                            numInstances: 1
                                        },
                                        workerConfig: {
                                            machineType: 'n1-standard-4',
                                            numInstances: 2
                                        }
                                    }
                                }, null, 2),
                            },
                        ],
                    };
                    console.log('Returning cluster data');
                    return result;
                }
                else if (uri.startsWith('dataproc://jobs/')) {
                    // Handle job resource
                    const parts = uri.replace('dataproc://jobs/', '').split('/');
                    if (parts.length !== 3) {
                        throw new Error(`Invalid job URI format: ${uri}`);
                    }
                    const [projectId, region, jobId] = parts;
                    console.log(`Getting job: ${projectId}/${region}/${jobId}`);
                    // Return sample job data
                    const result = {
                        content: [
                            {
                                type: "text",
                                text: JSON.stringify({
                                    jobId,
                                    projectId,
                                    region,
                                    status: {
                                        state: 'DONE',
                                        details: 'Job completed successfully',
                                        stateStartTime: new Date().toISOString()
                                    },
                                    results: {
                                        schema: {
                                            fields: [
                                                { name: 'id', type: 'INTEGER' },
                                                { name: 'name', type: 'STRING' }
                                            ]
                                        },
                                        rows: [
                                            { values: [1, 'Item 1'] },
                                            { values: [2, 'Item 2'] }
                                        ]
                                    }
                                }, null, 2),
                            },
                        ],
                    };
                    console.log('Returning job data');
                    return result;
                }
                else {
                    throw new Error(`Unknown resource URI: ${uri}`);
                }
            }
            catch (error) {
                console.error(`Error reading resource ${uri}:`, error);
                throw error;
            }
        });
        // Handler for listing prompts
        console.log('\nRegistering prompt list handler...');
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
            console.log('Returning prompts:', JSON.stringify(prompts, null, 2));
            return { prompts };
        });
        // Handler for reading prompts
        console.log('\nRegistering prompt read handler...');
        server.setRequestHandler(ReadPromptRequestSchema, async (request) => {
            console.log('Prompt read handler called with ID:', request.params.id);
            const id = request.params.id;
            try {
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
                    console.log('Returning cluster creation prompt');
                    return result;
                }
                else if (id === "dataproc-job-submission") {
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
                    console.log('Returning job submission prompt');
                    return result;
                }
                else {
                    throw new Error(`Unknown prompt ID: ${id}`);
                }
            }
            catch (error) {
                console.error(`Error reading prompt ${id}:`, error);
                throw error;
            }
        });
        console.log('\nServer setup complete. In a real application, you would connect the server to a transport.');
        console.log('For example:');
        console.log('  const transport = new StdioServerTransport();');
        console.log('  await server.connect(transport);');
        console.log('\n=== Demo completed successfully ===');
        console.log('\nTo test this functionality in the actual server:');
        console.log('1. Start the server: node build/index.js');
        console.log('2. Use the MCP client to send requests to the server');
        console.log('3. Try listing resources with: { "method": "list_resources" }');
        console.log('4. Try reading a resource with: { "method": "read_resource", "params": { "uri": "dataproc://clusters/project/region/cluster" } }');
        console.log('5. Try listing prompts with: { "method": "list_prompts" }');
        console.log('6. Try reading a prompt with: { "method": "read_prompt", "params": { "id": "dataproc-cluster-creation" } }');
    }
    catch (error) {
        console.error('Demo failed:', error);
        process.exit(1);
    }
}
// Run the demo
main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
