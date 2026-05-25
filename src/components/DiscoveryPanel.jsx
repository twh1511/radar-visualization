import React from 'react'
import { useAppStore } from '../store/appStore'
import { useRosStore } from '../store/rosStore'

function DiscoveryPanel() {
  const runtimeProfile = useAppStore((s) => s.runtimeProfile)
  const autoDiscoverResources = useRosStore((s) => s.autoDiscoverResources)
  const discoveryInProgress = useRosStore((s) => s._discoveryInProgress)
  const discoveryStatus = useRosStore((s) => s._discoveryStatus)
  const discoveryError = useRosStore((s) => s._discoveryError)

  const report = runtimeProfile.discoveryReport
  const recommendations = report?.recommendations || {}

  return (
    <div style={panelStyle}>
      <div style={titleStyle}>主动识别</div>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => autoDiscoverResources()}
        disabled={discoveryInProgress}
        style={{
          ...buttonStyle,
          opacity: discoveryInProgress ? 0.6 : 1,
          cursor: discoveryInProgress ? 'not-allowed' : 'pointer'
        }}
      >
        {discoveryInProgress ? '识别中...' : '立即执行识别'}
      </button>
      <div style={metaStyle}>状态：{discoveryStatus}</div>
      <div style={{ ...metaStyle, color: discoveryStatus === 'error' ? '#fca5a5' : '#93c5fd' }}>
        {discoveryError || report?.message || '尚未执行主动识别'}
      </div>
      {report?.updatedAt && (
        <div style={hintStyle}>最近识别时间：{new Date(report.updatedAt).toLocaleString()}</div>
      )}
      {Object.keys(recommendations).length > 0 && (
        <div style={hintStyle}>推荐覆盖：{Object.entries(recommendations).map(([k, v]) => `${k}=${v}`).join(', ')}</div>
      )}
    </div>
  )
}

const panelStyle = {
  position: 'absolute',
  right: 20,
  top: 56,
  zIndex: 1200,
  width: 260,
  background: 'rgba(10,10,10,0.92)',
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
const buttonStyle = {
  width: '100%',
  padding: '8px 10px',
  background: '#2563eb',
  color: 'white',
  border: '1px solid #3b82f6',
  borderRadius: 6,
  fontSize: 12
}
const metaStyle = {
  fontSize: 12,
  color: '#cbd5e1',
  marginTop: 8
}
const hintStyle = {
  fontSize: 11,
  color: '#6b7280',
  marginTop: 6
}

export default DiscoveryPanel
