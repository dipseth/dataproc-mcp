/**
 * ResponseFormatter Service
 * Formats filtered responses into human-readable output with emojis and structured display
 */

import { ClusterSummary, ClusterDetails, ResponseFilterConfig } from '../types/response-filter.js';
import { DataprocJob } from '../types/dataproc-responses.js';

export class ResponseFormatter {
  private config: ResponseFilterConfig;

  constructor(config: ResponseFilterConfig) {
    this.config = config;
  }

  /**
   * Status emoji mapping for cluster and job states
   */
  private getStatusEmoji(status: string): string {
    const statusMap: Record<string, string> = {
      RUNNING: '🟢',
      ACTIVE: '🟢',
      CREATING: '🟡',
      PROVISIONING: '🟡',
      STARTING: '🟡',
      ERROR: '🔴',
      FAILED: '🔴',
      DELETING: '🟠',
      STOPPING: '🟠',
      STOPPED: '⚪',
      UNKNOWN: '⚫',
      DONE: '✅',
      SUCCEEDED: '✅',
      CANCELLED: '🚫',
    };

    return this.config.formatting.useEmojis ? statusMap[status.toUpperCase()] || '⚫' : '';
  }

  /**
   * Extract machine type from URI
   */
  private extractMachineType(machineTypeUri?: string): string {
    if (!machineTypeUri) return 'unknown';
    const parts = machineTypeUri.split('/');
    return parts[parts.length - 1] || 'unknown';
  }

  /**
   * Format cluster summary for list operations
   */
  formatClusterSummary(clusters: ClusterSummary[], tokensSaved?: number): string {
    if (!clusters.length) {
      return this.config.formatting.useEmojis ? '📭 No clusters found' : 'No clusters found';
    }

    const lines: string[] = [];

    // Header
    if (this.config.formatting.useEmojis) {
      lines.push(`🏗️  **Dataproc Clusters** (${clusters.length} found)`);
    } else {
      lines.push(`**Dataproc Clusters** (${clusters.length} found)`);
    }

    lines.push('');

    if (this.config.extractionRules.list_clusters.summaryFormat === 'table') {
      // Table format
      lines.push('| Cluster | Status | Workers | Machine Type | Region | Created |');
      lines.push('|---------|--------|---------|--------------|--------|---------|');

      clusters.forEach((cluster) => {
        const statusEmoji = this.getStatusEmoji(cluster.status);
        const machineType = this.extractMachineType(cluster.machineType);
        const workers = cluster.numWorkers || 'N/A';
        const created = new Date(cluster.createTime).toLocaleDateString();

        lines.push(
          `| ${cluster.clusterName} | ${statusEmoji} ${cluster.status} | ${workers} | ${machineType} | ${cluster.region} | ${created} |`
        );
      });
    } else {
      // List format
      clusters.forEach((cluster, index) => {
        const statusEmoji = this.getStatusEmoji(cluster.status);
        const machineType = this.extractMachineType(cluster.machineType);
        const workers = cluster.numWorkers ? ` (${cluster.numWorkers} workers)` : '';
        const created = new Date(cluster.createTime).toLocaleDateString();

        lines.push(`${index + 1}. **${cluster.clusterName}** ${statusEmoji} ${cluster.status}`);
        lines.push(`   📍 ${cluster.region} | 🖥️  ${machineType}${workers} | 📅 ${created}`);

        if (cluster.labels && Object.keys(cluster.labels).length > 0) {
          const labelStr = Object.entries(cluster.labels)
            .map(([k, v]) => `${k}=${v}`)
            .join(', ');
          lines.push(`   🏷️  ${labelStr}`);
        }
        lines.push('');
      });
    }

    // Add resource links and token savings
    if (this.config.formatting.includeResourceLinks) {
      lines.push('');
      lines.push('💡 **Quick Actions:**');
      lines.push('- Get details: `get_cluster --cluster-name <name>`');
      lines.push('- Submit job: `submit_hive_query --cluster-name <name> --query "<SQL>"`');
    }

    if (tokensSaved) {
      lines.push('');
      lines.push(`💾 Response optimized: ${tokensSaved} tokens saved`);
    }

    return lines.join('\n');
  }

