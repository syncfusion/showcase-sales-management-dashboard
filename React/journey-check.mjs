// Approval journey for the 2026-10-08 plan revision (openspec/architecture/app-plan.md, "End-to-end approval
// journey"): the assistant on every page, the order pipeline's allowed and blocked moves, the dashboard
// following a new order, docked navigation and reset. Run against the served build:
//   node journey-check.mjs <baseUrl> <screenshotDir> > ../../validation/logs/prototype-journey.json
// Exits 1 when any step fails. Not shipped: dist/ is built from src/ only.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE = (process.argv[2] ?? 'http://localhost:4318/sales-management/react').replace(/\/$/, '');
const OUT = process.argv[3] ?? '../../validation/screenshots/prototype-journey';
mkdirSync(OUT, { recursive: true });

const steps = [];
const errors = [];
const step = (name, pass, detail) => { steps.push({ name, pass: !!pass, detail }); };
const num = (text) => Number(String(text).replace(/[^0-9.-]/g, ''));

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript(() => { try { localStorage.setItem('oexl-theme', 'light'); } catch { /* ignore */ } });
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
const shot = (name) => page.screenshot({ path: join(OUT, `${name}.png`) });
// The trial banner (no key in this run) is removed only so it does not cover controls under test.
const hideBanner = () => page.evaluate(() => document.querySelectorAll('body > div').forEach((d) => { if (/trial version of Syncfusion|license key/i.test(d.textContent ?? '') && !d.id) d.remove(); }));
const kpi = async (label) => num(await page.locator('.kpi-card').filter({ has: page.getByText(label, { exact: true }) }).locator('.kpi-value').innerText());
const nav = async (label) => { await page.locator('#app-shell-sidebar a', { hasText: label }).click(); await page.waitForTimeout(1500); await hideBanner(); };
const fab = page.locator('#assistant-fab');
const panel = page.locator('#assistant-panel');
const panelOpen = () => panel.evaluate((el) => el.classList.contains('e-open'));

