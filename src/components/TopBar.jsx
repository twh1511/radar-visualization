import React from 'react'
import { useAppStore } from '../store/appStore'
import { useRosStore } from '../store/rosStore'

function TopBar() {
  const { getCurrentRobot, runtimeProfile, setShowConnectionManager, toggleSettings } = useAppStore()
  const { connected, connecting, connectionStatus, disconnect } = useRosStore()
  const robot = getCurrentRobot()

  const statusColor = connected ? '#22c55e' : connecting ? '#eab308' : '#ef4444'

  return (
    <div style={barStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setShowConnectionManager(true)}
          style={iconBtnStyle}
          title="切换机器人"
        >
          ☰
        </button>
        <div style={{ fontWeight: 600, fontSize: 14 }}>ROS2 可视化</div>
        <div style={{ color: '#666' }}>|</div>
        <div style={{ fontSize: 13 }}>
          {robot ? robot.name : '未选择机器人'}
          {robot && <span style={{ color: '#666', marginLeft: 8, fontSize: 11 }}>{robot.host}:{robot.port}</span>}
        </div>
        <div style={{ color: '#666', fontSize: 11 }}>
          {runtimeProfile.deploymentProfileName} / {runtimeProfile.localizationMode}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor }} />
          <span style={{ fontSize: 12, color: '#aaa' }}>{connectionStatus}</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        {connected && (
          <button onClick={disconnect} style={iconBtnStyle} title="断开连接">
            断开
          </button>
        )}
        <button onClick={toggleSettings} style={iconBtnStyle} title="设置">
          ⚙
        </button>
      </div>
    </div>
  )
}

const barStyle = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  height: 44,
  background: 'rgba(10, 10, 10, 0.92)',
  backdropFilter: 'blur(8px)',
  borderBottom: '1px solid #1f1f1f',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 16px',
  color: 'white',
  fontFamily: '-apple-system, sans-serif',
  zIndex: 1000
}
const iconBtnStyle = {
  background: 'transparent',
  border: '1px solid #2a2a2a',
  color: 'white',
  width: 32,
  height: 32,
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 14,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0 10px'
}

export default TopBar
