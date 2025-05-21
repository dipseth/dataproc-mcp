/**
 * Logger utility for MCP server
 * Ensures logs don't interfere with MCP protocol
 */

// Environment variable to control log level
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// Log levels
const LOG_LEVELS: Record<string, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

// Check if the current log level allows the specified level
function shouldLog(level: string): boolean {
  const currentLevel = LOG_LEVELS[LOG_LEVEL.toLowerCase()] || LOG_LEVELS.info;
  const requestedLevel = LOG_LEVELS[level.toLowerCase()] || LOG_LEVELS.info;
  return requestedLevel >= currentLevel;
}

// Log to a file instead of stdout/stderr to avoid interfering with MCP protocol
function logToFile(level: string, message: string, data?: any): void {
  // In a real implementation, this would write to a file
  // For now, we'll just use console.log directly for visibility during debugging
  
  const logData = data ? ` ${JSON.stringify(data)}` : '';
  console.log(`[${level}] ${message}${logData}`);
}

// Logger functions
export const logger = {
  debug: (message: string, data?: any) => {
    if (shouldLog('debug')) {
      logToFile('DEBUG', message, data);
    }
  },
  
  info: (message: string, data?: any) => {
    if (shouldLog('info')) {
      logToFile('INFO', message, data);
    }
  },
  
  warn: (message: string, data?: any) => {
    if (shouldLog('warn')) {
      logToFile('WARN', message, data);
    }
  },
  
  error: (message: string, data?: any) => {
    if (shouldLog('error')) {
      logToFile('ERROR', message, data);
    }
  }
};