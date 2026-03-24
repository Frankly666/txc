/**
 * 公共工具函数
 * 提供 sleep、ensureDir 等通用方法和路径常量
 */
const fs = require('fs');
const path = require('path');

// 数据目录和 Cookie 文件路径
const DATA_DIR = path.join(__dirname, '../data');
const COOKIE_PATH = path.join(DATA_DIR, 'txc_cookies.json');
const SENT_RECORDS_PATH = path.join(DATA_DIR, 'sent_feedback_records.json');

/**
 * 等待指定毫秒
 * @param {number} ms - 毫秒数
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 确保目录存在，不存在则递归创建
 * @param {string} dirPath - 目录路径
 */
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

module.exports = {
  DATA_DIR,
  COOKIE_PATH,
  SENT_RECORDS_PATH,
  sleep,
  ensureDir,
};