  /**
   * Format single cluster details
   */
  formatClusterDetails(cluster: ClusterDetails, tokensSaved?: number): string {
    const lines: string[] = [];
    const statusEmoji = this.getStatusEmoji(cluster.status);

    // Header
    if (this.config.formatting.useEmojis) {
      lines.push(`🏗️  **Cluster: ${cluster.clusterName}** ${statusEmoji}`);
    } else {
      lines.push(`**Cluster: ${cluster.clusterName}**`);
    }

    lines.push('');

    // Basic info
    lines.push(`**Status:** ${statusEmoji} ${cluster.status}`);
    lines.push(`**Project:** ${cluster.projectId}`);
    lines.push(`**Region:** ${cluster.region}`);
    lines.push(`**Created:** ${new Date(cluster.createTime).toLocaleString()}`);
    lines.push('');

    // Configuration
    if (cluster.config) {
      lines.push('**Configuration:**');

      if (cluster.config.masterConfig) {
        const masterMachine = this.extractMachineType(cluster.config.masterConfig.machineTypeUri);
        lines.push(
          `- 🎯 Master: ${cluster.config.masterConfig.numInstances || 1}x ${masterMachine}`
        );

        if (cluster.config.masterConfig.diskConfig) {
          lines.push(
            `  💾 Disk: ${cluster.config.masterConfig.diskConfig.bootDiskSizeGb || 'N/A'}GB ${cluster.config.masterConfig.diskConfig.bootDiskType || ''}`
          );
        }
      }

      if (cluster.config.workerConfig) {
        const workerMachine = this.extractMachineType(cluster.config.workerConfig.machineTypeUri);
        lines.push(
          `- 👥 Workers: ${cluster.config.workerConfig.numInstances || 0}x ${workerMachine}`
        );

        if (cluster.config.workerConfig.diskConfig) {
          lines.push(
            `  💾 Disk: ${cluster.config.workerConfig.diskConfig.bootDiskSizeGb || 'N/A'}GB ${cluster.config.workerConfig.diskConfig.bootDiskType || ''}`
          );
        }
      }

      if (cluster.config.softwareConfig) {
        lines.push(`- 📦 Image: ${cluster.config.softwareConfig.imageVersion || 'default'}`);

        if (cluster.config.softwareConfig.optionalComponents?.length) {
          lines.push(
            `- 🔧 Components: ${cluster.config.softwareConfig.optionalComponents.join(', ')}`
          );
        }
      }

      lines.push('');
    }

    // Labels
    if (cluster.labels && Object.keys(cluster.labels).length > 0) {
      lines.push('**Labels:**');
      Object.entries(cluster.labels).forEach(([key, value]) => {
        lines.push(`- ${key}: ${value}`);
      });
      lines.push('');
    }

    // Status history (if included)
    if (cluster.statusHistory?.length) {
      lines.push('**Status History:**');
      cluster.statusHistory.slice(0, 3).forEach((status) => {
        const time = new Date(status.stateStartTime).toLocaleString();
        const emoji = this.getStatusEmoji(status.state);
        lines.push(`- ${emoji} ${status.state} (${time})`);
        if (status.detail) {
          lines.push(`  ${status.detail}`);
        }
      });
      lines.push('');
    }

    // Resource links
    if (this.config.formatting.includeResourceLinks) {
      lines.push('💡 **Quick Actions:**');
      lines.push(
        `- Submit Hive query: \`submit_hive_query --cluster-name ${cluster.clusterName} --query "<SQL>"\``
      );
      lines.push(`- Check jobs: \`check_active_jobs --cluster-name ${cluster.clusterName}\``);
      lines.push(`- Delete cluster: \`delete_cluster --cluster-name ${cluster.clusterName}\``);
    }

    if (tokensSaved) {
      lines.push('');
      lines.push(`💾 Response optimized: ${tokensSaved} tokens saved`);
    }

    return lines.join('\n');
  }

