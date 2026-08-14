import { z } from 'zod';
import type { rpc } from '@stellar/stellar-sdk';
import { xdr, StrKey } from '@stellar/stellar-sdk';
import { getRpcClient, withRpcTimeout } from '../lib/rpc.js';
import { logger } from '../lib/logger.js';
import { ErrorCode, McpToolError, formatToolError } from '../lib/errors.js';

export const GetContractStateInputSchema = z.object({
  contract_id: z
    .string()
    .min(56)
    .max(56)
    .refine((id) => StrKey.isValidContract(id), {
      message: 'Must be a valid Stellar contract ID (starts with C)',
    })
    .describe('Contract ID (56-character string starting with C)'),
  network: z
    .enum(['testnet', 'futurenet', 'mainnet'])
    .default('testnet')
    .describe('Network to query'),
  durability: z
    .enum(['persistent', 'instance', 'temporary'])
    .optional()
    .describe('Filter storage entries by durability type (omit to return all)'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(50)
    .describe('Maximum number of storage entries to return'),
});

export type GetContractStateInput = z.infer<typeof GetContractStateInputSchema>;

export interface StorageEntry {
  key: string;
  value: string;
  durability: 'persistent' | 'instance' | 'temporary';
  liveUntilLedger: number | undefined;
}

export interface GetContractStateResult {
  contractId: string;
  network: string;
  entries: StorageEntry[];
  totalEntries: number;
  truncated: boolean;
}

function scValToString(val: xdr.ScVal): string {
  try {
    // Try to get a human-readable representation
    switch (val.switch().name) {
      case 'scvBool':
        return String(val.b());
      case 'scvU32':
        return String(val.u32());
      case 'scvI32':
        return String(val.i32());
      case 'scvU64':
        return String(val.u64());
      case 'scvI64':
        return String(val.i64());
      case 'scvString':
        return val.str().toString();
      case 'scvSymbol':
        return val.sym().toString();
      case 'scvAddress': {
        const addr = val.address();
        if (addr.switch().name === 'scAddressTypeAccount') {
          return StrKey.encodeEd25519PublicKey(addr.accountId().ed25519());
        }
        return StrKey.encodeContract(addr.contractId());
      }
      case 'scvBytes':
        return '0x' + Buffer.from(val.bytes()).toString('hex');
      default:
        // Fall back to XDR base64 for complex types
        return val.toXDR('base64');
    }
  } catch {
    return val.toXDR('base64');
  }
}

export async function getContractState(
  input: GetContractStateInput,
): Promise<GetContractStateResult> {
  const parsed = GetContractStateInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new McpToolError(
      `Invalid input: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')}`,
      ErrorCode.INVALID_CONTRACT_ID,
    );
  }

  const { contract_id, network, durability, limit } = parsed.data;
  logger.info({ contractId: contract_id, network, durability }, 'Fetching contract state');

  const client = getRpcClient(network);

  // Build the contract data keys to fetch
  // We use getLedgerEntries to read storage
  const contractAddress = xdr.ScAddress.scAddressTypeContract(StrKey.decodeContract(contract_id));

  // Fetch instance storage first (always present if contract exists)
  const instanceKey = xdr.LedgerKey.contractData(
    new xdr.LedgerKeyContractData({
      contract: contractAddress,
      key: xdr.ScVal.scvLedgerKeyContractInstance(),
      durability: xdr.ContractDataDurability.persistent(),
    }),
  );

  let instanceResponse: rpc.Api.GetLedgerEntriesResponse;
  try {
    instanceResponse = await withRpcTimeout(() => client.getLedgerEntries(instanceKey));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('not found') || message.includes('404')) {
      throw new McpToolError(
        `Contract ${contract_id} not found on ${network}. Verify the contract ID.`,
        ErrorCode.CONTRACT_NOT_FOUND,
        { contractId: contract_id, network },
      );
    }
    throw err;
  }

  if (!instanceResponse.entries || instanceResponse.entries.length === 0) {
    throw new McpToolError(
      `Contract ${contract_id} not found on ${network}. It may not be deployed yet.`,
      ErrorCode.CONTRACT_NOT_FOUND,
      { contractId: contract_id, network },
    );
  }

  const entries: StorageEntry[] = [];

  // Parse the instance data entry
  for (const entry of instanceResponse.entries) {
    const data = entry.val.contractData();
    const keyStr = scValToString(data.key());
    const valStr = scValToString(data.val());

    // instance storage has key scvLedgerKeyContractInstance
    entries.push({
      key: keyStr,
      value: valStr,
      durability: 'instance',
      liveUntilLedger: entry.liveUntilLedgerSeq,
    });

    // If this is the instance entry, it may contain storage fields
    if (data.key().switch().name === 'scvLedgerKeyContractInstance') {
      try {
        const instance = data.val().instance();
        const storage = instance.storage();
        if (storage) {
          for (const mapEntry of storage) {
            if (entries.length >= limit) break;
            entries.push({
              key: scValToString(mapEntry.key()),
              value: scValToString(mapEntry.val()),
              durability: 'instance',
              liveUntilLedger: entry.liveUntilLedgerSeq,
            });
          }
        }
      } catch {
        // Not an instance entry or no storage
      }
    }
  }

  const filtered = durability ? entries.filter((e) => e.durability === durability) : entries;
  const truncated = filtered.length >= limit;

  return {
    contractId: contract_id,
    network,
    entries: filtered.slice(0, limit),
    totalEntries: filtered.length,
    truncated,
  };
}

export async function getContractStateHandler(
  rawInput: unknown,
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  try {
    const input = GetContractStateInputSchema.parse(rawInput);
    const result = await getContractState(input);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    return { content: [{ type: 'text', text: JSON.stringify(formatToolError(err), null, 2) }] };
  }
}
