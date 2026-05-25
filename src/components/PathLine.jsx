import React, { useMemo } from 'react'
import { useRosStore } from '../store/rosStore'
import { transformPointToTarget } from '../utils/transforms'
import * as THREE from 'three'

function PathLine({ message, color, lineWidth = 2 }) {
  const tfTree = useRosStore((s) => s.tfTree)
  const targetFrame = useRosStore((s) => s.targetFrame)

  const points = useMemo(() => {
    if (!message?.poses?.length) return []
    return message.poses.map((poseStamped) => {
      const pose = poseStamped.pose
      const frameId = poseStamped.header?.frame_id || message.header?.frame_id || null
      const [x, y, z] = transformPointToTarget(
        pose.position.x,
        pose.position.y,
        pose.position.z,
        frameId,
        targetFrame,
        tfTree
      )
      return new THREE.Vector3(x, y + 0.03, z)
    })
  }, [message, tfTree, targetFrame])

  if (points.length < 2) return null

  return (
    <line>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={points.length}
          array={new Float32Array(points.flatMap((point) => [point.x, point.y, point.z]))}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial color={color} linewidth={lineWidth} />
    </line>
  )
}

export default PathLine
