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
   * Parse plain text content into lines or structured data
   */
  private parseText(content: string, options: ParseOptions): any {
    const lines = content.split('\n');
    
    // First try to parse as Hive table output
    const hiveResult = this.parseHiveTableOutput(content);
    if (hiveResult && hiveResult.tables && hiveResult.tables.length > 0) {
      console.log('[DEBUG] OutputParser: Successfully parsed Hive table output');
      return hiveResult;
    }
    
    // If not a Hive table, return as lines
    if (options.skipEmpty) {
      return lines
        .map(line => options.trim ? line.trim() : line)
        .filter(line => line.length > 0);
    }
    return lines.map(line => options.trim ? line.trim() : line);
  }
  
  /**
   * Parse Hive table output format
   * Handles output in the format:
   * +----+----+
   * | col1 | col2 |
   * +----+----+
   * | val1 | val2 |
   * +----+----+
   */
  private parseHiveTableOutput(content: string): any {
    const lines = content.split('\n');
    
    // Check if this is Hive CLI output with connection info
    const isHiveCLI = lines.some(line =>
      line.includes('Connecting to jdbc:hive2://') ||
      line.includes('Connected to: Apache Hive')
    );
    
    // For Hive CLI output, we need special handling
    if (isHiveCLI) {
      return this.parseHiveOutputToCleanCSV(content);
    }
    
    // Standard Hive table output parsing
    // Find all boundary lines (lines with +---+---+ pattern)
    const boundaryLines: number[] = [];
    lines.forEach((line, index) => {
      if (line.trim().startsWith('+') && line.trim().endsWith('+') && line.includes('-')) {
        boundaryLines.push(index);
      }
    });
    
    // Find all data lines (lines between boundaries that start and end with |)
    const dataLines: {index: number, content: string}[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('|') && line.endsWith('|')) {
        dataLines.push({
          index: i,
          content: line
        });
      }
    }
    
    // If we have at least one boundary and one data line, we can parse the table
    if (boundaryLines.length < 2 || dataLines.length < 1) {
      return null;
    }
    
    // The first data line after the first boundary is the header
    const headerIndex = dataLines.find(dl => dl.index > boundaryLines[0])?.index;
    if (!headerIndex) {
      return null;
    }
    
    // Extract column names from the header
    const headerLine = lines[headerIndex];
    const columns = headerLine
      .split('|')
      .filter(col => col.trim().length > 0)
      .map(col => col.trim());
    
    // Extract data rows (all data lines after the header)
    const rows: any[] = [];
    for (const dataLine of dataLines) {
      // Skip the header
      if (dataLine.index <= headerIndex) continue;
      
      // Skip lines after the last boundary (summary lines)
      if (boundaryLines.length > 0 && dataLine.index > boundaryLines[boundaryLines.length - 1]) continue;
      
      const values = dataLine.content
        .split('|')
        .filter(val => val.trim().length > 0)
        .map(val => val.trim());
      
      if (values.length === 0) continue; // Skip empty rows
      
      // Create a row object
      const row: any = {};
      columns.forEach((col, colIdx) => {
        if (colIdx < values.length) {
          row[col] = values[colIdx];
        }
      });
      
      rows.push(row);
    }
    
    // Return a single table with all the rows
    const tables: any[] = [{
      columns,
      rows
    }];
    
    // Return the processed output
    return {
      tables,
      rawOutput: content
    };
  }
  
  /**
   * Parse Hive CLI output with connection info and repeated headers
   * This handles the specific format of Hive CLI output with:
   * - Connection info at the top (lines 1-4)
   * - Header at line 5
   * - Boundary at line 6
   * - First data row at line 7
   * - Repeated headers throughout the output
   * - Footer information
   */
  private parseHiveOutputToCleanCSV(content: string): any {
    const lines = content.split('\n');
    
    // Skip connection info at the top (lines 1-4)
    // Line 5 contains the header: |                database_name                 |
    // Line 6 contains a boundary: +----------------------------------------------+
    // Line 7 contains the first data row: | aabdulwakeel_db                              |
    
    // Extract the header from line 5
    const headerLine = lines[5].trim();
    const columns = headerLine
      .split('|')
      .filter(col => col.trim().length > 0)
      .map(col => col.trim());
    
    // Find all data lines (lines that start and end with |)
    const dataLines: {index: number, content: string}[] = [];
    for (let i = 7; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('|') && line.endsWith('|')) {
        dataLines.push({
          index: i,
          content: line
        });
      }
    }
    
    // Find all boundary lines (lines with +---+---+ pattern)
    const boundaryLines: number[] = [];
    for (let i = 6; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('+') && line.endsWith('+') && line.includes('-')) {
        boundaryLines.push(i);
      }
    }
    
    // Extract all data rows (skipping repeated headers and boundaries)
    const rows: any[] = [];
    
    for (const dataLine of dataLines) {
      const line = dataLine.content;
      
      // Extract values from the line
      const values = line
        .split('|')
        .filter(val => val.trim().length > 0)
        .map(val => val.trim());
      
      // Skip lines that match the header pattern
      if (values.length === columns.length && values.every((val, idx) => val === columns[idx])) {
        continue;
      }
      
      // Skip lines after the last boundary (summary lines)
      if (boundaryLines.length > 0 && dataLine.index > boundaryLines[boundaryLines.length - 1]) {
        continue;
      }
      
      // Skip empty rows
      if (values.length === 0) continue;
      
      // Create a row object with the column name as the key
      const row: any = {};
      columns.forEach((col, colIdx) => {
        if (colIdx < values.length) {
          row[col] = values[colIdx];
        }
      });
      
      rows.push(row);
    }
    
    // Return a single table with all the rows
    const tables: any[] = [{
      columns,
      rows
    }];
    
    // Generate CSV content
    const csvHeader = columns.join(',');
    const csvRows = rows.map(row =>
      columns.map(col => row[col] || '').join(',')
    );
    const csvContent = [csvHeader, ...csvRows].join('\n');
    
    // Return the processed output with CSV
    return {
      tables,
      csv: csvContent,
      rawOutput: content
    };
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