# 兔小巢反馈数据爬取项目 - Docker部署指南

## 📋 项目概述

本项目是一个自动化的兔小巢反馈数据爬取和推送系统，支持：
- 自动登录兔小巢平台
- 定时爬取反馈数据
- 推送数据到ifeedback服务
- 企业微信告警通知
- Cookie优先策略，提高效率

## 🚀 快速开始

### 1. 环境准备

确保您的系统已安装：
- Docker (版本 20.10+)
- Docker Compose (版本 2.0+) [可选]

### 2. 配置文件准备

**推荐方式：使用一键部署脚本**

```bash
# 初始化配置文件
./deploy.sh init

# 编辑配置文件
vim config.json  # 或使用其他编辑器
```

**配置文件示例（config.json）：**

```json
{
  "version": "1.0.0",
  "account": {
    "qq_number": "你的QQ号码",
    "qq_password": "你的QQ密码"
  },
  "task": {
    "interval_minutes": 15,
    "query_time_range_minutes": 30
  },
  "notification": {
    "wework_webhook_url": "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=你的key"
  },
  "api": {
    "hunyuan_api_key": "你的混元API密钥(可选)"
  }
}
```

### 3. 一键部署（推荐）

```bash
# 查看帮助
./deploy.sh help

# 初始化配置（首次使用）
./deploy.sh init

# 启动服务
./deploy.sh start

# 查看状态
./deploy.sh status

# 查看日志
./deploy.sh logs
```

### 4. 传统部署方式

#### 方法一：使用环境变量（兼容旧版本）

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑环境变量文件
vim .env

# 使用docker-compose启动
docker-compose up -d
```

#### 方法二：直接使用Docker运行

```bash
# 构建镜像
docker build -t txc-feedback-crawler:latest .

# 运行容器（使用config.json）
docker run -d --name txc-feedback \
  -v $(pwd)/config.json:/app/config.json:ro \
  -v $(pwd)/logs:/app/logs \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/screenshot:/app/screenshot \
  --cap-add SYS_ADMIN \
  --restart unless-stopped \
  txc-feedback-crawler:latest
```

## 📁 目录结构说明

```
.
├── Dockerfile              # Docker镜像构建文件
├── docker-compose.yml      # Docker Compose配置
├── deploy.sh               # 一键部署脚本（推荐）
├── config.template.json    # 配置文件模板
├── config.json             # 配置文件（需手动创建）
├── config_loader.js        # 配置加载器
├── .env.example            # 环境变量模板（兼容）
├── monitor.js              # 监控服务主程序
├── scheduledTask.js        # 定时任务程序
├── test_optimized.js       # 测试脚本
├── utils/                  # 工具模块
│   ├── tuxiaochaoLogin.js  # 兔小巢登录和数据获取
│   ├── feedbackSender.js   # 数据推送服务
│   └── wechatRobot.js      # 企业微信通知
├── data/                   # 数据存储目录
│   ├── txc_cookies.json    # Cookie缓存
│   └── sent_feedback_records.json # 已发送记录
├── logs/                   # 日志目录
└── screenshot/             # 截图目录
```

## 🔧 管理命令

### 使用一键脚本（推荐）

```bash
./deploy.sh init       # 初始化配置文件
./deploy.sh start      # 启动服务
./deploy.sh stop       # 停止服务
./deploy.sh restart    # 重启服务
./deploy.sh logs       # 查看实时日志
./deploy.sh status     # 查看服务状态
./deploy.sh enter      # 进入容器调试
./deploy.sh test       # 运行测试脚本
./deploy.sh clean      # 清理容器和镜像
```

### 使用Docker命令

```bash
# 查看容器状态
docker ps | grep txc-feedback

# 查看日志
docker logs -f txc-feedback

# 重启容器
docker restart txc-feedback

# 停止容器
docker stop txc-feedback

# 进入容器
docker exec -it txc-feedback sh

# 手动运行测试
docker exec txc-feedback node test_optimized.js
```

### 使用Docker Compose

```bash
docker-compose ps       # 查看状态
docker-compose logs -f  # 查看日志
docker-compose restart  # 重启服务
docker-compose down     # 停止服务
```

## 📊 监控和日志

### 日志文件位置
- 容器内日志：`/app/logs/`
- 宿主机日志：`./logs/`
- PM2日志：`monitor-output.log`, `monitor-error.log`

### 关键日志内容
- 配置加载状态
- 登录状态和Cookie有效性
- 数据获取数量和推送结果
- 错误信息和重试次数
- 告警发送记录

### 查看配置
容器启动时会自动打印配置信息（敏感信息已隐藏），可通过日志查看。

## 🛠️ 故障排除

### 常见问题

#### 1. 配置文件不存在
```bash
# 检查配置文件
ls -la config.json

