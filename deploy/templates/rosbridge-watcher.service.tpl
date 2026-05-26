[Unit]
Description=Radar Visualization Rosbridge Auto-Restart Watcher
# 监听 ROS 栈容器重启并自动重启 rosbridge，使其重连新 publisher
After=docker.service {{ROSBRIDGE_SERVICE_NAME}}
Wants=docker.service

[Service]
Type=simple
Environment=WATCH_CONTAINER={{ROS_STACK_CONTAINER}}
Environment=ROSBRIDGE_SERVICE={{ROSBRIDGE_SERVICE_NAME}}
Environment=SETTLE_SECONDS={{WATCHER_SETTLE_SECONDS}}
ExecStart={{TARGET_DIR}}/bin/rosbridge-watcher.sh
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
