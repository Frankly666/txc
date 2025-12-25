/**
 * 配置加载器
 * 优先级：环境变量 > config.json > 默认值
 */
const fs = require('fs');
const path = require('path');

class ConfigLoader {
  constructor() {
    this.config = this.loadConfig();
  }

  /**
   * 加载配置文件
   */
  loadConfig() {
    const configPath = path.join(__dirname, 'config.json');
    let fileConfig = {};

    // 尝试读取config.json
    try {
      if (fs.existsSync(configPath)) {
        const configContent = fs.readFileSync(configPath, 'utf8');
        fileConfig = JSON.parse(configContent);
        console.log(`[配置加载] 成功加载配置文件: ${configPath}`);
      } else {
        console.warn(`[配置加载] 配置文件不存在: ${configPath}，将使用环境变量和默认值`);
      }
    } catch (error) {
      console.error(`[配置加载] 读取配置文件失败: ${error.message}，将使用环境变量和默认值`);
    }

    // 合并配置，环境变量优先级最高
    const config = {
      account: {
        qq_number: process.env.TEST_QQ_NUMBER || fileConfig.account?.qq_number || '',
        qq_password: process.env.TEST_QQ_PASSWORD || fileConfig.account?.qq_password || ''
      },
      task: {
        interval_minutes: parseInt(process.env.TASK_INTERVAL_MINUTES || fileConfig.task?.interval_minutes || 15),
        query_time_range_minutes: parseInt(process.env.QUERY_TIME_RANGE_MINUTES || fileConfig.task?.query_time_range_minutes || 30)
      },
      notification: {
        wework_webhook_url: process.env.WEWORK_WEBHOOK_URL || fileConfig.notification?.wework_webhook_url || ''
      },
      api: {
        hunyuan_api_key: process.env.HUNYUAN_API_KEY || fileConfig.api?.hunyuan_api_key || ''
      }
    };

    // 验证必填配置
    this.validateConfig(config);

    return config;
  }

  /**
   * 验证配置
   */
  validateConfig(config) {
    const errors = [];

    if (!config.account.qq_number) {
      errors.push('QQ号码未配置');
    }

    if (!config.account.qq_password) {
      errors.push('QQ密码未配置');
    }

    if (errors.length > 0) {
      console.error('[配置验证失败] 以下配置项缺失:');
      errors.forEach(err => console.error(`  - ${err}`));
      throw new Error('配置验证失败，请检查 config.json 或环境变量');
    }

    console.log('[配置验证] 配置验证通过');
  }

  /**
   * 获取配置
   */
  get(path) {
    const keys = path.split('.');
    let value = this.config;
    
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return undefined;
      }
    }
    
    return value;
  }

  /**
   * 获取所有配置
   */
  getAll() {
    return this.config;
  }

  /**
   * 打印配置（隐藏敏感信息）
   */
  printConfig() {
    const safeConfig = JSON.parse(JSON.stringify(this.config));
    
    // 隐藏敏感信息
    if (safeConfig.account?.qq_password) {
      safeConfig.account.qq_password = '******';
    }
    if (safeConfig.api?.hunyuan_api_key) {
      safeConfig.api.hunyuan_api_key = safeConfig.api.hunyuan_api_key.substring(0, 8) + '******';
    }
    if (safeConfig.notification?.wework_webhook_url) {
      safeConfig.notification.wework_webhook_url = safeConfig.notification.wework_webhook_url.replace(/key=.*$/, 'key=******');
    }

    console.log('[当前配置]');
    console.log(JSON.stringify(safeConfig, null, 2));
  }
}

// 创建单例
let configInstance = null;

function getConfig() {
  if (!configInstance) {
    configInstance = new ConfigLoader();
  }
  return configInstance;
}

module.exports = {
  ConfigLoader,
  getConfig
};
