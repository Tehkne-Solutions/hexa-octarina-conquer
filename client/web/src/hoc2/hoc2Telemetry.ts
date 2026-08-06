export type Hoc2TelemetryEventName =
  | "camera.command"
  | "camera.applied"
  | "camera.zoom"
  | "camera.reset"
  | "hexa.mode"
  | "hexa.filter"
  | "combat.open"
  | "combat.exit.requested"
  | "combat.exit.applied"
  | "strategic.snapshot.rendered";

export type Hoc2TelemetryEvent = {
  at: number;
  event: Hoc2TelemetryEventName;
  source: string;
  input?: string;
  outcome?: string;
  filter?: string;
  dx?: number;
  dy?: number;
  zoom?: number;
};

const TELEMETRY_LIMIT = 300;

type TelemetryWindow = typeof window & { __HOC2_TELEMETRY__?: Hoc2TelemetryEvent[] };

export function emitHoc2Telemetry(payload: Omit<Hoc2TelemetryEvent, "at">) {
  const event: Hoc2TelemetryEvent = { at: Date.now(), ...payload };
  const telemetryWindow = window as TelemetryWindow;
  const buffer = telemetryWindow.__HOC2_TELEMETRY__ ?? [];
  buffer.push(event);
  if (buffer.length > TELEMETRY_LIMIT) buffer.splice(0, buffer.length - TELEMETRY_LIMIT);
  telemetryWindow.__HOC2_TELEMETRY__ = buffer;
  window.dispatchEvent(new CustomEvent("hoc2:telemetry", { detail: event }));
}
