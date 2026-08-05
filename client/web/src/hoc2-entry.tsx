import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { Hoc2Game } from "./hoc2/Hoc2Game";
import "./hoc2/hoc2-network.css";
import "./hoc2/hoc2-remediation.css";

const root = document.getElementById("root");
if (!root) throw new Error("root element was not found");

createRoot(root).render(
  <StrictMode>
    <Hoc2Game />
  </StrictMode>,
);
