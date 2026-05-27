export const DEFAULT_SETTINGS = {
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
    downsample: 5,
    pointCloudThrottle: 100,
    poseThrottle: 50,
    pointSize: 0.05,
    renderProfile: 'balanced',
    // 点云走 CBOR 二进制传输：rosbridge 端无需把巨大的字节数组做 JSON+base64
    // 序列化（单线程，会把 CPU 打满进而导致 ping 超时断连）。'none' 退回 JSON。
    pointCloudCompression: 'cbor'
  },
  display: {
    showGrid: true,
    showAxes: true,
    showFPS: false,
    showTopicMonitor: true,
    colorByHeight: true,
    showGlobalPlan: true,
    showLocalPlan: true,
    showGlobalCostmap: false,
    showLocalCostmap: false,
    showNavigationControls: true
  }
}
