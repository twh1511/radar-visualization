export const DEPLOYMENT_PROFILES = [
  {
    id: 'generic-rosbridge',
    name: '通用 rosbridge',
    environment: 'real',
    localizationMode: 'odom',
    description: '最基础的 rosbridge 接入，适合未知或开发中的机器人。',
    network: {
      bridgeMode: 'rosbridge',
      rosbridgePath: '',
      requiresSuperClient: false,
      requiresDiscoveryServer: false
    },
    defaults: {
      topics: {
        pointCloud: '/points2',
        pointCloudType: 'sensor_msgs/msg/PointCloud2',
        pose: '/odom',
        poseType: 'nav_msgs/msg/Odometry',
        map: '/map',
        mapType: 'nav_msgs/msg/OccupancyGrid',
        globalPlan: '/plan',
        globalPlanType: 'nav_msgs/msg/Path',
        localPlan: '/local_plan',
        localPlanType: 'nav_msgs/msg/Path',
        lookaheadPoint: '/lookahead_point',
        lookaheadPointType: 'geometry_msgs/msg/PointStamped',
        localizationHealth: '/localization_health',
        localizationHealthType: 'std_msgs/msg/String',
        globalCostmap: '/global_costmap/costmap',
        globalCostmapType: 'nav_msgs/msg/OccupancyGrid',
        localCostmap: '/local_costmap/costmap',
        localCostmapType: 'nav_msgs/msg/OccupancyGrid'
      },
      actions: {
        navigateToPose: '/navigate_to_pose'
      },
      services: {
        getMap: ['/map_server/map', '/static_map', '/map', '/slam_toolbox/dynamic_map', '/dynamic_map'],
        clearGlobalCostmap: '/global_costmap/clear_entirely_global_costmap',
        clearLocalCostmap: '/local_costmap/clear_entirely_local_costmap',
        relocalize: '/relocalize'
      },
      frames: {
        targetFrame: 'map',
        map: 'map',
        odom: 'odom',
        base: 'base_link'
      },
      capabilities: {
        supportsMap: true,
        supportsTf: true,
        supportsNavigateToPose: true,
        supportsPlans: true,
        supportsLocalizationHealth: false,
        supportsCostmap: false,
        supportsCovariance: false
      },
      performance: {
        renderProfile: 'balanced',
        downsample: 5,
        pointCloudThrottle: 100,
        poseThrottle: 50,
        pointSize: 0.05
      },
      display: {
        showGlobalPlan: true,
        showLocalPlan: true,
        showGlobalCostmap: false,
        showLocalCostmap: false,
        showNavigationControls: true
      }
    }
  },
  {
    id: 'iiri-cluster-hdl',
    name: 'IIRI 集群 HDL',
    environment: 'real',
    localizationMode: 'hdl',
    description: 'FastDDS Discovery Server + rosbridge Super Client 的实机集群环境。',
    network: {
      bridgeMode: 'rosbridge',
      rosbridgePath: '',
      requiresSuperClient: true,
      requiresDiscoveryServer: true,
      discoveryServer: '192.168.1.247:11811',
      rosDomainId: 219
    },
    defaults: {
      topics: {
        pointCloud: '/cloud_registered',
        pointCloudType: 'sensor_msgs/msg/PointCloud2',
        pose: '/hdl_localization/odom',
        poseType: 'nav_msgs/msg/Odometry',
        map: '/map',
        mapType: 'nav_msgs/msg/OccupancyGrid',
        globalPlan: '/plan',
        globalPlanType: 'nav_msgs/msg/Path',
        localPlan: '/local_plan',
        localPlanType: 'nav_msgs/msg/Path',
        lookaheadPoint: '/lookahead_point',
        lookaheadPointType: 'geometry_msgs/msg/PointStamped',
        localizationHealth: '/localization_health',
        localizationHealthType: 'std_msgs/msg/String',
        globalCostmap: '/global_costmap/costmap',
        globalCostmapType: 'nav_msgs/msg/OccupancyGrid',
        localCostmap: '/local_costmap/costmap',
        localCostmapType: 'nav_msgs/msg/OccupancyGrid'
      },
      actions: {
        navigateToPose: '/navigate_to_pose'
      },
      services: {
        getMap: ['/map_server/map', '/static_map', '/map'],
        clearGlobalCostmap: '/global_costmap/clear_entirely_global_costmap',
        clearLocalCostmap: '/local_costmap/clear_entirely_local_costmap',
        relocalize: '/relocalize'
      },
      frames: {
        targetFrame: 'map',
        map: 'map',
        odom: 'odom',
        base: 'base_link'
      },
      capabilities: {
        supportsMap: true,
        supportsTf: true,
        supportsNavigateToPose: true,
        supportsPlans: true,
        supportsLocalizationHealth: true,
        supportsCostmap: true,
        supportsCovariance: false
      },
      performance: {
        renderProfile: 'balanced',
        downsample: 4,
        pointCloudThrottle: 100,
        poseThrottle: 50,
        pointSize: 0.045
      },
      display: {
        showGlobalPlan: true,
        showLocalPlan: true,
        showGlobalCostmap: true,
        showLocalCostmap: true,
        showNavigationControls: true
      }
    }
  },
  {
    id: 'nav2-amcl',
    name: 'Nav2 AMCL',
    environment: 'sim',
    localizationMode: 'amcl',
    description: '适合 2D 地图 / AMCL 的导航环境。',
    network: {
      bridgeMode: 'rosbridge',
      rosbridgePath: '',
      requiresSuperClient: false,
      requiresDiscoveryServer: false
    },
    defaults: {
      topics: {
        pointCloud: '/points2',
        pointCloudType: 'sensor_msgs/msg/PointCloud2',
        pose: '/amcl_pose',
        poseType: 'geometry_msgs/msg/PoseWithCovarianceStamped',
        map: '/map',
        mapType: 'nav_msgs/msg/OccupancyGrid',
        globalPlan: '/plan',
        globalPlanType: 'nav_msgs/msg/Path',
        localPlan: '/local_plan',
        localPlanType: 'nav_msgs/msg/Path',
        lookaheadPoint: '/lookahead_point',
        lookaheadPointType: 'geometry_msgs/msg/PointStamped',
        localizationHealth: '/localization_health',
        localizationHealthType: 'std_msgs/msg/String',
        globalCostmap: '/global_costmap/costmap',
        globalCostmapType: 'nav_msgs/msg/OccupancyGrid',
        localCostmap: '/local_costmap/costmap',
        localCostmapType: 'nav_msgs/msg/OccupancyGrid'
      },
      actions: {
        navigateToPose: '/navigate_to_pose'
      },
      services: {
        getMap: ['/map_server/map', '/static_map', '/map', '/slam_toolbox/dynamic_map'],
        clearGlobalCostmap: '/global_costmap/clear_entirely_global_costmap',
        clearLocalCostmap: '/local_costmap/clear_entirely_local_costmap',
        relocalize: '/relocalize'
      },
      frames: {
        targetFrame: 'map',
        map: 'map',
        odom: 'odom',
        base: 'base_link'
      },
      capabilities: {
        supportsMap: true,
        supportsTf: true,
        supportsNavigateToPose: true,
        supportsPlans: true,
        supportsLocalizationHealth: false,
        supportsCostmap: true,
        supportsCovariance: true
      },
      performance: {
        renderProfile: 'balanced',
        downsample: 6,
        pointCloudThrottle: 120,
        poseThrottle: 80,
        pointSize: 0.05
      },
      display: {
        showGlobalPlan: true,
        showLocalPlan: true,
        showGlobalCostmap: true,
        showLocalCostmap: false,
        showNavigationControls: true
      }
    }
  }
]

export function getDeploymentProfile(profileId) {
  return DEPLOYMENT_PROFILES.find((profile) => profile.id === profileId) || DEPLOYMENT_PROFILES[0]
}
