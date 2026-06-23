#!/bin/bash
echo "=== 1. Login TestPlayer ==="
T1=$(curl -s -X POST http://localhost:3001/api/auth/dev-login \
  -H 'Content-Type: application/json' \
  -d '{"username":"TestPlayer"}' | python3 -c 'import sys,json; print(json.load(sys.stdin)["token"])')
U1=$(curl -s -X POST http://localhost:3001/api/auth/dev-login \
  -H 'Content-Type: application/json' \
  -d '{"username":"TestPlayer"}' | python3 -c 'import sys,json; print(json.load(sys.stdin)["user"]["id"])')
echo "T1 OK, ID: ${U1:0:12}..."

echo "=== 2. Create rotation lobby ==="
LOBBY=$(curl -s -X POST http://localhost:3001/api/lobbies \
  -H 'Content-Type: application/json' \
  -d "{\"missionType\":\"Capture\",\"relicEra\":\"Neo\",\"relicName\":\"A5\",\"isRadshare\":true,\"isRotation\":true,\"hostId\":\"$U1\"}")
LID=$(echo "$LOBBY" | python3 -c 'import sys,json; print(json.load(sys.stdin)["id"])')
RGID=$(echo "$LOBBY" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("rotationGroupId","none"))')
echo "Lobby: $LID, RotationGroup: $RGID"

echo "=== 3. Login Player2,3,4 and join ==="
for NAME in Player2 Player3 Player4; do
  U=$(curl -s -X POST http://localhost:3001/api/auth/dev-login \
    -H 'Content-Type: application/json' \
    -d "{\"username\":\"$NAME\"}" | python3 -c 'import sys,json; print(json.load(sys.stdin)["user"]["id"])')
  curl -s -X POST "http://localhost:3001/api/lobbies/$LID/join" \
    -H 'Content-Type: application/json' \
    -d "{\"userId\":\"$U\"}" > /dev/null
  echo "  $NAME joined"
done

echo "=== 4. Complete lobby (OPEN -> IN_PROGRESS -> CLOSED) ==="
curl -s -X PATCH "http://localhost:3001/api/lobbies/$LID/status" \
  -H 'Content-Type: application/json' \
  -d "{\"status\":\"IN_PROGRESS\",\"userId\":\"$U1\"}" > /dev/null
curl -s -X PATCH "http://localhost:3001/api/lobbies/$LID/status" \
  -H 'Content-Type: application/json' \
  -d "{\"status\":\"CLOSED\",\"userId\":\"$U1\"}" > /dev/null
echo "Completed round 1"

echo "=== 5. Check rotation progress ==="
curl -s "http://localhost:3001/api/rotations/$RGID" \
  -H "Authorization: Bearer $T1" | python3 -c '
import sys,json
d=json.load(sys.stdin)
print(f"Total rounds: {d[\"totalRounds\"]}")
print(f"Lobbies: {len(d[\"lobbies\"])}")
for l in d["lobbies"]:
    print(f"  Round {l[\"round\"]}: {l[\"status\"]} - host: {l[\"host\"][\"username\"]}")
'

echo ""
echo "=== DONE ==="
