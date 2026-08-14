#!/usr/bin/env node
/**
 * Soroban MCP Server — entrypoint
 *
 * Registers all tools and resources with the MCP SDK and starts
 * listening on stdio (the standard MCP transport).
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { config } from './config.js';
import { logger } from './lib/logger.js';

// Tools
import { BuildContractInputSchema, buildContractHandler } from './tools/buildContract.js';
import { RunTestsInputSchema, runTestsHandler } from './tools/runTests.js';
import { GetAccountInfoInputSchema, getAccountInfoHandler } from './tools/getAccountInfo.js';
import { GetContractStateInputSchema, getContractStateHandler } from './tools/getContractState.js';
import { DeployContractInputSchema, deployContractHandler } from './tools/deployContract.js';
import { InvokeContractInputSchema, invokeContractHandler } from './tools/invokeContract.js';

// Resources
import {
  getNetworkStatusResource,
  getContractAbiResource,
  getContractTransactionsResource,
} from './resources/index.js';

const SERVER_NAME = 'soroban-mcp-server';
const SERVER_VERSION = '0.1.0';

const server = new Server(
  { name: SERVER_NAME, version: SERVER_VERSION },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  },
);

// ─── Tool Definitions ────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'build_contract',
      description:
        'Builds a Soroban smart contract project using the Stellar CLI. ' +
        'Returns structured compiler diagnostics (file, line, error code, message) — ' +
        'not raw rustc text.',
      inputSchema: {
        type: 'object',
        properties: {
          project_path: {
            type: 'string',
            description: BuildContractInputSchema.shape.project_path.description,
          },
          network: {
            type: 'string',
            enum: ['testnet', 'futurenet', 'mainnet'],
            description: BuildContractInputSchema.shape.network.description,
            default: 'testnet',
          },
        },
        required: ['project_path'],
      },
    },
    {
      name: 'run_tests',
      description:
        'Runs the Soroban contract test suite with `cargo test`. ' +
        'Returns a structured pass/fail report (test name, status, duration, failure message).',
      inputSchema: {
        type: 'object',
        properties: {
          project_path: {
            type: 'string',
            description: RunTestsInputSchema.shape.project_path.description,
          },
          filter: {
            type: 'string',
            description: RunTestsInputSchema.shape.filter.description,
          },
        },
        required: ['project_path'],
      },
    },
    {
      name: 'get_account_info',
      description:
        'Returns balance, sequence number, and signers for a Stellar account. ' +
        'Includes a testnet funding link if the account is not found.',
      inputSchema: {
        type: 'object',
        properties: {
          public_key: {
            type: 'string',
            description: GetAccountInfoInputSchema.shape.public_key.description,
          },
          network: {
            type: 'string',
            enum: ['testnet', 'futurenet', 'mainnet'],
            description: GetAccountInfoInputSchema.shape.network.description,
            default: 'testnet',
          },
        },
        required: ['public_key'],
      },
    },
    {
      name: 'get_contract_state',
      description:
        'Reads and returns storage entries (persistent, instance, temporary) for a Soroban contract. ' +
        'Keys and values are decoded to human-readable strings where possible.',
      inputSchema: {
        type: 'object',
        properties: {
          contract_id: {
            type: 'string',
            description: GetContractStateInputSchema.shape.contract_id.description,
          },
          network: {
            type: 'string',
            enum: ['testnet', 'futurenet', 'mainnet'],
            description: GetContractStateInputSchema.shape.network.description,
            default: 'testnet',
          },
          durability: {
            type: 'string',
            enum: ['persistent', 'instance', 'temporary'],
            description: GetContractStateInputSchema.shape.durability.description,
          },
          limit: {
            type: 'number',
            description: GetContractStateInputSchema.shape.limit.description,
            default: 50,
          },
        },
        required: ['contract_id'],
      },
    },
    {
      name: 'deploy_contract',
      description:
        'Deploys a compiled .wasm file to testnet or futurenet using the Stellar CLI. ' +
        'Returns the contract ID and transaction hash. ' +
        'Mainnet is intentionally not supported here.',
      inputSchema: {
        type: 'object',
        properties: {
          wasm_path: {
            type: 'string',
            description: DeployContractInputSchema.shape.wasm_path.description,
          },
          network: {
            type: 'string',
            enum: ['testnet', 'futurenet'],
            description: DeployContractInputSchema.shape.network.description,
            default: 'testnet',
          },
          source_account: {
            type: 'string',
            description: DeployContractInputSchema.shape.source_account.description,
          },
          ignore_checks: {
            type: 'boolean',
            description: DeployContractInputSchema.shape.ignore_checks.description,
            default: false,
          },
        },
        required: ['wasm_path', 'source_account'],
      },
    },
    {
      name: 'invoke_contract',
      description:
        'Simulates a Soroban contract function call via RPC. ' +
        'Returns the function result AND simulated resource cost (CPU instructions, memory, min fee). ' +
        'For read-only calls no signing is needed.',
      inputSchema: {
        type: 'object',
        properties: {
          contract_id: {
            type: 'string',
            description: InvokeContractInputSchema.shape.contract_id.description,
          },
          function_name: {
            type: 'string',
            description: InvokeContractInputSchema.shape.function_name.description,
          },
          args: {
            type: 'array',
            description: InvokeContractInputSchema.shape.args.description,
            items: {},
          },
          network: {
            type: 'string',
            enum: ['testnet', 'futurenet', 'mainnet'],
            description: InvokeContractInputSchema.shape.network.description,
            default: 'testnet',
          },
          source_account: {
            type: 'string',
            description: InvokeContractInputSchema.shape.source_account.description,
          },
        },
        required: ['contract_id', 'function_name'],
      },
    },
  ],
}));

// ─── Tool Dispatch ────────────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  logger.info({ tool: name }, 'Tool called');

  switch (name) {
    case 'build_contract':
      return buildContractHandler(args);
    case 'run_tests':
      return runTestsHandler(args);
    case 'get_account_info':
      return getAccountInfoHandler(args);
    case 'get_contract_state':
      return getContractStateHandler(args);
    case 'deploy_contract':
      return deployContractHandler(args);
    case 'invoke_contract':
      return invokeContractHandler(args);
    default:
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ error: `Unknown tool: ${name}`, code: 'UNKNOWN_TOOL' }),
          },
        ],
      };
  }
});

// ─── Resource Definitions ─────────────────────────────────────────────────────

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    {
      uri: `soroban://network/{network}/status`,
      name: 'Network Status',
      description: 'Current ledger height and health for a Stellar network',
      mimeType: 'application/json',
    },
    {
      uri: `soroban://contract/{contract_id}/abi`,
      name: 'Contract ABI',
      description: 'Contract ABI/spec parsed from the on-chain WASM metadata',
      mimeType: 'application/json',
    },
    {
      uri: `soroban://contract/{contract_id}/transactions`,
      name: 'Contract Transaction History',
      description: 'Recent transaction history for a contract',
      mimeType: 'application/json',
    },
  ],
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  // soroban://network/{network}/status
  const networkStatusMatch = uri.match(/^soroban:\/\/network\/([^/]+)\/status$/);
  if (networkStatusMatch) {
    const network = networkStatusMatch[1]!;
    const status = await getNetworkStatusResource(network);
    return {
      contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(status, null, 2) }],
    };
  }

  // soroban://contract/{contract_id}/abi?network={network}
  const contractAbiMatch = uri.match(/^soroban:\/\/contract\/([^/]+)\/abi/);
  if (contractAbiMatch) {
    const contractId = contractAbiMatch[1]!;
    const network =
      new URL(uri.replace('soroban://', 'http://soroban')).searchParams.get('network') ??
      config.STELLAR_NETWORK;
    const abi = await getContractAbiResource(contractId, network);
    return {
      contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(abi, null, 2) }],
    };
  }

  // soroban://contract/{contract_id}/transactions
  const txHistoryMatch = uri.match(/^soroban:\/\/contract\/([^/]+)\/transactions/);
  if (txHistoryMatch) {
    const contractId = txHistoryMatch[1]!;
    const network =
      new URL(uri.replace('soroban://', 'http://soroban')).searchParams.get('network') ??
      config.STELLAR_NETWORK;
    const txs = await getContractTransactionsResource(contractId, network);
    return {
      contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(txs, null, 2) }],
    };
  }

  return {
    contents: [
      {
        uri,
        mimeType: 'application/json',
        text: JSON.stringify({ error: `Unknown resource URI: ${uri}` }),
      },
    ],
  };
});

// ─── Start ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info(
    { name: SERVER_NAME, version: SERVER_VERSION, network: config.STELLAR_NETWORK },
    'Soroban MCP Server started',
  );
}

main().catch((err) => {
  logger.error({ err }, 'Fatal error starting server');
  process.exit(1);
});
