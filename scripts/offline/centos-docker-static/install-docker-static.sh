#!/bin/bash
set -e
echo "===== CentOS8 x86_64 离线安装静态Docker 24.0.9 ====="

# 解压docker静态二进制包
echo "1. 解压docker静态包"
rm -rf docker
tar -zxvf docker-24.0.9.tgz

# 复制docker二进制到系统PATH
echo "2. 拷贝docker程序到 /usr/local/bin"
cp docker/* /usr/local/bin/
chmod +x /usr/local/bin/docker*

# 安装docker compose v2
echo "3. 安装 docker-compose"
cp ./docker-compose /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
# 创建软链接，支持 docker compose（空格命令，适配compose yaml）
ln -sf /usr/local/bin/docker-compose /usr/local/bin/docker-compose-v2

# 编写systemd docker服务单元
echo "4. 写入docker systemd服务"
cat > /etc/systemd/system/docker.service <<EOF
[Unit]
Description=Docker Application Container Engine
Documentation=https://docs.docker.com
After=network-online.target firewalld.service
Wants=network-online.target

[Service]
Type=notify
# 静态dockerd路径
ExecStart=/usr/local/bin/dockerd
ExecReload=/bin/kill -s HUP \$MAINPID
TimeoutSec=0
RestartSec=2
Restart=always
# 允许iptables
LimitNOFILE=infinity
LimitNPROC=infinity
LimitCORE=infinity

[Install]
WantedBy=multi-user.target
EOF

# 重载systemd，设置开机自启并启动docker
echo "5. 启动Docker并设置开机自启"
systemctl daemon-reload
systemctl enable docker
systemctl start docker

# 验证安装
echo ""
echo "===== 验证结果 ====="
docker --version
docker-compose --version
echo "Docker安装完成！"
echo "如需放行端口（firewalld）："
echo "  firewall-cmd --add-port=9526/tcp --permanent"
echo "  firewall-cmd --add-port=9527/tcp --permanent"
echo "  firewall-cmd --add-port=13303/tcp --permanent"
echo "  firewall-cmd --add-port=13308/tcp --permanent"
echo "  firewall-cmd --reload"
