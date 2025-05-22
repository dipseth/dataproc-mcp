#!/usr/bin/env node

/**
 * Test runner script for MCP resources and prompts tests
 * 
 * This script runs the different test types for the MCP resources and prompts functionality.
 * 
 * Usage:
 *   node tests/run-tests.js [test-type]
 * 
 * Where test-type is one of:
 *   - unit: Run unit tests with Mocha
 *   - integration: Run integration tests with ts-node
 *   - manual: Run manual tests (requires server to be running)
 *   - simple: Run simple demo tests
 *   - all: Run all tests
 */

import { spawn } from 'child_process';
import path from 'path';
import readline from 'readline';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// Get the test type from command line arguments
const testType = process.argv[2] || 'all';

// Function to run a command and return a promise
function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`${colors.bright}${colors.blue}Running command:${colors.reset} ${command} ${args.join(' ')}`);
    
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      ...options
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        console.log(`${colors.bright}${colors.green}Command completed successfully${colors.reset}`);
        resolve();
      } else {
        console.error(`${colors.bright}${colors.red}Command failed with code ${code}${colors.reset}`);
        reject(new Error(`Command failed with code ${code}`));
      }
    });
    
    child.on('error', (error) => {
      console.error(`${colors.bright}${colors.red}Command error: ${error.message}${colors.reset}`);
      reject(error);
    });
  });
}

// Run unit tests
async function runUnitTests() {
  console.log(`\n${colors.bright}${colors.magenta}=== Running Unit Tests ===${colors.reset}\n`);
  try {
    await runCommand('npx', ['mocha', 'tests/unit/resource-handlers.test.cjs']);
    console.log(`${colors.bright}${colors.green}✓ Unit tests passed${colors.reset}`);
    return true;
  } catch (error) {
    console.error(`${colors.bright}${colors.red}✗ Unit tests failed${colors.reset}`);
    return false;
  }
}

// Run integration tests
async function runIntegrationTests() {
  console.log(`\n${colors.bright}${colors.magenta}=== Running Integration Tests ===${colors.reset}\n`);
  try {
    await runCommand('npx', ['ts-node', 'tests/integration/test-mcp-resources.ts']);
    console.log(`${colors.bright}${colors.green}✓ Integration tests passed${colors.reset}`);
    return true;
  } catch (error) {
    console.error(`${colors.bright}${colors.red}✗ Integration tests failed${colors.reset}`);
    return false;
  }
}

// Run simple demo tests
async function runSimpleTests() {
  console.log(`\n${colors.bright}${colors.magenta}=== Running Simple Demo Tests ===${colors.reset}\n`);
  try {
    await runCommand('npx', ['ts-node', 'tests/manual/test-mcp-resources-simple.ts']);
    console.log(`${colors.bright}${colors.green}✓ Simple demo tests passed${colors.reset}`);
    return true;
  } catch (error) {
    console.error(`${colors.bright}${colors.red}✗ Simple demo tests failed${colors.reset}`);
    return false;
  }
}

// Run manual tests
async function runManualTests() {
  console.log(`\n${colors.bright}${colors.magenta}=== Running Manual Tests ===${colors.reset}\n`);
  console.log(`${colors.bright}${colors.yellow}Note: This test requires the server to be running in another terminal.${colors.reset}`);
  console.log(`${colors.bright}${colors.yellow}If the server is not running, start it with: node build/index.js${colors.reset}\n`);
  
  // Ask if the server is running
  console.log(`${colors.bright}${colors.cyan}Is the server running? (y/n)${colors.reset}`);
  
  // Wait for user input
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question('', async (answer) => {
      rl.close();
      
      if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
        try {
          await runCommand('node', ['tests/manual/test-mcp-resources.js']);
          console.log(`${colors.bright}${colors.green}✓ Manual tests passed${colors.reset}`);
          resolve(true);
        } catch (error) {
          console.error(`${colors.bright}${colors.red}✗ Manual tests failed${colors.reset}`);
          resolve(false);
        }
      } else {
        console.log(`${colors.bright}${colors.yellow}Skipping manual tests${colors.reset}`);
        resolve(true); // Not a failure, just skipped
      }
    });
  });
}

// Main function
async function main() {
  console.log(`${colors.bright}${colors.cyan}MCP Resources and Prompts Test Runner${colors.reset}`);
  
  let success = true;
  
  try {
    switch (testType.toLowerCase()) {
      case 'unit':
        success = await runUnitTests();
        break;
      case 'integration':
        success = await runIntegrationTests();
        break;
      case 'simple':
        success = await runSimpleTests();
        break;
      case 'manual':
        success = await runManualTests();
        break;
      case 'all':
        const unitSuccess = await runUnitTests();
        const integrationSuccess = await runIntegrationTests();
        const simpleSuccess = await runSimpleTests();
        const manualSuccess = await runManualTests();
        success = unitSuccess && integrationSuccess && simpleSuccess && manualSuccess;
        break;
      default:
        console.error(`${colors.bright}${colors.red}Unknown test type: ${testType}${colors.reset}`);
        console.log(`${colors.bright}${colors.yellow}Available test types: unit, integration, simple, manual, all${colors.reset}`);
        process.exit(1);
    }
    
    if (success) {
      console.log(`\n${colors.bright}${colors.green}All tests completed successfully!${colors.reset}`);
      process.exit(0);
    } else {
      console.error(`\n${colors.bright}${colors.red}Some tests failed.${colors.reset}`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`\n${colors.bright}${colors.red}Error running tests: ${error.message}${colors.reset}`);
    process.exit(1);
  }
}

// Run the main function
main();