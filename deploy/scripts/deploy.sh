#!/bin/bash
set -euo pipefail

MANIFEST="${1:-}"
if [ -z "$MANIFEST" ]; then
  echo "Usage: deploy.sh <manifest.yaml>"
  exit 1
fi

if [ ! -f "$MANIFEST" ]; then
  echo "Manifest not found: $MANIFEST"
  exit 1
fi

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DEPLOY_ROOT="$PROJECT_ROOT/deploy"
WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

# 认证模式：设置了 DEPLOY_SSH_PASSWORD 走 sshpass 密码登录 + 远端 sudo -S；
# 否则走免密（SSH 公钥 + 免密 sudo，车队标准）。本地 helper 走前者。
SSH_PASS="${DEPLOY_SSH_PASSWORD:-}"
SSH_OPTS="-o StrictHostKeyChecking=accept-new -o ConnectTimeout=15"
if [ -n "$SSH_PASS" ]; then
  if ! command -v sshpass >/dev/null 2>&1; then
    echo "ERROR: 密码模式需要 sshpass，请先安装 (apt install sshpass)" >&2
    exit 1
  fi
  export SSHPASS="$SSH_PASS"
  SSH="sshpass -e ssh $SSH_OPTS"
  SCP="sshpass -e scp $SSH_OPTS"
  RSYNC_RSH="sshpass -e ssh $SSH_OPTS"
else
  SSH="ssh $SSH_OPTS"
  SCP="scp $SSH_OPTS"
  RSYNC_RSH="ssh $SSH_OPTS"
fi

DISCOVERY_REPORT="$WORK_DIR/discovery-report.json"
python3 "$DEPLOY_ROOT/scripts/discover-robot.py" "$MANIFEST" "$DISCOVERY_REPORT"
if [ -f "$DISCOVERY_REPORT" ]; then
  echo "Discovery report generated: $DISCOVERY_REPORT"
  cat "$DISCOVERY_REPORT"
fi

python3 - <<'PY' "$MANIFEST" "$DISCOVERY_REPORT" "$WORK_DIR/context.env"
import json, sys, yaml
from pathlib import Path
manifest = yaml.safe_load(Path(sys.argv[1]).read_text())
discovery = json.loads(Path(sys.argv[2]).read_text()) if Path(sys.argv[2]).exists() else {}
out = Path(sys.argv[3])
paths = manifest['paths']
rosbridge = manifest['rosbridge']
ds = manifest['ds']
fastdds = manifest.get('fastdds', {}) or {}
env = manifest['env']
checks = manifest['checks']
lines = {
    'HOST': manifest['host'],
    'USER': manifest['user'],
    'SSH_PORT': str(manifest.get('sshPort', 22)),
    'BASE_DIR': paths['baseDir'],
    'APP_DIR_NAME': paths['appDirName'],
    'TARGET_DIR': f"{paths['baseDir']}/{paths['appDirName']}",
    'RELEASE_DIR': paths.get('releaseDir', f"{paths['baseDir']}/{paths['appDirName']}/releases/current"),
    'CURRENT_LINK': paths.get('currentLink', f"{paths['baseDir']}/{paths['appDirName']}/current"),
    'ROSBRIDGE_PACKAGE': rosbridge['package'],
    'ROSBRIDGE_ENTRY': rosbridge['launchOrExecutable'],
    'ROSBRIDGE_SERVICE_NAME': rosbridge.get('serviceName', checks.get('rosbridgeServiceName', 'radar-visualization-rosbridge.service')),
    'ROSBRIDGE_START_COMMAND': rosbridge.get('startCommand', ''),
    'ROSBRIDGE_PORT': str(rosbridge.get('port', 9090)),
    'ROSBRIDGE_ADDRESS': str(rosbridge.get('address', '0.0.0.0')),
    # rosbridge 这几个参数要求 DOUBLE 类型，必须带小数点（10 会被当 INTEGER 报错）
    'ROSBRIDGE_PING_INTERVAL': str(float(rosbridge.get('websocketPingInterval', 10))),
    'ROSBRIDGE_PING_TIMEOUT': str(float(rosbridge.get('websocketPingTimeout', 30))),
    'ROSBRIDGE_UNREGISTER_TIMEOUT': str(float(rosbridge.get('unregisterTimeout', 2))),
    'ROSBRIDGE_MAX_MESSAGE_SIZE': str(int(rosbridge.get('maxMessageSize', 10000000))),
    'WATCHER_ENABLED': 'true' if (rosbridge.get('watcher') or {}).get('enabled') else 'false',
    'WATCHER_SERVICE_NAME': (rosbridge.get('watcher') or {}).get('serviceName', 'radar-visualization-rosbridge-watcher.service'),
    'ROS_STACK_CONTAINER': (rosbridge.get('watcher') or {}).get('containerName', 'i-ros'),
    'WATCHER_SETTLE_SECONDS': str((rosbridge.get('watcher') or {}).get('settleSeconds', 10)),
    'DS_ENTRY': ds['entry'],
    'DS_ROSBRIDGE_URL': ds['rosbridgeUrl'],
    'DS_SERVICE_NAME': ds.get('serviceName', checks.get('dsServiceName', 'radar-visualization-ds.service')),
    'DS_START_COMMAND': ds.get('startCommand', ds['entry']),
    'DS_ENABLED': 'true' if ds.get('enabled', True) else 'false',
    'FASTDDS_ENABLED': 'true' if fastdds.get('enabled') else 'false',
    'FASTDDS_PROFILE_FILE': fastdds.get('profileFileName', ''),
}
# 仅集群/Discovery Server 模式才采用真机 ros.env 的网络上报；
# 简单 UDPv4 模式以"按 IP 推导的 domain"为准，不被旧 ros.env 覆盖。
if not fastdds.get('enabled'):
    if discovery.get('env', {}).get('ROS_DOMAIN_ID'):
        env['ROS_DOMAIN_ID'] = discovery['env']['ROS_DOMAIN_ID']
    if discovery.get('env', {}).get('ROS_DISCOVERY_SERVER'):
        env['ROS_DISCOVERY_SERVER'] = discovery['env']['ROS_DISCOVERY_SERVER']
    if discovery.get('env', {}).get('ROS_SUPER_CLIENT'):
        env['ROS_SUPER_CLIENT'] = discovery['env']['ROS_SUPER_CLIENT']
