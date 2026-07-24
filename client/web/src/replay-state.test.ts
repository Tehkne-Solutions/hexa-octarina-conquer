import { describe, expect, it } from "vitest";

import {
  applyReplayEvent,
  buildReplayFrames,
  createQaReplayRecord,
  nearestSignificantFrame,
  replayEventMeta,
  sanitizePublicSnapshot,
} from "./replay-state";

describe("replay state", () => {
  it("reconstructs ordered public frames", () => {
    const replay = createQaReplayRecord();
    const frames = buildReplayFrames(replay);
    expect(frames).toHaveLength(replay.events.length + 1);
    expect(frames.at(-1)?.snapshot.status).toBe("finished");
    expect(frames.at(-1)?.snapshot.board.provinces[0]?.unit.kind).toBe("fortress");
    expect(frames.at(-1)?.snapshot.matchResult?.winnerPlayerId).toBe("kael-player");
  });

  it("keeps only public player information", () => {
    const replay = createQaReplayRecord();
    const snapshot = buildReplayFrames(replay).at(-1)!.snapshot;
    const unsafe = { ...snapshot, players: snapshot.players.map((player) => ({ ...player, hand: ["secret"], sessionToken: "secret" })) } as typeof snapshot;
    const safe = sanitizePublicSnapshot(unsafe);
    expect(safe.players[0]).not.toHaveProperty("hand");
    expect(safe.players[0]).not.toHaveProperty("sessionToken");
    expect(safe.players[0]).toHaveProperty("handSize");
  });

  it("applies only the public room patch", () => {
    const replay = createQaReplayRecord();
    const first = buildReplayFrames({ ...replay, events: replay.events.slice(0, 1) }).at(-1)!.snapshot;
    const next = applyReplayEvent(first, replay.events[1]);
    expect(next.revision).toBe(2);
    expect(next.board.edges).toHaveLength(1);
    expect(next.players[0]).not.toHaveProperty("hand");
  });

  it("maps significant combat and finish events", () => {
    expect(replayEventMeta("duel.resolved")).toMatchObject({ tone: "combat", significant: true });
    expect(replayEventMeta("match.finished")).toMatchObject({ tone: "finish", significant: true });
    expect(replayEventMeta("presence.updated")).toMatchObject({ tone: "connection", significant: false });
  });

  it("jumps between significant revisions", () => {
    const frames = buildReplayFrames(createQaReplayRecord());
    expect(nearestSignificantFrame(frames, 1, 1)).toBeGreaterThan(1);
    expect(nearestSignificantFrame(frames, frames.length - 1, -1)).toBeLessThan(frames.length - 1);
  });
});
