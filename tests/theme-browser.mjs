import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
const root = process.cwd();
const output = path.join(root, '.data', 'qa');
await mkdir(output, { recursive: true });
await mkdir(path.join(root, '.cache', 'tmp'), { recursive: true });
process.env.TEMP = path.join(root, '.cache', 'tmp');
process.env.TMP = process.env.TEMP;
const context = await chromium.launchPersistentContext(path.join(root, '.cache', 'theme-qa'), {
  channel: 'msedge',
  headless: true,
  viewport: { width: 1440, height: 1000 },
  colorScheme: 'light',
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';
const theme = () => page.evaluate(() => document.documentElement.dataset.theme);
try {
  await page.goto(base + '/login');
  await page.getByRole('button', { name: 'Light mode', exact: true }).click();
  assert.equal(await theme(), 'light');
  await page.screenshot({ path: path.join(output, 'login-light.png'), fullPage: true });
  await page.getByRole('button', { name: 'Dark mode', exact: true }).click();
  assert.equal(await theme(), 'dark');
  await page.reload();
  assert.equal(await theme(), 'dark');
  assert.equal(
    await page.getByRole('button', { name: 'Dark mode', exact: true }).getAttribute('aria-pressed'),
    'true',
  );
  await page.screenshot({ path: path.join(output, 'login-dark.png'), fullPage: true });
  await page.getByRole('button', { name: 'System mode', exact: true }).click();
  assert.equal(await theme(), 'light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
  await page.getByRole('button', { name: 'Owner demo', exact: true }).click();
  await page.waitForURL('**/owner/overview');
  await page.getByRole('heading', { name: 'Welcome back, Aditya' }).waitFor();
  await page.screenshot({ path: path.join(output, 'overview-light-v2.png'), fullPage: true });
  await page.getByRole('button', { name: 'Dark mode', exact: true }).click();
  await page.screenshot({ path: path.join(output, 'overview-dark-v2.png'), fullPage: true });
  const second = await context.newPage();
  await second.goto(base + '/login');
  await second.getByRole('button', { name: 'Light mode', exact: true }).click();
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
  await second.close();
  await page.getByRole('button', { name: 'Dark mode', exact: true }).click();
  for (const route of ['tenants', 'rent', 'complaints', 'announcements', 'food', 'settings']) {
    await page.goto(base + '/owner/' + route);
    await page.locator('.page-heading h1').waitFor();
    assert.equal(await theme(), 'dark');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  }
  await page.getByRole('button', { name: 'Light mode', exact: true }).last().click();
  assert.equal(await theme(), 'light');
  assert.equal(
    await page
      .getByRole('button', { name: 'Light mode', exact: true })
      .first()
      .getAttribute('aria-pressed'),
    'true',
  );
  await page.getByRole('button', { name: 'Dark mode', exact: true }).last().click();
  await page.screenshot({ path: path.join(output, 'settings-dark.png'), fullPage: true });
  await page.goto(base + '/owner/overview');
  await page.getByRole('heading', { name: 'Welcome back, Aditya' }).waitFor();
  await page.getByRole('button', { name: 'Add tenant', exact: true }).click();
  await page.getByRole('dialog').waitFor();
  assert.equal(
    await page.getByRole('dialog').evaluate((el) => getComputedStyle(el).backgroundColor),
    'rgb(22, 31, 46)',
  );
  await page.getByRole('button', { name: 'Close dialog' }).click();
  for (const width of [390, 360]) {
    await page.setViewportSize({ width, height: 844 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({
      path: path.join(output, `overview-dark-${width}.png`),
      fullPage: true,
    });
  }
  await page.goto(base + '/login');
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: path.join(output, 'login-dark-mobile.png'), fullPage: true });
  const privateContext = await context.browser().newContext({ colorScheme: 'dark' });
  const privatePage = await privateContext.newPage();
  await privatePage.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('Blocked', 'SecurityError');
      },
    });
  });
  await privatePage.goto(base + '/login');
  await privatePage.getByRole('button', { name: 'Light mode', exact: true }).click();
  assert.equal(await privatePage.evaluate(() => document.documentElement.dataset.theme), 'light');
  await privateContext.close();
  assert.deepEqual(errors, []);
  process.stdout.write(
    'Theme QA passed: light/dark, reload persistence, live system changes, cross-tab sync, settings sync, all owner screens, themed modal, 360/390px layout, blocked storage.\n',
  );
} finally {
  await context.close();
}
