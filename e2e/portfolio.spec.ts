import { execFileSync } from 'node:child_process';
import { expect, test, type Page } from '@playwright/test';

test.beforeAll(() => { execFileSync(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'scripts/seed-e2e.ts'], { env: process.env }); });

async function calmVisit(page: Page, path = '/') {
  await page.addInitScript(() => { localStorage.setItem('nd-experience-mode', 'safe'); localStorage.setItem('nd-theme-muted-v1', 'true'); });
  await page.goto(path, { waitUntil: 'domcontentloaded' });
}
async function login(page: Page) {
  await calmVisit(page, '/bikram');
  const pin = page.getByLabel('Admin PIN');
  await expect(pin).toBeFocused(); // the login effect confirms hydration before typing
  await pin.fill('84627193');
  await expect(page.getByRole('button', { name: 'Authorize', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Authorize', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Admin console' })).toBeVisible();
}
async function section(page: Page, name: string, id: string) {
  const picker = page.getByRole('combobox', { name: 'Section', exact: true });
  if (await picker.isVisible()) await picker.selectOption(id);
  else await page.getByRole('navigation', { name: 'Admin sections' }).getByRole('button', { name: new RegExp(`^${name}(?: \\d+)?$`) }).click();
}

test('calm entrance, focus trap, Escape and preference persistence', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  const dialog = page.getByRole('dialog', { name: 'Choose your experience' });
  await expect(dialog).toBeVisible();
  await expect(page.locator('html')).toHaveClass(/safe-mode/);
  await expect(page.getByRole('button', { name: 'Use safe mode', exact: true })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'Enable glitch effect' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Use safe mode', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('main')).toBeFocused();
  await page.reload();
  await expect(dialog).not.toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('html')).toHaveClass(/safe-mode/);
});

test('reduced motion wins over an earlier glitch choice', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('nd-experience-mode', 'glitch'));
  await page.goto('/');
  await expect(page.locator('html')).toHaveClass(/safe-mode/);
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('navigation and project selection work with direct mobile links', async ({ page }, info) => {
  await calmVisit(page);
  if (info.project.name === 'mobile') {
    await page.getByRole('button', { name: 'Open menu' }).click();
    await page.getByRole('dialog').getByRole('link', { name: /Projects/ }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByRole('link', { name: 'Source: fixture-repo', exact: true })).toHaveAttribute('href', 'https://github.com/example/fixture');
    await expect(page.getByRole('link', { name: 'Demo: fixture-repo', exact: true })).toHaveAttribute('href', 'https://example.com/demo');
    await page.getByRole('link', { name: 'Details: Browser fixture toolkit', exact: true }).click();
  } else {
    await page.locator('header nav').getByRole('link', { name: /Projects/ }).click();
    await page.getByRole('button', { name: /project \/ 02 Browser fixture toolkit/ }).click();
  }
  await expect(page.locator('#project-preview')).toContainText('Browser fixture toolkit');
  await expect(page.locator('#project-preview a').filter({ hasText: 'View Project' })).toHaveAttribute('href', 'https://example.com/toolkit');
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', await page.locator('body').evaluate(node => node.clientWidth));
});

test('blog search, exact tags, pagination, details and SEO', async ({ page, request }) => {
  await calmVisit(page, '/blog');
  await expect(page.getByRole('status')).toHaveText('15 articles · Page 1 of 2');
  await expect(page.locator('main a[href^="/blog/browser-article-"]')).toHaveCount(12);
  await page.getByRole('link', { name: 'Next page' }).click();
  await expect(page.getByRole('status')).toHaveText('15 articles · Page 2 of 2');
  await page.getByLabel('Search articles').fill('Cryptography');
  await page.getByLabel('Tag', { exact: true }).fill('Crypto');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('7 articles · Page 1 of 1');
  await expect(page.locator('main')).not.toContainText('Private browser draft');
  await page.locator('main a[href^="/blog/browser-article-"]').first().click();
  await expect(page.locator('article')).toContainText('Synthetic article');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /https:\/\/bikram-cyber.vercel.app\/blog\/browser-article-/);
  expect(await page.locator('script[type="application/ld+json"]').first().textContent()).toContain('BlogPosting');
  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.status()).toBe(200); expect(await sitemap.text()).not.toContain('private-browser-draft');
  expect(await (await request.get('/robots.txt')).text()).toContain('Disallow: /api/');
  const privatePage = await request.get('/bikram');
  expect(privatePage.headers()['x-robots-tag']).toContain('noindex');
});