# 如果不存在，初始化配置
./deploy.sh init
```

#### 2. 容器启动失败
```bash
# 检查日志
./deploy.sh logs

# 或使用docker命令
docker logs txc-feedback
```

#### 3. 配置验证失败
确保 `config.json` 中的必填项已正确填写：
- `account.qq_number`
- `account.qq_password`

#### 4. Cookie失效频繁
- 检查QQ账号是否正常
- 确认账号没有异常登录限制
- 查看登录日志确认问题

#### 5. 数据推送失败
- 检查网络连接
- 确认ifeedback服务可用性
- 查看推送日志详细错误信息

#### 6. 企业微信告警不工作
- 验证`notification.wework_webhook_url`是否正确
- 检查企业微信机器人配置
- 测试webhook URL可访问性

### 调试模式

```bash
# 查看详细日志
./deploy.sh logs

# 进入容器调试
./deploy.sh enter

# 运行单次测试
./deploy.sh test
```

## 🔄 更新部署

### 使用一键脚本

```bash
# 拉取最新代码
git pull

# 重启服务（会自动重新构建）
./deploy.sh restart
```

### 手动更新

```bash
# 停止当前服务
./deploy.sh stop

# 拉取最新代码
git pull

# 重新启动（会重新构建）
./deploy.sh start
```

## 📈 配置说明

### 配置优先级

配置加载器支持多种配置方式，优先级如下：
1. **环境变量**（最高优先级）
2. **config.json 配置文件**
3. **默认值**（最低优先级）

### 配置文件字段

| 字段 | 说明 | 必填 | 默认值 |
|------|------|------|--------|
| `account.qq_number` | QQ号码 | 是 | - |
| `account.qq_password` | QQ密码 | 是 | - |
| `task.interval_minutes` | 任务执行间隔（分钟） | 否 | 15 |
| `task.query_time_range_minutes` | 数据查询时间范围（分钟） | 否 | 30 |
| `notification.wework_webhook_url` | 企业微信Webhook地址 | 否 | - |
| `api.hunyuan_api_key` | 混元API密钥 | 否 | - |

### 环境变量映射

如果使用环境变量，对应关系如下：

| 环境变量 | 配置文件字段 |
|----------|-------------|
| `TEST_QQ_NUMBER` | `account.qq_number` |
| `TEST_QQ_PASSWORD` | `account.qq_password` |
| `TASK_INTERVAL_MINUTES` | `task.interval_minutes` |
| `QUERY_TIME_RANGE_MINUTES` | `task.query_time_range_minutes` |
| `WEWORK_WEBHOOK_URL` | `notification.wework_webhook_url` |
| `HUNYUAN_API_KEY` | `api.hunyuan_api_key` |

## 📈 性能优化建议

1. **Cookie策略**：项目优先使用Cookie，避免频繁启动浏览器
2. **配置文件**：使用配置文件而非环境变量，更易于管理
3. **资源限制**：可在docker-compose.yml中添加资源限制
4. **日志轮转**：定期清理日志文件避免磁盘空间不足
5. **监控告警**：配置适当的告警阈值避免误报

## 🔒 安全注意事项

1. **配置文件安全**：
   - 确保 `config.json` 不被提交到版本控制（已在 .gitignore 中）
   - 设置适当的文件权限：`chmod 600 config.json`
   
2. **环境变量**：确保 `.env` 文件不被提交到版本控制

3. **账号安全**：使用专用测试账号，避免使用个人账号

4. **网络安全**：在生产环境中配置适当的网络策略

5. **权限控制**：容器以非root用户运行（如需要可配置）

## 💡 最佳实践

### 首次部署流程

```bash
# 1. 克隆项目
git clone <repository-url>
cd txc

# 2. 初始化配置
./deploy.sh init

# 3. 编辑配置文件
vim config.json

# 4. 启动服务
./deploy.sh start

# 5. 查看状态
./deploy.sh status

# 6. 查看日志确认正常运行
./deploy.sh logs
```

### 日常维护

```bash
# 查看服务状态
./deploy.sh status

# 查看最近的日志
./deploy.sh logs | tail -100

# 定期清理旧日志
find ./logs -name "*.log" -mtime +30 -delete
```

### 故障恢复

```bash
# 1. 停止服务
./deploy.sh stop

# 2. 检查配置
cat config.json

# 3. 清理容器
./deploy.sh clean

# 4. 重新启动
./deploy.sh start

# 5. 监控日志
./deploy.sh logs
```

## 📞 技术支持

如遇到问题，请：
1. 查看本文档的故障排除部分
2. 检查容器日志获取详细错误信息
3. 确认环境变量配置正确
4. 联系项目维护人员