import React from 'react'
import { useAppStore } from '../store/appStore'
import { useRosStore } from '../store/rosStore'

function SettingsPanel() {
  const { settings, updateSettings, resetSettings, toggleSettings } = useAppStore()
  const resubscribe = useRosStore((s) => s.resubscribe)

  const handleTopicChange = (key, value) => {
    updateSettings(`topics.${key}`, value)
  }

  const handleApply = () => {
    resubscribe()
    toggleSettings()
  }

  return (
    <div style={panelStyle}>
      <div style={headerStyle}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>设置</div>
        <button onClick={toggleSettings} style={closeBtnStyle}>×</button>
      </div>

      <div style={bodyStyle}>
        <Section title="话题配置">
          <Field label="点云话题">
            <input style={inputStyle} value={settings.topics.pointCloud}
              onChange={(e) => handleTopicChange('pointCloud', e.target.value)} />
          </Field>
          <Field label="点云类型">
            <select style={inputStyle} value={settings.topics.pointCloudType}
              onChange={(e) => handleTopicChange('pointCloudType', e.target.value)}>
              <option value="sensor_msgs/PointCloud2">sensor_msgs/PointCloud2</option>
              <option value="sensor_msgs/msg/PointCloud2">sensor_msgs/msg/PointCloud2</option>
            </select>
          </Field>
          <Field label="位姿话题">
            <input style={inputStyle} value={settings.topics.pose}
              onChange={(e) => handleTopicChange('pose', e.target.value)} />
          </Field>
          <Field label="位姿类型">
            <select style={inputStyle} value={settings.topics.poseType}
              onChange={(e) => handleTopicChange('poseType', e.target.value)}>
              <option value="geometry_msgs/PoseStamped">geometry_msgs/PoseStamped</option>
              <option value="geometry_msgs/PoseWithCovarianceStamped">geometry_msgs/PoseWithCovarianceStamped</option>
              <option value="nav_msgs/Odometry">nav_msgs/Odometry</option>
            </select>
          </Field>
          <Field label="地图话题">
            <input style={inputStyle} value={settings.topics.map}
              onChange={(e) => handleTopicChange('map', e.target.value)} />
          </Field>
        </Section>

        <Section title="性能">
          <Field label={`点云降采样 (1=全部, 大=快): ${settings.performance.downsample}`}>
            <input type="range" min="1" max="20" style={{ width: '100%' }}
              value={settings.performance.downsample}
              onChange={(e) => updateSettings('performance.downsample', parseInt(e.target.value))} />
          </Field>
          <Field label={`点云接收频率 (ms): ${settings.performance.pointCloudThrottle}`}>
            <input type="range" min="50" max="500" step="50" style={{ width: '100%' }}
              value={settings.performance.pointCloudThrottle}
              onChange={(e) => updateSettings('performance.pointCloudThrottle', parseInt(e.target.value))} />
          </Field>
          <Field label={`点大小: ${settings.performance.pointSize}`}>
            <input type="range" min="0.01" max="0.3" step="0.01" style={{ width: '100%' }}
              value={settings.performance.pointSize}
              onChange={(e) => updateSettings('performance.pointSize', parseFloat(e.target.value))} />
          </Field>
        </Section>

        <Section title="显示">
          <Toggle label="显示网格" checked={settings.display.showGrid}
            onChange={(v) => updateSettings('display.showGrid', v)} />
          <Toggle label="显示坐标轴" checked={settings.display.showAxes}
            onChange={(v) => updateSettings('display.showAxes', v)} />
          <Toggle label="显示 FPS" checked={settings.display.showFPS}
            onChange={(v) => updateSettings('display.showFPS', v)} />
          <Toggle label="话题监控面板" checked={settings.display.showTopicMonitor}
            onChange={(v) => updateSettings('display.showTopicMonitor', v)} />
          <Toggle label="按高度着色点云" checked={settings.display.colorByHeight}
            onChange={(v) => updateSettings('display.colorByHeight', v)} />
        </Section>
      </div>

      <div style={footerStyle}>
        <button onClick={() => { if (confirm('重置所有设置？')) resetSettings() }} style={btnStyle}>
          重置
        </button>
        <button onClick={handleApply} style={{ ...btnStyle, background: '#2563eb', borderColor: '#3b82f6' }}>
          应用并重订阅
        </button>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display: 'block', fontSize: 11, color: '#aaa', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  )
}

function Toggle({ label, checked, onChange }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', cursor: 'pointer', fontSize: 13 }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span style={{ color: '#ccc' }}>{label}</span>
    </label>
  )
}

const panelStyle = {
  position: 'absolute',
  top: 44,
  right: 0,
  bottom: 0,
  width: 340,
  background: 'rgba(15,15,15,0.96)',
  backdropFilter: 'blur(10px)',
  borderLeft: '1px solid #2a2a2a',
  color: 'white',
  display: 'flex',
  flexDirection: 'column',
  zIndex: 1100
}
const headerStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '14px 18px',
  borderBottom: '1px solid #2a2a2a'
}
const closeBtnStyle = {
  background: 'transparent',
  border: 'none',
  color: '#888',
  fontSize: 24,
  cursor: 'pointer',
  lineHeight: 1
}
const bodyStyle = {
  flex: 1,
  overflowY: 'auto',
  padding: 18
}
const footerStyle = {
  display: 'flex',
  gap: 8,
  padding: 14,
  borderTop: '1px solid #2a2a2a'
}
const inputStyle = {
  width: '100%',
  padding: '6px 10px',
  background: '#0a0a0a',
  border: '1px solid #2a2a2a',
  borderRadius: 4,
  color: 'white',
  fontSize: 12,
  fontFamily: 'monospace',
  outline: 'none'
}
const btnStyle = {
  flex: 1,
  padding: '8px 12px',
  background: '#2a2a2a',
  color: 'white',
  border: '1px solid #3a3a3a',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 13
}

export default SettingsPanel
