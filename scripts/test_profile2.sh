#!/bin/bash
echo "=== Profile response ==="
curl -s http://localhost:3001/api/users/TestPlayer/profile
echo ""
echo "=== Health ==="
curl -s http://localhost:3001/api/health
