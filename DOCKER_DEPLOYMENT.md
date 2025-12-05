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
- Docker Compose (版本 2.0+)

### 2. 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑环境变量文件
vim .env  # 或使用其他编辑器
```

**必须配置的环境变量：**

```bash
# 混元API密钥（用于AI处理）
HUNYUAN_API_KEY="your_hunyuan_api_key_here"

# 企业微信机器人webhook URL（用于告警通知）
WEWORK_WEBHOOK_URL="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=your_key_here"

# 测试账号信息
TEST_QQ_NUMBER=你的QQ号码
TEST_QQ_PASSWORD=你的QQ密码

# 定时任务配置
TASK_INTERVAL_MINUTES=15  # 定时任务执行间隔（分钟）
QUERY_TIME_RANGE_MINUTES=30  # 数据查询时间范围（分钟）
```

### 3. 构建和运行

#### 方法一：使用构建脚本（推荐）

```bash
# 运行构建脚本
./docker-build.sh

# 启动服务
docker-compose up -d
```

#### 方法二：手动构建

```bash
# 构建镜像
docker build -t txc-feedback-crawler:latest .

# 启动服务
docker-compose up -d
```

#### 方法三：直接使用Docker运行

```bash
docker run -d --name txc-feedback \
  --env-file .env \
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
├── docker-build.sh         # 构建脚本
├── .env.example            # 环境变量模板
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

### 查看服务状态
```bash
docker-compose ps
```

### 查看实时日志
```bash
# 查看所有日志
docker-compose logs -f

# 查看特定服务日志
docker logs -f qqvip-testing
```

### 重启服务
```bash
docker-compose restart
```

### 停止服务
```bash
docker-compose down
```

### 进入容器调试
```bash
docker-compose exec qqvip-testing sh
```

### 手动运行测试
```bash
# 进入容器
docker-compose exec qqvip-testing sh

# 运行测试脚本
node test_optimized.js
```

## 📊 监控和日志

### 日志文件位置
- 容器内日志：`/app/logs/`
- 宿主机日志：`./logs/`
- PM2日志：`monitor-output.log`, `monitor-error.log`

### 关键日志内容
- 登录状态和Cookie有效性
- 数据获取数量和推送结果
- 错误信息和重试次数
- 告警发送记录

## 🛠️ 故障排除

### 常见问题

#### 1. 容器启动失败
```bash
# 检查日志
docker-compose logs

# 检查环境变量配置
cat .env
```

#### 2. Cookie失效频繁
- 检查QQ账号是否正常
- 确认账号没有异常登录限制
- 查看登录日志确认问题

#### 3. 数据推送失败
- 检查网络连接
- 确认ifeedback服务可用性
- 查看推送日志详细错误信息

#### 4. 企业微信告警不工作
- 验证WEWORK_WEBHOOK_URL是否正确
- 检查企业微信机器人配置
- 测试webhook URL可访问性

### 调试模式

```bash
# 以调试模式运行（查看详细输出）
docker-compose up

# 运行单次测试
docker-compose exec qqvip-testing node test_optimized.js
```

## 🔄 更新部署

```bash
# 停止当前服务
docker-compose down

# 拉取最新代码
git pull

# 重新构建镜像
docker build -t txc-feedback-crawler:latest .

# 启动服务
docker-compose up -d
```

## 📈 性能优化建议

1. **Cookie策略**：项目优先使用Cookie，避免频繁启动浏览器
2. **资源限制**：可在docker-compose.yml中添加资源限制
3. **日志轮转**：定期清理日志文件避免磁盘空间不足
4. **监控告警**：配置适当的告警阈值避免误报

## 🔒 安全注意事项

1. **环境变量**：确保.env文件不被提交到版本控制
2. **账号安全**：使用专用测试账号，避免使用个人账号
3. **网络安全**：在生产环境中配置适当的网络策略
4. **权限控制**：容器以非root用户运行（如需要可配置）

## 📞 技术支持

如遇到问题，请：
1. 查看本文档的故障排除部分
2. 检查容器日志获取详细错误信息
3. 确认环境变量配置正确
4. 联系项目维护人员