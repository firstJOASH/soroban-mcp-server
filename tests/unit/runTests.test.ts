import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runTests, RunTestsInputSchema } from '../../src/tools/runTests.js';
import { McpToolError } from '../../src/lib/errors.js';

vi.mock('fs/promises', () => ({
  access: vi.fn(),
}));

const mockExecFile = vi.fn();

vi.mock('child_process', () => ({
  execFile: mockExecFile,
}));

vi.mock('util', () => ({
  promisify:
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (fn: any) =>
      // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
      (...args: unknown[]) => {
        return new Promise((resolve, reject) => {
          (
            fn as (
              ...args: [...unknown[], (err: unknown, stdout: string, stderr: string) => void]
            ) => void
          )(...args, (err: unknown, stdout: string, stderr: string) => {
            if (err) reject(Object.assign(err as object, { stdout, stderr }));
            else resolve({ stdout, stderr });
          });
        });
      },
}));

import * as fsPromises from 'fs/promises';
const mockAccess = vi.mocked(fsPromises.access);

describe('runTests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAccess.mockResolvedValue(undefined);
  });

  describe('input validation', () => {
    it('rejects empty project_path', () => {
      const result = RunTestsInputSchema.safeParse({ project_path: '' });
      expect(result.success).toBe(false);
    });

    it('accepts valid input', () => {
      const result = RunTestsInputSchema.safeParse({ project_path: '/my/project' });
      expect(result.success).toBe(true);
    });

    it('accepts optional filter', () => {
      const result = RunTestsInputSchema.safeParse({ project_path: '/p', filter: 'test_hello' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.filter).toBe('test_hello');
    });
  });

  describe('output parsing', () => {
    it('parses all-passing tests correctly', async () => {
      const stdout = [
        'running 3 tests',
        'test test_add ... ok',
        'test test_subtract ... ok',
        'test test_multiply ... ok',
        'test result: ok. 3 passed; 0 failed; 0 ignored; 0 measured',
      ].join('\n');

      mockExecFile.mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (_cmd: string, _args: string[], _opts: unknown, cb: any) => cb(null, stdout, ''),
      );

      const result = await runTests({ project_path: '/fake/project' });

      expect(result.success).toBe(true);
      expect(result.total).toBe(3);
      expect(result.passed).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.ignored).toBe(0);
    });

    it('parses failing tests and captures failure messages', async () => {
      const stdout = [
        'running 2 tests',
        'test test_ok ... ok',
        'test test_bad ... FAILED',
        '',
        'failures:',
        '',
        '---- test_bad stdout ----',
        "thread 'test_bad' panicked at 'assertion failed: 1 == 2', src/lib.rs:20:5",
        '',
        'test result: FAILED. 1 passed; 1 failed; 0 ignored',
      ].join('\n');

      mockExecFile.mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (_cmd: string, _args: string[], _opts: unknown, cb: any) => {
          const err = Object.assign(new Error('exit'), { stdout, stderr: '', code: 1 });
          cb(err, stdout, '');
        },
      );

      const result = await runTests({ project_path: '/fake/project' });

      expect(result.success).toBe(false);
      expect(result.failed).toBe(1);
      expect(result.passed).toBe(1);

      const failedTest = result.tests.find((t) => t.name === 'test_bad');
      expect(failedTest).toBeDefined();
      expect(failedTest!.status).toBe('failed');
      expect(failedTest!.message).toContain('assertion failed');
    });

    it('handles ignored tests', async () => {
      const stdout = [
        'running 2 tests',
        'test test_run ... ok',
        'test test_skip ... ignored',
        'test result: ok. 1 passed; 0 failed; 1 ignored',
      ].join('\n');

      mockExecFile.mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (_cmd: string, _args: string[], _opts: unknown, cb: any) => cb(null, stdout, ''),
      );

      const result = await runTests({ project_path: '/fake/project' });

      expect(result.ignored).toBe(1);
      expect(result.success).toBe(true);
    });

    it('returns success=false with rawOutput when cargo fails to compile', async () => {
      const stderr = 'error[E0308]: mismatched types\n --> src/lib.rs:10:5';

      mockExecFile.mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (_cmd: string, _args: string[], _opts: unknown, cb: any) => {
          const err = Object.assign(new Error('exit'), { stdout: '', stderr, code: 1 });
          cb(err, '', stderr);
        },
      );

      const result = await runTests({ project_path: '/fake/project' });

      expect(result.success).toBe(false);
      expect(result.total).toBe(0);
      expect(result.rawOutput).toBeDefined();
    });

    it('throws McpToolError when Cargo.toml is missing', async () => {
      mockAccess.mockRejectedValue(new Error('ENOENT'));
      await expect(runTests({ project_path: '/nonexistent' })).rejects.toThrow(McpToolError);
    });
  });
});
