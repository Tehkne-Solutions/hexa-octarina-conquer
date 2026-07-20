import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";

const MIME_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
  [".woff2", "font/woff2"],
]);

const API_PATHS = new Set([
  "/health",
  "/rooms",
  "/presence",
  "/leaderboard",
  "/seasons",
  "/season-leaderboard",
  "/metrics",
  "/admin",
  "/replays",
]);

function isApiPath(pathname) {
  return API_PATHS.has(pathname)
    || pathname.startsWith("/admin/")
    || pathname.startsWith("/replays/");
}

function cacheControl(pathname) {
  if (pathname.startsWith("/assets/")) return "public, max-age=31536000, immutable";
  if (pathname === "/sw.js" || pathname.includes("service-worker")) return "no-cache, no-store, must-revalidate";
  return "no-cache";
}

async function findFile(root, pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return { error: 400 };
  }

  const relative = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
  let candidate = resolve(root, relative);
  if (candidate !== root && !candidate.startsWith(`${root}${sep}`)) return { error: 400 };

  try {
    const info = await stat(candidate);
    if (info.isDirectory()) candidate = resolve(candidate, "index.html");
    const finalInfo = await stat(candidate);
    if (finalInfo.isFile()) return { path: candidate };
  } catch {
    // SPA routes without an extension fall back to index.html.
  }

  if (!extname(relative)) {
    const indexPath = resolve(root, "index.html");
    try {
      const info = await stat(indexPath);
      if (info.isFile()) return { path: indexPath };
    } catch {
      return { error: 404 };
    }
  }
  return { error: 404 };
}

function streamFile(request, response, filePath, pathname) {
  const type = MIME_TYPES.get(extname(filePath).toLowerCase()) ?? "application/octet-stream";
  response.writeHead(200, {
    "content-type": type,
    "cache-control": cacheControl(pathname),
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
  });
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  const stream = createReadStream(filePath);
  stream.on("error", () => {
    if (!response.headersSent) response.writeHead(500);
    response.end();
  });
  stream.pipe(response);
}

export function attachWebClient(httpServer, { root = process.env.HEXA_WEB_ROOT } = {}) {
  if (!root) return () => {};
  const absoluteRoot = resolve(root);
  const baseHandlers = httpServer.listeners("request");
  httpServer.removeAllListeners("request");

  const handler = async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const servesWeb = ["GET", "HEAD"].includes(request.method ?? "GET")
      && !isApiPath(url.pathname);

    if (servesWeb) {
      const result = await findFile(absoluteRoot, url.pathname);
      if (result.path) {
        streamFile(request, response, result.path, url.pathname);
        return;
      }
      if (result.error === 400) {
        response.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
        response.end("Bad request");
        return;
      }
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    for (const baseHandler of baseHandlers) baseHandler.call(httpServer, request, response);
  };

  httpServer.on("request", handler);
  return () => {
    httpServer.removeListener("request", handler);
    for (const baseHandler of baseHandlers) httpServer.on("request", baseHandler);
  };
}
