/**
 * Chunked Response utilities for HTTP streaming
 * Provides utilities for streaming large responses in chunks
 */

import { Response } from 'express';
import { logger } from '../../utils/logger.js';

/**
 * Configuration for chunked streaming
 */
export interface ChunkedStreamConfig {
  chunkSize?: number;
  delay?: number;
  contentType?: string;
  enableCompression?: boolean;
}

/**
 * Chunk data for streaming
 */
export interface StreamChunk {
  data: any;
  index: number;
  total: number;
  isLast: boolean;
  metadata?: Record<string, any>;
}

/**
 * Utility class for handling chunked responses
 */
export class ChunkedResponseHandler {
  private config: Required<ChunkedStreamConfig>;

  constructor(config: ChunkedStreamConfig = {}) {
    this.config = {
      chunkSize: 1024 * 10, // 10KB default chunk size
      delay: 0, // No delay by default
      contentType: 'application/json',
      enableCompression: false,
      ...config,
    };
  }

  /**
   * Stream data in chunks to the response
   */
  async streamData(
    res: Response,
    data: any,
    onProgress?: (chunk: StreamChunk) => void
  ): Promise<void> {
    try {
      // Set appropriate headers for chunked transfer
      res.setHeader('Transfer-Encoding', 'chunked');
      res.setHeader('Content-Type', this.config.contentType);
      res.setHeader('Cache-Control', 'no-cache');
      
      if (this.config.enableCompression) {
        res.setHeader('Content-Encoding', 'gzip');
      }

      // Convert data to string if needed
      const dataString = typeof data === 'string' ? data : JSON.stringify(data);
      const totalSize = Buffer.byteLength(dataString, 'utf8');
      const chunks = this.createChunks(dataString);

      logger.debug(`Streaming ${chunks.length} chunks (${totalSize} bytes total)`);

      // Stream each chunk
      for (let i = 0; i < chunks.length; i++) {
        const chunk: StreamChunk = {
          data: chunks[i],
          index: i,
          total: chunks.length,
          isLast: i === chunks.length - 1,
          metadata: {
            size: Buffer.byteLength(chunks[i], 'utf8'),
            totalSize,
          },
        };

        // Call progress callback if provided
        if (onProgress) {
          onProgress(chunk);
        }

        // Write chunk to response
        res.write(chunk.data);

        // Add delay if configured
        if (this.config.delay > 0 && !chunk.isLast) {
          await this.delay(this.config.delay);
        }
      }

      // End the response
      res.end();
      logger.debug('Chunked streaming completed');

    } catch (error) {
      logger.error('Error during chunked streaming:', error);
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Streaming failed',
          message: error instanceof Error ? error.message : String(error),
        });
      }
      throw error;
    }
  }

  /**
   * Stream JSON data with proper formatting
   */
  async streamJSON(
    res: Response,
    data: any,
    onProgress?: (chunk: StreamChunk) => void
  ): Promise<void> {
    const jsonString = JSON.stringify(data, null, 2);
    await this.streamData(res, jsonString, onProgress);
  }

  /**
   * Stream array data item by item
   */
  async streamArray(
    res: Response,
    array: any[],
    onProgress?: (item: any, index: number, total: number) => void
  ): Promise<void> {
    try {
      res.setHeader('Transfer-Encoding', 'chunked');
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-cache');

      // Start JSON array
      res.write('[');

      for (let i = 0; i < array.length; i++) {
        const item = array[i];
        const isLast = i === array.length - 1;

        // Call progress callback if provided
        if (onProgress) {
          onProgress(item, i, array.length);
        }

        // Write item
        const itemJson = JSON.stringify(item);
        res.write(itemJson);

        // Add comma if not last item
        if (!isLast) {
          res.write(',');
        }

        // Add delay if configured
        if (this.config.delay > 0 && !isLast) {
          await this.delay(this.config.delay);
        }
      }

      // End JSON array
      res.write(']');
      res.end();

      logger.debug(`Streamed array with ${array.length} items`);

    } catch (error) {
      logger.error('Error during array streaming:', error);
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Array streaming failed',
          message: error instanceof Error ? error.message : String(error),
        });
      }
      throw error;
    }
  }

  /**
   * Create chunks from data string
   */
  private createChunks(data: string): string[] {
    const chunks: string[] = [];
    const chunkSize = this.config.chunkSize;

    for (let i = 0; i < data.length; i += chunkSize) {
      chunks.push(data.slice(i, i + chunkSize));
    }

    return chunks;
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current configuration
   */
  getConfig(): Required<ChunkedStreamConfig> {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ChunkedStreamConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

/**
 * Create a new chunked response handler with default config
 */
export function createChunkedHandler(config?: ChunkedStreamConfig): ChunkedResponseHandler {
  return new ChunkedResponseHandler(config);
}

/**
 * Utility function to stream large JSON responses
 */
export async function streamLargeJSON(
  res: Response,
  data: any,
  config?: ChunkedStreamConfig
): Promise<void> {
  const handler = createChunkedHandler(config);
  await handler.streamJSON(res, data);
}

/**
 * Utility function to stream arrays
 */
export async function streamArray(
  res: Response,
  array: any[],
  config?: ChunkedStreamConfig,
  onProgress?: (item: any, index: number, total: number) => void
): Promise<void> {
  const handler = createChunkedHandler(config);
  await handler.streamArray(res, array, onProgress);
}