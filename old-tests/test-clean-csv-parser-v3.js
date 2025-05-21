// Test script to validate clean CSV parsing from Hive output - Version 3
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use the sample file from the output directory
const samplePath = path.join(__dirname, 'output/cf8979ea-fbc3-43ad-8925-13a4f80ea9d8/driveroutput.000000000');

/**
 * Enhanced Hive output parser that creates clean CSV data
 */
function parseHiveOutputToCleanCSV(content) {
  const lines = content.split('\n');
  
  console.log(`Total lines in file: ${lines.length}`);
  
  // Skip connection info at the top (lines 1-4)
  // Line 5 contains the header: |                database_name                 |
  // Line 6 contains a boundary: +----------------------------------------------+
  // Line 7 contains the first data row: | aabdulwakeel_db                              |
  
  // Extract the header from line 5
  const headerLine = lines[5].trim();
  console.log(`Header line: ${headerLine}`);
  
  const columns = headerLine
    .split('|')
    .filter(col => col.trim().length > 0)
    .map(col => col.trim());
  
  console.log(`Found ${columns.length} columns: ${columns.join(', ')}`);
  
  // Find all data lines (lines that start and end with |)
  const dataLines = [];
  for (let i = 7; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('|') && line.endsWith('|')) {
      dataLines.push({
        index: i,
        content: line
      });
    }
  }
  
  console.log(`Found ${dataLines.length} data lines`);
  
  // Find all boundary lines (lines with +---+---+ pattern)
  const boundaryLines = [];
  for (let i = 6; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('+') && line.endsWith('+') && line.includes('-')) {
      boundaryLines.push(i);
    }
  }
  
  console.log(`Found ${boundaryLines.length} boundary lines`);
  
  // Extract all data rows (skipping repeated headers and boundaries)
  const rows = [];
  
  for (const dataLine of dataLines) {
    const line = dataLine.content;
    
    // Extract values from the line
    const values = line
      .split('|')
      .filter(val => val.trim().length > 0)
      .map(val => val.trim());
    
    // Skip lines that match the header pattern
    if (values.length === columns.length && values.every((val, idx) => val === columns[idx])) {
      console.log(`Skipping repeated header at line ${dataLine.index}`);
      continue;
    }
    
    // Skip lines after the last boundary (summary lines)
    if (boundaryLines.length > 0 && dataLine.index > boundaryLines[boundaryLines.length - 1]) {
      console.log(`Skipping summary line after last boundary: ${dataLine.index}`);
      continue;
    }
    
    // Skip empty rows
    if (values.length === 0) continue;
    
    // Create a row object with the column name as the key
    const row = {};
    columns.forEach((col, colIdx) => {
      if (colIdx < values.length) {
        row[col] = values[colIdx];
      }
    });
    
    rows.push(row);
  }
  
  console.log(`Extracted ${rows.length} data rows`);
  
  // Convert to CSV
  const csvHeader = columns.join(',');
  const csvRows = rows.map(row => 
    columns.map(col => row[col] || '').join(',')
  );
  
  const csvContent = [csvHeader, ...csvRows].join('\n');
  
  // Return both structured data and CSV
  return {
    tables: [{
      columns,
      rows
    }],
    csv: csvContent,
    rawOutput: content
  };
}

async function run() {
  try {
    console.log(`Reading sample file: ${samplePath}`);
    
    // Read the file
    const content = await fs.readFile(samplePath, 'utf8');
    console.log(`File content length: ${content.length} bytes`);
    
    // Parse the content
    console.log('\nParsing content as Hive table output with clean CSV conversion...');
    const result = parseHiveOutputToCleanCSV(content);
    
    if (result) {
      console.log('\n✅ SUCCESS: Parsed output successfully');
      console.log(`Found ${result.tables[0].columns.length} columns and ${result.tables[0].rows.length} rows`);
      
      // Show sample of CSV output
      const csvLines = result.csv.split('\n');
      console.log('\nCSV Header:');
      console.log(csvLines[0]);
      console.log('\nFirst 5 CSV data rows:');
      for (let i = 1; i < Math.min(6, csvLines.length); i++) {
        console.log(csvLines[i]);
      }
      
      // Write CSV to file for inspection
      const csvPath = path.join(__dirname, 'clean-output-v3.csv');
      await fs.writeFile(csvPath, result.csv);
      console.log(`\nWrote clean CSV to: ${csvPath}`);
    } else {
      console.log('\n❌ FAILED: Could not parse output');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

run().catch(error => console.error('Error in run():', error));