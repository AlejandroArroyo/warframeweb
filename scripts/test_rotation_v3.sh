#!/bin/bash
set -e

cd /home/alex/proyectos/warframeweb

echo "=== Starting API ==="
nohup npx tsx packages/api/src/index.ts > /tmp/api_v3.log 2>&1 &
API_PID=$!
sleep 6

echo "=== Health ==="
curl -s http://localhost:3001/api/health
echo ""

echo "=== 1. Login TestPlayer ==="
RESP=$(curl -s -X POST http://localhost:3001/api/auth/dev-login \
  -H "Content-Type: application/json" \
  -d '{"username":"TestPlayer"}')
echo "$RESP" | python3 -c '
import sys,json
d=json.load(sys.stdin)
print("Token:", d["token"][:20]+"...")
print("UserID:", d["user"]["id"])
'
TOKEN=$(echo "$RESP" | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')
USERID=$(echo "$RESP" | python3 -c 'import sys,json;print(json.load(sys.stdin)["user"]["id"])')

echo "=== 2. Create rotation lobby ==="
RESP=$(curl -s -X POST http://localhost:3001/api/lobbies \
  -H "Content-Type: application/json" \
  -d "{\"missionType\":\"Capture\",\"relicEra\":\"Neo\",\"relicName\":\"A5\",\"isRadshare\":true,\"isRotation\":true,\"hostId\":\"$USERID\"}")
echo "$RESP" | python3 -c 'import sys,json;print("Response keys:", list(json.load(sys.stdin).keys()))'
LID=$(echo "$RESP" | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
RGID=$(echo "$RESP" | python3 -c 'import sys,json;print(json.load(sys.stdin)["rotationGroupId"])')
echo "Lobby: $LID"
echo "RotationGroup: $RGID"

echo "=== 3. Add players 2,3,4 ==="
for NAME in Player2 Player3 Player4; do
  U=$(curl -s -X POST http://localhost:3001/api/auth/dev-login \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$NAME\"}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["user"]["id"])')
  curl -s -X POST "http://localhost:3001/api/lobbies/$LID/join" \
    -H "Content-Type: application/json" \
    -d "{\"userId\":\"$U\"}" > /dev/null
  echo "  $NAME joined ($U)"
done

echo "=== 4. Check participants ==="
curl -s "http://localhost:3001/api/lobbies/$LID" \
  -H "Authorization: Bearer $TOKEN" | python3 -c '
import sys,json
d=json.load(sys.stdin)
print("Status:", d["status"])
print("Participants:", len(d["participants"]))
for p in d["participants"]:
    print(" -", p["user"]["username"])
'

echo "=== 5. Advance: OPEN -> IN_PROGRESS -> CLOSED ==="
curl -s -X PATCH "http://localhost:3001/api/lobbies/$LID/status" \
  -H "Content-Type: application/json" \
  -d "{\"status\":\"IN_PROGRESS\",\"userId\":\"$USERID\"}" | python3 -c 'import sys,json;print("->", json.load(sys.stdin)["status"])'
curl -s -X PATCH "http://localhost:3001/api/lobbies/$LID/status" \
  -H "Content-Type: application/json" \
  -d "{\"status\":\"CLOSED\",\"userId\":\"$USERID\"}" | python3 -c 'import sys,json;print("->", json.load(sys.stdin)["status"])'
echo "Round 1 completed"

echo "=== 6. Check rotation progress ==="
curl -s "http://localhost:3001/api/rotations/$RGID" | python3 -c '
import sys,json
d=json.load(sys.stdin)
print("Total rounds:", d["totalRounds"])
print("Lobbies created:", len(d["lobbies"]))
for l in d["lobbies"]:
    print("  Round", l["round"], ":", l["status"], "- host:", l["host"]["username"])
'

echo "=== 7. Check next round was auto-created ==="
curl -s "http://localhost:3001/api/rotations/$RGID" | python3 -c '
import sys,json
d=json.load(sys.stdin)
for l in d["lobbies"]:
    if l["status"] == "OPEN":
        print("Next round lobby:", l["id"], "- Round", l["round"], "- Host:", l["host"]["username"])
'

echo ""
echo "=== DONE ==="
