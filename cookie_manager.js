/**
 * Cookie管理工具
 * 用于查看、清理和管理兔小巢Cookie
 */

const fs = require('fs');
const path = require('path');

// Cookie文件路径
const COOKIE_FILE_PATH = path.join(__dirname, 'data/txc_cookies.json');

/**
 * 显示Cookie状态信息
 */
function showCookieStatus() {
  console.log('🍪 Cookie状态检查');
  console.log('=' .repeat(40));
  
  if (!fs.existsSync(COOKIE_FILE_PATH)) {
    console.log('❌ Cookie文件不存在');
    console.log('💡 建议：运行一次数据获取任务来生成Cookie');
    return;
  }
  
  try {
    const cookieData = JSON.parse(fs.readFileSync(COOKIE_FILE_PATH, 'utf8'));
    const now = Date.now();
    const isExpired = cookieData.expiresAt <= now;
    const timeLeft = cookieData.expiresAt - now;
    
    console.log(`📁 Cookie文件: 存在`);
    console.log(`📅 创建时间: ${new Date(cookieData.timestamp).toLocaleString()}`);
    console.log(`⏰ 过期时间: ${new Date(cookieData.expiresAt).toLocaleString()}`);
    console.log(`🔍 当前状态: ${isExpired ? '❌ 已过期' : '✅ 有效'}`);
    
    if (!isExpired) {
      const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
      const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
      console.log(`⏳ 剩余时间: ${hoursLeft}小时${minutesLeft}分钟`);
    }
    
    console.log(`🍪 Cookie数量: ${cookieData.cookies ? cookieData.cookies.length : 0}个`);
    
    // 显示关键Cookie
    if (cookieData.cookies && cookieData.cookies.length > 0) {
      console.log('\n🔑 关键Cookie:');
      const keyCookies = cookieData.cookies.filter(c => 
        ['_tucao_session', 'ptui_loginuin', '_horizon_sid'].includes(c.name)
      );
      keyCookies.forEach(cookie => {
        const value = cookie.value.length > 20 ? cookie.value.substring(0, 20) + '...' : cookie.value;
        console.log(`   ${cookie.name}: ${value}`);
      });
    }
    
  } catch (error) {
    console.error('❌ 读取Cookie文件失败:', error.message);
  }
}

/**
 * 清理过期的Cookie
 */
function cleanExpiredCookies() {
  console.log('🧹 清理过期Cookie');
  console.log('=' .repeat(40));
  
  if (!fs.existsSync(COOKIE_FILE_PATH)) {
    console.log('❌ Cookie文件不存在，无需清理');
    return;
  }
  
  try {
    const cookieData = JSON.parse(fs.readFileSync(COOKIE_FILE_PATH, 'utf8'));
    const isExpired = cookieData.expiresAt <= Date.now();
    
    if (isExpired) {
      fs.unlinkSync(COOKIE_FILE_PATH);
      console.log('✅ 已清理过期的Cookie文件');
      console.log('💡 下次运行将自动进行浏览器登录获取新Cookie');
    } else {
      console.log('✅ Cookie仍然有效，无需清理');
    }
    
  } catch (error) {
    console.error('❌ 清理Cookie失败:', error.message);
  }
}

/**
 * 强制清理所有Cookie
 */
function forceCleanCookies() {
  console.log('💥 强制清理所有Cookie');
  console.log('=' .repeat(40));
  
  if (fs.existsSync(COOKIE_FILE_PATH)) {
    fs.unlinkSync(COOKIE_FILE_PATH);
    console.log('✅ 已强制删除Cookie文件');
    console.log('💡 下次运行将自动进行浏览器登录获取新Cookie');
  } else {
    console.log('❌ Cookie文件不存在');
  }
}

/**
 * 显示帮助信息
 */
function showHelp() {
  console.log('🛠️  Cookie管理工具使用说明');
  console.log('=' .repeat(40));
  console.log('用法: node cookie_manager.js [命令]');
  console.log('');
  console.log('可用命令:');
  console.log('  status    - 显示Cookie状态信息');
  console.log('  clean     - 清理过期的Cookie');
  console.log('  force     - 强制清理所有Cookie');
  console.log('  help      - 显示此帮助信息');
  console.log('');
  console.log('示例:');
  console.log('  node cookie_manager.js status');
  console.log('  node cookie_manager.js clean');
}

// 命令行处理
if (require.main === module) {
  const command = process.argv[2];
  
  switch (command) {
    case 'status':
      showCookieStatus();
      break;
    case 'clean':
      cleanExpiredCookies();
      break;
    case 'force':
      forceCleanCookies();
      break;
    case 'help':
    case undefined:
      showHelp();
      break;
    default:
      console.log(`❌ 未知命令: ${command}`);
      showHelp();
  }
}

module.exports = {
  showCookieStatus,
  cleanExpiredCookies,
  forceCleanCookies
};