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
  // YAML 会把 TRUE/FALSE/yes/no/on/off/null 等裸词解析成布尔/空值，
  // 导致 "TRUE"/"FALSE" 这类字符串环境变量被改写（如 Super Client 失效），故强制加引号。
  const yamlKeyword = /^(?:true|false|yes|no|on|off|null|~|nan|\.inf|-\.inf)$/i
  if (
    str === '' ||
    yamlKeyword.test(str) ||
    /[:#\n{}\[\],&*!?|>'"%@`]/.test(str) ||
    str.includes(' ')
  ) {
    return JSON.stringify(str)
  }
  return str
}

// 由机器人 IP 末段推导 ROS_DOMAIN_ID（192.168.1.101 -> 101）。
// 取最后一个点分段；超出 ROS2 合法域范围(0-232)或无法解析时返回 null。
export function deriveDomainIdFromHost(host) {
  const match = String(host || '').trim().match(/(\d{1,3})(?:[^\d]*)$/)
  if (!match) return null
  const octet = Number(match[1])
  if (!Number.isInteger(octet) || octet < 0 || octet > 232) return null
  return octet
}

export function buildDeployManifest({ robot, runtimeProfile, effectiveConfig }) {
  if (!robot?.host) {
    throw new Error('请先填写机器人 IP 地址。')
  }
  if (!robot?.deploymentProfileId) {
    throw new Error('请先选择部署档案。')
  }
  if (!robot?.robotPresetId) {
    throw new Error('请先选择机器人模板。')
  }

  const appDirName = 'radar-visualization'
  const rosbridgeServiceName = `${appDirName}-rosbridge.service`
  const dsServiceName = `${appDirName}-ds.service`
  const discoveryReport = runtimeProfile.discoveryReport || {}
  const recommendations = discoveryReport.recommendations || {}

  const mergedTopics = {
    ...effectiveConfig.topics,
    ...recommendations
  }

  const network = runtimeProfile?.network || {}
  const baseDir = '/home/wl/autorun'
  const targetDir = `${baseDir}/${appDirName}`

  // domain 优先级：真机发现上报 > profile 显式锁定 > 按 IP 推导 > 0
  const derivedDomainId = deriveDomainIdFromHost(robot.host)
  const rosDomainId =
    discoveryReport.env?.ROS_DOMAIN_ID ??
    network.rosDomainId ??
    derivedDomainId ??
    0

  // 集群用 Discovery Server；否则走简单 UDPv4 发现 + 按 IP 生成 FastDDS profile
  const usesDiscoveryServer = Boolean(
    network.requiresDiscoveryServer ||
    network.discoveryServer ||
    discoveryReport.env?.ROS_DISCOVERY_SERVER
  )

  const fastddsOctet = derivedDomainId ?? 'custom'
  const fastddsProfileFileName = `fastdds_wlan_${fastddsOctet}.xml`
  const fastddsProfilePath = `${targetDir}/config/${fastddsProfileFileName}`
  const extraPeers = Array.isArray(network.fastddsPeers) ? network.fastddsPeers : []
  const fastddsPeers = Array.from(new Set([robot.host, ...extraPeers]))

  const fastdds = usesDiscoveryServer
    ? { enabled: false }
    : {
        enabled: true,
        profileFileName: fastddsProfileFileName,
        profilePath: fastddsProfilePath,
        selfIp: robot.host,
        peers: fastddsPeers,
        transport: 'UDPv4',
        useBuiltinTransports: false
      }

  return {
    robotName: robot.name || 'unnamed-robot',
    host: robot.host,
    user: 'wl',
    sshPort: 22,
    platform: runtimeProfile.environment === 'real' ? 'qr_orin' : 'qr_debug',
    deploymentProfileId: robot.deploymentProfileId,
    robotPresetId: robot.robotPresetId,
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
      port: robot.port || 9090,
      address: '0.0.0.0',
      serviceName: rosbridgeServiceName,
      // WebSocket 心跳：定期 ping 客户端，超时无 pong 即主动断开，
      // 回收 CLOSE-WAIT 死连接与僵尸订阅；unregister 缩短到 2s 减少刷新时的订阅叠加。
      websocketPingInterval: 10,
      websocketPingTimeout: 30,
      unregisterTimeout: 2,
      maxMessageSize: 100000000,
      startCommand: 'ros2 launch rosbridge_server rosbridge_websocket_launch.xml'
    },
    ds: {
      enabled: usesDiscoveryServer,
      entry: '/home/wl/autorun/iiri-ros/start_ros2_iiri_start.sh',
      rosbridgeUrl: `ws://127.0.0.1:${robot.port || 9090}`,
      serviceName: dsServiceName,
      startCommand: '/home/wl/autorun/iiri-ros/start_ros2_iiri_start.sh'
    },
    env: {
      ROS_DOMAIN_ID: rosDomainId,
      RMW_IMPLEMENTATION: discoveryReport.env?.RMW_IMPLEMENTATION || 'rmw_fastrtps_cpp',
      ROS_DISCOVERY_SERVER: usesDiscoveryServer
        ? (discoveryReport.env?.ROS_DISCOVERY_SERVER || network.discoveryServer || '')
        : '',
      ROS_SUPER_CLIENT: discoveryReport.env?.ROS_SUPER_CLIENT || (network.requiresSuperClient ? 'TRUE' : 'FALSE'),
      FASTDDS_BUILTIN_TRANSPORTS: discoveryReport.env?.FASTDDS_BUILTIN_TRANSPORTS || (fastdds.enabled ? 'UDPv4' : 'DEFAULT'),
      ROS_LOCALHOST_ONLY: '0',
      FASTRTPS_DEFAULT_PROFILES_FILE: fastdds.enabled ? fastddsProfilePath : '',
      FASTDDS_DEFAULT_PROFILES_FILE: fastdds.enabled ? fastddsProfilePath : '',
      // systemd 以 root 运行时环境无 HOME，需显式指定可写日志目录，否则 rcl 初始化日志失败
      ROS_LOG_DIR: `${targetDir}/log`
    },
    fastdds,
    checks: {
      tcpPortOpen: robot.port || 9090,
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
