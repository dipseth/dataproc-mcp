# Testing MCP Resources and Prompts

This document provides instructions for testing the MCP (Model Context Protocol) resources and prompts functionality in the Dataproc server.

## Overview

The Dataproc server now supports MCP resources and prompts, which allow LLM agents to:

1. **List available resources** - Get a list of tracked clusters and jobs
2. **Read resource details** - Get detailed information about a specific cluster or job
3. **List available prompts** - Get a list of available guidance prompts
4. **Read prompt content** - Get detailed guidance on specific topics

## Available Resources

The server exposes the following resources:

- **Cluster resources**: `dataproc://clusters/{projectId}/{region}/{clusterName}`
- **Job resources**: `dataproc://jobs/{projectId}/{region}/{jobId}`

## Available Prompts

The server provides the following prompts:

- **Dataproc Cluster Creation** (`dataproc-cluster-creation`): Guidelines for creating Dataproc clusters
- **Dataproc Job Submission** (`dataproc-job-submission`): Guidelines for submitting jobs to Dataproc clusters

## Running Tests

You can run the tests using the test runner script:

```bash
# Run all tests
node tests/run-tests.js all

# Run specific test types
node tests/run-tests.js unit
node tests/run-tests.js integration
node tests/run-tests.js simple
node tests/run-tests.js manual
```

## Test Types

### 1. Unit Tests

These tests verify the resource and prompt handler logic using Mocha and Chai. They use a CommonJS format (`.cjs` extension) to avoid module cycle issues.

```bash
npx mocha tests/unit/resource-handlers.test.cjs
```

### 2. Integration Tests

This script sets up a test MCP server with a custom memory transport and sends requests to test the resource and prompt handlers.

```bash
npx ts-node tests/integration/test-mcp-resources.ts
```

### 3. Simple Demo

This script demonstrates how the MCP resources and prompts handlers are set up and what they return. It doesn't require any external dependencies or actual clusters/jobs.

```bash
npx ts-node tests/manual/test-mcp-resources-simple.ts
```

### 4. Manual Tests

This script tests the resource and prompt handlers by sending requests to a running server. Start the server first, then run this script.

```bash
# Start the server in one terminal
node build/index.js

# Run the test script in another terminal
node tests/manual/test-mcp-resources.js
```

## Troubleshooting Common Issues

### Module Type Issues

This project uses ES modules (`"type": "module"` in package.json). Keep these points in mind:

1. **JavaScript files (.js)** are treated as ES modules and must use `import`/`export` syntax
2. **CommonJS files (.cjs)** can use `require()`/`module.exports` syntax
3. **TypeScript files (.ts)** follow the configuration in `tsconfig.json`

If you encounter module-related errors:
- Check that `.js` files use ES module syntax
- Use `.cjs` extension for files that need CommonJS syntax
- Make sure imports include the file extension (`.js`, `.cjs`, etc.)

### TypeScript Configuration

Make sure your `tsconfig.json` is properly configured for ES modules:

```json
{
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    // other options...
  }
}
```

### Running Tests with Mocha

When running tests with Mocha, use the appropriate command based on the file type:

- For CommonJS tests: `npx mocha tests/unit/resource-handlers.test.cjs`
- For TypeScript tests: `npx mocha --require ts-node/register tests/integration/test-mcp-resources.ts`

## Expected Responses

### List Resources Response

```json
{
  "resources": [
    {
      "uri": "dataproc://clusters/project-id/region/cluster-name",
      "name": "Cluster: cluster-name",
      "description": "Dataproc cluster in region (RUNNING)"
    },
    {
      "uri": "dataproc://jobs/project-id/region/job-id",
      "name": "Job: job-id",
      "description": "Dataproc job (submit_hive_query) - DONE"
    }
  ]
}
```

### Read Resource Response (Cluster)

```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"clusterName\":\"cluster-name\",\"status\":{\"state\":\"RUNNING\"},\"config\":{...}}"
    }
  ]
}
```

### Read Resource Response (Job)

```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"status\":{\"state\":\"DONE\"},\"results\":{...}}"
    }
  ]
}
```

### List Prompts Response

```json
{
  "prompts": [
    {
      "id": "dataproc-cluster-creation",
      "name": "Dataproc Cluster Creation",
      "description": "Guidelines for creating Dataproc clusters"
    },
    {
      "id": "dataproc-job-submission",
      "name": "Dataproc Job Submission",
      "description": "Guidelines for submitting jobs to Dataproc clusters"
    }
  ]
}
```

### Read Prompt Response

```json
{
  "content": [
    {
      "type": "text",
      "text": "# Dataproc Cluster Creation Guidelines\n\nWhen creating a Dataproc cluster, consider the following:\n\n1. **Region Selection**: Choose a region close to your data and users to minimize latency.\n..."
    }
  ]
}