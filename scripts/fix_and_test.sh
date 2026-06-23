#!/bin/bash
cd /home/alex/proyectos/warframeweb

echo "=== Starting API ==="
nohup npx tsx packages/api/src/index.ts > /tmp/api_fix.log 2>&1 &
sleep 6

echo "=== Health ==="
curl -s http://localhost:3001/api/health
echo ""

echo "=== Fix Player2: unban via DB ==="
python3 -c "
import subprocess,json
# Read test players from DB directly
r = subprocess.run(['npx','prisma','db','execute','--stdin'], 
    input=\"UPDATE \\\"User\\\" SET \\\"isBanned\\\" = false WHERE username IN ('Player2','Player3','Player4');\",
    capture_output=True, text=True, cwd='/home/alex/proyectos/warframeweb', timeout=15)
print('Unban result:', r.stdout[:200] if r.stdout else r.stderr[:200])
" 2>&1 || echo "DB fix failed, trying prisma"

# Alternative: directly use prisma
echo "Using prisma db execute..."
echo "UPDATE \"User\" SET \"isBanned\" = false WHERE username IN ('Player2','Player3','Player4');" | npx prisma db execute --stdin 2>&1 || echo "prisma method failed"

echo ""
echo "=== Login TestPlayer ==="
RESP=$(curl -s -X POST http://localhost:3001/api/auth/dev-login \
  -H "Content-Type: application/json" \
  -d '{"username":"TestPlayer"}')
USERID=$(echo "$RESP" | python3 -c 'import sys,json;print(json.load(sys.stdin)["user"]["id"])')
echo "TestPlayer: $USERID"

echo ""
echo "=== Login Player2 (should work now) ==="
curl -s -X POST http://localhost:3001/api/auth/dev-login \
  -H "Content-Type: application/json" \
  -d '{"username":"Player2"}' | python3 -c 'import sys,json;print(json.load(sys.stdin))'
