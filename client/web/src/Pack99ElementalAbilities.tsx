import { type CSSProperties, type RefObject, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type ElementKind = "earth" | "light" | "octarine" | "air" | "moon" | "ether" | "fire" | "corruption";

type AbilityEvent = {
  token: number;
  element: ElementKind;
  caster: "kael" | "lyra" | "enemy";
  label: string;
};

const ELEMENT_MATCHERS: Array<[ElementKind, RegExp]> = [
  ["octarine", /octarina|prism[aá]tica|contra-selo/i],
  ["light", /luz|celeste|muralha astral|guardião/i],
  ["moon", /lua|lunar/i],
  ["ether", /éter|marca da caçada/i],
  ["air", /ar|flecha|salto/i],
  ["fire", /fogo|cinzas|machado/i],
  ["corruption", /corrup|sombr|inimigo|saqueador/i],
  ["earth", /terra|rúnico|couro|muralha/i],
];

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function classifyElement(text: string): ElementKind {
  const normalized = normalize(text);
  return ELEMENT_MATCHERS.find(([, matcher]) => matcher.test(normalized))?.[0] ?? "octarine";
}

function classifyCaster(text: string): AbilityEvent["caster"] {
  const normalized = normalize(text);
  if (/lyra|flecha|cacada|lunar/.test(normalized)) return "lyra";
  if (/kael|guardiao|muralha|contra-selo|runico/.test(normalized)) return "kael";
  return "enemy";
}

function readSelectedAbility(root: HTMLElement): string {
  const selected = [...root.querySelectorAll<HTMLElement>(".living-card.selected")]
    .map((card) => card.querySelector(".living-card-header strong")?.textContent?.trim())
    .filter(Boolean);
  if (selected.length > 0) return selected.join(" + ");
  return root.querySelector<HTMLElement>(".battle-resolution-panel")?.textContent?.trim() ?? "";
}

export function Pack99ElementalAbilities({ rootRef }: { rootRef: RefObject<HTMLDivElement | null> }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [event, setEvent] = useState<AbilityEvent | null>(null);
  const signatureRef = useRef("");
  const tokenRef = useRef(0);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    let frame = 0;
    let timer = 0;

    const synchronize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const world = root.querySelector<HTMLElement>(".go-dots-world");
        setTarget((current) => current === world ? current : world);
        const resolution = root.querySelector<HTMLElement>(".battle-resolution-panel");
        if (!resolution) return;
        const ability = readSelectedAbility(root);
        const signature = `${ability}|${resolution.textContent ?? ""}`;
        if (!ability || signature === signatureRef.current) return;
        signatureRef.current = signature;
        tokenRef.current += 1;
        setEvent({ token: tokenRef.current, element: classifyElement(ability), caster: classifyCaster(ability), label: ability });
        clearTimeout(timer);
        timer = window.setTimeout(() => setEvent(null), 1800);
      });
    };

    const observer = new MutationObserver(synchronize);
    observer.observe(root, { attributes: true, childList: true, characterData: true, subtree: true });
    synchronize();
    return () => { observer.disconnect(); cancelAnimationFrame(frame); clearTimeout(timer); };
  }, [rootRef]);

  const particles = useMemo(() => Array.from({ length: 18 }, (_, index) => index), []);
  if (!target || !event) return null;

  return createPortal(
    <div key={event.token} className={`pack99-elemental-ability element-${event.element} caster-${event.caster}`} aria-hidden="true" data-ability={event.label}>
      <span className="ability-cast-seal"><i /><b /></span>
      <span className="ability-projectile"><i /></span>
      <span className="ability-impact"><i /><b /></span>
      <span className="ability-particles">{particles.map((index) => <i key={index} style={{ "--ability-particle": index } as CSSProperties} />)}</span>
      <strong>{event.label}</strong>
    </div>,
    target,
  );
}