try {
  // 1. Dashboard: three chart panels, no assistant inside the layout, chat button at the bottom right.
  await page.goto(`${BASE}/dashboard`);
  await page.waitForSelector('#dashboard-layout .e-panel');
  await page.waitForTimeout(2500);
  await hideBanner();
  const panels = await page.locator('#dashboard-layout .e-panel').count();
  const charts = await page.locator('#dashboard-layout .e-panel svg').count();
  const inLayout = await page.locator('#dashboard-layout .e-aiassistview').count();
  const fabBox = await fab.boundingBox();
  const baseline = { orders: await kpi('Orders'), gross: await kpi('Gross sales') };
  step('1 dashboard has three chart panels and no assistant panel', panels === 3 && charts >= 3 && inLayout === 0, { panels, charts, inLayout, baseline });
  step('1 chat button sits at the bottom right', fabBox && fabBox.x + fabBox.width > 1440 - 60 && fabBox.y + fabBox.height > 900 - 60, fabBox);
  const wide = await page.locator('#dashboard-layout .e-panel').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().width)));
  step('1 monthly trend panel spans both columns', wide[2] > wide[0] * 1.8, { widths: wide });
  await shot('01-dashboard');

  // 2. Open the assistant, ask a suggestion, close it.
  const fabName = await fab.getAttribute('aria-label');
  await fab.click();
  await page.waitForSelector('#assistant-panel .e-aiassistview', { timeout: 15000 });
  await page.waitForTimeout(1200);
  const opened = await panelOpen();
  const box = await panel.boundingBox();
  const focusInPrompt = await page.evaluate(() => !!document.activeElement?.closest('#assistant-panel .e-footer'));
  const fabBecomesClose = (await fab.isVisible()) && (await fab.getAttribute('aria-label')) === 'Close AI Assist';
  const fabBelow = await (async () => { const f = await fab.boundingBox(); const p = await panel.boundingBox(); return f.y >= p.y + p.height; })();
  step('2 chat button opens the right-side panel', fabName === 'Open AI Assist' && opened && box && Math.round(box.x + box.width) === 1440 && Math.round(box.width) === 400, { fabName, box });
  step('2 focus moves to the prompt box; the chat button stays below the panel as the close button', focusInPrompt && fabBecomesClose && fabBelow, { focusInPrompt, fabBecomesClose, fabBelow });
  const suggestions = await page.locator('#assistant-panel .e-suggestion-list li').allInnerTexts();
  await shot('02-assistant-open');
  await page.locator('#assistant-panel .e-suggestion-list li').first().click();
  await page.waitForSelector('#assistant-panel .ai-answer', { timeout: 10000 });
  const answer1 = await page.locator('#assistant-panel .ai-answer').last().innerText();
  step('2 a suggestion gets a labelled sample answer', suggestions.length >= 3 && /Sample response/i.test(answer1), { suggestions, answer1 });
  await shot('03-assistant-answer');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);
  const closedByEsc = !(await panelOpen());
  const focusOnFab = await page.evaluate(() => document.activeElement?.id === 'assistant-fab');
  step('2 Escape closes the panel and focus returns to the chat button', closedByEsc && focusOnFab, { closedByEsc, focusOnFab });

  // 3. Other pages: the chat button is there and the conversation is kept.
  const perPage = {};
  for (const label of ['Orders', 'Appointments', 'Team', 'Organisation']) {
    await nav(label);
    const visible = await fab.isVisible();
    await fab.click();
    await page.waitForTimeout(700);
    const kept = await page.locator('#assistant-panel .ai-answer').count();
    await shot(`04-assistant-${label.toLowerCase()}`);
    await fab.click();
    await page.waitForTimeout(500);
    perPage[label] = { visible, kept, closed: !(await panelOpen()) };
  }
  step('3 chat button on every page, conversation kept, the same button closes the panel', Object.values(perPage).every((p) => p.visible && p.kept >= 1 && p.closed), perPage);

  // 4. Create an order.
  await nav('Orders'); // in-app navigation: a reload would start a new conversation
  await page.locator('#orders-tabs .e-tab-header .e-toolbar-item', { hasText: 'New order' }).click();
  await page.waitForSelector('#catalog');
  await page.waitForTimeout(1500);
  await hideBanner();
  const combo = page.locator('input#client');
  await combo.click();
  await combo.fill('James Tailor');
  await page.waitForTimeout(600);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  for (const name of ['Road Bike 1', 'Pack 1']) await page.locator('#catalog .e-list-item', { hasText: name }).first().locator('.e-checkbox-wrapper, .e-frame').first().click();
  await page.waitForTimeout(400);
  const qty = page.locator('.summary-line', { hasText: 'Road Bike 1' }).locator('input.e-numerictextbox');
  await qty.click(); await qty.fill('2'); await qty.press('Tab');
  await page.waitForTimeout(400);
  const total = num(await page.locator('.summary-total').innerText());
  await shot('05-new-order');
  await page.getByRole('button', { name: /create order/i }).click();
  await page.waitForTimeout(800);
  const toast = page.locator('.e-toast').first();
  const toastText = (await toast.count()) ? await toast.innerText() : '';
  const toastBox = (await toast.count()) ? await toast.boundingBox() : null;
  step('4 order of $504.00 is created and confirmed', total === 504 && /Order #\d+ created/.test(toastText), { total, toastText });
  step('4 toast appears at the top right, clear of the chat button', toastBox && toastBox.y < 200 && toastBox.x > 900, toastBox);
  const orderId = Number((toastText.match(/Order #(\d+)/) ?? [])[1]);
  await shot('06-order-toast');

  // 5. Pipeline: allowed and blocked moves.
  await nav('Orders');
  await page.locator('#orders-tabs .e-tab-header .e-toolbar-item', { hasText: 'Pipeline' }).click();
  await page.waitForSelector('#order-pipeline .e-card');
  await page.waitForTimeout(1500);
  await hideBanner();
  const columnOf = (id) => page.evaluate((cardId) => document.querySelector(`#order-pipeline .e-card[data-id="${cardId}"]`)?.closest('td')?.getAttribute('data-key') ?? null, String(id));
  const ids = await page.locator('#order-pipeline .e-card[data-id]').evaluateAll((els) => els.map((e) => e.getAttribute('data-id')));
  step('5 pipeline cards are keyed by order id and use Syncfusion Card markup', new Set(ids).size === ids.length && (await page.locator('#order-pipeline .e-card[data-id] .e-card-header').count()) === ids.length && (await page.locator('#order-pipeline .e-card .e-card').count()) === 0, { cards: ids.length });
  const drag = async (id, toKey) => {
    const from = page.locator(`#order-pipeline .e-card[data-id="${id}"]`);
    await from.scrollIntoViewIfNeeded();
    const a = await from.boundingBox();
    const b = await page.locator(`#order-pipeline td.e-content-cells[data-key="${toKey}"]`).boundingBox();
    await page.mouse.move(a.x + 40, a.y + 12);
    await page.mouse.down();
    await page.mouse.move(a.x + 60, a.y + 30, { steps: 5 });
    await page.mouse.move(b.x + b.width / 2, b.y + 60, { steps: 15 });
    await page.waitForTimeout(300);
    const cursor = await page.evaluate(() => getComputedStyle(document.querySelector('.e-kanban .e-cloned-card') ?? document.body).cursor);
    await page.mouse.up();
    await page.waitForTimeout(900);
    return cursor;
  };
  // When no session order exists the newest New card stands in, so the move checks still run.
  const subject = Number.isFinite(orderId) && (await columnOf(orderId)) ? orderId : Number(await page.locator('#order-pipeline td[data-key="New"] .e-card').first().getAttribute('data-id'));
  const startCol = await columnOf(subject);
  await drag(subject, 'Processing');
  const afterAllowed = await columnOf(subject);
  step('5 the new order starts in New and can be dragged to Processing', startCol === 'New' && afterAllowed === 'Processing', { subject, startCol, afterAllowed });
  await shot('07-pipeline-moved');
  const shipped = await page.locator('#order-pipeline td[data-key="Shipped"] .e-card').first().getAttribute('data-id');
  const cursor = await drag(shipped, 'New');
  const afterBlocked = await columnOf(shipped);
  step('5 a Shipped order cannot be dragged back to New', afterBlocked === 'Shipped', { shipped, afterBlocked, cursor });
  const delivered = await page.locator('#order-pipeline td[data-key="Delivered"] .e-card').first().getAttribute('data-id');
  await drag(delivered, 'Processing');
  step('5 a Delivered order is final', (await columnOf(delivered)) === 'Delivered', { delivered });

  // 6. Dashboard follows the new order; the assistant answers from the session data.
  await nav('Dashboard');
  await page.waitForTimeout(1500);
  const after = { orders: await kpi('Orders'), gross: await kpi('Gross sales') };
  step('6 dashboard counts the new order (+1 order, +$504)', after.orders === baseline.orders + 1 && Math.round((after.gross - baseline.gross) * 100) === 50400, { baseline, after });
  await fab.click();
  await page.waitForTimeout(900);
  const before = await page.locator('#assistant-panel .ai-answer').count();
  const prompt = page.locator('#assistant-panel .e-footer textarea, #assistant-panel .e-footer [contenteditable="true"]').first();
  await prompt.click();
  await page.keyboard.type('What is the average order value?');
  await page.keyboard.press('Enter');
  await page.waitForFunction((n) => document.querySelectorAll('#assistant-panel .ai-answer').length > n, before, { timeout: 10000 });
  const answer2 = await page.locator('#assistant-panel .ai-answer').last().innerText();
  step('6 a typed question is answered in the same conversation', /Sample response/i.test(answer2) && before >= 1, { before, answer2 });
  await shot('08-assistant-after-order');
  await fab.click();
  await page.waitForTimeout(500);

  // 7. Cancel the order: totals return.
  await nav('Orders');
  await page.locator('#orders-tabs .e-tab-header .e-toolbar-item', { hasText: 'Pipeline' }).click();
  await page.waitForSelector('#order-pipeline .e-card');
  await page.waitForTimeout(1500);
  await hideBanner();
  await page.locator(`#order-pipeline .e-card[data-id="${subject}"] button.card-move.danger`).click();
  await page.waitForTimeout(900);
  const cancelledCol = await columnOf(subject);
  await nav('Dashboard');
  await page.waitForTimeout(1500);
  const afterCancel = { orders: await kpi('Orders'), gross: await kpi('Gross sales') };
  step('7 cancelling the order returns the dashboard to its earlier values', cancelledCol === 'Cancelled' && afterCancel.orders === baseline.orders && afterCancel.gross === baseline.gross, { cancelledCol, afterCancel });

  // 8. Docked navigation and reset.
  const width = () => page.locator('#app-shell-sidebar').evaluate((el) => Math.round(el.getBoundingClientRect().width));
  const chartWidth = () => page.locator('#dashboard-layout .e-panel svg').first().evaluate((el) => Math.round(el.getBoundingClientRect().width));
  const expandedWidth = await width();
  const chartBefore = await chartWidth();
  await page.locator('#app-shell-menu-button').click();
  await page.waitForTimeout(1200);
  const dockedWidth = await width();
  const chartAfter = await chartWidth();
  await page.locator('#app-shell-sidebar a', { hasText: 'Orders' }).hover();
  await page.waitForTimeout(700);
  const tip = (await page.locator('.e-tooltip-wrap').count()) ? await page.locator('.e-tooltip-wrap').first().innerText() : '';
  await shot('09-navigation-docked');
  step('8 navigation docks to a 64px icon strip with tooltips and charts re-measure', expandedWidth === 240 && dockedWidth === 64 && chartAfter > chartBefore && /Orders/.test(tip), { expandedWidth, dockedWidth, chartBefore, chartAfter, tip });
  await page.mouse.move(700, 500);
  await page.locator('#app-shell-menu-button').click();
  await page.waitForTimeout(900);
  await page.getByRole('button', { name: 'Reset demo data' }).click();
  await page.waitForTimeout(900);
  await fab.click();
  await page.waitForTimeout(900);
  const afterReset = { orders: await kpi('Orders'), answers: await page.locator('#assistant-panel .ai-answer').count() };
  step('8 reset restores the baseline and starts a new conversation', afterReset.orders === baseline.orders && afterReset.answers === 0, afterReset);
  await shot('10-after-reset');

  // Dark theme and phone width, assistant open.
  await fab.click();
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await page.waitForTimeout(1200);
  await fab.click();
  await page.waitForTimeout(900);
  await shot('11-dark-assistant');
  await fab.click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.dispatchEvent(new Event('resize')));
  await page.waitForTimeout(1200);
  await fab.click();
  await page.waitForTimeout(900);
  const phone = await panel.boundingBox();
  await shot('12-phone-assistant');
  step('phone: the panel opens at full width', phone && Math.round(phone.width) === 390 && Math.round(phone.x) === 0, phone);
  await fab.click();
  await page.waitForTimeout(500);
  await shot('13-phone-dashboard');
} catch (e) {
  step('journey ran to the end', false, String(e));
  await shot('99-failure').catch(() => {});
}

await browser.close();
const consoleErrors = errors.filter((e) => !/license|trial/i.test(e));
step('no console errors', consoleErrors.length === 0, consoleErrors.slice(0, 10));
const failed = steps.filter((s) => !s.pass);
console.log(JSON.stringify({ base: BASE, ranAt: new Date().toISOString(), passed: failed.length === 0, steps }, null, 2));
process.exit(failed.length ? 1 : 0);
