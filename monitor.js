/**
 * 兔小巢任务监控脚本
 * 用于监控定时任务进程是否正常运行，如果不正常则重启
 */
require('dotenv').config();
const { exec, spawn } = require('child_process');
const { sendAlarmMessage, sendStatusMessage } = require('./utils/wechatRobot');

// 监控频率（分钟）
const MONITOR_INTERVAL_MINUTES = 5;
// 保存子进程的引用
let taskProcess = null;
// 记录上次发送告警的时间
let lastAlarmTime = null;
// 告警最小间隔时间（小时）
const MIN_ALARM_INTERVAL_HOURS = 6;
// 重启尝试次数
let restartAttempts = 0;
// 最大重启尝试次数，超过这个次数才发送告警
const MAX_RESTART_ATTEMPTS = 3;

/**
 * 检查是否应该发送告警（根据时间间隔限制）
 * @returns {boolean} - 是否应该发送告警
 */
function shouldSendAlarm() {
  if (!lastAlarmTime) return true;
  
  const now = new Date();
  const hoursSinceLastAlarm = (now - lastAlarmTime) / (1000 * 60 * 60);
  
  return hoursSinceLastAlarm >= MIN_ALARM_INTERVAL_HOURS;
}

/**
 * 启动定时任务进程
 * @returns {Promise<number>} - 启动的进程ID
 */
async function startTaskProcess() {
  console.log(`[${new Date().toLocaleString()}] 启动定时任务进程...`);
  
  try {
    // 启动子进程并将输出合并到当前进程
    const child = spawn('node', ['scheduledtask.js'], {
      detached: false, // 不分离子进程
      stdio: 'inherit'  // 继承父进程的stdio，输出将显示在相同的控制台/日志中
    });
    
    // 保存子进程引用
    taskProcess = child;
    
    // 子进程成功启动后重置重启尝试次数
    restartAttempts = 0;
    
    // 子进程退出时的处理
    child.on('exit', async (code, signal) => {
      console.log(`[${new Date().toLocaleString()}] 定时任务进程退出，退出码: ${code}, 信号: ${signal}`);
      
      // 重置进程引用
      taskProcess = null;
      
      // 如果是非正常退出，尝试重启
      if (code !== 0) {
        restartAttempts++;
        console.log(`[${new Date().toLocaleString()}] 检测到非正常退出，尝试重启 (尝试 ${restartAttempts}/${MAX_RESTART_ATTEMPTS})...`);
        
        // 尝试重启进程
        try {
          await startTaskProcess();
          console.log(`[${new Date().toLocaleString()}] 任务进程重启成功`);
          // 重启成功，不发送告警
        } catch (restartError) {
          console.error(`[${new Date().toLocaleString()}] 任务进程重启失败: ${restartError.message}`);
          
          // 只有当达到最大重试次数，且满足最小告警间隔时，才发送告警
          if (restartAttempts >= MAX_RESTART_ATTEMPTS && shouldSendAlarm()) {
            await sendAlarmMessage("任务彻底中断", `定时任务重启失败，已尝试 ${restartAttempts} 次。最后错误: ${restartError.message}`).catch(err => {
              console.error('发送任务异常退出告警失败:', err.message);
            });
            lastAlarmTime = new Date(); // 更新最后告警时间
          }
        }
      } else {
        // 正常退出，重置重启计数
        restartAttempts = 0;
      }
    });
    
    console.log(`[${new Date().toLocaleString()}] 定时任务进程已启动，PID: ${child.pid}`);
    
    return child.pid;
  } catch (error) {
    console.error(`启动定时任务进程失败: ${error.message}`);
    
    // 增加重启尝试计数
    restartAttempts++;
    
    // 只有当达到最大重试次数，且满足最小告警间隔时，才发送告警
    if (restartAttempts >= MAX_RESTART_ATTEMPTS && shouldSendAlarm()) {
      await sendAlarmMessage("任务启动失败", `启动定时任务进程失败，已尝试 ${restartAttempts} 次。最后错误: ${error.message}`);
      lastAlarmTime = new Date(); // 更新最后告警时间
    }
    throw error;
  }
}

/**
 * 运行监控任务
 */
