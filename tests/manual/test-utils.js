/**
 * Test file for utils
 * This file tests the functionality of the utility modules in src/utils
 */

// Import the utils using ES modules
import { mcpSafeOutput, restoreConsole } from './build/src/utils/mcp-stdio-handler.js';
import { logger } from './build/src/utils/logger.js';

console.log("Testing utils...");

// Test logger
console.log("Testing logger...");
logger.debug("This is a debug message");
logger.info("This is an info message");
logger.warn("This is a warning message");
logger.error("This is an error message");

// Test MCP safe output
console.log("Testing MCP safe output...");
mcpSafeOutput({ status: "success", message: "This is a test message" });

console.log("Utils test completed");