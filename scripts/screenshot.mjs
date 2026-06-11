import { chromium } from 'playwright';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1360, height: 860 } });
const desk = await ctx.newPage();
await desk.goto('http://localhost:5173/login');
await desk.fill('input[type=email]', 'joaosouzareyna@gmail.com');
await desk.fill('input[type=password]', 'Admin1234!');
await desk.click('button[type=submit]');
await desk.waitForURL('http://localhost:5173/', { timeout: 10000 });
await desk.waitForTimeout(2500);
await desk.screenshot({ path: 'C:/tmp/desk2.png' });
// mismo contexto (cookie compartida), viewport mobile
const mob = await ctx.newPage();
await mob.setViewportSize({ width: 402, height: 874 });
await mob.goto('http://localhost:5173/');
await mob.waitForTimeout(2500);
await mob.screenshot({ path: 'C:/tmp/mob2.png' });
await browser.close();
console.log('ok');
