import React from 'react'

function StatusPanel({ connected, status, onToggleStats }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 20,
        left: 20,
        background: 'rgba(0, 0, 0, 0.8)',
        color: 'white',
        padding: '15px 20px',
        borderRadius: '8px',
        fontFamily: 'monospace',
        fontSize: '14px',
        zIndex: 1000,
        minWidth: '250px'
      }}
    >
      <div style={{ marginBottom: '10px', fontSize: '16px', fontWeight: 'bold' }}>
        雷达地图可视化
      </div>

      <div style={{ marginBottom: '8px' }}>
        <span style={{ color: '#888' }}>连接状态: </span>
        <span style={{ color: connected ? '#4ade80' : '#f87171' }}>
          {status}
        </span>
      </div>

      <div style={{ marginBottom: '8px' }}>
        <span style={{ color: '#888' }}>机器人IP: </span>
        <span>192.168.1.247</span>
      </div>

      <div style={{ marginTop: '15px', paddingTop: '10px', borderTop: '1px solid #444' }}>
        <button
          onClick={onToggleStats}
          style={{
            background: '#4a90e2',
            color: 'white',
            border: 'none',
            padding: '8px 15px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          切换性能统计
        </button>
      </div>

      <div style={{ marginTop: '15px', fontSize: '12px', color: '#888' }}>
        <div>鼠标左键: 旋转视角</div>
        <div>鼠标右键: 平移视角</div>
        <div>滚轮: 缩放</div>
      </div>
    </div>
  )
}

export default StatusPanel
