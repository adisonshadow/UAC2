#!/bin/bash

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

export NODE_ENV="${NODE_ENV:-development}"

# shellcheck disable=SC1091
source "$PROJECT_ROOT/scripts/env.sh"
load_env_file "$PROJECT_ROOT"

DB_HOST="$POSTGRES_HOST"
DB_PORT="$POSTGRES_PORT"
DB_USER="$POSTGRES_USER"
DB_PASSWORD="$POSTGRES_PASSWORD"
DB_NAME="$POSTGRES_DATABASE"

if [ -z "$DB_HOST" ] || [ -z "$DB_PORT" ] || [ -z "$DB_USER" ] || [ -z "$DB_PASSWORD" ] || [ -z "$DB_NAME" ]; then
    echo "错误：.env.$NODE_ENV 中缺少必要的数据库配置信息"
    exit 1
fi

BACKUP_DIR="$PROJECT_ROOT/backups/db"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_$DATE.sql"

mkdir -p "$BACKUP_DIR"

LOCK_FILE="/tmp/uac_db_backup.lock"
if [ -f "$LOCK_FILE" ]; then
    PID=$(cat "$LOCK_FILE")
    if ps -p $PID > /dev/null 2>&1; then
        echo "备份进程已经在运行中 (PID: $PID)"
        exit 1
    fi
fi

echo $$ > "$LOCK_FILE"

echo "开始备份数据库..."
PGPASSWORD=$DB_PASSWORD pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -F c -f "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo "数据库备份成功: $BACKUP_FILE"
    find "$BACKUP_DIR" -name "backup_*.sql" -type f -mtime +7 -delete
    echo "已删除7天前的备份文件"
else
    echo "数据库备份失败"
fi

rm -f "$LOCK_FILE"
