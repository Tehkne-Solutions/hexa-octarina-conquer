const INTENT_SELECTORS = {
  Varg: ".strategic-unit.unit-varg",
  Brakk: ".strategic-unit.unit-brakk",
};

function classifyIntent(segment) {
  const text = segment.toLocaleLowerCase("pt-BR");
  if (/atac|pression|força a linha/.test(text)) return "PRESSIONANDO";
  if (/fortific|sustenta|torre/.test(text)) return "FORTIFICANDO";
  if (/reposicion|explora|avanç|expand|rede/.test(text)) return "AVANÇANDO";
  if (/confront|frente|rota disputada|retomou/.test(text)) return "DISPUTANDO ROTA";
  if (/região|fechou/.test(text)) return "CONSOLIDANDO";
  return "EM MOVIMENTO";
}

function latestEnemyIntent() {
  const entries = [...document.querySelectorAll(".strategic-objectives ol li")];
  for (const entry of entries) {
    const text = (entry.textContent || "").trim();
    const vargIndex = text.lastIndexOf("Varg");
    const brakkIndex = text.lastIndexOf("Brakk");
    const lastIndex = Math.max(vargIndex, brakkIndex);
    if (lastIndex < 0) continue;

    const unitName = brakkIndex > vargIndex ? "Brakk" : "Varg";
    const tail = text.slice(lastIndex);
    const sentence = tail.split(/[.!?]/)[0] || tail;
    return { unitName, label: classifyIntent(sentence) };
  }
  return null;
}

function renderIntent() {
  const root = document.querySelector("main.strategic-slice");
  if (!root) return;

  for (const selector of Object.values(INTENT_SELECTORS)) {
    const token = root.querySelector(selector);
    if (token) {
      token.removeAttribute("data-enemy-intent");
      token.classList.remove("has-enemy-intent");
    }
  }

  const intent = latestEnemyIntent();
  if (!intent) return;

  const token = root.querySelector(INTENT_SELECTORS[intent.unitName]);
  if (!token) return;
  token.dataset.enemyIntent = intent.label;
  token.classList.add("has-enemy-intent");
}

let scheduled = false;
function scheduleRender() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    renderIntent();
  });
}

const observer = new MutationObserver(scheduleRender);
observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true });
window.addEventListener("hoc:enemy-intent-refresh", scheduleRender);
scheduleRender();
