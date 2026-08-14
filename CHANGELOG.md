# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-08-14

### Added
- Initial release of `soroban-mcp-server`
- `build_contract` tool — builds a Soroban project and returns structured compiler diagnostics
- `run_tests` tool — runs `cargo test` and returns a structured pass/fail report
- `get_account_info` tool — fetches balance, sequence number, and signers for a Stellar account
- `get_contract_state` tool — reads persistent/instance/temporary storage entries for a contract
- `deploy_contract` tool — deploys a compiled `.wasm` to testnet or futurenet via the Stellar CLI
- `invoke_contract` tool — simulates a contract function call and returns the result + resource cost
- Network status, contract ABI, and transaction history resources
- Centralized error mapping with actionable messages for all known failure modes
- Zod input validation for every tool with clear agent-readable validation errors
- Structured logging via pino
- Config via environment variables (`STELLAR_NETWORK`, `RPC_URL`, `SOROBAN_CLI_PATH`, `LOG_LEVEL`)
- Unit tests for all tool handlers with mocked network/CLI calls
- Integration test suite (gated behind `INTEGRATION=true`)
- GitHub Actions CI: lint, typecheck, unit tests on every PR
- Issue templates: bug report, feature request, new tool proposal
- MIT License
- CONTRIBUTING.md

[Unreleased]: https://github.com/your-org/soroban-mcp-server/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/your-org/soroban-mcp-server/releases/tag/v0.1.0
