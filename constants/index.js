/**
 * 兔小巢数据爬取所需常量
 */

// 动态加载配置
let config = null;
try {
  const { getConfig } = require('../config_loader');
  config = getConfig();
} catch (error) {
  // 如果配置加载失败，使用环境变量
  console.warn('配置加载器不可用，将使用环境变量');
}

const CONSTANTS = {
  // 登录用 QQ 号码
  testQQNumber: config ? config.get('account.qq_number') : (process.env.TEST_QQ_NUMBER || ''),

  // 登录用 QQ 密码
  testQQPassword: config ? config.get('account.qq_password') : (process.env.TEST_QQ_PASSWORD || ''),

  // 默认页面尺寸
  defaultViewport: { width: 400, height: 700 },

  // Chrome 的默认安装路径
  chromeDefaultExecutablePath: '/usr/bin/google-chrome',

  // 兔小巢登录页面
  tuxiaonengLoginUrl: 'https://txc.qq.com/login.html',

};

module.exports = CONSTANTS;
