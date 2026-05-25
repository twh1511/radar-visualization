import React, { useMemo, useCallback } from 'react'
import { useRosStore } from '../store/rosStore'
import * as THREE from 'three'
import { transformPoseToTarget } from '../utils/transforms'

function MapDisplay() {
  const mapData = useRosStore((s) => s.mapData)
  const mapFrame = useRosStore((s) => s.mapFrame)
  const targetFrame = useRosStore((s) => s.targetFrame)
  const tfTree = useRosStore((s) => s.tfTree)
  const setNavigationGoal = useRosStore((s) => s.setNavigationGoal)

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

    const originPose = {
      x: origin.position.x,
      y: origin.position.y,
      z: origin.position.z || 0,
      qx: origin.orientation?.x || 0,
      qy: origin.orientation?.y || 0,
      qz: origin.orientation?.z || 0,
      qw: origin.orientation?.w || 1
    }

    const localCenterX = width * resolution / 2
    const localCenterY = height * resolution / 2
    const originQuat = new THREE.Quaternion(originPose.qx, originPose.qy, originPose.qz, originPose.qw)
    const localCenter = new THREE.Vector3(localCenterX, localCenterY, 0)
    localCenter.applyQuaternion(originQuat)

    return {
      texture,
      width: width * resolution,
      height: height * resolution,
      resolution,
      rawData: data,
      gridWidth: width,
      gridHeight: height,
      originPose,
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
  }, [mapData])

  const classifyPoint = (gridX, gridY) => {
    const ix = Math.floor(gridX / mapMesh.resolution)
    const iy = Math.floor(gridY / mapMesh.resolution)
    if (ix < 0 || iy < 0 || ix >= mapMesh.gridWidth || iy >= mapMesh.gridHeight) {
      return { level: 'invalid', message: '超出地图范围', occupancy: null }
    }
    const index = iy * mapMesh.gridWidth + ix
    const occupancy = mapMesh.rawData[index]
    if (occupancy === -1) return { level: 'unknown', message: '落在未知区域', occupancy }
    if (occupancy >= 50) return { level: 'blocked', message: '落在障碍区域', occupancy }
    return { level: 'free', message: '落在自由区域', occupancy }
  }

  const handleMapClick = useCallback((event) => {
    if (!mapMesh) return
    event.stopPropagation()
    const point = event.point
    const local = event.object.worldToLocal(point.clone())
    const mapX = local.x + mapMesh.width / 2
    const mapY = local.z + mapMesh.height / 2
    const validity = classifyPoint(mapX, mapY)

    const goal = {
      target_pose: {
        header: { frame_id: mapFrame || targetFrame },
        pose: {
          position: {
            x: mapMesh.originPose.x + mapX,
            y: mapMesh.originPose.y + mapY,
            z: 0
          },
          orientation: { x: 0, y: 0, z: 0, w: 1 }
        }
      }
    }
    setNavigationGoal(goal, validity)
  }, [mapMesh, mapFrame, targetFrame, setNavigationGoal])

  if (!mapMesh) return null

  const { position, quaternion } = transformPoseToTarget(
    mapMesh.centerPose,
    mapFrame,
    targetFrame,
    tfTree
  )

  const finalQuat = quaternion.clone().multiply(
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2)
  )

  return (
    <mesh position={position} quaternion={finalQuat} onClick={handleMapClick}>
      <planeGeometry args={[mapMesh.width, mapMesh.height]} />
      <meshBasicMaterial map={mapMesh.texture} transparent />
    </mesh>
  )
}

export default MapDisplay
