#!/bin/bash

# 兔小巢反馈数据爬取项目 - 统一部署脚本
# 使用方法: ./deploy.sh [命令]
# 支持本地构建和远程镜像两种模式

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 项目配置
PROJECT_NAME="txc-feedback-crawler"
CONTAINER_NAME="txc-feedback"
IMAGE_NAME="txc-feedback-crawler:latest"
REMOTE_IMAGE="csighub.tencentyun.com/franklynxu/txc_get_data:latest"
CONFIG_FILE="config.json"
CONFIG_TEMPLATE="config.template.json"

# 检测使用的容器工具（podman 或 docker）
if command -v podman &> /dev/null; then
    CONTAINER_CMD="podman"
elif command -v docker &> /dev/null; then
    CONTAINER_CMD="docker"
else
    echo -e "${RED}[ERROR]${NC} 未找到 podman 或 docker 命令"
    exit 1
fi

# 打印带颜色的消息
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 显示帮助信息
show_help() {
    cat << EOF
${GREEN}兔小巢反馈数据爬取项目 - 统一部署工具${NC}

${YELLOW}使用方法:${NC}
    ./deploy.sh [命令]

${YELLOW}配置管理:${NC}
    ${GREEN}init${NC}            初始化配置文件（从本地模板）
    ${GREEN}pull-config${NC}     从远程镜像提取配置模板（无需代码仓库）

${YELLOW}本地部署（开发测试）:${NC}
    ${GREEN}build${NC}           构建本地镜像
    ${GREEN}start${NC}           构建并启动容器（本地镜像）
    ${GREEN}stop${NC}            停止容器
    ${GREEN}restart${NC}         重启容器

${YELLOW}生产部署（远程镜像）:${NC}
    ${GREEN}pull${NC}            拉取远程镜像
    ${GREEN}start-prod${NC}      使用远程镜像启动容器
    ${GREEN}upgrade${NC}         升级到最新版本（停止→拉取→启动）

${YELLOW}运维管理:${NC}
    ${GREEN}logs${NC}            查看实时日志
    ${GREEN}status${NC}          查看容器状态
    ${GREEN}enter${NC}           进入容器内部
    ${GREEN}test${NC}            运行测试脚本
    ${GREEN}clean${NC}           清理容器和镜像

${YELLOW}示例:${NC}
    ${BLUE}# 本地开发${NC}
    ./deploy.sh init          # 初始化配置
    ./deploy.sh start         # 启动服务
    
    ${BLUE}# 生产部署（完全独立，不依赖代码仓库）${NC}
    ./deploy.sh pull          # 拉取镜像
    ./deploy.sh pull-config   # 从镜像提取配置模板
    vim config.json           # 编辑配置
    ./deploy.sh start-prod    # 启动服务
    
    ${BLUE}# 版本升级${NC}
    ./deploy.sh upgrade       # 一键升级

${YELLOW}当前容器工具:${NC} ${CONTAINER_CMD}

EOF
}

# 检查配置文件
check_config() {
    if [ ! -f "$CONFIG_FILE" ]; then
        print_error "配置文件 $CONFIG_FILE 不存在"
        print_info "请先运行 './deploy.sh init' 初始化配置文件"
        exit 1
    fi
}

# 初始化配置（从本地模板）
init_config() {
    print_info "正在初始化配置..."
    
    if [ -f "$CONFIG_FILE" ]; then
        print_warning "配置文件 $CONFIG_FILE 已存在"
        read -p "是否覆盖? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_info "取消初始化"
            return
        fi
    fi
    
    if [ ! -f "$CONFIG_TEMPLATE" ]; then
        print_error "配置模板文件 $CONFIG_TEMPLATE 不存在"
        print_info "提示: 运行 './deploy.sh pull-config' 从镜像提取配置模板"
        exit 1
    fi
    
    cp "$CONFIG_TEMPLATE" "$CONFIG_FILE"
    print_success "配置文件已创建: $CONFIG_FILE"
    print_warning "请编辑 $CONFIG_FILE 填入正确的配置信息"
    print_info "编辑命令: vim $CONFIG_FILE 或 nano $CONFIG_FILE"
}

