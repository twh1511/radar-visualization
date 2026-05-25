[Unit]
Description=Radar Visualization Rosbridge
After=network.target

[Service]
Type=simple
WorkingDirectory={{TARGET_DIR}}
EnvironmentFile={{TARGET_DIR}}/config/rosbridge.env
ExecStart={{TARGET_DIR}}/bin/start_rosbridge.sh
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
