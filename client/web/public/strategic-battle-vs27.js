const NARRATIVE_SELECTOR = ".strategic-field-narrative";

function findRosterCard(speaker) {
  return [...document.querySelectorAll(".strategic-roster-card")].find((card) => {
    const name = card.querySelector("span:nth-child(2) > b")?.textContent?.trim();
    return name === speaker;
  }) ?? null;
}

function ensurePortrait(narrative) {
  let portrait = narrative.querySelector(":scope > .strategic-field-narrative-portrait");
  if (portrait) return portrait;
  portrait = document.createElement("span");
  portrait.className = "strategic-field-narrative-portrait";
  portrait.setAttribute("aria-hidden", "true");
  narrative.prepend(portrait);
  return portrait;
}

function enhanceNarrative() {
  const narrative = document.querySelector(NARRATIVE_SELECTOR);
  if (!narrative) return;
  const speaker = narrative.querySelector(".strategic-field-narrative-speaker")?.textContent?.trim();
  if (!speaker || narrative.dataset.portraitSpeaker === speaker) return;

  const portrait = ensurePortrait(narrative);
  portrait.replaceChildren();
  narrative.classList.remove("has-speaker-portrait", "speaker-blue", "speaker-red", "speaker-world");

  const card = findRosterCard(speaker);
  const icon = card?.querySelector(".strategic-roster-icon");
  if (card && icon) {
    portrait.appendChild(icon.cloneNode(true));
    narrative.classList.add("has-speaker-portrait", card.classList.contains("owner-red") ? "speaker-red" : "speaker-blue");
  } else {
    portrait.textContent = speaker.includes("Rubra") ? "◆" : "✦";
    narrative.classList.add("has-speaker-portrait", speaker.includes("Rubra") ? "speaker-red" : "speaker-world");
  }

  narrative.dataset.portraitSpeaker = speaker;
}

const observer = new MutationObserver(enhanceNarrative);
observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
window.addEventListener("DOMContentLoaded", enhanceNarrative, { once: true });
enhanceNarrative();
