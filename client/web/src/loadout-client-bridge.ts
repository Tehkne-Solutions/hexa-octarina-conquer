import { HexaClient } from "./hexa-client";
import {
  activeLoadout,
  activeLoadoutCardIds,
  readLoadoutCollection,
  updateLoadoutCards,
} from "./loadout-store";

const LEGACY_STARTER = [
  "kael-golpe-runico",
  "kael-guardiao-celeste",
  "lyra-flecha-eter",
  "lyra-passo-lunar",
  "lyra-marca-cacada",
];

const VALID_STARTER = [
  "kael-golpe-runico",
  "kael-golpe-runico",
  "kael-guardiao-celeste",
  "lyra-flecha-eter",
  "lyra-flecha-eter",
];

type LoadoutClientPrototype = HexaClient & {
  __hexaLoadoutBridgeInstalled?: boolean;
};

function sameCardSequence(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((cardId, index) => cardId === right[index]);
}

function migrateStarterLoadout(): void {
  const collection = readLoadoutCollection();
  const deck = activeLoadout(collection);
  if (deck.id === "orun-balanced" && sameCardSequence(deck.cardIds, LEGACY_STARTER)) {
    updateLoadoutCards(deck.id, VALID_STARTER);
  }
}

function injectCampaignLoadout(): void {
  const marker = window as typeof window & { __hexaLoadoutFetchInstalled?: boolean };
  if (marker.__hexaLoadoutFetchInstalled) return;
  marker.__hexaLoadoutFetchInstalled = true;
  const originalFetch = window.fetch.bind(window);

  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const requestUrl = new URL(
        typeof input === "string" || input instanceof URL ? input.toString() : input.url,
        window.location.origin,
      );
      if (requestUrl.pathname === "/campaign/start" && String(init?.method ?? "GET").toUpperCase() === "POST" && typeof init?.body === "string") {
        const payload = JSON.parse(init.body) as Record<string, unknown>;
        return originalFetch(input, {
          ...init,
          body: JSON.stringify({ ...payload, loadout: activeLoadoutCardIds() }),
        });
      }
    } catch {
      // A malformed non-game request must continue through the original fetch implementation.
    }
    return originalFetch(input, init);
  };
}

export function installLoadoutClientBridge(): void {
  migrateStarterLoadout();
  const prototype = HexaClient.prototype as LoadoutClientPrototype;
  if (prototype.__hexaLoadoutBridgeInstalled) return;
  prototype.__hexaLoadoutBridgeInstalled = true;

  prototype.createRoom = function createRoomWithLoadout(playerName: string, boardSize = 5): void {
    const account = this.accountSession;
    this.send("room.create", account
      ? {
        accountId: account.account.id,
        accessToken: account.accessToken,
        boardSize,
        loadout: activeLoadoutCardIds(),
      }
      : {
        playerName,
        boardSize,
        loadout: activeLoadoutCardIds(),
      }, "create-room");
  };

  prototype.joinRoom = function joinRoomWithLoadout(roomId: string, playerName: string): void {
    const account = this.accountSession;
    this.send("room.join", account
      ? {
        roomId,
        accountId: account.account.id,
        accessToken: account.accessToken,
        loadout: activeLoadoutCardIds(),
      }
      : {
        roomId,
        playerName,
        loadout: activeLoadoutCardIds(),
      }, "join-room");
  };

  injectCampaignLoadout();
}
