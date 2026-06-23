// Test: participant-left event
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
  const uA = await api("POST", "/api/auth/dev-login", { username: "testL_" + s + "A" });
  const uB = await api("POST", "/api/auth/dev-login", { username: "testL_" + s + "B" });
  const lobby = await api("POST", "/api/lobbies", {
    missionType: "Survival", relicEra: "Meso", isRadshare: false, hostId: uA.user.id,
  });
  console.log("Lobby:", lobby.id);

  const sock = io(BASE, { transports: ["websocket"] });
  await new Promise((r) => sock.once("connect", r));

  // Listen for join (to verify we're connected) and leave
  const leaveReceived = new Promise((res, rej) => {
    setTimeout(() => rej("timeout"), 5000);
    sock.on("lobby:participant-left", (d) => { console.log("LEFT:", JSON.stringify(d)); res(d); });
  });

  await api("POST", "/api/lobbies/" + lobby.id + "/join", { userId: uB.user.id });
  console.log("Joined, now leaving...");
  await api("POST", "/api/lobbies/" + lobby.id + "/leave", { userId: uB.user.id });

  try {
    await leaveReceived;
    console.log("✅ LEFT event received");
  } catch (e) {
    console.log("❌", e);
  }

  sock.disconnect();
}

main().catch(console.error);
