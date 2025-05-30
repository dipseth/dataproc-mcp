/**
 * MCP STDIO Handler
 *
 * This module ensures that only valid JSON is sent to stdout for MCP communication.
 * All other output (logs, debug messages, etc.) is redirected to stderr.
 *
 * It should be imported at the very beginning of the application.
 */

// Store original console methods
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleInfo = console.info;
const originalConsoleDebug = console.debug;

/**
 * Format a log message for stderr
 */
function formatLogForStderr(prefix: string, message: any, ...args: any[]): string {
  const timestamp = new Date().toISOString();
  const msgStr = typeof message === 'string' ? message : JSON.stringify(message);
  const argsStr =
    args.length > 0
      ? ' ' + args.map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' ')
      : '';

  return `[${timestamp}] [${prefix}] ${msgStr}${argsStr}\n`;
}

// Override console methods to use stderr directly
console.log = function (message: any, ...args: any[]): void {
  process.stderr.write(formatLogForStderr('LOG', message, ...args));
};

console.error = function (message: any, ...args: any[]): void {
  process.stderr.write(formatLogForStderr('ERROR', message, ...args));
};

console.warn = function (message: any, ...args: any[]): void {
  process.stderr.write(formatLogForStderr('WARN', message, ...args));
};

console.info = function (message: any, ...args: any[]): void {
  process.stderr.write(formatLogForStderr('INFO', message, ...args));
};

console.debug = function (message: any, ...args: any[]): void {
  process.stderr.write(formatLogForStderr('DEBUG', message, ...args));
};

// Create a special function for MCP-safe JSON output
export function mcpSafeOutput(data: any): void {
  try {
    // Ensure data is serializable
    const jsonString = JSON.stringify(data);
    // Write directly to stdout
    process.stdout.write(jsonString + '\n');
  } catch (error) {
    console.error('Failed to serialize data for MCP output:', error);
  }
}

// Export a function to restore original console methods
export function restoreConsole(): void {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
  console.info = originalConsoleInfo;
  console.debug = originalConsoleDebug;
}
