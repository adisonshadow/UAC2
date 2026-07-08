#!/bin/bash

# 获取脚本所在目录的绝对路径
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# 检查是否已经有cron任务
EXISTING_CRON=$(crontab -l 2>/dev/null | grep "db-backup.sh")

if [ -n "$EXISTING_CRON" ]; then
    echo "数据库备份cron任务已存在，跳过设置"
    exit 0
fi

# 创建新的cron任务（每天凌晨2点执行）
(crontab -l 2>/dev/null; echo "0 2 * * * cd $PROJECT_ROOT && yarn db:backup >> $PROJECT_ROOT/logs/db-backup.log 2>&1") | crontab -

echo "数据库备份cron任务已设置，将在每天凌晨2点执行" 