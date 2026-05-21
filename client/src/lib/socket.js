import io from "socket.io-client";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

let socket = null;

export function initSocket() {
  if (!socket) {
    socket = io(API_URL, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });
  }
  return socket;
}

export function identifySocketUser(userId) {
  const activeSocket = getSocket();
  if (userId !== undefined && userId !== null) {
    activeSocket.emit("identify", userId);
  }
  return activeSocket;
}

export function getSocket() {
  return socket || initSocket();
}

export function disconnect() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
