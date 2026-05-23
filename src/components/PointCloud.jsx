import React, { useRef, useMemo, useEffect } from 'react'
import { useRosStore } from '../store/rosStore'
import { useAppStore } from '../store/appStore'
import * as THREE from 'three'

function PointCloud() {
  const pointsRef = useRef()
  // pointCloudData 已在 rosStore 中完成 TF 变换并转为 Three.js 坐标，直接使用
  const pointCloudData = useRosStore((s) => s.pointCloudData)
  const pointSize = useAppStore((s) => s.settings.performance.pointSize)
  const colorByHeight = useAppStore((s) => s.settings.display.colorByHeight)

  const geometry = useMemo(() => new THREE.BufferGeometry(), [])
  const material = useMemo(
    () => new THREE.PointsMaterial({
      size: pointSize,
      vertexColors: true,
      sizeAttenuation: true
    }),
    []
  )

  useEffect(() => { material.size = pointSize }, [pointSize, material])

  useEffect(() => {
    if (!pointCloudData || pointCloudData.length === 0) return

    // pointCloudData 已经是 Three.js 坐标，直接写入 geometry
    geometry.setAttribute('position', new THREE.BufferAttribute(pointCloudData, 3))

    const colors = new Float32Array(pointCloudData.length)
    if (colorByHeight) {
      // 找高度范围（Three.js 的 y 是高度，即 buffer 的 [i+1]）
      let hMin = Infinity, hMax = -Infinity
      for (let i = 1; i < pointCloudData.length; i += 3) {
        const h = pointCloudData[i]
        if (h < hMin) hMin = h
        if (h > hMax) hMax = h
      }
      const hRange = Math.max(0.01, hMax - hMin)
      for (let i = 0; i < pointCloudData.length; i += 3) {
        const t = (pointCloudData[i + 1] - hMin) / hRange
        // 蓝 -> 青 -> 绿 -> 黄 -> 红
        colors[i]     = Math.min(1, Math.max(0, 2 * t - 1))            // R
        colors[i + 1] = Math.min(1, Math.max(0, 1 - Math.abs(2 * t - 1))) // G
        colors[i + 2] = Math.min(1, Math.max(0, 1 - 2 * t))            // B
      }
    } else {
      for (let i = 0; i < pointCloudData.length; i += 3) {
        colors[i] = 0.5; colors[i + 1] = 0.8; colors[i + 2] = 1.0
      }
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geometry.computeBoundingSphere()
    geometry.attributes.position.needsUpdate = true
    geometry.attributes.color.needsUpdate = true
  }, [pointCloudData, colorByHeight, geometry])

  return <points ref={pointsRef} geometry={geometry} material={material} />
}

export default PointCloud
