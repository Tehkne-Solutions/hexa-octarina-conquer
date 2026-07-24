import { describe, expect, it } from "vitest";

import { prefetchTargetFromIntent } from "./screen-prefetch";

describe("prefetchTargetFromIntent", () => {
  it("maps campaign and profile actions", () => {
    expect(prefetchTargetFromIntent("Abrir campanha")).toBe("campaign");
    expect(prefetchTargetFromIntent("Ver progresso")).toBe("profile");
  });

  it("maps mobile and desktop navigation labels", () => {
    expect(prefetchTargetFromIntent("Multiplayer")).toBe("multiplayer");
    expect(prefetchTargetFromIntent("Cartas")).toBe("collection");
    expect(prefetchTargetFromIntent("Coleção")).toBe("collection");
  });

  it("ignores unrelated controls", () => {
    expect(prefetchTargetFromIntent("Abrir configurações")).toBeNull();
    expect(prefetchTargetFromIntent("Voltar")).toBeNull();
  });
});
