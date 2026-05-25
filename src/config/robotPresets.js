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
        pointCloud: '/cloud_registered',
        pose: '/hdl_localization/odom',
        map: '/map',
        globalPlan: '/plan',
        localPlan: '/local_plan',
        localizationHealth: '/localization_health'
      }
    },
    discoveryCandidates: {
      pointCloud: ['/cloud_registered', '/points2', '/livox/lidar'],
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
