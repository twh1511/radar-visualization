import React, { useMemo } from 'react'
import { useRosStore } from '../store/rosStore'
import { useAppStore } from '../store/appStore'
import PathLine from './PathLine'
import CostmapLayer from './CostmapLayer'
import { transformPointToTarget } from '../utils/transforms'

// 模块级常量(稳定引用)：内联数组字面量会每次渲染产生新引用，使 CostmapLayer 的
// useMemo([data,opacity,occupiedColor,freeColor]) 每帧失效→每帧重建整张 costmap 纹理，
// 而本组件随 tfTree ~10Hz 重渲染 → 全局 costmap 不停闪烁。提为常量后只在 data 变时重建。
const GLOBAL_COSTMAP_COLOR = [239, 68, 68]
const LOCAL_COSTMAP_COLOR = [245, 158, 11]

function NavigationOverlay() {
  const effectiveConfig = useAppStore((s) => s.effectiveConfig)
  const globalPlan = useRosStore((s) => s.globalPlan)
  const localPlan = useRosStore((s) => s.localPlan)
  const lookaheadPoint = useRosStore((s) => s.lookaheadPoint)
  const navigationGoal = useRosStore((s) => s.navigationGoal)
  const globalCostmap = useRosStore((s) => s.globalCostmap)
  const globalCostmapFrame = useRosStore((s) => s.globalCostmapFrame)
  const localCostmap = useRosStore((s) => s.localCostmap)
  const localCostmapFrame = useRosStore((s) => s.localCostmapFrame)
  const tfTree = useRosStore((s) => s.tfTree)
  const targetFrame = useRosStore((s) => s.targetFrame)

  const lookaheadPosition = useMemo(() => {
    if (!lookaheadPoint?.point) return null
    const frameId = lookaheadPoint.header?.frame_id || null
    const [x, y, z] = transformPointToTarget(
      lookaheadPoint.point.x,
      lookaheadPoint.point.y,
      lookaheadPoint.point.z,
      frameId,
      targetFrame,
      tfTree
    )
    return [x, y + 0.06, z]
  }, [lookaheadPoint, targetFrame, tfTree])

  const goalPosition = useMemo(() => {
    if (!navigationGoal?.target_pose?.pose?.position) return null
    const frameId = navigationGoal.target_pose.header?.frame_id || null
    const p = navigationGoal.target_pose.pose.position
    const [x, y, z] = transformPointToTarget(p.x, p.y, p.z, frameId, targetFrame, tfTree)
    return [x, y + 0.08, z]
  }, [navigationGoal, targetFrame, tfTree])

  return (
    <>
      {effectiveConfig.display.showGlobalCostmap && globalCostmap && (
        <CostmapLayer data={globalCostmap} frame={globalCostmapFrame} opacity={0.18} occupiedColor={GLOBAL_COSTMAP_COLOR} />
      )}
      {effectiveConfig.display.showLocalCostmap && localCostmap && (
        <CostmapLayer data={localCostmap} frame={localCostmapFrame} opacity={0.28} occupiedColor={LOCAL_COSTMAP_COLOR} />
      )}
      {effectiveConfig.display.showGlobalPlan && globalPlan?.poses?.length > 1 && (
        <PathLine message={globalPlan} color="#22c55e" lineWidth={3} />
      )}
      {effectiveConfig.display.showLocalPlan && localPlan?.poses?.length > 1 && (
        <PathLine message={localPlan} color="#f59e0b" lineWidth={2} />
      )}
      {lookaheadPosition && (
        <mesh position={lookaheadPosition}>
          <sphereGeometry args={[0.08, 16, 16]} />
          <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.4} />
        </mesh>
      )}
      {goalPosition && (
        <mesh position={goalPosition}>
          <coneGeometry args={[0.12, 0.24, 18]} />
          <meshStandardMaterial color="#a855f7" emissive="#a855f7" emissiveIntensity={0.25} />
        </mesh>
      )}
    </>
  )
}

export default NavigationOverlay
