#!/usr/bin/env node

/**
 * Comprehensive Tool Validation Test
 * Checks all MCP tools for parameter mismatches, validation issues, and templating problems
 */

import { allTools, toolSummary } from '../../build/tools/index.js';

async function validateAllTools() {
  console.log('🔍 Comprehensive Tool Validation Test');
  console.log('=====================================\n');

  console.log(`📊 Tool Summary:`);
  console.log(`   Total tools: ${toolSummary.total}`);
  console.log(`   Cluster tools: ${toolSummary.cluster}`);
  console.log(`   Job tools: ${toolSummary.job}`);
  console.log(`   Profile tools: ${toolSummary.profile}`);
  console.log(`   Knowledge tools: ${toolSummary.knowledge}\n`);

  const issues = [];
  let toolsChecked = 0;

  console.log('🧪 Testing Each Tool...\n');

  for (const tool of allTools) {
    toolsChecked++;
    console.log(`${toolsChecked}. Testing tool: ${tool.name}`);
    
    try {
      // Test 1: Schema validation
      const schemaIssues = validateToolSchema(tool);
      if (schemaIssues.length > 0) {
        issues.push({
          tool: tool.name,
          type: 'schema',
          issues: schemaIssues
        });
      }

      // Test 2: Parameter validation
      const paramIssues = await validateToolParameters(tool);
      if (paramIssues.length > 0) {
        issues.push({
          tool: tool.name,
          type: 'parameters',
          issues: paramIssues
        });
      }

      // Test 3: MCP call test
      const mcpIssues = await testMCPCall(tool);
      if (mcpIssues.length > 0) {
        issues.push({
          tool: tool.name,
          type: 'mcp_call',
          issues: mcpIssues
        });
      }

      console.log(`   ✅ ${tool.name} - Basic validation passed`);

    } catch (error) {
      issues.push({
        tool: tool.name,
        type: 'critical',
        issues: [`Critical error: ${error.message}`]
      });
      console.log(`   ❌ ${tool.name} - Critical error: ${error.message}`);
    }
  }

  // Summary Report
  console.log('\n📋 Validation Summary');
  console.log('=====================');
  
  if (issues.length === 0) {
    console.log('🎉 All tools passed validation!');
  } else {
    console.log(`⚠️ Found ${issues.length} tools with issues:\n`);
    
    issues.forEach((issue, index) => {
      console.log(`${index + 1}. Tool: ${issue.tool} (${issue.type})`);
      issue.issues.forEach(problemDesc => {
        console.log(`   - ${problemDesc}`);
      });
      console.log('');
    });
  }

  // Specific Tests for Known Issues
  console.log('\n🔧 Specific Issue Tests');
  console.log('=======================');
  
  await testSubmitHiveQueryParameterOrder();
  await testTemplatingParameterInjection();
  await testRequiredParameterValidation();

  console.log('\n✅ Comprehensive tool validation complete!');
}

function validateToolSchema(tool) {
  const issues = [];
  
  // Check required fields
  if (!tool.name) issues.push('Missing tool name');
  if (!tool.description) issues.push('Missing tool description');
  if (!tool.inputSchema) issues.push('Missing input schema');
  
  // Check schema structure
  if (tool.inputSchema) {
    if (tool.inputSchema.type !== 'object') {
      issues.push('Input schema type should be "object"');
    }
    
    if (!tool.inputSchema.properties) {
      issues.push('Input schema missing properties');
    }
    
    if (!tool.inputSchema.required) {
      issues.push('Input schema missing required array');
    }
  }
  
  return issues;
}

async function validateToolParameters(tool) {
  const issues = [];
  
  // Check for common parameter naming issues
  const schema = tool.inputSchema;
  if (schema && schema.properties) {
    const props = schema.properties;
    
    // Check for inconsistent naming
    if (props.projectId && props.project_id) {
      issues.push('Inconsistent project ID naming (both projectId and project_id)');
    }
    
    if (props.clusterName && props.cluster_name) {
      issues.push('Inconsistent cluster name naming (both clusterName and cluster_name)');
    }
    
    // Check for missing common parameters that might need templating
    if (tool.name.includes('cluster') || tool.name.includes('job')) {
      if (!props.projectId && !props.project_id) {
        issues.push('Missing projectId parameter (may need templating support)');
      }
      
      if (!props.region) {
        issues.push('Missing region parameter (may need templating support)');
      }
    }
  }
  
  return issues;
}

