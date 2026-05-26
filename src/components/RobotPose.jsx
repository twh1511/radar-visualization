import React, { useRef, useState, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useRosStore } from '../store/rosStore'
import * as THREE from 'three'
import { LoadingManager } from 'three'
import URDFLoader from 'urdf-loader'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { transformPoseToTarget } from '../utils/transforms'

const URDF_URL = '/robot_model/urdf/mz05_20260322.urdf'
const MODEL_SCALE = 0.5  // 模型整体缩放

// 加载真实 URDF 模型（mz05 四足）。STL 无颜色，统一上金属质感材质。
function useUrdfRobot() {
  const [data, setData] = useState({ robot: null, offsetY: 0 })
  useEffect(() => {
    let cancelled = false
    let robotResult = null
    const manager = new LoadingManager()
    const loader = new URDFLoader(manager)
    // 显式用 STLLoader 加载网格并上色（URDF 里材质都是白色，覆盖掉）
    loader.loadMeshCb = (path, mgr, done) => {
      new STLLoader(mgr).load(
        path,
        (geometry) => {
          geometry.computeVertexNormals()
          const mesh = new THREE.Mesh(
            geometry,
            new THREE.MeshStandardMaterial({ color: '#3a4a66', metalness: 0.55, roughness: 0.45 })
          )
          mesh.castShadow = true
          done(mesh)
        },
        undefined,
        (err) => done(null, err)
      )
    }
    // onComplete 只拿到 URDF 结构，STL 网格是异步加载的；必须等
    // manager.onLoad（全部网格就绪）后再算包围盒，否则 box 为空、offsetY 失效。
    loader.load(URDF_URL, (result) => { robotResult = result })
    manager.onLoad = () => {
      if (cancelled || !robotResult) return
      // base 原点在机身，直接放脚会陷到地下。按场景朝向(z上→y上)算最低点，抬高使脚踩 y=0。
      robotResult.rotation.set(-Math.PI / 2, 0, 0)
      robotResult.updateMatrixWorld(true)
      const box = new THREE.Box3().setFromObject(robotResult)
      robotResult.rotation.set(0, 0, 0)
      robotResult.updateMatrixWorld(true)
      const offsetY = Number.isFinite(box.min.y) ? -box.min.y : 0
      setData({ robot: robotResult, offsetY })
    }
    return () => { cancelled = true }
  }, [])
  return data
}

// 简化兜底模型（URDF 加载完成前显示）
function FallbackModel() {
  const bodyLen = 0.55, bodyWid = 0.28, bodyHei = 0.18, legHei = 0.22, legR = 0.035
  const standY = legHei
  const legOffX = bodyLen / 2 - 0.06, legOffZ = bodyWid / 2 - 0.02, legY = standY - legHei / 2
  const legs = [
    [legOffX, legY, legOffZ], [legOffX, legY, -legOffZ],
    [-legOffX, legY, legOffZ], [-legOffX, legY, -legOffZ]
  ]
  return (
    <group>
      <mesh position={[0, standY + bodyHei / 2, 0]}>
        <boxGeometry args={[bodyLen, bodyHei, bodyWid]} />
        <meshStandardMaterial color="#2563eb" metalness={0.4} roughness={0.5} opacity={0.6} transparent />
      </mesh>
      {legs.map((p, i) => (
        <mesh key={i} position={p}>
          <cylinderGeometry args={[legR, legR * 1.2, legHei, 12]} />
          <meshStandardMaterial color="#1e293b" opacity={0.6} transparent />
        </mesh>
      ))}
    </group>
  )
}

function RobotPose() {
  const groupRef = useRef()
  const robotPose = useRosStore((s) => s.robotPose)
  const robotPoseFrame = useRosStore((s) => s.robotPoseFrame)
  const targetFrame = useRosStore((s) => s.targetFrame)
  const tfTree = useRosStore((s) => s.tfTree)
  const { robot, offsetY } = useUrdfRobot()

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
      {robot ? (
        // 缩放后脚的抬升量同步缩放(offsetY*scale)，保证脚仍踩在 y=0；
        // 内层绕 X 轴 -90° 把 URDF(z上) 转到场景(y上)
        <group scale={MODEL_SCALE} position={[0, offsetY * MODEL_SCALE, 0]}>
          <group rotation={[-Math.PI / 2, 0, 0]}>
            <primitive object={robot} />
          </group>
        </group>
      ) : (
        <FallbackModel />
      )}
    </group>
  )
}

export default RobotPose
