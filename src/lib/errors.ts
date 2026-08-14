/**
 * Centralized error mapping for Soroban/Stellar failure modes.
 * Never lets raw stack traces or cryptic messages reach the agent.
 */

export class McpToolError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'McpToolError';
  }
}

export const enum ErrorCode {
  // Build/compile errors
  BUILD_FAILED = 'BUILD_FAILED',
  WASM_NOT_FOUND = 'WASM_NOT_FOUND',
  INVALID_WASM = 'INVALID_WASM',

  // Network errors
  NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
  NETWORK_UNREACHABLE = 'NETWORK_UNREACHABLE',
  RPC_ERROR = 'RPC_ERROR',

  // Contract errors
  INVALID_CONTRACT_ID = 'INVALID_CONTRACT_ID',
  CONTRACT_NOT_FOUND = 'CONTRACT_NOT_FOUND',
  CONTRACT_INVOCATION_FAILED = 'CONTRACT_INVOCATION_FAILED',
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',

  // Account errors
  ACCOUNT_NOT_FOUND = 'ACCOUNT_NOT_FOUND',
  INVALID_PUBLIC_KEY = 'INVALID_PUBLIC_KEY',

  // CLI errors
  CLI_NOT_FOUND = 'CLI_NOT_FOUND',
  CLI_EXECUTION_FAILED = 'CLI_EXECUTION_FAILED',

  // Test errors
  TEST_EXECUTION_FAILED = 'TEST_EXECUTION_FAILED',

  // Generic
  UNKNOWN = 'UNKNOWN',
}

interface ErrorPattern {
  pattern: RegExp;
  code: ErrorCode;
  message: (match: RegExpMatchArray) => string;
}

const ERROR_PATTERNS: ErrorPattern[] = [
  {
    pattern: /ENOENT.*soroban|command not found.*soroban|command not found.*stellar/i,
    code: ErrorCode.CLI_NOT_FOUND,
    message: () =>
      'Soroban/Stellar CLI not found. Install it with: cargo install --locked stellar-cli --features opt',
  },
  {
    pattern: /ECONNREFUSED|ETIMEDOUT|ENOTFOUND|network timeout/i,
    code: ErrorCode.NETWORK_TIMEOUT,
    message: () =>
      'Network request timed out or connection was refused. Check your RPC_URL and network connectivity.',
  },
  {
    pattern: /contract not found|no contract deployed/i,
    code: ErrorCode.CONTRACT_NOT_FOUND,
    message: (m) => `Contract not found: ${m[0]}. Verify the contract ID and network.`,
  },
  {
    pattern: /insufficient balance|account has insufficient/i,
    code: ErrorCode.INSUFFICIENT_BALANCE,
    message: () =>
      'Insufficient balance to complete the transaction. Fund the account at https://friendbot.stellar.org',
  },
  {
    pattern: /invalid contract id|invalid strkey/i,
    code: ErrorCode.INVALID_CONTRACT_ID,
    message: () =>
      'Invalid contract ID format. Contract IDs are 56-character strings starting with "C".',
  },
  {
    pattern: /account not found|no account found/i,
    code: ErrorCode.ACCOUNT_NOT_FOUND,
    message: () => 'Account not found on the network. The account may not be funded yet.',
  },
  {
    pattern: /error\[e\d+\]/i,
    code: ErrorCode.BUILD_FAILED,
    message: () =>
      'Rust compilation failed. See the diagnostics field for structured error details.',
  },
];

export function mapError(error: unknown): McpToolError {
  if (error instanceof McpToolError) return error;

  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? (error.stack ?? '') : '';
  const fullText = `${message}\n${stack}`;

  for (const { pattern, code, message: msgFn } of ERROR_PATTERNS) {
    const match = fullText.match(pattern);
    if (match) {
      return new McpToolError(msgFn(match), code, { originalMessage: message });
    }
  }

  return new McpToolError(`An unexpected error occurred: ${message}`, ErrorCode.UNKNOWN, {
    originalMessage: message,
  });
}

export function formatToolError(error: unknown): {
  error: string;
  code: string;
  details?: Record<string, unknown>;
} {
  const mapped = mapError(error);
  return {
    error: mapped.message,
    code: mapped.code,
    ...(mapped.details ? { details: mapped.details } : {}),
  };
}
