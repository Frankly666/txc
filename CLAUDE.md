# 兔小巢数据抓取推送服务 (TXC Feedback Crawler)

## 项目概述

这是一个 Node.js 定时任务服务，核心功能是：**从腾讯兔小巢 (txc.qq.com) 抓取用户反馈数据，转换格式后推送到内部 ifeedback 服务**。通过 Docker + PM2 部署，PM2 负责进程守护和自动重启。

## 技术栈

- **运行时**: Node.js 18 (Alpine Docker 镜像)
- **浏览器自动化**: Puppeteer (仅在 Cookie 失效时用于 QQ 登录)
- **HTTP 请求**: Axios
- **定时调度**: node-cron
- **进程管理**: PM2 (pm2-runtime)
- **容器化**: Docker + docker-compose

## 目录结构

```
├── scheduledtask.js           # 入口文件 — 定时调度器
├── healthcheck.js             # Docker HEALTHCHECK 脚本
├── constants/
│   └── index.js               # 集中配置（环境变量 + 默认值）
├── utils/
│   ├── shared.js              # 公共工具：sleep、ensureDir、路径常量
│   ├── cookieService.js       # Cookie 生命周期：加载/验证/保存/浏览器登录
│   ├── txcCrawler.js          # HTTP 爬取：构建请求头、调用兔小巢 API、重试
│   ├── dataTransformer.js     # 数据转换：兔小巢原始格式 → ifeedback 格式
│   ├── tuxiaochaoLogin.js     # 编排层：协调上述模块完成"抓取→转换→推送"
│   └── feedbackSender.js      # ifeedback 推送：去重 + HTTP POST
├── data/                      # 运行时数据（Cookie 缓存、已发送记录）
├── logs/                      # PM2 日志输出
├── Dockerfile                 # 容器构建（Chromium + PM2 + 时区）
├── docker-compose.yml         # 容器编排
└── package.json               # 依赖与脚本
```

## 核心数据流

```
scheduledtask.js (cron 触发)
  │
  ▼
tuxiaochaoLogin.js — crawlAndStoreFeedback(timeRange)
  │
  ├─ 1. cookieService.js — 获取有效 Cookie
  │     ├─ 优先从 data/txc_cookies.json 加载缓存（24h 有效期）
  │     └─ 缓存失效时启动 Puppeteer 浏览器执行 QQ 登录
  │
  ├─ 2. txcCrawler.js — fetchFeedbackList(cookies, {timeRange})
  │     ├─ 构建请求头（buildHeaders）
  │     ├─ GET https://txc.qq.com/api/v2/330701/dashboard/posts/list
  │     └─ 最多重试 3 次，401/403 立即返回 null 触发重新登录
  │
  ├─ 3. dataTransformer.js — transformBatch(rawItems)
  │     └─ 逐条转换：提取 QQ号、时间、内容、图片、客户端信息
  │
  └─ 4. feedbackSender.js — sendToIfeedback(payloads)
        ├─ 基于 data/sent_feedback_records.json 去重（滚动保留最近 100 条）
        └─ POST http://ifeedback.woa.com/feedback_backend/post_data
```

## 各文件职责详解

### `scheduledtask.js` — 入口 & 定时调度

- 启动时**立即执行一次**任务，然后延迟 `TASK_INTERVAL_MINUTES` 分钟后执行第二次
- 之后按 cron 表达式 `*/{interval} * * * *` 周期执行
- 注册 SIGINT/SIGTERM 优雅退出；uncaughtException 退出后由 PM2 自动重启
- 导出 `runTask()` 和 `startScheduledTask()` 供测试调用

### `constants/index.js` — 配置中心

| 配置项 | 环境变量 | 默认值 | 说明 |
|--------|----------|--------|------|
| `testQQNumber` | `TEST_QQ_NUMBER` | *(必填)* | QQ 登录账号 |
| `testQQPassword` | `TEST_QQ_PASSWORD` | *(必填)* | QQ 登录密码 |
| `taskIntervalMinutes` | `TASK_INTERVAL_MINUTES` | `15` | 定时任务间隔（分钟） |
| `queryTimeRangeMinutes` | `QUERY_TIME_RANGE_MINUTES` | `30` | 每次查询最近 N 分钟的数据 |
| `hunyuanApiKey` | `HUNYUAN_API_KEY` | `''` | 混元 API 密钥（预留） |
| `tuxiaonengLoginUrl` | — | `https://txc.qq.com/login.html` | 兔小巢登录页 URL |

