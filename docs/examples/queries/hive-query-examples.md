# Hive Query Examples for Dataproc MCP Server

This file contains example Hive queries that can be executed on a Dataproc cluster using the `submit_hive_query` tool.

## Basic Queries

### Create a Table

```sql
CREATE TABLE IF NOT EXISTS example_table (
  id INT,
  name STRING,
  value DOUBLE,
  created_date DATE
)
ROW FORMAT DELIMITED
FIELDS TERMINATED BY ','
STORED AS TEXTFILE;
```

### Load Data from GCS

```sql
LOAD DATA INPATH 'gs://your-bucket/path/to/data.csv' 
OVERWRITE INTO TABLE example_table;
```

### Simple SELECT Query

```sql
SELECT * FROM example_table LIMIT 10;
```

### Aggregation Query

```sql
SELECT 
  created_date,
  COUNT(*) as count,
  AVG(value) as avg_value,
  MAX(value) as max_value
FROM example_table
GROUP BY created_date
ORDER BY created_date DESC;
```

## Advanced Queries

### Create a Partitioned Table

```sql
CREATE TABLE IF NOT EXISTS partitioned_table (
  id INT,
  name STRING,
  value DOUBLE
)
PARTITIONED BY (dt DATE)
STORED AS PARQUET;
```

### Insert Data with Partition

```sql
INSERT INTO partitioned_table PARTITION (dt='2023-01-01')
SELECT id, name, value FROM example_table
WHERE created_date = '2023-01-01';
```

### Join Example

```sql
SELECT 
  a.id,
  a.name,
  b.additional_info
FROM example_table a
JOIN another_table b ON a.id = b.id
WHERE a.value > 100;
```

### Window Functions

```sql
SELECT 
  id,
  name,
  value,
  created_date,
  RANK() OVER (PARTITION BY created_date ORDER BY value DESC) as rank
FROM example_table;
```

## Using the MCP Server

### Synchronous Query Execution

To execute a query and wait for results:

```json
{
  "projectId": "your-project-id",
  "region": "us-central1",
  "clusterName": "your-cluster-name",
  "query": "SELECT * FROM example_table LIMIT 10;",
  "async": false
}
```

### Asynchronous Query Execution

To submit a query and get a job ID for later status checking:

```json
{
  "projectId": "your-project-id",
  "region": "us-central1",
  "clusterName": "your-cluster-name",
  "query": "SELECT * FROM example_table LIMIT 10;",
  "async": true
}
```

### Query with Custom Properties

To set Hive properties for the query:

```json
{
  "projectId": "your-project-id",
  "region": "us-central1",
  "clusterName": "your-cluster-name",
  "query": "SELECT * FROM example_table LIMIT 10;",
  "queryOptions": {
    "properties": {
      "hive.exec.dynamic.partition.mode": "nonstrict",
      "hive.exec.max.dynamic.partitions": "1000"
    },
    "timeoutMs": 300000
  }
}
```

## PySpark Job Examples with Local File Staging

The MCP server supports automatic local file staging for PySpark jobs, allowing you to reference local Python files using template syntax. Files are automatically uploaded to GCS and the job configuration is transformed to use the staged files.

### Basic PySpark Job with Local File

```json
{
  "tool": "submit_dataproc_job",
  "arguments": {
    "clusterName": "pyspark-cluster",
    "jobType": "pyspark",
    "jobConfig": {
      "mainPythonFileUri": "{@./test-spark-job.py}",
      "args": ["--mode", "test"]
    }
  }
}
```

### PySpark Job with Multiple Local Files

```json
{
  "tool": "submit_dataproc_job",
  "arguments": {
    "clusterName": "analytics-cluster",
    "jobType": "pyspark",
    "jobConfig": {
      "mainPythonFileUri": "{@./scripts/data_processor.py}",
      "pythonFileUris": [
        "{@./utils/data_utils.py}",
        "{@./utils/spark_helpers.py}",
        "{@/absolute/path/to/shared_library.py}"
      ],
      "args": ["--input", "gs://data-bucket/raw/", "--output", "gs://data-bucket/processed/"],
      "properties": {
        "spark.sql.adaptive.enabled": "true",
        "spark.executor.memory": "4g"
      }
    }
  }
}
```

### Local File Staging Features

- **Template Syntax**: Use `{@./relative/path}` or `{@/absolute/path}` to reference local files
- **Automatic Upload**: Files are automatically staged to the cluster's GCS staging bucket
- **Unique Naming**: Staged files get unique names with timestamps to avoid conflicts
- **Cleanup**: Staged files are automatically cleaned up after job completion
- **Supported Extensions**: `.py`, `.jar`, `.sql`, `.R` files are supported

### Example Test Job Output

When using the test-spark-job.py file, you can expect output similar to:

```
=== PySpark Local File Staging Test ===
Spark version: 3.1.3
Arguments received: ['--mode', 'test']

=== Sample Data ===
+---------+---+---------+
|     name|age|     role|
+---------+---+---------+
|    Alice| 25| Engineer|
|      Bob| 30|  Manager|
|  Charlie| 35|  Analyst|
|    Diana| 28| Designer|
+---------+---+---------+

=== Data Analysis ===
Total records: 4
Average age: 29.5

=== Role Distribution ===
+---------+-----+
|     role|count|
+---------+-----+
| Engineer|    1|
|  Manager|    1|
|  Analyst|    1|
| Designer|    1|
+---------+-----+

=== Test Completed Successfully! ===
Local file staging is working correctly.
```

### Successful Test Cases

The following job IDs demonstrate successful local file staging:
- Job ID: `db620480-135f-4de6-b9a6-4045b308fe97` - Basic PySpark job with local file
- Job ID: `36ed88b2-acad-4cfb-8fbf-88ad1ba22ad7` - PySpark job with multiple local files

These examples show that local file staging works seamlessly with the Dataproc MCP server, providing the same experience as using `gcloud dataproc jobs submit pyspark` with local files.