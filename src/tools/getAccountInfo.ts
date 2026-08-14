import { z } from 'zod';
import { StrKey } from '@stellar/stellar-sdk';
import { getHorizonClient, withRpcTimeout } from '../lib/rpc.js';
import { logger } from '../lib/logger.js';
import { ErrorCode, McpToolError, formatToolError } from '../lib/errors.js';

export const GetAccountInfoInputSchema = z.object({
  public_key: z
    .string()
    .min(56)
    .max(56)
    .refine((k) => StrKey.isValidEd25519PublicKey(k), {
      message: 'Must be a valid Stellar public key (G...)',
    })
    .describe('Stellar account public key (starts with G)'),
  network: z
    .enum(['testnet', 'futurenet', 'mainnet'])
    .default('testnet')
    .describe('Network to query'),
});

export type GetAccountInfoInput = z.infer<typeof GetAccountInfoInputSchema>;

export interface AccountSigner {
  key: string;
  type: string;
  weight: number;
}

export interface GetAccountInfoResult {
  publicKey: string;
  network: string;
  balances: Array<{
    asset: string;
    balance: string;
  }>;
  sequenceNumber: string;
  subentryCount: number;
  thresholds: {
    lowThreshold: number;
    medThreshold: number;
    highThreshold: number;
  };
  signers: AccountSigner[];
  lastModifiedLedger: number;
}

export async function getAccountInfo(
  input: z.infer<typeof GetAccountInfoInputSchema>,
): Promise<GetAccountInfoResult> {
  const parsed = GetAccountInfoInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new McpToolError(
      `Invalid input: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')}`,
      ErrorCode.INVALID_PUBLIC_KEY,
    );
  }

  const { public_key, network } = parsed.data;
  logger.info({ publicKey: public_key, network }, 'Fetching account info');

  const horizon = getHorizonClient(network);

  let account: Awaited<ReturnType<typeof horizon.loadAccount>>;
  try {
    account = await withRpcTimeout(() => horizon.loadAccount(public_key));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('404') || message.includes('not found')) {
      throw new McpToolError(
        `Account ${public_key} not found on ${network}. It may not be funded yet. ` +
          `For testnet, fund it at https://friendbot.stellar.org/?addr=${public_key}`,
        ErrorCode.ACCOUNT_NOT_FOUND,
        { publicKey: public_key, network },
      );
    }
    throw err;
  }

  const balances = account.balances.map((b) => {
    if (b.asset_type === 'native') {
      return { asset: 'XLM (native)', balance: b.balance };
    }
    const assetCode = 'asset_code' in b ? b.asset_code : 'unknown';
    const assetIssuer = 'asset_issuer' in b ? b.asset_issuer : 'unknown';
    return { asset: `${assetCode}:${assetIssuer}`, balance: b.balance };
  });

  const signers: AccountSigner[] = account.signers.map((s) => ({
    key: s.key,
    type: s.type,
    weight: s.weight,
  }));

  return {
    publicKey: public_key,
    network,
    balances,
    sequenceNumber: account.sequenceNumber(),
    subentryCount: account.subentry_count,
    thresholds: {
      lowThreshold: account.thresholds.low_threshold,
      medThreshold: account.thresholds.med_threshold,
      highThreshold: account.thresholds.high_threshold,
    },
    signers,
    lastModifiedLedger: account.last_modified_ledger,
  };
}

export async function getAccountInfoHandler(
  rawInput: unknown,
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  try {
    const input = GetAccountInfoInputSchema.parse(rawInput);
    const result = await getAccountInfo(input);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    return { content: [{ type: 'text', text: JSON.stringify(formatToolError(err), null, 2) }] };
  }
}
