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