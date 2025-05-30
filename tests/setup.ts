/**
 * Mocha Test Setup
 *
 * Global test configuration and setup for the Dataproc MCP Server test suite.
 */

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.GOOGLE_APPLICATION_CREDENTIALS = 'test-credentials.json';
process.env.DATAPROC_PROJECT_ID = 'test-project';
process.env.DATAPROC_REGION = 'us-central1';

// Global test utilities
(global as any).testUtils = {
  // Mock cluster configuration
  mockClusterConfig: {
    clusterName: 'test-cluster',
    config: {
      masterConfig: {
        numInstances: 1,
        machineTypeUri: 'n1-standard-2',
        diskConfig: {
          bootDiskSizeGb: 50,
        },
      },
      workerConfig: {
        numInstances: 2,
        machineTypeUri: 'n1-standard-2',
        diskConfig: {
          bootDiskSizeGb: 50,
        },
      },
    },
  },

  // Mock job configuration
  mockJobConfig: {
    jobType: 'hive',
    jobConfig: {
      queryList: {
        queries: ['SHOW TABLES;'],
      },
    },
  },

  // Helper to create mock MCP request
  createMockRequest: (toolName: string, arguments_: any) => ({
    method: 'tools/call',
    params: {
      name: toolName,
      arguments: arguments_,
    },
  }),

  // Helper to create mock MCP response
  createMockResponse: (content: any, isError = false) => ({
    content: [
      {
        type: 'text',
        text: isError ? `Error: ${content}` : JSON.stringify(content, null, 2),
      },
    ],
    isError,
  }),
};

// Store original console for potential restoration
const originalConsole = console;

// Create mock console functions (simple no-op functions for testing)
const mockConsole = {
  ...originalConsole,
  log: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
};

// Override console for cleaner test output (optional)
// Uncomment the next line if you want to suppress console output during tests
// global.console = mockConsole;

// Restore console function
(global as any).restoreConsole = () => {
  (global as any).console = originalConsole;
};

// Global error handler for unhandled promises
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

export {};
