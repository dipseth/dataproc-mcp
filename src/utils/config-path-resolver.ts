/**
 * Centralized Configuration Path Resolver
 *
 * Provides consistent configuration path resolution across all services.
 * Respects DATAPROC_CONFIG_PATH environment variable with proper fallbacks.
 */

import * as path from 'path';
import { fileURLToPath } from 'url';

// Determine the application root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APP_ROOT = path.resolve(__dirname, '../..');

/**
 * Resolves the configuration directory path
 * Priority: DATAPROC_CONFIG_PATH env var > APP_ROOT/config
 */
export function getConfigDirectory(): string {
  if (process.env.DATAPROC_CONFIG_PATH) {
    return path.dirname(process.env.DATAPROC_CONFIG_PATH);
  }
  return path.join(APP_ROOT, 'config');
}

/**
 * Resolves a specific configuration file path
 * @param filename - The configuration file name (e.g., 'default-params.json')
 * @returns Absolute path to the configuration file
 */
export function getConfigFilePath(filename: string): string {
  const configDir = getConfigDirectory();
  return path.join(configDir, filename);
}

/**
 * Gets the application root directory
 * @returns Absolute path to the application root
 */
export function getAppRoot(): string {
  return APP_ROOT;
}

/**
 * Resolves the state directory path
 * Uses the same directory as config for consistency
 */
export function getStateDirectory(): string {
  const configDir = getConfigDirectory();
  // If using custom config path, put state in same directory
  if (process.env.DATAPROC_CONFIG_PATH) {
    return path.join(configDir, 'state');
  }
  // Otherwise use APP_ROOT/state
  return path.join(APP_ROOT, 'state');
}

/**
 * Resolves a specific state file path
 * @param filename - The state file name (e.g., 'dataproc-state.json')
 * @returns Absolute path to the state file
 */
export function getStateFilePath(filename: string): string {
  const stateDir = getStateDirectory();
  return path.join(stateDir, filename);
}

/**
 * Diagnostic logging for configuration path resolution
 * @param context - Context string for logging (e.g., service name)
 */
export function logConfigPathDiagnostics(context: string): void {
  console.error(`[DIAGNOSTIC] ${context} - Configuration Path Resolution:`);
  console.error(
    `[DIAGNOSTIC] - DATAPROC_CONFIG_PATH: ${process.env.DATAPROC_CONFIG_PATH || 'undefined'}`
  );
  console.error(`[DIAGNOSTIC] - Config directory: ${getConfigDirectory()}`);
  console.error(`[DIAGNOSTIC] - State directory: ${getStateDirectory()}`);
  console.error(`[DIAGNOSTIC] - App root: ${getAppRoot()}`);
  console.error(`[DIAGNOSTIC] - Current working directory: ${process.cwd()}`);
}
