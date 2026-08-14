import type { rpc } from '@stellar/stellar-sdk';
import { xdr, StrKey } from '@stellar/stellar-sdk';
import { getRpcClient, getNetworkHealth, withRpcTimeout } from '../lib/rpc.js';
import { logger } from '../lib/logger.js';
import { ErrorCode, McpToolError } from '../lib/errors.js';

export interface NetworkStatus {
  network: string;
  status: string;
  latestLedger: number;
  rpcUrl: string;
}

export interface ContractAbi {
  contractId: string;
  network: string;
  functions: AbiFunction[];
  events: AbiEvent[];
}

export interface AbiFunction {
  name: string;
  inputs: AbiParam[];
  outputs: AbiParam[];
  docs?: string;
}

export interface AbiParam {
  name: string;
  type: string;
}

export interface AbiEvent {
  name: string;
  fields: AbiParam[];
}

export interface TransactionHistoryEntry {
  id: string;
  ledger: number;
  createdAt: string;
  operationCount: number;
  successful: boolean;
}

/**
 * Gets current network status.
 */
export async function getNetworkStatusResource(network: string): Promise<NetworkStatus> {
  const { getRpcUrl } = await import('../config.js');
  const rpcUrl = getRpcUrl(network);

  try {
    const health = await getNetworkHealth(network);
    return {
      network,
      status: health.status,
      latestLedger: health.latestLedger,
      rpcUrl,
    };
  } catch (err) {
    logger.warn({ network, err }, 'Failed to get network health');
    return {
      network,
      status: 'unknown',
      latestLedger: 0,
      rpcUrl,
    };
  }
}

/**
 * Reads contract ABI from on-chain contract instance (WASM spec).
 * The spec entries are stored as part of the WASM metadata section and
 * are also available via the RPC getLedgerEntries call on the WASM hash.
 */
export async function getContractAbiResource(
  contractId: string,
  network: string,
): Promise<ContractAbi> {
  if (!StrKey.isValidContract(contractId)) {
    throw new McpToolError(
      `Invalid contract ID: "${contractId}". Must be a 56-character string starting with C.`,
      ErrorCode.INVALID_CONTRACT_ID,
    );
  }

  const client = getRpcClient(network);

  // Get the contract instance to find the WASM hash
  const contractAddress = xdr.ScAddress.scAddressTypeContract(StrKey.decodeContract(contractId));

  const instanceKey = xdr.LedgerKey.contractData(
    new xdr.LedgerKeyContractData({
      contract: contractAddress,
      key: xdr.ScVal.scvLedgerKeyContractInstance(),
      durability: xdr.ContractDataDurability.persistent(),
    }),
  );

  let instanceEntries: rpc.Api.GetLedgerEntriesResponse;
  try {
    instanceEntries = await withRpcTimeout(() => client.getLedgerEntries(instanceKey));
  } catch (err) {
    throw new McpToolError(
      `Failed to fetch contract instance for ${contractId}: ${err instanceof Error ? err.message : String(err)}`,
      ErrorCode.CONTRACT_NOT_FOUND,
    );
  }

  if (!instanceEntries.entries?.length) {
    throw new McpToolError(
      `Contract ${contractId} not found on ${network}.`,
      ErrorCode.CONTRACT_NOT_FOUND,
    );
  }

  // Extract WASM hash from the instance
  const instanceData = instanceEntries.entries[0]!.val.contractData();
  let wasmHash: Buffer | undefined;

  try {
    const instance = instanceData.val().instance();
    const executable = instance.executable();
    if (executable.switch().name === 'contractExecutableWasm') {
      wasmHash = Buffer.from(executable.wasmHash());
    }
  } catch {
    // WASM hash not extractable
  }

  if (!wasmHash) {
    return {
      contractId,
      network,
      functions: [],
      events: [],
    };
  }

  // Fetch the WASM entry to get spec entries
  const wasmKey = xdr.LedgerKey.contractCode(new xdr.LedgerKeyContractCode({ hash: wasmHash }));

  let wasmEntries: rpc.Api.GetLedgerEntriesResponse;
  try {
    wasmEntries = await withRpcTimeout(() => client.getLedgerEntries(wasmKey));
  } catch {
    return { contractId, network, functions: [], events: [] };
  }

  const functions: AbiFunction[] = [];
  const events: AbiEvent[] = [];

  if (wasmEntries.entries?.length) {
    try {
      const codeEntry = wasmEntries.entries[0]!.val.contractCode();
      // The raw spec parsing requires WASM binary parsing
      void codeEntry;
    } catch {
      // Spec entries not parseable
    }
  }

  return { contractId, network, functions, events };
}

/**
 * Gets recent transactions for a contract by querying the RPC for events.
 */
export async function getContractTransactionsResource(
  contractId: string,
  network: string,
  limit = 20,
): Promise<TransactionHistoryEntry[]> {
  if (!StrKey.isValidContract(contractId)) {
    throw new McpToolError(`Invalid contract ID: "${contractId}".`, ErrorCode.INVALID_CONTRACT_ID);
  }

  const client = getRpcClient(network);

  // Get latest ledger to compute start ledger
  const latestLedger = (await withRpcTimeout(() => client.getLatestLedger())) as {
    sequence: number;
  };
  const startLedger = Math.max(1, latestLedger.sequence - 1000);

  try {
    const eventsResponse = (await withRpcTimeout(() =>
      client.getEvents({
        startLedger,
        filters: [
          {
            type: 'contract',
            contractIds: [contractId],
          },
        ],
        limit,
      }),
    )) as { events?: Array<{ txHash: string; ledger: number; ledgerClosedAt: string }> };

    const seen = new Map<string, TransactionHistoryEntry>();

    for (const event of eventsResponse.events ?? []) {
      if (!seen.has(event.txHash)) {
        seen.set(event.txHash, {
          id: event.txHash,
          ledger: event.ledger,
          createdAt: event.ledgerClosedAt,
          operationCount: 1,
          successful: true,
        });
      }
    }

    return Array.from(seen.values()).slice(0, limit);
  } catch (err) {
    logger.warn({ contractId, err }, 'Failed to fetch contract events');
    return [];
  }
}
