#!/bin/bash

load_env_file() {
  local project_root="$1"
  local node_env="${NODE_ENV:-development}"
  local env_file="$project_root/.env.$node_env"

  if [ ! -f "$env_file" ]; then
    echo "错误：环境配置文件 $env_file 不存在"
    exit 1
  fi

  set -a
  # shellcheck disable=SC1090
  source "$env_file"
  set +a
}

wait_for_postgres() {
  local max_attempts="${1:-60}"
  local attempt=0

  echo "等待 PostgreSQL 就绪..."
  while [ "$attempt" -lt "$max_attempts" ]; do
    if docker compose exec -T postgres pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DATABASE" > /dev/null 2>&1; then
      echo "PostgreSQL 已就绪"
      return 0
    fi
    attempt=$((attempt + 1))
    sleep 1
  done

  echo "错误：PostgreSQL 启动超时"
  return 1
}

wait_for_redis() {
  local max_attempts="${1:-30}"
  local attempt=0

  echo "等待 Redis 就绪..."
  while [ "$attempt" -lt "$max_attempts" ]; do
    if docker compose exec -T redis redis-cli ping | grep -q PONG; then
      echo "Redis 已就绪"
      return 0
    fi
    attempt=$((attempt + 1))
    sleep 1
  done

  echo "错误：Redis 启动超时"
  return 1
}

start_docker_services() {
  docker compose up -d
  wait_for_postgres
  wait_for_redis
}