# 从远程镜像提取配置模板（完全独立，不依赖代码仓库）
pull_config() {
    print_info "正在从远程镜像提取配置模板..."
    
    # 确定使用的命令（rootless podman 需要 sudo）
    local CMD="$CONTAINER_CMD"
    if [ "$CONTAINER_CMD" = "podman" ] && [ "$EUID" -ne 0 ]; then
        # 检查 sudo 镜像是否存在
        if ! sudo $CONTAINER_CMD images | grep -q "txc_get_data"; then
            print_warning "未找到镜像，正在拉取..."
            pull_image
        fi
        CMD="sudo $CONTAINER_CMD"
    else
        # 检查镜像是否存在
        if ! $CONTAINER_CMD images | grep -q "txc_get_data"; then
            print_warning "未找到镜像，正在拉取..."
            pull_image
        fi
    fi
    
    # 使用 podman/docker run 直接提取
    print_info "提取配置模板文件..."
    $CMD run --rm "$REMOTE_IMAGE" cat /app/config.template.json > "$CONFIG_TEMPLATE" 2>/dev/null
    
    if [ -f "$CONFIG_TEMPLATE" ] && [ -s "$CONFIG_TEMPLATE" ]; then
        print_success "配置模板已提取: $CONFIG_TEMPLATE"
        
        # 如果 config.json 不存在，则创建
        if [ ! -f "$CONFIG_FILE" ]; then
            cp "$CONFIG_TEMPLATE" "$CONFIG_FILE"
            print_success "配置文件已创建: $CONFIG_FILE"
            echo ""
            print_warning "请编辑 $CONFIG_FILE 填入你的配置信息："
            print_info "   vim $CONFIG_FILE"
            echo ""
        else
            print_info "config.json 已存在，跳过创建"
        fi
    else
        print_error "提取配置模板失败"
        exit 1
    fi
}

# 拉取远程镜像
pull_image() {
    print_info "正在拉取远程镜像..."
    print_info "镜像地址: $REMOTE_IMAGE"
    
    # 使用 sudo 避免 rootless 模式的 UID/GID 映射问题
    if [ "$CONTAINER_CMD" = "podman" ] && [ "$EUID" -ne 0 ]; then
        print_info "检测到 rootless 模式，使用 sudo 拉取镜像..."
        sudo $CONTAINER_CMD pull "$REMOTE_IMAGE"
    else
        $CONTAINER_CMD pull "$REMOTE_IMAGE"
    fi
    
    print_success "镜像拉取完成！"
    print_info "运行 './deploy.sh pull-config' 提取配置模板"
}

# 构建本地镜像
build_image() {
    print_info "正在构建本地镜像..."
    
    if [ ! -f "Dockerfile" ]; then
        print_error "Dockerfile 不存在"
        exit 1
    fi
    
    $CONTAINER_CMD build -t "$IMAGE_NAME" .
    
    print_success "镜像构建完成！"
}

# 构建并启动容器（本地模式）
start_service() {
    print_info "正在启动服务（本地构建模式）..."
    
    check_config
    
    # 检查是否已有运行的容器
    if $CONTAINER_CMD ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        print_warning "容器 $CONTAINER_NAME 已存在"
        print_info "正在停止并移除旧容器..."
        $CONTAINER_CMD stop "$CONTAINER_NAME" 2>/dev/null || true
        $CONTAINER_CMD rm "$CONTAINER_NAME" 2>/dev/null || true
    fi
    
    # 构建镜像
    build_image
    
    # 启动容器
    print_info "正在启动容器..."
    $CONTAINER_CMD run -d \
        --name "$CONTAINER_NAME" \
        --restart unless-stopped \
        -v "$(pwd)/config.json:/app/config.json:ro" \
        -v "$(pwd)/logs:/app/logs" \
        -v "$(pwd)/data:/app/data" \
        -v "$(pwd)/screenshot:/app/screenshot" \
        --cap-add SYS_ADMIN \
        "$IMAGE_NAME"
    
    print_success "服务启动成功!"
    print_info "容器名称: $CONTAINER_NAME"
    print_info "查看日志: ./deploy.sh logs"
    print_info "查看状态: ./deploy.sh status"
}

