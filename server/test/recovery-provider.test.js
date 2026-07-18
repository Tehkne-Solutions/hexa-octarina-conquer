import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import test from "node:test";

import { WebhookRecoveryProvider } from "../src/recovery-provider.js";

test("webhook recovery provider delivers authenticated recovery payload", async () => {
  let received;
  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    received = {
      authorization: request.headers.authorization,
      body: JSON.parse(Buffer.concat(chunks).toString("utf8")),
    };
    response.writeHead(202);
    response.end();
  });
  server.listen(0);
  await once(server, "listening");
  const address = server.address();
  const provider = new WebhookRecoveryProvider({
    url: `http://127.0.0.1:${address.port}/recover`,
    secret: "recovery-secret",
  });

  try {
    const result = await provider.deliver({
      account: { id: "account-1", handle: "arquiteto", displayName: "Arquiteto" },
      recoveryCode: "ABC123XYZ",
      expiresAt: 123_456,
    });
    assert.deepEqual(result, { delivered: true, provider: "webhook" });
    assert.equal(received.authorization, "Bearer recovery-secret");
    assert.equal(received.body.recoveryCode, "ABC123XYZ");
    assert.equal(received.body.account.handle, "arquiteto");
    assert.equal(received.body.signature, "Tehkné Solutions");
  } finally {
    await provider.close();
    server.close();
    await once(server, "close");
  }
});
