# 详细安装和配置指南

## 目录

1. [机器人端配置](#机器人端配置)
2. [本地端配置](#本地端配置)
3. [话题映射](#话题映射)
4. [性能调优](#性能调优)
5. [常见问题](#常见问题)

---

## 机器人端配置

### 1. 安装 rosbridge_suite

在机器人 (192.168.1.247) 上执行：

```bash
ssh wl@192.168.1.247
# 密码: 123456

sudo apt update
sudo apt install ros-humble-rosbridge-suite
```

### 2. 启动 rosbridge WebSocket 服务器

```bash
source /opt/ros/humble/setup.bash
ros2 launch rosbridge_server rosbridge_websocket_launch.xml
```

**可选：修改端口**

如果需要使用非默认端口，创建自定义 launch 文件：

```bash
cd ~
mkdir -p ros2_ws/src
cd ros2_ws/src
```

创建 `custom_rosbridge.launch.xml`：

```xml
<launch>
  <node pkg="rosbridge_server" exec="rosbridge_websocket" name="rosbridge_websocket">
    <param name="port" value="9090"/>
    <param name="address" value="0.0.0.0"/>
  </node>
</launch>
```

启动：

```bash
ros2 launch custom_rosbridge.launch.xml
```

### 3. 启动定位系统

根据原始代码库，启动 HDL 定位：

```bash
cd ~/iiri-intelligence-layer
source setup.bash
ros2 launch hdl_localization hdl_localization_real.launch.py
```

### 4. 验证话题发布

检查所需话题是否正在发布：

```bash
# 检查点云
ros2 topic hz /livox/lidar

# 检查位姿（如果有）
ros2 topic list | grep pose

# 检查地图
ros2 topic list | grep map
```

---

## 本地端配置

### 1. 安装 Node.js

如果尚未安装，下载并安装 Node.js 18+：

https://nodejs.org/

### 2. 克隆/下载项目

项目位于：`C:\Users\zyl\Desktop\code\radar-visualization`

### 3. 安装依赖

```bash
cd C:\Users\zyl\Desktop\code\radar-visualization
npm install
```

### 4. 配置连接参数

编辑 `src/config.js`：

```javascript
export const ROS_CONFIG = {
  host: '192.168.1.247',  // 修改为你的机器人 IP
  port: 9090,             // rosbridge 端口
  // ...
}
```

### 5. 启动开发服务器

```bash
npm run dev
```

或使用快速启动脚本（Windows）：

```bash
scripts\quick-start.bat
```

浏览器自动打开 `http://localhost:3000`

---

## 话题映射

### 当前默认话题

| 功能 | 话题名称 | 消息类型 |
|------|---------|----------|
| 点云 | `/livox/lidar` | `sensor_msgs/PointCloud2` |
| 位姿 | `/robot_pose` | `geometry_msgs/PoseStamped` |
| 地图 | `/map` | `nav_msgs/OccupancyGrid` |

### 修改话题名称

如果你的机器人使用不同的话题名称，编辑 `src/config.js`：

```javascript
topics: {
  pointCloud: {
    name: '/your/custom/lidar/topic',  // 修改这里
    messageType: 'sensor_msgs/PointCloud2',
    throttleRate: 100
  },
  // ...
}
```

### 常见话题名称

**点云：**
- `/livox/lidar`
- `/velodyne_points`
- `/scan`
- `/cloud`

**位姿：**
- `/robot_pose`
- `/amcl_pose`
- `/odom`
- `/hdl_localization/pose`

**地图：**
- `/map`
- `/global_costmap/costmap`

---

## 性能调优

### 1. 点云降采样

编辑 `src/config.js`：

```javascript
performance: {
  pointCloudDownsample: 5,  // 增大此值以提高性能（降低质量）
  // 1 = 无降采样（最高质量，最低性能）
  // 5 = 默认（平衡）
  // 10 = 高性能（较低质量）
}
```

### 2. 订阅频率

```javascript
topics: {
  pointCloud: {
    throttleRate: 100,  // 毫秒，增大以降低频率
    // 100ms = 10Hz
    // 200ms = 5Hz（更流畅）
  }
}
```

### 3. 点云点大小

```javascript
visualization: {
  pointSize: 0.05,  // 减小以提高性能
}
```

### 4. 浏览器性能

- 使用 Chrome 或 Edge（WebGL 性能最佳）
- 关闭不必要的浏览器扩展
- 启用硬件加速：
  - Chrome: `chrome://settings/` → 系统 → 使用硬件加速

---

## 常见问题

### Q1: 无法连接到机器人

**检查清单：**

1. 网络连接：
   ```bash
   ping 192.168.1.247
   ```

2. rosbridge 是否运行：
   ```bash
   ssh wl@192.168.1.247
   ros2 node list | grep rosbridge
   ```

3. 防火墙设置（机器人端）：
   ```bash
   sudo ufw allow 9090/tcp
   ```

4. 浏览器控制台错误信息

### Q2: 点云不显示

**检查清单：**

1. 话题是否发布：
   ```bash
   ros2 topic echo /livox/lidar --once
   ```

2. 话题名称是否正确（检查 `src/config.js`）

3. 浏览器控制台是否有解析错误

4. 点云数据格式是否为 PointCloud2

### Q3: 机器人位姿不更新

**可能原因：**

1. `/robot_pose` 话题不存在
   - 检查可用话题：`ros2 topic list | grep pose`
   - 修改 `src/config.js` 中的话题名称

2. 定位系统未启动
   - 启动 HDL 定位或 AMCL

3. TF 树问题
   - 检查 TF 树：`ros2 run tf2_tools view_frames`

### Q4: 地图不显示

**检查：**

1. 地图是否发布：
   ```bash
   ros2 topic echo /map --once
   ```

2. 地图是否已生成（SLAM 需要时间建图）

3. 地图分辨率是否过高（导致渲染慢）

### Q5: 性能卡顿

**优化步骤：**

1. 增加点云降采样率（`pointCloudDownsample: 10`）
2. 降低订阅频率（`throttleRate: 200`）
3. 减小点大小（`pointSize: 0.03`）
4. 关闭性能统计（点击界面上的按钮）
5. 使用性能更好的显卡

### Q6: WebSocket 连接频繁断开

**解决方案：**

1. 检查网络稳定性
2. 增加 rosbridge 的缓冲区大小：
   ```xml
   <param name="max_message_size" value="10000000"/>
   ```
3. 降低数据传输频率

---

## 高级配置

### 使用 TF 变换

如果需要从 TF 树获取机器人位姿：

```javascript
// 在 rosStore.js 中添加 TF 监听器
const tfClient = new ROSLIB.TFClient({
  ros: ros,
  fixedFrame: 'map',
  angularThres: 0.01,
  transThres: 0.01,
  rate: 10.0
})

tfClient.subscribe('base_link', (tf) => {
  set({
    robotPose: {
      x: tf.translation.x,
      y: tf.translation.y,
      z: tf.translation.z,
      qx: tf.rotation.x,
      qy: tf.rotation.y,
      qz: tf.rotation.z,
      qw: tf.rotation.w
    }
  })
})
```

### 添加路径显示

订阅 `/path` 话题并在 Three.js 中绘制线条。

### 添加目标点标记

订阅 `/goal_pose` 并显示目标位置。

---

## 技术支持

如遇到问题，请检查：

1. 浏览器控制台（F12）
2. rosbridge 日志
3. ROS 话题列表和数据

提供以上信息以便快速诊断问题。
