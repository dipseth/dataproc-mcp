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

// MUTEX LOCK FIX: Add global test hooks for singleton cleanup
beforeEach(async function() {
  console.log('🔄 [MUTEX-DEBUG] Test setup: Clearing singleton instances');
  
  // Clear TransformersEmbeddingService singleton to prevent mutex issues
  try {
    const { TransformersEmbeddingService } = await import('../src/services/transformers-embeddings.js');
    TransformersEmbeddingService.clearInstance();
    console.log('🔄 [MUTEX-DEBUG] Test setup: TransformersEmbeddingService singleton cleared');
  } catch (error) {
    console.warn('🔄 [MUTEX-DEBUG] Test setup: Could not clear TransformersEmbeddingService singleton:', error);
  }
});

afterEach(async function() {
  console.log('🔄 [MUTEX-DEBUG] Test cleanup: Starting cleanup');
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
    console.log('🔄 [MUTEX-DEBUG] Test cleanup: Forced garbage collection');
  }
  
  // Add delay to allow worker threads to terminate
  await new Promise(resolve => setTimeout(resolve, 100));
  console.log('🔄 [MUTEX-DEBUG] Test cleanup: Cleanup complete');
});

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

// Global cleanup handlers for test crashes
const activeServices = new Set();

(global as any).registerServiceForCleanup = (service: any) => {
  activeServices.add(service);
};

(global as any).unregisterServiceForCleanup = (service: any) => {
  activeServices.delete(service);
};

async function emergencyCleanup() {
  console.log('🚨 Emergency cleanup triggered...');
  
  for (const service of activeServices) {
    try {
      if (service && typeof (service as any).shutdown === 'function') {
        const serviceName = service.constructor?.name || 'Unknown Service';
        console.log(`🧹 Emergency cleanup: Shutting down ${serviceName}`);
        await (service as any).shutdown();
        console.log(`✅ Emergency cleanup: ${serviceName} shutdown completed`);
      }
    } catch (error) {
      const serviceName = service?.constructor?.name || 'Unknown Service';
      console.error(`❌ Emergency cleanup error for ${serviceName}:`, error);
    }
  }
  
  activeServices.clear();
  console.log('🧹 Emergency cleanup completed');
}

/**
 * Enhanced cleanup function for comprehensive service shutdown
 */
(global as any).cleanupAllServices = async () => {
  console.log('🧹 Starting comprehensive service cleanup');
  
  const cleanupPromises: Promise<any>[] = [];
  
  for (const service of activeServices) {
    if (service && typeof (service as any).shutdown === 'function') {
      const serviceName = service.constructor?.name || 'Unknown Service';
      console.log(`🧹 Cleanup: Shutting down ${serviceName}`);
      
      const shutdownPromise = Promise.resolve((service as any).shutdown()).catch((error: unknown) => {
        console.error(`❌ Cleanup failed for ${serviceName}:`, error);
      });
      cleanupPromises.push(shutdownPromise);
    }
  }
  
  // Wait for all cleanups to complete
  await Promise.allSettled(cleanupPromises);
  
  activeServices.clear();
  console.log('🧹 Comprehensive service cleanup completed');
};

// Register emergency cleanup handlers
process.on('SIGINT', async () => {
  await emergencyCleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await emergencyCleanup();
  process.exit(0);
});

process.on('uncaughtException', async (error) => {
  console.error('Uncaught Exception:', error);
  await emergencyCleanup();
  process.exit(1);
});

export {};
