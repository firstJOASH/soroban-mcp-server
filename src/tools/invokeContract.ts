import { z } from 'zod';
import {
  rpc,
  TransactionBuilder,
  Networks,
  Contract,
  StrKey,
  nativeToScVal,
  scValToNative,
  xdr,
  Account,
} from '@stellar/stellar-sdk';
import { getRpcClient, withRpcTimeout } from '../lib/rpc.js';
import { NETWORK_PASSPHRASE } from '../config.js';
import { logger } from '../lib/logger.js';
import { ErrorCode, McpToolError, formatToolError } from '../lib/errors.js';

export const InvokeContractInputSchema = z.object({
  contract_id: z
    .string()
    .min(56)
    .max(56)
    .refine((id) => StrKey.isValidContract(id), {
      message: 'Must be a valid Stellar contract ID (starts with C)',
    })
    .describe('Contract ID (56-character string starting with C)'),
  function_name: z.string().min(1).describe('Name of the contract function to call'),
  args: z
    .array(z.unknown())
    .default([])
    .describe(
      'Arguments to pass to the function. Supported types: number, string, boolean, ' +
        'or objects with {type: "address"|"bytes", value: string}',
    ),
  network: z
    .enum(['testnet', 'futurenet', 'mainnet'])
    .default('testnet')
    .describe('Network to invoke on'),
  source_account: z
    .string()
    .optional()
    .describe(
      'Source account public key for simulation (not required for read-only calls). ' +
        'Defaults to a zero-balance account for simulation.',
    ),
});

export type InvokeContractInput = z.infer<typeof InvokeContractInputSchema>;

export interface ResourceCost {
  cpuInstructions: number;
  memoryBytes: number;
  /** Minimum fee in stroops */
  minFee: string;
}

export interface InvokeContractResult {
  success: boolean;
  result: unknown | undefined;
  resultXdr: string | undefined;
  resourceCost: ResourceCost | undefined;
  network: string;
  contractId: string;
  functionName: string;
}

/**
 * Converts a JS value to an xdr.ScVal for contract invocation.
 */
function jsToScVal(value: unknown): xdr.ScVal {
  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? nativeToScVal(BigInt(value), { type: 'i128' })
      : nativeToScVal(value);
  }
  if (typeof value === 'string') return nativeToScVal(value, { type: 'string' });
  if (typeof value === 'boolean') return nativeToScVal(value);
  if (value === null || value === undefined) return xdr.ScVal.scvVoid();

  // Object with explicit type hint
  if (typeof value === 'object' && !Array.isArray(value)) {
    const typed = value as Record<string, unknown>;
    if (typed['type'] === 'address' && typeof typed['value'] === 'string') {
      const addr = typed['value'] as string;
      if (StrKey.isValidEd25519PublicKey(addr)) {
        return nativeToScVal(addr, { type: 'address' });
      }
      if (StrKey.isValidContract(addr)) {
        return nativeToScVal(addr, { type: 'address' });
      }
    }
    if (typed['type'] === 'bytes' && typeof typed['value'] === 'string') {
      const BufferGlobal = (globalThis as typeof globalThis & { Buffer: typeof Buffer }).Buffer;
      return nativeToScVal(BufferGlobal.from(typed['value'] as string, 'hex'), {
        type: 'bytes',
      });
    }
    if (typed['type'] === 'u32' && typeof typed['value'] === 'number') {
      return nativeToScVal(typed['value'] as number, { type: 'u32' });
    }
    if (typed['type'] === 'i128' && typeof typed['value'] === 'string') {
      return nativeToScVal(BigInt(typed['value'] as string), { type: 'i128' });
    }
  }

  if (Array.isArray(value)) {
    return xdr.ScVal.scvVec(value.map(jsToScVal));
  }

  throw new McpToolError(
    `Unsupported argument type: ${typeof value}. Supported: number, string, boolean, ` +
      `{type: "address", value: "G..."}, {type: "bytes", value: "hex..."}, {type: "i128", value: "bigint_string"}`,
    ErrorCode.CONTRACT_INVOCATION_FAILED,
  );
}

// A dummy account for simulation when no source is provided
const DUMMY_SOURCE = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN';

