/**
 * 定时任务脚本
 * 用于定期爬取兔小巢反馈数据并推送到ifeedback服务
 */
require('dotenv').config();
const cron = require('node-cron');
const { crawlAndStoreFeedback } = require('./utils/tuxiaochaoLogin');
const { sendAlarmMessage, sendStatusMessage } = require('./utils/wechatRobot');
const { getConfig } = require('./config_loader');

// 加载配置
const config = getConfig();
config.printConfig();

// 定时任务间隔时间（分钟），默认为30分钟
// 可以通过config.json或环境变量TASK_INTERVAL_MINUTES配置
// 此变量控制：
// 1. 定时任务的执行频率（每隔多少分钟执行一次）
// 2. 数据爬取的时间范围（爬取最近多少分钟的数据）
// 注意：当TASK_INTERVAL_MINUTES大于60时，时间范围将自动调整为'day'（一天）
const TASK_INTERVAL_MINUTES = config.get('task.interval_minutes');

// 设置失败计数器和阈值
let consecutiveFailures = 0;
// 修改连续失败阈值，增大容忍度，多次连续失败后才报警
const MAX_FAILURES_BEFORE_ALARM = 5; // 连续失败5次后发送告警

// 记录上次发送告警的时间
let lastAlarmTime = null;
// 告警最小间隔时间（小时）
const MIN_ALARM_INTERVAL_HOURS = 6;

/**
 * 执行数据爬取和推送任务
 */
async function runTask() {
  console.log(`[${new Date().toLocaleString()}] 开始执行定时任务...`);
  
  try {
    // 使用可配置的时间范围参数，默认30分钟（与test脚本保持一致）
    // 可以通过config.json或环境变量QUERY_TIME_RANGE_MINUTES配置查询时间范围
    const timeRange = config.get('task.query_time_range_minutes') || TASK_INTERVAL_MINUTES;
    
    // 爬取反馈数据并直接推送
    console.log(`开始爬取兔小巢反馈数据并推送（时间范围: ${timeRange}分钟）...`);
    const crawlResult = await crawlAndStoreFeedback(timeRange);
    console.log(crawlResult.message);
    
    // 记录本次执行时间，用于日志
    console.log(`本次任务执行时间: ${new Date().toLocaleString()}，处理了最近${timeRange}分钟的数据，下次将在${TASK_INTERVAL_MINUTES}分钟后执行`);
    
    if (crawlResult.success) {
      console.log(`成功处理${crawlResult.feedbackCount || 0}条反馈数据`);
      // 任务成功，重置失败计数
      consecutiveFailures = 0;
    } else {
      console.log(`处理失败: ${crawlResult.message}`);
      
      // 增加失败计数
      consecutiveFailures++;
      console.log(`连续失败次数: ${consecutiveFailures}/${MAX_FAILURES_BEFORE_ALARM}`);
      
      // 如果连续失败次数达到阈值，且满足最小告警间隔，发送告警
      if (consecutiveFailures >= MAX_FAILURES_BEFORE_ALARM && shouldSendAlarm()) {
        // 任务彻底中断，进行告警
        await sendAlarmMessage("任务彻底中断", `数据处理连续失败${consecutiveFailures}次，最后错误: ${crawlResult.message || "未知错误"}`);
        lastAlarmTime = new Date(); // 更新最后告警时间
      }
    }
    
    console.log(`[${new Date().toLocaleString()}] 定时任务执行完成`);
  } catch (error) {
    console.error(`[${new Date().toLocaleString()}] 定时任务执行失败:`, error.message);
    
    // 增加失败计数
    consecutiveFailures++;
    console.log(`连续失败次数: ${consecutiveFailures}/${MAX_FAILURES_BEFORE_ALARM}`);
    
    // 如果连续失败次数达到阈值，且满足最小告警间隔，发送告警
    if (consecutiveFailures >= MAX_FAILURES_BEFORE_ALARM && shouldSendAlarm()) {
      // 任务彻底中断，进行告警
      await sendAlarmMessage("任务彻底中断", `定时任务连续失败${consecutiveFailures}次，最后错误: ${error.message}`);
      lastAlarmTime = new Date(); // 更新最后告警时间
    }
  }
}

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
 * 启动定时任务
 * 在当前时间的半小时后准确执行，之后每30分钟执行一次
 */
