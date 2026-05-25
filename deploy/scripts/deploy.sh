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
out.write_text('\n'.join(f'{k}={v}' for k, v in lines.items()))
PY

source "$WORK_DIR/context.env"

mkdir -p "$WORK_DIR/rendered/bin"
mkdir -p "$WORK_DIR/rendered/config"
mkdir -p "$WORK_DIR/rendered/systemd"

render_template() {
  local template_path="$1"
  local output_path="$2"
  python3 - <<'PY' "$template_path" "$output_path" "$WORK_DIR/context.env"
import sys
from pathlib import Path
values = {}
for line in Path(sys.argv[3]).read_text().splitlines():
    if '=' in line:
        k, v = line.split('=', 1)
        values[k] = v
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

rsync -av --delete -e "ssh -p $SSH_PORT" "$WORK_DIR/rendered/" "$USER@$HOST:$TARGET_DIR/"
scp -P "$SSH_PORT" "$MANIFEST" "$USER@$HOST:$TARGET_DIR/deploy-manifest.yaml"
scp -P "$SSH_PORT" "$DEPLOY_ROOT/scripts/remote_install.sh" "$USER@$HOST:$TARGET_DIR/remote_install.sh"
REMOTE_CMD="bash '$TARGET_DIR/remote_install.sh' '$TARGET_DIR/deploy-manifest.yaml' '$TARGET_DIR'"
REMOTE_CMD="$REMOTE_CMD; sudo systemctl restart '$ROSBRIDGE_SERVICE_NAME'"
if [ "${DS_ENABLED:-false}" = "true" ]; then
  REMOTE_CMD="$REMOTE_CMD; sudo systemctl restart '$DS_SERVICE_NAME'"
fi
REMOTE_CMD="$REMOTE_CMD; sleep 2; systemctl is-active '$ROSBRIDGE_SERVICE_NAME' || true"
ssh -p "$SSH_PORT" "$USER@$HOST" "$REMOTE_CMD"

echo "Deployment triggered to $HOST"
echo "Expected rosbridge port: ${ROS_BRIDGE_PORT:-9090}"
echo "ROS_DOMAIN_ID: ${ROS_DOMAIN_ID:-?}  FastDDS profile: ${FASTDDS_PROFILE_FILE:-<none>}"
