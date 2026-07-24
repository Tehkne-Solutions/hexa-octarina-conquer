export type ViewportWidthClass = "mobile" | "tablet" | "notebook" | "desktop";
export type ViewportHeightClass = "compact" | "standard";
export type ViewportOrientation = "portrait" | "landscape";

export interface ViewportProfile {
  widthClass: ViewportWidthClass;
  heightClass: ViewportHeightClass;
  orientation: ViewportOrientation;
  reducedViewport: boolean;
}

export function classifyViewport(width: number, height: number): ViewportProfile {
  const safeWidth = Math.max(0, Math.round(width));
  const safeHeight = Math.max(0, Math.round(height));
  const widthClass: ViewportWidthClass = safeWidth <= 720
    ? "mobile"
    : safeWidth <= 1100
      ? "tablet"
      : safeWidth <= 1440
        ? "notebook"
        : "desktop";
  const heightClass: ViewportHeightClass = safeHeight <= 820 ? "compact" : "standard";
  const orientation: ViewportOrientation = safeWidth >= safeHeight ? "landscape" : "portrait";

  return {
    widthClass,
    heightClass,
    orientation,
    reducedViewport: widthClass === "mobile" || heightClass === "compact",
  };
}

export function applyViewportProfile(
  width = window.innerWidth,
  height = window.innerHeight,
  root: HTMLElement = document.documentElement,
): ViewportProfile {
  const profile = classifyViewport(width, height);
  root.dataset.widthClass = profile.widthClass;
  root.dataset.heightClass = profile.heightClass;
  root.dataset.viewportOrientation = profile.orientation;
  root.classList.toggle("hexa-reduced-viewport", profile.reducedViewport);
  return profile;
}

export function installViewportProfile(): () => void {
  let frame = 0;
  const refresh = () => {
    window.cancelAnimationFrame(frame);
    frame = window.requestAnimationFrame(() => applyViewportProfile());
  };

  applyViewportProfile();
  window.addEventListener("resize", refresh, { passive: true });
  window.addEventListener("orientationchange", refresh, { passive: true });

  return () => {
    window.cancelAnimationFrame(frame);
    window.removeEventListener("resize", refresh);
    window.removeEventListener("orientationchange", refresh);
  };
}
