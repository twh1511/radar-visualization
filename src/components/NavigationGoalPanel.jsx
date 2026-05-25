import React from 'react'
import { useAppStore } from '../store/appStore'
import { useRosStore } from '../store/rosStore'

function NavigationGoalPanel() {
  const goal = useRosStore((s) => s.navigationGoal)
  const validity = useRosStore((s) => s.navigationGoalValidity)
  const navigationStatus = useRosStore((s) => s.navigationStatus)
  const triggerNavigationAction = useRosStore((s) => s.triggerNavigationAction)
  const clearNavigationGoal = useRosStore((s) => s.clearNavigationGoal)
  const targetFrame = useAppStore((s) => s.effectiveConfig.frames.targetFrame)

  if (!goal?.target_pose?.pose?.position) return null

  const { x, y, z } = goal.target_pose.pose.position
  const q = goal.target_pose.pose.orientation || { x: 0, y: 0, z: 0, w: 1 }
  const yaw = Math.atan2(2 * (q.w * q.z + q.x * q.y), 1 - 2 * (q.y * q.y + q.z * q.z))

  const updateYaw = (nextYaw) => {
    const half = nextYaw / 2
    const nextGoal = {
      ...goal,
      target_pose: {
        ...goal.target_pose,
        pose: {
          ...goal.target_pose.pose,
          orientation: {
            x: 0,
            y: 0,
            z: Math.sin(half),
            w: Math.cos(half)
          }
        }
      }
    }
    useRosStore.getState().setNavigationGoal(nextGoal, validity)
  }

  const canSend = validity?.level === 'free'
  const validityColor = validity?.level === 'free'
    ? '#22c55e'
    : validity?.level === 'unknown'
      ? '#f59e0b'
      : '#ef4444'

  return (
    <div style={panelStyle}>
      <div style={titleStyle}>待发送导航目标</div>
      <div style={rowStyle}>frame: <code>{goal.target_pose.header?.frame_id || targetFrame}</code></div>
      <div style={rowStyle}>x: <code>{x.toFixed(3)}</code></div>
      <div style={rowStyle}>y: <code>{y.toFixed(3)}</code></div>
      <div style={rowStyle}>z: <code>{z.toFixed(3)}</code></div>
      <div style={rowStyle}>yaw: <code>{yaw.toFixed(3)} rad</code></div>
      <div style={rowStyle}>状态: <span style={{ color: '#93c5fd' }}>{navigationStatus}</span></div>
      {validity && (
        <div style={{ ...validityStyle, borderColor: validityColor, color: validityColor }}>
          {validity.message}{typeof validity.occupancy === 'number' ? `（occupancy=${validity.occupancy}）` : ''}
        </div>
      )}
      <label style={sliderLabelStyle}>目标朝向 yaw</label>
      <input
        type="range"
        min={(-Math.PI).toString()}
        max={Math.PI.toString()}
        step="0.01"
        value={yaw}
        onChange={(e) => updateYaw(parseFloat(e.target.value))}
        style={{ width: '100%' }}
      />
      <div style={buttonRowStyle}>
        <button style={{ ...buttonStyle, opacity: canSend ? 1 : 0.45, cursor: canSend ? 'pointer' : 'not-allowed' }} onClick={() => canSend && triggerNavigationAction(goal)}>
          发送这个导航点
        </button>
        <button style={secondaryButtonStyle} onClick={clearNavigationGoal}>
          清除目标
        </button>
      </div>
    </div>
  )
}

const panelStyle = {
  position: 'absolute',
  left: 20,
  top: 110,
  zIndex: 1200,
  width: 240,
  background: 'rgba(10,10,10,0.9)',
  border: '1px solid #2a2a2a',
  borderRadius: 8,
  padding: 12,
  color: 'white'
}
const titleStyle = {
  fontSize: 12,
  fontWeight: 600,
  marginBottom: 8,
  color: '#e5e7eb'
}
const rowStyle = {
  fontSize: 12,
  color: '#cbd5e1',
  marginBottom: 6
}
const validityStyle = {
  marginTop: 8,
  marginBottom: 8,
  padding: '8px 10px',
  border: '1px solid',
  borderRadius: 6,
  fontSize: 12,
  background: 'rgba(255,255,255,0.03)'
}
const sliderLabelStyle = {
  display: 'block',
  fontSize: 11,
  color: '#9ca3af',
  marginTop: 6,
  marginBottom: 4
}
const buttonRowStyle = {
  display: 'flex',
  gap: 8,
  marginTop: 10
}
const buttonStyle = {
  flex: 1,
  padding: '8px 10px',
  background: '#16a34a',
  color: 'white',
  border: '1px solid #22c55e',
  borderRadius: 6,
  fontSize: 12
}
const secondaryButtonStyle = {
  flex: 1,
  padding: '8px 10px',
  background: '#1f2937',
  color: 'white',
  border: '1px solid #374151',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 12
}

export default NavigationGoalPanel
