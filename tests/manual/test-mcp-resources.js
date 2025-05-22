#!/usr/bin/env node

/**
 * Simple test script for MCP resources and prompts
 * 
 * This script sends MCP requests to a running server to test the resource and prompt handlers.
 * It uses the Node.js net module to communicate with the server over stdio.
 * 
 * Usage:
 * 1. Start the server in one terminal: node build/index.js
 * 2. Run this script in another terminal: node tests/manual/test-mcp-resources.js
 */

import net from 'net';
import readline from 'readline';

// Create a socket connection to the server
const socket = new net.Socket();
let messageId = 1;

// Function to send a request and receive a response
async function sendRequest(request) {
  return new Promise((resolve, reject) => {
    // Add message ID and jsonrpc version
    const fullRequest = {
      ...request,
      id: messageId++,
      jsonrpc: '2.0'
    };
    
    console.log(`\nSending request: ${JSON.stringify(fullRequest, null, 2)}`);
    
    // Send the request
    process.stdout.write(JSON.stringify(fullRequest) + '\n');
    
    // Set up readline to read the response
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false
    });
    
    // Listen for the response
    rl.once('line', (line) => {
      try {
        const response = JSON.parse(line);
        console.log(`Received response: ${JSON.stringify(response, null, 2)}`);
        rl.close();
        resolve(response);
      } catch (error) {
        console.error('Error parsing response:', error);
        rl.close();
        reject(error);
      }
    });
  });
}

// Test listing resources
async function testListResources() {
  console.log('\n=== Testing List Resources ===');
  
  try {
    const response = await sendRequest({
      method: 'list_resources'
    });
    
    if (response.result && response.result.resources) {
      console.log(`Found ${response.result.resources.length} resources`);
      return response.result.resources;
    } else {
      console.error('No resources found in response');
      return [];
    }
  } catch (error) {
    console.error('Error listing resources:', error);
    return [];
  }
}

// Test reading a resource
async function testReadResource(uri) {
  console.log(`\n=== Testing Read Resource: ${uri} ===`);
  
  try {
    const response = await sendRequest({
      method: 'read_resource',
      params: {
        uri
      }
    });
    
    if (response.result && response.result.content) {
      console.log('Resource content received');
      return response.result.content;
    } else {
      console.error('No content found in response');
      return null;
    }
  } catch (error) {
    console.error(`Error reading resource ${uri}:`, error);
    return null;
  }
}

// Test listing prompts
async function testListPrompts() {
  console.log('\n=== Testing List Prompts ===');
  
  try {
    const response = await sendRequest({
      method: 'list_prompts'
    });
    
    if (response.result && response.result.prompts) {
      console.log(`Found ${response.result.prompts.length} prompts`);
      return response.result.prompts;
    } else {
      console.error('No prompts found in response');
      return [];
    }
  } catch (error) {
    console.error('Error listing prompts:', error);
    return [];
  }
}

// Test reading a prompt
async function testReadPrompt(id) {
  console.log(`\n=== Testing Read Prompt: ${id} ===`);
  
  try {
    const response = await sendRequest({
      method: 'read_prompt',
      params: {
        id
      }
    });
    
    if (response.result && response.result.content) {
      console.log('Prompt content received');
      return response.result.content;
    } else {
      console.error('No content found in response');
      return null;
    }
  } catch (error) {
    console.error(`Error reading prompt ${id}:`, error);
    return null;
  }
}

// Main function to run all tests
async function main() {
  console.log('=== MCP Resource and Prompt Tests ===');
  console.log('Make sure the server is running in another terminal with: node build/index.js');
  
  try {
    // Test listing resources
    const resources = await testListResources();
    
    // Test reading resources
    if (resources.length > 0) {
      for (const resource of resources.slice(0, 2)) { // Test up to 2 resources
        await testReadResource(resource.uri);
      }
    } else {
      console.log('No resources to read, testing with sample URIs');
      await testReadResource('dataproc://clusters/test-project/us-central1/test-cluster');
      await testReadResource('dataproc://jobs/test-project/us-central1/test-job');
    }
    
    // Test listing prompts
    const prompts = await testListPrompts();
    
    // Test reading prompts
    if (prompts.length > 0) {
      for (const prompt of prompts) {
        await testReadPrompt(prompt.id);
      }
    } else {
      console.log('No prompts to read, testing with sample IDs');
      await testReadPrompt('dataproc-cluster-creation');
      await testReadPrompt('dataproc-job-submission');
    }
    
    console.log('\n=== All tests completed ===');
    process.exit(0);
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