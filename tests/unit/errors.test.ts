import { describe, it, expect } from 'vitest';
import { mapError, formatToolError, McpToolError, ErrorCode } from '../../src/lib/errors.js';

describe('errors', () => {
  describe('mapError', () => {
    it('returns the same McpToolError if already mapped', () => {
      const err = new McpToolError('already mapped', ErrorCode.BUILD_FAILED);
      expect(mapError(err)).toBe(err);
    });

    it('maps ENOENT for soroban CLI to CLI_NOT_FOUND', () => {
      const err = new Error('ENOENT: command not found: soroban');
      const mapped = mapError(err);
      expect(mapped.code).toBe(ErrorCode.CLI_NOT_FOUND);
      expect(mapped.message).toContain('stellar-cli');
    });

    it('maps ECONNREFUSED to NETWORK_TIMEOUT', () => {
      const err = new Error('ECONNREFUSED 127.0.0.1:8000');
      const mapped = mapError(err);
      expect(mapped.code).toBe(ErrorCode.NETWORK_TIMEOUT);
    });

    it('maps "insufficient balance" to INSUFFICIENT_BALANCE', () => {
      const err = new Error('Error: account has insufficient balance');
      const mapped = mapError(err);
      expect(mapped.code).toBe(ErrorCode.INSUFFICIENT_BALANCE);
      expect(mapped.message).toContain('friendbot');
    });

    it('maps "invalid contract id" to INVALID_CONTRACT_ID', () => {
      const err = new Error('invalid contract id provided');
      const mapped = mapError(err);
      expect(mapped.code).toBe(ErrorCode.INVALID_CONTRACT_ID);
    });

    it('maps "account not found" to ACCOUNT_NOT_FOUND', () => {
      const err = new Error('account not found on network');
      const mapped = mapError(err);
      expect(mapped.code).toBe(ErrorCode.ACCOUNT_NOT_FOUND);
    });

    it('maps rustc error[EXXXX] to BUILD_FAILED', () => {
      const err = new Error('error[E0308]: mismatched types');
      const mapped = mapError(err);
      expect(mapped.code).toBe(ErrorCode.BUILD_FAILED);
    });

    it('falls back to UNKNOWN for unrecognised errors', () => {
      const err = new Error('some completely random message');
      const mapped = mapError(err);
      expect(mapped.code).toBe(ErrorCode.UNKNOWN);
    });

    it('handles non-Error thrown values', () => {
      const mapped = mapError('just a string error');
      expect(mapped).toBeInstanceOf(McpToolError);
      expect(mapped.code).toBe(ErrorCode.UNKNOWN);
    });
  });

  describe('formatToolError', () => {
    it('returns {error, code} shape', () => {
      const err = new McpToolError('something broke', ErrorCode.RPC_ERROR, { extra: 1 });
      const formatted = formatToolError(err);
      expect(formatted.error).toBe('something broke');
      expect(formatted.code).toBe(ErrorCode.RPC_ERROR);
      expect(formatted.details).toEqual({ extra: 1 });
    });

    it('does not include details when none are set', () => {
      const err = new McpToolError('oops', ErrorCode.UNKNOWN);
      const formatted = formatToolError(err);
      expect('details' in formatted).toBe(false);
    });
  });
});