function startScheduledTask() {
  console.log(`启动定时任务，将在${TASK_INTERVAL_MINUTES}分钟后准确执行，之后每${TASK_INTERVAL_MINUTES}分钟执行一次...`);
  
  // 计算首次执行的时间（当前时间后的配置分钟数）
  const now = new Date();
  const firstRunTime = new Date(now.getTime() + TASK_INTERVAL_MINUTES * 60 * 1000);
  
  // 创建一个一次性的定时任务，在首次执行时间运行
  const firstTaskTimeout = setTimeout(() => {
    console.log(`[${new Date().toLocaleString()}] 执行首次定时任务...`);
    runTask().catch(err => {
      console.error('定时任务执行出错:', err.message);
      // 首次任务执行失败不立即告警，而是记录失败次数
      consecutiveFailures++;
      console.log(`连续失败次数: ${consecutiveFailures}/${MAX_FAILURES_BEFORE_ALARM}`);
    });
    
    // 首次执行后，设置定时任务，使用配置的时间间隔
    const cronExpression = `*/${TASK_INTERVAL_MINUTES} * * * *`;
    console.log(`设置定时任务表达式: ${cronExpression}`);
    
    cron.schedule(cronExpression, () => {
      runTask().catch(err => {
        console.error('定时任务执行出错:', err.message);
        // 增加失败计数
        consecutiveFailures++;
        console.log(`连续失败次数: ${consecutiveFailures}/${MAX_FAILURES_BEFORE_ALARM}`);
      });
    });
  }, firstRunTime - now);
  
  // 计算距离首次执行的时间
  const timeUntilFirstRun = firstRunTime - now;
  const minutesUntilFirstRun = Math.floor(timeUntilFirstRun / (1000 * 60));
  const secondsUntilFirstRun = Math.floor((timeUntilFirstRun % (1000 * 60)) / 1000);
  
  console.log(`首次任务将在${firstRunTime.toLocaleString()}执行（准确的${TASK_INTERVAL_MINUTES}分钟后，约${minutesUntilFirstRun}分钟${secondsUntilFirstRun}秒）`);
  console.log('当前时间:', now.toLocaleString());
  console.log(`当前配置的任务间隔: ${TASK_INTERVAL_MINUTES}分钟（可通过环境变量TASK_INTERVAL_MINUTES修改）`);
  
  // 设置进程退出时的处理
  process.on('SIGINT', async () => {
    console.log('收到中断信号，准备停止服务...');
    // 不再发送停止通知，只记录日志
    console.log("服务收到中断信号，已停止运行");
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    console.log('收到终止信号，准备停止服务...');
    // 不再发送停止通知，只记录日志
    console.log("服务收到终止信号，已停止运行");
    process.exit(0);
  });
  
  // 设置未捕获异常的处理，防止程序意外崩溃
  process.on('uncaughtException', async (error) => {
    console.error('未捕获的异常:', error);
    
    // 增加失败计数
    consecutiveFailures++;
    console.log(`连续失败次数: ${consecutiveFailures}/${MAX_FAILURES_BEFORE_ALARM}`);
    
    // 如果连续失败次数达到阈值，且满足最小告警间隔，发送告警
    if (consecutiveFailures >= MAX_FAILURES_BEFORE_ALARM && shouldSendAlarm()) {
      await sendAlarmMessage("任务彻底中断", `服务发生未捕获的异常，连续失败${consecutiveFailures}次，最后错误: ${error.message}`);
      lastAlarmTime = new Date(); // 更新最后告警时间
    }
    
    // 延迟退出，确保消息发送完成
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });
  
  // 不发送unhandledRejection的告警，只记录日志
  process.on('unhandledRejection', (reason, promise) => {
    console.error('未处理的Promise拒绝:', reason);
    
    // 增加失败计数
    consecutiveFailures++;
    console.log(`连续失败次数: ${consecutiveFailures}/${MAX_FAILURES_BEFORE_ALARM}`);
  });
}

// 如果直接运行此脚本，则立即执行一次任务并启动定时任务
if (require.main === module) {
  (async () => {
    try {
      // 立即执行一次任务
      console.log('立即执行一次任务...');
      await runTask();
      
      // 启动定时任务
      startScheduledTask();
    } catch (error) {
      console.error('脚本执行失败:', error.message);
      
      // 增加失败计数
      consecutiveFailures++;
      console.log(`连续失败次数: ${consecutiveFailures}/${MAX_FAILURES_BEFORE_ALARM}`);
      
      // 初始启动失败不立即告警，需要达到阈值
      if (consecutiveFailures >= MAX_FAILURES_BEFORE_ALARM && shouldSendAlarm()) {
        await sendAlarmMessage("任务彻底中断", `服务启动失败，连续失败${consecutiveFailures}次，最后错误: ${error.message}`);
        lastAlarmTime = new Date(); // 更新最后告警时间
      }
      process.exit(1);
    }
  })();
}

module.exports = {
  runTask,
  startScheduledTask
};
