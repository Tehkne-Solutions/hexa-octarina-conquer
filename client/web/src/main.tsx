import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";

import { App } from "./App";
import { LivingBoardDemo } from "./LivingBoardDemo";
import "./styles.css";
import "./first-play.css";
import "./board-entities.css";
import "./living-board.css";
import "./living-board-playtest.css";
import "./living-board-launcher.css";

registerSW({ immediate: true });

const root = document.getElementById("root");
if (!root) throw new Error("root element was not found");

const pageUrl = new URL(window.location.href);
const livingBoardActive = pageUrl.searchParams.get("mode") === "living-board";

function navigateToLivingBoard() {
  const url = new URL(window.location.href);
  url.searchParams.set("mode", "living-board");
  window.location.assign(url);
}

function leaveLivingBoard() {
  const url = new URL(window.location.href);
  url.searchParams.delete("mode");
  window.location.assign(url);
}

createRoot(root).render(
  <StrictMode>
    {livingBoardActive ? (
      <LivingBoardDemo playerName="Arquiteto" onBack={leaveLivingBoard} />
    ) : (
      <>
        <App />
        <button className="living-board-launcher" onClick={navigateToLivingBoard}>
          <span>✦</span>
          <div><strong>Testar GDD 2.0</strong><small>A Ponte das Cinzas</small></div>
        </button>
      </>
    )}
  </StrictMode>,
);
