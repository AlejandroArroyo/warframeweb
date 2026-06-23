// Test: WebSocket notification events
import { io } from "socket.io-client";

const BASE = "http://localhost:3001";

async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`${method} ${path} ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

async function main() {
  const suffix = String(Date.now()).slice(-6);
  console.log("=== Creating users ===");
  const userA = await api("POST", "/api/auth/dev-login", { username: `wstestA_${suffix}` });
  const userB = await api("POST", "/api/auth/dev-login", { username: `wstestB_${suffix}` });
  console.log("User A:", userA.user.id);
  console.log("User B:", userB.user.id);

  // Connect User A via WebSocket
  console.log("\n=== Connecting User A WebSocket ===");
  const socketA = io(BASE, {
    transports: ["websocket"],
  });
  await new Promise((resolve) => socketA.once("connect", resolve));
  console.log("User A connected:", socketA.id);

  // Create lobby as User A
  console.log("\n=== Creating lobby ===");
  const lobby = await api("POST", "/api/lobbies", {
    missionType: "Capture",
    relicEra: "Lith",
    relicName: "Aya",
    isRadshare: false,
    isRotation: false,
    hostId: userA.user.id,
  });
  console.log("Lobby ID:", lobby.id);

  // Listen for participant-joined event
  console.log("\n=== Setting up event listener ===");
  const eventReceived = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("TIMEOUT: event not received within 8s")), 8000);
    socketA.on("lobby:participant-joined", (data) => {
      clearTimeout(timeout);
      console.log("\n✅ RECEIVED lobby:participant-joined:", JSON.stringify(data, null, 2));
      resolve(data);
    });
    socketA.on("lobby:updated", (data) => {
      console.log("📦 lobby:updated received for lobby", data?.id);
    });
    console.log("Listener registered, now joining...");
  });

  // Join as User B
  console.log("\n=== Joining as User B ===");
  const joinResult = await api("POST", `/api/lobbies/${lobby.id}/join`, { userId: userB.user.id });
  console.log("Join result:", JSON.stringify(joinResult));

  // Wait for event
  try {
    const evt = await eventReceived;
    console.log("\n✅ TEST PASSED: Notification event received!");
  } catch (e) {
    console.log("\n❌ TEST FAILED:", e.message);
  }

  socketA.disconnect();
}

main().catch(console.error);
