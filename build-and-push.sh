#!/bin/bash

# Docker 镜像构建和推送脚本
# 用法: ./build-and-push.sh <version-tag>

set -e

# ============ 配置区域 - 根据实际情况修改 ============
IMAGE_REPO="csighub.tencentyun.com/franklynxu/txc_get_data"  # 镜像仓库地址
# ====================================================

# 检查参数
if [ -z "$1" ]; then
    echo "❌ 错误: 请提供版本标签"
    echo "用法: $0 <version-tag>"
    echo "示例: $0 v1.4.0-add-feature-amd64"
    exit 1
fi

VERSION_TAG=$1
FULL_IMAGE="${IMAGE_REPO}:${VERSION_TAG}"

echo "🚀 开始构建 Docker 镜像..."
echo "📦 镜像名称: ${FULL_IMAGE}"
echo ""

# 构建镜像
echo "📦 构建镜像 (AMD64 架构)..."
podman build \
  --platform linux/amd64 \
  -t "${FULL_IMAGE}" \
  -t "${IMAGE_REPO}:latest" \
  -f Dockerfile .

echo ""
echo "✅ 镜像构建完成！"
echo ""

# 推送镜像
echo "🚀 推送镜像到仓库..."
podman push "${FULL_IMAGE}"

echo ""
echo "✅ 推送完成！"
echo ""
echo "📋 部署命令:"
echo "podman pull ${FULL_IMAGE}"
echo "podman run -d --name <container-name> \\"
echo "  --env-file .env \\"
echo "  -v \${HOME}/logs:/app/logs \\"
echo "  -v \${HOME}/data:/app/data \\"
echo "  -v \${HOME}/screenshot:/app/screenshot \\"
echo "  --cap-add SYS_ADMIN \\"
echo "  --restart unless-stopped \\"
echo "  ${FULL_IMAGE}"
