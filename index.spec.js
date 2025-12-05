const puppeteer = require('puppeteer-core');
const { expect } = require('chai');

const extraCases = require('./cases/extraCases');
const executeCommonCases = require('./cases/commonCases');
const CONSTANTS = require('./constants/index');
const PAGES = require('./constants/pages');

const sleep = duration => new Promise((resolve) => {
  setTimeout(() => {
    resolve();
  }, duration);
});

// 定义初始化 puppeteer 的函数
const initPuppeteer = async () => {
  const browser = await puppeteer.launch({
    executablePath: CONSTANTS.chromeDefaultExecutablePath,
    headless: true,
    defaultViewport: CONSTANTS.defaultViewport,
    args: [],
  });
  const page = await browser.newPage();

  // 模拟页面登录的方式获取登录态
  await page.goto(CONSTANTS.loginUrl, {
    timeout: 30 * 1000,
    waitUntil: 'load',
  });
  await page.type('#u', CONSTANTS.testQQNumber);
  await page.type('#p', CONSTANTS.testQQPassword);
  await page.click('#go');
  await sleep(2000);
  await page.setUserAgent(CONSTANTS.qqvipNeededUserAgent);
  return {
    browser,
    page,
  };
};

// 定义执行各页面测试用例的函数
const executeCases = (pageData, index, pages) => {
  const { name, key, url } = pageData;
  describe(`测试${name}页面：${url}`, () => {
    before(async () => {
      // 打开需要测试的页面
      global.consoleErrorMessages = [];

      // 记录控制台的错误输出
      global.page.on('console', (message) => {
        if (message.type() === 'error') {
          global.consoleErrorMessages.push(message.text());
        }
      });
      await global.page.goto(url, {
        timeout: 30 * 1000,
        waitUntil: 'load',
      });
    });

    // 如果是最后一个页面，则定义after钩子来销毁puppeteer实例
    if (index === pages.length - 1) {
      after(() => {
        global.browser.close();
      });
    }

    // 执行通用测试用例
    executeCommonCases(name);

    // 注册各页面自定义测试用例
    for (let j = 0; j < extraCases.length; j++) {
      const { key: pageKey, executeExtraCases } = extraCases[j];
      if (pageKey === key) {
        executeExtraCases();
      }
    }
  });
};

describe('ui自动化测试', () => {
  before(async () => {
    const response = await initPuppeteer();
    global.page = response.page;
    global.browser = response.browser;
  });

  it('测试是否有登录态', async () => {
    // 获取页面cookie
    const { cookies: cookiesList } = await page._client.send('Network.getAllCookies');
    const skeyObj = cookiesList.find(item => item.name === 'skey');
    const pskeyObj = cookiesList.find(item => item.name === 'p_skey');
    const uinObj = cookiesList.find(item => item.name === 'uin');
    const puinObj = cookiesList.find(item => item.name === 'p_uin');
    expect(skeyObj).to.be.not.equal(undefined);
    expect(pskeyObj).to.be.not.equal(undefined);
    expect(uinObj).to.be.not.equal(undefined);
    expect(puinObj).to.be.not.equal(undefined);
  });

  describe('执行各页面测试用例', () => {
    PAGES.forEach(executeCases);
  });
});
