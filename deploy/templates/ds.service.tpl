[Unit]
Description=Radar Visualization DS Bridge
After=network.target radar-visualization-rosbridge.service

[Service]
Type=simple
WorkingDirectory={{TARGET_DIR}}
EnvironmentFile={{TARGET_DIR}}/config/ds.env
ExecStart={{TARGET_DIR}}/bin/start_ds.sh
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
