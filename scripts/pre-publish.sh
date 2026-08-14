#!/bin/bash

# Pre-publish checklist script
# Run this before publishing to npm

set -e

echo "🔍 Running pre-publish checklist..."
echo ""

# Check 1: TypeScript compilation
echo "✓ Checking TypeScript compilation..."
npm run typecheck
echo "✅ TypeScript: PASS"
echo ""

# Check 2: Linting
echo "✓ Checking lint..."
npm run lint
echo "✅ Lint: PASS"
echo ""

# Check 3: Tests
echo "✓ Running tests..."
npm test
echo "✅ Tests: PASS"
echo ""

# Check 4: Build
echo "✓ Building project..."
npm run build
echo "✅ Build: PASS"
echo ""

# Check 5: Verify dist/ exists
if [ ! -d "dist" ]; then
  echo "❌ dist/ directory not found"
  exit 1
fi
echo "✅ dist/ directory exists"
echo ""

# Check 6: Verify package.json has required fields
echo "✓ Checking package.json..."

if grep -q '"repository":' package.json; then
  echo "✅ Repository field present"
else
  echo "❌ Repository field missing in package.json"
  exit 1
fi

if grep -q '"author":' package.json; then
  echo "✅ Author field present"
else
  echo "❌ Author field missing in package.json"
  exit 1
fi

if grep -q 'yourusername' package.json; then
  echo "⚠️  WARNING: Found placeholder 'yourusername' in package.json"
  echo "   Update repository URLs before publishing!"
fi

echo ""

# Check 7: Create test tarball
echo "✓ Creating test package..."
npm pack --dry-run > /dev/null 2>&1
echo "✅ Package can be created"
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ All checks passed!"
echo ""
echo "Next steps:"
echo "1. Update repository URLs in package.json"
echo "2. Test with: npm pack"
echo "3. Inspect with: tar -tzf soroban-mcp-server-*.tgz"
echo "4. Publish with: npm publish"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
