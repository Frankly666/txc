#!/usr/bin/env node

/**
 * Docker健康检查脚本
 * 用于检查兔小巢反馈数据爬取服务的运行状态
 */

const fs = require('fs');
const path = require('path');

// 健康检查配置
const HEALTH_CHECK_CONFIG = {
  // 最大允许的无响应时间（分钟）
  MAX_SILENT_MINUTES: 60,
  // 日志文件路径
  LOG_FILES: [
    '/app/logs/monitor-output.log',
    '/app/logs/monitor-error.log'
  ],
  // 关键文件路径
  CRITICAL_FILES: [
    '/app/monitor.js',
    '/app/scheduledTask.js',
    '/app/utils/tuxiaochaoLogin.js'
  ]
};

/**
 * 检查文件是否存在
 * @param {string} filePath 文件路径
 * @returns {boolean} 文件是否存在
 */
function checkFileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch (error) {
    console.error(`检查文件失败: ${filePath}`, error.message);
    return false;
  }
}

/**
 * 检查日志文件的最后修改时间
 * @param {string} logPath 日志文件路径
 * @returns {boolean} 是否在允许的时间范围内
 */
function checkLogFreshness(logPath) {
  try {
    if (!fs.existsSync(logPath)) {
      console.warn(`日志文件不存在: ${logPath}`);
      return false;
    }

    const stats = fs.statSync(logPath);
    const lastModified = stats.mtime;
    const now = new Date();
    const diffMinutes = (now - lastModified) / (1000 * 60);

    console.log(`日志文件 ${logPath} 最后修改时间: ${lastModified.toISOString()}, ${diffMinutes.toFixed(1)}分钟前`);
    
    return diffMinutes <= HEALTH_CHECK_CONFIG.MAX_SILENT_MINUTES;
  } catch (error) {
    console.error(`检查日志文件失败: ${logPath}`, error.message);
    return false;
  }
}

/**
 * 检查进程是否运行
 * @returns {boolean} PM2进程是否正常运行
 */
function checkProcessStatus() {
  try {
    const { execSync } = require('child_process');
    const result = execSync('pm2 jlist', { encoding: 'utf8' });
    const processes = JSON.parse(result);
    
    const monitorProcess = processes.find(p => p.name === 'tuxiaochao-monitor');
    
    if (!monitorProcess) {
      console.error('未找到tuxiaochao-monitor进程');
      return false;
    }
    
    const isOnline = monitorProcess.pm2_env.status === 'online';
    console.log(`进程状态: ${monitorProcess.pm2_env.status}, PID: ${monitorProcess.pid}`);
    
    return isOnline;
  } catch (error) {
    console.error('检查进程状态失败:', error.message);
    return false;
  }
}

/**
 * 检查数据目录状态
 * @returns {boolean} 数据目录是否正常
 */
function checkDataDirectory() {
  const dataDir = '/app/data';
  const cookieFile = path.join(dataDir, 'txc_cookies.json');
  
  try {
    // 检查数据目录是否存在
    if (!fs.existsSync(dataDir)) {
      console.error('数据目录不存在:', dataDir);
      return false;
    }
    
    // 检查目录权限
    fs.accessSync(dataDir, fs.constants.R_OK | fs.constants.W_OK);
    console.log('数据目录权限正常');
    
    // 检查Cookie文件（如果存在）
    if (fs.existsSync(cookieFile)) {
      const stats = fs.statSync(cookieFile);
      console.log(`Cookie文件存在，大小: ${stats.size} bytes`);
    } else {
      console.log('Cookie文件不存在（首次运行正常）');
    }
    
    return true;
  } catch (error) {
    console.error('检查数据目录失败:', error.message);
    return false;
  }
}

/**
 * 主健康检查函数
 */
async function healthCheck() {
  console.log('🏥 开始健康检查...');
  console.log('检查时间:', new Date().toISOString());
  
  let allChecksPass = true;
  const results = [];
  
  // 1. 检查关键文件
  console.log('\n📁 检查关键文件...');
  for (const file of HEALTH_CHECK_CONFIG.CRITICAL_FILES) {
    const exists = checkFileExists(file);
    results.push({ check: `文件存在: ${file}`, pass: exists });
    if (!exists) allChecksPass = false;
  }
  
  // 2. 检查进程状态
  console.log('\n🔄 检查进程状态...');
  const processOk = checkProcessStatus();
  results.push({ check: 'PM2进程状态', pass: processOk });
  if (!processOk) allChecksPass = false;
  
  // 3. 检查日志文件新鲜度
  console.log('\n📝 检查日志文件...');
  for (const logFile of HEALTH_CHECK_CONFIG.LOG_FILES) {
    const fresh = checkLogFreshness(logFile);
    results.push({ check: `日志新鲜度: ${logFile}`, pass: fresh });
    // 注意：日志文件不新鲜不一定是致命错误，可能是服务刚启动
  }
  
  // 4. 检查数据目录
  console.log('\n💾 检查数据目录...');
  const dataOk = checkDataDirectory();
  results.push({ check: '数据目录状态', pass: dataOk });
  if (!dataOk) allChecksPass = false;
  
  // 输出检查结果
  console.log('\n📊 健康检查结果:');
  results.forEach(result => {
    const status = result.pass ? '✅' : '❌';
    console.log(`${status} ${result.check}`);
  });
  
  console.log(`\n🏁 总体状态: ${allChecksPass ? '✅ 健康' : '❌ 异常'}`);
  
  // 退出码：0表示健康，1表示异常
  process.exit(allChecksPass ? 0 : 1);
}

// 运行健康检查
if (require.main === module) {
  healthCheck().catch(error => {
    console.error('健康检查执行失败:', error);
    process.exit(1);
  });
}

module.exports = { healthCheck };