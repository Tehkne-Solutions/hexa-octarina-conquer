import assert from "node:assert/strict";
import test from "node:test";

import { MemoryCompetitionStore } from "../src/competition-memory.js";
import { MemoryGovernanceStore } from "../src/governance-store.js";

test("governance applies cooldowns for expired competitive assignments", async () => {
  let now = 10_000;
  let sequence = 0;
  const idFactory = () => `id-${++sequence}`;
  const competition = new MemoryCompetitionStore({ clock: () => now, idFactory });
  const governance = new MemoryGovernanceStore({ competition, clock: () => now, idFactory });

  competition.matches.set("match-1", {
    id: "match-1",
    hostAccountId: "account-a",
    guestAccountId: "account-b",
    accepted: { "account-a": now - 500 },
    status: "matched",
    expiresAt: now - 1,
  });

  const expired = await governance.expireAssignments();
  assert.equal(expired.length, 1);
  assert.equal(expired[0].accountId, "account-b");
  assert.equal(competition.matches.get("match-1").status, "expired");

  await assert.rejects(
    governance.assertEligible("account-b"),
    (error) => error.code === "MATCHMAKING_COOLDOWN" && error.details.retryAt > now,
  );
  await governance.assertEligible("account-a");

  now += 3 * 60 * 1000;
  await governance.assertEligible("account-b");
});

test("governance creates, activates and closes seasons", async () => {
  const competition = new MemoryCompetitionStore();
  const governance = new MemoryGovernanceStore({ competition });
  const startsAt = Date.now() + 1_000;
  const season = await governance.createSeason({
    id: "season-test-02",
    name: "Temporada de Teste",
    startsAt,
    endsAt: startsAt + 30 * 24 * 60 * 60 * 1000,
  });
  assert.equal(season.status, "planned");
  assert.equal((await governance.activateSeason(season.id)).status, "active");
  assert.equal((await governance.closeSeason(season.id)).status, "closed");
});
