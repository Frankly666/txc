#!/bin/bash

# 兔小巢反馈数据爬取项目 - 一键部署脚本
# 使用方法: ./deploy.sh [命令]
# 命令: init | start | stop | restart | logs | status | clean

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
CONFIG_FILE="config.json"
CONFIG_TEMPLATE="config.template.json"

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
${GREEN}兔小巢反馈数据爬取项目 - 部署工具${NC}

${YELLOW}使用方法:${NC}
    ./deploy.sh [命令]

${YELLOW}可用命令:${NC}
    ${GREEN}init${NC}        初始化配置文件
    ${GREEN}start${NC}       构建并启动容器
    ${GREEN}stop${NC}        停止容器
    ${GREEN}restart${NC}     重启容器
    ${GREEN}logs${NC}        查看实时日志
    ${GREEN}status${NC}      查看容器状态
    ${GREEN}clean${NC}       清理容器和镜像
    ${GREEN}enter${NC}       进入容器内部
    ${GREEN}test${NC}        运行测试脚本
    ${GREEN}help${NC}        显示此帮助信息

${YELLOW}示例:${NC}
    ./deploy.sh init      # 首次部署时初始化配置
    ./deploy.sh start     # 启动服务
    ./deploy.sh logs      # 查看日志

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

# 初始化配置
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
        exit 1
    fi
    
    cp "$CONFIG_TEMPLATE" "$CONFIG_FILE"
    print_success "配置文件已创建: $CONFIG_FILE"
    print_warning "请编辑 $CONFIG_FILE 填入正确的配置信息"
    print_info "编辑命令: vim $CONFIG_FILE 或 nano $CONFIG_FILE"
}

# 构建并启动容器
start_service() {
    print_info "正在启动服务..."
    
    check_config
    
    # 检查是否已有运行的容器
    if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        print_warning "容器 $CONTAINER_NAME 已存在"
        print_info "正在停止并移除旧容器..."
        docker stop "$CONTAINER_NAME" 2>/dev/null || true
        docker rm "$CONTAINER_NAME" 2>/dev/null || true
    fi
    
    # 构建镜像
    print_info "正在构建 Docker 镜像..."
    docker build -t "$IMAGE_NAME" .
    
    # 启动容器
    print_info "正在启动容器..."
    docker run -d \
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

# 停止容器
stop_service() {
    print_info "正在停止服务..."
    
    if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        docker stop "$CONTAINER_NAME"
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
    start_service
}

# 查看日志
view_logs() {
    print_info "正在查看日志 (Ctrl+C 退出)..."
    docker logs -f "$CONTAINER_NAME"
}

# 查看状态
check_status() {
    print_info "正在检查服务状态..."
    
    if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        print_success "容器正在运行"
        echo
        docker ps --filter "name=${CONTAINER_NAME}" --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"
        echo
        print_info "健康检查状态:"
        docker inspect --format='{{.State.Health.Status}}' "$CONTAINER_NAME" 2>/dev/null || echo "未配置健康检查"
    else
        print_warning "容器未运行"
        
        if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
            print_info "容器存在但未运行，状态:"
            docker ps -a --filter "name=${CONTAINER_NAME}" --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"
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
    if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        docker stop "$CONTAINER_NAME" 2>/dev/null || true
        docker rm "$CONTAINER_NAME" 2>/dev/null || true
        print_success "容器已删除"
    fi
    
    # 删除镜像
    if docker images --format '{{.Repository}}:{{.Tag}}' | grep -q "^${IMAGE_NAME}$"; then
        docker rmi "$IMAGE_NAME" 2>/dev/null || true
        print_success "镜像已删除"
    fi
    
    print_success "清理完成"
}

# 进入容器
enter_container() {
    print_info "正在进入容器..."
    
    if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        print_error "容器未运行"
        exit 1
    fi
    
    docker exec -it "$CONTAINER_NAME" sh
}

# 运行测试
run_test() {
    print_info "正在运行测试..."
    
    if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        print_error "容器未运行"
        exit 1
    fi
    
    docker exec "$CONTAINER_NAME" node test_optimized.js
}

# 主逻辑
main() {
    case "${1:-help}" in
        init)
            init_config
            ;;
        start)
            start_service
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
