// frontend/src/context/SocketContext.jsx

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext";

// ─── Context ──────────────────────────────────────────────────────────────────
const SocketContext = createContext(null);

// ─── Socket.IO server URL ─────────────────────────────────────────────────────
const isLocalhost =
  typeof window !== "undefined" && window.location.hostname === "localhost";
const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  import.meta.env.VITE_API_URL ||
  (isLocalhost ? "http://localhost:5000" : "");

export const SocketProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();

  // Internal ref — holds the socket.io-client instance so callbacks always
  // see the latest value without needing it in their dependency arrays.
  const socketRef = useRef(null);

  // FIX (BUG-5): expose the socket instance via state so React re-renders
  // consumers whenever it changes (null → connected → null on logout).
  const [socketInstance, setSocketInstance] = useState(null);

  // Whether the socket is currently connected to the backend.
  const [isConnected, setIsConnected] = useState(false);

  // Whether the socket has successfully joined the user's room.
  const [isRoomJoined, setIsRoomJoined] = useState(false);

  // ── Effect: create / destroy socket based on auth state ────────────────────
  useEffect(() => {
    // Don't connect if the user is not authenticated
    if (!isAuthenticated || !user?._id) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocketInstance(null);
        setIsConnected(false);
        setIsRoomJoined(false);
      }
      return;
    }

    if (!SOCKET_URL) {
      console.warn(
        "Missing VITE_SOCKET_URL/VITE_API_URL. Realtime updates are disabled."
      );
      return;
    }

    // Create socket connection (if one doesn't already exist)
    if (!socketRef.current) {
      const socket = io(SOCKET_URL, {
        // Use polling first, upgrade to WebSocket — works through most proxies
        transports: ["polling", "websocket"],

        // Send JWT in handshake so the backend can optionally verify it
        auth: {
          token: localStorage.getItem("token"),
        },

        // Auto-reconnect settings
        reconnection:        true,
        reconnectionAttempts: Infinity,
        reconnectionDelay:    2000,
        reconnectionDelayMax: 10000,
      });

      socketRef.current = socket;

      // ── CONNECT ────────────────────────────────────────────────────────────
      socket.on("connect", () => {
        console.log("🔌 Socket.IO connected:", socket.id);
        setIsConnected(true);
        // FIX (BUG-5): push the live instance into state so consumers re-render
        setSocketInstance(socket);
        // Join the user-specific room so the backend only sends this user's data
        socket.emit("join", { userId: user._id });
      });

      // ── ROOM JOINED ACKNOWLEDGEMENT ────────────────────────────────────────
      socket.on("joined", ({ room }) => {
        console.log("📦 Socket.IO room joined:", room);
        setIsRoomJoined(true);
      });

      // ── DISCONNECT ─────────────────────────────────────────────────────────
      socket.on("disconnect", (reason) => {
        console.warn("🔌 Socket.IO disconnected:", reason);
        setIsConnected(false);
        setIsRoomJoined(false);
        // Keep socketInstance set so consumers can still call .connect() etc.
        // It will be set to null only when the user actually logs out (cleanup below).
      });

      // ── RECONNECT ──────────────────────────────────────────────────────────
      socket.on("reconnect", (attempt) => {
        console.log(`🔄 Socket.IO reconnected after ${attempt} attempt(s)`);
        setIsConnected(true);
        // Re-join the room after reconnect
        socket.emit("join", { userId: user._id });
      });

      // ── CONNECT ERROR ──────────────────────────────────────────────────────
      socket.on("connect_error", (err) => {
        console.error("❌ Socket.IO connect error:", err.message);
        setIsConnected(false);
      });
    }

    // ── Cleanup: disconnect when user logs out or component unmounts ──────────
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocketInstance(null);
        setIsConnected(false);
        setIsRoomJoined(false);
      }
    };
    // Only re-run when auth state changes
  }, [isAuthenticated, user?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Expose context value ────────────────────────────────────────────────────
  // `socket`    — reactive: null until connected, then the live instance.
  //               Consumers can use this directly in useEffect deps.
  // `getSocket` — stable function for cases where you need the ref inside a
  //               callback without adding it to a dependency array.
  const value = {
    socket:    socketInstance,                // FIX (BUG-5): reactive state, not stale ref
    getSocket: () => socketRef.current,       // stable ref accessor
    isConnected,
    isRoomJoined,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

// =============================================================================
// useSocket  — convenience hook
// =============================================================================
export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket must be used inside a <SocketProvider>");
  }
  return context;
};

export default SocketContext;
