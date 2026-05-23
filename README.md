# ROS2 机器人可视化客户端

通用的 Web 版 ROS2 机器人可视化工具，类似 RViz，支持多机器人管理。

![](https://img.shields.io/badge/ROS2-Humble-blue) ![](https://img.shields.io/badge/React-18-61dafb) ![](https://img.shields.io/badge/Three.js-0.160-black)

## 特性

- ✅ **多机器人管理** - 保存和快速切换多个机器人配置
- ✅ **实时点云** - 支持 PointCloud2，可降采样、按高度着色
- ✅ **机器人位姿** - 3D 模型显示，支持多种消息类型
- ✅ **地图显示** - OccupancyGrid 栅格地图
- ✅ **话题监控** - 实时显示话题接收频率
- ✅ **灵活配置** - 话题名称、性能参数可调
- ✅ **流畅交互** - 基于 Three.js 的硬件加速渲染

## 快速开始

### 1. 机器人端（192.168.1.247）

**安装并启动 rosbridge：**

```bash
ssh wl@192.168.1.247  # 密码: 123456

# 安装 rosbridge（首次）
sudo apt install ros-humble-rosbridge-suite

# 启动 rosbridge
source /opt/ros/humble/setup.bash
ros2 launch rosbridge_server rosbridge_websocket_launch.xml
```

详细步骤见 [ROSBRIDGE_SETUP.md](docs/ROSBRIDGE_SETUP.md)

### 2. 客户端（Windows）

```bash
cd C:\Users\zyl\Desktop\code\radar-visualization
npm install
npm run dev
```

或双击 `scripts\quick-start.bat`

### 3. 连接

浏览器打开 `http://localhost:5173`，输入机器人 IP 和端口，点击连接。

## 使用说明

详见 [用户手册](docs/USER_GUIDE.md)

### 界面操作

- **☰** - 切换机器人
- **⚙** - 打开设置
- **鼠标左键** - 旋转视角
- **鼠标右键** - 平移
- **滚轮** - 缩放

### 默认话题

根据 `iiri-intelligence-layer` 代码库配置：

| 功能 | 话题 | 类型 |
|------|------|------|
| 点云 | `/livox/lidar` | `sensor_msgs/PointCloud2` |
| 位姿 | `/Odometry` | `nav_msgs/Odometry` |
| 地图 | `/map` | `nav_msgs/OccupancyGrid` |

可在设置面板中修改。

## 常见问题

**无法连接？**
1. 检查 rosbridge 是否运行：`ros2 node list | grep rosbridge`
2. 检查网络：`ping 192.168.1.247`
3. 检查防火墙：`sudo ufw allow 9090/tcp`

**点云不显示？**
1. 检查话题：`ros2 topic hz /livox/lidar`
2. 查看右下角话题监控是否有数据
3. 在设置中确认话题名称正确

**性能卡顿？**
1. 增加点云降采样（设置 → 性能 → 降采样 = 10）
2. 降低接收频率（设置 → 性能 → 点云接收频率 = 200ms）
3. 关闭 FPS 显示

## 技术栈

- **前端**: React 18 + Vite
- **3D 渲染**: Three.js + @react-three/fiber
- **ROS 通信**: roslib.js (WebSocket)
- **状态管理**: Zustand

## 项目结构

```
src/
├── components/       # UI 组件
│   ├── ConnectionManager.jsx
│   ├── SettingsPanel.jsx
│   ├── PointCloud.jsx
│   └── ...
├── store/           # 状态管理
│   ├── appStore.js  # 应用配置
│   └── rosStore.js  # ROS 连接
└── App.jsx          # 主应用
```

## 开发

```bash
# 开发模式
npm run dev

# 构建
npm run build

# 预览构建
npm run preview
```

## 许可证

MIT