启动时自动校验 `TEST_QQ_NUMBER` 和 `TEST_QQ_PASSWORD`，缺失则打印错误日志。

### `utils/shared.js` — 公共工具

- `sleep(ms)` — Promise 化的延迟
- `ensureDir(dirPath)` — 确保目录存在（递归创建）
- `DATA_DIR` — `./data/` 的绝对路径
- `COOKIE_PATH` — `./data/txc_cookies.json`
- `SENT_RECORDS_PATH` — `./data/sent_feedback_records.json`

### `utils/cookieService.js` — Cookie 管理

- `loadCookies()` → `{cookies, timestamp, expiresAt} | null` — 从文件加载，过期返回 null
- `areCookiesValid(cookieData)` → `boolean` — 检查是否未过期
- `saveCookies(cookies)` — 写入文件，设置 24 小时过期时间戳
- `loginAndGetCookies()` — **Puppeteer 完整登录流程**：
  1. 启动无头 Chromium（大量 `--disable-*` 参数优化 Docker 环境）
  2. 访问 `txc.qq.com/login.html`
  3. 勾选用户协议复选框 (`.t-checkbox__former`)
  4. 点击 QQ 登录链接 (`.super_login_qq_link`)
  5. 切换到 `ptlogin2.qq.com` iframe
  6. 输入 QQ 号/密码，点击登录
  7. 等待跳转到 dashboard，提取并保存 Cookie
  8. `finally` 块中关闭浏览器
- `getValidCookies()` — 高层接口：有缓存用缓存，否则登录

### `utils/txcCrawler.js` — HTTP 爬取

- `buildHeaders(cookieString)` — 构建完整的浏览器模拟请求头
- `buildParams(timeRangeMinutes)` — 构建 API 查询参数（`from`/`to` 时间范围、分页等）
- `fetchFeedbackList(cookies, {timeRange, retries})` — 调用兔小巢 API：
  - 最多重试 `retries` 次（默认 3），递增延迟（2s/4s/6s）
  - 遇到 401/403 立即返回 `null`（Cookie 失效信号）
  - API 地址：`https://txc.qq.com/api/v2/330701/dashboard/posts/list`

### `utils/dataTransformer.js` — 数据格式转换

- `transformItem(raw)` — 单条转换，输入兔小巢 post 对象，输出 ifeedback 格式：
  ```js
  {
    time: "YYYY-MM-DD HH:MM:SS",   // created_at 转本地时间
    uin: post.id,                    // 反馈 ID（也用作去重键）
    QQ: "从 field_values 提取",      // QQ 号
    comment: post.content,           // 反馈内容
    nick_name: post.nick_name,       // 昵称
    picurllist: "url1|url2",         // 图片 URL，竖线分隔
    clientInfo, clientVersion, os, osVersion, netType, customInfo, user_agent  // 来自 extra
  }
  ```
- `transformBatch(items)` — 批量转换

### `utils/tuxiaochaoLogin.js` — 编排层

`crawlAndStoreFeedback(timeRange)` 是对外唯一接口：
1. 尝试加载缓存 Cookie → 调 API
2. 若 Cookie 方式失败 → 浏览器登录获取新 Cookie → 再调 API
3. 转换数据格式
4. 推送到 ifeedback
5. 返回 `{success, feedbackCount, method, message}`

### `utils/feedbackSender.js` — ifeedback 推送

- `FeedbackSender` 类，构造时加载 `sent_feedback_records.json`
- `sendToIfeedback(feedbackData)`:
  1. 用 `uin` 字段对比已发送记录，过滤掉重复数据
  2. POST 到 `http://ifeedback.woa.com/feedback_backend/post_data`
  3. payload: `{app_name: 'qqvip', feedbacks: [...]}`
  4. 成功后将新 ID 写入记录文件（滚动保留最近 100 条）

### `healthcheck.js` — Docker 健康检查

每 5 分钟由 Docker HEALTHCHECK 调用，检查：
1. 关键文件存在（`scheduledTask.js`、`tuxiaochaoLogin.js`）
2. PM2 进程 `tuxiaochao-scheduler` 状态为 online
3. 日志文件最后修改时间不超过 60 分钟
4. `data/` 目录可读写

