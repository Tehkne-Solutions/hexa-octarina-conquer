import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";

import { App } from "./App";
import "./styles.css";
import "./first-play.css";
import "./board-entities.css";

registerSW({ immediate: true });

const root = document.getElementById("root");
if (!root) throw new Error("root element was not found");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
