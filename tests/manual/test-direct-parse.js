// Direct test script to parse Hive output without importing modules
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const jobId = '65c60e00-7549-44e4-82d8-0fbab0a9ceba';
const localPath = path.join(__dirname, 'outputthere', jobId, 'driveroutput.000000000');

// Simple function to parse Hive table output
function parseHiveTableOutput(content) {
  const lines = content.split('\n');
  
  // Find the main table in the Hive output
  // We're looking for the pattern:
  // +----+
  // | header |
  // +----+
  // | data |
  // +----+
  
  // First, find all lines that look like table boundaries
  const boundaryLines = [];
  lines.forEach((line, index) => {
    if (line.trim().startsWith('+') && line.trim().endsWith('+') && line.includes('-')) {
      boundaryLines.push(index);
    }
  });
  
  console.log(`Found ${boundaryLines.length} boundary lines`);
  
  // Now find all data lines (lines between boundaries that start and end with |)
  const dataLines = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('|') && line.endsWith('|')) {
      dataLines.push({
        index: i,
        content: line
      });
    }
  }
  
  console.log(`Found ${dataLines.length} data lines`);
  
  // If we have at least one boundary and one data line, we can parse the table
  if (boundaryLines.length < 2 || dataLines.length < 1) {
    console.log('Not enough boundary or data lines to form a table');
    return null;
  }
  
  // The first data line after the first boundary is the header
  const headerIndex = dataLines.find(dl => dl.index > boundaryLines[0])?.index;
  if (!headerIndex) {
    console.log('Could not find header line');
    return null;
  }
  
  // Extract column names from the header
  const headerLine = lines[headerIndex];
  const columns = headerLine
    .split('|')
    .filter(col => col.trim().length > 0)
    .map(col => col.trim());
  
  console.log(`Found ${columns.length} columns: ${columns.join(', ')}`);
  
  // Extract data rows (all data lines after the header)
  const rows = [];
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
    const row = {};
    columns.forEach((col, colIdx) => {
      if (colIdx < values.length) {
        row[col] = values[colIdx];
      }
    });
    
    rows.push(row);
  }
  
  console.log(`Extracted ${rows.length} rows`);
  
  // Return the processed output
  return {
    tables: [{
      columns,
      rows
    }],
    rawOutput: content
  };
}

// Main function
async function run() {
  try {
    console.log(`Reading local file: ${localPath}`);
    
    // Read the file
    const content = await fs.promises.readFile(localPath, 'utf8');
    console.log(`File content length: ${content.length} bytes`);
    
    // Parse the content
    console.log('Parsing content as Hive table output...');
    const parsedOutput = parseHiveTableOutput(content);
    
    console.log('\nParsed output structure:');
    console.log(JSON.stringify({
      hasTables: !!parsedOutput?.tables,
      tableCount: parsedOutput?.tables?.length || 0,
      firstTableColumns: parsedOutput?.tables?.[0]?.columns || [],
      firstTableRowCount: parsedOutput?.tables?.[0]?.rows?.length || 0
    }, null, 2));
    
    if (parsedOutput && parsedOutput.tables && parsedOutput.tables.length > 0) {
      console.log(`\n✅ SUCCESS: Found ${parsedOutput.tables.length} tables in the output`);
      
      // Show table structure
      const firstTable = parsedOutput.tables[0];
      console.log(`\nFirst table columns: ${firstTable.columns.join(', ')}`);
      console.log(`First table row count: ${firstTable.rows.length}`);
      
      if (firstTable.rows.length > 0) {
        console.log('Sample row:', firstTable.rows[0]);
      }
    } else {
      console.log('\n❌ FAILED: Output was not parsed as a table structure');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

run().catch(error => console.error('Error in run():', error));