#!/usr/bin/env node

/**
 * Run tests against built JavaScript files instead of TypeScript sources
 * This ensures consistency between local and CI environments
 */

const { spawn } = require('child_process');
const path = require('path');

const testPattern = process.argv[2];
const timeout = process.argv[3] || '30000';

if (!testPattern) {
  console.error('Usage: node scripts/run-tests-built.js <test-pattern> [timeout]');
  process.exit(1);
}

// Convert TypeScript test pattern to JavaScript
const jsPattern = testPattern.replace(/\.ts/g, '.js').replace(/tests\//g, 'build/tests/');

console.log(`🔄 Running tests against built files: ${jsPattern}`);

const mocha = spawn('mocha', [jsPattern, '--timeout', timeout, '--exit'], {
  stdio: 'inherit',
  shell: true
});

mocha.on('close', (code) => {
  process.exit(code);
});