/**
 * Output parser for Dataproc job results
 */

import { OutputFormat } from '../types/gcs-types.js';

export class ParseError extends Error {
  constructor(
    message: string,
    public format: OutputFormat,
    public cause?: Error
  ) {
    super(message);
    this.name = 'ParseError';
  }
}

export interface ParseOptions {
  /**
   * Whether to trim whitespace from values
   */
  trim?: boolean;

  /**
   * Custom delimiter for CSV parsing
   */
  delimiter?: string;

  /**
   * Whether to parse numbers in JSON/CSV
   */
  parseNumbers?: boolean;

  /**
   * Whether to skip empty lines
   */
  skipEmpty?: boolean;
}

export type ParsedValue = string | number | null;

export const DEFAULT_PARSE_OPTIONS: ParseOptions = {
  trim: true,
  delimiter: ',',
  parseNumbers: true,
  skipEmpty: true,
};

export class OutputParser {
  /**
   * Parse output content based on format
   */
  async parse(content: Buffer | string, format: OutputFormat, options: ParseOptions = {}): Promise<any> {
    const opts = { ...DEFAULT_PARSE_OPTIONS, ...options };

    try {
      const textContent = Buffer.isBuffer(content) ? content.toString('utf-8') : content;

      switch (format) {
        case 'json':
          return this.parseJSON(textContent, opts);
        case 'csv':
          return this.parseCSV(textContent, opts);
        case 'text':
          return this.parseText(textContent, opts);
        default:
          throw new ParseError(`Unsupported format: ${format}`, format);
      }
    } catch (error) {
      if (error instanceof ParseError) {
        throw error;
      }
      const err = error as Error;
      throw new ParseError(
        `Failed to parse ${format} content: ${err.message}`,
        format,
        err
      );
    }
  }

  /**
   * Parse JSON content
   */
  private parseJSON(content: string, options: ParseOptions): any {
    const text = options.trim ? content.trim() : content;
    if (!text) {
      return null;
    }

    const data = JSON.parse(text);

    if (options.parseNumbers && typeof data === 'object') {
      return this.parseNumbersInObject(data);
    }

    return data;
  }

  /**
   * Parse CSV content into array of objects
   */
  private parseCSV(content: string, options: ParseOptions): Record<string, ParsedValue>[] {
    const lines = content.split('\n');
    if (lines.length === 0) {
      return [];
    }

    // Parse header row
    const headers = this.parseCSVLine(lines[0], options);
    const results: Record<string, ParsedValue>[] = [];

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const line = options.trim ? lines[i].trim() : lines[i];
      
      if (!line && options.skipEmpty) {
        continue;
      }

      const values = this.parseCSVLine(line, options);
      const row: Record<string, ParsedValue> = {};

      for (let j = 0; j < headers.length; j++) {
        const rawValue = values[j];
        let value: ParsedValue = rawValue;

        if (options.parseNumbers && rawValue !== '') {
          const num = parseFloat(rawValue);
          if (!isNaN(num) && num.toString() === rawValue) {
            value = num;
          }
        }

        row[headers[j]] = value;
      }

      results.push(row);
    }

    return results;
  }

  /**
   * Parse a single CSV line into array of values
   */
  private parseCSVLine(line: string, options: ParseOptions): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === options.delimiter! && !inQuotes) {
        values.push(options.trim ? current.trim() : current);
        current = '';
      } else {
        current += char;
      }
    }
    
    values.push(options.trim ? current.trim() : current);
    return values;
  }

  /**
   * Parse plain text content into lines
   */
  private parseText(content: string, options: ParseOptions): string[] {
    const lines = content.split('\n');
    if (options.skipEmpty) {
      return lines
        .map(line => options.trim ? line.trim() : line)
        .filter(line => line.length > 0);
    }
    return lines.map(line => options.trim ? line.trim() : line);
  }

  /**
   * Recursively parse numbers in object
   */
  private parseNumbersInObject(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map(item => this.parseNumbersInObject(item));
    }
    
    if (obj && typeof obj === 'object') {
      const result: Record<string, any> = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.parseNumbersInObject(value);
      }
      return result;
    }
    
    if (typeof obj === 'string') {
      const num = parseFloat(obj);
      if (!isNaN(num) && num.toString() === obj) {
        return num;
      }
    }
    
    return obj;
  }
}