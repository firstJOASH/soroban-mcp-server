/**
 * Integration tests — run against real testnet.
 *
 * Gated behind INTEGRATION=true so CI skips them by default.
 * Run locally with:
 *   INTEGRATION=true npm run test:integration
 */
import { describe, it, expect, beforeAll } from 'vitest';

const INTEGRATION = process.env.INTEGRATION === 'true';

const skip = INTEGRATION ? it : it.skip;

// Well-known funded testnet account for read-only tests
const TESTNET_ACCOUNT = 'GCC37XKWCPJG5POXS4PXMJAR2TPXWA2SLZRZFJ536Q6QG23RBTRI37RH';

describe('Integration: getAccountInfo (testnet)', () => {
  beforeAll(() => {
    if (!INTEGRATION) {
      // eslint-disable-next-line no-console
      console.log('Skipping integration tests. Set INTEGRATION=true to run.');
    }
  });

  skip('fetches a real testnet account', async () => {
    const { getAccountInfo } = await import('../../src/tools/getAccountInfo.js');
    const result = await getAccountInfo({ public_key: TESTNET_ACCOUNT, network: 'testnet' });

    expect(result.publicKey).toBe(TESTNET_ACCOUNT);
    expect(result.network).toBe('testnet');
    expect(result.balances.length).toBeGreaterThan(0);
    expect(result.sequenceNumber).toBeTruthy();
  });

  skip('throws for a nonexistent account', async () => {
    const { getAccountInfo } = await import('../../src/tools/getAccountInfo.js');
    const { McpToolError, ErrorCode } = await import('../../src/lib/errors.js');

    // All-zeros account is very unlikely to exist
    const fakeKey = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
    const err = await getAccountInfo({ public_key: fakeKey, network: 'testnet' }).catch((e) => e);
    expect(err).toBeInstanceOf(McpToolError);
    expect(err.code).toBe(ErrorCode.ACCOUNT_NOT_FOUND);
  });
});

describe('Integration: network status resource (testnet)', () => {
  skip('returns a positive ledger sequence', async () => {
    const { getNetworkStatusResource } = await import('../../src/resources/index.js');
    const status = await getNetworkStatusResource('testnet');

    expect(status.status).toBe('healthy');
    expect(status.latestLedger).toBeGreaterThan(0);
  });
});
