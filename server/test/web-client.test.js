import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { attachWebClient } from "../src/web-client.js";

async function request(port, path) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`);
  return {
    status: response.status,
    type: response.headers.get("content-type"),
    cache: response.headers.get("cache-control"),
    body: await response.text(),
  };
}

test("serves the PWA shell, assets and preserves API handlers", async () => {
  const root = await mkdtemp(join(tmpdir(), "hexa-web-"));
  const assets = join(root, "assets");
  await mkdir(assets);
  await writeFile(join(root, "index.html"), "<html><body>Hexa Web</body></html>");
  await writeFile(join(root, "sw.js"), "self.addEventListener('fetch',()=>{})");
  await writeFile(join(assets, "app.js"), "console.log('hexa')");

  const server = createServer((request, response) => {
    if (request.url === "/health") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ ok: true }));
      return;
    }
    response.writeHead(404);
    response.end("api-not-found");
  });
  const detach = attachWebClient(server, { root });

  try {
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = server.address().port;

    const shell = await request(port, "/");
    assert.equal(shell.status, 200);
    assert.match(shell.type, /text\/html/);
    assert.match(shell.body, /Hexa Web/);

    const route = await request(port, "/partida/A1B2");
    assert.equal(route.status, 200);
    assert.match(route.body, /Hexa Web/);

    const asset = await request(port, "/assets/app.js");
    assert.equal(asset.status, 200);
    assert.equal(asset.cache, "public, max-age=31536000, immutable");

    const worker = await request(port, "/sw.js");
    assert.equal(worker.status, 200);
    assert.equal(worker.cache, "no-cache, no-store, must-revalidate");

    const health = await request(port, "/health");
    assert.equal(health.status, 200);
    assert.deepEqual(JSON.parse(health.body), { ok: true });
  } finally {
    detach();
    await new Promise((resolve) => server.close(resolve));
    await rm(root, { recursive: true, force: true });
  }
});
