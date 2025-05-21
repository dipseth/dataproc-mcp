# Formatted Output User Guide

## Overview

This guide explains how to use and interpret the formatted output feature for Dataproc job results. The formatted output feature provides a clean, readable ASCII table representation of tabular data returned from Dataproc jobs.

## Understanding Formatted Output

### What is Formatted Output?

Formatted output is a human-readable representation of tabular data that makes it easier to interpret job results. Instead of parsing through raw JSON or CSV data, you can view the data in a structured table format with clear column headers and aligned data.

### Example

**Raw Data (JSON):**
```json
{
  "tables": [
    {
      "columns": ["database_name", "table_name", "row_count"],
      "rows": [
        { "database_name": "analytics", "table_name": "users", "row_count": 1250 },
        { "database_name": "analytics", "table_name": "events", "row_count": 15720 }
      ]
    }
  ]
}
```

**Formatted Output:**
```
┌──────────────┬────────────┬───────────┐
│ database_name │ table_name │ row_count │
├──────────────┼────────────┼───────────┤
│ analytics    │ users      │ 1250      │
│ analytics    │ events     │ 15720     │
└──────────────┴────────────┴───────────┘
```

## Accessing Formatted Output

### In API Responses

When you retrieve job results using the `getDataprocJobResults` function, the formatted output is included in the response:

```javascript
const results = await getDataprocJobResults({
  projectId: 'your-project',
  region: 'us-central1',
  jobId: 'job-id',
  format: 'text',
  wait: true
});

// The formatted output is available in:
const formattedOutput = results.parsedOutput.formattedOutput;
```

### Displaying in Console

To display the formatted output in the console:

```javascript
if (results.parsedOutput && results.parsedOutput.formattedOutput) {
  console.log('Formatted Table Output:');
  console.log(results.parsedOutput.formattedOutput);
}
```

### Saving to File

To save the formatted output to a file:

```javascript
import fs from 'fs/promises';

if (results.parsedOutput && results.parsedOutput.formattedOutput) {
  await fs.writeFile('query-results.txt', results.parsedOutput.formattedOutput);
  console.log('Results saved to query-results.txt');
}
```

## Interpreting Formatted Output

### Table Structure

The formatted output follows a standard table structure:

1. **Header Row**: The first row contains column names
2. **Separator Line**: A line with dashes separates the header from data rows
3. **Data Rows**: Each subsequent row contains the data values
4. **Borders**: The table is enclosed in borders for clarity

### Multiple Tables

If the job results contain multiple tables, each table is formatted separately with a header indicating the table number:

```
Table 1:
┌──────────────┬────────────┬───────────┐
│ database_name │ table_name │ row_count │
├──────────────┼────────────┼───────────┤
│ analytics    │ users      │ 1250      │
└──────────────┴────────────┴───────────┘

Table 2:
┌──────────────┬────────────┬────────────┐
│ database_name │ table_name │ last_update │
├──────────────┼────────────┼────────────┤
│ analytics    │ users      │ 2025-05-15 │
└──────────────┴────────────┴────────────┘
```

### Empty or Missing Data

- Empty cells are displayed as blank spaces
- If a table has no data, it will display "Table X: No data"
- If no tables are available, it will display "No table data available"

## Customizing Output Format

While the formatted output uses default settings optimized for readability, you can customize the formatting by modifying the `formatTablesOutput` method in the `OutputParser` class.

### Available Customization Options

1. **Border Style**:
   - Change the `border` property to use different border character sets
   - Available options: 'honeywell', 'norc', 'ramac', 'void'
   - Example: `border: getBorderCharacters('honeywell')`

2. **Column Padding**:
   - Adjust the `paddingLeft` and `paddingRight` values
   - Example: `paddingLeft: 2, paddingRight: 2` for more spacing

3. **Horizontal Lines**:
   - Modify the `drawHorizontalLine` function to control where lines appear
   - Example: `drawHorizontalLine: () => true` to draw lines between all rows

### Example Customization

To customize the table formatting, you would need to modify the `formatTablesOutput` method in `src/services/output-parser.ts`:

```typescript
formatTablesOutput(tables: any[]): string {
  // ... existing code ...
  
  // Custom table configuration
  const tableConfig: any = {
    border: getBorderCharacters('honeywell'), // Change border style
    columnDefault: {
      paddingLeft: 2,                        // Increase left padding
      paddingRight: 2                        // Increase right padding
    },
    drawHorizontalLine: (index: number, size: number) => {
      return true;                           // Draw lines between all rows
    }
  };
  
  // ... rest of the method ...
}
```

## Best Practices

### Working with Formatted Output

1. **Always check for existence**:
   ```javascript
   if (results.parsedOutput && results.parsedOutput.formattedOutput) {
     // Use formatted output
   }
   ```

