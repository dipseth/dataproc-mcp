#!/usr/bin/env node

/**
 * Generate trusted SSL certificates for localhost development using mkcert
 * Required for HTTPS support in OAuth authorization endpoints and Claude.ai web app compatibility
 * 
 * mkcert creates certificates that are automatically trusted by browsers,
 * solving the "MCP error -32000: Connection closed" issue with Claude.ai web app
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');
const certDir = join(projectRoot, 'certs');

// Ensure certs directory exists
if (!existsSync(certDir)) {
  mkdirSync(certDir, { recursive: true });
}

const keyPath = join(certDir, 'localhost-key.pem');
const certPath = join(certDir, 'localhost-cert.pem');

// Check if certificates already exist
if (existsSync(keyPath) && existsSync(certPath)) {
  console.log('✅ SSL certificates already exist:');
  console.log(`   Key:  ${keyPath}`);
  console.log(`   Cert: ${certPath}`);
  console.log('');
  console.log('🔍 To regenerate certificates, delete the existing files and run this script again.');
  process.exit(0);
}

console.log('🔐 Generating trusted SSL certificates for localhost using mkcert...');

try {
  // Check if mkcert is installed
  console.log('🔍 Checking if mkcert is installed...');
  try {
    execSync('mkcert -version', { stdio: 'pipe' });
    console.log('✅ mkcert is installed');
  } catch (error) {
    console.error('❌ mkcert is not installed. Please install it first:');
    console.error('');
    console.error('Installation instructions:');
    console.error('  macOS:    brew install mkcert');
    console.error('  Linux:    See https://github.com/FiloSottile/mkcert#installation');
    console.error('  Windows:  See https://github.com/FiloSottile/mkcert#installation');
    console.error('');
    console.error('After installation, run this script again.');
    process.exit(1);
  }

  // Check if local CA is installed
  console.log('🔍 Checking local CA installation...');
  try {
    execSync('mkcert -CAROOT', { stdio: 'pipe' });
    console.log('✅ Local CA is available');
  } catch (error) {
    console.log('📋 Installing local CA (you may be prompted for your password)...');
    try {
      execSync('mkcert -install', { stdio: 'inherit' });
      console.log('✅ Local CA installed successfully');
    } catch (installError) {
      console.error('❌ Failed to install local CA:', installError.message);
      console.error('');
      console.error('Please run "mkcert -install" manually and then run this script again.');
      process.exit(1);
    }
  }

  // Generate certificates for localhost, 127.0.0.1, and ::1
  console.log('📜 Generating trusted certificates for localhost, 127.0.0.1, and ::1...');
  
  const certCommand = `mkcert -key-file "${keyPath}" -cert-file "${certPath}" localhost 127.0.0.1 ::1`;
  execSync(certCommand, { 
    stdio: 'inherit',
    cwd: certDir 
  });

  console.log('');
  console.log('✅ Trusted SSL certificates generated successfully!');
  console.log(`   Key:  ${keyPath}`);
  console.log(`   Cert: ${certPath}`);
  console.log('');
  console.log('🎉 These certificates are now trusted by your system and browsers!');
  console.log('   ✅ No more browser security warnings');
  console.log('   ✅ Compatible with Claude.ai web app');
  console.log('   ✅ Works with WebSocket connections');
  console.log('');
  console.log('🔧 Certificate details:');
  console.log('   - Valid for: localhost, 127.0.0.1, ::1');
  console.log('   - Automatically trusted by browsers');
  console.log('   - No manual certificate acceptance required');
  console.log('');
  console.log('🚀 You can now use HTTPS endpoints without certificate warnings:');
  console.log('   - https://localhost:8443/mcp (WebSocket)');
  console.log('   - https://localhost:8443/health (Health check)');
  console.log('   - https://localhost:8443/auth/* (OAuth endpoints)');

} catch (error) {
  console.error('❌ Failed to generate SSL certificates:', error.message);
  console.error('');
  console.error('Troubleshooting:');
  console.error('1. Make sure mkcert is installed:');
  console.error('   macOS: brew install mkcert');
  console.error('   Linux/Windows: https://github.com/FiloSottile/mkcert#installation');
  console.error('');
  console.error('2. Install the local CA:');
  console.error('   mkcert -install');
  console.error('');
  console.error('3. Try running this script again');
  console.error('');
  console.error('For more help, see: https://github.com/FiloSottile/mkcert');
  process.exit(1);
}