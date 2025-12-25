/**
 * ifeedback反馈数据发送工具
 * 用于将反馈数据发送到ifeedback服务
 */
const axios = require('axios');
const fs = require('fs');
const path = require('path');

/**
 * ifeedback反馈数据发送类
 */
class FeedbackSender {
  /**
   * 构造函数
   * @param {string} appName - 应用英文名
   * @param {string} apiUrl - ifeedback API URL
   */
  constructor(appName = 'txc', apiUrl = 'http://ifeedback.woa.com/feedback_backend/post_data') {
    this.appName = appName;
    this.apiUrl = apiUrl;
    this.sentRecordsPath = path.join(__dirname, '../data/sent_feedback_records.json');
    this.sentFeedbackRecords = []; // 改为数组，存储 {id, timestamp} 对象
    this.loadSentRecords();
  }
  
  /**
   * 加载已发送的反馈记录
   * @private
   */
  loadSentRecords() {
    try {
      // 确保目录存在
      const dir = path.dirname(this.sentRecordsPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // 读取已发送记录
      if (fs.existsSync(this.sentRecordsPath)) {
        const data = fs.readFileSync(this.sentRecordsPath, 'utf8');
        const records = JSON.parse(data);
        
        // 兼容旧格式：如果是简单数组，转换为新格式
        if (Array.isArray(records) && records.length > 0) {
          if (typeof records[0] === 'string' || typeof records[0] === 'number') {
            // 旧格式：简单ID数组，转换为新格式
            this.sentFeedbackRecords = records.map(id => ({
              id: id,
              timestamp: Date.now() // 使用当前时间作为默认时间戳
            }));
          } else {
            // 新格式：{id, timestamp} 对象数组
            this.sentFeedbackRecords = records;
          }
        } else {
          this.sentFeedbackRecords = [];
        }
        
        console.log(`已加载${this.sentFeedbackRecords.length}条已发送反馈记录`);
      } else {
        // 如果文件不存在，创建空文件
        fs.writeFileSync(this.sentRecordsPath, JSON.stringify([]), 'utf8');
        console.log('创建新的已发送反馈记录文件');
        this.sentFeedbackRecords = [];
      }
    } catch (error) {
      console.error('加载已发送反馈记录失败:', error.message);
      // 出错时初始化为空数组
      this.sentFeedbackRecords = [];
    }
  }
  
  /**
   * 保存已发送的反馈记录
   * @param {Array} newFeedbackIds - 新发送的反馈ID列表
   * @private
   */
  saveSentRecords(newFeedbackIds) {
    try {
      const currentTime = Date.now();
      
      // 添加新发送的ID到记录数组
      newFeedbackIds.forEach(id => {
        this.sentFeedbackRecords.push({
          id: id,
          timestamp: currentTime
        });
      });
      
      // 按时间戳排序，确保最新的在后面
      this.sentFeedbackRecords.sort((a, b) => a.timestamp - b.timestamp);
      
      // 如果记录超过100条，只保留最新的100条
      if (this.sentFeedbackRecords.length > 100) {
        this.sentFeedbackRecords = this.sentFeedbackRecords.slice(-100);
      }
      
      fs.writeFileSync(this.sentRecordsPath, JSON.stringify(this.sentFeedbackRecords), 'utf8');
      console.log(`已更新已发送反馈记录，当前共${this.sentFeedbackRecords.length}条记录`);
    } catch (error) {
      console.error('保存已发送反馈记录失败:', error.message);
    }
  }



  /**
   * 发送反馈数据到ifeedback服务
   * @param {Array} feedbackData - 格式化后的反馈数据
   * @returns {Promise<Object>} - API响应
   */
  async sendToIfeedback(feedbackData) {
    if (!Array.isArray(feedbackData) || feedbackData.length === 0) {
      console.warn('没有需要发送的反馈数据');
      return { code: 400, msg: '没有需要发送的反馈数据' };
    }

    // 去重：过滤掉已经发送过的反馈
    const sentIds = new Set(this.sentFeedbackRecords.map(record => record.id));
    const newFeedbackData = feedbackData.filter(feedback => {
      return !sentIds.has(feedback.uin);
    });

    if (newFeedbackData.length === 0) {
      console.log('所有反馈数据都已发送过，跳过本次推送');
      return { code: 200, msg: '所有反馈数据都已发送过，跳过本次推送' };
    }

    console.log(`原始数据${feedbackData.length}条，去重后${newFeedbackData.length}条需要发送`);

    try {
      const payload = {
        app_name: this.appName,
        feedbacks: newFeedbackData
      };

      console.log(`准备发送${newFeedbackData.length}条反馈数据到ifeedback服务...`);
      const response = await axios.post(this.apiUrl, payload);
      console.log('发送成功:', response.data);
      
      // 保存已发送的反馈ID
      const newFeedbackIds = newFeedbackData.map(feedback => feedback.uin);
      this.saveSentRecords(newFeedbackIds);
      
      return response.data;
    } catch (error) {
      console.error('发送反馈数据到ifeedback服务失败:', error.message);
      throw error;
    }
  }


}

module.exports = FeedbackSender;
