/**
 * 兔小巢数据获取编排层
 * 协调 cookieService、txcCrawler、dataTransformer 和 feedbackSender
 */
const { getValidCookies, loadCookies, areCookiesValid } = require('./cookieService');
const { fetchFeedbackList } = require('./txcCrawler');
const { transformBatch } = require('./dataTransformer');
const FeedbackSender = require('./feedbackSender');
const { loginAndGetCookies } = require('./cookieService');

/**
 * 爬取兔小巢反馈并推送到 ifeedback
 * @param {number} timeRange - 查询最近 N 分钟（默认 30）
 * @returns {Promise<Object>} { success, feedbackCount, method, message }
 */
async function crawlAndStoreFeedback(timeRange = 30) {
  console.log('=== 开始兔小巢数据获取流程 ===');

  // 1. 获取有效 Cookie（优先缓存）
  let cookies;
  let method = 'cookie';
  const cached = loadCookies();

  if (areCookiesValid(cached)) {
    cookies = cached.cookies;
    console.log('发现有效的Cookie，尝试直接获取数据...');
  } else {
    cookies = await loginAndGetCookies();
    method = 'browser';
  }

  // 2. 调用 API 获取反馈列表
  let responseData = await fetchFeedbackList(cookies, { timeRange });

  // 如果 cookie 方式失败，回退到浏览器登录
  if (!responseData && method === 'cookie') {
    console.log('Cookie获取数据失败，尝试浏览器登录...');
    cookies = await loginAndGetCookies();
    method = 'browser';
    responseData = await fetchFeedbackList(cookies, { timeRange });
  }

  if (!responseData || !responseData.data) {
    throw new Error('未能获取到反馈数据');
  }

  // 3. 转换数据格式
  const payloads = transformBatch(responseData.data);
  console.log(`开始处理${payloads.length}条反馈数据...`);

  // 4. 推送到 ifeedback
  const sender = new FeedbackSender('qqvip');
  const result = await sender.sendToIfeedback(payloads);

  if (result.code === 200) {
    console.log(`成功推送${payloads.length}条反馈数据到ifeedback服务`);
  } else {
    console.error('推送数据到ifeedback服务失败:', result.msg);
  }

  const methodText = method === 'cookie' ? '(使用Cookie)' : '(浏览器登录)';
  console.log(`✅ 成功获取${responseData.data.length}条反馈数据 ${methodText}`);

  return {
    success: true,
    feedbackCount: responseData.data.length,
    method,
    message: `成功获取${responseData.data.length}条反馈数据 ${methodText}`,
  };
}

module.exports = {
  crawlAndStoreFeedback,
};
