/**
 * Compression utility service for Qdrant payload optimization
 * Handles compression/decompression of large data with configurable thresholds
 */

import { gzip, gunzip, deflate, inflate } from 'zlib';
import { promisify } from 'util';
import { CompressionConfig, DEFAULT_COMPRESSION_CONFIG } from '../types/qdrant-payload.js';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);
const deflateAsync = promisify(deflate);
const inflateAsync = promisify(inflate);

export class CompressionService {
  private config: CompressionConfig;

  constructor(config: Partial<CompressionConfig> = {}) {
    this.config = { ...DEFAULT_COMPRESSION_CONFIG, ...config };
  }

  /**
   * Compress data if it exceeds the threshold
   */
  async compressIfNeeded(data: any): Promise<{
    data: any;
    isCompressed: boolean;
    compressionType?: 'gzip' | 'deflate';
    originalSize: number;
    compressedSize?: number;
  }> {
    const serialized = typeof data === 'string' ? data : JSON.stringify(data);
    const originalSize = Buffer.byteLength(serialized, 'utf8');

    // Don't compress if below threshold
    if (originalSize < this.config.threshold) {
      return {
        data,
        isCompressed: false,
        originalSize,
      };
    }

    try {
      const buffer = Buffer.from(serialized, 'utf8');
      let compressed: Buffer;

      if (this.config.type === 'gzip') {
        compressed = await gzipAsync(buffer, { level: this.config.level });
      } else {
        compressed = await deflateAsync(buffer, { level: this.config.level });
      }

      const compressedSize = compressed.length;

      // Only use compression if it actually reduces size significantly
      if (compressedSize >= originalSize * 0.9) {
        return {
          data,
          isCompressed: false,
          originalSize,
        };
      }

      return {
        data: compressed.toString('base64'),
        isCompressed: true,
        compressionType: this.config.type,
        originalSize,
        compressedSize,
      };
    } catch (error) {
      console.warn('Compression failed, using original data:', error);
      return {
        data,
        isCompressed: false,
        originalSize,
      };
    }
  }

  /**
   * Decompress data if it was compressed
   */
  async decompressIfNeeded(
    data: any,
    isCompressed: boolean,
    compressionType?: 'gzip' | 'deflate'
  ): Promise<any> {
    if (!isCompressed || !compressionType) {
      return data;
    }

    try {
      const buffer = Buffer.from(data, 'base64');
      let decompressed: Buffer;

      if (compressionType === 'gzip') {
        decompressed = await gunzipAsync(buffer);
      } else {
        decompressed = await inflateAsync(buffer);
      }

      const decompressedString = decompressed.toString('utf8');

      // Try to parse as JSON, fall back to string
      try {
        return JSON.parse(decompressedString);
      } catch {
        return decompressedString;
      }
    } catch (error) {
      console.warn('Decompression failed, returning original data:', error);
      return data;
    }
  }

  /**
   * Get compression statistics
   */
  getCompressionRatio(originalSize: number, compressedSize?: number): number {
    if (!compressedSize) return 1.0;
    return compressedSize / originalSize;
  }

  /**
   * Format size for human reading
   */
  formatSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }
}

export const compressionService = new CompressionService();
