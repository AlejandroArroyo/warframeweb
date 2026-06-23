#!/bin/bash
# Create a run for TestPlayer to test profile stats
HOST="TP_$(date +%s)"
P2="TP2_$(date +%s)"

# Login
HID=$(curl -s -X POST http://localhost:3001/api/auth/dev-login \
  -H "Content-Type: application/json" -d "{\"username\":\"$HOST\"}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["user"]["id"])')
U2=$(curl -s -X POST http://localhost:3001/api/auth/dev-login \
  -H "Content-Type: application/json" -d "{\"username\":\"$P2\"}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["user"]["id"])')

echo "=== Create lobby ==="
LID=$(curl -s -X POST http://localhost:3001/api/lobbies \
  -H "Content-Type: application/json" \
  -d "{\"missionType\":\"Capture\",\"relicEra\":\"Neo\",\"relicName\":\"A5\",\"isRadshare\":true,\"hostId\":\"$HID\"}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
echo "Lobby: $LID"

echo "=== Join ==="
curl -s -X POST "http://localhost:3001/api/lobbies/$LID/join" \
  -H "Content-Type: application/json" \
  -d "{\"userId\":\"$U2\"}" > /dev/null
echo "Joined"

echo "=== Complete run ==="
curl -s -X PATCH "http://localhost:3001/api/lobbies/$LID/status" \
  -H "Content-Type: application/json" -d "{\"status\":\"CONFIRMING\",\"userId\":\"$HID\"}" > /dev/null
curl -s -X PATCH "http://localhost:3001/api/lobbies/$LID/status" \
  -H "Content-Type: application/json" -d "{\"status\":\"IN_PROGRESS\",\"userId\":\"$HID\"}" > /dev/null
curl -s -X PATCH "http://localhost:3001/api/lobbies/$LID/status" \
  -H "Content-Type: application/json" -d "{\"status\":\"CLOSED\",\"userId\":\"$HID\"}" > /dev/null
echo "Run completed"

echo ""
echo "=== Profile for $HOST ==="
curl -s "http://localhost:3001/api/users/$HOST/profile" | python3 -c '
import sys,json
d=json.load(sys.stdin)
print("User:", d["user"]["username"])
print("Total runs:", d["stats"]["totalRuns"])
print("Completed:", d["stats"]["completedRuns"])
print("Runs by era:", json.dumps(d["stats"]["runsByEra"]))
print("Runs by mission:", json.dumps(d["stats"]["runsByMission"]))
print("Top relic:", d["stats"]["topRelic"])
print("Streak:", d["stats"]["currentStreak"])
'

echo ""
echo "=== Profile for $P2 ==="
curl -s "http://localhost:3001/api/users/$P2/profile" | python3 -c '
import sys,json
d=json.load(sys.stdin)
print("User:", d["user"]["username"])
print("Total runs:", d["stats"]["totalRuns"])
print("Completed:", d["stats"]["completedRuns"])
print("Reputation:", d["stats"]["reputation"])
'
