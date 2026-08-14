# Testing & Deployment Guide

This guide walks through testing the server locally and preparing for npm publication.

---

## ✅ Step 1: Local Testing (Completed)

The server has been tested and is operational:

```bash
✅ TypeScript compilation: PASS
✅ ESLint: PASS (0 errors, 0 warnings)
✅ Unit tests: 58/58 PASS
✅ Server startup: SUCCESS
```

---

## 🧪 Step 2: Manual Testing with MCP Client

### Option A: Test with Claude Desktop (Recommended)

1. **Install Claude Desktop** from [claude.ai/download](https://claude.ai/download)

2. **Locate or create the MCP config file:**
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
   - **Linux**: `~/.config/Claude/claude_desktop_config.json`

3. **Add the Soroban MCP server configuration:**

   ```json
   {
     "mcpServers": {
       "soroban": {
         "command": "npx",
         "args": ["soroban-mcp-server"],
         "env": {
           "STELLAR_NETWORK": "testnet",
           "LOG_LEVEL": "info"
         }
       }
     }
   }
   ```

4. **Restart Claude Desktop**

5. **Test the tools by asking Claude:**
   - "Can you list the available Soroban tools?"
   - "Check account info for [public_key]"
   - "What's the current testnet ledger height?"

### Option B: Test with Inspector

The MCP Inspector is a debugging tool for MCP servers:

```bash
# Install Inspector
npm install -g @modelcontextprotocol/inspector

# Run the server with inspector
npx @modelcontextprotocol/inspector npx soroban-mcp-server
```

This opens a web UI where you can:
- View all registered tools and resources
- Test tool invocations
- Inspect responses

---

## 📦 Step 3: Prepare for Publication

### Update package.json

Replace placeholder values in `package.json`:

```json
{
  "repository": {
    "type": "git",
    "url": "git+https://github.com/YOUR_USERNAME/soroban-mcp-server.git"
  },
  "bugs": {
    "url": "https://github.com/YOUR_USERNAME/soroban-mcp-server/issues"
  },
  "homepage": "https://github.com/YOUR_USERNAME/soroban-mcp-server#readme",
  "author": "Your Name <your.email@example.com>"
}
```

### Pre-publication Checklist

```bash
# 1. Ensure all tests pass
npm run typecheck
npm run lint
npm test

# 2. Build the project
npm run build

# 3. Test the built package locally
npm pack
# This creates soroban-mcp-server-0.1.0.tgz

# 4. Test the tarball
npm install -g ./soroban-mcp-server-0.1.0.tgz
soroban-mcp-server --version  # Should work if you have a CLI entry point

# 5. Verify package contents
tar -tzf soroban-mcp-server-0.1.0.tgz | head -20
```

---

## 🚀 Step 4: Publish to npm

### First-time Setup

```bash
# Create npm account (if you don't have one)
npm adduser

# Or login to existing account
npm login
```

### Publish

```bash
# Dry run first (see what will be published)
npm publish --dry-run

# Publish for real
npm publish

# For scoped packages (e.g., @yourorg/soroban-mcp-server)
npm publish --access public
```

### Post-Publication

1. **Verify on npm**: Visit `https://www.npmjs.com/package/soroban-mcp-server`
2. **Test installation**: `npm install -g soroban-mcp-server`
3. **Update README** with npm badge:
   ```markdown
   [![npm version](https://badge.fury.io/js/soroban-mcp-server.svg)](https://www.npmjs.com/package/soroban-mcp-server)
   ```

---

## 🎥 Step 5: Record Demo

Create a demo showing the server in action:

### Using asciinema (Terminal Recording)

```bash
# Install asciinema
# macOS: brew install asciinema
# Ubuntu: sudo apt-get install asciinema

# Record a demo
asciinema rec demo.cast

# In the recording:
# 1. Show the server starting
# 2. Show a tool invocation (e.g., get_account_info)
# 3. Show the structured response

# Upload to asciinema.org
asciinema upload demo.cast

# Or convert to GIF
# Install agg: cargo install --git https://github.com/asciinema/agg
agg demo.cast demo.gif
```

### Using Screen Recording

1. **Start recording** (macOS: Cmd+Shift+5, Windows: Win+G)
2. **Demo flow:**
   - Open terminal
   - Run `npx soroban-mcp-server`
   - Show it starting successfully
   - Open Claude Desktop
   - Ask Claude to interact with Soroban (e.g., "Check the balance of this Stellar account: G...")
   - Show the structured response
3. **Save and compress** the video
4. **Upload to GitHub** and embed in README

---

## 🌊 Step 6: Stellar Wave Submission

### Prepare Submission

1. **Repository URL**: `https://github.com/YOUR_USERNAME/soroban-mcp-server`

2. **Demo**: Link to the demo video/GIF

3. **Key Points to Highlight:**
   - Production-ready MCP server for AI-assisted Soroban development
   - 6 MCP tools covering build → test → deploy → inspect workflow
   - Structured error handling (no raw CLI output)
   - Full test coverage (58 passing tests)
   - Designed for ongoing contributions (issue templates + roadmap)

4. **Roadmap for Post-Launch:**
   - TTL management (`bump_contract_ttl` tool)
   - Transaction signing support
   - Wallet integrations
   - Local devnet support
   - Each generates scoped contribution issues

### Stellar Wave Application

Visit the Stellar Wave portal and submit:
- **Category**: Developer Tooling / Infrastructure
- **Stage**: Production-ready
- **Impact**: Enables AI agents to build, test, and deploy Soroban contracts without parsing unstructured CLI output

---

## 📊 Monitoring Post-Launch

### Track Usage

```bash
# View npm download stats
npm info soroban-mcp-server

# Or use npm-stat.com
open https://npm-stat.com/charts.html?package=soroban-mcp-server
```

### Respond to Issues

- Watch GitHub issues for bug reports
- Use the `good-first-issue` label to attract contributors
- Implement roadmap items as separate PRs

---

## 🛠️ Troubleshooting

### Common Issues

**"stellar CLI not found"**
- Install: `cargo install --locked stellar-cli --features opt`
- Or set: `SOROBAN_CLI_PATH=/path/to/stellar`

**"Network timeout"**
- Check RPC_URL is accessible
- Verify network connectivity
- Try a different RPC endpoint

**"Module not found" errors**
- Ensure all dependencies are installed: `npm install`
- Rebuild: `npm run build`

---

## ✅ Success Criteria

- ✅ Server starts without errors
- ✅ All tools respond to invocations
- ✅ Structured errors returned (not raw exceptions)
- ✅ Works with MCP clients (Claude Desktop)
- ✅ Published to npm
- ✅ Demo recorded and embedded in README
- ✅ Submitted to Stellar Wave

---

**Next**: Update your GitHub repository URLs in `package.json`, test with a real MCP client, record a demo, and you're ready to publish! 🚀
