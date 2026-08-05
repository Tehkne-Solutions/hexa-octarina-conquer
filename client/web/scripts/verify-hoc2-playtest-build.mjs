import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const distDir = resolve(process.cwd(), "dist");
const hoc2Html = resolve(distDir, "hoc2.html");

await access(hoc2Html);
const html = await readFile(hoc2Html, "utf8");

if (!html.includes("<div id=\"root\"></div>") && !html.includes("<div id=\"root\"")) {
  throw new Error("HOC2_PLAYTEST_BUILD=FAIL missing root mount in dist/hoc2.html");
}

if (!/assets\/.+\.(?:js|css)/.test(html)) {
  throw new Error("HOC2_PLAYTEST_BUILD=FAIL hoc2.html is not linked to built assets");
}

console.log("HOC2_PLAYTEST_BUILD=PASS dist/hoc2.html materialized with production assets");