async function runMonitor() {
  try {
    console.log(`[${new Date().toLocaleString()}] 运行监控检查...`);
    
    // 检查当前是否有子进程在运行
    if (taskProcess && !taskProcess.killed) {
      console.log(`[${new Date().toLocaleString()}] 定时任务进程正在运行，PID: ${taskProcess.pid}`);
      return;
    } else {
      console.log(`[${new Date().toLocaleString()}] 定时任务进程不存在，需要启动`);
      
      // 如果有旧进程但已经退出，尝试清理
      if (taskProcess) {
        console.log(`清理已退出的进程引用，PID: ${taskProcess.pid}`);
        taskProcess = null;
      }
      
      // 尝试启动进程
      try {
        await startTaskProcess();
        // 启动成功，重置重启尝试计数
        restartAttempts = 0;
      } catch (error) {
        restartAttempts++;
        console.error(`启动定时任务进程失败: ${error.message}`);
        
        // 只有当达到最大重试次数，且满足最小告警间隔时，才发送告警
        if (restartAttempts >= MAX_RESTART_ATTEMPTS && shouldSendAlarm()) {
          await sendAlarmMessage("任务彻底中断", `启动定时任务进程失败，已尝试 ${restartAttempts} 次。最后错误: ${error.message}`);
          lastAlarmTime = new Date(); // 更新最后告警时间
        }
      }
    }
  } catch (error) {
    console.error(`[${new Date().toLocaleString()}] 监控任务执行出错:`, error.message);
    
    // 增加重启尝试计数
    restartAttempts++;
    
    // 只有当达到最大重试次数，且满足最小告警间隔时，才发送告警
    if (restartAttempts >= MAX_RESTART_ATTEMPTS && shouldSendAlarm()) {
      await sendAlarmMessage("监控异常", `监控任务执行出错，已尝试 ${restartAttempts} 次。最后错误: ${error.message}`);
      lastAlarmTime = new Date(); // 更新最后告警时间
    }
  }
}

/**
 * 启动监控任务
 */
async function startMonitor() {
  console.log(`[${new Date().toLocaleString()}] 启动监控任务...`);
  
  // 立即执行一次监控任务
  await runMonitor();
  
  // 设置定时执行
  setInterval(runMonitor, MONITOR_INTERVAL_MINUTES * 60 * 1000);
  
  console.log(`[${new Date().toLocaleString()}] 监控任务已启动，将每${MONITOR_INTERVAL_MINUTES}分钟执行一次`);
}

// 启动监控
if (require.main === module) {
  // 设置未捕获异常的处理
  process.on('uncaughtException', async (error) => {
    console.error('监控程序未捕获的异常:', error);
    
    // 增加重启尝试计数
    restartAttempts++;
    
    // 只有当达到最大重试次数，且满足最小告警间隔时，才发送告警
    if (restartAttempts >= MAX_RESTART_ATTEMPTS && shouldSendAlarm()) {
      await sendAlarmMessage("监控崩溃", `监控程序遇到未捕获的异常，已尝试 ${restartAttempts} 次。最后错误: ${error.message}`);
      lastAlarmTime = new Date(); // 更新最后告警时间
    }
    process.exit(1);
  });
  
  // 设置进程退出时的清理
  process.on('SIGINT', async () => {
    console.log('收到中断信号，停止监控服务...');
    if (taskProcess && !taskProcess.killed) {
      console.log(`关闭子进程，PID: ${taskProcess.pid}...`);
      taskProcess.kill();
    }
    // 不再发送关闭通知，只记录日志
    console.log('监控服务收到中断信号，正在停止');
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    console.log('收到终止信号，停止监控服务...');
    if (taskProcess && !taskProcess.killed) {
      console.log(`关闭子进程，PID: ${taskProcess.pid}...`);
      taskProcess.kill();
    }
    // 不再发送关闭通知，只记录日志
    console.log('监控服务收到终止信号，正在停止');
    process.exit(0);
  });
  
  startMonitor().catch(async (error) => {
    console.error('启动监控任务失败:', error.message);
    
    // 增加重启尝试计数
    restartAttempts++;
    
    // 只有当达到最大重试次数，且满足最小告警间隔时，才发送告警
    if (restartAttempts >= MAX_RESTART_ATTEMPTS && shouldSendAlarm()) {
      await sendAlarmMessage("监控启动失败", `启动监控任务失败，已尝试 ${restartAttempts} 次。最后错误: ${error.message}`);
      lastAlarmTime = new Date(); // 更新最后告警时间
    }
    process.exit(1);
  });
}

module.exports = { runMonitor, startMonitor };
