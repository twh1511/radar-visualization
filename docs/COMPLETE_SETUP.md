# 🎯 完整启动指南

## 当前状态

根据实际检测，192.168.1.247 上：
- ✅ ROS2 Humble 已安装
- ❌ 导航系统未运行（需要启动）
- ❌ rosbridge 未安装（需要安装）

## 方案 A：一键启动脚本（推荐）

将脚本复制到机器人并执行：

```bash
# 在 Windows 上
scp C:\Users\zyl\Desktop\code\radar-visualization\scripts\start-all-services.sh wl@192.168.1.247:/tmp/

# SSH 到机器人
ssh wl@192.168.1.247
# 密码: 123456

# 执行脚本
chmod +x /tmp/start-all-services.sh
/tmp/start-all-services.sh
```

脚本会自动：
1. 安装 rosbridge（如果未安装）
2. 在 tmux 中启动导航系统
3. 在 tmux 中启动 rosbridge
4. 显示当前运行的话题

## 方案 B：手动启动（两个终端）

### 终端 1：启动导航系统

```bash
ssh wl@192.168.1.247
cd ~/iiri-intelligence-layer
source setup.bash
ros2 launch hdl_localization hdl_localization_real_demo.launch.py
```

**保持这个终端运行！**

### 终端 2：启动 rosbridge

```bash
ssh wl@192.168.1.247

# 安装 rosbridge（首次）
sudo apt install ros-humble-rosbridge-suite

# 启动 rosbridge
source /opt/ros/humble/setup.bash
ros2 launch rosbridge_server rosbridge_websocket_launch.xml
```

**保持这个终端运行！**

---

## 验证服务运行

在第三个终端检查：

```bash
ssh wl@192.168.1.247
source /opt/ros/humble/setup.bash

# 查看所有话题
ros2 topic list

# 应该看到：
# /livox/lidar
# /Odometry
# /map
# /tf
# /tf_static
# ... 等等

# 检查点云频率
ros2 topic hz /livox/lidar

# 检查位姿频率
ros2 topic hz /Odometry
```

---

## 启动客户端

服务都运行后，在 Windows 上：

```bash
cd C:\Users\zyl\Desktop\code\radar-visualization
npm run dev
```

或双击：`scripts\test-connection.bat`

浏览器打开 `http://localhost:3000`

---

## 预期话题

根据 `hdl_localization_real_demo.launch.py`，启动后应该有：

| 话题 | 类型 | 说明 |
|------|------|------|
| `/livox/lidar` | sensor_msgs/PointCloud2 | 雷达点云 |
| `/livox/imu` | sensor_msgs/Imu | IMU 数据 |
| `/Odometry` | nav_msgs/Odometry | 机器人位姿 |
| `/map` | nav_msgs/OccupancyGrid | 地图（如果已建图）|
| `/tf` | tf2_msgs/TFMessage | TF 变换树 |
| `/tf_static` | tf2_msgs/TFMessage | 静态 TF |

---

## 停止服务

### 如果使用 tmux（方案 A）

```bash
tmux kill-session -t ros_viz
```

### 如果手动启动（方案 B）

在每个终端按 `Ctrl+C`

---

## 故障排除

### 导航系统启动失败

**可能原因：**
- 地图文件不存在
- 传感器未连接

**解决：**
检查 launch 文件中的地图路径：
```python
# hdl_localization_real_demo.launch.py:74
{'global_map_name': "horizon_map-2025-06-03-21:06:33.pcd"}
```

确保该 PCD 文件存在于 `map/` 目录。

### rosbridge 连接失败

**检查端口：**
```bash
sudo netstat -tulpn | grep 9090
```

应该看到 rosbridge 监听 9090 端口。

**检查防火墙：**
```bash
sudo ufw allow 9090/tcp
```

---

## 下一步

启动成功后，查看 [QUICKSTART.md](../QUICKSTART.md) 了解客户端使用方法。