# 使用远程镜像启动容器（生产模式）
start_prod() {
    print_info "正在启动服务（生产镜像模式）..."
    
    check_config
    
    # 确定使用的命令
    local RUN_CMD="$CONTAINER_CMD"
    if [ "$CONTAINER_CMD" = "podman" ] && [ "$EUID" -ne 0 ]; then
        # rootless 模式需要使用 sudo
        print_info "检测到 rootless 模式，使用 sudo 运行容器..."
        RUN_CMD="sudo $CONTAINER_CMD"
        
        # 检查镜像是否存在
        if ! sudo $CONTAINER_CMD images | grep -q "txc_get_data"; then
            print_warning "未找到远程镜像，正在拉取..."
            pull_image
        fi
        
        # 检查是否已有运行的容器
        if sudo $CONTAINER_CMD ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
            print_warning "容器 $CONTAINER_NAME 已存在"
            print_info "正在停止并移除旧容器..."
            sudo $CONTAINER_CMD stop "$CONTAINER_NAME" 2>/dev/null || true
            sudo $CONTAINER_CMD rm "$CONTAINER_NAME" 2>/dev/null || true
        fi
    else
        # 检查镜像是否存在
        if ! $CONTAINER_CMD images | grep -q "txc_get_data"; then
            print_warning "未找到远程镜像，正在拉取..."
            pull_image
        fi
        
        # 检查是否已有运行的容器
        if $CONTAINER_CMD ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
            print_warning "容器 $CONTAINER_NAME 已存在"
            print_info "正在停止并移除旧容器..."
            $CONTAINER_CMD stop "$CONTAINER_NAME" 2>/dev/null || true
            $CONTAINER_CMD rm "$CONTAINER_NAME" 2>/dev/null || true
        fi
    fi
    
    # 创建数据目录
    mkdir -p logs data screenshot
    
    # 启动容器
    print_info "正在启动容器..."
    $RUN_CMD run -d \
        --name "$CONTAINER_NAME" \
        --restart unless-stopped \
        -v "$(pwd)/config.json:/app/config.json:ro" \
        -v "$(pwd)/logs:/app/logs" \
        -v "$(pwd)/data:/app/data" \
        -v "$(pwd)/screenshot:/app/screenshot" \
        --cap-add SYS_ADMIN \
        "$REMOTE_IMAGE"
    
    print_success "服务启动成功!"
    print_info "容器名称: $CONTAINER_NAME"
    print_info "查看日志: ./deploy.sh logs"
    print_info "查看状态: ./deploy.sh status"
}

# 一键升级到最新版本
upgrade_service() {
    print_info "开始升级到最新版本..."
    
    # 停止旧容器
    if $CONTAINER_CMD ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        print_info "停止旧容器..."
        $CONTAINER_CMD stop "$CONTAINER_NAME"
        $CONTAINER_CMD rm "$CONTAINER_NAME"
    fi
    
    # 拉取最新镜像
    pull_image
    
    # 启动新容器
    start_prod
    
    print_success "升级完成！"
}

# 停止容器
stop_service() {
    print_info "正在停止服务..."
    
    if $CONTAINER_CMD ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        $CONTAINER_CMD stop "$CONTAINER_NAME"
        print_success "服务已停止"
    else
        print_warning "容器未运行"
    fi
}

# 重启容器
restart_service() {
    print_info "正在重启服务..."
    stop_service
    sleep 2
    
    # 判断使用哪个镜像重启
    if $CONTAINER_CMD ps -a --format '{{.Image}}' --filter "name=${CONTAINER_NAME}" | grep -q "txc_get_data"; then
        print_info "使用生产镜像重启..."
        start_prod
    else
        print_info "使用本地镜像重启..."
        start_service
    fi
}

