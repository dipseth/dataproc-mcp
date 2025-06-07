/**
 * Global dependency registry for MCP Framework tools
 * Allows tools to access dependencies when instantiated by auto-discovery
 */

import { AllHandlerDependencies } from '../handlers/index.js';

class DependencyRegistry {
  private static instance: DependencyRegistry;
  private dependencies: AllHandlerDependencies | null = null;

  private constructor() {}

  static getInstance(): DependencyRegistry {
    if (!DependencyRegistry.instance) {
      DependencyRegistry.instance = new DependencyRegistry();
    }
    return DependencyRegistry.instance;
  }

  setDependencies(deps: AllHandlerDependencies): void {
    this.dependencies = deps;
  }

  getDependencies(): AllHandlerDependencies {
    if (!this.dependencies) {
      throw new Error('Dependencies not initialized. Make sure to call setDependencies() before using tools.');
    }
    return this.dependencies;
  }

  hasDependencies(): boolean {
    return this.dependencies !== null;
  }
}

export default DependencyRegistry;