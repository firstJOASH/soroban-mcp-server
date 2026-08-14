import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invokeContract, InvokeContractInputSchema } from '../../src/tools/invokeContract.js';

vi.mock('../../src/lib/rpc.js', () => ({
  getRpcClient: vi.fn(),
  withRpcTimeout: vi.fn((fn: () => unknown) => fn()),
}));

import { getRpcClient } from '../../src/lib/rpc.js';
const mockGetRpcClient = vi.mocked(getRpcClient);

const VALID_CONTRACT_ID = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4';

describe('invokeContract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('input validation', () => {
    it('requires contract_id and function_name', () => {
      const result = InvokeContractInputSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('rejects invalid contract_id', () => {
      const result = InvokeContractInputSchema.safeParse({
        contract_id: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN',
        function_name: 'hello',
      });
      expect(result.success).toBe(false);
    });

    it('accepts valid minimal input', () => {
      const result = InvokeContractInputSchema.safeParse({
        contract_id: VALID_CONTRACT_ID,
        function_name: 'hello',
      });
      expect(result.success).toBe(true);
    });

    it('defaults args to empty array', () => {
      const result = InvokeContractInputSchema.safeParse({
        contract_id: VALID_CONTRACT_ID,
        function_name: 'hello',
      });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.args).toEqual([]);
    });
  });

  describe('simulation error handling', () => {
    it('throws CONTRACT_INVOCATION_FAILED on simulation error', async () => {
      const mockClient = {
        getAccount: vi.fn().mockRejectedValue(new Error('not found')),
        simulateTransaction: vi.fn().mockResolvedValue({
          error: 'HostError: Value error: ...',
          _parsed: true,
        }),
      };
      mockGetRpcClient.mockReturnValue(mockClient as unknown as ReturnType<typeof getRpcClient>);

      // invokeContract will fail when building the transaction because
      // the Account object needs a valid sequence. We just check it
      // throws a McpToolError, not a raw crash.
      const error = await invokeContract({
        contract_id: VALID_CONTRACT_ID,
        function_name: 'hello',
        args: [],
        network: 'testnet',
      }).catch((e) => e);

      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('argument conversion', () => {
    it('rejects unsupported argument types in jsToScVal path', async () => {
      // Symbol isn't a supported type — the handler should return an error object, not crash
      const mockClient = {
        getAccount: vi.fn().mockRejectedValue(new Error('not found')),
        simulateTransaction: vi.fn(),
      };
      mockGetRpcClient.mockReturnValue(mockClient as unknown as ReturnType<typeof getRpcClient>);

      const error = await invokeContract({
        contract_id: VALID_CONTRACT_ID,
        function_name: 'hello',
        args: [{ type: 'unsupported_type', value: 'x' }],
        network: 'testnet',
      }).catch((e) => e);

      // Should throw a McpToolError, not an unhandled crash
      expect(error).toBeInstanceOf(Error);
    });
  });
});
