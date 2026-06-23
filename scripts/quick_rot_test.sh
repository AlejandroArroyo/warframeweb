#!/bin/bash
echo "=== 1. Login ==="
RESP=$(curl -s -X POST http://localhost:3001/api/auth/dev-login \
  -H 'Content-Type: application/json' \
  -d '{"username":"TestPlayer"}')
TOKEN=$(echo "$RESP" | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')
USERID=$(echo "$RESP" | python3 -c 'import sys,json;print(json.load(sys.stdin)["user"]["id"])')
echo "Token OK"

echo "=== 2. Create rotation lobby ==="
RESP=$(curl -s -X POST http://localhost:3001/api/lobbies \
  -H 'Content-Type: application/json' \
  -d "{\"missionType\":\"Capture\",\"relicEra\":\"Neo\",\"relicName\":\"A5\",\"isRadshare\":true,\"isRotation\":true,\"hostId\":\"$USERID\"}")
LID=$(echo "$RESP" | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
RGID=$(echo "$RESP" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("rotationGroupId","no"))')
echo "Lobby: $LID | RotationGroup: $RGID"

if [ "$RGID" = "no" ]; then
  echo "ERROR: No rotation group created!"
  echo "$RESP" | head -c 200
  exit 1
fi

echo "=== 3. Add players 2,3,4 ==="
for NAME in Player2 Player3 Player4; do
  U=$(curl -s -X POST http://localhost:3001/api/auth/dev-login \
    -H 'Content-Type: application/json' \
    -d "{\"username\":\"$NAME\"}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["user"]["id"])')
  curl -s -X POST "http://localhost:3001/api/lobbies/$LID/join" \
    -H 'Content-Type: application/json' \
    -d "{\"userId\":\"$U\"}" > /dev/null
done
echo "4 players ready"

echo "=== 4. Complete round 1 ==="
curl -s -X PATCH "http://localhost:3001/api/lobbies/$LID/status" \
  -H 'Content-Type: application/json' \
  -d "{\"status\":\"IN_PROGRESS\",\"userId\":\"$USERID\"}" > /dev/null
curl -s -X PATCH "http://localhost:3001/api/lobbies/$LID/status" \
  -H 'Content-Type: application/json' \
  -d "{\"status\":\"CLOSED\",\"userId\":\"$USERID\"}" > /dev/null
echo "Round 1 done"

echo "=== 5. Check rotation progress ==="
curl -s "http://localhost:3001/api/rotations/$RGID" | python3 -c '
import sys,json
d=json.load(sys.stdin)
print("Total rounds:", d["totalRounds"])
print("Lobbies:", len(d["lobbies"]))
for l in d["lobbies"]:
    print(f"  Round {l[\"round\"]}: {l[\"status\"]} - host: {l[\"host\"][\"username\"]}")
'
echo ""
echo "=== DONE ==="