for k, v in env.items():
    lines[k] = str(v)
# 值用 JSON 引号包裹：source 时含空格的值（如 ROSBRIDGE_START_COMMAND）才安全，
# render_template 读取时会 json.loads 还原成裸值。
out.write_text('\n'.join(f'{k}={json.dumps(str(v))}' for k, v in lines.items()))
PY

source "$WORK_DIR/context.env"

mkdir -p "$WORK_DIR/rendered/bin"
mkdir -p "$WORK_DIR/rendered/config"
mkdir -p "$WORK_DIR/rendered/systemd"

render_template() {
  local template_path="$1"
  local output_path="$2"
  python3 - <<'PY' "$template_path" "$output_path" "$WORK_DIR/context.env"
import sys, json
from pathlib import Path
values = {}
for line in Path(sys.argv[3]).read_text().splitlines():
    if '=' in line:
        k, raw = line.split('=', 1)
        try:
            values[k] = str(json.loads(raw))
        except Exception:
            values[k] = raw
text = Path(sys.argv[1]).read_text()
for k, v in values.items():
    text = text.replace('{{' + k + '}}', v)
Path(sys.argv[2]).write_text(text)
PY
}

render_template "$DEPLOY_ROOT/templates/rosbridge.env.tpl" "$WORK_DIR/rendered/config/rosbridge.env"
render_template "$DEPLOY_ROOT/templates/start_rosbridge.sh.tpl" "$WORK_DIR/rendered/bin/start_rosbridge.sh"
render_template "$DEPLOY_ROOT/templates/rosbridge.service.tpl" "$WORK_DIR/rendered/systemd/$ROSBRIDGE_SERVICE_NAME"
chmod +x "$WORK_DIR/rendered/bin/start_rosbridge.sh"

# rosbridge 自动重启守护：监听 ROS 栈容器重启，自动重启 rosbridge 重连新 publisher
if [ "${WATCHER_ENABLED:-false}" = "true" ]; then
  render_template "$DEPLOY_ROOT/templates/rosbridge-watcher.service.tpl" "$WORK_DIR/rendered/systemd/$WATCHER_SERVICE_NAME"
  # watcher 脚本含 docker Go 模板 {{...}}，不走 render_template，直接复制
  cp "$DEPLOY_ROOT/assets/rosbridge-watcher.sh" "$WORK_DIR/rendered/bin/rosbridge-watcher.sh"
  chmod +x "$WORK_DIR/rendered/bin/rosbridge-watcher.sh"
fi

