import { RoomManager } from "./room-manager.js";
import { createRoomStore } from "./room-store.js";
import { startServer } from "./server.js";

const port = Number.parseInt(process.env.PORT ?? "8080", 10);
const store = createRoomStore();
const manager = new RoomManager({ store });
const server = startServer({ port, manager });

console.log(`Hexa Octarina Conquer server listening on http://0.0.0.0:${port}`);
console.log(`WebSocket endpoint: ws://0.0.0.0:${port}/ws`);
console.log(`Restored rooms: ${manager.rooms.size}`);
console.log(`Room store: ${store.kind}${store.filename ? ` (${store.filename})` : ""}`);
console.log("Tehkné Solutions");

function shutdown(signal) {
  console.log(`Received ${signal}; shutting down.`);
  server.close().finally(() => process.exit(0));
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
