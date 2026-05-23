import React, { useMemo } from 'react'
import { useRosStore } from '../store/rosStore'
import * as THREE from 'three'
import { transformPoseToTarget, rosPositionToThree, rosQuaternionToThree } from '../utils/transforms'

function MapDisplay() {
  const mapData = useRosStore((s) => s.mapData)
  const mapFrame = useRosStore((s) => s.mapFrame)
  const targetFrame = useRosStore((s) => s.targetFrame)
  const tfTree = useRosStore((s) => s.tfTree)

  const mapMesh = useMemo(() => {
    if (!mapData || !mapData.info) return null
    const { info } = mapData
    let { data } = mapData
    const { width, height, resolution, origin } = info

    if (typeof data === 'string') {
      const bin = atob(data)
      const arr = new Int8Array(bin.length)
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i) << 24 >> 24
      data = arr
    }

    if (!data || data.length === 0) {
      console.warn('[MapDisplay] map data is empty', mapData)
      return null
    }

    console.log(`[MapDisplay] 渲染地图 ${width}x${height} resolution=${resolution} dataLen=${data.length}`)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    const imageData = ctx.createImageData(width, height)

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const srcIdx = (height - 1 - y) * width + x
        const dstIdx = (y * width + x) * 4
        const v = data[srcIdx]
        if (v === -1) {
          imageData.data[dstIdx] = 80
          imageData.data[dstIdx + 1] = 80
          imageData.data[dstIdx + 2] = 80
          imageData.data[dstIdx + 3] = 180
        } else if (v === 0) {
          imageData.data[dstIdx] = 220
          imageData.data[dstIdx + 1] = 220
          imageData.data[dstIdx + 2] = 220
          imageData.data[dstIdx + 3] = 200
        } else {
          const c = Math.max(0, 255 - v * 2.55)
          imageData.data[dstIdx] = c
          imageData.data[dstIdx + 1] = c
          imageData.data[dstIdx + 2] = c
          imageData.data[dstIdx + 3] = 255
        }
      }
    }

    ctx.putImageData(imageData, 0, 0)
    const texture = new THREE.CanvasTexture(canvas)
    texture.magFilter = THREE.NearestFilter
    texture.minFilter = THREE.LinearFilter
    texture.needsUpdate = true

    // 地图 origin 是地图左下角在 map frame 中的位姿
    const originPose = {
      x: origin.position.x,
      y: origin.position.y,
      z: origin.position.z || 0,
      qx: origin.orientation?.x || 0,
      qy: origin.orientation?.y || 0,
      qz: origin.orientation?.z || 0,
      qw: origin.orientation?.w || 1
    }

    // 地图中心在地图局部坐标系中的偏移（未旋转）
    const localCenterX = width * resolution / 2
    const localCenterY = height * resolution / 2

    // 将局部中心偏移应用 origin 的旋转
    const originQuat = new THREE.Quaternion(
      originPose.qx, originPose.qy, originPose.qz, originPose.qw
    )
    const localCenter = new THREE.Vector3(localCenterX, localCenterY, 0)
    localCenter.applyQuaternion(originQuat)

    // 地图中心在 map frame 中的位置
    const centerInMapFrame = {
      x: originPose.x + localCenter.x,
      y: originPose.y + localCenter.y,
      z: originPose.z + localCenter.z,
      qx: originPose.qx,
      qy: originPose.qy,
      qz: originPose.qz,
      qw: originPose.qw
    }

    return {
      texture,
      width: width * resolution,
      height: height * resolution,
      centerPose: centerInMapFrame
    }
  }, [mapData])

  if (!mapMesh) return null

  // 将地图中心位姿从 mapFrame 变换到 targetFrame，再转 Three.js 坐标
  const { position, quaternion } = transformPoseToTarget(
    mapMesh.centerPose,
    mapFrame,
    targetFrame,
    tfTree
  )

  // 地图平面在 Three.js 中是 XZ 平面，需要绕 X 轴旋转 -90°
  const finalQuat = quaternion.clone().multiply(
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2)
  )

  return (
    <mesh position={position} quaternion={finalQuat}>
      <planeGeometry args={[mapMesh.width, mapMesh.height]} />
      <meshBasicMaterial map={mapMesh.texture} transparent />
    </mesh>
  )
}

export default MapDisplay
