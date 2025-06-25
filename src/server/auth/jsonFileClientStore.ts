/**
 * JSON file-based client store for OAuth Dynamic Client Registration
 * Implements persistent storage for client credentials in state/clients.json
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { randomUUID } from 'node:crypto';
import { logger } from '../../utils/logger.js';

export interface ClientData {
  client_id: string;
  client_secret: string;
  redirect_uris: string[];
  client_name?: string;
  client_uri?: string;
  logo_uri?: string;
  scope?: string;
  contacts?: string[];
  tos_uri?: string;
  policy_uri?: string;
  jwks_uri?: string;
  jwks?: any;
  software_id?: string;
  software_version?: string;
  created_at: number;
  updated_at: number;
}

export interface ClientStore {
  get(clientId: string): Promise<ClientData | null>;
  set(clientId: string, clientData: ClientData): Promise<void>;
  delete(clientId: string): Promise<void>;
  create(registrationData: any): Promise<ClientData>;
}

export class JsonFileClientStore implements ClientStore {
  private filePath: string;
  private cache: Map<string, ClientData> = new Map();
  private lastModified: number = 0;

  constructor(filePath?: string) {
    // Default to state/clients.json in the project root
    this.filePath = filePath || path.join(process.cwd(), 'state', 'clients.json');
    logger.debug(`JsonFileClientStore initialized with path: ${this.filePath}`);
  }

  /**
   * Ensures the state directory exists
   */
  private async ensureStateDirectory(): Promise<void> {
    const dir = path.dirname(this.filePath);
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      logger.error(`Failed to create state directory ${dir}:`, error);
      throw error;
    }
  }

  /**
   * Loads clients from the JSON file
   */
  private async loadClients(): Promise<Map<string, ClientData>> {
    try {
      // Check if file exists
      try {
        const stats = await fs.stat(this.filePath);

        // If file hasn't been modified since last load, return cached data
        if (stats.mtime.getTime() === this.lastModified && this.cache.size > 0) {
          return this.cache;
        }

        this.lastModified = stats.mtime.getTime();
      } catch (error) {
        // File doesn't exist, return empty map
        logger.debug(`Clients file doesn't exist at ${this.filePath}, starting with empty store`);
        this.cache.clear();
        return this.cache;
      }

      const data = await fs.readFile(this.filePath, 'utf8');
      const clientsObject = JSON.parse(data);

      // Convert object to Map
      this.cache.clear();
      for (const [clientId, clientData] of Object.entries(clientsObject)) {
        this.cache.set(clientId, clientData as ClientData);
      }

      logger.debug(`Loaded ${this.cache.size} clients from ${this.filePath}`);
      return this.cache;
    } catch (error) {
      logger.error(`Failed to load clients from ${this.filePath}:`, error);
      // Return empty cache on error
      this.cache.clear();
      return this.cache;
    }
  }

  /**
   * Saves clients to the JSON file
   */
  private async saveClients(): Promise<void> {
    try {
      await this.ensureStateDirectory();

      // Convert Map to object
      const clientsObject: Record<string, ClientData> = {};
      for (const [clientId, clientData] of this.cache.entries()) {
        clientsObject[clientId] = clientData;
      }

      const data = JSON.stringify(clientsObject, null, 2);
      await fs.writeFile(this.filePath, data, 'utf8');

      // Update last modified time
      const stats = await fs.stat(this.filePath);
      this.lastModified = stats.mtime.getTime();

      logger.debug(`Saved ${this.cache.size} clients to ${this.filePath}`);
    } catch (error) {
      logger.error(`Failed to save clients to ${this.filePath}:`, error);
      throw error;
    }
  }

  /**
   * Gets a client by ID
   */
  async get(clientId: string): Promise<ClientData | null> {
    await this.loadClients();
    const client = this.cache.get(clientId) || null;

    if (client) {
      logger.debug(`Retrieved client: ${clientId}`);
    } else {
      logger.debug(`Client not found: ${clientId}`);
    }

    return client;
  }

  /**
   * Sets/updates a client
   */
  async set(clientId: string, clientData: ClientData): Promise<void> {
    await this.loadClients();

    // Update timestamp
    clientData.updated_at = Date.now();

    this.cache.set(clientId, clientData);
    await this.saveClients();

    logger.debug(`Stored/updated client: ${clientId}`);
  }

  /**
   * Deletes a client
   */
  async delete(clientId: string): Promise<void> {
    await this.loadClients();

    const existed = this.cache.delete(clientId);
    if (existed) {
      await this.saveClients();
      logger.debug(`Deleted client: ${clientId}`);
    } else {
      logger.debug(`Client not found for deletion: ${clientId}`);
    }
  }

  /**
   * Creates a new client with dynamic registration
   */
  async create(registrationData: any): Promise<ClientData> {
    await this.loadClients();

    // Generate client credentials
    const clientId = `mcp_${randomUUID()}`;
    const clientSecret = randomUUID();
    const now = Date.now();

    // Create client data with defaults
    const clientData: ClientData = {
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uris: registrationData.redirect_uris || ['http://localhost:3000/callback'],
      client_name: registrationData.client_name || 'MCP Client',
      client_uri: registrationData.client_uri,
      logo_uri: registrationData.logo_uri,
      scope:
        registrationData.scope ||
        'openid email profile https://www.googleapis.com/auth/cloud-platform',
      contacts: registrationData.contacts,
      tos_uri: registrationData.tos_uri,
      policy_uri: registrationData.policy_uri,
      jwks_uri: registrationData.jwks_uri,
      jwks: registrationData.jwks,
      software_id: registrationData.software_id,
      software_version: registrationData.software_version,
      created_at: now,
      updated_at: now,
    };

    // Store the client
    this.cache.set(clientId, clientData);
    await this.saveClients();

    logger.info(`Created new client via dynamic registration: ${clientId}`);

    return clientData;
  }

  /**
   * Gets all clients (for debugging/admin purposes)
   */
  async getAll(): Promise<ClientData[]> {
    await this.loadClients();
    return Array.from(this.cache.values());
  }

  /**
   * Gets the number of registered clients
   */
  async count(): Promise<number> {
    await this.loadClients();
    return this.cache.size;
  }

  /**
   * Clears all clients (for testing purposes)
   */
  async clear(): Promise<void> {
    this.cache.clear();
    await this.saveClients();
    logger.debug('Cleared all clients from store');
  }
}
