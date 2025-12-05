/**
 * 测试优化后的兔小巢数据获取功能
 * 验证Cookie优先策略是否正常工作
 */
require('dotenv').config();
const { crawlAndStoreFeedback } = require('./utils/tuxiaochaoLogin');
const fs = require('fs');
const path = require('path');

// 从环境变量读取时间范围配置
const TASK_INTERVAL_MINUTES = parseInt(process.env.TASK_INTERVAL_MINUTES || '30', 10);
console.log('配置时间范围:', process.env.TASK_INTERVAL_MINUTES, '分钟');

// Cookie文件路径
const COOKIE_FILE_PATH = path.join(__dirname, 'data/txc_cookies.json');

async function testOptimizedFlow() {
  console.log('🧪 开始测试优化后的兔小巢数据获取流程');
  console.log('=' .repeat(50));
  
  try {
    // 检查当前Cookie状态
    console.log('📋 检查Cookie状态:');
    if (fs.existsSync(COOKIE_FILE_PATH)) {
      const cookieData = JSON.parse(fs.readFileSync(COOKIE_FILE_PATH, 'utf8'));
      const isExpired = cookieData.expiresAt <= Date.now();
      console.log(`   Cookie文件存在: ✅`);
      console.log(`   Cookie过期状态: ${isExpired ? '❌ 已过期' : '✅ 有效'}`);
      console.log(`   过期时间: ${new Date(cookieData.expiresAt).toLocaleString()}`);
    } else {
      console.log(`   Cookie文件: ❌ 不存在`);
    }
    
    console.log('\n🚀 开始数据获取测试...');
    const startTime = Date.now();
    
    // 执行数据获取
    const result = await crawlAndStoreFeedback(TASK_INTERVAL_MINUTES); // 获取配置时间范围内的数据
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log('\n📊 测试结果:');
    console.log(`   执行时间: ${duration}秒`);
    console.log(`   获取方式: ${result.method === 'cookie' ? '🍪 Cookie请求' : '🌐 浏览器登录'}`);
    console.log(`   数据条数: ${result.feedbackCount}条`);
    console.log(`   执行状态: ${result.success ? '✅ 成功' : '❌ 失败'}`);
    console.log(`   详细信息: ${result.message}`);
    
    // 性能分析
    console.log('\n⚡ 性能分析:');
    if (result.method === 'cookie') {
      console.log('   🎉 优秀！使用Cookie直接获取数据，速度快，资源消耗低');
      console.log('   💡 建议：继续保持Cookie有效性，定期检查过期时间');
    } else {
      console.log('   ⚠️  使用了浏览器登录，相对较慢但获取了新的Cookie');
      console.log('   💡 建议：下次执行将使用新保存的Cookie，速度会更快');
    }
    
  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    console.error('错误详情:', error.stack);
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('🏁 测试完成');
}

// 执行测试
if (require.main === module) {
  testOptimizedFlow();
}

module.exports = { testOptimizedFlow };