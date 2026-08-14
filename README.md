# Soroban MCP Server

An MCP (Model Context Protocol) server that gives AI coding agents direct, structured access to Soroban smart contracts and the Stellar network — so agents can build, test, deploy, and inspect contracts without shelling out blindly to the CLI and parsing raw text output.

> **Demo:** *(drop a terminal recording or gif here once you have a working build)*

---

## Why this exists

AI coding agents are increasingly used to write and debug smart contracts, but today they either guess at CLI syntax or parse unstructured terminal output to decide whether a build succeeded, what a contract's state looks like, or why a deployment failed.

This server exposes those operations as typed, validated MCP tools with structured results and clear error messages — making agent-assisted Soroban development faster and more reliable.

---

## Features

| Tool | Description |
|---|---|
| `build_contract` | Builds a Soroban project; returns structured compiler diagnostics (file, line, error code, message) |
| `run_tests` | Runs `cargo test`; returns a structured pass/fail report with failure messages |
| `deploy_contract` | Deploys a compiled `.wasm` to testnet or futurenet |
| `invoke_contract` | Simulates a contract function call; returns result + resource cost (CPU, memory, fee) |
| `get_contract_state` | Reads a contract's persistent/instance/temporary storage entries |
| `get_account_info` | Returns balance, sequence number, and signers for a Stellar account |

**Resources exposed:**
- `soroban://network/{network}/status` — current ledger height and health
- `soroban://contract/{id}/abi` — contract ABI/spec from on-chain WASM metadata
- `soroban://contract/{id}/transactions` — recent transaction history

---

## Installation

```bash
npm install -g soroban-mcp-server
```

Or run directly without installing:

```bash
npx soroban-mcp-server
```

**Prerequisites:**
- Node.js ≥ 20
- [stellar-cli](https://github.com/stellar/stellar-cli) on your `PATH` (required for `build_contract` and `deploy_contract`)

---

## Configuration

Add to your MCP client config (e.g. Claude Code's `mcp.json`):

```json
{
  "mcpServers": {
    "soroban": {
      "command": "npx",
      "args": ["soroban-mcp-server"],
      "env": {
        "STELLAR_NETWORK": "testnet"
      }
    }
  }
}
```

| Env var | Description | Default |
|---|---|---|
| `STELLAR_NETWORK` | `testnet`, `futurenet`, or `mainnet` (read-only ops only on mainnet) | `testnet` |
| `RPC_URL` | Override the default RPC endpoint | network default |
| `SOROBAN_CLI_PATH` | Path to the Soroban/Stellar CLI binary | `stellar` |
| `LOG_LEVEL` | `debug`, `info`, `warn`, `error` | `info` |

---

## Usage example

Once connected to your MCP client, an agent can run a full build-test-deploy cycle:

> *"Build this contract, run the tests, and if they pass, deploy it to testnet and give me the contract ID."*

The agent calls `build_contract` → `run_tests` → `deploy_contract` in sequence, using the structured output of each step to decide whether to proceed — without you needing to copy-paste terminal output back and forth.

### Tool call examples

**Build a contract:**
```json
{
  "tool": "build_contract",
  "arguments": { "project_path": "./contracts/my_token" }
}
```

**Run tests with a filter:**
```json
{
  "tool": "run_tests",
  "arguments": { "project_path": "./contracts/my_token", "filter": "test_transfer" }
}
```

**Check an account:**
```json
{
  "tool": "get_account_info",
  "arguments": { "public_key": "GABC...", "network": "testnet" }
}
```

**Invoke a contract function:**
```json
{
  "tool": "invoke_contract",
  "arguments": {
    "contract_id": "CXXX...",
    "function_name": "balance",
    "args": [{ "type": "address", "value": "GABC..." }],
    "network": "testnet"
  }
}
```

---

## Error handling

Every tool returns structured errors with a `code` field instead of raw stack traces:

```json
{
  "error": "Insufficient balance to complete the transaction. Fund the account at https://friendbot.stellar.org",
  "code": "INSUFFICIENT_BALANCE"
}
```

Known error codes: `BUILD_FAILED`, `WASM_NOT_FOUND`, `INVALID_WASM`, `NETWORK_TIMEOUT`, `NETWORK_UNREACHABLE`, `RPC_ERROR`, `INVALID_CONTRACT_ID`, `CONTRACT_NOT_FOUND`, `CONTRACT_INVOCATION_FAILED`, `INSUFFICIENT_BALANCE`, `ACCOUNT_NOT_FOUND`, `INVALID_PUBLIC_KEY`, `CLI_NOT_FOUND`, `CLI_EXECUTION_FAILED`, `TEST_EXECUTION_FAILED`.

---

## Development

```bash
git clone https://github.com/your-org/soroban-mcp-server
cd soroban-mcp-server
npm install

npm run typecheck   # TypeScript strict check
npm run lint        # ESLint
npm test            # Unit tests (all network/CLI calls mocked)

# Live testnet integration tests (requires network access)
INTEGRATION=true npm run test:integration
```

---

## Roadmap

This project is built to grow alongside the Soroban ecosystem. Planned areas of expansion (and a source of ongoing, scoped contribution issues):

- **TTL management** — `bump_contract_ttl` tool to extend contract state lifetimes
- **Signing support** — submit state-changing transactions, not just simulate them
- **Additional wallets/signers** — Freighter, hardware wallets
- **Richer error diagnosis** — new failure modes as the protocol evolves
- **Prompt templates** — common contract patterns (token, escrow, multisig)
- **Local devnet support** — `quickstart` Docker integration for offline development

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Issues are labeled by scope and complexity — issues tagged `good-first-issue` are a great place to start.

---

## License

[MIT](./LICENSE)
