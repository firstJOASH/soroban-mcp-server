# Quick Start Guide

Get the Soroban MCP server running in 5 minutes.

---

## Prerequisites

- **Node.js ≥ 20**: `node --version`
- **Stellar CLI** (for build/deploy tools): `cargo install --locked stellar-cli --features opt`

---

## Installation

### Option 1: Run directly with npx (Recommended)

```bash
npx soroban-mcp-server
```

### Option 2: Install globally

```bash
npm install -g soroban-mcp-server
soroban-mcp-server
```

### Option 3: Install from source

```bash
git clone https://github.com/yourusername/soroban-mcp-server
cd soroban-mcp-server
npm install
npm run build
npm start
```

---

## Configuration

The server reads configuration from environment variables:

| Variable | Options | Default |
|---|---|---|
| `STELLAR_NETWORK` | `testnet`, `futurenet`, `mainnet` | `testnet` |
| `RPC_URL` | Any valid RPC endpoint | Network default |
| `SOROBAN_CLI_PATH` | Path to stellar-cli binary | `stellar` |
| `LOG_LEVEL` | `debug`, `info`, `warn`, `error` | `info` |

**Example:**

```bash
STELLAR_NETWORK=testnet LOG_LEVEL=debug npx soroban-mcp-server
```

---

## Using with MCP Clients

### Claude Desktop

1. **Locate your Claude Desktop config file:**
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
   - Linux: `~/.config/Claude/claude_desktop_config.json`

2. **Add the Soroban server:**

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

3. **Restart Claude Desktop**

4. **Test it:**
   - "What Soroban tools are available?"
   - "Get account info for GABC..."
   - "What's the current testnet ledger height?"

### Other MCP Clients

The server implements the standard MCP protocol and works with any compatible client:

```bash
# Generic MCP client configuration
{
  "command": "npx",
  "args": ["soroban-mcp-server"],
  "transport": "stdio"
}
```

---

## Available Tools

Once connected, the following tools are available:

| Tool | Description | Example Use |
|---|---|---|
| `build_contract` | Build a Soroban project | "Build the contract in ./my-token" |
| `run_tests` | Run contract tests | "Run the tests in ./my-token" |
| `deploy_contract` | Deploy to testnet/futurenet | "Deploy ./target/wasm32.../contract.wasm to testnet" |
| `invoke_contract` | Call a contract function | "Call the `balance` function on contract CXXX with address GABC" |
| `get_contract_state` | Read contract storage | "Show me the storage for contract CXXX" |
| `get_account_info` | Get account details | "Check the balance of account GABC" |

---

## Example Workflow

Here's a complete contract development flow using an MCP client:

```
You: "Build the contract in ./contracts/my-token"
→ build_contract runs, returns structured diagnostics

You: "Run the tests"
→ run_tests runs, shows 10/10 tests passing

You: "Deploy it to testnet using account alice"
→ deploy_contract runs, returns contract ID: CXXX...

You: "Get the contract state"
→ get_contract_state shows storage entries

You: "Invoke the balance function with my address GABC..."
→ invoke_contract simulates the call, returns balance and resource cost
```

The agent handles all tool invocations automatically — you just describe what you want to do in natural language.

---

## Troubleshooting

### "stellar CLI not found"

```bash
# Install stellar-cli
cargo install --locked stellar-cli --features opt

# Or specify custom path
SOROBAN_CLI_PATH=/path/to/stellar npx soroban-mcp-server
```

### "Connection timeout" or "Network unreachable"

```bash
# Use a custom RPC endpoint
RPC_URL=https://your-rpc-endpoint.com npx soroban-mcp-server
```

### "Account not found"

For testnet accounts, fund them first:
```
https://friendbot.stellar.org/?addr=GABC...
```

### Server won't start

```bash
# Check Node.js version (must be ≥ 20)
node --version

# Reinstall dependencies
npm install -g soroban-mcp-server

# Run with debug logging
LOG_LEVEL=debug npx soroban-mcp-server
```

---

## Next Steps

- Read the [full README](./README.md) for detailed documentation
- See [CONTRIBUTING.md](./CONTRIBUTING.md) to contribute
- Check out [example configurations](./examples/)
- Report issues on [GitHub](https://github.com/yourusername/soroban-mcp-server/issues)

---

**Ready to build!** 🚀
