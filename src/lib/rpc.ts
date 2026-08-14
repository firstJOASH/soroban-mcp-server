import { rpc, Horizon } from '@stellar/stellar-sdk';
import { getRpcUrl } from '../config.js';
import { logger } from './logger.js';
import { ErrorCode, McpToolError } from './errors.js';

/**
 * Returns a cached RPC Server for the given network.
 */
const rpcClients = new Map<string, rpc.Server>();

export function getRpcClient(network: string): rpc.Server {
  if (!rpcClients.has(network)) {
    const url = getRpcUrl(network);
    logger.debug({ network, url }, 'Creating RPC client');
    rpcClients.set(network, new rpc.Server(url, { allowHttp: url.startsWith('http://') }));
  }
  return rpcClients.get(network)!;
}

/**
 * Wraps an RPC call with timeout and error mapping.
 */
export async function withRpcTimeout<T>(fn: () => Promise<T>, timeoutMs = 30_000): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('RPC request timed out')), timeoutMs),
  );
  try {
    return await Promise.race([fn(), timeout]);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('timed out')) {
      throw new McpToolError(
        'RPC request timed out. The network may be congested or unreachable.',
        ErrorCode.NETWORK_TIMEOUT,
        { timeoutMs },
      );
    }
    if (message.includes('ECONNREFUSED') || message.includes('ENOTFOUND')) {
      throw new McpToolError(
        'Could not connect to the RPC endpoint. Check your RPC_URL and network connectivity.',
        ErrorCode.NETWORK_UNREACHABLE,
      );
    }
    throw err;
  }
}

/**
 * Gets ledger info / health from the RPC server.
 */
export async function getNetworkHealth(
  network: string,
): Promise<{ status: string; latestLedger: number; latestLedgerCloseTime: number }> {
  const client = getRpcClient(network);
  const health = (await withRpcTimeout(() => client.getHealth())) as { status: string };
  const ledger = (await withRpcTimeout(() => client.getLatestLedger())) as {
    sequence: number;
    protocolVersion: string;
  };
  return {
    status: health.status,
    latestLedger: ledger.sequence,
    latestLedgerCloseTime: parseInt(ledger.protocolVersion, 10),
  };
}

/**
 * Returns a Horizon server instance for account lookups.
 */
const horizonClients = new Map<string, Horizon.Server>();

const HORIZON_URLS: Record<string, string> = {
  testnet: 'https://horizon-testnet.stellar.org',
  futurenet: 'https://horizon-futurenet.stellar.org',
  mainnet: 'https://horizon.stellar.org',
};

export function getHorizonClient(network: string): Horizon.Server {
  if (!horizonClients.has(network)) {
    const url = HORIZON_URLS[network] ?? HORIZON_URLS['testnet']!;
    logger.debug({ network, url }, 'Creating Horizon client');
    horizonClients.set(network, new Horizon.Server(url));
  }
  return horizonClients.get(network)!;
}
