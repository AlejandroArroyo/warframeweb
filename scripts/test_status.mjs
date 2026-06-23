// Test: status-changed event
import { io } from "socket.io-client";

const BASE = "http://localhost:3001";

async function api(method, path, body) {
  const r = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.json();
}

async function main() {
  const s = String(Date.now()).slice(-5);
  const u1 = await api("POST", "/api/auth/dev-login", { username: "testS_" + s + "1" });
  const u2 = await api("POST", "/api/auth/dev-login", { username: "testS_" + s + "2" });
  const lobby = await api("POST", "/api/lobbies", {
    missionType: "Spy", relicEra: "Neo", isRadshare: false, hostId: u1.user.id,
  });
  console.log("Lobby:", lobby.id);

  // Add 3 more players to fill
  const u3 = await api("POST", "/api/auth/dev-login", { username: "testS_" + s + "3" });
  const u4 = await api("POST", "/api/auth/dev-login", { username: "testS_" + s + "4" });

  await api("POST", "/api/lobbies/" + lobby.id + "/join", { userId: u2.user.id });
  await api("POST", "/api/lobbies/" + lobby.id + "/join", { userId: u3.user.id });
  await api("POST", "/api/lobbies/" + lobby.id + "/join", { userId: u4.user.id });

  const sock = io(BASE, { transports: ["websocket"] });
  await new Promise((r) => sock.once("connect", r));

  // Listen for status change to CONFIRMING
  const statusReceived = new Promise((res, rej) => {
    setTimeout(() => rej("timeout"), 5000);
    sock.on("lobby:status-changed", (d) => {
      console.log("STATUS:", JSON.stringify(d));
      if (d.status === "CONFIRMING") res(d);
    });
  });

  console.log("All joined, confirming all...");
  // All confirm (including host)
  for (const uid of [u1.user.id, u2.user.id, u3.user.id, u4.user.id]) {
    await api("POST", "/api/lobbies/" + lobby.id + "/confirm", { userId: uid, refinement: "Intact" });
  }

  try {
    await statusReceived;
    console.log("✅ STATUS-CHANGED to CONFIRMING received");
  } catch (e) {
    console.log("❌", e);
  }

  sock.disconnect();
}

main().catch(console.error);
