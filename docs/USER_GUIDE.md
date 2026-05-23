# ROS2 机器人可视化客户端 - 快速开始

## 项目概述

这是一个通用的 Web 版 ROS2 机器人可视化客户端，类似 RViz，但运行在浏览器中。支持：
- ✅ 多机器人配置管理（保存/切换）
- ✅ 实时点云可视化（支持降采样、按高度着色）
- ✅ 机器人位姿显示（3D 模型 + 坐标轴）
- ✅ 地图显示（OccupancyGrid）
- ✅ 话题监控（实时频率显示）
- ✅ 可配置话题名称和性能参数
- ✅ 流畅的 3D 交互（旋转、缩放、平移）

## 启动步骤

### 1. 在机器人端启动 rosbridge

SSH 登录到你的机器人（例如 192.168.1.247）：

```bash
ssh wl@192.168.1.247  # 密码: 123456
```

**首次使用需要安装 rosbridge：**
```bash
sudo apt install ros-humble-rosbridge-suite
```

**启动 rosbridge WebSocket 服务器：**
```bash
source /opt/ros/humble/setup.bash
ros2 launch rosbridge_server rosbridge_websocket_launch.xml
```

看到 `Rosbridge WebSocket server started on port 9090` 表示成功。

### 2. 启动可视化客户端

在 Windows 上，双击运行：
```
C:\Users\zyl\Desktop\code\radar-visualization\scripts\quick-start.bat
```

或手动启动：
```bash
cd C:\Users\zyl\Desktop\code\radar-visualization
npm run dev
```

浏览器会自动打开 `http://localhost:5173`

### 3. 连接到机器人

首次使用会显示连接管理界面：

1. **输入连接信息：**
   - 名称：`机器狗 Alpha`（可选，方便识别）
   - IP 地址：`192.168.1.247`
   - 端口：`9090`

2. **点击「连接」**

3. 连接成功后，会自动进入 3D 可视化界面

## 界面说明

### 顶部工具栏
- **☰** - 打开连接管理（切换机器人）
- **机器人名称** - 当前连接的机器人
- **状态指示灯** - 绿色=已连接，黄色=连接中，红色=断开
- **断开** - 断开当前连接
- **⚙** - 打开设置面板

### 3D 视图操作
- **鼠标左键拖拽** - 旋转视角
- **鼠标右键拖拽** - 平移视角
- **滚轮** - 缩放

### 右下角话题监控
显示各话题的实时接收频率（Hz）：
- 绿色圆点 = 正常接收
- 灰色圆点 = 超过 2 秒未收到数据

### 设置面板（点击 ⚙ 打开）

**话题配置：**
- 点云话题：默认 `/livox/lidar`
- 位姿话题：默认 `/current_pose`
- 地图话题：默认 `/map`
- 可根据你的机器人实际话题名称修改

**性能调优：**
- 点云降采样：1-20（数值越大性能越好，但点云越稀疏）
- 点云接收频率：50-500ms（数值越大频率越低，越流畅）
- 点大小：0.01-0.3（调整点云点的显示大小）

**显示选项：**
- 显示网格
- 显示坐标轴
- 显示 FPS
- 话题监控面板
- 按高度着色点云（彩色渐变 vs 单色）

修改后点击「应用并重订阅」生效。

## 管理多个机器人

### 添加新机器人
1. 点击左上角 **☰** 打开连接管理
2. 点击「+ 新建连接」
3. 输入新机器人的信息
4. 点击「保存配置」
5. 点击「连接」

### 切换机器人
1. 点击左上角 **☰**
2. 在左侧列表中选择要连接的机器人
3. 点击「连接」

### 删除机器人配置
1. 点击左上角 **☰**
2. 在机器人列表中点击右上角的 **×**

## 常见问题

### Q: 无法连接到机器人

**检查清单：**
1. 机器人端 rosbridge 是否正在运行？
   ```bash
   ros2 node list | grep rosbridge
   ```
2. 网络是否连通？
   ```bash
   ping 192.168.1.247
   ```
3. 防火墙是否阻止了 9090 端口？
   ```bash
   sudo ufw allow 9090/tcp
   ```

### Q: 点云不显示

1. 检查话题是否发布：
   ```bash
   ros2 topic hz /livox/lidar
   ```
2. 话题名称是否正确？打开设置面板检查
3. 查看右下角话题监控，是否有数据接收

### Q: 位姿不更新

1. 检查位姿话题是否存在：
   ```bash
   ros2 topic list | grep pose
   ```
2. 常见位姿话题名称：
   - `/current_pose`
   - `/amcl_pose`
   - `/robot_pose`
   - `/odom`
   - `/localization_pose`
3. 在设置面板中修改为正确的话题名称

### Q: 性能卡顿

**优化建议：**
1. 增加点云降采样（设置为 10 或更高）
2. 降低点云接收频率（设置为 200ms 或更高）
3. 减小点大小（设置为 0.03）
4. 关闭 FPS 显示
5. 使用性能更好的显卡
6. 关闭浏览器其他标签页

### Q: 地图不显示

1. 检查地图是否已发布：
   ```bash
   ros2 topic echo /map --once
   ```
2. SLAM 建图需要时间，等待机器人移动建图
3. 检查地图话题名称是否正确

## 技术细节

### 订阅的话题类型

| 话题 | 默认名称 | 消息类型 |
|------|---------|----------|
| 点云 | `/livox/lidar` | `sensor_msgs/PointCloud2` |
| 位姿 | `/current_pose` | `geometry_msgs/PoseStamped` |
| 地图 | `/map` | `nav_msgs/OccupancyGrid` |

### 支持的位姿消息类型
- `geometry_msgs/PoseStamped`
- `geometry_msgs/PoseWithCovarianceStamped`
- `nav_msgs/Odometry`

### 数据持久化

所有配置保存在浏览器 localStorage 中：
- 机器人列表
- 上次连接的机器人
- 话题配置
- 性能设置
- 显示选项

清除浏览器数据会重置所有配置。

## 项目结构

```
radar-visualization/
├── src/
│   ├── components/
│   │   ├── ConnectionManager.jsx  # 连接管理界面
│   │   ├── TopBar.jsx             # 顶部工具栏
│   │   ├── SettingsPanel.jsx     # 设置面板
│   │   ├── TopicMonitor.jsx      # 话题监控
│   │   ├── PointCloud.jsx        # 点云渲染
│   │   ├── RobotPose.jsx         # 机器人位姿
│   │   └── MapDisplay.jsx        # 地图显示
│   ├── store/
│   │   ├── appStore.js           # 应用状态（机器人列表、设置）
│   │   └── rosStore.js           # ROS 连接和数据
│   ├── App.jsx                   # 主应用
│   └── main.jsx                  # 入口
├── scripts/
│   └── quick-start.bat           # Windows 快速启动
├── package.json
└── README.md
```

## 开发说明

### 修改话题订阅

编辑 `src/store/rosStore.js` 中的 `subscribeTopics` 函数。

### 添加新的可视化组件

1. 在 `src/components/` 创建新组件
2. 在 `src/App.jsx` 中导入并添加到 Canvas
3. 在 `rosStore.js` 中订阅相应话题

### 调试

打开浏览器开发者工具（F12）：
- Console 标签：查看连接日志和错误
- Network 标签：查看 WebSocket 连接状态

## 许可证

MIT

---

**技术支持：** 如有问题，请检查浏览器控制台（F12）和 rosbridge 日志。
