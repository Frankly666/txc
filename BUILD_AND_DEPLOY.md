# Docker 镜像构建与发布流程

## 📋 环境说明

- **本地开发**: macOS / Linux / Windows
- **生产服务器**: Linux (AMD64)
- **容器工具**: Podman / Docker（命令可互换）
- **注意**: ARM 架构（Mac M1/M2）必须指定 `--platform linux/amd64`

---

## 🚀 完整流程（6步）

### 1. 修改代码
```bash
vim <your-files>
```

### 2. 确定版本号

| 修改类型 | 版本变化 | 示例 |
|---------|---------|------|
| 重大变更 | 主版本+1 | v1.4.0 → v2.0.0 |
| 新功能 | 次版本+1 | v1.3.0 → v1.4.0 |
| Bug修复 | 修订号+1 | v1.4.0 → v1.4.1 |

**标签格式**: `vX.Y.Z-描述-amd64`
- `v1.4.0-add-feature-amd64` ✅
- `v1.4.1-fix-bug-amd64` ✅

### 3. 构建镜像
```bash
# 设置变量
export IMAGE_REPO="registry.example.com/project/image"
export VERSION_TAG="v1.4.0-add-feature-amd64"

# 构建 AMD64 镜像
podman build \
  --platform linux/amd64 \
  -t ${IMAGE_REPO}:${VERSION_TAG} \
  -t ${IMAGE_REPO}:latest \
  -f Dockerfile .
```

### 4. 推送镜像
```bash
podman push ${IMAGE_REPO}:${VERSION_TAG}
```

### 5. 生产部署
```bash
# 创建目录
mkdir -p ${HOME}/logs ${HOME}/data ${HOME}/screenshot

# 拉取镜像
podman pull ${IMAGE_REPO}:${VERSION_TAG}

# 运行容器
podman run -d --name <container-name> \
  --env-file .env \
  -v ${HOME}/logs:/app/logs \
  -v ${HOME}/data:/app/data \
  -v ${HOME}/screenshot:/app/screenshot \
  --cap-add SYS_ADMIN \
  --restart unless-stopped \
  ${IMAGE_REPO}:${VERSION_TAG}
```

### 6. 验证
```bash
# 查看状态
podman ps

# 查看日志
podman logs -f <container-name>
```

---

## ⚡ 一键脚本

创建 `build-and-push.sh`:
```bash
#!/bin/bash
set -e

# 修改这里
IMAGE_REPO="registry.example.com/project/image"

if [ -z "$1" ]; then
    echo "用法: $0 <version-tag>"
    exit 1
fi

VERSION_TAG=$1

echo "🚀 构建镜像..."
podman build --platform linux/amd64 \
  -t ${IMAGE_REPO}:${VERSION_TAG} \
  -f Dockerfile .

echo "📤 推送镜像..."
podman push ${IMAGE_REPO}:${VERSION_TAG}

echo "✅ 完成! 部署命令:"
echo "podman pull ${IMAGE_REPO}:${VERSION_TAG}"
```

**使用**:
```bash
chmod +x build-and-push.sh
./build-and-push.sh v1.4.0-add-feature-amd64
```

---

## 🔧 常见问题

### 平台不匹配
```bash
# 错误: WARNING: image platform (linux/arm64)...
# 解决: 构建时加 --platform linux/amd64
```

### 目录不存在
```bash
# 错误: no such file or directory
# 解决: mkdir -p ${HOME}/logs ${HOME}/data ${HOME}/screenshot
```

### 推送失败
```bash
# 先登录
podman login <registry-url>

# 重试
podman push <image>:<tag>
```

---

## 📝 常用命令

```bash
# 查看镜像
podman images

# 查看容器
podman ps -a

# 停止容器
podman stop <container>

# 删除容器
podman rm <container>

# 删除镜像
podman rmi <image>

# 查看日志
podman logs -f <container>

# 进入容器
podman exec -it <container> sh
```

---

**更新日期**: 2025-12-05
