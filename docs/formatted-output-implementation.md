# Formatted Output Implementation for Dataproc Job Results

## Overview

This document describes the implementation of pretty formatting for Dataproc job results. The goal was to format the structured output in a clean, readable way using a library that can handle data tables.

## Implementation Details

### 1. Library Selection

We selected the `table` library for formatting data tables in Node.js. This library provides:
- Clean ASCII table formatting
- Customizable borders and styling
- Support for multi-line content
- Good performance with large datasets

### 2. Changes Made

#### 2.1 Added Table Formatting Function

Added a new `formatTablesOutput` method to the `OutputParser` class that:
- Takes an array of table objects (with columns and rows)
- Formats each table into a clean ASCII table
- Handles multiple tables if present
- Returns a formatted string representation

```javascript
/**
 * Format tables data into a clean, readable ASCII table
 * @param tables Array of table objects with columns and rows
 * @returns Formatted string representation of the tables
 */
formatTablesOutput(tables: any[]): string {
  if (!tables || tables.length === 0) {
    return 'No table data available';
  }

  const formattedTables: string[] = [];

  for (let i = 0; i < tables.length; i++) {
    const tableData = tables[i];
    const { columns, rows } = tableData;
    
    if (!columns || !rows || rows.length === 0) {
      formattedTables.push(`Table ${i + 1}: No data`);
      continue;
    }

    // Create header row
    const tableRows: string[][] = [columns];
    
    // Add data rows
    for (const row of rows) {
      const rowData: string[] = columns.map((col: string) => {
        const value = row[col];
        return value !== undefined && value !== null ? String(value) : '';
      });
      tableRows.push(rowData);
    }

    // Configure table options for clean formatting
    const tableConfig: any = {
      border: getBorderCharacters('norc'),
      columnDefault: {
        paddingLeft: 1,
        paddingRight: 1
      },
      drawHorizontalLine: (index: number, size: number) => {
        return index === 0 || index === 1 || index === size;
      }
    };

    // Generate the table
    const formattedTable = table(tableRows, tableConfig);
    
    // Add table number if there are multiple tables
    const tableHeader = tables.length > 1 ? `Table ${i + 1}:\n` : '';
    formattedTables.push(`${tableHeader}${formattedTable}`);
  }

  return formattedTables.join('\n\n');
}
```

#### 2.2 Updated Output Structure

Modified the output structure to include the formatted output:

```javascript
return {
  tables: [...],           // Original structured data
  formattedOutput: "..."   // New formatted ASCII table
}
```

#### 2.3 Integration with Job Results

Updated the job result handling to generate formatted output for all parsed results, ensuring that:
- Local file parsing includes formatted output
- GCS file parsing includes formatted output
- Multiple file handling preserves formatted output

The integration occurs in three key places within the `getDataprocJobResults` function:

1. When processing output directly from `driverOutputResourceUri`:
```javascript
if (parsedOutput && typeof parsedOutput === 'object' && !('formattedOutput' in parsedOutput)) {
  // If not, try to format it using the OutputParser
  try {
    const outputParser = new OutputParser();
    const typedOutput = parsedOutput as any;
    if (typedOutput.tables) {
      typedOutput.formattedOutput = outputParser.formatTablesOutput(typedOutput.tables);
    }
  } catch (formatError) {
    console.error('Error formatting output:', formatError);
  }
}
```

2. When processing local cached files
3. When processing files from the `driverControlFilesUri` directory

### 3. Table Formatting Configuration

The table formatting uses specific configuration options for clean presentation:

- Border style: Uses the 'norc' border character set for a clean, minimal look
- Column padding: Adds 1 space of padding on both sides of column content
- Horizontal lines: Draws horizontal lines only at the top, after the header, and at the bottom
- Multi-table support: Adds table numbers when multiple tables are present

### 4. Error Handling

The implementation includes robust error handling:
- Gracefully handles missing or empty tables
- Provides fallback messages when no data is available
- Catches and logs formatting errors without disrupting the main flow
- Preserves original data even if formatting fails

## Example Output

### Before (Raw Data)

```json
{
  "tables": [
    {
      "columns": ["column1", "column2"],
      "rows": [
        { "column1": "test", "column2": 123 }
      ]
    }
  ]
}
```

### After (With Formatted Output)

```json
{
  "tables": [
    {
      "columns": ["column1", "column2"],
      "rows": [
        { "column1": "test", "column2": 123 }
      ]
    }
  ],
  "formattedOutput": "┌─────────┬─────────┐\n│ column1 │ column2 │\n├─────────┼─────────┤\n│ test    │ 123     │\n└─────────┴─────────┘"
}
```

When displayed in the console:

```
┌─────────┬─────────┐
│ column1 │ column2 │
├─────────┼─────────┤
│ test    │ 123     │
└─────────┴─────────┘
```

## Testing

Created a test file (`test-formatted-output.js`) to verify the implementation. The test:
1. Fetches job results for a specific job ID
2. Verifies that the parsed output contains the formatted output
3. Displays the formatted output to the console

The test validates that:
- The formatted output is correctly generated
- The structure matches the expected format
- The original data is preserved alongside the formatted output

## Benefits

The formatted output provides several benefits:
- Improved readability for users viewing job results
- Clear structure with column headers and row data
- Consistent formatting regardless of data source
- Maintained all existing functionality while adding new features
- No performance impact for clients that don't use the formatted output

## Usage

To access the formatted output in your code:

```javascript
const results = await getDataprocJobResults({
  projectId: 'your-project',
  region: 'us-central1',
  jobId: 'job-id',
  format: 'text',
  wait: true
});

if (results.parsedOutput && results.parsedOutput.formattedOutput) {
  console.log('Formatted Table Output:');
  console.log(results.parsedOutput.formattedOutput);
}
```

## Configuration Options

The table formatting can be customized by modifying the `tableConfig` object in the `formatTablesOutput` method:

- **Border style**: Change the `border` property to use different border character sets
  - Available options: 'honeywell', 'norc', 'ramac', 'void'
  - Example: `border: getBorderCharacters('honeywell')`

- **Column padding**: Adjust the `paddingLeft` and `paddingRight` values
  - Example: `paddingLeft: 2, paddingRight: 2` for more spacing

- **Horizontal lines**: Modify the `drawHorizontalLine` function to control where lines appear
  - Example: `drawHorizontalLine: () => true` to draw lines between all rows

## Future Improvements

Potential future improvements could include:
- Color coding for different data types
- Pagination for very large result sets
- Export options for different formats (HTML, Markdown)
- Custom formatting options for specific data types
- User-configurable table styles
- Automatic column width adjustment based on content
- Support for nested data structures