import React from 'react'
import { useAppStore } from '../store/appStore'

function ConnectionLauncher() {
  const setShowConnectionManager = useAppStore((s) => s.setShowConnectionManager)

  return (
    <button
      type="button"
      onClick={() => setShowConnectionManager(true)}
      style={buttonStyle}
      title="打开连接机器人面板"
    >
      连接机器人
    </button>
  )
}

const buttonStyle = {
  position: 'absolute',
  top: 56,
  left: 16,
  zIndex: 1200,
  padding: '10px 14px',
  background: '#2563eb',
  color: 'white',
  border: '1px solid #3b82f6',
  borderRadius: 8,
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 600,
  boxShadow: '0 8px 24px rgba(0,0,0,0.3)'
}

export default ConnectionLauncher
