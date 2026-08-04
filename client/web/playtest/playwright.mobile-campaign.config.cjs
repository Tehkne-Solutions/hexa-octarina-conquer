module.exports = {
  testDir: '.',
  testMatch: /playtest-mobile-campaign-paint\.e2e\.cjs$/,
  timeout: 30000,
  expect: { timeout: 5000 },
  use: { headless: true },
};
