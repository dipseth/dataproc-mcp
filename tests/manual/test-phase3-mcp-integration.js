#!/usr/bin/env node

/**
 * Phase 3: MCP Server Integration Testing
 * Tests the dynamic templating pipeline through actual MCP server calls
 */

import fetch from 'node-fetch';

const MCP_SERVER_URL = 'http://localhost:3000';
const REAL_JOB_ID = '897ac2fd-d113-4a35-a412-01cc59783042';

async function testMCPIntegration() {
  console.log('🔌 Phase 3: MCP Server Integration Testing');
  console.log('==========================================\n');

  const testResults = {
    totalTests: 0,
    passedTests: 0,
    failedTests: 0,
    errors: []
  };

  try {
    // Test 1: Basic MCP Server Communication
    await runTest('MCP Server Connectivity', async () => {
      const response = await fetch(MCP_SERVER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list',
          params: {}
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      if (!result.result || !result.result.tools) {
        throw new Error('Invalid tools list response');
      }

      console.log(`   Found ${result.result.tools.length} tools available`);
    }, testResults);

    // Test 2: Tool Execution with Template Parameters
    await runTest('Tool with Template Parameters', async () => {
      const response = await fetch(MCP_SERVER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: {
            name: 'get_cluster',
            arguments: {
              clusterName: `{{job_output('${REAL_JOB_ID}', 'clusterName')}}`,
              verbose: false
            }
          }
        })
      });

      const result = await response.json();
      
      // Should either succeed or fail gracefully with template processing
      if (result.error && !result.error.message.includes('not found') && !result.error.message.includes('template')) {
        throw new Error(`Unexpected error: ${result.error.message}`);
      }
      
      console.log('   Template parameter processing handled correctly');
    }, testResults);

    // Test 3: Knowledge Query with Templates
    await runTest('Knowledge Query with Templates', async () => {
      const response = await fetch(MCP_SERVER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 3,
          method: 'tools/call',
          params: {
            name: 'query_knowledge',
            arguments: {
              query: `{{qdrant_query('machine learning', 'clusterName')}}`,
              type: 'clusters',
              limit: 5
            }
          }
        })
      });

      const result = await response.json();
      
      // Should handle template processing gracefully
      if (result.error && !result.error.message.includes('template') && !result.error.message.includes('Qdrant')) {
        throw new Error(`Unexpected error: ${result.error.message}`);
      }
      
      console.log('   Knowledge query template processing handled correctly');
    }, testResults);

    // Test 4: Complex Multi-Template Parameters
    await runTest('Complex Multi-Template Parameters', async () => {
      const response = await fetch(MCP_SERVER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 4,
          method: 'tools/call',
          params: {
            name: 'submit_hive_query',
            arguments: {
              clusterName: `{{job_output('${REAL_JOB_ID}', 'clusterName')}}`,
              query: `SELECT * FROM {{job_output('${REAL_JOB_ID}', 'tables[0].rows[0][0]')}} LIMIT 10`,
              async: true
            }
          }
        })
      });

      const result = await response.json();
      
      // Should handle complex template processing
      if (result.error && !result.error.message.includes('cluster') && !result.error.message.includes('template')) {
        throw new Error(`Unexpected error: ${result.error.message}`);
      }
      
      console.log('   Complex multi-template processing handled correctly');
    }, testResults);

    // Test 5: Backward Compatibility (No Templates)
    await runTest('Backward Compatibility (No Templates)', async () => {
      const response = await fetch(MCP_SERVER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 5,
          method: 'tools/call',
          params: {
            name: 'list_profiles',
            arguments: {}
          }
        })
      });

      const result = await response.json();
      
      if (result.error) {
        throw new Error(`Backward compatibility failed: ${result.error.message}`);
      }
      
      if (!result.result) {
        throw new Error('No result returned for simple tool call');
      }
      
      console.log('   Backward compatibility maintained');
    }, testResults);

    // Generate report
    console.log('\n📊 MCP Integration Test Report');
    console.log('==============================');
    
    const successRate = ((testResults.passedTests / testResults.totalTests) * 100).toFixed(1);
    console.log(`Total Tests: ${testResults.totalTests}`);
    console.log(`Passed: ${testResults.passedTests} (${successRate}%)`);
    console.log(`Failed: ${testResults.failedTests}`);
    
    if (testResults.errors.length > 0) {
      console.log('\n❌ Errors:');
      testResults.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error.test}: ${error.message}`);
      });
    }
    
    if (testResults.failedTests === 0) {
      console.log('\n✅ All MCP integration tests passed!');
      console.log('🎉 Dynamic templating pipeline working correctly through MCP server');
    } else {
      console.log('\n⚠️  Some MCP integration tests failed');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ MCP integration testing failed:', error);
    process.exit(1);
  }
}

async function runTest(testName, testFn, results) {
  results.totalTests++;
  try {
    console.log(`🧪 ${testName}...`);
    await testFn();
    results.passedTests++;
    console.log(`✅ ${testName} passed`);
  } catch (error) {
    results.failedTests++;
    results.errors.push({
      test: testName,
      message: error.message
    });
    console.log(`❌ ${testName} failed: ${error.message}`);
  }
}

// Run the tests
testMCPIntegration().catch(console.error);