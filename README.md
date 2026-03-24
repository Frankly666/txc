# 兔小巢数据抓取推送服务

定时从 [兔小巢](https://txc.qq.com) 抓取用户反馈数据，格式转换后推送到内部 ifeedback 服务。通过 Docker + PM2 部署运行。

## 功能特性

- **Cookie 优先**：优先使用缓存 Cookie 直接发 HTTP 请求获取数据（毫秒级），仅在 Cookie 过期时才启动浏览器登录（Puppeteer），Cookie 缓存有效期 24 小时
- **定时调度**：基于 node-cron 的可配置定时任务，默认每 15 分钟执行一次
- **自动去重**：推送前与历史记录比对，避免重复提交（滚动保留最近 100 条）
- **失败重试**：HTTP 请求最多重试 3 次，递增延迟；Cookie 失效自动回退到浏览器登录
- **容器化部署**：Docker + PM2 进程守护，崩溃自动重启，内置健康检查

## 项目结构

```
├── scheduledtask.js             # 入口 — 定时调度器
├── healthcheck.js               # Docker 健康检查脚本
├── constants/
│   └── index.js                 # 集中配置（环境变量 + 默认值）
├── utils/
│   ├── shared.js                # 公共工具（sleep、ensureDir、路径常量）
│   ├── cookieService.js         # Cookie 管理（加载/验证/保存/浏览器登录）
│   ├── txcCrawler.js            # 兔小巢 API 爬取（请求头构建、重试逻辑）
│   ├── dataTransformer.js       # 数据格式转换（兔小巢 → ifeedback）
│   ├── tuxiaochaoLogin.js       # 编排层（串联 抓取→转换→推送 流程）
│   └── feedbackSender.js        # ifeedback 推送（去重 + HTTP POST）
├── data/                        # 运行时数据（Cookie 缓存、已发送记录）
├── logs/                        # PM2 日志
├── Dockerfile                   # 容器构建
├── docker-compose.yml           # 容器编排
├── build-and-push.sh            # 镜像构建 & 推送到仓库脚本
├── docker-build.sh              # 本地 Docker 构建脚本
└── package.json
```

## 快速开始

### 环境要求

- Node.js >= 18
- Docker & docker-compose（容器部署时）
- 或 Podman（内网环境替代 Docker）

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```bash
# 必填 — QQ 登录凭据
TEST_QQ_NUMBER=你的QQ号码
TEST_QQ_PASSWORD=你的QQ密码

# 可选 — 有默认值
TASK_INTERVAL_MINUTES=15         # 定时任务间隔（分钟），默认 15
QUERY_TIME_RANGE_MINUTES=30      # 每次查询最近 N 分钟数据，默认 30
HUNYUAN_API_KEY=                 # 混元 API 密钥（预留）
```

### 3. 本地运行

```bash
npm start
```

启动后会**立即执行一次**抓取任务，然后按配置的间隔周期执行。

## Docker 部署

### 方式一：docker-compose（推荐）

```bash
# 构建并启动
docker-compose up -d --build

# 查看日志
docker-compose logs -f

# 停止
docker-compose down
```

### 方式二：docker-build.sh 脚本

```bash
# 构建镜像
./docker-build.sh

# 运行容器
docker run -d --name txc-feedback \
  --env-file .env \
  -v $(pwd)/logs:/app/logs \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/screenshot:/app/screenshot \
  --cap-add SYS_ADMIN \
  --restart unless-stopped \
  txc-feedback-crawler:latest
```

### 方式三：构建并推送到镜像仓库

适用于在开发机构建、服务器拉取部署的场景：

```bash
# 构建 + 推送（需提供版本标签）
./build-and-push.sh v2.0.0-amd64

# 服务器端拉取运行
podman pull csighub.tencentyun.com/franklynxu/txc_get_data:v2.0.0-amd64
podman run -d --name txc-feedback \
  --env-file .env \
  -v ${HOME}/logs:/app/logs \
  -v ${HOME}/data:/app/data \
  -v ${HOME}/screenshot:/app/screenshot \
  --cap-add SYS_ADMIN \
  --restart unless-stopped \
  csighub.tencentyun.com/franklynxu/txc_get_data:v2.0.0-amd64
```

> 镜像仓库地址在 `build-and-push.sh` 的 `IMAGE_REPO` 变量中配置。

### 容器运行说明

| 项目 | 说明 |
|------|------|
| 入口命令 | `pm2-runtime scheduledtask.js --name tuxiaochao-scheduler` |
| 进程守护 | PM2 自动重启崩溃进程 |
| 健康检查 | 每 5 分钟执行 `healthcheck.js`，连续 3 次失败标记为 unhealthy |
| 数据持久化 | 挂载 `logs/`、`data/`、`screenshot/` 到宿主机 |
| `--cap-add SYS_ADMIN` | Chromium 无沙箱模式运行所需权限 |

### 运维命令

```bash
# 查看容器健康状态
docker inspect --format='{{.State.Health.Status}}' qqvip-testing

# 手动触发健康检查
docker exec qqvip-testing node /app/healthcheck.js

# 查看 PM2 进程状态
docker exec qqvip-testing pm2 status

# 查看实时日志
docker exec qqvip-testing pm2 logs
```

## 数据流

```
定时触发 (scheduledtask.js)
    │
    ▼
┌─ 获取 Cookie (cookieService.js) ─────────────────────────┐
│  有缓存且未过期？─── 是 ──→ 直接使用                       │
│       │ 否                                                │
│       └──→ Puppeteer 启动浏览器 → QQ 登录 → 保存 Cookie   │
└───────────────────────────────────────────────────────────┘
    │
    ▼
┌─ 调用兔小巢 API (txcCrawler.js) ─────────────────────────┐
│  GET /api/v2/330701/dashboard/posts/list                  │
│  最多重试 3 次 · 401/403 触发重新登录                      │
└───────────────────────────────────────────────────────────┘
    │
    ▼
┌─ 数据转换 (dataTransformer.js) ──────────────────────────┐
│  兔小巢格式 → ifeedback 格式                              │
│  提取：QQ号、内容、图片、客户端信息等                       │
└───────────────────────────────────────────────────────────┘
    │
    ▼
┌─ 推送到 ifeedback (feedbackSender.js) ───────────────────┐
│  去重（对比已发送记录）→ POST ifeedback API → 更新记录     │
└───────────────────────────────────────────────────────────┘
```

## 环境变量说明

| 变量 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `TEST_QQ_NUMBER` | 是 | — | QQ 登录账号 |
| `TEST_QQ_PASSWORD` | 是 | — | QQ 登录密码 |
| `TASK_INTERVAL_MINUTES` | 否 | `15` | 定时任务间隔（分钟） |
| `QUERY_TIME_RANGE_MINUTES` | 否 | `30` | 每次查询的时间窗口（分钟） |
| `HUNYUAN_API_KEY` | 否 | `''` | 混元 API 密钥（预留） |

## npm 脚本

```bash
npm start          # 启动定时任务（= node scheduledtask.js）
npm run start:prod # PM2 生产模式启动
npm run lint       # ESLint 检查并修复
```
