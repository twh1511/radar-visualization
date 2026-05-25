# Radar Visualization Deploy

这个目录用于管理机器人侧 `rosbridge + 对应 DS` 的一键部署资产。

## 目标

从当前项目出发：
- 生成机器人部署清单
- 渲染 rosbridge / DS 配置模板
- 通过 SSH/rsync 下发到机器人
- 在远端启动或重启服务
- 做最小健康检查

## 目录结构

- `manifests/` 机器人部署清单
- `templates/` env / service / 启动脚本模板
- `scripts/` 本地部署脚本与远端安装脚本

## 当前约束

第一版只做最小可执行部署骨架：
- 假设机器人已具备 ROS2 环境
- 假设机器人可通过 SSH 登录
- 假设 `rosbridge_server` 可以通过 apt 安装或已预装
- 先解决“同步 -> 启动 -> 检查”链路

## 使用方式（第一版）

```bash
bash deploy/scripts/deploy.sh deploy/manifests/example-orin.yaml
```

## 后续演进

后续可以继续补：
- 多版本 release / current 目录切换
- systemd service 自动安装
- 批量机器人部署
- 与 `iiri_ros2_architecture` 的 `system_bringup` 更深集成
