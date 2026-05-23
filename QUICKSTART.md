# 🚀 快速启动指南

## 第一步：在机器人上启动 rosbridge

打开一个新的终端窗口，执行：

```bash
ssh wl@192.168.1.247
# 输入密码: 123456

# 安装 rosbridge（首次运行需要）
sudo apt install ros-humble-rosbridge-suite

# 启动 rosbridge
source /opt/ros/humble/setup.bash
ros2 launch rosbridge_server rosbridge_websocket_launch.xml
```

**看到以下输出表示成功：**
```
[INFO] [rosbridge_websocket]: Rosbridge WebSocket server started on port 9090
```

保持这个终端窗口运行！

---

## 第二步：启动可视化客户端

### 方式 A：使用测试脚本（推荐）

双击运行：
```
C:\Users\zyl\Desktop\code\radar-visualization\scripts\test-connection.bat
```

脚本会自动：
- ✓ 检查网络连接
- ✓ 检查 rosbridge 端口
- ✓ 安装依赖（如需要）
- ✓ 启动开发服务器

### 方式 B：手动启动

```bash
cd C:\Users\zyl\Desktop\code\radar-visualization
npm run dev
```

---

## 第三步：打开浏览器

浏览器会自动打开 `http://localhost:3000`

如果没有自动打开，手动访问该地址。

---

## 预期效果

✅ **连接成功后你应该看到：**

1. **顶部工具栏**
   - 左侧显示：`ROS2 可视化 | 机器狗 Alpha (192.168.1.247:9090)`
   - 绿色指示灯 + "已连接"

2. **3D 视图**
   - 网格地面
   - 彩色点云（雷达扫描数据）
   - 蓝色机器人模型 + 红色方向箭头
   - 灰度地图（如果已建图）

3. **右下角话题监控**
   - `/livox/lidar` - 绿色圆点 + Hz 数值
   - `/Odometry` - 绿色圆点 + Hz 数值
   - `/map` - 绿色圆点或灰色（静态）

---

## 常见问题

### ❌ 连接失败

**症状：** 红色指示灯，显示"连接失败"

**解决：**
1. 确认机器人端 rosbridge 正在运行
2. 检查网络：`ping 192.168.1.247`
3. 检查防火墙：`sudo ufw allow 9090/tcp`（在机器人上）

### ❌ 点云不显示

**症状：** 连接成功但看不到点云

**解决：**
1. 在机器人上检查：`ros2 topic hz /livox/lidar`
2. 查看右下角话题监控，`/livox/lidar` 是否有数据
3. 如果话题名称不同，点击 ⚙ → 话题配置 → 修改

### ❌ 位姿不更新

**症状：** 机器人模型不动

**解决：**
1. 在机器人上检查：`ros2 topic list | grep -i odom`
2. 常见位姿话题：`/Odometry`, `/odom`, `/odometry/filtered`
3. 在设置面板中修改位姿话题名称

### ❌ 性能卡顿

**解决：**
1. 点击 ⚙ → 性能
2. 增加"点云降采样"到 10
3. 增加"点云接收频率"到 200ms
4. 减小"点大小"到 0.03

---

## 操作说明

### 3D 视图控制

- **旋转视角**：鼠标左键拖拽
- **平移视角**：鼠标右键拖拽
- **缩放**：滚轮

### 切换机器人

1. 点击左上角 ☰
2. 选择或添加新机器人
3. 点击"连接"

### 调整设置

1. 点击右上角 ⚙
2. 修改话题配置、性能参数、显示选项
3. 点击"应用并重订阅"

---

## 已配置的话题

根据 `iiri-intelligence-layer` 代码库分析：

| 数据 | 话题名称 | 消息类型 |
|------|---------|----------|
| 雷达点云 | `/livox/lidar` | `sensor_msgs/PointCloud2` |
| 机器人位姿 | `/Odometry` | `nav_msgs/Odometry` |
| 地图 | `/map` | `nav_msgs/OccupancyGrid` |

这些配置来自：
- `hdl_localization_real_demo.launch.py` (第18行)
- HDL 定位节点发布的里程计话题
- 标准 ROS2 地图话题

---

## 下一步

- 📖 查看 [用户手册](docs/USER_GUIDE.md) 了解详细功能
- 🔧 查看 [rosbridge 安装指南](docs/ROSBRIDGE_SETUP.md)
- ⚙️ 在设置面板中根据实际情况调整话题名称

---

**需要帮助？** 按 F12 打开浏览器控制台查看详细日志。
