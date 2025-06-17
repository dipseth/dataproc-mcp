#!/usr/bin/env python3
"""
Simple PySpark test job for local file staging demonstration.
This script performs basic Spark operations to validate the staging functionality.
"""

from pyspark.sql import SparkSession
import sys

def main():
    # Initialize Spark session
    spark = SparkSession.builder \
        .appName("LocalFileStagingTest") \
        .getOrCreate()
    
    print("=== PySpark Local File Staging Test ===")
    print(f"Spark version: {spark.version}")
    print(f"Arguments received: {sys.argv[1:] if len(sys.argv) > 1 else 'None'}")
    
    # Create a simple DataFrame for testing
    data = [
        ("Alice", 25, "Engineer"),
        ("Bob", 30, "Manager"), 
        ("Charlie", 35, "Analyst"),
        ("Diana", 28, "Designer")
    ]
    
    columns = ["name", "age", "role"]
    df = spark.createDataFrame(data, columns)
    
    print("\n=== Sample Data ===")
    df.show()
    
    # Perform some basic operations
    print("\n=== Data Analysis ===")
    print(f"Total records: {df.count()}")
    print(f"Average age: {df.agg({'age': 'avg'}).collect()[0][0]:.1f}")
    
    # Group by role
    print("\n=== Role Distribution ===")
    df.groupBy("role").count().show()
    
    # Filter and display
    print("\n=== Engineers and Managers ===")
    df.filter(df.role.isin(["Engineer", "Manager"])).show()
    
    print("\n=== Test Completed Successfully! ===")
    print("Local file staging is working correctly.")
    
    spark.stop()
    return 0

if __name__ == "__main__":
    exit(main())