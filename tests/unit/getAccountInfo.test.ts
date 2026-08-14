import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAccountInfo, GetAccountInfoInputSchema } from '../../src/tools/getAccountInfo.js';
import { ErrorCode, McpToolError } from '../../src/lib/errors.js';

vi.mock('../../src/lib/rpc.js', () => ({
  getHorizonClient: vi.fn(),
  withRpcTimeout: vi.fn((fn: () => unknown) => fn()),
}));

import { getHorizonClient } from '../../src/lib/rpc.js';
const mockGetHorizonClient = vi.mocked(getHorizonClient);

const VALID_PUBLIC_KEY = 'GCC37XKWCPJG5POXS4PXMJAR2TPXWA2SLZRZFJ536Q6QG23RBTRI37RH';

const mockAccountData = {
  id: VALID_PUBLIC_KEY,
  balances: [
    { asset_type: 'native', balance: '100.0000000' },
    {
      asset_type: 'credit_alphanum4',
      asset_code: 'USDC',
      asset_issuer: 'GABC...',
      balance: '50.0000000',
    },
  ],
  sequenceNumber: (): string => '12345678',
  subentry_count: 2,
  thresholds: { low_threshold: 0, med_threshold: 0, high_threshold: 0 },
  signers: [{ key: VALID_PUBLIC_KEY, type: 'ed25519_public_key', weight: 1 }],
  last_modified_ledger: 4000000,
};

describe('getAccountInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('input validation', () => {
    it('rejects an invalid public key', () => {
      const result = GetAccountInfoInputSchema.safeParse({ public_key: 'INVALID' });
      expect(result.success).toBe(false);
    });

    it('rejects a key that is too short', () => {
      const result = GetAccountInfoInputSchema.safeParse({ public_key: 'GABC' });
      expect(result.success).toBe(false);
    });

    it('accepts a valid public key', () => {
      const result = GetAccountInfoInputSchema.safeParse({ public_key: VALID_PUBLIC_KEY });
      expect(result.success).toBe(true);
    });

    it('defaults network to testnet', () => {
      const result = GetAccountInfoInputSchema.safeParse({ public_key: VALID_PUBLIC_KEY });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.network).toBe('testnet');
    });
  });

  describe('successful fetch', () => {
    it('returns structured account info', async () => {
      const mockHorizon = { loadAccount: vi.fn().mockResolvedValue(mockAccountData) };
      mockGetHorizonClient.mockReturnValue(
        mockHorizon as unknown as ReturnType<typeof getHorizonClient>,
      );

      const result = await getAccountInfo({ public_key: VALID_PUBLIC_KEY, network: 'testnet' });

      expect(result.publicKey).toBe(VALID_PUBLIC_KEY);
      expect(result.network).toBe('testnet');
      expect(result.sequenceNumber).toBe('12345678');
      expect(result.balances).toHaveLength(2);
      expect(result.balances[0]).toEqual({ asset: 'XLM (native)', balance: '100.0000000' });
      expect(result.balances[1]).toEqual({ asset: 'USDC:GABC...', balance: '50.0000000' });
      expect(result.signers).toHaveLength(1);
    });
  });

  describe('error handling', () => {
    it('throws ACCOUNT_NOT_FOUND for 404 errors', async () => {
      const mockHorizon = {
        loadAccount: vi
          .fn()
          .mockRejectedValue(new Error('Request failed with status 404 not found')),
      };
      mockGetHorizonClient.mockReturnValue(
        mockHorizon as unknown as ReturnType<typeof getHorizonClient>,
      );

      const error = await getAccountInfo({
        public_key: VALID_PUBLIC_KEY,
        network: 'testnet',
      }).catch((e) => e);

      expect(error).toBeInstanceOf(McpToolError);
      expect((error as McpToolError).code).toBe(ErrorCode.ACCOUNT_NOT_FOUND);
      expect((error as McpToolError).message).toContain('friendbot');
    });

    it('re-throws unexpected errors', async () => {
      const mockHorizon = {
        loadAccount: vi.fn().mockRejectedValue(new Error('Connection refused')),
      };
      mockGetHorizonClient.mockReturnValue(
        mockHorizon as unknown as ReturnType<typeof getHorizonClient>,
      );

      await expect(
        getAccountInfo({ public_key: VALID_PUBLIC_KEY, network: 'testnet' }),
      ).rejects.toThrow('Connection refused');
    });
  });
});
