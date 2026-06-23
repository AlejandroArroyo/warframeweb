#!/bin/bash
curl -s http://localhost:3001/api/users/TestPlayer/profile | python3 -c '
import sys,json
d=json.load(sys.stdin)
print("User:", d["user"]["username"])
print("Reputation:", d["stats"]["reputation"])
print("Total runs:", d["stats"]["totalRuns"])
print("Completed:", d["stats"]["completedRuns"])
print("Runs by era:", json.dumps(d["stats"]["runsByEra"]))
print("Top relic:", d["stats"]["topRelic"])
print("Streak:", d["stats"]["currentStreak"])
print("Recent runs:", len(d["recentRuns"]))
'
