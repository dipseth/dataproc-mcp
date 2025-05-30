#!/usr/bin/env node

/**
 * Stop script for Dataproc MCP Server
 * Cleanly stops all running instances of the MCP server
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function findMCPProcesses() {
  try {
    // Find all Node.js processes running the MCP server
    const { stdout } = await execAsync('ps aux | grep "dataproc.*index.js" | grep -v grep');
    
    if (!stdout.trim()) {
      console.log('ℹ️  No running Dataproc MCP Server instances found');
      return [];
    }

    const processes = stdout.trim().split('\n').map(line => {
      const parts = line.trim().split(/\s+/);
      return {
        pid: parts[1],
        command: parts.slice(10).join(' ')
      };
    });

    return processes;
  } catch (error) {
    // No processes found or error occurred
    return [];
  }
}

async function stopProcess(pid) {
  try {
    console.log(`🛑 Stopping process ${pid}...`);
    await execAsync(`kill -TERM ${pid}`);
    
    // Wait a moment for graceful shutdown
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check if process is still running
    try {
      await execAsync(`kill -0 ${pid}`);
      // Process still running, force kill
      console.log(`⚠️  Process ${pid} didn't stop gracefully, force killing...`);
      await execAsync(`kill -KILL ${pid}`);
    } catch (error) {
      // Process stopped successfully
      console.log(`✅ Process ${pid} stopped successfully`);
    }
  } catch (error) {
    console.log(`❌ Failed to stop process ${pid}: ${error.message}`);
  }
}

async function stopAllInstances() {
  console.log('🔍 Searching for running Dataproc MCP Server instances...');
  
  const processes = await findMCPProcesses();
  
  if (processes.length === 0) {
    console.log('✅ No running instances to stop');
    return;
  }

  console.log(`📋 Found ${processes.length} running instance(s):`);
  processes.forEach(proc => {
    console.log(`  • PID ${proc.pid}: ${proc.command}`);
  });

  console.log('\n🛑 Stopping all instances...');
  
  for (const proc of processes) {
    await stopProcess(proc.pid);
  }

  console.log('\n🎉 All Dataproc MCP Server instances have been stopped');
}

async function stopMCPInspector() {
  try {
    console.log('🔍 Checking for MCP Inspector instances...');
    const { stdout } = await execAsync('ps aux | grep "@modelcontextprotocol/inspector" | grep -v grep');
    
    if (stdout.trim()) {
      const processes = stdout.trim().split('\n').map(line => {
        const parts = line.trim().split(/\s+/);
        return parts[1]; // PID
      });

      console.log(`📋 Found ${processes.length} MCP Inspector instance(s)`);
      
      for (const pid of processes) {
        console.log(`🛑 Stopping MCP Inspector process ${pid}...`);
        await execAsync(`kill -TERM ${pid}`);
      }
      
      console.log('✅ MCP Inspector instances stopped');
    } else {
      console.log('ℹ️  No MCP Inspector instances found');
    }
  } catch (error) {
    // No inspector processes found
  }
}

async function main() {
  console.log('🛑 Dataproc MCP Server Stop Script');
  console.log('===================================\n');

  try {
    await stopAllInstances();
    await stopMCPInspector();
    
    console.log('\n✨ Clean shutdown complete!');
    console.log('You can now safely restart the server with:');
    console.log('  npm start');
    console.log('  npm run inspector');
    
  } catch (error) {
    console.error('❌ Error during shutdown:', error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}