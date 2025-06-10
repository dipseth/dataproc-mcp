#!/usr/bin/env node

/**
 * Test script to demonstrate the diagnostic logging for configuration loading
 * This test helps identify why DATAPROC_CONFIG_PATH environment variable might be ignored
 *
 * CI/CD Safe: Uses repo config files that exist in all environments
 */

import { getServerConfig } from '../../build/config/server.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('='.repeat(80));
console.log('TESTING CONFIGURATION DIAGNOSTIC LOGGING');
console.log('This test demonstrates the configuration path resolution logic');
console.log('='.repeat(80));

async function runTest(testName, testFn) {
  console.log(`\n${testName}`);
  console.log('-'.repeat(testName.length));
  try {
    await testFn();
  } catch (error) {
    console.error('Test error:', error.message);
  }
  console.log(''); // Add spacing between tests
}

// Test 1: Default configuration (no parameters)
await runTest('1. Testing with no parameters (should use default config path):', async () => {
  // Clear environment variable for this test
  delete process.env.DATAPROC_CONFIG_PATH;
  await getServerConfig();
});

// Test 2: Direct configPath parameter
await runTest('2. Testing with direct configPath parameter (should override everything):', async () => {
  process.env.DATAPROC_CONFIG_PATH = join(__dirname, '../../config/server.json');
  await getServerConfig('/nonexistent/direct-config.json');
});

// Test 3: Environment variable only
await runTest('3. Testing with DATAPROC_CONFIG_PATH environment variable only:', async () => {
  process.env.DATAPROC_CONFIG_PATH = join(__dirname, '../../config/server.json');
  await getServerConfig(); // No direct parameter
});

// Test 4: Both parameter and environment variable (parameter should win)
await runTest('4. Testing precedence: configPath parameter vs environment variable:', async () => {
  process.env.DATAPROC_CONFIG_PATH = join(__dirname, '../../config/server.json');
  await getServerConfig('/another/nonexistent/config.json');
});

// Test 5: Test with a valid config file path (if it exists)
await runTest('5. Testing with user\'s actual config file (if accessible):', async () => {
  delete process.env.DATAPROC_CONFIG_PATH;
  await getServerConfig(join(__dirname, '../../config/server.json'));
});

console.log('='.repeat(80));
console.log('DIAGNOSTIC LOGGING TEST COMPLETE');
console.log('');
console.log('KEY INSIGHTS FROM THIS TEST:');
console.log('- Check which configuration source is being used in the diagnostic output');
console.log('- If DATAPROC_CONFIG_PATH is being ignored, look for a direct configPath parameter');
console.log('- The precedence is: configPath parameter > DATAPROC_CONFIG_PATH > default');
console.log('- File accessibility issues will be clearly shown in the diagnostic output');
console.log('='.repeat(80));