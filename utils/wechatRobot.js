/**
 * 企业微信机器人工具
 * 用于发送告警和通知消息到企业微信群
 */
const axios = require('axios');
require('dotenv').config();

const WEBHOOK_URL = process.env.WEWORK_WEBHOOK_URL;

/**
 * 发送文本消息到企业微信
 * @param {string} content - 消息内容
 * @param {Array<string>} [mentionedList=[]] - 需要@的用户ID列表
 * @returns {Promise<Object>} - 响应结果
 */
async function sendTextMessage(content, mentionedList = []) {
  if (!WEBHOOK_URL) {
    console.log('提示: 未配置企业微信webhook，跳过消息发送');
    return { success: false, message: '未配置企业微信webhook' };
  }

  try {
    console.log(`准备发送企业微信消息: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`);
    
    const response = await axios.post(WEBHOOK_URL, {
      msgtype: 'text',
      text: {
        content,
        mentioned_list: mentionedList
      }
    });

    if (response.data && response.data.errcode === 0) {
      console.log('企业微信消息发送成功');
      return { success: true, message: '消息发送成功' };
    } else {
      console.log(`企业微信消息发送失败:`, response.data);
      return { success: false, message: `发送失败: ${JSON.stringify(response.data)}` };
    }
  } catch (error) {
    console.log(`企业微信消息发送异常: ${error.message}，继续执行其他操作`);
    return { success: false, message: `发送异常: ${error.message}` };
  }
}

/**
 * 发送告警消息到企业微信
 * @param {string} errorType - 错误类型
 * @param {string} errorMessage - 错误详情
 * @param {Array<string>} [mentionedList=[]] - 需要@的用户ID列表
 * @returns {Promise<Object>} - 响应结果
 */
async function sendAlarmMessage(errorType, errorMessage, mentionedList = []) {
  try {
    const now = new Date();
    const timeString = now.toLocaleString();
    
    const content = `【紧急告警】兔小巢任务彻底中断\n时间: ${timeString}\n类型: ${errorType}\n详情: ${errorMessage}\n经过多次自动重试后仍无法恢复，请相关同学尽快处理!`;
    
    return await sendTextMessage(content, mentionedList);
  } catch (error) {
    console.log(`发送告警消息异常: ${error.message}，继续执行其他操作`);
    return { success: false, message: `发送告警异常: ${error.message}` };
  }
}

/**
 * 发送服务状态消息到企业微信（已禁用 - 只记录日志但不发送消息）
 * @param {string} status - 服务状态 (例如: "启动", "停止", "恢复")
 * @param {string} [message=""] - 附加消息
 * @returns {Promise<Object>} - 响应结果
 */
async function sendStatusMessage(status, message = "") {
  try {
    const now = new Date();
    const timeString = now.toLocaleString();
    
    const content = `【状态通知】兔小巢任务${status}\n时间: ${timeString}\n${message ? `消息: ${message}\n` : ""}`;
    
    // 仅记录日志，不实际发送消息
    console.log(`[已禁用的状态通知] ${content}`);
    return { success: true, message: '状态消息已禁用，仅记录日志' };
  } catch (error) {
    console.log(`发送状态消息异常: ${error.message}，继续执行其他操作`);
    return { success: false, message: `发送状态异常: ${error.message}` };
  }
}

module.exports = {
  sendTextMessage,
  sendAlarmMessage,
  sendStatusMessage
}; 
