/**
 * Smoke: desktop + mobile viewports, Leaflet mount, stop + pill navigation.
 * Requires: npm install -D playwright && npx playwright install chromium
 */
import { chromium } from 'playwright';

const url = process.env.GLENN_VERIFY_URL || 'http://localhost:3000/glenn-day.html';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function runViewport(label, viewport) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport });
  const errs = [];
  page.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errs.push(`console: ${msg.text()}`);
  });

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });

  await page.waitForSelector('.leaflet-container', { timeout: 20_000 });
  assert((await page.locator('.leaflet-container').count()) >= 1, `${label}: leaflet container missing`);

  // Leaflet applies `leaflet-container` to the map div itself, not a child.
  const mapBox = await page.locator('#glenn-map.leaflet-container').boundingBox();
  assert(mapBox && mapBox.width > 80 && mapBox.height > 80, `${label}: map too small ${JSON.stringify(mapBox)}`);

  const nSteps = await page.locator('#glenn-steps li').count();
  assert(nSteps === 5, `${label}: expected 5 steps, got ${nSteps}`);

  const detail0 = await page.locator('#glenn-detail').innerText();
  assert(detail0.length > 20, `${label}: detail empty`);

  await page.locator('.glenn-step-button').nth(1).click({ timeout: 5000 });
  await page.waitForFunction(
    (t0) => document.getElementById('glenn-detail')?.innerText !== t0,
    detail0,
    { timeout: 5000 }
  );
  const detail1 = await page.locator('#glenn-detail').innerText();
  assert(detail1 !== detail0, `${label}: detail did not change after step 2 click`);

  await page.locator('.glenn-pill').nth(3).click({ timeout: 5000 });
  await page.locator('.glenn-pill.is-active').first().waitFor({ state: 'visible', timeout: 5000 });
  const activePills = await page.locator('.glenn-pill.is-active').count();
  assert(activePills >= 1, `${label}: no active pill after click`);

  await browser.close();
  if (errs.length) console.warn(`[${label}] warnings:\n`, errs.join('\n'));
  console.log(`OK ${label}: map ${Math.round(mapBox.width)}×${Math.round(mapBox.height)}, steps=${nSteps}`);
}

async function main() {
  await runViewport('desktop', { width: 1200, height: 800 });
  await runViewport('mobile', { width: 390, height: 844, isMobile: true, hasTouch: true });
  console.log('All checks passed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
