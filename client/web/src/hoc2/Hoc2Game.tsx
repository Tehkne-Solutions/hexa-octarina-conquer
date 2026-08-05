import { useState } from "react";

import { HexaOverlay, type HexaFilter } from "./HexaOverlay";
import { LivingMap, type Hoc2Hex } from "./LivingMap";
import { useHoc2Camera } from "./MapCamera";
import "./hoc2.css";

const SANDBOX_HEXES: Hoc2Hex[] = [
  { q: 0, r: 0, terrain: "plain", owner: "alliance", landmark: "city", label: "Aldor" },
  { q: 1, r: 0, terrain: "plain", owner: "alliance" },
  { q: 2, r: 0, terrain: "road", owner: "neutral", landmark: "bridge", label: "Velmar" },
  { q: 3, r: 0, terrain: "plain", owner: "neutral", landmark: "mine", label: "Mina" },
  { q: 4, r: 0, terrain: "plain", owner: "rubra" },
  { q: 5, r: 0, terrain: "mountain", owner: "rubra", landmark: "fortress", label: "Fortaleza" },
  { q: 0, r: 1, terrain: "forest", owner: "alliance" },
  { q: 1, r: 1, terrain: "forest", owner: "alliance" },
  { q: 2, r: 1, terrain: "road", owner: "neutral" },
  { q: 3, r: 1, terrain: "plain", owner: "neutral", landmark: "octarina", label: "Núcleo" },
  { q: 4, r: 1, terrain: "plain", owner: "rubra" },
  { q: 5, r: 1, terrain: "mountain", owner: "rubra" },
  { q: -1, r: 2, terrain: "forest", owner: "alliance" },
  { q: 0, r: 2, terrain: "plain", owner: "alliance" },
  { q: 1, r: 2, terrain: "plain", owner: "neutral" },
  { q: 2, r: 2, terrain: "water", owner: "neutral" },
  { q: 3, r: 2, terrain: "plain", owner: "neutral" },
  { q: 4, r: 2, terrain: "plain", owner: "rubra" },
  { q: -1, r: 3, terrain: "plain", owner: "alliance" },
  { q: 0, r: 3, terrain: "plain", owner: "neutral" },
  { q: 1, r: 3, terrain: "water", owner: "neutral" },
  { q: 2, r: 3, terrain: "water", owner: "neutral" },
  { q: 3, r: 3, terrain: "plain", owner: "rubra" },
  { q: 4, r: 3, terrain: "mountain", owner: "rubra" },
];

export function Hoc2Game() {
  const camera = useHoc2Camera();
  const [hexaMode, setHexaMode] = useState(false);
  const [hexaFilter, setHexaFilter] = useState<HexaFilter>("domain");

  return (
    <main className={`hoc2-shell${hexaMode ? " is-hexa-mode" : ""}`}>
      <header className="hoc2-topbar">
        <div className="hoc2-brand"><strong>HOC</strong><span>Hexa Octarina Conquer</span></div>
        <div className="hoc2-phase"><span>HOC2 VS01-C</span><strong>{hexaMode ? "Strategic Hexa View" : "Living Map Sandbox"}</strong></div>
        <button type="button" onClick={camera.focusCenter}>Centralizar</button>
      </header>
      <section className="hoc2-map-viewport" {...camera.handlers}>
        <div className="hoc2-map-camera" style={{ transform: camera.transform }}>
          <LivingMap hexes={SANDBOX_HEXES} hexaMode={hexaMode} hexaFilter={hexaFilter} />
        </div>
        <HexaOverlay active={hexaMode} filter={hexaFilter} onToggle={() => setHexaMode((value) => !value)} onFilter={setHexaFilter} />
        <aside className="hoc2-camera-help" aria-label="Controles da câmera">
          <strong>{hexaMode ? "Visão estratégica" : "Câmera"}</strong>
          <span>Roda: zoom</span>
          <span>WASD / setas: navegar</span>
          <span>Shift + arrastar ou botão do meio: pan</span>
          <span>Bordas: edge scrolling</span>
          <small>Zoom {camera.camera.zoom.toFixed(2)}×</small>
        </aside>
        {hexaMode ? <div className="hoc2-mode-note" role="status">DOMÍNIO · Aliança, Rubra e território neutro sobre o mesmo Mapa Vivo</div> : null}
      </section>
      <footer className="hoc2-footer">Tehkné Solutions</footer>
    </main>
  );
}