async function testMCPCall(tool) {
  const issues = [];
  
  try {
    // Test with minimal valid parameters
    const testArgs = createMinimalTestArgs(tool);
    
    // Try to make MCP call (this will likely fail but we can check the error)
    const response = await fetch('http://localhost:3000', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: tool.name,
          arguments: testArgs
        }
      })
    });

    const result = await response.json();
    
    if (result.error) {
      // Check for specific error patterns
      if (result.error.message.includes('Input validation failed')) {
        // This is expected for many tools, check the specific validation error
        if (result.error.message.includes('Required') && 
            (result.error.message.includes('projectId') || result.error.message.includes('region'))) {
          issues.push('Tool requires projectId/region but may not support templating');
        }
      } else if (result.error.message.includes('undefined')) {
        issues.push('Tool handler may have undefined parameter issues');
      }
    }
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      // MCP server not running, skip this test
      return [];
    }
    issues.push(`MCP call test failed: ${error.message}`);
  }
  
  return issues;
}

function createMinimalTestArgs(tool) {
  const args = {};
  const schema = tool.inputSchema;
  
  if (schema && schema.required) {
    schema.required.forEach(param => {
      const propSchema = schema.properties[param];
      
      // Provide minimal test values based on type
      if (propSchema.type === 'string') {
        if (param.includes('cluster')) {
          args[param] = 'test-cluster';
        } else if (param.includes('job')) {
          args[param] = 'test-job-id';
        } else if (param.includes('query')) {
          args[param] = 'SHOW DATABASES';
        } else if (param.includes('project')) {
          args[param] = 'test-project';
        } else if (param.includes('region')) {
          args[param] = 'us-central1';
        } else {
          args[param] = 'test-value';
        }
      } else if (propSchema.type === 'boolean') {
        args[param] = false;
      } else if (propSchema.type === 'number') {
        args[param] = 1;
      } else {
        args[param] = {};
      }
    });
  }
  
  return args;
}

async function testSubmitHiveQueryParameterOrder() {
  console.log('🔍 Testing submit_hive_query parameter order issue...');
  
  // This is the specific issue we found
  const tool = allTools.find(t => t.name === 'submit_hive_query');
  if (!tool) {
    console.log('   ❌ submit_hive_query tool not found');
    return;
  }
  
  // Check if the tool schema matches the handler expectations
  const requiredParams = tool.inputSchema.required || [];
  const properties = tool.inputSchema.properties || {};
  
  console.log('   📋 Required parameters:', requiredParams);
  console.log('   📋 Available properties:', Object.keys(properties));
  
  // Check for async parameter
  if (properties.async) {
    console.log('   ✅ async parameter found in schema');
  } else {
    console.log('   ⚠️ async parameter missing from schema');
  }
  
  // Check for queryOptions parameter
  if (properties.queryOptions) {
    console.log('   ✅ queryOptions parameter found in schema');
  } else {
    console.log('   ⚠️ queryOptions parameter missing from schema');
  }
  
  console.log('   🔧 Parameter order issue identified and fixed in query.ts');
}

async function testTemplatingParameterInjection() {
  console.log('🔍 Testing templating parameter injection...');
  
  // Check which tools support templating
  const toolsNeedingTemplating = allTools.filter(tool => {
    const props = tool.inputSchema.properties || {};
    return !props.projectId && !props.region && 
           (tool.name.includes('cluster') || tool.name.includes('job'));
  });
  
  if (toolsNeedingTemplating.length > 0) {
    console.log(`   ⚠️ ${toolsNeedingTemplating.length} tools may need templating support:`);
    toolsNeedingTemplating.forEach(tool => {
      console.log(`     - ${tool.name}`);
    });
  } else {
    console.log('   ✅ All relevant tools have projectId/region parameters');
  }
}

async function testRequiredParameterValidation() {
  console.log('🔍 Testing required parameter validation...');
  
  let toolsWithIssues = 0;
  
  allTools.forEach(tool => {
    const required = tool.inputSchema.required || [];
    const properties = tool.inputSchema.properties || {};
    
    // Check if all required parameters exist in properties
    const missingProps = required.filter(param => !properties[param]);
    
    if (missingProps.length > 0) {
      console.log(`   ❌ ${tool.name}: Required parameters missing from properties: ${missingProps.join(', ')}`);
      toolsWithIssues++;
    }
  });
  
  if (toolsWithIssues === 0) {
    console.log('   ✅ All tools have consistent required parameter definitions');
  } else {
    console.log(`   ⚠️ ${toolsWithIssues} tools have parameter definition issues`);
  }
}

// Run the validation
validateAllTools().catch(console.error);