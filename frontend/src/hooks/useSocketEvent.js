// frontend/src/hooks/useSocketEvent.js
// =============================================================================
// useSocketEvent — reusable hook for Socket.IO event subscriptions
// =============================================================================
// Subscribes to a named Socket.IO event and calls the handler whenever
// the event fires.  Automatically:
//   • Cleans up the listener when the component unmounts
//   • Re-subscribes if the socket instance changes (e.g. after reconnect)
//   • Does nothing if the socket is null (not yet connected)
//
// Usage:
//   useSocketEvent('sensorData', (data) => {
//     setLatestReading(data);
//   });
//
//   useSocketEvent('deviceStatus', ({ deviceId, status }) => {
//     setDeviceStatus(status);
//   });
// =============================================================================

import { useEffect } from "react";
import { useSocket } from "../context/SocketContext";

/**
 * @param {string}   eventName  - The Socket.IO event name to listen for
 * @param {Function} handler    - Callback invoked with the event payload
 * @param {Array}    deps       - Extra dependencies that should re-register the listener
 */
function useSocketEvent(eventName, handler, deps = []) {
  const { socket } = useSocket();

  useEffect(() => {
    // Don't register if socket isn't ready
    if (!socket || !eventName || typeof handler !== "function") return;

    socket.on(eventName, handler);

    // Cleanup: remove listener when component unmounts or deps change
    return () => {
      socket.off(eventName, handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, eventName, ...deps]);
}

export default useSocketEvent;