#!/usr/bin/env node

/**
 * Test script to verify trusted SSL certificates work with WebSocket connections
 * This simulates how Claude.ai web app would connect to the MCP server
 */

import WebSocket from 'ws';
import https from 'https';

const HTTPS_URL = 'https://localhost:8443/health';
const WSS_URL = 'wss://localhost:8443/mcp';

console.log('🔍 Testing trusted SSL certificates for Claude.ai compatibility...\n');

// Test 1: HTTPS endpoint
console.log('1️⃣ Testing HTTPS endpoint...');
try {
  const response = await fetch(HTTPS_URL);
  if (response.ok) {
    console.log('   ✅ HTTPS connection successful - no certificate errors');
    const data = await response.json();
    console.log(`   📊 Server status: ${data.status}`);
  } else {
    console.log(`   ❌ HTTPS connection failed with status: ${response.status}`);
  }
} catch (error) {
  console.log(`   ❌ HTTPS connection failed: ${error.message}`);
  if (error.message.includes('certificate') || error.message.includes('SSL')) {
    console.log('   🔧 Certificate issue detected - certificates may not be trusted');
  }
}

console.log('');

// Test 2: WebSocket connection with MCP subprotocol
console.log('2️⃣ Testing WebSocket connection with MCP subprotocol...');
try {
  const ws = new WebSocket(WSS_URL, ['mcp'], {
    // This is key - we don't set rejectUnauthorized: false
    // If certificates are properly trusted, this should work without it
  });

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('Connection timeout'));
    }, 5000);

    ws.on('open', () => {
      clearTimeout(timeout);
      console.log('   ✅ WebSocket connection established successfully');
      console.log(`   🔗 Protocol negotiated: ${ws.protocol}`);
      console.log('   🎉 Trusted certificates working - Claude.ai compatibility confirmed!');
      ws.close();
      resolve();
    });

    ws.on('error', (error) => {
      clearTimeout(timeout);
      console.log(`   ❌ WebSocket connection failed: ${error.message}`);
      if (error.message.includes('certificate') || error.message.includes('SSL')) {
        console.log('   🔧 Certificate issue detected - may need to regenerate certificates');
      }
      reject(error);
    });
  });
} catch (error) {
  console.log(`   ❌ WebSocket test failed: ${error.message}`);
}

console.log('');

// Test 3: Certificate details
console.log('3️⃣ Checking certificate details...');
try {
  const agent = new https.Agent({
    rejectUnauthorized: true // This should work with trusted certificates
  });

  const options = {
    hostname: 'localhost',
    port: 8443,
    path: '/health',
    method: 'GET',
    agent: agent
  };

  await new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      const cert = res.socket.getPeerCertificate();
      if (cert && cert.subject) {
        console.log('   ✅ Certificate details retrieved:');
        console.log(`   📋 Subject: ${cert.subject.CN}`);
        console.log(`   📅 Valid from: ${cert.valid_from}`);
        console.log(`   📅 Valid to: ${cert.valid_to}`);
        console.log(`   🏷️  Alt names: ${cert.subjectaltname || 'None'}`);
        console.log(`   🔐 Issuer: ${cert.issuer.CN}`);
        
        // Check if it's an mkcert certificate
        if (cert.issuer.CN && cert.issuer.CN.includes('mkcert')) {
          console.log('   🎯 mkcert certificate detected - trusted by system');
        }
      }
      resolve();
    });

    req.on('error', (error) => {
      console.log(`   ❌ Certificate check failed: ${error.message}`);
      reject(error);
    });

    req.end();
  });
} catch (error) {
  console.log(`   ❌ Certificate details check failed: ${error.message}`);
}

console.log('');
console.log('🏁 Certificate testing complete!');
console.log('');
console.log('📖 For Claude.ai web app integration:');
console.log('   1. Use WebSocket URL: wss://localhost:8443/mcp');
console.log('   2. Enable MCP subprotocol support');
console.log('   3. No certificate warnings should appear');
console.log('');
console.log('🔧 If tests failed, try:');
console.log('   1. Regenerate certificates: npm run ssl:generate');
console.log('   2. Restart the server: npm start');
console.log('   3. Check mkcert installation: mkcert -version');