import React from 'react'
import { useRosStore } from '../store/rosStore'
import { useAppStore } from '../store/appStore'

function NavigationControls() {
  const settings = useAppStore((s) => s.settings)
  const capabilities = useAppStore((s) => s.effectiveConfig.capabilities)
  const navigationTask = useRosStore((s) => s.navigationTask)
  const navigationStatus = useRosStore((s) => s.navigationStatus)
  const triggerNavigationAction = useRosStore((s) => s.triggerNavigationAction)
  const cancelNavigationAction = useRosStore((s) => s.cancelNavigationAction)
  const callNavigationService = useRosStore((s) => s.callNavigationService)

  if (!capabilities.supportsNavigateToPose) return null

  return (
    <div style={panelStyle}>
      <div style={titleStyle}>导航控制</div>
      <div style={statusStyle}>状态：{navigationStatus}</div>
      {navigationTask?.message && <div style={detailStyle}>{navigationTask.message}</div>}
      <div style={buttonGridStyle}>
        <button style={btnStyle} onClick={() => triggerNavigationAction()}>发送导航目标</button>
        <button style={btnStyle} onClick={cancelNavigationAction}>取消导航</button>
        <button style={btnStyle} onClick={() => callNavigationService('relocalize')}>重定位</button>
        <button style={btnStyle} onClick={() => callNavigationService('clearGlobalCostmap')}>清全局代价地图</button>
        <button style={btnStyle} onClick={() => callNavigationService('clearLocalCostmap')}>清局部代价地图</button>
      </div>
      <div style={hintStyle}>
        当前 action: {settings.actions.navigateToPose}
      </div>
    </div>
  )
}

const panelStyle = {
  position: 'absolute',
  left: 20,
  bottom: 20,
  width: 260,
  background: 'rgba(10,10,10,0.88)',
  backdropFilter: 'blur(8px)',
  border: '1px solid #2a2a2a',
  borderRadius: 8,
  padding: 12,
  color: 'white',
  zIndex: 900
}
const titleStyle = {
  fontSize: 11,
  color: '#888',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  marginBottom: 8
}
const statusStyle = {
  fontSize: 12,
  color: '#93c5fd',
  marginBottom: 6
}
const detailStyle = {
  fontSize: 11,
  color: '#d1d5db',
  marginBottom: 8
}
const buttonGridStyle = {
  display: 'grid',
  gridTemplateColumns: '1fr',
  gap: 8
}
const btnStyle = {
  padding: '8px 10px',
  background: '#1f2937',
  color: 'white',
  border: '1px solid #374151',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 12
}
const hintStyle = {
  marginTop: 8,
  fontSize: 11,
  color: '#6b7280',
  fontFamily: 'monospace'
}

export default NavigationControls
