#!/usr/bin/env python3
import json
import subprocess
import sys
from pathlib import Path

try:
    import yaml
except Exception:
    print('PyYAML is required: pip install pyyaml', file=sys.stderr)
    raise


def run_ssh(host, user, port, command):
    ssh_cmd = [
        'sshpass', '-p', '123456',
        'ssh', '-o', 'StrictHostKeyChecking=no', '-p', str(port),
        f'{user}@{host}', command,
    ]
    result = subprocess.run(ssh_cmd, capture_output=True, text=True)
    return result


def main():
    if len(sys.argv) != 3:
        print('Usage: discover-robot.py <input-manifest.yaml> <output-report.json>')
        sys.exit(1)

    manifest_path = Path(sys.argv[1])
    out_path = Path(sys.argv[2])
    manifest = yaml.safe_load(manifest_path.read_text())

    host = manifest['host']
    user = manifest['user']
    port = manifest.get('sshPort', 22)

    report = {
        'host': host,
        'user': user,
        'sshPort': port,
        'reachable': False,
        'env': {},
        'topics': [],
        'topicTypes': {},
        'services': [],
        'actions': [],
        'recommendations': {}
    }

    env_result = run_ssh(host, user, port, "bash -lc 'sed -n \"1,120p\" /home/wl/autorun/iiri-ros/ros.env 2>/dev/null || true'")
    if env_result.returncode != 0:
        out_path.write_text(json.dumps(report, indent=2, ensure_ascii=False))
        sys.exit(0)

    report['reachable'] = True
    for line in env_result.stdout.splitlines():
        if '=' in line and not line.strip().startswith('#'):
            k, v = line.split('=', 1)
            report['env'][k.strip()] = v.strip()

    graph_cmd = "bash -lc 'source /opt/ros/humble/setup.bash >/dev/null 2>&1; source /home/wl/autorun/iiri-ros/ros.env >/dev/null 2>&1 || true; export ROS_SUPER_CLIENT=TRUE; ros2 topic list 2>/dev/null; echo __SERVICES__; ros2 service list 2>/dev/null; echo __ACTIONS__; ros2 action list 2>/dev/null'"
    graph_result = run_ssh(host, user, port, graph_cmd)
    section = 'topics'
    for line in graph_result.stdout.splitlines():
        line = line.strip()
        if not line:
            continue
        if line == '__SERVICES__':
            section = 'services'
            continue
        if line == '__ACTIONS__':
            section = 'actions'
            continue
        report[section].append(line)

    topic_type_cmd = "bash -lc 'source /opt/ros/humble/setup.bash >/dev/null 2>&1; source /home/wl/autorun/iiri-ros/ros.env >/dev/null 2>&1 || true; export ROS_SUPER_CLIENT=TRUE; for t in /cloud_registered /points2 /hdl_localization/odom /odom /amcl_pose /map /plan /local_plan /localization_health /global_costmap/costmap /local_costmap/costmap; do echo \"$t $(ros2 topic type $t 2>/dev/null || true)\"; done'"
    type_result = run_ssh(host, user, port, topic_type_cmd)
    for line in type_result.stdout.splitlines():
      parts = line.split()
      if len(parts) >= 2:
          report['topicTypes'][parts[0]] = parts[1]

    topics = set(report['topics'])
    if '/cloud_registered' in topics:
        report['recommendations']['pointCloud'] = '/cloud_registered'
    elif '/points2' in topics:
        report['recommendations']['pointCloud'] = '/points2'

    if '/hdl_localization/odom' in topics:
        report['recommendations']['pose'] = '/hdl_localization/odom'
    elif '/amcl_pose' in topics:
        report['recommendations']['pose'] = '/amcl_pose'
    elif '/odom' in topics:
        report['recommendations']['pose'] = '/odom'

    if '/map' in topics:
        report['recommendations']['map'] = '/map'
    if '/plan' in topics:
        report['recommendations']['globalPlan'] = '/plan'
    elif '/path' in topics:
        report['recommendations']['globalPlan'] = '/path'
    if '/local_plan' in topics:
        report['recommendations']['localPlan'] = '/local_plan'
    if '/localization_health' in topics:
        report['recommendations']['localizationHealth'] = '/localization_health'
    if '/global_costmap/costmap' in topics:
        report['recommendations']['globalCostmap'] = '/global_costmap/costmap'
    if '/local_costmap/costmap' in topics:
        report['recommendations']['localCostmap'] = '/local_costmap/costmap'

    out_path.write_text(json.dumps(report, indent=2, ensure_ascii=False))


if __name__ == '__main__':
    main()
