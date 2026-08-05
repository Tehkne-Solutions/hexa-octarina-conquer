import { type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

export type CameraState = { x: number; y: number; zoom: number };

const MIN_ZOOM = 0.65;
const MAX_ZOOM = 1.8;
const PAN_STEP = 28;
const EDGE_SIZE = 34;

export function useHoc2Camera() {
  const [camera, setCamera] = useState<CameraState>({ x: 0, y: 0, zoom: 1 });
  const dragRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const keysRef = useRef(new Set<string>());
  const edgeRef = useRef({ x: 0, y: 0 });

  const update = useCallback((mutator: (current: CameraState) => CameraState) => {
    setCamera((current) => mutator(current));
  }, []);

  const onWheel = useCallback((event: ReactWheelEvent) => {
    event.preventDefault();
    const factor = event.deltaY > 0 ? 0.9 : 1.1;
    update((current) => ({ ...current, zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, current.zoom * factor)) }));
  }, [update]);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 1 && !(event.button === 0 && event.shiftKey)) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
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
    update((current) => ({ ...current, x: current.x + dx, y: current.y + dy }));
  }, [update]);

  const endDrag = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  }, []);

  const focusCenter = useCallback(() => setCamera({ x: 0, y: 0, zoom: 1 }), []);

  useEffect(() => {
    const down = (event: KeyboardEvent) => keysRef.current.add(event.key.toLowerCase());
    const up = (event: KeyboardEvent) => keysRef.current.delete(event.key.toLowerCase());
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const keys = keysRef.current;
      const edge = edgeRef.current;
      const left = keys.has("a") || keys.has("arrowleft") ? 1 : 0;
      const right = keys.has("d") || keys.has("arrowright") ? -1 : 0;
      const up = keys.has("w") || keys.has("arrowup") ? 1 : 0;
      const down = keys.has("s") || keys.has("arrowdown") ? -1 : 0;
      const dx = (left + right + edge.x) * PAN_STEP * 0.18;
      const dy = (up + down + edge.y) * PAN_STEP * 0.18;
      if (dx || dy) update((current) => ({ ...current, x: current.x + dx, y: current.y + dy }));
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [update]);

  const transform = useMemo(() => `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.zoom})`, [camera]);

  return {
    camera,
    transform,
    focusCenter,
    handlers: { onWheel, onPointerDown, onPointerMove, onPointerUp: endDrag, onPointerCancel: endDrag, onPointerLeave: endDrag },
  };
}
