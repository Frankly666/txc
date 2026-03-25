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
    console.log('[登录流程] 1/10 新页面已创建');

    // 禁用图片和 CSS 加载以提高稳定性
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (req.resourceType() === 'stylesheet' || req.resourceType() === 'image') {
        req.abort();
      } else {
        req.continue();
      }
    });

    // 监听页面错误和 console
    page.on('pageerror', (err) => console.error('[登录流程] 页面JS错误:', err.message));
    page.on('requestfailed', (req) => {
      if (req.resourceType() !== 'stylesheet' && req.resourceType() !== 'image') {
        console.warn(`[登录流程] 请求失败: ${req.url()} - ${req.failure()?.errorText}`);
      }
    });

    // 访问兔小巢登录页面
    console.log(`[登录流程] 2/10 正在访问登录页: ${CONSTANTS.tuxiaonengLoginUrl}`);
    await page.goto(CONSTANTS.tuxiaonengLoginUrl, {
      timeout: 60000,
      waitUntil: 'domcontentloaded',
    });
    console.log(`[登录流程] 2/10 登录页加载完成, URL: ${page.url()}`);

    // 等待登录框加载完成
    console.log('[登录流程] 3/10 等待登录框 .login_account ...');
    await page.waitForSelector('.login_account', { visible: true, timeout: 10000 });
    console.log('[登录流程] 3/10 等待 .login-panel__footer ...');
    await page.waitForSelector('.login-panel__footer', { visible: true, timeout: 10000 });
    console.log('[登录流程] 3/10 登录框已加载');

    // 点击勾选框
    console.log('[登录流程] 4/10 等待并点击协议勾选框 .t-checkbox__former ...');
    await page.waitForSelector('.t-checkbox__former', { visible: true, timeout: 10000 });
    await sleep(1000);
    await page.evaluate(() => {
      const checkbox = document.querySelector('.t-checkbox__former');
      if (checkbox) checkbox.click();
    });
    console.log('[登录流程] 4/10 协议勾选框已点击');

    // 点击 QQ 登录链接
    console.log('[登录流程] 5/10 等待并点击 QQ 登录链接 .super_login_qq_link ...');
    await page.waitForSelector('.super_login_qq_link', { visible: true, timeout: 10000 });
    await sleep(1000);
    await page.evaluate(() => {
      const qqLoginLink = document.querySelector('.super_login_qq_link');
      if (qqLoginLink) qqLoginLink.click();
    });
    console.log('[登录流程] 5/10 QQ 登录链接已点击');

    // 等待 QQ 登录 iframe 加载
    console.log('[登录流程] 6/10 等待 QQ 登录 iframe 加载...');
    await sleep(2000);
    const frames = await page.frames();
    console.log(`[登录流程] 6/10 页面共有 ${frames.length} 个 frame:`);
    frames.forEach((f, i) => console.log(`  frame[${i}]: ${f.url()}`));
    const loginFrame = frames.find((frame) => frame.url().includes('ptlogin2.qq.com'));

    if (!loginFrame) {
      throw new Error('未找到 QQ 登录 iframe (ptlogin2.qq.com)');
    }
    console.log(`[登录流程] 6/10 找到 QQ 登录 iframe: ${loginFrame.url()}`);

    // 密码登录
    console.log('[登录流程] 7/10 切换到密码登录 #switcher_plogin ...');
    await loginFrame.waitForSelector('#switcher_plogin', { visible: true, timeout: 10000 });
    await loginFrame.click('#switcher_plogin');
    await sleep(1000);
    console.log('[登录流程] 7/10 已切换到密码登录模式');

    console.log(`[登录流程] 8/10 输入QQ号 (${CONSTANTS.testQQNumber ? CONSTANTS.testQQNumber.slice(0, 3) + '***' : '空'}) 和密码...`);

    // 先清空输入框，再逐字符输入（模拟真实键盘事件触发 JS 加密处理）
    await loginFrame.click('#u', { clickCount: 3 }); // 选中已有内容
    await loginFrame.type('#u', CONSTANTS.testQQNumber, { delay: 50 });
    await sleep(500);

    await loginFrame.click('#p', { clickCount: 3 });
    await loginFrame.type('#p', CONSTANTS.testQQPassword, { delay: 50 });
    await sleep(500);

    // 输入完成后，检查输入框实际值
    const inputCheck = await loginFrame.evaluate(() => {
      const uInput = document.querySelector('#u');
      const pInput = document.querySelector('#p');
      return {
        qqValue: uInput ? uInput.value : 'input#u不存在',
        pwdLength: pInput ? pInput.value.length : -1,
        // 检查密码是否被加密处理（QQ登录页可能有隐藏字段存储加密密码）
        hiddenFields: Array.from(document.querySelectorAll('input[type="hidden"]')).map(el => ({
          name: el.name || el.id,
          hasValue: el.value.length > 0,
          valueLength: el.value.length,
        })),
      };
    });
    console.log(`[登录流程] 8/10 输入检查: QQ=${inputCheck.qqValue}, 密码长度=${inputCheck.pwdLength}`);
    console.log(`[登录流程] 8/10 隐藏字段: ${JSON.stringify(inputCheck.hiddenFields)}`);

    console.log('[登录流程] 8/10 点击登录按钮...');
    // 先注册导航监听再点击，防止导航发生太快被错过
    const navigationPromise = page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch((err) => {
      console.warn(`[登录流程] 8/10 waitForNavigation 异常: ${err.message}`);
      return null;
    });
    // 用 evaluate 在 iframe 内直接触发点击，更可靠
    await loginFrame.evaluate(() => {
      const btn = document.querySelector('#login_button');
      if (btn) btn.click();
    });
    console.log('[登录流程] 8/10 登录按钮已点击（evaluate方式），等待页面跳转...');

    // 等 2 秒后检查 iframe 内是否有网络请求发出（看 form action）
    await sleep(2000);
    try {
      const postClickCheck = await loginFrame.evaluate(() => {
        const errMsg = document.querySelector('#err_m');
        return {
          errorMsg: errMsg ? errMsg.textContent.trim() : null,
          errorVisible: errMsg ? (window.getComputedStyle(errMsg).display !== 'none' && errMsg.textContent.trim() !== '') : false,
          pageTitle: document.title,
          url: window.location.href,
        };
      });
      console.log(`[登录流程] 8/10 点击2秒后iframe状态: ${JSON.stringify(postClickCheck)}`);
    } catch (e) {
      console.log(`[登录流程] 8/10 点击后iframe已跳转（无法evaluate）: ${e.message}`);
    }

    // 点击后等 5 秒，截图 + 检查 iframe 状态
    await sleep(5000);
    console.log(`[登录流程] 8/10 点击登录5秒后, 主页面URL: ${page.url()}`);

    // 截图保存点击登录后的状态
    try {
      await page.screenshot({ path: '/app/screenshot/after-login-click.png', fullPage: true });
      console.log('[登录流程] 8/10 截图已保存: /app/screenshot/after-login-click.png');
    } catch (e) {
      console.error('[登录流程] 8/10 截图失败:', e.message);
    }

    // 检查 iframe 内登录状态（错误信息、验证码等）
    try {
      const loginStatus = await loginFrame.evaluate(() => {
        const errMsg = document.querySelector('#err_m');
        const verifyArea = document.querySelector('#newVcodeArea');
        const tcaptcha = document.querySelector('#tcaptcha_iframe');
        const loginBtn = document.querySelector('#login_button');
        return {
          errorMsg: errMsg ? errMsg.textContent.trim() : null,
          errorVisible: errMsg ? window.getComputedStyle(errMsg).display !== 'none' : false,
          hasVerifyCode: !!(verifyArea && window.getComputedStyle(verifyArea).display !== 'none'),
          hasTcaptcha: !!tcaptcha,
          loginBtnText: loginBtn ? loginBtn.value || loginBtn.textContent : null,
          iframeUrl: window.location.href,
        };
      });
      console.log(`[登录流程] 8/10 iframe登录状态: ${JSON.stringify(loginStatus)}`);
    } catch (evalErr) {
      console.warn(`[登录流程] 8/10 iframe状态检测失败（可能已跳转）: ${evalErr.message}`);
    }

    // 列出当前所有 frames
    const currentFrames = page.frames();
    console.log(`[登录流程] 8/10 当前 ${currentFrames.length} 个frame:`);
    currentFrames.forEach((f, i) => console.log(`  frame[${i}]: ${f.url()}`));

    // 等待首次导航完成
    console.log('[登录流程] 9/10 等待 navigationPromise 完成...');
    await navigationPromise;
    console.log(`[登录流程] 9/10 首次跳转完成, URL: ${page.url()}`);

    // QQ 登录会经历多次跳转 (graph.qq.com → callback → dashboard)，等待最终落地
    const maxWait = 30000;
    const startTime = Date.now();
    while (!page.url().includes('txc.qq.com/dashboard') && Date.now() - startTime < maxWait) {
      console.log(`[登录流程] 9/10 等待最终跳转... 当前URL: ${page.url()}`);
      await sleep(2000);
    }
    console.log(`[登录流程] 9/10 最终URL: ${page.url()}`);

    // 验证跳转
    const currentUrl = await page.url();
    if (!currentUrl.includes('txc.qq.com/dashboard')) {
      // 截图保存用于调试
      try {
        await page.screenshot({ path: '/app/screenshot/login-failed.png', fullPage: true });
        console.log('[登录流程] 登录失败截图已保存到 /app/screenshot/login-failed.png');
      } catch (e) {
        console.error('[登录流程] 截图失败:', e.message);
      }
      // 最后再打印一次所有 cookie，帮助判断
      const failCookies = await page.cookies();
      console.log(`[登录流程] 登录失败时共有 ${failCookies.length} 个cookie:`);
      failCookies.forEach((c) => console.log(`  ${c.name}=${c.value.slice(0, 20)}... domain=${c.domain}`));
      throw new Error(`登录失败：未能跳转到dashboard页面，当前URL: ${currentUrl}`);
    }

    // 提取并保存 Cookie
    const cookies = await page.cookies();
    console.log(`[登录流程] 10/10 🍪 获取到 ${cookies.length} 个Cookie，正在保存...`);
    saveCookies(cookies);
    console.log('[登录流程] 10/10 ✅ Cookie已保存，下次可直接使用HTTP请求获取数据');

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
