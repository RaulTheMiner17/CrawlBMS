import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import AdblockerPlugin from 'puppeteer-extra-plugin-adblocker';
import RecaptchaPlugin from 'puppeteer-extra-plugin-recaptcha';
import fs from 'fs';
import path from 'path';
import pLimit from 'p-limit';

// Configure Puppeteer plugins
puppeteer.use(StealthPlugin());
puppeteer.use(AdblockerPlugin({ blockTrackers: true }));
puppeteer.use(
  RecaptchaPlugin({
    provider: {
      id: '2captcha',
      token: '2276582296beebd15379cd705bedb343', // Replace with your 2Captcha API key
    },
    visualFeedback: true,
  })
);

const USER_DATA_DIR = path.join(process.cwd(), 'user_data');
const MAX_CONCURRENT_TASKS = 2; // Number of concurrent tabs
const URL_FILE = 'opened_urls.txt';
const ERROR_LOG_FILE = 'errors.log';

// Utility for randomized delays
const randomDelay = (min, max) => Math.random() * (max - min) + min;

// Capture URL and handle retries
async function captureBookMyShow(url, page) {
  const MAX_RETRIES = 5;
  let retries = 0;

  while (retries < MAX_RETRIES) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      const currentUrl = await page.url();
      fs.appendFileSync(URL_FILE, `${currentUrl}\n`);
      console.log(`[SUCCESS] Captured URL: ${currentUrl}`);
      return;
    } catch (error) {
      retries++;
      console.error(`[ERROR] Failed for URL: ${url}, Attempt: ${retries}`);
      fs.appendFileSync(ERROR_LOG_FILE, `Failed URL: ${url}, Error: ${error.message}\n`);
      if (retries < MAX_RETRIES) {
        console.log('[RETRYING]');
        await new Promise(resolve => setTimeout(resolve, randomDelay(1000, 3000)));
      }
    }
  }
  console.error(`[FAILED] Skipping URL after ${MAX_RETRIES} retries: ${url}`);
}

// Main function to manage tasks
(async () => {
  const limit = pLimit(MAX_CONCURRENT_TASKS); // Concurrency control
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    userDataDir: USER_DATA_DIR,
  });

  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  );

  const tasks = [];
  for (let i =423274; i <= 425000; i++) {
    const url = `https://in.bookmyshow.com/events/venugaan-a-dance-theater-via-bharatanatyam/ET00${i}`;
    tasks.push(limit(() => captureBookMyShow(url, page)));

    // Add a slight delay before processing the next URL
    await new Promise(resolve => setTimeout(resolve, randomDelay(800, 1400))); // Delay before next URL
  }

  // Process all tasks
  await Promise.all(tasks);

  await browser.close();
  console.log('All tasks completed. Browser closed.');
})().catch(error => {
  console.error('Unhandled error in script:', error.message);
  fs.appendFileSync(ERROR_LOG_FILE, `Unhandled Error: ${error.message}\n`);
});
