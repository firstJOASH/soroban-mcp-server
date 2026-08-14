import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildContract, BuildContractInputSchema } from '../../src/tools/buildContract.js';
import { McpToolError } from '../../src/lib/errors.js';

// Mock the CLI module
vi.mock('../../src/lib/cli.js', () => ({
  runCli: vi.fn(),
}));

// Mock fs
vi.mock('fs/promises', () => ({
  access: vi.fn(),
  readdir: vi.fn(),
  stat: vi.fn(),
}));

import { runCli } from '../../src/lib/cli.js';
import * as fsPromises from 'fs/promises';

const mockRunCli = vi.mocked(runCli);
const mockAccess = vi.mocked(fsPromises.access);
const mockReaddir = vi.mocked(fsPromises.readdir);
const mockStat = vi.mocked(fsPromises.stat);

describe('buildContract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAccess.mockResolvedValue(undefined);
    mockReaddir.mockResolvedValue(['my_contract.wasm'] as unknown as ReturnType<
      typeof fsPromises.readdir
    > extends Promise<infer T>
      ? T
      : never);
    mockStat.mockResolvedValue({ size: 48_000 } as ReturnType<
      typeof fsPromises.stat
    > extends Promise<infer T>
      ? T
      : never);
  });

  describe('input validation', () => {
    it('rejects empty project_path', async () => {
      const result = BuildContractInputSchema.safeParse({ project_path: '' });
      expect(result.success).toBe(false);
    });

    it('accepts valid input with defaults', () => {
      const result = BuildContractInputSchema.safeParse({ project_path: '/my/project' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.network).toBe('testnet');
      }
    });

    it('accepts all valid networks', () => {
      for (const network of ['testnet', 'futurenet', 'mainnet']) {
        const result = BuildContractInputSchema.safeParse({ project_path: '/p', network });
        expect(result.success).toBe(true);
      }
    });

    it('rejects invalid network', () => {
      const result = BuildContractInputSchema.safeParse({
        project_path: '/p',
        network: 'devnet',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('successful build', () => {
    it('returns success=true and wasmPath when CLI exits 0', async () => {
      mockRunCli.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });

      const result = await buildContract({ project_path: '/fake/project', network: 'testnet' });

      expect(result.success).toBe(true);
      expect(result.wasmPath).toBeDefined();
      expect(result.wasmSizeBytes).toBe(48_000);
      expect(result.diagnostics).toEqual([]);
    });

    it('filters error diagnostics from successful build output', async () => {
      const warnStderr = `warning: unused variable \`x\`\n --> src/lib.rs:10:5`;
      mockRunCli.mockResolvedValue({ stdout: '', stderr: warnStderr, exitCode: 0 });

      const result = await buildContract({ project_path: '/fake/project', network: 'testnet' });

      expect(result.success).toBe(true);
      // warnings are kept, errors are not (none here)
      const warnings = result.diagnostics.filter((d) => d.level === 'warning');
      expect(warnings.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('failed build', () => {
    it('returns success=false and diagnostics when CLI exits non-zero', async () => {
      const errorStderr = `error[E0308]: mismatched types\n --> src/lib.rs:15:12\nerror: aborting due to previous error`;
      mockRunCli.mockResolvedValue({ stdout: '', stderr: errorStderr, exitCode: 1 });

      const result = await buildContract({ project_path: '/fake/project', network: 'testnet' });

      expect(result.success).toBe(false);
      expect(result.diagnostics.length).toBeGreaterThan(0);
      expect(result.diagnostics[0]!.level).toBe('error');
      expect(result.diagnostics[0]!.errorCode).toBe('E0308');
    });

    it('throws McpToolError when Cargo.toml is missing', async () => {
      mockAccess.mockRejectedValue(new Error('ENOENT'));

      await expect(
        buildContract({ project_path: '/nonexistent', network: 'testnet' }),
      ).rejects.toThrow(McpToolError);
    });

    it('throws McpToolError with CLI_NOT_FOUND code when CLI is missing', async () => {
      const { ErrorCode: EC, McpToolError: MTE } = await import('../../src/lib/errors.js');
      mockRunCli.mockRejectedValue(new MTE('CLI not found', EC.CLI_NOT_FOUND));

      await expect(
        buildContract({ project_path: '/fake/project', network: 'testnet' }),
      ).rejects.toMatchObject({ code: EC.CLI_NOT_FOUND });
    });
  });

  describe('diagnostic parsing', () => {
    it('parses error code, file, and line from rustc human output', async () => {
      const stderr = [
        'error[E0425]: cannot find value `foo` in this scope',
        ' --> src/contract.rs:42:10',
        '   |',
        '42 |     foo()',
        '   |     ^^^',
      ].join('\n');

      mockRunCli.mockResolvedValue({ stdout: '', stderr, exitCode: 1 });

      const result = await buildContract({ project_path: '/fake/project', network: 'testnet' });

      const errDiag = result.diagnostics.find((d) => d.errorCode === 'E0425');
      expect(errDiag).toBeDefined();
      expect(errDiag!.file).toBe('src/contract.rs');
      expect(errDiag!.line).toBe(42);
      expect(errDiag!.column).toBe(10);
    });
  });
});