export async function invokeContract(input: InvokeContractInput): Promise<InvokeContractResult> {
  const parsed = InvokeContractInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new McpToolError(
      `Invalid input: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')}`,
      ErrorCode.CONTRACT_INVOCATION_FAILED,
    );
  }

  const { contract_id, function_name, args, network, source_account } = parsed.data;
  logger.info(
    { contractId: contract_id, functionName: function_name, network },
    'Invoking contract',
  );

  const client = getRpcClient(network);
  const passphrase = NETWORK_PASSPHRASE[network] ?? Networks.TESTNET;

  // Convert args
  let scArgs: xdr.ScVal[];
  try {
    scArgs = (args as unknown[]).map(jsToScVal);
  } catch (err) {
    if (err instanceof McpToolError) throw err;
    throw new McpToolError(
      `Failed to convert arguments: ${err instanceof Error ? err.message : String(err)}`,
      ErrorCode.CONTRACT_INVOCATION_FAILED,
    );
  }

  const sourceKey = source_account ?? DUMMY_SOURCE;

  // Load source account for sequence number
  let sourceAccount: Account;
  try {
    sourceAccount = await withRpcTimeout(() => client.getAccount(sourceKey));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('404') || message.includes('not found')) {
      // Use dummy sequence for simulation
      sourceAccount = new Account(sourceKey, '0');
    } else {
      throw err;
    }
  }

  const contract = new Contract(contract_id);

  const tx = new TransactionBuilder(sourceAccount, {
    fee: '100',
    networkPassphrase: passphrase,
  })
    .addOperation(contract.call(function_name, ...scArgs))
    .setTimeout(30)
    .build();

  // Simulate the transaction (works for both read and write, gives us resource costs)
  let simResult: rpc.Api.SimulateTransactionResponse;
  try {
    simResult = await withRpcTimeout(() => client.simulateTransaction(tx));
  } catch (err) {
    throw new McpToolError(
      `Failed to simulate contract invocation: ${err instanceof Error ? err.message : String(err)}`,
      ErrorCode.CONTRACT_INVOCATION_FAILED,
    );
  }

  if (rpc.Api.isSimulationError(simResult)) {
    const errMsg = simResult.error ?? 'Unknown simulation error';
    throw new McpToolError(
      `Contract invocation simulation failed: ${errMsg}`,
      ErrorCode.CONTRACT_INVOCATION_FAILED,
      { contractId: contract_id, functionName: function_name, simulationError: errMsg },
    );
  }

  if (rpc.Api.isSimulationRestore(simResult)) {
    throw new McpToolError(
      `Contract state needs restoration before this function can be called. ` +
        `The contract's state has expired. Re-deploy or bump the TTL.`,
      ErrorCode.CONTRACT_INVOCATION_FAILED,
      { contractId: contract_id },
    );
  }

  const successSim = simResult as rpc.Api.SimulateTransactionSuccessResponse;

  // Extract result
  let resultValue: unknown = null;
  let resultXdr: string | undefined;

  if (successSim.result) {
    try {
      const retVal = xdr.ScVal.fromXDR(successSim.result.retval.toXDR());
      resultValue = scValToNative(retVal);
      resultXdr = successSim.result.retval.toXDR('base64');
    } catch {
      resultXdr = successSim.result.retval.toXDR('base64');
    }
  }

  // Extract resource cost
  let resourceCost: ResourceCost | undefined;
  if ('cost' in successSim && successSim.cost) {
    const cost = successSim.cost as { cpuInsns: string; memBytes: string };
    resourceCost = {
      cpuInstructions: Number(cost.cpuInsns),
      memoryBytes: Number(cost.memBytes),
      minFee: successSim.minResourceFee ?? '0',
    };
  }

  logger.info(
    { contractId: contract_id, functionName: function_name, resourceCost },
    'Contract invocation simulated successfully',
  );

  return {
    success: true,
    result: resultValue,
    resultXdr,
    resourceCost,
    network,
    contractId: contract_id,
    functionName: function_name,
  };
}

export async function invokeContractHandler(
  rawInput: unknown,
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  try {
    const input = InvokeContractInputSchema.parse(rawInput);
    const result = await invokeContract(input);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    return { content: [{ type: 'text', text: JSON.stringify(formatToolError(err), null, 2) }] };
  }
}
