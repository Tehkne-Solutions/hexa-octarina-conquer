import { type CSSProperties, useEffect, useMemo, useState } from "react";

import { getRuntimeAsset, runtimeAssetUrl } from "./runtime-assets";

export type RuntimeSpriteState = "idle" | "walk" | "attack" | "hit" | "defeat";
export type RuntimeSpriteDirection = "NE" | "NW" | "SE" | "SW";

interface RuntimeAnimatedSpriteProps {
  entityId: string;
  state?: RuntimeSpriteState;
  direction?: RuntimeSpriteDirection;
  className?: string;
  label?: string;
  onReady?: (ready: boolean) => void;
}

interface RuntimeStaticAssetProps {
  assetId: string;
  className?: string;
  alt?: string;
  style?: CSSProperties;
  onReady?: (ready: boolean) => void;
}

const DEFAULT_FRAMES: Record<RuntimeSpriteState, number> = {
  idle: 4,
  walk: 6,
  attack: 6,
  hit: 3,
  defeat: 6,
};

const DEFAULT_FPS: Record<RuntimeSpriteState, number> = {
  idle: 6,
  walk: 10,
  attack: 12,
  hit: 12,
  defeat: 8,
};

export function animationAssetId(
  entityId: string,
  state: RuntimeSpriteState,
  direction: RuntimeSpriteDirection = "SE",
): string {
  return `${entityId}_${state.toUpperCase()}_${direction}_01`;
}

export function runtimeSpriteAnimation(frames: number, fps: number, loop: boolean): string | undefined {
  const safeFrames = Math.max(1, frames);
  if (safeFrames === 1) return undefined;
  const duration = safeFrames / Math.max(1, fps);
  return `runtime-pack-frames ${duration}s steps(${safeFrames}, jump-none) ${loop ? "infinite" : "1"} forwards`;
}

export function RuntimeAnimatedSprite({
  entityId,
  state = "idle",
  direction = "SE",
  className = "",
  label,
  onReady,
}: RuntimeAnimatedSpriteProps) {
  const assetId = useMemo(() => animationAssetId(entityId, state, direction), [entityId, state, direction]);
  const [runtime, setRuntime] = useState<{ url: string; frames: number; fps: number; loop: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    onReady?.(false);
    void Promise.all([getRuntimeAsset(assetId), runtimeAssetUrl(assetId, "spritesheet")]).then(([asset, url]) => {
      if (cancelled || !asset || !url) return;
      const image = new Image();
      image.onload = () => {
        if (cancelled) return;
        setRuntime({
          url,
          frames: Math.max(1, Number(asset.frames ?? DEFAULT_FRAMES[state])),
          fps: Math.max(1, Number(asset.fps ?? DEFAULT_FPS[state])),
          loop: Boolean(asset.loop ?? (state === "idle" || state === "walk")),
        });
        onReady?.(true);
      };
      image.onerror = () => {
        if (!cancelled) onReady?.(false);
      };
      image.src = url;
    });
    return () => {
      cancelled = true;
    };
  }, [assetId, onReady, state]);

  if (!runtime) return null;
  const style = {
    backgroundImage: `url("${runtime.url}")`,
    backgroundSize: `${runtime.frames * 100}% 100%`,
    animation: runtimeSpriteAnimation(runtime.frames, runtime.fps, runtime.loop),
  } satisfies CSSProperties;

  return (
    <span
      key={assetId}
      className={`runtime-pack-sprite state-${state} ${className}`.trim()}
      style={style}
      role="img"
      aria-label={label ?? `${entityId} ${state}`}
      data-runtime-asset={assetId}
    />
  );
}

export function RuntimeStaticAsset({ assetId, className = "", alt = "", style, onReady }: RuntimeStaticAssetProps) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    onReady?.(false);
    void runtimeAssetUrl(assetId).then((nextUrl) => {
      if (cancelled || !nextUrl) return;
      const image = new Image();
      image.onload = () => {
        if (cancelled) return;
        setUrl(nextUrl);
        onReady?.(true);
      };
      image.onerror = () => {
        if (!cancelled) onReady?.(false);
      };
      image.src = nextUrl;
    });
    return () => {
      cancelled = true;
    };
  }, [assetId, onReady]);

  if (!url) return null;
  return <img src={url} className={className} alt={alt} style={style} draggable={false} data-runtime-asset={assetId} />;
}
