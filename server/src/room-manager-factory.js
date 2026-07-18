import { DistributedRoomManager } from "./distributed-room-manager.js";
import { RoomManager } from "./room-manager.js";

export function createRoomManager(options = {}) {
  const { store } = options;
  if (store?.kind === "postgres") return new DistributedRoomManager(options);
  return new RoomManager(options);
}
