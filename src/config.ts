import { z } from 'zod';

const NetworkSchema = z.enum(['testnet', 'futurenet', 'mainnet']).default('testnet');

const ConfigSchema = z.object({
  STELLAR_NETWORK: NetworkSchema,
  RPC_URL: z.string().url().optional(),
  SOROBAN_CLI_PATH: z.string().default('stellar'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

function loadConfig(): z.infer<typeof ConfigSchema> {
  const raw = {
    STELLAR_NETWORK: process.env['STELLAR_NETWORK'],
    RPC_URL: process.env['RPC_URL'],
    SOROBAN_CLI_PATH: process.env['SOROBAN_CLI_PATH'],
    LOG_LEVEL: process.env['LOG_LEVEL'],
  };

  const result = ConfigSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `Invalid configuration:\n${result.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n')}`,
    );
  }
  return result.data;
}

export const config = loadConfig();

export const NETWORK_RPC_URLS: Record<string, string> = {
  testnet: 'https://soroban-testnet.stellar.org',
  futurenet: 'https://rpc-futurenet.stellar.org',
  mainnet: 'https://mainnet.stellar.validationcloud.io/v1/xycl56tk4GMLf-PxsMHmwQ',
};

export const NETWORK_PASSPHRASE: Record<string, string> = {
  testnet: 'Test SDF Network ; September 2015',
  futurenet: 'Test SDF Future Network ; October 2022',
  mainnet: 'Public Global Stellar Network ; September 2015',
};

export function getRpcUrl(network: string): string {
  return config.RPC_URL ?? NETWORK_RPC_URLS[network] ?? NETWORK_RPC_URLS['testnet']!;
}

export type StellarNetwork = z.infer<typeof NetworkSchema>;
