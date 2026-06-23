#!/bin/bash
# Test de rotación - skip radshare flow, just test rotation mechanics
cd /home/alex/proyectos/warframeweb

echo "=== Starting API ==="
nohup npx tsx packages/api/src/index.ts > /tmp/api_f2.log 2>&1 &
sleep 6

echo "=== Health ==="
curl -s http://localhost:3001/api/health
echo ""

TS=$(date +%s)

echo "=== 1. Create 4 players ==="
HOST="RH_${TS}"
P2="RP2_${TS}"
P3="RP3_${TS}"
P4="RP4_${TS}"

RESP=$(curl -s -X POST http://localhost:3001/api/auth/dev-login \
  -H "Content-Type: application/json" -d "{\"username\":\"$HOST\"}")
HID=$(echo "$RESP" | python3 -c 'import sys,json;print(json.load(sys.stdin)["user"]["id"])')
echo "Host: $HOST ($HID)"

U2=$(curl -s -X POST http://localhost:3001/api/auth/dev-login \
  -H "Content-Type: application/json" -d "{\"username\":\"$P2\"}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["user"]["id"])')
U3=$(curl -s -X POST http://localhost:3001/api/auth/dev-login \
  -H "Content-Type: application/json" -d "{\"username\":\"$P3\"}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["user"]["id"])')
U4=$(curl -s -X POST http://localhost:3001/api/auth/dev-login \
  -H "Content-Type: application/json" -d "{\"username\":\"$P4\"}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["user"]["id"])')
echo "Players: $U2 $U3 $U4"

echo ""
echo "=== 2. Create rotation lobby ==="
RESP=$(curl -s -X POST http://localhost:3001/api/lobbies \
  -H "Content-Type: application/json" \
  -d "{\"missionType\":\"Capture\",\"relicEra\":\"Neo\",\"relicName\":\"A5\",\"isRadshare\":true,\"isRotation\":true,\"hostId\":\"$HID\"}")
LID=$(echo "$RESP" | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
RGID=$(echo "$RESP" | python3 -c 'import sys,json;print(json.load(sys.stdin)["rotationGroupId"])')
echo "Lobby: $LID"
echo "RotationGroup: $RGID"

echo ""
echo "=== 3. All join ==="
for U in "$HID" "$U2" "$U3" "$U4"; do
  curl -s -X POST "http://localhost:3001/api/lobbies/$LID/join" \
    -H "Content-Type: application/json" \
    -d "{\"userId\":\"$U\"}" > /dev/null
done
echo "4/4 joined"

echo ""
echo "=== 4. Confirm radshare ==="
# Note: In dev mode without auth, confirm checks relic
# We skip confirm/ready and go directly via PATCH for rotation test
# First confirm all to transition to CONFIRMING
for U in "$HID" "$U2" "$U3" "$U4"; do
  curl -s -X POST "http://localhost:3001/api/lobbies/$LID/confirm" \
    -H "Content-Type: application/json" \
    -d "{\"userId\":\"$U\"}" > /dev/null
done
echo "All confirmed"

STATUS=$(curl -s "http://localhost:3001/api/lobbies/$LID" | python3 -c 'import sys,json;print(json.load(sys.stdin)["status"])')
echo "Status after confirm: $STATUS"

echo ""
echo "=== 5. All ready ==="
for U in "$HID" "$U2" "$U3" "$U4"; do
  curl -s -X POST "http://localhost:3001/api/lobbies/$LID/ready" \
    -H "Content-Type: application/json" \
    -d "{\"userId\":\"$U\"}" > /dev/null
done
echo "All ready"

sleep 3

STATUS=$(curl -s "http://localhost:3001/api/lobbies/$LID" | python3 -c 'import sys,json;print(json.load(sys.stdin)["status"])')
echo "Status after ready: $STATUS"

echo ""
echo "=== 6. Force IN_PROGRESS if needed ==="
if [ "$STATUS" != "IN_PROGRESS" ]; then
  curl -s -X PATCH "http://localhost:3001/api/lobbies/$LID/status" \
    -H "Content-Type: application/json" \
    -d "{\"status\":\"IN_PROGRESS\",\"userId\":\"$HID\"}" | python3 -c 'import sys,json;print("->", json.load(sys.stdin)["status"])'
fi

echo ""
echo "=== 7. Close lobby ==="
curl -s -X PATCH "http://localhost:3001/api/lobbies/$LID/status" \
  -H "Content-Type: application/json" \
  -d "{\"status\":\"CLOSED\",\"userId\":\"$HID\"}" | python3 -c 'import sys,json;print("->", json.load(sys.stdin)["status"])'
echo "Round 1 CLOSED"

echo ""
echo "=== 8. Rotation progress ==="
curl -s "http://localhost:3001/api/rotations/$RGID" | python3 -c '
import sys,json
d=json.load(sys.stdin)
print("Total rounds:", d["totalRounds"])
print("Completed:", d["completedAt"] or "not yet")
for l in d["lobbies"]:
    print("  Round", l["round"], ":", l["status"], "- Host:", l["host"]["username"])
'

echo ""
echo "=== 9. Auto-created next round? ==="
sleep 2
curl -s "http://localhost:3001/api/rotations/$RGID" | python3 -c '
import sys,json
d=json.load(sys.stdin)
next_rounds = [l for l in d["lobbies"] if l["status"] != "CLOSED"]
if next_rounds:
    for l in next_rounds:
        print("OPEN ROUND -> Round", l["round"], "Host:", l["host"]["username"])
else:
    print("No open rounds - auto-creation might have failed")
'

echo ""
echo "=== DONE ==="
