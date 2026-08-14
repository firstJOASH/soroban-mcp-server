# Contributing to soroban-mcp-server

Thanks for your interest in contributing. This document covers everything you need to get started.

## Table of contents

- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Project structure](#project-structure)
- [Development workflow](#development-workflow)
- [Coding conventions](#coding-conventions)
- [Adding a new tool](#adding-a-new-tool)
- [Commit style](#commit-style)
- [Opening a pull request](#opening-a-pull-request)

---

## Prerequisites

- **Node.js ≥ 20** — [nodejs.org](https://nodejs.org)
- **npm ≥ 10**
- **Rust + cargo** — [rustup.rs](https://rustup.rs) (needed to run integration tests against real contracts)
- **stellar-cli** — `cargo install --locked stellar-cli --features opt` (needed for `build_contract` and `deploy_contract`)

## Setup

```bash
git clone https://github.com/your-org/soroban-mcp-server
cd soroban-mcp-server
npm install
```

Verify everything works:

```bash
npm run typecheck
npm run lint
npm test
```

## Project structure

```
src/
  tools/          One file per MCP tool. Each exports:
                    - A Zod input schema (named <ToolName>InputSchema)
                    - A handler function (named <toolName>Handler)
                    - The core logic function (named <toolName>)
  resources/      MCP resource implementations
  lib/
    cli.ts        Stellar/Soroban CLI wrapper
    rpc.ts        RPC/Horizon client factories
    errors.ts     Centralized error mapping
    logger.ts     Pino logger instance
  config.ts       Environment variable loading and validation
  index.ts        Server entrypoint — registers tools/resources with the MCP SDK

tests/
  unit/           Unit tests (all network/CLI calls mocked)
  integration/    Live testnet tests (gated behind INTEGRATION=true)
```

## Development workflow

```bash
# Run unit tests in watch mode
npm run test:watch

# Run the server locally (uses stdio transport)
npm run dev

# Build
npm run build

# Run integration tests (requires testnet connectivity)
INTEGRATION=true npm run test:integration
```

## Coding conventions

- **TypeScript strict mode** — no `any`, no implicit returns, no unused variables.
- **Every tool must have a Zod schema** — validation errors must be clear and agent-readable.
- **Never let raw stack traces reach the agent** — all errors must go through `formatToolError` (which calls `mapError`).
- **Structured logging** — use `logger.info/warn/error` from `src/lib/logger.ts`, never `console.log`.
- **Mocked unit tests** — every tool handler must have unit tests with all network/CLI calls mocked via Vitest.
- **One file per tool** — keep `src/tools/` flat and consistent.
- Prettier + ESLint are enforced in CI. Run `npm run format` and `npm run lint:fix` before pushing.

## Adding a new tool

1. Create `src/tools/myNewTool.ts` following the pattern of an existing tool:
   - Export a Zod schema named `MyNewToolInputSchema`
   - Export a core async function `myNewTool(input)`
   - Export a handler `myNewToolHandler(rawInput)` that calls `formatToolError` on failure
2. Register the tool in `src/index.ts`:
   - Add it to the `ListToolsRequestSchema` handler (with full description and input schema)
   - Add it to the `CallToolRequestSchema` switch statement
3. Write unit tests in `tests/unit/myNewTool.test.ts` — mock all external calls
4. Update `CHANGELOG.md` under `[Unreleased]`

Use the [New Tool Proposal](.github/ISSUE_TEMPLATE/new_tool_proposal.yml) issue template
to discuss a tool before implementing it, if the scope is non-trivial.

## Commit style

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add bump_contract_ttl tool
fix: handle empty WASM output in build_contract
docs: add integration test instructions to CONTRIBUTING
chore: bump @stellar/stellar-sdk to 14.x
```

## Opening a pull request

1. Fork the repo and create a branch from `main`: `git checkout -b feat/my-feature`
2. Make your changes, write tests, verify everything passes locally
3. Open a PR against `main` — fill in the PR description template
4. CI must be green before merging
5. At least one review is required for all non-trivial changes

Issues labeled `good-first-issue` are a great place to start.
