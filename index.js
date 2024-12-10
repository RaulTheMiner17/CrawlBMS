import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import AdblockerPlugin from 'puppeteer-extra-plugin-adblocker';
import RecaptchaPlugin from 'puppeteer-extra-plugin-recaptcha';
import fs from 'fs';
import path from 'path';

// Apply Puppeteer plugins
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
const URL_FILE = 'opened_urls.txt';
const ERROR_LOG_FILE = 'errors.log';
const LAST_SUCCESSFUL_FILE = 'last_successful.txt';
const VENUGAAN_URL_PART = 'venugaan-a-dance-theater-via-bharatanatyam';
const FULL_URL_PATTERN = `https://in.bookmyshow.com/events/venugaan-a-dance-theater-via-bharatanatyam/ET00`;
const INITIAL_ID = 423558; // Default starting ID

// Utility: Read the last successful ID
const getLastSuccessfulID = () => {
  if (fs.existsSync(LAST_SUCCESSFUL_FILE)) {
    return parseInt(fs.readFileSync(LAST_SUCCESSFUL_FILE, 'utf8'), 10);
  }
  return INITIAL_ID;
};

// Utility: Update the last successful ID
const updateLastSuccessfulID = (id) => {
  fs.writeFileSync(LAST_SUCCESSFUL_FILE, id.toString(), 'utf8');
};

// Utility: Remove the last 10 occurrences of the specified pattern and add a new line
const removeLastOccurrences = (pattern, count) => {
  const lines = fs.readFileSync(URL_FILE, 'utf8').split('\n').filter(Boolean);

  // Find all indices matching the pattern
  const matchingIndices = [];
  lines.forEach((line, index) => {
    if (line.startsWith(pattern)) {
      matchingIndices.push(index);
    }
  });

  if (matchingIndices.length < count) {
    console.log(`[INFO] Fewer than ${count} occurrences found. No entries removed.`);
    return;
  }

  // Get the indices of the last `count` occurrences
  const indicesToRemove = matchingIndices.slice(-count);

  // Create a new array excluding the marked indices
  const updatedLines = lines.filter((_, index) => !indicesToRemove.includes(index));
  fs.writeFileSync(URL_FILE, updatedLines.join('\n') + '\n', 'utf8'); // Add a newline at the end
  console.log(`[INFO] Removed the last ${count} occurrences of the pattern and added a newline.`);
};

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    userDataDir: USER_DATA_DIR,
  });

  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  );

  let currentID = getLastSuccessfulID();
  let similarURLCount = 0;
  let firstOccurrenceID = null; // Track the first occurrence of the pattern

  while (true) {
    const url = `${FULL_URL_PATTERN}${currentID}`;
    console.log(`[INFO] Checking URL: ${url}`);

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      const currentUrl = await page.url();

      if (currentUrl.includes('sorry')) {
        console.log(`[NOT FOUND] URL does not exist: ${url}`);
      } else {
        fs.appendFileSync(URL_FILE, `${currentUrl}\n`);
        console.log(`[SUCCESS] Captured URL: ${currentUrl}`);

        if (currentUrl.includes(VENUGAAN_URL_PART)) {
          similarURLCount++;
          if (firstOccurrenceID === null) {
            firstOccurrenceID = currentID; // Record the first occurrence ID
          }
        } else {
          similarURLCount = 0; // Reset count for unique URLs
        }

        if (similarURLCount >= 10) {
          console.log(`[STOPPING] Found ${VENUGAAN_URL_PART} 10 times. Cleaning up and exiting.`);
          removeLastOccurrences(FULL_URL_PATTERN, 10);
          updateLastSuccessfulID(firstOccurrenceID); // Save the first occurrence ID
          break;
        }
      }
    } catch (error) {
      console.error(`[ERROR] Failed for URL: ${url}, Error: ${error.message}`);
      fs.appendFileSync(ERROR_LOG_FILE, `Failed URL: ${url}, Error: ${error.message}\n`);
    }

    currentID++;
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Delay to reduce server load
  }

  await browser.close();
  console.log('Script terminated.');
})();
