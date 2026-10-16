/* Run after building and starting the synthetic e2e server, never against production. */
const { chromium, devices } = require('@playwright/test');
const fs = require('node:fs/promises');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, args: ['--no-sandbox'] });
  try {
    const context = await browser.newContext({ ...devices['Pixel 7'], reducedMotion: 'reduce' });
    const page = await context.newPage();
    const session = await context.newCDPSession(page);
    await session.send('Network.enable');
    await session.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 200000, uploadThroughput: 93750 });
    await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const fonts = new Map();
    session.on('Network.responseReceived', event => { if (event.type === 'Font') fonts.set(event.requestId, { url: event.response.url, bytes: 0 }); });
    session.on('Network.loadingFinished', event => { if (fonts.has(event.requestId)) fonts.get(event.requestId).bytes = event.encodedDataLength; });
    await page.addInitScript(() => {
      localStorage.setItem('nd-experience-mode', 'safe'); localStorage.setItem('nd-theme-muted-v1', 'true');
      window.__mobileMetrics = { lcp: 0, cls: 0, tbt: 0 };
      new PerformanceObserver(list => { for (const entry of list.getEntries()) window.__mobileMetrics.lcp = entry.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver(list => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__mobileMetrics.cls += entry.value; }).observe({ type: 'layout-shift', buffered: true });
      new PerformanceObserver(list => { for (const entry of list.getEntries()) window.__mobileMetrics.tbt += Math.max(0, entry.duration - 50); }).observe({ type: 'longtask', buffered: true });
    });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:3100/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => document.fonts.status === 'loaded', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(3000);
    const metrics = await page.evaluate(() => ({ ...window.__mobileMetrics, navigation: performance.getEntriesByType('navigation').map(n => ({ ttfb: n.responseStart, domContentLoaded: n.domContentLoadedEventEnd })), fontStatus: document.fonts.status, safeMode: document.documentElement.classList.contains('safe-mode'), overflow: document.documentElement.scrollWidth > innerWidth }));
    const result = { conditions: 'Chromium Pixel 7 emulation, 4x CPU slowdown, 1.6 Mbps down / 150 ms latency; synthetic local data; laboratory observation, not field Core Web Vitals', ...metrics, fontRequests: fonts.size, fontBytes: [...fonts.values()].reduce((sum, font) => sum + font.bytes, 0), errors };
    await fs.mkdir('test-results', { recursive: true });
    await fs.writeFile('test-results/mobile-performance.json', JSON.stringify(result, null, 2));
    await page.screenshot({ path: 'test-results/mobile-home.png', fullPage: true });
    console.log(JSON.stringify(result, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
