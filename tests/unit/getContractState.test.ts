import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getContractState, GetContractStateInputSchema } from '../../src/tools/getContractState.js';
import { ErrorCode, McpToolError } from '../../src/lib/errors.js';

vi.mock('../../src/lib/rpc.js', () => ({
  getRpcClient: vi.fn(),
  withRpcTimeout: vi.fn((fn: () => unknown) => fn()),
}));

import { getRpcClient } from '../../src/lib/rpc.js';
const mockGetRpcClient = vi.mocked(getRpcClient);

// A valid 56-char contract ID starting with C
const VALID_CONTRACT_ID = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4';

describe('getContractState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('input validation', () => {
    it('rejects an invalid contract ID', () => {
      const result = GetContractStateInputSchema.safeParse({
        contract_id: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN',
      });
      expect(result.success).toBe(false);
    });

    it('rejects a short string', () => {
      const result = GetContractStateInputSchema.safeParse({ contract_id: 'C123' });
      expect(result.success).toBe(false);
    });

    it('defaults limit to 50', () => {
      const result = GetContractStateInputSchema.safeParse({ contract_id: VALID_CONTRACT_ID });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.limit).toBe(50);
    });

    it('rejects limit above 100', () => {
      const result = GetContractStateInputSchema.safeParse({
        contract_id: VALID_CONTRACT_ID,
        limit: 200,
      });
      expect(result.success).toBe(false);
    });

    it('accepts valid durability filter', () => {
      for (const dur of ['persistent', 'instance', 'temporary']) {
        const result = GetContractStateInputSchema.safeParse({
          contract_id: VALID_CONTRACT_ID,
          durability: dur,
        });
        expect(result.success).toBe(true);
      }
    });
  });

  describe('error handling', () => {
    it('throws CONTRACT_NOT_FOUND when RPC returns no entries', async () => {
      const mockClient = {
        getLedgerEntries: vi.fn().mockResolvedValue({ entries: [] }),
      };
      mockGetRpcClient.mockReturnValue(mockClient as unknown as ReturnType<typeof getRpcClient>);

      const error = await getContractState({
        contract_id: VALID_CONTRACT_ID,
        network: 'testnet',
        limit: 50,
      }).catch((e) => e);

      expect(error).toBeInstanceOf(McpToolError);
      expect((error as McpToolError).code).toBe(ErrorCode.CONTRACT_NOT_FOUND);
    });

    it('throws CONTRACT_NOT_FOUND on 404-style RPC error', async () => {
      const mockClient = {
        getLedgerEntries: vi.fn().mockRejectedValue(new Error('not found')),
      };
      mockGetRpcClient.mockReturnValue(mockClient as unknown as ReturnType<typeof getRpcClient>);

      const error = await getContractState({
        contract_id: VALID_CONTRACT_ID,
        network: 'testnet',
        limit: 50,
      }).catch((e) => e);

      expect(error).toBeInstanceOf(McpToolError);
      expect((error as McpToolError).code).toBe(ErrorCode.CONTRACT_NOT_FOUND);
    });
  });
});