test('contact form submits to the real API and saves to admin inbox', async ({ page }, info) => {
  await calmVisit(page, '/#contact');
  await page.getByLabel('Name', { exact: true }).fill('Browser Tester');
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill('browser@example.com');
  const subject = `Browser contact ${info.project.name}`;
  await page.getByLabel('Subject', { exact: true }).fill(subject);
  await page.getByLabel('Message', { exact: true }).fill('Synthetic local browser message to verify the actual persistence flow.');
  await page.getByRole('button', { name: 'Send Message' }).click();
  await expect(page.getByRole('heading', { name: 'Message Sent!' })).toBeVisible();
  await login(page); await section(page, 'Inbox', 'inbox');
  await expect(page.getByText(subject, { exact: true })).toBeVisible();
});

test('admin create, publish, trash, restore, backup and revoked-session handling', async ({ page, request }, info) => {
  expect((await request.get('/api/admin/history')).status()).toBe(401);
  expect((await request.get('/api/admin/backup')).status()).toBe(401);
  await login(page);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Admin console' })).toBeVisible();
  await section(page, 'Blog', 'blog');
  const title = `Recovery article ${info.project.name}`;
  const slug = `recovery-article-${info.project.name}`;
  await page.getByRole('button', { name: 'New post', exact: true }).click();
  await page.getByLabel('Title *', { exact: true }).fill(title);
  await page.getByLabel('URL slug', { exact: true }).fill(slug);
  await page.getByLabel('Content (Markdown)', { exact: true }).fill('## Recovery test\n\nA real browser-created article.');
  await page.getByRole('button', { name: /^Save$/ }).click();
  const row = page.locator('li').filter({ has: page.getByRole('button', { name: `Edit ${title}`, exact: true }) });
  await expect(row).toContainText('Draft');
  expect((await page.request.get(`/blog/${slug}`)).status()).toBe(404);
  await row.getByRole('button', { name: `Edit ${title}`, exact: true }).click();
  await page.getByRole('switch', { name: 'Published', exact: true }).click();
  await page.getByRole('button', { name: /^Save$/ }).click();
  await expect(row).toContainText('Published');
  const article = await page.request.get(`/blog/${slug}`);
  expect(article.status()).toBe(200); expect(await article.text()).toContain('A real browser-created article.');
  page.on('dialog', dialog => dialog.accept());
  await row.getByRole('button', { name: `Delete ${title}`, exact: true }).click();
  await expect(row).toHaveCount(0);
  expect((await page.request.get(`/blog/${slug}`)).status()).toBe(404);
  await section(page, 'History & recovery', 'history');
  await page.getByRole('button', { name: 'Trash', exact: true }).click();
  const deletedRow = page.locator('li').filter({ has: page.getByText(title, { exact: true }) });
  await expect(deletedRow).toHaveCount(1);
  await deletedRow.getByRole('button', { name: 'Review version', exact: true }).click();
  await page.getByRole('button', { name: 'Restore before version', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Version restored' })).toBeVisible();
  expect((await page.request.get(`/blog/${slug}`)).status()).toBe(200);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download content backup' }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream(); const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const backup = Buffer.concat(chunks);
  const parsed = JSON.parse(backup.toString()); expect(parsed.format).toBe('own-verse-content'); expect(parsed.collections.AdminCredential).toBeUndefined();
  await page.getByLabel('Choose content backup', { exact: true }).setInputFiles({ name: 'content.json', mimeType: 'application/json', buffer: backup });
  await expect(page.getByText(/records validated. No changes applied/)).toBeVisible();
  await page.getByRole('button', { name: 'Restore validated backup', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'records restored.' })).toBeVisible();
  // Revoke via the real endpoint while keeping the dashboard mounted.
  expect((await page.request.post('/api/admin/logout')).ok()).toBe(true);
  await page.getByRole('button', { name: 'Refresh history', exact: true }).click();
  await expect(page.getByLabel('Admin PIN')).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'session expired' })).toBeVisible();
});
