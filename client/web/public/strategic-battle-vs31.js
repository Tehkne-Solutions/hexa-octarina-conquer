const ROOT_SELECTOR = ".strategic-slice.meta08-physical-world";
const BOARD_SELECTOR = ".strategic-board";
const NARRATIVE_SELECTOR = ".strategic-field-narrative";

let sequenceToken = 0;

function rosterNames(root, ownerClass) {
  return [...root.querySelectorAll(`.strategic-roster-card.${ownerClass}`)]
    .map((card) => card.querySelector("span:nth-child(2) > b")?.textContent?.trim())
    .filter(Boolean);
}

function unitByName(root, name) {
  if (!name) return null;
  return [...root.querySelectorAll(".strategic-unit")].find((unit) =>
    unit.getAttribute("aria-label")?.startsWith(`${name},`),
  ) ?? null;
}

function mentionedName(message, names) {
  return names.find((name) => message.includes(name)) ?? null;
}

function isEnemyEvent(narrative, message, enemyNames) {
  const speaker = narrative.querySelector(".strategic-field-narrative-speaker")?.textContent?.trim() ?? "";
  return narrative.dataset.tone === "enemy" || speaker.includes("Rubra") || enemyNames.some((name) => message.includes(name));
}

function ensureIndicator(board) {
  let indicator = board.querySelector(":scope > .strategic-enemy-turn-indicator");
  if (indicator) return indicator;
  indicator = document.createElement("aside");
  indicator.className = "strategic-enemy-turn-indicator";
  indicator.setAttribute("aria-live", "polite");
  indicator.innerHTML = '<small>LEGIÃO RUBRA</small><strong></strong>';
  board.appendChild(indicator);
  return indicator;
}

function clearMarks(root) {
  root.querySelectorAll(".strategic-unit.is-enemy-actor, .strategic-unit.is-enemy-target").forEach((unit) => {
    unit.classList.remove("is-enemy-actor", "is-enemy-target");
  });
}

function stage(indicator, value) {
  indicator.dataset.stage = value;
  const labels = {
    reading: "avaliando o campo",
    actor: "ação inimiga",
    target: "alvo identificado",
    resolving: "resolvendo ação",
  };
  indicator.querySelector("strong").textContent = labels[value] ?? "turno inimigo";
}

function runEnemySequence(root, board, narrative, message) {
  const enemyNames = rosterNames(root, "owner-red");
  if (!enemyNames.length || !isEnemyEvent(narrative, message, enemyNames)) return;

  const playerNames = rosterNames(root, "owner-blue");
  const actorName = mentionedName(message, enemyNames);
  const targetName = mentionedName(message, playerNames);
  const actor = unitByName(root, actorName);
  const target = unitByName(root, targetName);
  const indicator = ensureIndicator(board);
  const token = ++sequenceToken;

  clearMarks(root);
  board.classList.add("is-enemy-sequence");
  indicator.classList.add("is-visible");
  stage(indicator, "reading");

  window.setTimeout(() => {
    if (token !== sequenceToken) return;
    stage(indicator, "actor");
    actor?.classList.add("is-enemy-actor");
  }, 140);

  window.setTimeout(() => {
    if (token !== sequenceToken) return;
    if (target) {
      stage(indicator, "target");
      target.classList.add("is-enemy-target");
    } else {
      stage(indicator, "resolving");
    }
  }, 420);

  window.setTimeout(() => {
    if (token !== sequenceToken) return;
    stage(indicator, "resolving");
  }, 700);

  window.setTimeout(() => {
    if (token !== sequenceToken) return;
    clearMarks(root);
    board.classList.remove("is-enemy-sequence");
    indicator.classList.remove("is-visible");
  }, 1180);
}

function syncEnemyTurn() {
  const root = document.querySelector(ROOT_SELECTOR);
  const board = root?.querySelector(BOARD_SELECTOR);
  const narrative = board?.querySelector(NARRATIVE_SELECTOR);
  if (!root || !board || !narrative) return;

  const message = narrative.dataset.message?.trim();
  if (!message || board.dataset.enemySequenceMessage === message) return;
  board.dataset.enemySequenceMessage = message;
  runEnemySequence(root, board, narrative, message);
}

const observer = new MutationObserver(syncEnemyTurn);
observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
  characterData: true,
  attributes: true,
  attributeFilter: ["data-message", "data-tone"],
});
window.addEventListener("DOMContentLoaded", syncEnemyTurn, { once: true });
syncEnemyTurn();
