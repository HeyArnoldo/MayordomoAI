import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto('http://localhost:5173/login');
await page.fill('input[type="email"]', 'joaosouzareyna@gmail.com');
await page.fill('input[type="password"]', 'Admin1234!');
await page.click('button[type="submit"]');
await page.waitForTimeout(2000);

await page.goto('http://localhost:5173/chat');
await page.waitForTimeout(2000);

await page.getByText('Nueva conversación', { exact: true }).first().click();
await page.waitForTimeout(800);
await page.fill('textarea', 'Dime mis últimos 10 movimientos');
await page.keyboard.press('Enter');
await page.waitForTimeout(16000);
await page.screenshot({ path: 'C:/Users/JOAO/AppData/Local/Temp/claude/tools-fixed.png' });

await browser.close();
console.log('done');
