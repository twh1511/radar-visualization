import React, { useMemo, useEffect } from 'react'
import { useRosStore } from '../store/rosStore'
import { useAppStore } from '../store/appStore'
import { getRenderProfile } from '../rendering/renderProfiles'
import * as THREE from 'three'

function PointCloud() {
  const pointCloudData = useRosStore((s) => s.pointCloudData)
  const pointSize = useAppStore((s) => s.settings.performance.pointSize)
  const colorByHeight = useAppStore((s) => s.settings.display.colorByHeight)
  const renderProfileId = useAppStore((s) => s.settings.performance.renderProfile)
  const renderProfile = getRenderProfile(renderProfileId)

  const geometry = useMemo(() => new THREE.BufferGeometry(), [])
  const material = useMemo(
    () => new THREE.PointsMaterial({
      size: pointSize,
      vertexColors: true,
      sizeAttenuation: true
    }),
    []
  )

  useEffect(() => {
    material.size = pointSize * renderProfile.pointSizeMultiplier
  }, [pointSize, material, renderProfile.pointSizeMultiplier])

  useEffect(() => {
    if (!pointCloudData || pointCloudData.length === 0) return

    geometry.setAttribute('position', new THREE.BufferAttribute(pointCloudData, 3))

    const colors = new Float32Array(pointCloudData.length)
    if (colorByHeight) {
      let hMin = Infinity, hMax = -Infinity
      for (let i = 1; i < pointCloudData.length; i += 3) {
        const h = pointCloudData[i]
        if (h < hMin) hMin = h
        if (h > hMax) hMax = h
      }
      const hRange = Math.max(0.01, hMax - hMin)
      for (let i = 0; i < pointCloudData.length; i += 3) {
        const t = (pointCloudData[i + 1] - hMin) / hRange
        colors[i] = Math.min(1, Math.max(0, 2 * t - 1))
        colors[i + 1] = Math.min(1, Math.max(0, 1 - Math.abs(2 * t - 1)))
        colors[i + 2] = Math.min(1, Math.max(0, 1 - 2 * t))
      }
    } else {
      for (let i = 0; i < pointCloudData.length; i += 3) {
        colors[i] = 0.5
        colors[i + 1] = 0.8
        colors[i + 2] = 1.0
      }
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geometry.computeBoundingSphere()
    geometry.attributes.position.needsUpdate = true
    geometry.attributes.color.needsUpdate = true
  }, [pointCloudData, colorByHeight, geometry])

  return <points geometry={geometry} material={material} />
}

export default PointCloud
