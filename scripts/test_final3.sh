#!/bin/bash
# Rotación test simplificado - skip radshare flow
cd /home/alex/proyectos/warframeweb

echo "=== Starting API ==="
nohup npx tsx packages/api/src/index.ts > /tmp/api_f3.log 2>&1 &
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

HID=$(curl -s -X POST http://localhost:3001/api/auth/dev-login \
  -H "Content-Type: application/json" -d "{\"username\":\"$HOST\"}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["user"]["id"])')
echo "Host: $HOST ($HID)"

U2=$(curl -s -X POST http://localhost:3001/api/auth/dev-login \
  -H "Content-Type: application/json" -d "{\"username\":\"$P2\"}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["user"]["id"])')
U3=$(curl -s -X POST http://localhost:3001/api/auth/dev-login \
  -H "Content-Type: application/json" -d "{\"username\":\"$P3\"}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["user"]["id"])')
U4=$(curl -s -X POST http://localhost:3001/api/auth/dev-login \
  -H "Content-Type: application/json" -d "{\"username\":\"$P4\"}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["user"]["id"])')
echo "Players OK"

echo ""
echo "=== 2. Create rotation lobby ==="
RESP=$(curl -s -X POST http://localhost:3001/api/lobbies \
  -H "Content-Type: application/json" \
  -d "{\"missionType\":\"Capture\",\"relicEra\":\"Neo\",\"relicName\":\"A5\",\"isRadshare\":true,\"isRotation\":true,\"hostId\":\"$HID\"}")
LID=$(echo "$RESP" | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
RGID=$(echo "$RESP" | python3 -c 'import sys,json;print(json.load(sys.stdin)["rotationGroupId"])')
echo "Lobby: $LID | RotationGroup: $RGID"

echo ""
echo "=== 3. All join ==="
for U in "$HID" "$U2" "$U3" "$U4"; do
  R=$(curl -s -X POST "http://localhost:3001/api/lobbies/$LID/join" \
    -H "Content-Type: application/json" \
    -d "{\"userId\":\"$U\"}")
  echo "Join: $R"
done

echo ""
echo "=== 4. Skip radshare - force IN_PROGRESS ==="
curl -s -X PATCH "http://localhost:3001/api/lobbies/$LID/status" \
  -H "Content-Type: application/json" \
  -d "{\"status\":\"IN_PROGRESS\",\"userId\":\"$HID\"}"
echo ""

echo ""
echo "=== 5. Close lobby ==="
curl -s -X PATCH "http://localhost:3001/api/lobbies/$LID/status" \
  -H "Content-Type: application/json" \
  -d "{\"status\":\"CLOSED\",\"userId\":\"$HID\"}"
echo ""

echo ""
echo "=== 6. Check rotation progress ==="
sleep 1
curl -s "http://localhost:3001/api/rotations/$RGID" | python3 -c '
import sys,json
d=json.load(sys.stdin)
print("RotationGroup:", d["id"][:16]+"...")
print("Total rounds:", d["totalRounds"])
print("Completed:", d["completedAt"] or "no")
for l in d["lobbies"]:
    print("  Round", l["round"], ":", l["status"], "- Host:", l["host"]["username"], "(", l["participantCount"], "participants)")
'

echo ""
echo "=== 7. Check if rotation auto-advanced ==="
curl -s "http://localhost:3001/api/rotations/$RGID" | python3 -c '
import sys,json
d=json.load(sys.stdin)
new_rounds = [l for l in d["lobbies"] if l["status"] != "CLOSED"]
if new_rounds:
    for l in new_rounds:
        print("ROUND", l["round"], ":", l["status"], "- Host:", l["host"]["username"])
else:
    print("No new round created!")
# Show ALL rounds
print("---")
for l in d["lobbies"]:
    print("All round", l["round"], ":", l["status"])
'

echo ""
echo "=== DONE ==="
