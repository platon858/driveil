import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({
  executablePath: 'C:/Users/plato/.cache/puppeteer/chrome/win64-146.0.7680.66/chrome-win64/chrome.exe',
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});
const page = await browser.newPage();
await page.setViewport({width: 576, height: 900});
const url = 'file:///C:/Users/plato/OneDrive/%D0%A0%D0%B0%D0%B1%D0%BE%D1%87%D0%B8%D0%B9%20%D1%81%D1%82%D0%BE%D0%BB/claude%20%D0%BF%D0%BB%D0%B0%D1%82%D0%BE%D0%BD/gambrinus/index.html';
await page.goto(url, {waitUntil: 'networkidle0', timeout: 30000});
await page.screenshot({path: 'screenshot1.png', fullPage: true});
await browser.close();
console.log('Screenshot saved');
