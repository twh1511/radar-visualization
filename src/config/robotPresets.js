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
    name: 'IIRI 集群机器人',
    deploymentProfileId: 'iiri-cluster-hdl',
    description: '针对 IIRI 集群 HDL 实机导航链路的预设。',
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
      // 该实机链路确实发布全局/局部代价地图，预设里直接开启订阅与显示，
      // 避免依赖部署档案而漏订阅（订阅受 capabilities.supportsCostmap 门控）。
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
