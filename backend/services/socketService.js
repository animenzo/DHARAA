// backend/services/socketService.js
// =============================================================================
// Socket.IO Service
// =============================================================================
// Responsibilities:
//   • Handle client connect / disconnect lifecycle
//   • Organise clients into per-user rooms so broadcasts are targeted
//   • Expose helper to emit events from anywhere in the backend
//   • Bridge MQTT sensor data → connected React dashboards (Phase 8)
//
// Room naming convention:
//   user:{userId}          ← all browser tabs for one user
//   device:{deviceId}      ← future: per-device granularity
// =============================================================================

let _io = null; // module-level reference so emitToUser() works anywhere

// =============================================================================
// initSocketService
// Called once from index.js with the Socket.IO Server instance.
// =============================================================================
function initSocketService(io) {
  _io = io;

  io.on("connection", (socket) => {
    const clientId = socket.id;
    console.log(`🔌 Socket connected: ${clientId}`);

    // ── JOIN USER ROOM ────────────────────────────────────────────────────────
    // The React client emits "join" with its userId immediately after connecting.
    // This puts the socket into a room named "user:{userId}" so that MQTT
    // messages for that user are delivered only to their browser tabs.
    //
    // Security: we trust the userId here because the React client obtained it
    // from a JWT-authenticated /auth/profile call. In a stricter setup you
    // would verify a socket JWT here using socket.handshake.auth.token.
    socket.on("join", ({ userId }) => {
      if (!userId) {
        console.warn(`⚠️  Socket ${clientId} sent join without userId`);
        return;
      }

      const room = `user:${userId}`;
      socket.join(room);
      console.log(`📦 Socket ${clientId} joined room: ${room}`);

      // Acknowledge so the React client knows the room is ready
      socket.emit("joined", { room, status: "ok" });
    });

    // ── JOIN DEVICE ROOM (optional granular subscription) ────────────────────
    socket.on("joinDevice", ({ deviceId }) => {
      if (!deviceId) return;
      const room = `device:${deviceId}`;
      socket.join(room);
      socket.emit("joinedDevice", { room, status: "ok" });
    });

    // ── LEAVE DEVICE ROOM ────────────────────────────────────────────────────
    socket.on("leaveDevice", ({ deviceId }) => {
      if (!deviceId) return;
      socket.leave(`device:${deviceId}`);
    });

    // ── DISCONNECT ───────────────────────────────────────────────────────────
    socket.on("disconnect", (reason) => {
      console.log(`🔌 Socket disconnected: ${clientId} — reason: ${reason}`);
    });

    // ── PING / PONG (connection health check from client) ────────────────────
    socket.on("ping", () => {
      socket.emit("pong", { ts: Date.now() });
    });
  });

  console.log("✅ Socket.IO service initialised");
}

// =============================================================================
// emitToUser
// Emit an event to ALL browser tabs belonging to a specific user.
// Call from mqttService, iotController, or any other backend service.
//
// Usage:
//   emitToUser(userId, "sensorData", { moisture: 45, temperature: 31 });
//   emitToUser(userId, "deviceStatus", { status: "offline" });
// =============================================================================
function emitToUser(userId, event, data) {
  if (!_io) {
    console.warn("⚠️  emitToUser called before Socket.IO was initialised");
    return;
  }
  _io.to(`user:${userId}`).emit(event, data);
}

// =============================================================================
// emitToDevice
// Emit an event to all clients subscribed to a specific device room.
// =============================================================================
function emitToDevice(deviceId, event, data) {
  if (!_io) return;
  _io.to(`device:${deviceId}`).emit(event, data);
}

// =============================================================================
// emitToAll
// Broadcast to every connected client. Use sparingly.
// =============================================================================
function emitToAll(event, data) {
  if (!_io) return;
  _io.emit(event, data);
}

// =============================================================================
// getConnectedCount
// Returns number of currently connected sockets (for monitoring).
// =============================================================================
async function getConnectedCount() {
  if (!_io) return 0;
  const sockets = await _io.fetchSockets();
  return sockets.length;
}

module.exports = {
  initSocketService,
  emitToUser,
  emitToDevice,
  emitToAll,
  getConnectedCount,
};