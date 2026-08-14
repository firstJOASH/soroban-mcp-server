import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deployContract, DeployContractInputSchema } from '../../src/tools/deployContract.js';
import { ErrorCode, McpToolError } from '../../src/lib/errors.js';

vi.mock('../../src/lib/cli.js', () => ({
  runCli: vi.fn(),
}));

vi.mock('fs/promises', () => ({
  stat: vi.fn(),
}));

import { runCli } from '../../src/lib/cli.js';
import * as fsPromises from 'fs/promises';

const mockRunCli = vi.mocked(runCli);
const mockStat = vi.mocked(fsPromises.stat);

describe('deployContract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStat.mockResolvedValue({ size: 50_000 } as ReturnType<
      typeof fsPromises.stat
    > extends Promise<infer T>
      ? T
      : never);
  });

  describe('input validation', () => {
    it('rejects mainnet as target network', () => {
      const result = DeployContractInputSchema.safeParse({
        wasm_path: '/path/to/contract.wasm',
        network: 'mainnet',
        source_account: 'SXXX',
      });
      expect(result.success).toBe(false);
    });

    it('requires source_account', () => {
      const result = DeployContractInputSchema.safeParse({
        wasm_path: '/path/to/contract.wasm',
        network: 'testnet',
      });
      expect(result.success).toBe(false);
    });

    it('accepts valid testnet deploy input', () => {
      const result = DeployContractInputSchema.safeParse({
        wasm_path: '/path/to/contract.wasm',
        network: 'testnet',
        source_account: 'SXXXXX',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('pre-flight checks', () => {
    it('throws WASM_NOT_FOUND when file does not exist', async () => {
      mockStat.mockRejectedValue(new Error('ENOENT: no such file or directory'));

      const error = await deployContract({
        wasm_path: '/missing/contract.wasm',
        network: 'testnet',
        source_account: 'SXXX',
        ignore_checks: false,
      }).catch((e) => e);

      expect(error).toBeInstanceOf(McpToolError);
      expect((error as McpToolError).code).toBe(ErrorCode.WASM_NOT_FOUND);
    });

    it('throws INVALID_WASM for a zero-byte file', async () => {
      mockStat.mockResolvedValue({ size: 0 } as ReturnType<typeof fsPromises.stat> extends Promise<
        infer T
      >
        ? T
        : never);

      const error = await deployContract({
        wasm_path: '/empty/contract.wasm',
        network: 'testnet',
        source_account: 'SXXX',
        ignore_checks: false,
      }).catch((e) => e);

      expect(error).toBeInstanceOf(McpToolError);
      expect((error as McpToolError).code).toBe(ErrorCode.INVALID_WASM);
    });

    it('throws INVALID_WASM for non-.wasm extension', async () => {
      const error = await deployContract({
        wasm_path: '/path/to/contract.txt',
        network: 'testnet',
        source_account: 'SXXX',
        ignore_checks: false,
      }).catch((e) => e);

      expect(error).toBeInstanceOf(McpToolError);
      expect((error as McpToolError).code).toBe(ErrorCode.INVALID_WASM);
    });
  });

  describe('successful deployment', () => {
    it('returns contractId parsed from CLI stdout', async () => {
      const contractId = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4';
      mockRunCli.mockResolvedValue({
        stdout: `${contractId}\n`,
        stderr:
          'Transaction hash: abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890\n',
        exitCode: 0,
      });

      const result = await deployContract({
        wasm_path: '/valid/contract.wasm',
        network: 'testnet',
        source_account: 'SXXX',
        ignore_checks: false,
      });

      expect(result.success).toBe(true);
      expect(result.contractId).toBe(contractId);
      expect(result.transactionHash).toBe(
        'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      );
    });
  });

  describe('CLI failure handling', () => {
    it('throws INSUFFICIENT_BALANCE on balance error', async () => {
      mockRunCli.mockResolvedValue({
        stdout: '',
        stderr: 'Error: insufficient balance for fee',
        exitCode: 1,
      });

      const error = await deployContract({
        wasm_path: '/valid/contract.wasm',
        network: 'testnet',
        source_account: 'SXXX',
        ignore_checks: false,
      }).catch((e) => e);

      expect(error).toBeInstanceOf(McpToolError);
      expect((error as McpToolError).code).toBe(ErrorCode.INSUFFICIENT_BALANCE);
    });

    it('throws CLI_EXECUTION_FAILED on generic failure', async () => {
      mockRunCli.mockResolvedValue({
        stdout: '',
        stderr: 'Some unknown CLI error',
        exitCode: 1,
      });

      const error = await deployContract({
        wasm_path: '/valid/contract.wasm',
        network: 'testnet',
        source_account: 'SXXX',
        ignore_checks: false,
      }).catch((e) => e);

      expect(error).toBeInstanceOf(McpToolError);
      expect((error as McpToolError).code).toBe(ErrorCode.CLI_EXECUTION_FAILED);
    });
  });
});