2. **Preserve original data**:
   - Use the formatted output for display purposes
   - Use the structured data in `tables` for programmatic processing
   - Example:
     ```javascript
     // For display
     console.log(results.parsedOutput.formattedOutput);
     
     // For data processing
     const tables = results.parsedOutput.tables;
     const rowCount = tables[0].rows.length;
     ```

3. **Handle large outputs**:
   - For very large tables, consider implementing pagination in your UI
   - For programmatic processing of large datasets, work with the structured data directly

4. **Combine with other output formats**:
   - Use formatted output for human readers
   - Use CSV for spreadsheet applications
   - Use JSON for API responses
   - Example:
     ```javascript
     // Provide multiple formats
     return {
       formatted: results.parsedOutput.formattedOutput,
       csv: convertToCSV(results.parsedOutput.tables),
       json: JSON.stringify(results.parsedOutput.tables)
     };
     ```

### Performance Considerations

1. **Memory usage**:
   - Formatted output requires additional memory to store the formatted string
   - For very large datasets, consider formatting only when needed

2. **Processing time**:
   - Formatting large tables may take additional processing time
   - The impact is usually minimal for typical result sets

## Troubleshooting

### Common Issues

1. **Missing formatted output**:
   - Ensure the job produced tabular data
   - Check that the `parsedOutput` object exists and contains `tables`
   - Verify that the `tables` array is not empty

2. **Misaligned columns**:
   - This can happen with very wide columns or Unicode characters
   - Consider customizing the table configuration for better alignment

3. **Truncated output**:
   - Very large tables might be truncated in some console environments
   - Consider saving to file or implementing pagination

### Debugging

If you encounter issues with formatted output:

1. Check the raw structure of the parsed output:
   ```javascript
   console.log(JSON.stringify(results.parsedOutput, null, 2));
   ```

2. Verify the table structure:
   ```javascript
   if (results.parsedOutput && results.parsedOutput.tables) {
     console.log('Table columns:', results.parsedOutput.tables[0].columns);
     console.log('Row count:', results.parsedOutput.tables[0].rows.length);
   }
   ```

3. Check for formatting errors in the logs:
   - Look for error messages related to formatting in the console output

## Examples

### Basic Usage Example

```javascript
import { getDataprocJobResults } from './services/job.js';

async function displayQueryResults() {
  try {
    const results = await getDataprocJobResults({
      projectId: 'your-project',
      region: 'us-central1',
      jobId: 'job-id',
      format: 'text',
      wait: true
    });
    
    if (results.parsedOutput && results.parsedOutput.formattedOutput) {
      console.log('Query Results:');
      console.log(results.parsedOutput.formattedOutput);
    } else {
      console.log('No formatted results available');
      console.log('Raw results:', results);
    }
  } catch (error) {
    console.error('Error fetching results:', error);
  }
}

displayQueryResults();
```

### Advanced Example with Multiple Output Formats

```javascript
import { getDataprocJobResults } from './services/job.js';
import fs from 'fs/promises';

async function exportQueryResults(jobId, formats = ['formatted', 'csv', 'json']) {
  try {
    const results = await getDataprocJobResults({
      projectId: 'your-project',
      region: 'us-central1',
      jobId,
      format: 'text',
      wait: true
    });
    
    if (!results.parsedOutput || !results.parsedOutput.tables) {
      console.log('No results available');
      return;
    }
    
    // Create output directory
    await fs.mkdir('query-results', { recursive: true });
    
    // Export in requested formats
    if (formats.includes('formatted') && results.parsedOutput.formattedOutput) {
      await fs.writeFile(`query-results/${jobId}.txt`, results.parsedOutput.formattedOutput);
      console.log(`Formatted output saved to query-results/${jobId}.txt`);
    }
    
    if (formats.includes('json')) {
      await fs.writeFile(
        `query-results/${jobId}.json`, 
        JSON.stringify(results.parsedOutput.tables, null, 2)
      );
      console.log(`JSON output saved to query-results/${jobId}.json`);
    }
    
    if (formats.includes('csv')) {
      const csvContent = convertToCSV(results.parsedOutput.tables[0]);
      await fs.writeFile(`query-results/${jobId}.csv`, csvContent);
      console.log(`CSV output saved to query-results/${jobId}.csv`);
    }
  } catch (error) {
    console.error('Error exporting results:', error);
  }
}

// Helper function to convert table to CSV
function convertToCSV(table) {
  if (!table || !table.columns || !table.rows) return '';
  
  const header = table.columns.join(',');
  const rows = table.rows.map(row => 
    table.columns.map(col => row[col] || '').join(',')
  );
  
  return [header, ...rows].join('\n');
}

// Example usage
exportQueryResults('job-id', ['formatted', 'csv']);
```

## Conclusion

The formatted output feature provides a significant improvement in the readability of Dataproc job results. By following the guidelines in this document, you can effectively use and customize the formatted output to meet your specific needs.

For more detailed information about the implementation, refer to the [Formatted Output Implementation](./formatted-output-implementation.md) document.