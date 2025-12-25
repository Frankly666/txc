# 使用官方Node.js 18 Alpine镜像作为基础镜像
FROM node:18-alpine

# 安装Puppeteer所需的Chrome依赖和时区数据包
RUN apk update && apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    bash \
    zlib-dev \
    libstdc++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    pixman-dev \
    python3 \
    make \
    g++ \
    tzdata \
    fontconfig \
    dbus \
    procps

# 设置时区
RUN ln -sf /usr/share/zoneinfo/Asia/Shanghai /etc/localtime && \
    echo "Asia/Shanghai" > /etc/timezone

# 设置Puppeteer环境变量和时区环境变量
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    TZ=Asia/Shanghai

# 创建工作目录
WORKDIR /app

# 安装pm2全局
RUN npm install pm2 -g

# 复制package.json和package-lock.json
COPY package*.json ./

# 配置npm私有源并安装依赖
RUN npm config set @tencent:registry https://mirrors.tencent.com/npm/ && \
    npm install

# 复制项目文件到工作目录
COPY . .

# 确保config.template.json存在（如果没有config.json会使用环境变量）
RUN if [ -f config.template.json ]; then \
      echo "配置模板文件已复制"; \
    fi

# 创建日志文件目录
RUN mkdir -p /app/logs && \
    mkdir -p /app/data && \
    mkdir -p /app/screenshot && \
    touch /app/monitor.log && \
    touch /app/task.log && \
    # 确保权限正确
    chmod -R 777 /app/logs && \
    chmod -R 777 /app/data && \
    chmod -R 777 /app/screenshot

# 添加健康检查
HEALTHCHECK --interval=5m --timeout=30s --start-period=2m --retries=3 \
  CMD node /app/healthcheck.js || exit 1

# 设置默认命令（使用pm2启动监控服务并配置日志输出）
CMD ["pm2-runtime", "monitor.js", "--name", "tuxiaochao-monitor", "--log", "/app/logs/monitor-output.log", "--error", "/app/logs/monitor-error.log"]

# 暴露相关端口（如果有需要）
EXPOSE 3000