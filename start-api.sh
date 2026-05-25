#!/bin/bash
# MedRem API startup script
# Run from the medrem root directory

set -e

API_DIR="$(cd "$(dirname "$0")/packages/api" && pwd)"
TMP_DIR="/tmp/medrem-api-run"

echo "MedRem API Startup"
echo "=================="

# Create tmp run dir
mkdir -p "$TMP_DIR/src"

# Copy source files (stripping null bytes from Windows mount)
echo "Copying source files..."
find "$API_DIR/src" -name "*.js" | while read f; do
  rel="${f#$API_DIR/}"
  mkdir -p "$TMP_DIR/$(dirname $rel)"
  tr -d '\0' < "$f" > "$TMP_DIR/$rel"
done

# Copy .env
cp "$API_DIR/.env" "$TMP_DIR/.env" 2>/dev/null || true

# Write clean package.json
cat > "$TMP_DIR/package.json" << 'PKGJSON'
{
  "name": "@medrem/api",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "main": "src/index.js"
}
PKGJSON

# Install dependencies if needed
if [ ! -f "$TMP_DIR/node_modules/fastify/package.json" ]; then
  echo "Installing dependencies..."
  cp "$API_DIR/package.json" "$TMP_DIR/package.json.deps"
  cd "$TMP_DIR"
  # Use the original package.json for deps
  node -e "
const d = JSON.parse(require('fs').readFileSync('package.json.deps','utf8'));
d.name = '@medrem/api';
require('fs').writeFileSync('package.json', JSON.stringify(d, null, 2));
"
  npm install --no-audit --no-fund
fi

# Start server
echo "Starting MedRem API on port 3001..."
cd "$TMP_DIR"
exec node src/index.js
