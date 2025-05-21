// Simple test runner for our specific test
const { execSync } = require('child_process');
const path = require('path');

// Run only our specific test file
try {
  execSync('npx mocha tests/integration/test-job-results.ts --require ts-node/register --timeout 60000',
    { stdio: 'inherit' });
  console.log('Test completed successfully!');
} catch (error) {
  console.error('Test failed:', error.message);
  process.exit(1);
}
