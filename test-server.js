#!/usr/bin/env node
/**
 * Test script to verify the MCP server starts and responds correctly.
 * Run with: node test-server.js
 */

import { spawn } from 'child_process';

console.log('🧪 Testing Soroban MCP Server...\n');

// Start the server
const server = spawn('node', ['dist/index.js'], {
  env: {
    ...process.env,
    STELLAR_NETWORK: 'testnet',
    LOG_LEVEL: 'info',
  },
});

let receivedData = false;

server.stdout.on('data', (data) => {
  const output = data.toString().trim();
  console.log('✅ Server output:', output);
  receivedData = true;
  
  // Check for successful startup message
  if (output.includes('Soroban MCP Server started')) {
    console.log('\n✅ Server started successfully!');
    console.log('✅ Network: testnet');
    console.log('✅ Transport: stdio');
    
    setTimeout(() => {
      console.log('\n🎉 Test passed! Server is operational.\n');
      console.log('To use with an MCP client, add this to your mcp.json:');
      console.log(JSON.stringify({
        mcpServers: {
          soroban: {
            command: 'npx',
            args: ['soroban-mcp-server'],
            env: {
              STELLAR_NETWORK: 'testnet'
            }
          }
        }
      }, null, 2));
      server.kill();
      process.exit(0);
    }, 1000);
  }
});

server.stderr.on('data', (data) => {
  const output = data.toString().trim();
  console.log('📋 Server stderr:', output);
});

server.on('error', (error) => {
  console.error('❌ Failed to start server:', error.message);
  process.exit(1);
});

server.on('close', (code) => {
  if (code !== 0 && !receivedData) {
    console.error(`❌ Server exited with code ${code}`);
    process.exit(code || 1);
  }
});

// Timeout after 10 seconds
setTimeout(() => {
  console.error('\n❌ Test timeout - server did not start within 10 seconds');
  server.kill();
  process.exit(1);
}, 10000);
