#!/bin/bash

# Docker构建和运行脚本
# 用于兔小巢反馈数据爬取项目

set -e

echo "🚀 开始构建兔小巢反馈数据爬取项目Docker镜像..."

# 检查.env文件是否存在
if [ ! -f ".env" ]; then
    echo "⚠️  .env文件不存在，请先复制.env.example为.env并配置相关参数"
    echo "   cp .env.example .env"
    echo "   然后编辑.env文件配置必要的环境变量"
    exit 1
fi

# 构建Docker镜像
echo "📦 构建Docker镜像..."
docker build -t txc-feedback-crawler:latest .

echo "✅ Docker镜像构建完成！"
echo ""
echo "🔧 可用的运行命令："
echo "1. 使用docker-compose运行（推荐）："
echo "   docker-compose up -d"
echo ""
echo "2. 直接使用docker运行："
echo "   docker run -d --name txc-feedback \\"
echo "     --env-file .env \\"
echo "     -v \$(pwd)/logs:/app/logs \\"
echo "     -v \$(pwd)/data:/app/data \\"
echo "     -v \$(pwd)/screenshot:/app/screenshot \\"
echo "     --cap-add SYS_ADMIN \\"
echo "     --restart unless-stopped \\"
echo "     txc-feedback-crawler:latest"
echo ""
echo "3. 查看容器日志："
echo "   docker-compose logs -f"
echo "   或"
echo "   docker logs -f txc-feedback"
echo ""
echo "4. 停止容器："
echo "   docker-compose down"
echo "   或"
echo "   docker stop txc-feedback && docker rm txc-feedback"