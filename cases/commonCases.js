const { expect } = require('chai');
const imgEntropy = require('img-entropy');

const executeCommonCases = (name) => {
  it('测试页面是否白屏', async () => {
    // 对页面进行截图
    const now = Date.now();
    const path = `${process.cwd()}/screenshot/${now}_${name}.png`;
    await global.page.screenshot({ path });

    // 使用开源库 img-entropy 检测截图的图像熵
    const entropy = await imgEntropy(path).getEntropy({
      normalize: true,
    });
    // 图像熵小于0.01时，判定页面白屏
    expect(entropy).to.be.at.least(0.01);
  });

  it('测试页面控制台是否有 error 报错', () => {
    // 判断控制台消息中有多少条 error 类型的消息
    expect(global.consoleErrorMessages.length).to.equal(0, `\n${global.consoleErrorMessages.join('\n')}\n\n`);
  });
};

module.exports = executeCommonCases;
