/**
 * Console Interceptor for MCP Server
 * 
 * This module intercepts all console.log and console.error calls
 * to ensure debug logs don't interfere with the MCP protocol.
 * 
 * It should be imported at the very beginning of the application.
 */

// Store original console methods
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

// Regular expression to detect debug logs
const debugLogRegex = /\[DEBUG\]/;

// Custom log formatter that won't interfere with MCP protocol
function formatDebugLog(message: string, ...args: any[]): string {
  // Format: @@LOG@@{message}@@{args}@@
  // This format is unlikely to be parsed as JSON and can be filtered out by the MCP inspector
  const argsStr = args.length > 0 ? `@@${JSON.stringify(args)}@@` : '';
  return `@@LOG@@${message}${argsStr}@@`;
}

// Override console.log
console.log = function(message: any, ...args: any[]): void {
  // Check if this is a debug log
  if (typeof message === 'string' && debugLogRegex.test(message)) {
    // For debug logs, write to stderr with special formatting
    process.stderr.write(formatDebugLog(message, ...args) + '\n');
  } else {
    // For non-debug logs, use the original console.log
    originalConsoleLog(message, ...args);
  }
};

// Override console.error
console.error = function(message: any, ...args: any[]): void {
  // Check if this is a debug log
  if (typeof message === 'string' && debugLogRegex.test(message)) {
    // For debug logs, write to stderr with special formatting
    process.stderr.write(formatDebugLog(message, ...args) + '\n');
  } else {
    // For non-debug logs, use the original console.error
    originalConsoleError(message, ...args);
  }
};

// Export a function to restore original console methods if needed
export function restoreConsole(): void {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
}