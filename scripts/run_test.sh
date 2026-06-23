#!/bin/bash
cd /home/alex/proyectos/warframeweb

# Kill old API
fuser -k 3001/tcp 2>/dev/null
sleep 1

# Start API
npm run dev --workspace=packages/api &>/tmp/api_s9.log &
sleep 5

# Check health
curl -s http://localhost:3001/api/health | python3 -c 'import sys,json; print("API:", json.load(sys.stdin)["status"])'

# Run test
cp scripts/test_rotation.sh /tmp/test_rot.sh
chmod +x /tmp/test_rot.sh
bash /tmp/test_rot.sh
