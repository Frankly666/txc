# 兔小巢反馈数据爬取工具

快速部署指南 - 3分钟上手

---

## 🚀 快速开始

### 方式一：本地构建部署（开发测试）

适合：本地开发、测试环境

```bash
# 1. 克隆代码
git clone https://github.com/Frankly666/txc.git
cd txc

# 2. 初始化配置
./deploy.sh init

# 3. 编辑配置文件
vim config.json  # 填入账号密码等信息

# 4. 启动服务（会自动构建镜像）
./deploy.sh start

# 5. 查看日志
./deploy.sh logs
```

### 方式二：拉取镜像部署（生产推荐）

适合：生产环境、快速部署

```bash
# 1. 登录镜像仓库（首次需要）
podman login csighub.tencentyun.com
# 输入用户名和密码

# 2. 拉取最新镜像
podman pull csighub.tencentyun.com/franklynxu/txc_get_data:latest

# 3. 查看已下载的镜像
podman images | grep txc_get_data

# 4. 准备配置文件（从代码仓库获取模板）
wget https://raw.githubusercontent.com/Frankly666/txc/feature/add-client-info-fields/config.template.json
cp config.template.json config.json
vim config.json  # 填入你的配置

# 5. 创建数据目录
mkdir -p logs data screenshot

# 6. 启动容器
podman run -d --name txc-feedback \
  -v $(pwd)/config.json:/app/config.json:ro \
  -v $(pwd)/logs:/app/logs \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/screenshot:/app/screenshot \
  --cap-add SYS_ADMIN \
  --restart unless-stopped \
  csighub.tencentyun.com/franklynxu/txc_get_data:latest

# 7. 查看运行状态
podman ps | grep txc-feedback
podman logs -f txc-feedback
```

### 方式三：指定版本部署（稳定版本）

```bash
# 1. 查看可用版本
# 访问镜像仓库或查看 CHANGELOG.md

# 2. 拉取指定版本
podman pull csighub.tencentyun.com/franklynxu/txc_get_data:v2.0.0-config-deployment-amd64

# 3. 启动容器（替换镜像tag）
podman run -d --name txc-feedback-v2 \
  -v $(pwd)/config.json:/app/config.json:ro \
  -v $(pwd)/logs:/app/logs \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/screenshot:/app/screenshot \
  --cap-add SYS_ADMIN \
  --restart unless-stopped \
  csighub.tencentyun.com/franklynxu/txc_get_data:v2.0.0-config-deployment-amd64
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

## 🛠️ 常用命令

### 镜像管理

```bash
# 查看本地镜像
podman images | grep txc_get_data

# 拉取最新版本
podman pull csighub.tencentyun.com/franklynxu/txc_get_data:latest

# 拉取指定版本
podman pull csighub.tencentyun.com/franklynxu/txc_get_data:v2.0.0-config-deployment-amd64

# 删除旧镜像
podman rmi <IMAGE_ID>
```

### 容器管理（生产环境）

```bash
# 查看运行中的容器
podman ps

# 查看所有容器（包括停止的）
podman ps -a

# 查看实时日志
podman logs -f txc-feedback

# 停止容器
podman stop txc-feedback

# 启动容器
podman start txc-feedback

# 重启容器
podman restart txc-feedback

# 删除容器
podman rm txc-feedback

# 进入容器调试
podman exec -it txc-feedback sh
```

### deploy.sh 脚本（本地开发）

```bash
./deploy.sh init     # 初始化配置文件
./deploy.sh start    # 构建并启动服务
./deploy.sh stop     # 停止服务
./deploy.sh restart  # 重启服务
./deploy.sh logs     # 查看日志
./deploy.sh status   # 查看状态
./deploy.sh enter    # 进入容器
./deploy.sh clean    # 清理容器和镜像
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

**Q: 如何登录镜像仓库？**
```bash
podman login csighub.tencentyun.com
# 输入你的用户名和密码（Token）
```

**Q: 如何查看可用的镜像版本？**
```bash
# 方式1：查看本地已下载的镜像
podman images | grep txc_get_data

# 方式2：查看 CHANGELOG.md 文件中的版本历史
cat CHANGELOG.md
```

**Q: 启动失败？**
```bash
# 1. 检查配置文件是否存在
ls -la config.json

# 2. 检查配置文件内容
cat config.json

# 3. 查看容器日志
podman logs -f txc-feedback

# 4. 检查容器状态
podman ps -a | grep txc-feedback
```

**Q: 如何升级到新版本？**
```bash
# 本地部署方式
./deploy.sh stop
git pull
./deploy.sh start

# 生产部署方式
podman stop txc-feedback
podman rm txc-feedback
podman pull csighub.tencentyun.com/franklynxu/txc_get_data:latest
podman images  # 确认新镜像已下载
# 然后重新运行启动命令（参考上面"方式二"的第6步）
```

**Q: 如何在不影响旧版本的情况下测试新版本？**
```bash
# 使用不同的容器名和数据目录
mkdir -p logs_v2 data_v2 screenshot_v2

podman run -d --name txc-feedback-v2 \
  -v $(pwd)/config.json:/app/config.json:ro \
  -v $(pwd)/logs_v2:/app/logs \
  -v $(pwd)/data_v2:/app/data \
  -v $(pwd)/screenshot_v2:/app/screenshot \
  --cap-add SYS_ADMIN \
  --restart unless-stopped \
  csighub.tencentyun.com/franklynxu/txc_get_data:latest

# 这样新旧版本可以同时运行，互不影响
```

**Q: 平台架构不匹配（ARM vs AMD64）？**  
所有镜像已构建为 AMD64 架构，适用于生产环境的 Linux 服务器

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
