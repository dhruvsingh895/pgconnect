import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = process.cwd();
const output = path.join(root, '.data', 'qa');
await mkdir(output, { recursive: true });
await mkdir(path.join(root, '.cache', 'tmp'), { recursive: true });
process.env.TEMP = path.join(root, '.cache', 'tmp');
process.env.TMP = process.env.TEMP;
const context = await chromium.launchPersistentContext(path.join(root, '.cache', 'browser-qa'), {
  channel: 'msedge',
  headless: true,
  viewport: { width: 1440, height: 1080 },
  acceptDownloads: false,
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';
try {
  await page.goto(base + '/login');
  await page.getByRole('button', { name: 'Owner demo' }).click();
  await page.waitForURL('**/owner/overview');
  await page.getByRole('heading', { name: 'Welcome back, Aditya' }).waitFor();
  await page.screenshot({ path: path.join(output, 'owner-desktop.png'), fullPage: true });
  await page.getByRole('link', { name: 'Tenants', exact: true }).first().click();
  await page.getByPlaceholder('Search by name, room or phone…').fill('Aarav');
  await page.getByRole('button', { name: 'Aarav Sharma Joined' }).click();
  await page.getByRole('heading', { name: 'Tenant profile' }).waitFor();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('link', { name: 'Announcements', exact: true }).first().click();
  await page.getByRole('button', { name: 'New announcement' }).click();
  await page.getByLabel('Announcement title').fill('QA water supply update');
  await page
    .getByLabel('Message', { exact: true })
    .fill('Water supply will resume at 2 PM. Thank you for your patience.');
  await page.getByRole('button', { name: 'Publish announcement' }).click();
  await page.getByRole('heading', { name: 'QA water supply update' }).waitFor();
  await page.getByRole('link', { name: 'Food timetable', exact: true }).first().click();
  await page.getByRole('button', { name: 'Edit weekly menu' }).click();
  await page.getByLabel('Monday breakfast').fill('Idli, sambar & fresh fruit');
  await page.getByRole('button', { name: 'Publish menu' }).click();
  await page.getByText('Idli, sambar & fresh fruit', { exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + '/owner/overview');
  await page.getByRole('heading', { name: 'Welcome back, Aditya' }).waitFor();
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await page.screenshot({ path: path.join(output, 'owner-mobile.png'), fullPage: true });
  await page.getByRole('button', { name: 'Account and navigation' }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).last().click();
  await page.waitForURL('**/login');
  await page.getByRole('button', { name: 'Tenant demo' }).click();
  await page.waitForURL('**/tenant/overview');
  await page.getByRole('heading', { name: 'Welcome back, Aarav' }).waitFor();
  await page.getByRole('link', { name: 'Complaints', exact: true }).click();
  await page.getByRole('button', { name: 'Raise a complaint' }).click();
  await page.getByLabel('What’s the issue?').fill('QA leaking tap');
  await page
    .getByLabel('Tell us a little more')
    .fill('The bathroom tap is leaking and needs a repair.');
  await page.getByRole('button', { name: 'Submit complaint' }).click();
  await page.getByRole('heading', { name: 'QA leaking tap' }).waitFor();
  await page.screenshot({ path: path.join(output, 'tenant-mobile.png'), fullPage: true });
  assert.deepEqual(errors, []);
  process.stdout.write(
    'Browser checks passed: owner demo, tenant profile search, announcement creation, menu editing, mobile overflow, account navigation, tenant complaint creation.\n',
  );
} finally {
  await context.close();
}
