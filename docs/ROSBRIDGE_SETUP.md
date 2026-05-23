# 在 192.168.1.247 上安装并启动 rosbridge

## 方法 1：使用脚本（推荐）

将脚本复制到机器人上并执行：

```bash
# 在你的 Windows 电脑上
scp C:\Users\zyl\Desktop\code\radar-visualization\scripts\setup-rosbridge.sh wl@192.168.1.247:/tmp/

# SSH 到机器人
ssh wl@192.168.1.247
# 密码: 123456

# 执行脚本
chmod +x /tmp/setup-rosbridge.sh
/tmp/setup-rosbridge.sh
```

## 方法 2：手动执行

SSH 到机器人后，逐条执行：

```bash
# 1. 设置 ROS 环境
source /opt/ros/humble/setup.bash

# 2. 安装 rosbridge（如果还没装）
sudo apt update
sudo apt install ros-humble-rosbridge-suite

# 3. 启动 rosbridge
ros2 launch rosbridge_server rosbridge_websocket_launch.xml
```

看到以下输出表示成功：
```
[INFO] [rosbridge_websocket]: Rosbridge WebSocket server started on port 9090
```

## 已配置的话题

根据代码库分析，客户端已配置以下话题：

| 功能 | 话题名称 | 消息类型 |
|------|---------|----------|
| 点云 | `/livox/lidar` | `sensor_msgs/PointCloud2` |
| 位姿 | `/Odometry` | `nav_msgs/Odometry` |
| 地图 | `/map` | `nav_msgs/OccupancyGrid` |

这些话题来自于：
- `hdl_localization_real_demo.launch.py` - 点云话题 `livox/lidar`
- HDL 定位节点发布 `/Odometry` 话题
- 地图通常发布到 `/map`

## 验证话题

在机器人上运行以下命令验证话题是否发布：

```bash
# 查看所有话题
ros2 topic list

# 查看点云话题
ros2 topic hz /livox/lidar

# 查看位姿话题
ros2 topic hz /Odometry

# 查看地图话题
ros2 topic info /map
```

## 如果话题名称不同

如果你的机器人使用不同的话题名称，可以在客户端设置面板中修改：

1. 打开浏览器 `http://localhost:3000`
2. 点击右上角 ⚙ 图标
3. 在"话题配置"部分修改话题名称
4. 点击"应用并重订阅"

## 常见话题名称参考

**位姿话题可能的名称：**
- `/Odometry`
- `/odom`
- `/odometry/filtered`
- `/current_pose`
- `/amcl_pose`
- `/robot_pose`

**点云话题可能的名称：**
- `/livox/lidar`
- `/velodyne_points`
- `/scan`
- `/cloud`
- `/points`

**地图话题：**
- `/map` (标准)
