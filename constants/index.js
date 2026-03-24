/**
 * 集中管理所有环境变量和常量配置
 * 非敏感配置提供默认值，敏感凭据必须通过环境变量注入
 */
const CONSTANTS = {
  // QQ凭据 — 必须通过环境变量注入，无默认值
  testQQNumber: process.env.TEST_QQ_NUMBER || '',
  testQQPassword: process.env.TEST_QQ_PASSWORD || '',

  // 定时任务间隔（分钟）
  taskIntervalMinutes: parseInt(process.env.TASK_INTERVAL_MINUTES || '15', 10),

  // 数据查询时间范围（分钟）
  queryTimeRangeMinutes: parseInt(process.env.QUERY_TIME_RANGE_MINUTES || '30', 10),

  // 混元API密钥
  hunyuanApiKey: process.env.HUNYUAN_API_KEY || '',

  // 兔小巢的登录页面
  tuxiaonengLoginUrl: 'https://txc.qq.com/login.html',
};

// 启动校验：缺少关键凭据时快速报错
if (!CONSTANTS.testQQNumber || !CONSTANTS.testQQPassword) {
  console.error('❌ 关键环境变量未配置！请设置 TEST_QQ_NUMBER 和 TEST_QQ_PASSWORD');
  console.error('   TEST_QQ_NUMBER:', CONSTANTS.testQQNumber ? '✅ 已配置' : '❌ 未配置');
  console.error('   TEST_QQ_PASSWORD:', CONSTANTS.testQQPassword ? '✅ 已配置' : '❌ 未配置');
}

module.exports = CONSTANTS;
