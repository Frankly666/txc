# 兔小巢反馈数据爬取工具

快速部署指南 - 3分钟上手

---

## 🚀 快速开始

### 本地部署（推荐新手）

```bash
# 1. 初始化配置
./deploy.sh init

# 2. 编辑配置文件
vim config.json  # 填入账号密码等信息

# 3. 启动服务
./deploy.sh start

# 4. 查看状态
./deploy.sh logs
```

### 生产部署（使用镜像）

```bash
# 1. 拉取镜像
podman pull csighub.tencentyun.com/franklynxu/txc_get_data:latest

# 2. 准备配置文件
cp config.template.json config.json
vim config.json  # 填入配置

# 3. 启动容器
podman run -d --name txc-feedback \
  -v $(pwd)/config.json:/app/config.json:ro \
  -v $(pwd)/logs:/app/logs \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/screenshot:/app/screenshot \
  --cap-add SYS_ADMIN \
  --restart unless-stopped \
  csighub.tencentyun.com/franklynxu/txc_get_data:latest
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

### deploy.sh 脚本（本地开发）

```bash
./deploy.sh start    # 启动服务
./deploy.sh stop     # 停止服务
./deploy.sh restart  # 重启服务
./deploy.sh logs     # 查看日志
./deploy.sh status   # 查看状态
./deploy.sh clean    # 清理容器
```

### 容器管理（生产环境）

```bash
# 查看日志
podman logs -f txc-feedback

# 停止容器
podman stop txc-feedback

# 重启容器
podman restart txc-feedback

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

**Q: 启动失败？**
```bash
# 检查配置文件
cat config.json

# 查看详细错误
./deploy.sh logs
```

**Q: 如何更新版本？**
```bash
# 本地部署
./deploy.sh stop
git pull
./deploy.sh start

# 生产部署
podman stop txc-feedback
podman rm txc-feedback
podman pull csighub.tencentyun.com/franklynxu/txc_get_data:latest
# 然后重新运行启动命令
```

**Q: 平台架构不匹配？**  
构建脚本已自动处理，无需手动指定

---

## 📁 目录结构

```
.
├── config.json          # 配置文件（需手动创建）
├── deploy.sh            # 本地部署脚本
├── build-and-push.sh    # 镜像构建脚本
├── logs/                # 日志目录
├── data/                # 数据目录
└── screenshot/          # 截图目录
```

---

**版本**: 2.0.0  
**更新**: 2025-12-25
