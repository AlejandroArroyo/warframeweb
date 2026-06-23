#!/bin/bash
# Rotación test - status flow correcto
cd /home/alex/proyectos/warframeweb

echo "=== Starting API ==="
nohup npx tsx packages/api/src/index.ts > /tmp/api_f4.log 2>&1 &
sleep 6

echo "=== Health ==="
curl -s http://localhost:3001/api/health
echo ""

TS=$(date +%s)

echo "=== 1. Create 4 players ==="
HOST="Rot_${TS}_H"
P2="Rot_${TS}_2"
P3="Rot_${TS}_3"
P4="Rot_${TS}_4"

HID=$(curl -s -X POST http://localhost:3001/api/auth/dev-login \
  -H "Content-Type: application/json" -d "{\"username\":\"$HOST\"}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["user"]["id"])')
echo "Host created: $HOST ($HID)"

U2=$(curl -s -X POST http://localhost:3001/api/auth/dev-login \
  -H "Content-Type: application/json" -d "{\"username\":\"$P2\"}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["user"]["id"])')
U3=$(curl -s -X POST http://localhost:3001/api/auth/dev-login \
  -H "Content-Type: application/json" -d "{\"username\":\"$P3\"}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["user"]["id"])')
U4=$(curl -s -X POST http://localhost:3001/api/auth/dev-login \
  -H "Content-Type: application/json" -d "{\"username\":\"$P4\"}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["user"]["id"])')
echo "Players created: $U2 $U3 $U4"

echo ""
echo "=== 2. Create rotation lobby ==="
RESP=$(curl -s -X POST http://localhost:3001/api/lobbies \
  -H "Content-Type: application/json" \
  -d "{\"missionType\":\"Capture\",\"relicEra\":\"Neo\",\"relicName\":\"A5\",\"isRadshare\":true,\"isRotation\":true,\"hostId\":\"$HID\"}")
LID=$(echo "$RESP" | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
RGID=$(echo "$RESP" | python3 -c 'import sys,json;print(json.load(sys.stdin)["rotationGroupId"])')
echo "Lobby: $LID | RotationGroup: $RGID"

echo ""
echo "=== 3. Join (solo 3 players, host ya está) ==="
for U in "$U2" "$U3" "$U4"; do
  R=$(curl -s -X POST "http://localhost:3001/api/lobbies/$LID/join" \
    -H "Content-Type: application/json" \
    -d "{\"userId\":\"$U\"}")
  echo "Join $U: $R"
done

echo ""
echo "=== 4. OPEN -> CONFIRMING (PATCH) ==="
curl -s -X PATCH "http://localhost:3001/api/lobbies/$LID/status" \
  -H "Content-Type: application/json" \
  -d "{\"status\":\"CONFIRMING\",\"userId\":\"$HID\"}" | python3 -c 'import sys,json;r=json.load(sys.stdin);print(r.get("status","ERROR: "+str(r)))'

echo ""
echo "=== 5. CONFIRMING -> IN_PROGRESS ==="
curl -s -X PATCH "http://localhost:3001/api/lobbies/$LID/status" \
  -H "Content-Type: application/json" \
  -d "{\"status\":\"IN_PROGRESS\",\"userId\":\"$HID\"}" | python3 -c 'import sys,json;r=json.load(sys.stdin);print(r.get("status","ERROR: "+str(r)))'

echo ""
echo "=== 6. IN_PROGRESS -> CLOSED (trigger rotation) ==="
curl -s -X PATCH "http://localhost:3001/api/lobbies/$LID/status" \
  -H "Content-Type: application/json" \
  -d "{\"status\":\"CLOSED\",\"userId\":\"$HID\"}" | python3 -c 'import sys,json;r=json.load(sys.stdin);print(r.get("status","ERROR: "+str(r)))'
echo "Round 1 CLOSED"

echo ""
echo "=== 7. Check rotation progress ==="
sleep 2
curl -s "http://localhost:3001/api/rotations/$RGID" | python3 -c '
import sys,json
d=json.load(sys.stdin)
print("Total rounds:", d["totalRounds"])
print("Completed:", d["completedAt"] or "in progress")
for l in d["lobbies"]:
    print("  Round", l["round"], ":", l["status"], "- Host:", l["host"]["username"])
'

echo ""
echo "=== 8. See auto-created rounds ==="
curl -s "http://localhost:3001/api/rotations/$RGID" | python3 -c '
import sys,json
d=json.load(sys.stdin)
next_rounds = [l for l in d["lobbies"] if l["status"] == "OPEN"]
print("Next round(s) open:", len(next_rounds))
for l in next_rounds:
    print("  Round", l["round"], "- Host:", l["host"]["username"], "- ID:", l["id"][:20]+"...")
'

echo ""
echo "=== DONE ==="
