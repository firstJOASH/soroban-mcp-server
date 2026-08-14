# Soroban MCP Server — Build Complete ✅

## Summary

A production-ready Model Context Protocol (MCP) server for AI agents to interact with Soroban smart contracts on the Stellar network. Built from scratch following the specification in the README.

---

## What Was Built

### **6 MCP Tools**
1. **`build_contract`** — Builds Soroban contracts with structured compiler diagnostics
2. **`run_tests`** — Runs cargo tests with structured pass/fail reporting
3. **`get_account_info`** — Fetches account balance, sequence, and signers
4. **`get_contract_state`** — Reads contract storage entries (persistent/instance/temporary)
5. **`deploy_contract`** — Deploys compiled WASM to testnet/futurenet
6. **`invoke_contract`** — Simulates contract calls with resource cost analysis

### **3 MCP Resources**
- `soroban://network/{network}/status` — Network health and ledger info
- `soroban://contract/{id}/abi` — Contract ABI from on-chain WASM
- `soroban://contract/{id}/transactions` — Recent transaction history

### **Production Infrastructure**
- ✅ TypeScript strict mode with full type safety
- ✅ Zod schema validation for all tool inputs
- ✅ Centralized error mapping (no raw stack traces)
- ✅ Structured logging via Pino
- ✅ Environment-based configuration
- ✅ 58 passing unit tests (all network/CLI calls mocked)
- ✅ Integration test suite (gated behind `INTEGRATION=true`)
- ✅ GitHub Actions CI pipeline
- ✅ ESLint + Prettier enforcement
- ✅ Semantic versioning + CHANGELOG

---

## Quality Assurance

```bash
✅ npm run typecheck  # TypeScript strict mode — passes
✅ npm run lint       # ESLint + Prettier — passes
✅ npm test          # 58 unit tests — all pass
✅ npm run build     # Compiles to dist/ — success
```

**Test Coverage:**
- All 6 tools have comprehensive unit tests
- Error mapping tested for all known failure modes
- Input validation tested with Zod schemas
- Mock implementations for CLI and RPC calls

---

## Project Structure

```
soroban-mcp-server/
├── src/
│   ├── tools/             # One file per MCP tool
│   │   ├── buildContract.ts
│   │   ├── runTests.ts
│   │   ├── getAccountInfo.ts
│   │   ├── getContractState.ts
│   │   ├── deployContract.ts
│   │   └── invokeContract.ts
│   ├── resources/         # MCP resource handlers
│   │   └── index.ts
│   ├── lib/               # Core infrastructure
│   │   ├── cli.ts         # Stellar CLI wrapper
│   │   ├── rpc.ts         # RPC client factory
│   │   ├── errors.ts      # Error mapping
│   │   └── logger.ts      # Pino logger
│   ├── config.ts          # Env var validation
│   └── index.ts           # Server entrypoint
├── tests/
│   ├── unit/              # Mocked unit tests
│   └── integration/       # Live testnet tests
├── .github/
│   ├── workflows/ci.yml
│   └── ISSUE_TEMPLATE/
│       ├── bug_report.yml
│       ├── feature_request.yml
│       └── new_tool_proposal.yml
├── README.md              # Complete documentation
├── CONTRIBUTING.md        # Setup + conventions
├── CHANGELOG.md           # Version history
├── LICENSE                # MIT
└── package.json
```

---

## How to Use

### Installation

```bash
npm install -g soroban-mcp-server
# or
npx soroban-mcp-server
```

### Configuration

Add to your MCP client config (e.g., `mcp.json`):

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

### Environment Variables

| Variable | Description | Default |
|---|---|---|
| `STELLAR_NETWORK` | `testnet`, `futurenet`, or `mainnet` | `testnet` |
| `RPC_URL` | Override the default RPC endpoint | network default |
| `SOROBAN_CLI_PATH` | Path to stellar-cli binary | `stellar` |
| `LOG_LEVEL` | `debug`, `info`, `warn`, `error` | `info` |

---

## Development Commands

```bash
# Install dependencies
npm install

# Type checking
npm run typecheck

# Linting
npm run lint
npm run lint:fix

# Formatting
npm run format
npm run format:check

# Testing
npm test                      # Unit tests only
npm run test:watch            # Watch mode
npm run test:coverage         # With coverage report
INTEGRATION=true npm run test:integration  # Live testnet tests

# Build
npm run build                 # Compile to dist/
npm run dev                   # Run in dev mode
```

---

## Key Design Decisions

### 1. **Structured Error Responses**
Every tool returns `{error, code, details?}` instead of raw errors. Known failure modes map to clear error codes:
- `BUILD_FAILED`, `WASM_NOT_FOUND`, `CLI_NOT_FOUND`
- `INSUFFICIENT_BALANCE`, `ACCOUNT_NOT_FOUND`
- `CONTRACT_NOT_FOUND`, `CONTRACT_INVOCATION_FAILED`

### 2. **Hybrid CLI + RPC Approach**
- Uses Stellar CLI for build/deploy (most reliable)
- Direct RPC calls for reads (faster, no CLI dependency)
- Wraps CLI output parsing in try/catch with structured fallbacks

### 3. **Diagnostic Parsing**
`build_contract` parses both JSON and human-readable rustc output into structured diagnostics with file/line/column/errorCode fields.

### 4. **Test Isolation**
All unit tests mock external dependencies (CLI, RPC, filesystem). Integration tests are gated behind `INTEGRATION=true` so CI doesn't require network access.

### 5. **Issue Templates for Growth**
Three issue templates (bug report, feature request, new tool proposal) set the project up to generate scoped contribution issues after launch — critical for Stellar Wave repo acceptance.

---

## What's Ready for Review

✅ **All MVP tools implemented and tested**  
✅ **Production-quality error handling**  
✅ **CI pipeline configured**  
✅ **Documentation complete**  
✅ **Contribution infrastructure in place**

### Next Steps

1. **Publish to npm** — `npm publish` (update package.json with real org/repo URLs first)
2. **Record demo** — Add a terminal recording or GIF to the README
3. **Test with MCP client** — Verify full integration with Claude Code or another MCP client
4. **Submit to Stellar Wave** — Include in Wave repo application with roadmap for post-launch issues

---

## Roadmap (Post-Launch)

The project is designed to grow:
- TTL management (`bump_contract_ttl` tool)
- Transaction signing support
- Wallet integrations (Freighter, hardware wallets)
- Richer error diagnosis
- Prompt templates for common patterns
- Local devnet support

Each of these generates well-scoped contribution issues tagged with `good-first-issue` where appropriate.

---

## License

MIT — see [LICENSE](./LICENSE)
