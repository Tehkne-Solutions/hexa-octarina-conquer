import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";

import { App as LegacyApp } from "./App";
import { GameApp } from "./GameApp";
import "./styles.css";
import "./first-play.css";
import "./board-entities.css";
import "./living-board.css";
import "./living-board-playtest.css";
import "./go-dots-living-board.css";
import "./unified-game.css";
import "./sprint-ui-02.css";

registerSW({ immediate: true });

const root = document.getElementById("root");
if (!root) throw new Error("root element was not found");

const pageUrl = new URL(window.location.href);
const legacyRequested = pageUrl.searchParams.get("dev-client") === "legacy";
const legacyAllowed = import.meta.env.DEV || import.meta.env.VITE_ENABLE_LEGACY_CLIENT === "true";

createRoot(root).render(
  <StrictMode>
    {legacyRequested && legacyAllowed ? <LegacyApp /> : <GameApp />}
  </StrictMode>,
);
