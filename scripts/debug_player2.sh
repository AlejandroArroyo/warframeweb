#!/bin/bash
cd /home/alex/proyectos/warframeweb

echo "=== Starting API ==="
nohup npx tsx packages/api/src/index.ts > /tmp/api_debug.log 2>&1 &
sleep 6

echo "=== Login TestPlayer ==="
curl -s -X POST http://localhost:3001/api/auth/dev-login \
  -H "Content-Type: application/json" \
  -d '{"username":"TestPlayer"}' | python3 -c 'import sys,json;print(json.load(sys.stdin))'

echo ""
echo "=== Login Player2 ==="
curl -s -X POST http://localhost:3001/api/auth/dev-login \
  -H "Content-Type: application/json" \
  -d '{"username":"Player2"}' | python3 -c 'import sys,json;print(json.load(sys.stdin))'
