/**
 * 定时任务脚本
 * 定期爬取兔小巢反馈数据并推送到 ifeedback 服务
 * 依赖 PM2 的自动重启做容错
 */
require('dotenv').config();
const cron = require('node-cron');
const CONSTANTS = require('./constants/index');
const { crawlAndStoreFeedback } = require('./utils/tuxiaochaoLogin');

const TASK_INTERVAL_MINUTES = CONSTANTS.taskIntervalMinutes;
const QUERY_TIME_RANGE_MINUTES = CONSTANTS.queryTimeRangeMinutes;

/**
 * 执行数据爬取和推送任务
 */
async function runTask() {
  console.log(`[${new Date().toLocaleString()}] 开始执行定时任务...`);

  try {
    const timeRange = QUERY_TIME_RANGE_MINUTES;
    console.log(`开始爬取兔小巢反馈数据并推送（时间范围: ${timeRange}分钟）...`);

    const crawlResult = await crawlAndStoreFeedback(timeRange);
    console.log(crawlResult.message);

    console.log(`本次任务执行时间: ${new Date().toLocaleString()}，处理了最近${timeRange}分钟的数据，下次将在${TASK_INTERVAL_MINUTES}分钟后执行`);

    if (crawlResult.success) {
      console.log(`成功处理${crawlResult.feedbackCount || 0}条反馈数据`);
    } else {
      console.error(`处理失败: ${crawlResult.message}`);
    }

    console.log(`[${new Date().toLocaleString()}] 定时任务执行完成`);
  } catch (error) {
    console.error(`[${new Date().toLocaleString()}] 定时任务执行失败:`, error.message);
  }
}

/**
 * 启动定时任务
 * 首次延迟 TASK_INTERVAL_MINUTES 后执行，之后按 cron 周期执行
 */
function startScheduledTask() {
  console.log(`启动定时任务，将在${TASK_INTERVAL_MINUTES}分钟后准确执行，之后每${TASK_INTERVAL_MINUTES}分钟执行一次...`);

  const now = new Date();
  const firstRunTime = new Date(now.getTime() + TASK_INTERVAL_MINUTES * 60 * 1000);

  setTimeout(() => {
    console.log(`[${new Date().toLocaleString()}] 执行首次定时任务...`);
    runTask().catch((err) => console.error('定时任务执行出错:', err.message));

    const cronExpression = `*/${TASK_INTERVAL_MINUTES} * * * *`;
    console.log(`设置定时任务表达式: ${cronExpression}`);

    cron.schedule(cronExpression, () => {
      runTask().catch((err) => console.error('定时任务执行出错:', err.message));
    });
  }, firstRunTime - now);

  const minutesUntilFirstRun = Math.floor((firstRunTime - now) / (1000 * 60));
  const secondsUntilFirstRun = Math.floor(((firstRunTime - now) % (1000 * 60)) / 1000);

  console.log(`首次任务将在${firstRunTime.toLocaleString()}执行（约${minutesUntilFirstRun}分钟${secondsUntilFirstRun}秒）`);
  console.log('当前时间:', now.toLocaleString());
  console.log(`当前配置的任务间隔: ${TASK_INTERVAL_MINUTES}分钟（可通过环境变量TASK_INTERVAL_MINUTES修改）`);

  // 优雅退出
  process.on('SIGINT', () => {
    console.log('收到中断信号，服务已停止');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('收到终止信号，服务已停止');
    process.exit(0);
  });

  // 全局异常兜底（依赖 PM2 自动重启）
  process.on('uncaughtException', (error) => {
    console.error('未捕获的异常:', error);
    setTimeout(() => process.exit(1), 1000);
  });

  process.on('unhandledRejection', (reason) => {
    console.error('未处理的Promise拒绝:', reason);
  });
}

// 直接运行：立即执行一次 + 启动定时任务
if (require.main === module) {
  (async () => {
    try {
      console.log('立即执行一次任务...');
      await runTask();
      startScheduledTask();
    } catch (error) {
      console.error('脚本执行失败:', error.message);
      process.exit(1);
    }
  })();
}

module.exports = {
  runTask,
  startScheduledTask,
};
