/**
 * Cookie 管理服务
 * 负责 Cookie 的加载、验证、保存和浏览器登录获取
 */
const puppeteer = require('puppeteer');
const fs = require('fs');
const CONSTANTS = require('../constants/index');
const { sleep, ensureDir, COOKIE_PATH, DATA_DIR } = require('./shared');

/**
 * 从文件加载 Cookie
 * @returns {Object|null} - cookie 数据 { cookies, timestamp, expiresAt } 或 null
 */
function loadCookies() {
  try {
    if (fs.existsSync(COOKIE_PATH)) {
      const data = fs.readFileSync(COOKIE_PATH, 'utf8');
      const cookieData = JSON.parse(data);

      if (cookieData.expiresAt && cookieData.expiresAt > Date.now()) {
        console.log('从文件加载有效的Cookie');
        return cookieData;
      } else {
        console.log('Cookie已过期，需要重新登录');
        return null;
      }
    }
  } catch (error) {
    console.error('加载Cookie失败:', error.message);
  }
  return null;
}

/**
 * 检查 Cookie 数据是否有效（未过期）
 * @param {Object|null} cookieData - loadCookies 返回的对象
 * @returns {boolean}
 */
function areCookiesValid(cookieData) {
  return !!(cookieData && cookieData.cookies && cookieData.expiresAt > Date.now());
}

/**
 * 保存 Cookie 到文件（24 小时过期）
 * @param {Array} cookies - Puppeteer 返回的 cookie 数组
 */
function saveCookies(cookies) {
  try {
    ensureDir(DATA_DIR);
    const cookieData = {
      cookies,
      timestamp: Date.now(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    };
    fs.writeFileSync(COOKIE_PATH, JSON.stringify(cookieData, null, 2));
    console.log('Cookie已保存到文件');
  } catch (error) {
    console.error('保存Cookie失败:', error.message);
  }
}

/**
 * 通过 Puppeteer 浏览器登录获取新 Cookie
 * @returns {Promise<Array>} - cookie 数组
 */
async function loginAndGetCookies() {
  console.log('⚠️  Cookie失效或不存在，开始浏览器登录流程...');

  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: null,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--disable-gpu',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-ipc-flooding-protection',
      '--memory-pressure-off',
      '--max_old_space_size=4096',
      '--disable-extensions-except',
      '--disable-plugins',
      '--disable-default-apps',
      '--disable-sync',
      '--disable-translate',
      '--hide-scrollbars',
      '--mute-audio',
      '--disable-background-networking',
      '--disable-client-side-phishing-detection',
      '--disable-hang-monitor',
      '--disable-popup-blocking',
      '--disable-prompt-on-repost',
      '--disable-web-resources',
      '--metrics-recording-only',
      '--no-default-browser-check',
      '--safebrowsing-disable-auto-update',
      '--enable-automation',
      '--password-store=basic',
      '--use-mock-keychain',
    ],
    timeout: 120000,
    protocolTimeout: 120000,
  });

  try {
    const page = await browser.newPage();
    await page.setDefaultTimeout(60000);
    await page.setDefaultNavigationTimeout(60000);

    // 禁用图片和 CSS 加载以提高稳定性
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (req.resourceType() === 'stylesheet' || req.resourceType() === 'image') {
        req.abort();
      } else {
        req.continue();
      }
    });

    // 访问兔小巢登录页面
    await page.goto(CONSTANTS.tuxiaonengLoginUrl, {
      timeout: 60000,
      waitUntil: 'load',
    });

    // 等待登录框加载完成
    await page.waitForSelector('.login_account', { visible: true, timeout: 10000 });
    await page.waitForSelector('.login-panel__footer', { visible: true, timeout: 10000 });

    // 点击勾选框
    await page.waitForSelector('.t-checkbox__former', { visible: true, timeout: 10000 });
    await sleep(1000);
    await page.evaluate(() => {
      const checkbox = document.querySelector('.t-checkbox__former');
      if (checkbox) checkbox.click();
    });

    // 点击 QQ 登录链接
    await page.waitForSelector('.super_login_qq_link', { visible: true, timeout: 10000 });
    await sleep(1000);
    await page.evaluate(() => {
      const qqLoginLink = document.querySelector('.super_login_qq_link');
      if (qqLoginLink) qqLoginLink.click();
    });

    // 等待 QQ 登录 iframe 加载
    await sleep(2000);
    const frames = await page.frames();
    const loginFrame = frames.find((frame) => frame.url().includes('ptlogin2.qq.com'));

    // 密码登录
    await loginFrame.waitForSelector('#switcher_plogin', { visible: true, timeout: 10000 });
    await loginFrame.click('#switcher_plogin');
    await sleep(1000);

    await loginFrame.type('#u', CONSTANTS.testQQNumber);
    await loginFrame.type('#p', CONSTANTS.testQQPassword);
    await loginFrame.click('#login_button');

    // 等待登录完成
    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 60000 });
    await sleep(5000);

    // 验证跳转
    const currentUrl = await page.url();
    if (!currentUrl.includes('txc.qq.com/dashboard')) {
      throw new Error('登录失败：未能跳转到dashboard页面');
    }

    // 提取并保存 Cookie
    const cookies = await page.cookies();
    console.log('🍪 获取到新的Cookie，正在保存...');
    saveCookies(cookies);
    console.log('✅ Cookie已保存，下次可直接使用HTTP请求获取数据');

    return cookies;
  } finally {
    await browser.close();
    console.log('🔒 浏览器已关闭');
  }
}

/**
 * 获取有效 Cookie（优先缓存，失效则登录）
 * @returns {Promise<Array>} - cookie 数组
 */
async function getValidCookies() {
  const cached = loadCookies();
  if (areCookiesValid(cached)) {
    return cached.cookies;
  }
  return loginAndGetCookies();
}

module.exports = {
  loadCookies,
  areCookiesValid,
  saveCookies,
  loginAndGetCookies,
  getValidCookies,
};