# 仅在使用 Discovery Server 的集群部署时才下发 ds 服务
if [ "${DS_ENABLED:-false}" = "true" ]; then
  render_template "$DEPLOY_ROOT/templates/ds.env.tpl" "$WORK_DIR/rendered/config/ds.env"
  render_template "$DEPLOY_ROOT/templates/start_ds.sh.tpl" "$WORK_DIR/rendered/bin/start_ds.sh"
  render_template "$DEPLOY_ROOT/templates/ds.service.tpl" "$WORK_DIR/rendered/systemd/$DS_SERVICE_NAME"
  chmod +x "$WORK_DIR/rendered/bin/start_ds.sh"
fi

# 简单 UDPv4 发现：按机器人 IP 生成 FastDDS profile（domain 由 IP 末段决定，见 deployManifest.js）
if [ "${FASTDDS_ENABLED:-false}" = "true" ] && [ -n "${FASTDDS_PROFILE_FILE:-}" ]; then
  python3 - <<'PY' "$MANIFEST" "$WORK_DIR/rendered/config/$FASTDDS_PROFILE_FILE"
import sys, yaml
from pathlib import Path
manifest = yaml.safe_load(Path(sys.argv[1]).read_text())
fd = manifest.get('fastdds') or {}
self_ip = fd['selfIp']
peers = fd.get('peers') or [self_ip]
tid = 'udp_on_' + self_ip.replace('.', '_')
peers_xml = '\n'.join(
    '          <locator>\n'
    '            <udpv4>\n'
    f'              <address>{p}</address>\n'
    '            </udpv4>\n'
    '          </locator>'
    for p in peers
)
xml = f'''<?xml version="1.0" encoding="UTF-8"?>
<profiles xmlns="http://www.eprosima.com/XMLSchemas/fastRTPS_Profiles">
  <transport_descriptors>
    <transport_descriptor>
      <transport_id>{tid}</transport_id>
      <type>UDPv4</type>
      <maxInitialPeersRange>64</maxInitialPeersRange>
      <interfaceWhiteList>
        <address>{self_ip}</address>
      </interfaceWhiteList>
    </transport_descriptor>
  </transport_descriptors>
  <participant profile_name="default_participant_profile" is_default_profile="true">
    <rtps>
      <builtin>
        <initialPeersList>
{peers_xml}
        </initialPeersList>
      </builtin>
      <userTransports>
        <transport_id>{tid}</transport_id>
      </userTransports>
      <useBuiltinTransports>false</useBuiltinTransports>
    </rtps>
  </participant>
</profiles>
'''
Path(sys.argv[2]).write_text(xml)
print(f"Generated FastDDS profile: {sys.argv[2]}")
PY
fi

chmod +x "$DEPLOY_ROOT/scripts/remote_install.sh"

# 传输渲染产物到目标目录（属主 wl，无需 root）。
# 排除运行时日志目录(log/ 由 rosbridge 以 root 写，wl 无权删) 与单独 scp 的文件。
# shellcheck disable=SC2086
rsync -a --delete \
  --exclude '/log/' --exclude '/deploy-manifest.yaml' --exclude '/remote_install.sh' \
  -e "$RSYNC_RSH -p $SSH_PORT" "$WORK_DIR/rendered/" "$USER@$HOST:$TARGET_DIR/"
# shellcheck disable=SC2086
$SCP -P "$SSH_PORT" "$MANIFEST" "$USER@$HOST:$TARGET_DIR/deploy-manifest.yaml"
# shellcheck disable=SC2086
$SCP -P "$SSH_PORT" "$DEPLOY_ROOT/scripts/remote_install.sh" "$USER@$HOST:$TARGET_DIR/remote_install.sh"

# 安装+重启+检查全部交给 remote_install.sh（内部 _sudo 处理需 root 的步骤）。
# 密码模式下把 sudo 密码通过环境变量传入，免密模式留空。
# shellcheck disable=SC2086
$SSH -p "$SSH_PORT" "$USER@$HOST" "SUDO_PASS='$SSH_PASS' bash '$TARGET_DIR/remote_install.sh' '$TARGET_DIR/deploy-manifest.yaml' '$TARGET_DIR'"

echo "Deployment triggered to $HOST"
echo "Expected rosbridge port: ${ROS_BRIDGE_PORT:-9090}"
echo "ROS_DOMAIN_ID: ${ROS_DOMAIN_ID:-?}  FastDDS profile: ${FASTDDS_PROFILE_FILE:-<none>}"
