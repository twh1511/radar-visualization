export const ROBOT_PRESETS = [
  {
    id: 'generic-radar-viz',
    name: '通用雷达可视化',
    deploymentProfileId: 'generic-rosbridge',
    description: '适合未知设备或开发中的 rosbridge 环境。',
    defaults: {
      topics: {
        pointCloud: '/points2',
        pose: '/odom',
        map: '/map'
      }
    },
    discoveryCandidates: {
      pointCloud: ['/points2', '/cloud_registered', '/livox/lidar'],
      pose: ['/odom', '/hdl_localization/odom', '/amcl_pose'],
      map: ['/map'],
      globalPlan: ['/plan', '/path'],
      localPlan: ['/local_plan'],
      lookaheadPoint: ['/lookahead_point'],
      localizationHealth: ['/localization_health'],
      globalCostmap: ['/global_costmap/costmap'],
      localCostmap: ['/local_costmap/costmap']
    }
  },
  {
    id: 'iiri-hdl-cluster',
    name: 'IIRI 实机 i-ros',
    // i-ros 实机走"按 IP 推导域 + UDPv4"发现（generic-rosbridge 档案），
    // 不是老 247 集群的 Discovery Server(219)。若要连 DS 集群，在设置里手动选 iiri-cluster-hdl 档案。
    deploymentProfileId: 'generic-rosbridge',
    description: '针对 i-ros 实机导航链路（按 IP 域 + UDPv4），含 HDL 定位与代价地图。',
    defaults: {
      topics: {
        // FAST-LIO 的 /cloud_registered 在实机默认被 scan_publish_en:false 关闭，
        // 实际持续发布的是 livox 原始点云 /points2，故默认用它。
        pointCloud: '/points2',
        pose: '/hdl_localization/odom',
        map: '/map',
        globalPlan: '/plan',
        localPlan: '/local_plan',
        localizationHealth: '/localization_health'
      },
      // costmap 开启显示。它们在云连接(rosCloud)上，global costmap ~1.5MB/帧大流量已限到
      // 0.2Hz 转发(见 subscribeCloud)，配合 static map 持久化(重连不重载地图)，即使偶尔
      // 因带宽抖动断开也不影响主体显示。
      capabilities: {
        supportsCostmap: true,
        supportsLocalizationHealth: true
      },
      display: {
        showGlobalCostmap: true,
        showLocalCostmap: true
      }
    },
    discoveryCandidates: {
      pointCloud: ['/points2', '/cloud_registered', '/livox/lidar'],
      pose: ['/hdl_localization/odom', '/odom'],
      map: ['/map'],
      globalPlan: ['/plan', '/path'],
      localPlan: ['/local_plan'],
      lookaheadPoint: ['/lookahead_point'],
      localizationHealth: ['/localization_health'],
      globalCostmap: ['/global_costmap/costmap'],
      localCostmap: ['/local_costmap/costmap']
    }
  },
  {
    id: 'nav2-amcl-standard',
    name: 'Nav2 AMCL 标准机器人',
    deploymentProfileId: 'nav2-amcl',
    description: '针对 AMCL + 2D 地图导航链路的预设。',
    defaults: {
      topics: {
        pose: '/amcl_pose',
        map: '/map',
        globalPlan: '/plan',
        localPlan: '/local_plan'
      }
    },
    discoveryCandidates: {
      pointCloud: ['/points2', '/scan'],
      pose: ['/amcl_pose', '/odom'],
      map: ['/map'],
      globalPlan: ['/plan', '/path'],
      localPlan: ['/local_plan'],
      lookaheadPoint: ['/lookahead_point'],
      localizationHealth: ['/localization_health'],
      globalCostmap: ['/global_costmap/costmap'],
      localCostmap: ['/local_costmap/costmap']
    }
  }
]

export function getRobotPreset(presetId) {
  return ROBOT_PRESETS.find((preset) => preset.id === presetId) || ROBOT_PRESETS[0]
}
