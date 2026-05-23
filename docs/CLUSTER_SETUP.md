# 🎯 iiri-ros 集群环境完整说明

## 集群架构

机器狗 (192.168.1.247) 上运行 `iiri-ros.service` 服务，自动启动：
- **fast_lio** - LiDAR-Inertial Odometry SLAM
- **hdl_localization** - 全局定位
- **nav2** - 导航栈（global/local costmap, planner, controller）
- **motion_control** - 运动控制
- **xiaozhi** - 语音交互

## DDS 配置

集群使用 **FastDDS Discovery Server** 模式：

```bash
ROS_DOMAIN_ID=219
ROS_LOCALHOST_ONLY=0
RMW_IMPLEMENTATION=rmw_fastrtps_cpp
ROS_DISCOVERY_SERVER=192.168.1.247:11811
ROS_SUPER_CLIENT=FALSE
FASTDDS_BUILTIN_TRANSPORTS=DEFAULT
FASTRTPS_DEFAULT_PROFILES_FILE=/home/wl/autorun/iiri-ros/fastdds_node_profile.xml
```

配置文件位置：`/home/wl/autorun/iiri-ros/ros.env`

## 重要：rosbridge 必须使用 SUPER_CLIENT=TRUE

普通客户端（SUPER_CLIENT=FALSE）只能看到自己显式订阅的话题。rosbridge 作为转发服务，需要 `SUPER_CLIENT=TRUE` 才能看到集群所有话题。

## 主要话题列表

### 点云 / LiDAR
| 话题 | 类型 | 说明 |
|------|------|------|
| `/livox/lidar` | PointCloud2 | Livox MID-360 原始点云 |
| `/livox/imu` | Imu | IMU 数据 |
| `/cloud_registered` | PointCloud2 | FAST-LIO 配准后点云 ⭐ |
| `/cloud_registered_body` | PointCloud2 | 机体坐标系下的配准点云 |
| `/cloud_effected` | PointCloud2 | 有效点云 |
| `/aligned_points` | PointCloud2 | 对齐点云 |
| `/Laser_map` | PointCloud2 | 激光地图 |
| `/scan` | LaserScan | 2D 激光扫描 |
| `/points2` | PointCloud2 | 重映射的点云 |

### 位姿 / 定位
| 话题 | 类型 | 说明 |
|------|------|------|
| `/hdl_localization/odom` | Odometry | HDL 定位输出 ⭐ |
| `/odom` | Odometry | 标准里程计 |
| `/initialpose` | PoseWithCovarianceStamped | 初始位姿（输入）|
| `/localization_health` | - | 定位健康状态 |

### 地图
| 话题 | 类型 | 说明 |
|------|------|------|
| `/map` | OccupancyGrid | 全局栅格地图 ⭐ |
| `/global_costmap/costmap` | OccupancyGrid | 全局代价地图 |
| `/local_costmap/costmap` | OccupancyGrid | 局部代价地图 |
| `/bbs/gridmap` | OccupancyGrid | BBS 栅格地图 |

### TF
| 话题 | 类型 |
|------|------|
| `/tf` | TFMessage |
| `/tf_static` | TFMessage |

### 导航
| 话题 | 类型 | 说明 |
|------|------|------|
| `/goal_pose` | PoseStamped | 目标点（输入）|
| `/plan` | Path | 全局路径 |
| `/path` | Path | 路径 |
| `/local_plan` | Path | 局部路径 |
| `/cmd_vel` | Twist | 速度指令 |

## 启动 rosbridge

### 方法 1：使用集群启动脚本（推荐）

```bash
# 复制到机器人
scp scripts/start-rosbridge-cluster.sh wl@192.168.1.247:/tmp/

# 执行
ssh wl@192.168.1.247
chmod +x /tmp/start-rosbridge-cluster.sh
/tmp/start-rosbridge-cluster.sh
```

### 方法 2：手动启动

```bash
ssh wl@192.168.1.247

# 加载集群环境
source /home/wl/autorun/iiri-ros/ros.env
export ROS_SUPER_CLIENT=TRUE  # 关键！

# 安装（首次）
sudo apt install ros-humble-rosbridge-suite

# 启动
source /opt/ros/humble/setup.bash
ros2 launch rosbridge_server rosbridge_websocket_launch.xml
```

## 验证 rosbridge 工作

在机器人上另开一个终端：

```bash
source /opt/ros/humble/setup.bash
source /home/wl/autorun/iiri-ros/ros.env
export ROS_SUPER_CLIENT=TRUE

# 启动 daemon
ros2 daemon stop && ros2 daemon start
sleep 3

# 应该看到 90+ 话题
ros2 topic list | wc -l

# 检查 rosbridge 节点
ros2 node list | grep rosbridge
```

## 常见问题

### Q: rosbridge 启动了但客户端看不到话题

**原因：** `ROS_SUPER_CLIENT` 没设为 `TRUE`

**解决：** 启动 rosbridge 前必须 `export ROS_SUPER_CLIENT=TRUE`

### Q: 启动后只看到 /parameter_events 和 /rosout

**原因：** 没有连接到 Discovery Server

**解决：** 检查环境变量：
```bash
echo $ROS_DISCOVERY_SERVER  # 应该是 192.168.1.247:11811
echo $ROS_DOMAIN_ID          # 应该是 219
```

### Q: 怎么知道 iiri-ros 服务是否在运行？

```bash
systemctl status iiri-ros
# active (running) 表示正常
```

## 客户端推荐话题配置

```javascript
{
  pointCloud: '/cloud_registered',      // 配准后的点云，更稳定
  pose: '/hdl_localization/odom',       // HDL 定位输出
  map: '/map'                           // 全局地图
}
```
