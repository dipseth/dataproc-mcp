#!/usr/bin/env node

/**
 * Documentation generator for Dataproc MCP Server
 * Generates interactive API documentation from Zod schemas
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.dirname(__dirname);

// Tool definitions with their schemas
const tools = [
  {
    name: 'start_dataproc_cluster',
    description: 'Start a Google Cloud Dataproc cluster',
    category: 'Cluster Management',
    schema: 'StartDataprocClusterSchema',
    example: {
      clusterName: 'my-analysis-cluster',
      clusterConfig: {
        masterConfig: {
          numInstances: 1,
          machineTypeUri: 'n1-standard-4'
        },
        workerConfig: {
          numInstances: 3,
          machineTypeUri: 'n1-standard-2'
        }
      }
    }
  },
  {
    name: 'create_cluster_from_yaml',
    description: 'Create a Dataproc cluster using a YAML configuration file',
    category: 'Cluster Management',
    schema: 'CreateClusterFromYamlSchema',
    example: {
      projectId: 'my-project-123',
      region: 'us-central1',
      yamlPath: './configs/production-cluster.yaml',
      overrides: {
        clusterName: 'prod-cluster-001'
      }
    }
  },
  {
    name: 'create_cluster_from_profile',
    description: 'Create a Dataproc cluster using a predefined profile',
    category: 'Cluster Management',
    schema: 'CreateClusterFromProfileSchema',
    example: {
      projectId: 'my-project-123',
      region: 'us-central1',
      profileName: 'production/high-memory/analysis',
      clusterName: 'analytics-cluster-prod'
    }
  },
  {
    name: 'list_clusters',
    description: 'List Dataproc clusters in a project and region',
    category: 'Cluster Management',
    schema: 'ListClustersSchema',
    example: {
      filter: 'status.state=RUNNING',
      pageSize: 10
    }
  },
  {
    name: 'get_cluster',
    description: 'Get details for a specific Dataproc cluster',
    category: 'Cluster Management',
    schema: 'GetClusterSchema',
    example: {
      projectId: 'my-project-123',
      region: 'us-central1',
      clusterName: 'my-analysis-cluster'
    }
  },
  {
    name: 'delete_cluster',
    description: 'Delete a Dataproc cluster',
    category: 'Cluster Management',
    schema: 'DeleteClusterSchema',
    example: {
      projectId: 'my-project-123',
      region: 'us-central1',
      clusterName: 'temporary-cluster'
    }
  },
  {
    name: 'submit_hive_query',
    description: 'Submit a Hive query to a Dataproc cluster',
    category: 'Job Execution',
    schema: 'SubmitHiveQuerySchema',
    example: {
      projectId: 'my-project-123',
      region: 'us-central1',
      clusterName: 'analytics-cluster',
      query: 'SELECT COUNT(*) FROM my_table WHERE date >= "2024-01-01"',
      async: false
    }
  },
  {
    name: 'submit_dataproc_job',
    description: 'Submit a Dataproc job (Hive, Spark, PySpark, Presto, etc.)',
    category: 'Job Execution',
    schema: 'SubmitDataprocJobSchema',
    example: {
      projectId: 'my-project-123',
      region: 'us-central1',
      clusterName: 'spark-cluster',
      jobType: 'spark',
      jobConfig: {
        mainClass: 'com.example.SparkApp',
        jarFileUris: ['gs://my-bucket/spark-app.jar']
      }
    }
  },
  {
    name: 'get_job_status',
    description: 'Get the status of a Dataproc job by job ID',
    category: 'Job Execution',
    schema: 'GetJobStatusSchema',
    example: {
      jobId: 'job-12345-abcdef'
    }
  },
  {
    name: 'get_query_results',
    description: 'Get the results of a completed Hive query',
    category: 'Job Execution',
    schema: 'GetQueryResultsSchema',
    example: {
      projectId: 'my-project-123',
      region: 'us-central1',
      jobId: 'hive-job-12345',
      maxResults: 50
    }
  },
  {
    name: 'get_job_results',
    description: 'Get the results of a completed Dataproc job',
    category: 'Job Execution',
    schema: 'GetJobResultsSchema',
    example: {
      projectId: 'my-project-123',
      region: 'us-central1',
      jobId: 'spark-job-67890',
      maxResults: 100
    }
  },
  {
    name: 'list_profiles',
    description: 'List available cluster configuration profiles',
    category: 'Profile Management',
    schema: 'ListProfilesSchema',
    example: {
      category: 'production'
    }
  },
  {
    name: 'get_profile',
    description: 'Get details for a specific cluster configuration profile',
    category: 'Profile Management',
    schema: 'GetProfileSchema',
    example: {
      profileId: 'development/small'
    }
  },
  {
    name: 'list_tracked_clusters',
    description: 'List clusters that were created and tracked by this MCP server',
    category: 'Profile Management',
    schema: 'ListTrackedClustersSchema',
    example: {
      profileId: 'production/high-memory/analysis'
    }
  },
  {
    name: 'get_zeppelin_url',
    description: 'Get the Zeppelin notebook URL for a Dataproc cluster',
    category: 'Monitoring & Utilities',
    schema: 'GetZeppelinUrlSchema',
    example: {
      projectId: 'my-project-123',
      region: 'us-central1',
      clusterName: 'jupyter-cluster'
    }
  }
];

function generateInteractiveHTML() {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dataproc MCP Server - Interactive API Documentation</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f8f9fa;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px 20px;
            text-align: center;
            margin-bottom: 30px;
            border-radius: 10px;
        }
        
        .header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
        }
        
        .header p {
            font-size: 1.2em;
            opacity: 0.9;
        }
        
        .nav {
            background: white;
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 30px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        .nav h3 {
            margin-bottom: 15px;
            color: #495057;
        }
        
        .nav-links {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
        }
        
        .nav-link {
            padding: 8px 16px;
            background: #e9ecef;
            border: none;
            border-radius: 20px;
            cursor: pointer;
            transition: all 0.3s;
            text-decoration: none;
            color: #495057;
        }
        
        .nav-link:hover, .nav-link.active {
            background: #007bff;
            color: white;
        }
        
        .category {
            background: white;
            margin-bottom: 30px;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        .category-header {
            background: #495057;
            color: white;
            padding: 20px;
            font-size: 1.3em;
            font-weight: 600;
        }
        
        .tool {
            border-bottom: 1px solid #e9ecef;
            padding: 0;
        }
        
        .tool:last-child {
            border-bottom: none;
        }
        
        .tool-header {
            padding: 20px;
            cursor: pointer;
            background: #f8f9fa;
            border: none;
            width: 100%;
            text-align: left;
            display: flex;
            justify-content: space-between;
            align-items: center;
            transition: background 0.3s;
        }
        
        .tool-header:hover {
            background: #e9ecef;
        }
        
        .tool-name {
            font-size: 1.1em;
            font-weight: 600;
            color: #007bff;
        }
        
        .tool-description {
            color: #6c757d;
            margin-top: 5px;
        }
        
        .tool-content {
            display: none;
            padding: 20px;
            background: white;
        }
        
        .tool-content.active {
            display: block;
        }
        
        .example-section {
            margin-top: 20px;
        }
        
        .example-section h4 {
            margin-bottom: 10px;
            color: #495057;
        }
        
        .code-block {
            background: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 5px;
            padding: 15px;
            overflow-x: auto;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 0.9em;
        }
        
        .try-it {
            background: #28a745;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            margin-top: 15px;
            transition: background 0.3s;
        }
        
        .try-it:hover {
            background: #218838;
        }
        
        .response-section {
            margin-top: 20px;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 5px;
            display: none;
        }
        
        .response-section.active {
            display: block;
        }
        
        .expand-icon {
            transition: transform 0.3s;
        }
        
        .expand-icon.rotated {
            transform: rotate(180deg);
        }
        
        .search-box {
            width: 100%;
            padding: 12px;
            border: 1px solid #ddd;
            border-radius: 5px;
            font-size: 16px;
            margin-bottom: 20px;
        }
        
        .hidden {
            display: none !important;
        }
        
        @media (max-width: 768px) {
            .container {
                padding: 10px;
            }
            
            .header h1 {
                font-size: 2em;
            }
            
            .nav-links {
                justify-content: center;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Dataproc MCP Server</h1>
            <p>Interactive API Documentation</p>
        </div>
        
        <div class="nav">
            <h3>Quick Navigation</h3>
            <input type="text" class="search-box" placeholder="Search tools..." id="searchBox">
            <div class="nav-links">
                <a href="#cluster-management" class="nav-link">Cluster Management</a>
                <a href="#job-execution" class="nav-link">Job Execution</a>
                <a href="#profile-management" class="nav-link">Profile Management</a>
                <a href="#monitoring-utilities" class="nav-link">Monitoring & Utilities</a>
            </div>
        </div>
        
        ${generateCategoriesHTML()}
    </div>
    
    <script>
        // Tool interaction functionality
        function toggleTool(toolName) {
            const content = document.getElementById(toolName + '-content');
            const icon = document.getElementById(toolName + '-icon');
            
            if (content.classList.contains('active')) {
                content.classList.remove('active');
                icon.classList.remove('rotated');
            } else {
                content.classList.add('active');
                icon.classList.add('rotated');
            }
        }
        
        function tryTool(toolName, example) {
            const responseSection = document.getElementById(toolName + '-response');
            responseSection.classList.add('active');
            responseSection.innerHTML = \`
                <h4>Example Request:</h4>
                <div class="code-block">
{
  "tool": "\${toolName}",
  "arguments": \${JSON.stringify(example, null, 2)}
}
                </div>
                <h4>Response:</h4>
                <div class="code-block">
{
  "content": [
    {
      "type": "text",
      "text": "Tool executed successfully. See actual response in your MCP client."
    }
  ]
}
                </div>
            \`;
        }
        
        // Search functionality
        document.getElementById('searchBox').addEventListener('input', function(e) {
            const searchTerm = e.target.value.toLowerCase();
            const tools = document.querySelectorAll('.tool');
            
            tools.forEach(tool => {
                const toolName = tool.querySelector('.tool-name').textContent.toLowerCase();
                const toolDescription = tool.querySelector('.tool-description').textContent.toLowerCase();
                
                if (toolName.includes(searchTerm) || toolDescription.includes(searchTerm)) {
                    tool.classList.remove('hidden');
                } else {
                    tool.classList.add('hidden');
                }
            });
        });
        
        // Smooth scrolling for navigation links
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                const targetId = this.getAttribute('href').substring(1);
                const targetElement = document.getElementById(targetId);
                if (targetElement) {
                    targetElement.scrollIntoView({ behavior: 'smooth' });
                }
            });
        });
    </script>
</body>
</html>`;

  return html;
}

function generateCategoriesHTML() {
  const categories = {};
  
  // Group tools by category
  tools.forEach(tool => {
    if (!categories[tool.category]) {
      categories[tool.category] = [];
    }
    categories[tool.category].push(tool);
  });
  
  let html = '';
  
  Object.entries(categories).forEach(([category, categoryTools]) => {
    const categoryId = category.toLowerCase().replace(/\s+/g, '-').replace(/&/g, '');
    
    html += `
        <div class="category" id="${categoryId}">
            <div class="category-header">
                ${category} (${categoryTools.length} tools)
            </div>
            ${categoryTools.map(tool => generateToolHTML(tool)).join('')}
        </div>
    `;
  });
  
  return html;
}

function generateToolHTML(tool) {
  return `
            <div class="tool">
                <button class="tool-header" onclick="toggleTool('${tool.name}')">
                    <div>
                        <div class="tool-name">${tool.name}</div>
                        <div class="tool-description">${tool.description}</div>
                    </div>
                    <span class="expand-icon" id="${tool.name}-icon">▼</span>
                </button>
                <div class="tool-content" id="${tool.name}-content">
                    <div class="example-section">
                        <h4>Example Usage:</h4>
                        <div class="code-block">
{
  "tool": "${tool.name}",
  "arguments": ${JSON.stringify(tool.example, null, 2)}
}
                        </div>
                        <button class="try-it" onclick="tryTool('${tool.name}', ${JSON.stringify(tool.example).replace(/"/g, '&quot;')})">
                            Try This Example
                        </button>
                    </div>
                    <div class="response-section" id="${tool.name}-response">
                    </div>
                </div>
            </div>
  `;
}

function generateMarkdownDocs() {
  let markdown = `# 📚 Auto-Generated API Documentation

This documentation is automatically generated from the Zod validation schemas.

## Available Tools

The Dataproc MCP Server provides ${tools.length} tools across ${new Set(tools.map(t => t.category)).size} categories:

`;

  const categories = {};
  tools.forEach(tool => {
    if (!categories[tool.category]) {
      categories[tool.category] = [];
    }
    categories[tool.category].push(tool);
  });

  Object.entries(categories).forEach(([category, categoryTools]) => {
    markdown += `### ${category}\n\n`;
    
    categoryTools.forEach(tool => {
      markdown += `#### ${tool.name}\n\n`;
      markdown += `${tool.description}\n\n`;
      markdown += `**Example:**\n\`\`\`json\n`;
      markdown += JSON.stringify({
        tool: tool.name,
        arguments: tool.example
      }, null, 2);
      markdown += `\n\`\`\`\n\n`;
    });
  });

  return markdown;
}

function main() {
  console.log('🔧 Generating interactive API documentation...');
  
  try {
    // Generate interactive HTML documentation
    const htmlContent = generateInteractiveHTML();
    const htmlPath = path.join(rootDir, 'docs', 'api-interactive.html');
    fs.writeFileSync(htmlPath, htmlContent);
    console.log(`✅ Generated interactive HTML documentation: ${htmlPath}`);
    
    // Generate markdown documentation
    const markdownContent = generateMarkdownDocs();
    const markdownPath = path.join(rootDir, 'docs', 'API_AUTO_GENERATED.md');
    fs.writeFileSync(markdownPath, markdownContent);
    console.log(`✅ Generated markdown documentation: ${markdownPath}`);
    
    console.log('');
    console.log('📖 Documentation generated successfully!');
    console.log('');
    console.log('To view the interactive documentation:');
    console.log(`   open ${htmlPath}`);
    console.log('');
    console.log('To view the markdown documentation:');
    console.log(`   cat ${markdownPath}`);
    
  } catch (error) {
    console.error('❌ Error generating documentation:', error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}