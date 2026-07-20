import { readFile } from "node:fs/promises";

const yaml = await readFile(new URL("../render.yaml", import.meta.url), "utf8");
const required = [
  "type: web",
  "runtime: docker",
  "healthCheckPath: /health",
  "HEXA_STORE",
  "HEXA_IDENTITY_STORE",
  "HEXA_COMPETITION_STORE",
  "HEXA_CLUSTER_BUS",
  "HEXA_PRESENCE_STORE",
  "HEXA_GOVERNANCE_STORE",
  "HEXA_RESILIENCE_STORE",
  "fromDatabase:",
  "property: connectionString",
  "generateValue: true",
  "databases:",
  "postgresMajorVersion: \"16\"",
];

for (const token of required) {
  if (!yaml.includes(token)) throw new Error(`render.yaml is missing: ${token}`);
}

console.log("Render Blueprint structure validated.");
