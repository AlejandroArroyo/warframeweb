#!/bin/bash
set -e

echo "=== Login user1 ==="
USER1_RESP=$(curl -s -X POST http://localhost:3001/api/auth/dev-login -H "Content-Type: application/json" -d '{"username":"testnotif1"}')
USER1=$(echo "$USER1_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['user']['id'])")
echo "User1 ID: $USER1"

echo "=== Login user2 ==="
USER2_RESP=$(curl -s -X POST http://localhost:3001/api/auth/dev-login -H "Content-Type: application/json" -d '{"username":"testnotif2"}')
USER2=$(echo "$USER2_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['user']['id'])")
echo "User2 ID: $USER2"

echo "=== Create lobby as user1 ==="
LOBBY_RESP=$(curl -s -X POST http://localhost:3001/api/lobbies -H "Content-Type: application/json" -d "{\"missionType\":\"Capture\",\"relicEra\":\"Lith\",\"relicName\":\"Aya\",\"isRadshare\":false,\"isRotation\":false,\"hostId\":\"$USER1\"}")
LOBBY=$(echo "$LOBBY_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "Lobby: $LOBBY"

echo "=== User2 joins ==="
JOIN_RESP=$(curl -s -X POST "http://localhost:3001/api/lobbies/$LOBBY/join" -H "Content-Type: application/json" -d "{\"userId\":\"$USER2\"}")
echo "Join response: $JOIN_RESP"

echo "=== Check lobby participants ==="
curl -s "http://localhost:3001/api/lobbies/$LOBBY" -H "Content-Type: application/json" | python3 -c "import sys,json; d=json.load(sys.stdin); print('Participants:', d['participantCount']); [print(' -', p['user']['username']) for p in d['participants']]"

echo ""
echo "=== TEST OK ==="