  /**
   * Format job summary for job-related responses
   */
  formatJobSummary(jobs: DataprocJob[], tokensSaved?: number): string {
    if (!jobs.length) {
      return this.config.formatting.useEmojis ? '📭 No jobs found' : 'No jobs found';
    }

    const lines: string[] = [];

    // Header
    if (this.config.formatting.useEmojis) {
      lines.push(`⚙️  **Dataproc Jobs** (${jobs.length} found)`);
    } else {
      lines.push(`**Dataproc Jobs** (${jobs.length} found)`);
    }

    lines.push('');

    // Group by status if configured
    if (this.config.extractionRules.job_tracking.groupByStatus) {
      const groupedJobs = jobs.reduce(
        (acc, job) => {
          const status = job.status?.state || 'UNKNOWN';
          if (!acc[status]) acc[status] = [];
          acc[status].push(job);
          return acc;
        },
        {} as Record<string, DataprocJob[]>
      );

      Object.entries(groupedJobs).forEach(([status, statusJobs]) => {
        const statusEmoji = this.getStatusEmoji(status);
        const jobsArray = statusJobs;
        lines.push(`### ${statusEmoji} ${status} (${jobsArray.length})`);
        lines.push('');

        jobsArray.forEach((job) => {
          const jobType = job.hiveJob
            ? 'Hive'
            : job.sparkJob
              ? 'Spark'
              : job.pysparkJob
                ? 'PySpark'
                : 'Unknown';
          const submitTime = job.statusHistory?.[0]?.stateStartTime
            ? new Date(job.statusHistory[0].stateStartTime).toLocaleString()
            : 'Unknown';

          lines.push(`- **${job.reference?.jobId || 'Unknown'}** (${jobType})`);
          lines.push(`  📅 ${submitTime} | 🏗️  ${job.placement?.clusterName || 'Unknown'}`);

          if (job.status?.details) {
            lines.push(`  ℹ️  ${job.status.details}`);
          }
        });
        lines.push('');
      });
    } else {
      // Simple list format
      jobs.forEach((job, index) => {
        const status = job.status?.state || 'UNKNOWN';
        const statusEmoji = this.getStatusEmoji(status);
        const jobType = job.hiveJob
          ? 'Hive'
          : job.sparkJob
            ? 'Spark'
            : job.pysparkJob
              ? 'PySpark'
              : 'Unknown';
        const submitTime = job.statusHistory?.[0]?.stateStartTime
          ? new Date(job.statusHistory[0].stateStartTime).toLocaleString()
          : 'Unknown';

        lines.push(
          `${index + 1}. **${job.reference?.jobId || 'Unknown'}** ${statusEmoji} ${status}`
        );
        lines.push(
          `   🔧 ${jobType} | 🏗️  ${job.placement?.clusterName || 'Unknown'} | 📅 ${submitTime}`
        );

        if (job.status?.details) {
          lines.push(`   ℹ️  ${job.status.details}`);
        }
        lines.push('');
      });
    }

    // Resource links
    if (this.config.formatting.includeResourceLinks) {
      lines.push('💡 **Quick Actions:**');
      lines.push('- Get job status: `get_job_status --job-id <id>`');
      lines.push('- Get job results: `get_job_results --job-id <id>`');
    }

    if (tokensSaved) {
      lines.push('');
      lines.push(`💾 Response optimized: ${tokensSaved} tokens saved`);
    }

    return lines.join('\n');
  }

  /**
   * Format query results with schema and statistics
   */
  formatQueryResults(
    results: unknown,
    schema?: unknown,
    stats?: unknown,
    tokensSaved?: number
  ): string {
    const lines: string[] = [];

    // Header
    if (this.config.formatting.useEmojis) {
      lines.push('📊 **Query Results**');
    } else {
      lines.push('**Query Results**');
    }
    lines.push('');

    // Schema information
    if (schema && this.config.extractionRules.query_results.includeSchema) {
      lines.push('**Schema:**');
      if (Array.isArray(schema)) {
        schema.forEach((col) => {
          lines.push(`- ${col.name}: ${col.type}`);
        });
      }
      lines.push('');
    }

    // Results table
    if (results && Array.isArray(results) && results.length > 0) {
      const maxRows = this.config.extractionRules.query_results.maxRows;
      const displayRows = results.slice(0, maxRows);

      // Simple table format
      if (displayRows.length > 0 && typeof displayRows[0] === 'object') {
        const headers = Object.keys(displayRows[0]);

        // Table header
        lines.push(`| ${headers.join(' | ')} |`);
        lines.push(`|${headers.map(() => '---').join('|')}|`);

        // Table rows
        displayRows.forEach((row) => {
          const values = headers.map((h) => String(row[h] || ''));
          lines.push(`| ${values.join(' | ')} |`);
        });

        if (results.length > maxRows) {
          lines.push(`... and ${results.length - maxRows} more rows`);
        }
      }
      lines.push('');
    }

    // Statistics
    if (stats && this.config.extractionRules.query_results.summaryStats) {
      const statsObj = stats as any;
      const resultsArray = results as any;
      lines.push('**Statistics:**');
      lines.push(`- Total rows: ${statsObj?.totalRows || resultsArray?.length || 0}`);
      lines.push(`- Execution time: ${statsObj?.executionTime || 'N/A'}`);
      lines.push(`- Bytes processed: ${statsObj?.bytesProcessed || 'N/A'}`);
      lines.push('');
    }

    if (tokensSaved) {
      lines.push(`💾 Response optimized: ${tokensSaved} tokens saved`);
    }

    return lines.join('\n');
  }

  /**
   * Format resource URI for MCP resource access
   */
  formatResourceUri(
    toolName: string,
    projectId?: string,
    region?: string,
    identifier?: string
  ): string {
    const parts = ['dataproc:', toolName];
    if (projectId) parts.push(projectId);
    if (region) parts.push(region);
    if (identifier) parts.push(identifier);

    return parts.join('/');
  }

  /**
   * Format token savings display
   */
  formatTokenSavings(originalTokens: number, filteredTokens: number): string {
    const saved = originalTokens - filteredTokens;
    const percentage = Math.round((saved / originalTokens) * 100);

    if (this.config.formatting.useEmojis) {
      return `💾 Optimized: ${saved} tokens saved (${percentage}% reduction)`;
    } else {
      return `Optimized: ${saved} tokens saved (${percentage}% reduction)`;
    }
  }
}
