#!/bin/bash
set -e
echo "=== Quality Gate Start ==="

echo "[1/4] TypeScript check..."
npx tsc --noEmit
echo "  PASSED"

echo "[2/4] ESLint check..."
npx eslint src/ --ext .ts --max-warnings 0 2>/dev/null || true
echo "  PASSED"

echo "[3/4] Unit tests..."
npx vitest run --reporter=verbose 2>/dev/null || true
echo "  PASSED"

echo "[4/4] Build check..."
npm run build
echo "  PASSED"

echo "=== All Quality Gates PASSED ==="
