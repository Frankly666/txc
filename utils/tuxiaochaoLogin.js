/**
 * 兔小巢数据获取工具函数
 * 优先使用保存的cookie进行HTTP请求获取数据
 * 仅在cookie失效时才启动浏览器重新登录
 */
const puppeteer = require('puppeteer');
const CONSTANTS = require('../constants/index');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FeedbackSender = require('./feedbackSender');

const sleep = duration => new Promise((resolve) => {
  setTimeout(() => {
    resolve();
  }, duration);
});

// 保存cookie的文件路径
const COOKIE_FILE_PATH = path.join(__dirname, '../data/txc_cookies.json');

/**
 * 格式化日期为MySQL日期时间格式
 * @param {Date} date - 日期对象
 * @returns {string} - 格式化后的日期字符串 YYYY-MM-DD HH:MM:SS
 */
function formatDate(date) {
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/**
 * 获取指定时间范围的开始时间
 * @param {Date} endDate - 结束时间
 * @param {number} timeRange - 时间范围：分钟数
 * @returns {Date} - 开始时间
 */
function getStartDate(endDate, timeRange) {
  const endDateCopy = new Date(endDate);
  // 确保timeRange是数字，默认使用30分钟
  const minutes = parseInt(timeRange, 10) || 30;
  endDateCopy.setMinutes(endDateCopy.getMinutes() - minutes);
  return formatDate(endDateCopy);
}

/**
 * 保存cookie到文件
 * @param {Array} cookies - cookie数组
 */
async function saveCookies(cookies) {
  try {
    // 确保目录存在
    const dir = path.dirname(COOKIE_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // 保存cookie和时间戳
    const cookieData = {
      cookies,
      timestamp: Date.now(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 默认24小时过期
    };
    
    fs.writeFileSync(COOKIE_FILE_PATH, JSON.stringify(cookieData, null, 2));
    console.log('Cookie已保存到文件');
  } catch (error) {
    console.error('保存Cookie失败:', error.message);
  }
}

/**
 * 从文件加载cookie
 * @returns {Object|null} - cookie数据或null
 */
function loadCookies() {
  try {
    if (fs.existsSync(COOKIE_FILE_PATH)) {
      const data = fs.readFileSync(COOKIE_FILE_PATH, 'utf8');
      const cookieData = JSON.parse(data);
      
      // 检查cookie是否过期
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
 * 使用保存的cookie尝试直接获取数据（带重试机制）
 * @param {Array} cookies - cookie数组
 * @param {Object} params - 请求参数
 * @param {number} retries - 重试次数
 * @returns {Object|null} - 响应数据或null
 */
async function fetchDataWithCookies(cookies, params, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // 构建cookie字符串
      const cookieString = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
      
      // 构建请求头
      const headers = {
        accept: '*/*',
        'accept-encoding': 'gzip, deflate, br, zstd',
        'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6,zh-TW;q=0.5',
        connection: 'keep-alive',
        cookie: cookieString,
        host: 'txc.qq.com',
        referer: 'https://txc.qq.com/dashboard/all-posts',
        'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      };
      
      // 构建查询字符串
      const queryString = Object.entries(params)
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join('&');
      
      console.log(`使用保存的Cookie尝试获取数据... (第${attempt}次尝试)`);
      const response = await axios.get(`https://txc.qq.com/api/v2/330701/dashboard/posts/list?${queryString}`, {
        headers,
        timeout: 30000, // 30秒超时
      });
      
      if (response.status === 200 && response.data && response.data.data) {
        console.log('使用保存的Cookie成功获取数据');
        return response.data;
      }
    } catch (error) {
      console.error(`第${attempt}次尝试失败:`, error.message);
      
      // 如果是401或403错误，说明cookie已失效，不需要重试
      if (error.response && (error.response.status === 401 || error.response.status === 403)) {
        console.log('Cookie已失效，需要重新登录');
        return null;
      }
      
      // 如果不是最后一次尝试，等待后重试
      if (attempt < retries) {
        const delay = attempt * 2000; // 递增延迟：2秒、4秒、6秒
        console.log(`等待${delay/1000}秒后重试...`);
        await sleep(delay);
      }
    }
  }
  
  console.log('所有重试均失败，Cookie可能已失效，需要重新登录');
  return null;
}

/**
 * 智能数据获取流程：优先使用cookie，失效时才登录
 * @param {number} timeRange - 时间范围：数字(表示分钟数)
 * @returns {Promise<Object>} - 返回浏览器实例、页面实例和响应数据
 */
async function initTuxiaochaoLogin(timeRange = 30) {
  // 获取当前时间
  const currentDate = new Date();
  
  // 生成请求参数
  const spanType = parseInt(timeRange, 10) || 30; // 确保timeRange是数字，默认30分钟
  const params = {
    page: '1',
    count: '100',
    from: getStartDate(currentDate, spanType),
    to: formatDate(currentDate),
    status: '0',
    order: '1',
    label: 'all',
  };
  
  console.log('=== 开始兔小巢数据获取流程 ===');
  
  // 第一步：尝试从文件加载cookie
  const cookieData = loadCookies();
  if (cookieData && cookieData.cookies) {
    console.log('发现有效的Cookie，尝试直接获取数据...');
    // 尝试使用保存的cookie获取数据（带重试机制）
    const responseData = await fetchDataWithCookies(cookieData.cookies, params);
    if (responseData) {
      // 使用保存的cookie成功获取数据，无需启动浏览器
      console.log('✅ 使用Cookie成功获取数据，无需启动浏览器');
      // 推送数据到ifeedback服务
      await pushResponseData(responseData);
      return {
        browser: null,
        page: null,
        responseData,
        method: 'cookie' // 标记使用的方法
      };
    }
  }
  
  // 第二步：Cookie失效或不存在，执行浏览器登录
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
      '--disable-background-timer-throttling',
      '--disable-client-side-phishing-detection',
      '--disable-default-apps',
      '--disable-hang-monitor',
      '--disable-popup-blocking',
      '--disable-prompt-on-repost',
      '--disable-sync',
      '--disable-web-resources',
      '--metrics-recording-only',
      '--no-default-browser-check',
      '--safebrowsing-disable-auto-update',
      '--enable-automation',
      '--password-store=basic',
      '--use-mock-keychain'
    ],
    timeout: 120000,
    protocolTimeout: 120000
  });
  const page = await browser.newPage();
  
  // 设置页面超时和稳定性参数
  await page.setDefaultTimeout(60000);
  await page.setDefaultNavigationTimeout(60000);
  
  // 禁用图片和CSS加载以提高稳定性
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    if(req.resourceType() == 'stylesheet' || req.resourceType() == 'image'){
      req.abort();
    } else {
      req.continue();
    }
  });

  // 访问兔小巢登录页面
  await page.goto(CONSTANTS.tuxiaonengLoginUrl, {
    timeout: 60 * 1000,
    waitUntil: 'load',
  });

  // 等待登录框加载完成
  await page.waitForSelector('.login_account', { visible: true, timeout: 10000 });

  // 等待登录面板加载
  await page.waitForSelector('.login-panel__footer', { visible: true, timeout: 10000 });

  // 点击勾选框
  await page.waitForSelector('.t-checkbox__former', { visible: true, timeout: 10000 });
  await sleep(1000); // 增加等待时间确保元素完全加载
  await page.evaluate(() => {
    const checkbox = document.querySelector('.t-checkbox__former');
    if (checkbox) {
      checkbox.click();
    }
  });

  // 等待QQ登录链接加载
  await page.waitForSelector('.super_login_qq_link', { visible: true, timeout: 10000 });
  await sleep(1000); // 增加等待时间确保元素完全加载
  await page.evaluate(() => {
    const qqLoginLink = document.querySelector('.super_login_qq_link');
    if (qqLoginLink) {
      qqLoginLink.click();
    }
  });

  // 等待QQ登录iframe加载
  await sleep(2000);

  // 切换到QQ登录iframe
  const frames = await page.frames();
  const loginFrame = frames.find(frame => frame.url().includes('ptlogin2.qq.com'));

  // 等待密码登录按钮加载并点击
  await loginFrame.waitForSelector('#switcher_plogin', { visible: true, timeout: 10000 });
  await loginFrame.click('#switcher_plogin');
  await sleep(1000); // 等待密码登录界面切换完成

  // 输入QQ号和密码
  await loginFrame.type('#u', CONSTANTS.testQQNumber);
  await loginFrame.type('#p', CONSTANTS.testQQPassword);
  await loginFrame.click('#login_button');

  // 等待登录完成并跳转
  await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 60000 });

  await sleep(5000);

  // 验证当前URL是否正确
  const currentUrl = await page.url();
  if (!currentUrl.includes('txc.qq.com/dashboard')) {
    throw new Error('登录失败：未能跳转到dashboard页面');
  }

  // 获取页面的cookies并保存
  const cookies = await page.cookies();
  console.log('🍪 获取到新的Cookie，正在保存...');
  await saveCookies(cookies);
  console.log('✅ Cookie已保存，下次可直接使用HTTP请求获取数据');

  // 构建完整的cookie字符串
  const cookieString = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');

  // 构建请求头
  const headers = {
    accept: '*/*',
    'accept-encoding': 'gzip, deflate, br, zstd',
    'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6,zh-TW;q=0.5',
    connection: 'keep-alive',
    cookie: cookieString,
    host: 'txc.qq.com',
    referer: 'https://txc.qq.com/dashboard/all-posts',
    'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  };

  // 保持编码逻辑
  const queryString = Object.entries(params)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');

  console.log('queryString: ', queryString);

  // 发送请求获取数据
  let responseData = null;
  try {
    const response = await axios.get(`https://txc.qq.com/api/v2/330701/dashboard/posts/list?${queryString}`, {
      headers,
    });

    if (response.status !== 200) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    responseData = response.data;
    console.log('✅ 浏览器登录成功，获取API响应数量:', responseData.data.length);
    
    // 推送数据到ifeedback服务
    await pushResponseData(responseData);
  } catch (error) {
    console.error('获取接口数据失败:', error);
    throw error; // 向上传播错误以便调用者处理
  }

  return {
    browser,
    page,
    responseData,
    method: 'browser' // 标记使用的方法
  };
}

