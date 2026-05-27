#!/usr/bin/env python3
"""tf_static → /tf 中继

解决 Web 可视化（roslib + rosbridge）收不到 latched /tf_static 的问题：
rosbridge_server 默认用 volatile QoS 订阅，而 /tf_static 是 transient_local（latched），
若 rosbridge 在机器人发布静态 TF 之后才启动，就永远收不到 base_link→laser_link 等静态变换，
导致前端无法把 laser_link 帧的点云变换到 map 帧（扫描与地图错位）。

本节点用 transient_local 订阅 /tf_static，按固定频率以当前时间戳重发到 /tf。
rosbridge 通过 volatile 的 /tf 连续流可靠转发给前端，tfTree 即可补全静态链路。

用法（在能访问机器人 ROS 图的环境里）：
    python3 tf_static_relay.py            # 默认 1Hz
    python3 tf_static_relay.py --rate 2.0
"""
import argparse
import rclpy
from rclpy.node import Node
from rclpy.qos import QoSProfile, QoSDurabilityPolicy, QoSReliabilityPolicy, QoSHistoryPolicy
from tf2_msgs.msg import TFMessage


class TfStaticRelay(Node):
    def __init__(self, rate_hz: float):
        super().__init__('tf_static_relay')
        self.transforms = {}  # (frame_id, child_frame_id) -> TransformStamped

        static_qos = QoSProfile(
            depth=100,
            durability=QoSDurabilityPolicy.TRANSIENT_LOCAL,
            reliability=QoSReliabilityPolicy.RELIABLE,
            history=QoSHistoryPolicy.KEEP_LAST,
        )
        self.sub = self.create_subscription(TFMessage, '/tf_static', self._on_static, static_qos)
        self.pub = self.create_publisher(TFMessage, '/tf', 10)
        self.timer = self.create_timer(1.0 / rate_hz, self._republish)
        self.get_logger().info(f'tf_static_relay 启动，重发频率 {rate_hz} Hz')

    def _on_static(self, msg: TFMessage):
        for t in msg.transforms:
            self.transforms[(t.header.frame_id, t.child_frame_id)] = t
        self.get_logger().info(f'已捕获 {len(self.transforms)} 个静态变换')

    def _republish(self):
        if not self.transforms:
            return
        out = TFMessage()
        now = self.get_clock().now().to_msg()
        for t in self.transforms.values():
            t.header.stamp = now
            out.transforms.append(t)
        self.pub.publish(out)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--rate', type=float, default=1.0, help='重发频率 (Hz)')
    args, _ = parser.parse_known_args()

    rclpy.init()
    node = TfStaticRelay(args.rate)
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        if rclpy.ok():
            rclpy.shutdown()


if __name__ == '__main__':
    main()
