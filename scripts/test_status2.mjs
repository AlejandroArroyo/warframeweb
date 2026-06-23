// Test: status-changed event (radshare lobby)
import { io } from "socket.io-client";

const BASE = "http://localhost:3001";

async function api(method, path, body) {
  const r = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(`${method} ${path}: ${r.status} ${JSON.stringify(data)}`);
  return data;
}

async function main() {
  const s = String(Date.now()).slice(-5);
  const users = [];
  for (let i = 1; i <= 4; i++) {
    users.push(await api("POST", "/api/auth/dev-login", { username: `statusT_${s}_${i}` }));
  }
  console.log("Users created");

  const lobby = await api("POST", "/api/lobbies", {
    missionType: "Spy", relicEra: "Neo", relicName: "Aya",
    isRadshare: true, isRotation: false,
    hostId: users[0].user.id,
  });
  console.log("Lobby:", lobby.id, "(radshare)");

  // Join other 3
  for (let i = 1; i < 4; i++) {
    await api("POST", `/api/lobbies/${lobby.id}/join`, { userId: users[i].user.id });
  }
  console.log("All 4 joined");

  const sock = io(BASE, { transports: ["websocket"] });
  await new Promise((r) => sock.once("connect", r));

  const statusReceived = new Promise((res, rej) => {
    setTimeout(() => rej("timeout"), 5000);
    sock.on("lobby:status-changed", (d) => {
      console.log("STATUS EVENT:", JSON.stringify(d));
      res(d);
    });
  });

  console.log("Confirming all with Radiant...");
  for (const u of users) {
    await api("POST", `/api/lobbies/${lobby.id}/confirm`, {
      userId: u.user.id, relicName: "Aya", refinement: "Radiant",
    });
    console.log(`  ${u.user.username} confirmed`);
  }

  try {
    const evt = await statusReceived;
    console.log("\n✅ STATUS-CHANGED received:", evt.status);
  } catch (e) {
    console.log("\n❌", e);
  }

  sock.disconnect();
}

main().catch(console.error);