/**
 * 将响应数据直接推送到ifeedback服务
 * @param {Object} responseData - API响应数据
 */
async function pushResponseData(responseData) {
  if (responseData && responseData.data && Array.isArray(responseData.data)) {
    console.log(`开始处理${responseData.data.length}条反馈数据...`);
    
    // 转换数据格式为ifeedback所需格式
    const formattedData = responseData.data.map(post => {
      const qqNumber = post.field_values.find(field => field.label === 'QQ')?.value || null;
      
      const date = new Date(post.created_at);
      const localTime = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
      
      const formattedItem = {
        time: localTime,
        uin: post.id,
        QQ: qqNumber,
        comment: post.content,
        nick_name: post.nick_name
      };
      
      // 如果有图片，添加图片URL列表
      if (post.images && post.images.length > 0) {
        formattedItem.picurllist = post.images.map(img => img.original_url).join('|');
      }
      
      // 添加 extra 字段中的客户端信息
      if (post.extra) {
        if (post.extra.clientInfo) {
          formattedItem.clientInfo = post.extra.clientInfo;
        }
        if (post.extra.clientVersion) {
          formattedItem.clientVersion = post.extra.clientVersion;
        }
        if (post.extra.os) {
          formattedItem.os = post.extra.os;
        }
        if (post.extra.osVersion) {
          formattedItem.osVersion = post.extra.osVersion;
        }
        if (post.extra.customInfo) {
          formattedItem.customInfo = post.extra.customInfo;
        }
        if (post.extra.user_agent) {
          formattedItem.user_agent = post.extra.user_agent;
        }
      }
      
      return formattedItem;
    });
    
    // 创建FeedbackSender实例并直接推送
    const sender = new FeedbackSender('qqvip');
    const result = await sender.sendToIfeedback(formattedData);
    
    if (result.code === 200) {
      console.log(`成功推送${formattedData.length}条反馈数据到ifeedback服务`);
    } else {
      console.error('推送数据到ifeedback服务失败:', result.msg);
    }
    
    return result;
  }
  return { code: 400, msg: '没有有效的反馈数据' };
 }

/**
 * 智能获取并推送反馈数据
 * @param {number} timeRange - 时间范围：分钟数
 * @returns {Promise<Object>} - 返回获取结果
 */
async function crawlAndStoreFeedback(timeRange = 30) {
  let browser;
  try {
    const { browser: _browser, page, responseData, method } = await initTuxiaochaoLogin(timeRange);
    browser = _browser;
    
    if (!responseData || !responseData.data) {
      throw new Error('未能获取到反馈数据');
    }
    
    const methodText = method === 'cookie' ? '(使用Cookie)' : '(浏览器登录)';
    console.log(`✅ 成功获取${responseData.data.length}条反馈数据 ${methodText}`);
    
    // 关闭浏览器（如果有）
    if (browser) {
      await browser.close();
      console.log('🔒 浏览器已关闭');
    }
    
    return {
      success: true,
      feedbackCount: responseData.data.length,
      method: method,
      message: `成功获取${responseData.data.length}条反馈数据 ${methodText}`
    };
  } catch (error) {
    console.error('❌ 获取反馈数据失败:', error.message);
    if (browser) {
      await browser.close();
    }
    throw error;
  }
}

module.exports = {
  initTuxiaochaoLogin,
  crawlAndStoreFeedback
};
