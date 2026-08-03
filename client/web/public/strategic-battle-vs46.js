const ROOT_SELECTOR = ".strategic-slice.meta08-physical-world";
const HISTORY_LIMIT = 24;
const history = [];
let lastState = null;

function recordMissionFlow() {
  const root = document.querySelector(ROOT_SELECTOR);
  if (!root) return;
  const state = root.dataset.missionLifecycleState || "unknown";
  if (!state || state === lastState) return;

  lastState = state;
  history.push(state);
  if (history.length > HISTORY_LIMIT) history.shift();

  root.dataset.missionPlaythroughPath = history.join(">");
  root.dataset.missionPlaythroughLast = state;

  const sawPlayer = history.includes("player");
  const sawEnemy = history.includes("enemy");
  const reachedTerminal = ["victory", "defeat", "resolved"].includes(state);
  if (sawPlayer && sawEnemy && reachedTerminal) {
    root.dataset.missionPlaythrough = "complete";
  } else if (!root.dataset.missionPlaythrough) {
    root.dataset.missionPlaythrough = "in-progress";
  }
}

const observer = new MutationObserver((mutations) => {
  if (mutations.some((mutation) => mutation.type === "attributes" && mutation.attributeName === "data-mission-lifecycle-state")) {
    recordMissionFlow();
  }
});
observer.observe(document.documentElement, {
  subtree: true,
  attributes: true,
  attributeFilter: ["data-mission-lifecycle-state"],
});
window.addEventListener("DOMContentLoaded", recordMissionFlow, { once: true });
recordMissionFlow();
