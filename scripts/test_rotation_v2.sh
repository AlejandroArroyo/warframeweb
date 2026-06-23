#!/bin/bash
set -e

echo "=== Starting API ==="
cd /home/alex/proyectos/warframeweb
npx tsx packages/api/src/index.ts &>/tmp/api_v2.log &
API_PID=$!
sleep 6

echo "=== Health ==="
curl -s http://localhost:3001/api/health
echo ""

echo "=== 1. Login TestPlayer ==="
RESP=$(curl -s -X POST http://localhost:3001/api/auth/dev-login -H "Content-Type: application/json" -d '{"username":"TestPlayer"}')
echo "$RESP" | python3 -c '
import sys,json
d=json.load(sys.stdin)
print("Token:", d["token"][:20]+"...")
print("UserID:", d["user"]["id"])
'

USERID=$(echo "$RESP" | python3 -c 'import sys,json;print(json.load(sys.stdin)["user"]["id"])')

echo "=== 2. Create rotation lobby ==="
RESP=$(curl -s -X POST http://localhost:3001/api/lobbies -H "Content-Type: application/json" -d "{\"missionType\":\"Capture\",\"relicEra\":\"Neo\",\"relicName\":\"A5\",\"isRadshare\":true,\"isRotation\":true,\"hostId\":\"$USERID\"}")
LID=$(echo "$RESP" | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
RGID=$(echo "$RESP" | python3 -c 'import sys,json;print(json.load(sys.stdin)["rotationGroupId"])')
echo "Lobby: $LID"
echo "RotationGroup: $RGID"

echo "=== 3. Add players 2,3,4 ==="
for NAME in Player2 Player3 Player4; do
  U=$(curl -s -X POST http://localhost:3001/api/auth/dev-login -H "Content-Type: application/json" -d "{\"username\":\"$NAME\"}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["user"]["id"])')
  curl -s -X POST "http://localhost:3001/api/lobbies/$LID/join" -H "Content-Type: application/json" -d "{\"userId\":\"$U\"}" > /dev/null
  echo "  $NAME joined"
done

echo "=== 4. Advance: OPEN -> IN_PROGRESS -> CLOSED ==="
curl -s -X PATCH "http://localhost:3001/api/lobbies/$LID/status" -H "Content-Type: application/json" -d "{\"status\":\"IN_PROGRESS\",\"userId\":\"$USERID\"}"
echo ""
curl -s -X PATCH "http://localhost:3001/api/lobbies/$LID/status" -H "Content-Type: application/json" -d "{\"status\":\"CLOSED\",\"userId\":\"$USERID\"}"
echo ""
echo "Round 1 closed"

echo "=== 5. Check rotation progress ==="
RESP=$(curl -s "http://localhost:3001/api/rotations/$RGID")
echo "$RESP" | python3 -c '
import sys,json
d=json.load(sys.stdin)
print("Total rounds:", d["totalRounds"])
print("Lobbies:", len(d["lobbies"]))
for l in d["lobbies"]:
    print("  Round", l["round"], ":", l["status"], "- host:", l["host"]["username"])
'

echo "=== 6. Check auto-rotation created next round ==="
LIVE_LOBBIES=$(echo "$RESP" | python3 -c '
import sys,json
d=json.load(sys.stdin)
open_lobbies = [l for l in d["lobbies"] if l["status"] == "OPEN"]
print(len(open_lobbies))
')
echo "Open lobbies after rotation: $LIVE_LOBBIES"

# Cleanup
kill $API_PID 2>/dev/null
echo ""
echo "=== DONE ==="
