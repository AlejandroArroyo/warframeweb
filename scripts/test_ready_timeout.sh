#!/bin/bash
# Test: confirm but NOT ready → should auto-transition after 30s
TS=$(date +%s)

HID=$(curl -s -X POST http://localhost:3001/api/auth/dev-login \
  -H "Content-Type: application/json" -d "{\"username\":\"RT_${TS}_H\"}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["user"]["id"])')
U2=$(curl -s -X POST http://localhost:3001/api/auth/dev-login \
  -H "Content-Type: application/json" -d "{\"username\":\"RT_${TS}_2\"}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["user"]["id"])')
U3=$(curl -s -X POST http://localhost:3001/api/auth/dev-login \
  -H "Content-Type: application/json" -d "{\"username\":\"RT_${TS}_3\"}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["user"]["id"])')
U4=$(curl -s -X POST http://localhost:3001/api/auth/dev-login \
  -H "Content-Type: application/json" -d "{\"username\":\"RT_${TS}_4\"}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["user"]["id"])')

echo "=== Create lobby ==="
LID=$(curl -s -X POST http://localhost:3001/api/lobbies \
  -H "Content-Type: application/json" \
  -d "{\"missionType\":\"Capture\",\"relicEra\":\"Neo\",\"relicName\":\"A5\",\"isRadshare\":true,\"hostId\":\"$HID\"}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
echo "Lobby: $LID"

echo "=== All join ==="
for U in "$U2" "$U3" "$U4"; do
  curl -s -X POST "http://localhost:3001/api/lobbies/$LID/join" \
    -H "Content-Type: application/json" -d "{\"userId\":\"$U\"}" > /dev/null
done
echo "4/4 joined"

echo "=== All confirm (para ir a CONFIRMING) ==="
for U in "$HID" "$U2" "$U3" "$U4"; do
  curl -s -X POST "http://localhost:3001/api/lobbies/$LID/confirm" \
    -H "Content-Type: application/json" -d "{\"userId\":\"$U\",\"refinement\":\"Radiant\"}" > /dev/null
done
echo "All confirmed - should be CONFIRMING now"

# Verificar estado
STATUS=$(curl -s "http://localhost:3001/api/lobbies/$LID" | python3 -c 'import sys,json;print(json.load(sys.stdin)["status"])')
echo "Status ahora: $STATUS"

echo ""
echo "=== Esperar 35s para timeout ==="
echo "NO vamos a hacer ready - el timeout debería pasar a IN_PROGRESS"
sleep 35

STATUS=$(curl -s "http://localhost:3001/api/lobbies/$LID" | python3 -c 'import sys,json;print(json.load(sys.stdin)["status"])')
echo "Status después del timeout: $STATUS"

if [ "$STATUS" = "IN_PROGRESS" ]; then
  echo "✅ READY CHECK TIMEOUT FUNCIONA!"
else
  echo "❌ Timeout falló, estado: $STATUS"
fi
