const puppeteer = require('puppeteer');
const fs = require('fs');

// Load credentials from credentials.json
const credentials = JSON.parse(fs.readFileSync('credentials.json', 'utf8'));

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null
  });

  const page = await browser.newPage();

  // Go to login page
  await page.goto('https://github.com/login', { waitUntil: 'networkidle2' });

  // Login
  await page.type('#login_field', credentials.username);
  await page.type('#password', credentials.password);
  await Promise.all([
    page.click('input[name="commit"]'),
    page.waitForNavigation({ waitUntil: 'networkidle2' })
  ]);

  // Wait for login to finish
  await page.waitForSelector('meta[name="octolytics-actor-login"]');

  // Get actual username
  const actualUsername = await page.$eval(
    'meta[name="octolytics-actor-login"]',
    meta => meta.content
  );

  const repositories = [
    'cheeriojs/cheerio',
    'axios/axios',
    'puppeteer/puppeteer'
  ];

  // Helper: click a button by visible text
  async function clickButtonByText(tag, text) {
    const elements = await page.$$(tag);
    for (const el of elements) {
      const elText = await page.evaluate(node => node.textContent.trim(), el);
      if (elText.includes(text)) {
        await el.click();
        return true;
      }
    }
    return false;
  }

  // Star repos
  for (const repo of repositories) {
    await page.goto(`https://github.com/${repo}`, { waitUntil: 'networkidle2' });

    let starred = false;

    const buttonSelectors = [
      'button[aria-label*="Star this repository"]',
      'button[title*="Star this repository"]',
      'form[action$="/star"] button',
      '#repository-details-container button'
    ];

    for (const selector of buttonSelectors) {
      const btn = await page.$(selector);
      if (btn) {
        const text = await page.evaluate(node => node.textContent.trim(), btn);
        if (text.includes('Star')) {
          await btn.click();
          starred = true;
          break;
        }
      }
    }

    if (!starred) {
      await clickButtonByText('button', 'Star');
    }

    await page.waitForTimeout(1500);
  }

  // Go to stars page
  await page.goto(`https://github.com/${actualUsername}?tab=stars`, {
    waitUntil: 'networkidle2'
  });

  // Click "Create list"
  let clickedCreateList = await clickButtonByText('button', 'Create list');
  if (!clickedCreateList) {
    clickedCreateList = await clickButtonByText('a', 'Create list');
  }

  await page.waitForTimeout(1500);

  // Type list name
  const inputSelectors = [
    'input[placeholder*="List name"]',
    'input[name="name"]',
    'input[id*="list"]',
    'input[type="text"]'
  ];

  for (const selector of inputSelectors) {
    const input = await page.$(selector);
    if (input) {
      await input.click({ clickCount: 3 });
      await input.type('Node Libraries');
      break;
    }
  }

  await page.waitForTimeout(1000);

  // Click Create
  const buttons = await page.$$('button');
  for (const button of buttons) {
    const buttonText = await button.evaluate(node => node.textContent.trim());
    if (buttonText === 'Create') {
      await button.click();
      break;
    }
  }

  await page.waitForTimeout(2000);

  for (const repo of repositories) {
    await page.goto(`https://github.com/${repo}`, { waitUntil: 'networkidle2' });

    const dropdownSelector =
      'details details-menu, summary[aria-label*="List"], summary[aria-haspopup="menu"]';

    // Open star/list dropdown
    let opened = false;

    const summarySelectors = [
      'summary[aria-label*="List"]',
      'summary[aria-haspopup="menu"]',
      'details summary'
    ];

    for (const selector of summarySelectors) {
      const summary = await page.$(selector);
      if (summary) {
        await summary.click();
        opened = true;
        break;
      }
    }

    if (!opened) {
      const buttons2 = await page.$$('button');
      for (const button of buttons2) {
        const text = await page.evaluate(node => node.textContent.trim(), button);
        if (text.includes('Star') || text.includes('Lists')) {
          await button.click();
          opened = true;
          break;
        }
      }
    }

    await page.waitForTimeout(2000);

    // Find the list and click it
    const lists = await page.$$('.js-user-list-menu-form, label, li');

    for (const list of lists) {
      const text = await page.evaluate(node => node.innerText || node.textContent, list);
      if (text && text.includes('Node Libraries')) {
        await list.click();
        break;
      }
    }

    await page.waitForTimeout(1000);

    // Close dropdown
    const summaries = await page.$$('summary');
    if (summaries.length > 0) {
      await summaries[0].click();
    }

    await page.waitForTimeout(1000);
  }

  await browser.close();
})();