function serializeError(error) {
  if (!error) return undefined;
  return {
    name: error.name,
    message: error.message,
    code: error.code,
    stack: process.env.NODE_ENV === "production" ? undefined : error.stack,
  };
}

export function createLogger({ output = console } = {}) {
  function write(level, message, fields = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: "hexa-octarina-server",
      signature: "Tehkné Solutions",
      ...fields,
    };
    if (fields.error instanceof Error) entry.error = serializeError(fields.error);
    const line = JSON.stringify(entry);
    if (level === "error") output.error(line);
    else if (level === "warn") output.warn(line);
    else output.log(line);
  }

  return {
    info: (message, fields) => write("info", message, fields),
    warn: (message, fields) => write("warn", message, fields),
    error: (message, fields) => write("error", message, fields),
  };
}
