// ROS 连接配置
export const ROS_CONFIG = {
  // 机器人 IP 地址
  host: '192.168.1.247',

  // rosbridge WebSocket 端口
  port: 9090,

  // 自动重连
  autoReconnect: true,
  reconnectInterval: 3000, // 毫秒

  // 话题订阅配置
  topics: {
    pointCloud: {
      name: '/livox/lidar',
      messageType: 'sensor_msgs/PointCloud2',
      throttleRate: 100 // 毫秒 (10Hz)
    },
    robotPose: {
      name: '/robot_pose',
      messageType: 'geometry_msgs/PoseStamped',
      throttleRate: 50 // 毫秒 (20Hz)
    },
    map: {
      name: '/map',
      messageType: 'nav_msgs/OccupancyGrid'
    }
  },

  // 性能优化配置
  performance: {
    // 点云降采样率 (每 N 个点取 1 个)
    pointCloudDownsample: 5,

    // 最大点云点数
    maxPointCloudPoints: 100000,

    // 渲染帧率限制
    targetFPS: 60
  },

  // 可视化配置
  visualization: {
    // 点云点大小
    pointSize: 0.05,

    // 机器人模型大小
    robotScale: 1.0,

    // 网格大小
    gridSize: 100,
    gridDivisions: 100
  }
}
