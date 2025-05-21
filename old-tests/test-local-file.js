// Test script to directly parse the local output file
import fs from 'fs/promises';
import { OutputParser } from './src/services/output-parser.js';

const jobId = '65c60e00-7549-44e4-82d8-0fbab0a9ceba';
const localPath = `./outputthere/${jobId}/driveroutput.000000000`;

async function run() {
  try {
    console.log(`Reading local file: ${localPath}`);
    
    // Read the file
    const content = await fs.readFile(localPath, 'utf8');
    console.log(`File content length: ${content.length} bytes`);
    
    // Create a parser
    const outputParser = new OutputParser();
    
    // Parse the content
    console.log('Parsing content as Hive table output...');
    const parsedOutput = await outputParser.parse(
      content,
      'text',
      {
        trim: true,
        skipEmpty: true
      }
    );
    
    console.log('\nParsed output:');
    console.log(JSON.stringify(parsedOutput, null, 2));
    
    if (parsedOutput && typeof parsedOutput === 'object' && parsedOutput.tables) {
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

run();