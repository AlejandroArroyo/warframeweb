#!/bin/bash
echo "=== Health ==="
curl -s http://localhost:3001/api/health
echo ""

echo "=== Dev Login ==="
curl -s -X POST http://localhost:3001/api/auth/dev-login \
  -H "Content-Type: application/json" \
  -d '{"username":"TestPlayer"}'
echo ""
