import { chromium } from "playwright";

const baseUrl = process.env.HOC2_PLAYTEST_URL || "http://127.0.0.1:4173/hoc2.html";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

function assert(condition, code) {
  if (!condition) throw new Error(code);
}

try {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.getByText("Living Map Sandbox").waitFor();
  assert((await page.getByRole("button", { name: "PLAYTEST REPORT" }).count()) === 0, "PLAYTEST01_REPORT_LEAKED_INTO_NORMAL_RUNTIME");

  const qaUrl = `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}playtest=1`;
  await page.goto(qaUrl, { waitUntil: "networkidle" });
  await page.getByText("Living Map Sandbox").waitFor();
  await page.getByRole("button", { name: "PLAYTEST REPORT" }).waitFor();
  await page.getByRole("button", { name: "PLAYTEST REPORT" }).click();
  await page.getByText("PLAYTEST 01 · HUMAN SESSION").waitFor();
  await page.getByText("Notas 1–5").waitFor();
  await page.getByText("Observações").waitFor();
  await page.getByText("Decisão").waitFor();
  await page.getByRole("button", { name: "EXPORTAR SESSÃO JSON" }).waitFor();

  const selectCount = await page.locator(".hoc2-playtest-report select").count();
  const noteCount = await page.locator(".hoc2-playtest-report textarea").count();
  assert(selectCount === 10, `PLAYTEST01_REPORT_RATING_COUNT_INVALID:${selectCount}`);
  assert(noteCount === 7, `PLAYTEST01_REPORT_NOTE_COUNT_INVALID:${noteCount}`);

  console.log("HOC2_PLAYTEST01_HUMAN_REPORT=PASS normal=isolated ratings=10 notes=7 verdicts=3 export=ready");
} finally {
  await browser.close();
}
