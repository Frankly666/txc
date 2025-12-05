/**
 * ui 自动化测试所需常量
 */
const CONSTANTS = {
  // 正常访问QQ会员页面所需 ua
  qqvipNeededUserAgent: 'Mozilla/5.0 (Linux; Android 7.0; VKY-AL00 Build/HUAWEIVKY-AL00; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/66.0.3359.126 MQQBrowser/6.2 TBS/044502 Mobile Safari/537.36 V1_AND_SQ_8.9.7_0_RDM_B QQ/8.0.0.1206 NetType/WIFI WebP/0.3.0 Pixel/1440 StatusBarHeight/96',

  // qq 登录页面
  loginUrl: 'https://ui.ptlogin2.qq.com/cgi-bin/login?hide_title_bar=1&style=9&no_verifyimg=1&link_target=blank&appid=8000212&target=top&daid=18&s_url=https%3A%2F%2Fclub.vip.qq.com%2Fqqvip%2Fbenefits%2Fhome',

  // 测试用 qq 号码
  testQQNumber: process.env.TEST_QQ_NUMBER || '',

  // 测试用 qq 密码
  testQQPassword: process.env.TEST_QQ_PASSWORD || '',

  // 默认页面尺寸
  defaultViewport: { width: 400, height: 700 },

  // chrome 的默认安装路径
  chromeDefaultExecutablePath: '/usr/bin/google-chrome',

  // 兔小巢的登陆页面
  tuxiaonengLoginUrl: 'https://txc.qq.com/login.html',

};

module.exports = CONSTANTS;
