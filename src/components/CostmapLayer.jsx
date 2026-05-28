import React, { useMemo } from 'react'
import * as THREE from 'three'
import { useRosStore } from '../store/rosStore'
import { transformPoseToTarget } from '../utils/transforms'

// 默认色提为模块常量：默认参数 [..] 每次调用都新建数组→引用变→useMemo 每帧失效重建纹理
const DEFAULT_OCC_COLOR = [239, 68, 68]
const DEFAULT_FREE_COLOR = [20, 20, 20]

function CostmapLayer({ data, frame, opacity = 0.35, occupiedColor = DEFAULT_OCC_COLOR, freeColor = DEFAULT_FREE_COLOR }) {
  const targetFrame = useRosStore((s) => s.targetFrame)
  const tfTree = useRosStore((s) => s.tfTree)

  const mesh = useMemo(() => {
    if (!data?.info || !data?.data?.length) return null
    const { width, height, resolution, origin } = data.info
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    const imageData = ctx.createImageData(width, height)

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const srcIdx = (height - 1 - y) * width + x
        const dstIdx = (y * width + x) * 4
        const v = data.data[srcIdx]
        if (v < 0) {
          imageData.data[dstIdx] = 0
          imageData.data[dstIdx + 1] = 0
          imageData.data[dstIdx + 2] = 0
          imageData.data[dstIdx + 3] = 0
        } else {
          const t = Math.min(1, Math.max(0, v / 100))
          imageData.data[dstIdx] = freeColor[0] + (occupiedColor[0] - freeColor[0]) * t
          imageData.data[dstIdx + 1] = freeColor[1] + (occupiedColor[1] - freeColor[1]) * t
          imageData.data[dstIdx + 2] = freeColor[2] + (occupiedColor[2] - freeColor[2]) * t
          imageData.data[dstIdx + 3] = Math.round(255 * opacity)
        }
      }
    }

    ctx.putImageData(imageData, 0, 0)
    const texture = new THREE.CanvasTexture(canvas)
    texture.magFilter = THREE.NearestFilter
    texture.minFilter = THREE.LinearFilter
    texture.needsUpdate = true

    const originPose = {
      x: origin.position.x,
      y: origin.position.y,
      z: origin.position.z || 0.02,
      qx: origin.orientation?.x || 0,
      qy: origin.orientation?.y || 0,
      qz: origin.orientation?.z || 0,
      qw: origin.orientation?.w || 1
    }

    const localCenterX = width * resolution / 2
    const localCenterY = height * resolution / 2
    const originQuat = new THREE.Quaternion(originPose.qx, originPose.qy, originPose.qz, originPose.qw)
    const localCenter = new THREE.Vector3(localCenterX, localCenterY, 0).applyQuaternion(originQuat)

    return {
      texture,
      width: width * resolution,
      height: height * resolution,
      centerPose: {
        x: originPose.x + localCenter.x,
        y: originPose.y + localCenter.y,
        z: originPose.z + localCenter.z,
        qx: originPose.qx,
        qy: originPose.qy,
        qz: originPose.qz,
        qw: originPose.qw
      }
    }
  }, [data, opacity, occupiedColor, freeColor])

  if (!mesh) return null

  const { position, quaternion } = transformPoseToTarget(mesh.centerPose, frame, targetFrame, tfTree)
  const finalQuat = quaternion.clone().multiply(
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2)
  )

  return (
    <mesh position={position} quaternion={finalQuat}>
      <planeGeometry args={[mesh.width, mesh.height]} />
      <meshBasicMaterial map={mesh.texture} transparent depthWrite={false} />
    </mesh>
  )
}

export default CostmapLayer
