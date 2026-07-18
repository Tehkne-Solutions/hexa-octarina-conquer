function escapeLabel(value) {
  return String(value).replaceAll("\\", "\\\\").replaceAll("\"", "\\\"").replaceAll("\n", "\\n");
}

function keyFor(name, labels) {
  const entries = Object.entries(labels).sort(([left], [right]) => left.localeCompare(right));
  return `${name}|${entries.map(([key, value]) => `${key}=${value}`).join(",")}`;
}

export class MetricsRegistry {
  constructor({ clock = () => Date.now() } = {}) {
    this.clock = clock;
    this.startedAt = this.clock();
    this.counters = new Map();
    this.gauges = new Map();
  }

  inc(name, labels = {}, amount = 1) {
    const key = keyFor(name, labels);
    const current = this.counters.get(key) ?? { name, labels, value: 0 };
    current.value += amount;
    this.counters.set(key, current);
  }

  set(name, value, labels = {}) {
    this.gauges.set(keyFor(name, labels), { name, labels, value: Number(value) });
  }

  observeDuration(name, startedAt, labels = {}) {
    this.inc(`${name}_count`, labels, 1);
    this.inc(`${name}_milliseconds_sum`, labels, Math.max(0, this.clock() - startedAt));
  }

  render({ roomCount = 0, socketCount = 0 } = {}) {
    this.set("hexa_uptime_seconds", (this.clock() - this.startedAt) / 1000);
    this.set("hexa_rooms", roomCount);
    this.set("hexa_websocket_connections", socketCount);
    const records = [...this.counters.values(), ...this.gauges.values()]
      .sort((left, right) => left.name.localeCompare(right.name));
    return `${records.map((record) => {
      const labels = Object.entries(record.labels);
      const suffix = labels.length
        ? `{${labels.map(([key, value]) => `${key}=\"${escapeLabel(value)}\"`).join(",")}}`
        : "";
      return `${record.name}${suffix} ${record.value}`;
    }).join("\n")}\n`;
  }
}
