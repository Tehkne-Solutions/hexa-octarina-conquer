import { startServer as startRuntime } from "./server.js";
import { attachWebClient } from "./web-client.js";

export function startServer(options = {}) {
  const instance = startRuntime(options);
  const detachWebClient = attachWebClient(instance.httpServer, {
    root: options.webRoot ?? process.env.HEXA_WEB_ROOT,
  });
  const closeRuntime = instance.close.bind(instance);
  instance.close = async () => {
    detachWebClient();
    await closeRuntime();
  };
  return instance;
}
