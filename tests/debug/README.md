# Debug Scripts

This directory contains debug scripts used during development and troubleshooting of the Dataproc MCP server.

## Files

### Debug Scripts
- **debug-cluster-manager.js** - Debug script for testing cluster manager functionality
- **debug-profile-loading.js** - Debug script for testing profile loading and parsing
- **debug-service-account.js** - Debug script for testing service account configuration issues
- **test-final-debug.js** - Final debug script used during service account troubleshooting

## Usage

These scripts are primarily used for development and debugging purposes. They can be run directly with Node.js:

```bash
node tests/debug/debug-cluster-manager.js
node tests/debug/debug-profile-loading.js
node tests/debug/debug-service-account.js
node tests/debug/test-final-debug.js
```

## Note

These scripts may require specific environment variables or configuration to run properly. They are intended for development use and may not work in all environments.
