import { describe, expect, it } from "vitest";

import {
  INITIAL_PWA_RUNTIME_SNAPSHOT,
  mergePwaRuntimeSnapshot,
} from "./pwa-lifecycle";

describe("PWA runtime state", () => {
  it("keeps previous fields while applying a lifecycle patch", () => {
    const registered = mergePwaRuntimeSnapshot(INITIAL_PWA_RUNTIME_SNAPSHOT, {
      registrationReady: true,
      offlineReady: true,
    });
    const update = mergePwaRuntimeSnapshot(registered, { updateAvailable: true });

    expect(update).toEqual({
      updateAvailable: true,
      offlineReady: true,
      registrationReady: true,
      registrationError: null,
      lastCheckedAt: null,
    });
  });

  it("records registration failures without disabling offline data", () => {
    const state = mergePwaRuntimeSnapshot({
      ...INITIAL_PWA_RUNTIME_SNAPSHOT,
      offlineReady: true,
    }, {
      registrationError: "service worker unavailable",
    });

    expect(state.offlineReady).toBe(true);
    expect(state.registrationError).toContain("unavailable");
  });
});
