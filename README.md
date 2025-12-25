# 兔小巢反馈数据爬取工具

**一个脚本搞定所有部署** - 3分钟上手

---

## 🚀 快速开始

### 方式一：生产部署（推荐）⭐

**完全独立，无需代码仓库，只需一个脚本**

```bash
# 1. 下载部署脚本
curl -O https://raw.githubusercontent.com/Frankly666/txc/feature/add-client-info-fields/deploy.sh
chmod +x deploy.sh

# 2. 拉取镜像
./deploy.sh pull

# 3. 提取配置模板（镜像自包含）
./deploy.sh pull-config

# 4. 编辑配置
vim config.json

# 5. 启动服务
./deploy.sh start-prod

# 6. 查看日志
./deploy.sh logs
```

### 方式二：本地开发

适合：代码开发、本地测试

```bash
# 1. 克隆代码
git clone https://github.com/Frankly666/txc.git
cd txc

# 2. 初始化配置
./deploy.sh init

# 3. 编辑配置
vim config.json

# 4. 启动服务（自动构建）
./deploy.sh start

# 5. 查看日志
./deploy.sh logs
```

---

## 📋 配置说明

编辑 `config.json`，必填项：

```json
{
  "account": "你的兔小巢账号",
  "password": "你的密码",
  "productId": "产品ID",
  "ifeedback": {
    "token": "推送token",
    "projectId": "项目ID"
  }
}
```

完整配置见 `config.template.json`

---

## 🛠️ 所有命令

### 一键脚本 `./deploy.sh`

```bash
# 配置管理
./deploy.sh init          # 初始化配置（从本地模板）
./deploy.sh pull-config   # 从镜像提取配置模板（独立部署必备）

# 镜像管理
./deploy.sh pull          # 拉取远程镜像
./deploy.sh build         # 构建本地镜像

# 服务启动
./deploy.sh start         # 启动服务（本地构建模式）
./deploy.sh start-prod    # 启动服务（生产镜像模式）

# 运维管理
./deploy.sh stop          # 停止服务
./deploy.sh restart       # 重启服务
./deploy.sh upgrade       # 一键升级（停止→拉取→启动）
./deploy.sh logs          # 查看实时日志
./deploy.sh status        # 查看服务状态
./deploy.sh enter         # 进入容器调试
./deploy.sh test          # 运行测试
./deploy.sh clean         # 清理容器和镜像
```

### 直接使用容器命令（可选）

```bash
# 查看容器
podman ps -a

# 查看日志
podman logs -f txc-feedback

# 停止/启动/重启
podman stop txc-feedback
podman start txc-feedback
podman restart txc-feedback

# 删除容器
podman rm txc-feedback

# 进入容器
podman exec -it txc-feedback sh
```

---

## 🔧 镜像构建（开发者）

修改代码后发布新版本：

```bash
# 构建并推送（会自动构建 AMD64 架构）
./build-and-push.sh v2.0.0-描述-amd64

# 示例
./build-and-push.sh v2.1.0-fix-login-amd64
```

**注意**: 
- Mac M1/M2 用户：脚本已自动指定 `--platform linux/amd64`
- 版本号格式：`vX.Y.Z-描述-amd64`

---

## ❓ 常见问题

**Q: 如何完全独立部署（不依赖代码仓库）？**
```bash
# 只需要 deploy.sh 一个文件
curl -O https://raw.githubusercontent.com/Frankly666/txc/feature/add-client-info-fields/deploy.sh
chmod +x deploy.sh
./deploy.sh pull
./deploy.sh pull-config
vim config.json
./deploy.sh start-prod
```

**Q: 如何升级到最新版本？**
```bash
# 使用 deploy.sh（推荐）
./deploy.sh upgrade

# 或手动操作
./deploy.sh stop
./deploy.sh pull
./deploy.sh start-prod
```

**Q: 启动失败如何排查？**
```bash
# 1. 检查配置文件
cat config.json

# 2. 查看容器日志
./deploy.sh logs

# 3. 检查容器状态
./deploy.sh status
```

**Q: 如何同时运行多个版本？**
```bash
# 修改容器名称和数据目录
mkdir -p logs_v2 data_v2 screenshot_v2

podman run -d --name txc-feedback-v2 \
  -v $(pwd)/config.json:/app/config.json:ro \
  -v $(pwd)/logs_v2:/app/logs \
  -v $(pwd)/data_v2:/app/data \
  -v $(pwd)/screenshot_v2:/app/screenshot \
  --cap-add SYS_ADMIN \
  --restart unless-stopped \
  csighub.tencentyun.com/franklynxu/txc_get_data:v2.0.0-config-deployment-amd64
```

**Q: 支持 Docker 还是 Podman？**  
两者都支持，脚本会自动检测并使用

---

## 📁 目录结构

```
.
├── config.json          # 配置文件（需手动创建，不提交到git）
├── config.template.json # 配置文件模板（参考）
├── deploy.sh            # 本地部署脚本
├── build-and-push.sh    # 镜像构建脚本（开发者用）
├── logs/                # 日志目录
├── data/                # 数据目录
└── screenshot/          # 截图目录
```

---

## 📦 可用镜像版本

| 版本 | 标签 | 说明 |
|------|------|------|
| 最新版 | `latest` | 始终指向最新稳定版 |
| v2.0.0 | `v2.0.0-config-deployment-amd64` | 配置文件部署版本 |
| v1.4.0 | `v1.4.0-add-client-info-amd64` | 客户端信息字段版本 |
| v1.3.1 | `v1.3.1` | 稳定版本 |

**镜像仓库地址**: `csighub.tencentyun.com/franklynxu/txc_get_data`

---

**版本**: 2.0.0  
**更新**: 2025-12-25  
**镜像仓库**: csighub.tencentyun.com/franklynxu/txc_get_data
