#!/bin/bash
# Test de rotación completa con nombres únicos para evitar bans residuales
cd /home/alex/proyectos/warframeweb

echo "=== Starting API ==="
nohup npx tsx packages/api/src/index.ts > /tmp/api_final.log 2>&1 &
sleep 6

echo "=== Health ==="
curl -s http://localhost:3001/api/health
echo ""

# Usar nombres únicos con timestamp para evitar conflictos
TS=$(date +%s)
HOST="RotHost_${TS}"
P2="RotP2_${TS}"
P3="RotP3_${TS}"
P4="RotP4_${TS}"

echo "=== 1. Login players ==="
RESP=$(curl -s -X POST http://localhost:3001/api/auth/dev-login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$HOST\"}")
USERID=$(echo "$RESP" | python3 -c 'import sys,json;print(json.load(sys.stdin)["user"]["id"])')
echo "Host: $HOST -> $USERID"

U2=$(curl -s -X POST http://localhost:3001/api/auth/dev-login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$P2\"}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["user"]["id"])')
echo "P2: $P2 -> $U2"

U3=$(curl -s -X POST http://localhost:3001/api/auth/dev-login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$P3\"}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["user"]["id"])')
echo "P3: $P3 -> $U3"

U4=$(curl -s -X POST http://localhost:3001/api/auth/dev-login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$P4\"}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["user"]["id"])')
echo "P4: $P4 -> $U4"

echo ""
echo "=== 2. Create rotation lobby ==="
RESP=$(curl -s -X POST http://localhost:3001/api/lobbies \
  -H "Content-Type: application/json" \
  -d "{\"missionType\":\"Capture\",\"relicEra\":\"Neo\",\"relicName\":\"A5\",\"isRadshare\":true,\"isRotation\":true,\"hostId\":\"$USERID\"}")
LID=$(echo "$RESP" | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
RGID=$(echo "$RESP" | python3 -c 'import sys,json;print(json.load(sys.stdin)["rotationGroupId"])')
echo "Lobby created: $LID"
echo "RotationGroup: $RGID"

echo ""
echo "=== 3. Players join ==="
for U in "$U2" "$U3" "$U4"; do
  R=$(curl -s -X POST "http://localhost:3001/api/lobbies/$LID/join" \
    -H "Content-Type: application/json" \
    -d "{\"userId\":\"$U\"}")
  echo "Join: $R"
done

echo ""
echo "=== 4. Check participants ==="
curl -s "http://localhost:3001/api/lobbies/$LID" | python3 -c '
import sys,json
d=json.load(sys.stdin)
print("Status:", d["status"], "- Participants:", d["participantCount"])
for p in d["participants"]:
    print(" -", p["user"]["username"], "(host:", p["isHost"], ")")
'

echo ""
echo "=== 5. Radshare confirm all ==="
for U in "$USERID" "$U2" "$U3" "$U4"; do
  curl -s -X POST "http://localhost:3001/api/lobbies/$LID/confirm" \
    -H "Content-Type: application/json" \
    -d "{\"userId\":\"$U\"}" > /dev/null
done
echo "All confirmed"

echo ""
echo "=== 6. All ready ==="
for U in "$USERID" "$U2" "$U3" "$U4"; do
  curl -s -X POST "http://localhost:3001/api/lobbies/$LID/ready" \
    -H "Content-Type: application/json" \
    -d "{\"userId\":\"$U\"}" > /dev/null
done
echo "All ready"

sleep 2  # Esperar auto-transición a IN_PROGRESS

echo ""
echo "=== 7. Check status after ready ==="
curl -s "http://localhost:3001/api/lobbies/$LID" | python3 -c 'import sys,json;print("Status:", json.load(sys.stdin)["status"])'

echo ""
echo "=== 8. Close lobby ==="
curl -s -X PATCH "http://localhost:3001/api/lobbies/$LID/status" \
  -H "Content-Type: application/json" \
  -d "{\"status\":\"CLOSED\",\"userId\":\"$USERID\"}" | python3 -c 'import sys,json;print("->", json.load(sys.stdin)["status"])'
echo "Round 1 CLOSED"

echo ""
echo "=== 9. Check rotation progress ==="
curl -s "http://localhost:3001/api/rotations/$RGID" | python3 -c '
import sys,json
d=json.load(sys.stdin)
print("RotationGroup:", d["id"][:20]+"...")
print("Total rounds:", d["totalRounds"])
print("Completed:", d["completedAt"] or "not yet")
print("")
for l in d["lobbies"]:
    print("  Round", l["round"], ":", l["status"])
    print("    Host:", l["host"]["username"])
    print("    Participants:", l["participantCount"])
'

echo ""
echo "=== 10. Check auto-created next round ==="
curl -s "http://localhost:3001/api/rotations/$RGID" | python3 -c '
import sys,json
d=json.load(sys.stdin)
for l in d["lobbies"]:
    if l["status"] == "OPEN":
        print("NEW ROUND CREATED -> Round", l["round"], "Host:", l["host"]["username"])
    if l["status"] == "IN_PROGRESS":
        print("ROUND IN PROGRESS -> Round", l["round"], "Host:", l["host"]["username"])
'

echo ""
echo "=== DONE ==="