退出码 0 = 健康，1 = 异常。

## 运行时数据文件

| 文件 | 作用 | 格式 |
|------|------|------|
| `data/txc_cookies.json` | Cookie 缓存 | `{cookies: [...], timestamp, expiresAt}` |
| `data/sent_feedback_records.json` | 已推送反馈 ID 记录（去重用） | `[{id, timestamp}, ...]`，最多 100 条 |

## 环境变量

```bash
# 必填
TEST_QQ_NUMBER=123456789        # QQ 登录账号
TEST_QQ_PASSWORD=your_password  # QQ 登录密码

# 可选（有默认值）
TASK_INTERVAL_MINUTES=15        # 定时任务间隔，默认 15 分钟
QUERY_TIME_RANGE_MINUTES=30     # 每次查询的时间窗口，默认 30 分钟
HUNYUAN_API_KEY=                # 混元 API 密钥（预留）

# Docker 环境自动设置
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
```

## 本地开发

```bash
# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 填入 TEST_QQ_NUMBER 和 TEST_QQ_PASSWORD

# 直接运行（立即执行一次 + 启动定时任务）
npm start
# 等效于: node scheduledtask.js
```

## Docker 部署

```bash
# 构建并启动
docker-compose up -d --build

# 查看日志
docker-compose logs -f

# 健康检查
docker exec qqvip-testing node /app/healthcheck.js

# 停止
docker-compose down
```

Docker 容器内部：
- 使用 `pm2-runtime scheduledtask.js --name tuxiaochao-scheduler` 运行
- PM2 负责进程崩溃后自动重启
- HEALTHCHECK 每 5 分钟检查一次，连续 3 次失败标记为 unhealthy

## 模块依赖关系

```
scheduledtask.js
  └─ constants/index.js
  └─ utils/tuxiaochaoLogin.js (编排层)
       ├─ utils/cookieService.js
       │    ├─ utils/shared.js (sleep, ensureDir, COOKIE_PATH, DATA_DIR)
       │    └─ constants/index.js (QQ 凭据, 登录 URL)
       ├─ utils/txcCrawler.js
       │    └─ utils/shared.js (sleep)
       ├─ utils/dataTransformer.js (无外部依赖)
       └─ utils/feedbackSender.js
            └─ utils/shared.js (ensureDir, SENT_RECORDS_PATH)
```

## 关键设计决策

1. **Cookie 优先策略**：每次任务优先用缓存 Cookie 发 HTTP 请求（毫秒级），仅在 Cookie 过期或 API 返回 401/403 时才启动 Puppeteer 浏览器登录（耗时 30-60 秒）。Cookie 缓存 24 小时。

2. **去重机制**：`feedbackSender.js` 维护已推送反馈 ID 的滚动窗口（最近 100 条），避免重复推送。去重键为兔小巢 post 的 `id` 字段（映射为 `uin`）。

3. **重试与容错**：HTTP 请求最多重试 3 次（递增延迟 2/4/6 秒）；Cookie 方式失败自动回退到浏览器登录；进程级异常由 PM2 自动重启兜底。

4. **兔小巢 API**：产品 ID 为 `330701`，硬编码在 `txcCrawler.js` 的 `TXC_API_BASE` 常量中。如需支持其他产品需修改此值。

5. **ifeedback API**：推送地址 `http://ifeedback.woa.com/feedback_backend/post_data`，硬编码在 `feedbackSender.js` 构造函数默认参数中，app_name 为 `'qqvip'`。

## 常见修改场景

| 需求 | 修改位置 |
|------|----------|
| 调整抓取频率 | 环境变量 `TASK_INTERVAL_MINUTES` |
| 调整查询时间窗口 | 环境变量 `QUERY_TIME_RANGE_MINUTES` |
| 更换兔小巢产品 ID | `utils/txcCrawler.js` → `TXC_API_BASE` |
| 更换 ifeedback 推送地址 | `utils/feedbackSender.js` → 构造函数 `apiUrl` 参数 |
| 修改数据转换逻辑 | `utils/dataTransformer.js` → `transformItem()` |
| 修改登录流程（页面结构变化） | `utils/cookieService.js` → `loginAndGetCookies()` |
| 添加新的数据源 | 参考 `txcCrawler.js` 模式新建 crawler，在编排层 `tuxiaochaoLogin.js` 集成 |
