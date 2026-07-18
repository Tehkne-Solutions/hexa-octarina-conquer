import assert from "node:assert/strict";
import test from "node:test";

import { MemoryCompetitionStore } from "../src/competition-memory.js";
import { MemoryIdentityStore } from "../src/identity-memory.js";

function ids() {
  let value = 0;
  return () => `00000000-0000-0000-0000-${String(++value).padStart(12, "0")}`;
}

test("pairs nearby ratings and exposes the same assignment to both accounts", async () => {
  let now = 1_800_000_000_000;
  const idFactory = ids();
  const identity = new MemoryIdentityStore({ clock: () => now, idFactory });
  const competition = new MemoryCompetitionStore({ clock: () => now, idFactory });
  const first = await identity.register({ handle: "alpha", displayName: "Alpha", password: "password-alpha" });
  const second = await identity.register({ handle: "beta", displayName: "Beta", password: "password-beta" });

  const queued = await competition.enqueue({ account: first.account, region: "br", boardSize: 5 });
  assert.equal(queued.state, "queued");
  now += 1_000;
  const matched = await competition.enqueue({ account: second.account, region: "br", boardSize: 5 });
  assert.equal(matched.state, "matched");
  assert.equal(matched.role, "guest");

  const hostState = await competition.status(first.account.id);
  assert.equal(hostState.state, "matched");
  assert.equal(hostState.role, "host");
  assert.equal(hostState.match.id, matched.match.id);
  assert.equal(hostState.match.roomId, matched.match.roomId);

  const hostAccepted = await competition.accept(first.account.id, matched.match.id);
  const guestAccepted = await competition.accept(second.account.id, matched.match.id);
  assert.equal(hostAccepted.role, "host");
  assert.equal(guestAccepted.role, "guest");
});

test("records season progression separately from the global profile", async () => {
  const idFactory = ids();
  const identity = new MemoryIdentityStore({ idFactory });
  const competition = new MemoryCompetitionStore({ idFactory });
  const winnerSession = await identity.register({ handle: "winner", displayName: "Winner", password: "password-winner" });
  const loserSession = await identity.register({ handle: "loser", displayName: "Loser", password: "password-loser" });

  await competition.enqueue({ account: winnerSession.account });
  await competition.enqueue({ account: loserSession.account });
  const progression = await identity.recordMatch({
    roomId: "SEASON01",
    winnerAccountId: winnerSession.account.id,
    loserAccountId: loserSession.account.id,
    reason: "forfeit",
  });
  const recorded = await competition.recordSeasonMatch({ roomId: "SEASON01" }, progression);
  assert.equal(recorded.recorded, true);

  const leaderboard = await competition.seasonLeaderboard();
  assert.equal(leaderboard.length, 2);
  assert.equal(leaderboard[0].accountId, winnerSession.account.id);
  assert.equal(leaderboard[0].wins, 1);
  assert.equal(leaderboard[1].losses, 1);
});

test("consumes a one-time recovery code and invalidates old sessions", async () => {
  const identity = new MemoryIdentityStore();
  const competition = new MemoryCompetitionStore();
  const original = await identity.register({ handle: "recover_me", displayName: "Recover Me", password: "old-password" });
  const accountId = await identity.findAccountIdByHandle("recover_me");
  const challenge = await competition.createRecovery(accountId);

  await competition.consumeRecovery(accountId, challenge.recoveryCode);
  const recovered = await identity.resetPassword(accountId, "new-password");
  assert.equal(recovered.account.id, accountId);
  await assert.rejects(
    identity.authenticate(accountId, original.accessToken),
    (error) => error.code === "INVALID_ACCOUNT_SESSION",
  );
  const login = await identity.login({ handle: "recover_me", password: "new-password" });
  assert.equal(login.account.id, accountId);
  await assert.rejects(
    competition.consumeRecovery(accountId, challenge.recoveryCode),
    (error) => error.code === "RECOVERY_INVALID",
  );
});
