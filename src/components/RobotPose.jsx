import React, { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useRosStore } from '../store/rosStore'
import * as THREE from 'three'
import { transformPoseToTarget } from '../utils/transforms'

// 简化的机器狗模型（在本地坐标系中: x 前, y 上, z 右；与已应用的 ROS→Three 变换后的姿态一致）
function DogModel() {
  const bodyColor = '#2563eb'
  const legColor = '#1e293b'
  const headColor = '#3b82f6'
  const accentColor = '#ef4444'

  // 机身尺寸
  const bodyLen = 0.55   // x 方向（前后）
  const bodyWid = 0.28   // z 方向（左右）
  const bodyHei = 0.18   // y 方向（上下）
  const legHei = 0.22
  const legR = 0.035
  const standY = legHei  // 机身底面距地面的高度

  // 腿的四个位置（机身底面四角）
  const legOffX = bodyLen / 2 - 0.06
  const legOffZ = bodyWid / 2 - 0.02
  const legY = standY - legHei / 2  // 腿中心 y
  const legs = [
    [ legOffX, legY,  legOffZ],
    [ legOffX, legY, -legOffZ],
    [-legOffX, legY,  legOffZ],
    [-legOffX, legY, -legOffZ],
  ]

  return (
    <group>
      {/* 机身 */}
      <mesh position={[0, standY + bodyHei / 2, 0]} castShadow>
        <boxGeometry args={[bodyLen, bodyHei, bodyWid]} />
        <meshStandardMaterial color={bodyColor} metalness={0.4} roughness={0.5} />
      </mesh>

      {/* 机身顶部传感器盒 */}
      <mesh position={[0.05, standY + bodyHei + 0.04, 0]}>
        <boxGeometry args={[0.18, 0.06, 0.18]} />
        <meshStandardMaterial color="#0f172a" metalness={0.6} roughness={0.3} />
      </mesh>

      {/* 头部 */}
      <mesh position={[bodyLen / 2 + 0.04, standY + bodyHei - 0.02, 0]}>
        <boxGeometry args={[0.18, 0.16, 0.2]} />
        <meshStandardMaterial color={headColor} metalness={0.4} roughness={0.5} />
      </mesh>

      {/* 眼睛 */}
      <mesh position={[bodyLen / 2 + 0.13, standY + bodyHei + 0.02, 0.06]}>
        <sphereGeometry args={[0.022, 12, 12]} />
        <meshStandardMaterial color="#fde047" emissive="#fde047" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[bodyLen / 2 + 0.13, standY + bodyHei + 0.02, -0.06]}>
        <sphereGeometry args={[0.022, 12, 12]} />
        <meshStandardMaterial color="#fde047" emissive="#fde047" emissiveIntensity={0.5} />
      </mesh>

      {/* 前向指示锥 (朝 ROS x+ 即模型本地 x+) */}
      <mesh position={[bodyLen / 2 + 0.18, standY + bodyHei + 0.02, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.05, 0.12, 16]} />
        <meshStandardMaterial color={accentColor} />
      </mesh>

      {/* 尾巴 */}
      <mesh position={[-bodyLen / 2 - 0.06, standY + bodyHei, 0]} rotation={[0, 0, Math.PI / 4]}>
        <cylinderGeometry args={[0.015, 0.025, 0.15, 8]} />
        <meshStandardMaterial color={bodyColor} />
      </mesh>

      {/* 四条腿 */}
      {legs.map((p, i) => (
        <mesh key={i} position={p}>
          <cylinderGeometry args={[legR, legR * 1.2, legHei, 12]} />
          <meshStandardMaterial color={legColor} metalness={0.5} roughness={0.4} />
        </mesh>
      ))}

      {/* 四个脚掌 */}
      {legs.map((p, i) => (
        <mesh key={`f${i}`} position={[p[0], 0.012, p[2]]}>
          <sphereGeometry args={[legR * 1.4, 12, 8]} />
          <meshStandardMaterial color="#0f172a" />
        </mesh>
      ))}

      {/* 坐标轴辅助（可视化朝向） */}
      <primitive object={new THREE.AxesHelper(0.4)} />
    </group>
  )
}

function RobotPose() {
  const groupRef = useRef()
  const robotPose = useRosStore((s) => s.robotPose)
  const robotPoseFrame = useRosStore((s) => s.robotPoseFrame)
  const targetFrame = useRosStore((s) => s.targetFrame)
  const tfTree = useRosStore((s) => s.tfTree)

  useFrame(() => {
    if (groupRef.current) {
      const { position, quaternion } = transformPoseToTarget(
        robotPose,
        robotPoseFrame,
        targetFrame,
        tfTree
      )
      groupRef.current.position.copy(position)
      groupRef.current.quaternion.copy(quaternion)
    }
  })

  return (
    <group ref={groupRef}>
      <DogModel />
    </group>
  )
}

export default RobotPose
