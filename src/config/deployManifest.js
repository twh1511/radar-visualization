function formatYaml(value, indent = 0) {
  const space = '  '.repeat(indent)
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (item && typeof item === 'object') {
        return `${space}-\n${formatYaml(item, indent + 1)}`
      }
      return `${space}- ${formatScalar(item)}`
    }).join('\n')
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).map(([key, val]) => {
      if (val && typeof val === 'object') {
        return `${space}${key}:\n${formatYaml(val, indent + 1)}`
      }
      return `${space}${key}: ${formatScalar(val)}`
    }).join('\n')
  }
  return `${space}${formatScalar(value)}`
}

function formatScalar(value) {
  if (value === null || value === undefined) return "''"
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') return String(value)
  const str = String(value)
  if (str === '' || /[:#\n{}\[\],&*!?|>'"%@`]/.test(str) || str.includes(' ')) {
    return JSON.stringify(str)
  }
  return str
}

export function buildDeployManifest({ robot, runtimeProfile, effectiveConfig }) {
  const appDirName = 'radar-visualization'
  const rosbridgeServiceName = `${appDirName}-rosbridge.service`
  const dsServiceName = `${appDirName}-ds.service`
  const discoveryReport = runtimeProfile.discoveryReport || {}
  const recommendations = discoveryReport.recommendations || {}

  const mergedTopics = {
    ...effectiveConfig.topics,
    ...recommendations
  }

  return {
    robotName: robot?.name || 'unnamed-robot',
    host: robot?.host || '127.0.0.1',
    user: 'wl',
    sshPort: 22,
    platform: runtimeProfile.environment === 'real' ? 'qr_orin' : 'qr_debug',
    deploymentProfileId: runtimeProfile.deploymentProfileId,
    robotPresetId: runtimeProfile.robotPresetId,
    paths: {
      baseDir: '/home/wl/autorun',
      appDirName,
      releaseDir: '/home/wl/autorun/radar-visualization/releases/current',
      currentLink: '/home/wl/autorun/radar-visualization/current'
    },
    rosbridge: {
      enabled: true,
      launchMode: 'ros2_launch',
      package: 'rosbridge_server',
      launchOrExecutable: 'rosbridge_websocket_launch.xml',
      port: 9090,
      address: '0.0.0.0',
      serviceName: rosbridgeServiceName,
      startCommand: 'ros2 launch rosbridge_server rosbridge_websocket_launch.xml'
    },
    ds: {
      enabled: true,
      entry: '/home/wl/autorun/iiri-ros/start_ros2_iiri_start.sh',
      rosbridgeUrl: 'ws://127.0.0.1:9090',
      serviceName: dsServiceName,
      startCommand: '/home/wl/autorun/iiri-ros/start_ros2_iiri_start.sh'
    },
    env: {
      ROS_DOMAIN_ID: discoveryReport.env?.ROS_DOMAIN_ID || runtimeProfile.network.rosDomainId || 0,
      RMW_IMPLEMENTATION: discoveryReport.env?.RMW_IMPLEMENTATION || 'rmw_fastrtps_cpp',
      ROS_DISCOVERY_SERVER: discoveryReport.env?.ROS_DISCOVERY_SERVER || runtimeProfile.network.discoveryServer || '',
      ROS_SUPER_CLIENT: discoveryReport.env?.ROS_SUPER_CLIENT || (runtimeProfile.network.requiresSuperClient ? 'TRUE' : 'FALSE'),
      FASTDDS_BUILTIN_TRANSPORTS: discoveryReport.env?.FASTDDS_BUILTIN_TRANSPORTS || 'DEFAULT'
    },
    checks: {
      tcpPortOpen: 9090,
      expectedServiceMode: 'systemd',
      rosbridgeServiceName,
      dsServiceName
    },
    discovery: discoveryReport,
    ui: {
      topics: mergedTopics,
      actions: effectiveConfig.actions,
      services: effectiveConfig.services,
      frames: effectiveConfig.frames
    }
  }
}

export function buildDeployManifestYaml(input) {
  return formatYaml(buildDeployManifest(input)) + '\n'
}
