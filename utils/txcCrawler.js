/**
 * 兔小巢 HTTP 爬取模块
 * 负责构建请求头、调用 API 并处理重试逻辑
 */
const axios = require('axios');
const { sleep } = require('./shared');

// 兔小巢 API 基地址
const TXC_API_BASE = 'https://txc.qq.com/api/v2/330701/dashboard/posts/list';

/**
 * 用 cookie 字符串构建请求头
 * @param {string} cookieString - 拼接好的 cookie 字符串
 * @returns {Object} HTTP 请求头
 */
function buildHeaders(cookieString) {
  return {
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
    'user-agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  };
}

/**
 * 格式化日期为 YYYY-MM-DD HH:MM:SS
 * @param {Date} date
 * @returns {string}
 */
function formatDate(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/**
 * 根据时间范围构建请求参数
 * @param {number} timeRangeMinutes - 查询最近 N 分钟
 * @returns {Object} 请求参数
 */
function buildParams(timeRangeMinutes = 30) {
  const now = new Date();
  const start = new Date(now.getTime() - timeRangeMinutes * 60 * 1000);
  return {
    page: '1',
    count: '100',
    from: formatDate(start),
    to: formatDate(now),
    status: '0',
    order: '1',
    label: 'all',
  };
}

/**
 * 使用 Cookie 调用兔小巢 API 获取反馈列表（带重试）
 * @param {Array} cookies - Puppeteer cookie 数组 [{name, value}, ...]
 * @param {Object} options
 * @param {number} [options.timeRange=30] - 查询最近 N 分钟
 * @param {number} [options.retries=3] - 最大重试次数
 * @returns {Promise<Object|null>} API 响应数据或 null（cookie 失效时）
 */
async function fetchFeedbackList(cookies, { timeRange = 30, retries = 3 } = {}) {
  const cookieString = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
  const headers = buildHeaders(cookieString);
  const params = buildParams(timeRange);

  const queryString = Object.entries(params)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`使用保存的Cookie尝试获取数据... (第${attempt}次尝试)`);
      const response = await axios.get(`${TXC_API_BASE}?${queryString}`, {
        headers,
        timeout: 30000,
      });

      if (response.status === 200 && response.data && response.data.data) {
        console.log('使用保存的Cookie成功获取数据');
        return response.data;
      }
    } catch (error) {
      console.error(`第${attempt}次尝试失败:`, error.message);

      // 401/403 说明 cookie 已失效，直接返回 null
      if (error.response && (error.response.status === 401 || error.response.status === 403)) {
        console.log('Cookie已失效，需要重新登录');
        return null;
      }

      if (attempt < retries) {
        const delay = attempt * 2000;
        console.log(`等待${delay / 1000}秒后重试...`);
        await sleep(delay);
      }
    }
  }

  console.log('所有重试均失败，Cookie可能已失效，需要重新登录');
  return null;
}

module.exports = {
  buildHeaders,
  fetchFeedbackList,
  buildParams,
  formatDate,
};
