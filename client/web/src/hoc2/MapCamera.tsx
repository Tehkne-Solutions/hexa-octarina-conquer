import { type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

export type CameraState = { x: number; y: number; zoom: number };

type CameraTelemetry = {
  at: number;
  event: "camera.command" | "camera.applied" | "camera.zoom" | "camera.reset";
  source: "keyboard" | "wheel" | "drag" | "edge" | "ui";
  input?: string;
  dx?: number;
  dy?: number;
  zoom?: number;
};

const MIN_ZOOM = 0.65;
const MAX_ZOOM = 1.8;
const PAN_STEP = 28;
const EDGE_SIZE = 34;
const TELEMETRY_LIMIT = 200;
const CAMERA_KEYS = new Set(["a", "d", "w", "s", "arrowleft", "arrowright", "arrowup", "arrowdown"]);

function emitCameraTelemetry(payload: Omit<CameraTelemetry, "at">) {
  const event: CameraTelemetry = { at: Date.now(), ...payload };
  const telemetryWindow = window as typeof window & { __HOC2_TELEMETRY__?: CameraTelemetry[] };
  const buffer = telemetryWindow.__HOC2_TELEMETRY__ ?? [];
  buffer.push(event);
  if (buffer.length > TELEMETRY_LIMIT) buffer.splice(0, buffer.length - TELEMETRY_LIMIT);
  telemetryWindow.__HOC2_TELEMETRY__ = buffer;
  window.dispatchEvent(new CustomEvent("hoc2:telemetry", { detail: event }));
}

function keyboardDelta(key: string) {
  switch (key) {
    case "a":
    case "arrowleft":
      return { dx: PAN_STEP, dy: 0 };
    case "d":
    case "arrowright":
      return { dx: -PAN_STEP, dy: 0 };
    case "w":
    case "arrowup":
      return { dx: 0, dy: PAN_STEP };
    case "s":
    case "arrowdown":
      return { dx: 0, dy: -PAN_STEP };
    default:
      return null;
  }
}

export function useHoc2Camera() {
  const [camera, setCamera] = useState<CameraState>({ x: 0, y: 0, zoom: 1 });
  const dragRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const keysRef = useRef(new Set<string>());
  const edgeRef = useRef({ x: 0, y: 0 });

  const update = useCallback((mutator: (current: CameraState) => CameraState) => {
    setCamera((current) => mutator(current));
  }, []);

  const applyPan = useCallback((dx: number, dy: number, source: "keyboard" | "drag" | "edge", input?: string) => {
    if (!dx && !dy) return;
    update((current) => {
      const next = { ...current, x: current.x + dx, y: current.y + dy };
      emitCameraTelemetry({ event: "camera.applied", source, input, dx, dy, zoom: next.zoom });
      return next;
    });
  }, [update]);

  const onWheel = useCallback((event: ReactWheelEvent) => {
    event.preventDefault();
    const factor = event.deltaY > 0 ? 0.9 : 1.1;
    emitCameraTelemetry({ event: "camera.command", source: "wheel", input: event.deltaY > 0 ? "zoom-out" : "zoom-in" });
    update((current) => {
      const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, current.zoom * factor));
      emitCameraTelemetry({ event: "camera.zoom", source: "wheel", zoom });
      return { ...current, zoom };
    });
  }, [update]);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 1 && !(event.button === 0 && event.shiftKey)) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    emitCameraTelemetry({ event: "camera.command", source: "drag", input: "start" });
  }, []);

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    edgeRef.current = {
      x: event.clientX < bounds.left + EDGE_SIZE ? 1 : event.clientX > bounds.right - EDGE_SIZE ? -1 : 0,
      y: event.clientY < bounds.top + EDGE_SIZE ? 1 : event.clientY > bounds.bottom - EDGE_SIZE ? -1 : 0,
    };
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    dragRef.current = { ...drag, x: event.clientX, y: event.clientY };
    applyPan(dx, dy, "drag");
  }, [applyPan]);

  const endDrag = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  }, []);

  const focusCenter = useCallback(() => {
    setCamera({ x: 0, y: 0, zoom: 1 });
    emitCameraTelemetry({ event: "camera.reset", source: "ui", zoom: 1 });
  }, []);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (!CAMERA_KEYS.has(key)) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      event.preventDefault();
      emitCameraTelemetry({ event: "camera.command", source: "keyboard", input: key });
      if (!event.repeat) {
        const delta = keyboardDelta(key);
        if (delta) applyPan(delta.dx, delta.dy, "keyboard", key);
      }
      keysRef.current.add(key);
    };
    const up = (event: KeyboardEvent) => keysRef.current.delete(event.key.toLowerCase());
    window.addEventListener("keydown", down, { passive: false });
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [applyPan]);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const keys = keysRef.current;
      const edge = edgeRef.current;
      const left = keys.has("a") || keys.has("arrowleft") ? 1 : 0;
      const right = keys.has("d") || keys.has("arrowright") ? -1 : 0;
      const up = keys.has("w") || keys.has("arrowup") ? 1 : 0;
      const down = keys.has("s") || keys.has("arrowdown") ? -1 : 0;
      const keyboardDx = (left + right) * PAN_STEP * 0.18;
      const keyboardDy = (up + down) * PAN_STEP * 0.18;
      const edgeDx = edge.x * PAN_STEP * 0.18;
      const edgeDy = edge.y * PAN_STEP * 0.18;
      if (keyboardDx || keyboardDy) applyPan(keyboardDx, keyboardDy, "keyboard", "hold");
      if (edgeDx || edgeDy) applyPan(edgeDx, edgeDy, "edge");
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [applyPan]);

  const transform = useMemo(() => `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.zoom})`, [camera]);

  return {
    camera,
    transform,
    focusCenter,
    handlers: { onWheel, onPointerDown, onPointerMove, onPointerUp: endDrag, onPointerCancel: endDrag, onPointerLeave: endDrag },
  };
}
