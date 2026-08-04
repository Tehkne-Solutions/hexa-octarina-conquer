const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.HEXA_PLAYTEST_URL || 'http://127.0.0.1:4173';

async function assertChapterPaints(page, chapterId, expectedTitle, screenshotName) {
  const chapter = page.locator(`[data-chapter-id="${chapterId}"]`).first();
  await expect(chapter).toBeAttached();
  await chapter.scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);

  const heading = chapter.locator('h2').first();
  await expect(heading).toBeVisible();
  await expect(heading).toHaveText(expectedTitle);

  const box = await chapter.boundingBox();
  expect(box, `${chapterId} should have a painted layout box`).not.toBeNull();
  expect(box.height, `${chapterId} should keep meaningful rendered height`).toBeGreaterThan(180);

  await page.screenshot({ path: `playtest-visual/${screenshotName}`, fullPage: false });
}

test.use({ viewport: { width: 390, height: 844 } });

test('mobile campaign paints deferred chapters when the player scrolls them into view', async ({ page }) => {
  await page.goto(`${BASE_URL}/?qa=1&stable=1&screen=campaign`, { waitUntil: 'networkidle' });
  await expect(page.locator('.campaign-journey-screen')).toBeVisible();

  await assertChapterPaints(page, 'chapter-2', 'A CONVERGÊNCIA ALQUÍMICA', 'campaign-mobile-chapter-2.png');
  await assertChapterPaints(page, 'chapter-3', 'ASCENSÃO MAGITECH', 'campaign-mobile-chapter-3.png');
});