# 查看日志
view_logs() {
    print_info "正在查看日志 (Ctrl+C 退出)..."
    
    # 检查是否使用 sudo 启动的容器
    if [ "$CONTAINER_CMD" = "podman" ] && [ "$EUID" -ne 0 ]; then
        if sudo $CONTAINER_CMD ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
            sudo $CONTAINER_CMD logs -f "$CONTAINER_NAME"
            return
        fi
    fi
    
    $CONTAINER_CMD logs -f "$CONTAINER_NAME"
}

# 查看状态
check_status() {
    print_info "正在检查服务状态..."
    
    # 确定使用的命令
    local CHECK_CMD="$CONTAINER_CMD"
    if [ "$CONTAINER_CMD" = "podman" ] && [ "$EUID" -ne 0 ]; then
        # 先检查 sudo 容器
        if sudo $CONTAINER_CMD ps --format '{{.Names}}' 2>/dev/null | grep -q "^${CONTAINER_NAME}$"; then
            print_success "容器正在运行 (sudo模式)"
            echo
            sudo $CONTAINER_CMD ps --filter "name=${CONTAINER_NAME}" --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"
            echo
            print_info "健康检查状态:"
            sudo $CONTAINER_CMD inspect --format='{{.State.Health.Status}}' "$CONTAINER_NAME" 2>/dev/null || echo "未配置健康检查"
            return
        fi
    fi
    
    if $CONTAINER_CMD ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        print_success "容器正在运行"
        echo
        $CONTAINER_CMD ps --filter "name=${CONTAINER_NAME}" --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"
        echo
        print_info "健康检查状态:"
        $CONTAINER_CMD inspect --format='{{.State.Health.Status}}' "$CONTAINER_NAME" 2>/dev/null || echo "未配置健康检查"
    else
        print_warning "容器未运行"
        
        if $CONTAINER_CMD ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
            print_info "容器存在但未运行，状态:"
            $CONTAINER_CMD ps -a --filter "name=${CONTAINER_NAME}" --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"
        fi
    fi
}

# 清理容器和镜像
clean_service() {
    print_warning "此操作将删除容器和镜像"
    read -p "确认继续? (y/N): " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "取消清理"
        return
    fi
    
    print_info "正在清理..."
    
    # 停止并删除容器
    if $CONTAINER_CMD ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        $CONTAINER_CMD stop "$CONTAINER_NAME" 2>/dev/null || true
        $CONTAINER_CMD rm "$CONTAINER_NAME" 2>/dev/null || true
        print_success "容器已删除"
    fi
    
    # 删除本地镜像
    if $CONTAINER_CMD images --format '{{.Repository}}:{{.Tag}}' | grep -q "^${IMAGE_NAME}$"; then
        $CONTAINER_CMD rmi "$IMAGE_NAME" 2>/dev/null || true
        print_success "本地镜像已删除"
    fi
    
    print_success "清理完成"
}

# 进入容器
enter_container() {
    print_info "正在进入容器..."
    
    if ! $CONTAINER_CMD ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        print_error "容器未运行"
        exit 1
    fi
    
    $CONTAINER_CMD exec -it "$CONTAINER_NAME" sh
}

# 运行测试
run_test() {
    print_info "正在运行测试..."
    
    if ! $CONTAINER_CMD ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        print_error "容器未运行"
        exit 1
    fi
    
    $CONTAINER_CMD exec "$CONTAINER_NAME" node test_optimized.js
}

# 主逻辑
main() {
    case "${1:-help}" in
        init)
            init_config
            ;;
        pull-config)
            pull_config
            ;;
        pull)
            pull_image
            ;;
        build)
            build_image
            ;;
        start)
            start_service
            ;;
        start-prod)
            start_prod
            ;;
        upgrade)
            upgrade_service
            ;;
        stop)
            stop_service
            ;;
        restart)
            restart_service
            ;;
        logs)
            view_logs
            ;;
        status)
            check_status
            ;;
        clean)
            clean_service
            ;;
        enter)
            enter_container
            ;;
        test)
            run_test
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            print_error "未知命令: $1"
            echo
            show_help
            exit 1
            ;;
    esac
}

# 执行主函数
main "$@"
