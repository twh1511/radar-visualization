import React, { useEffect, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { useRosStore } from '../store/rosStore'

function TopicMonitor() {
  const effectiveConfig = useAppStore((s) => s.effectiveConfig)
  const runtimeProfile = useAppStore((s) => s.runtimeProfile)
  const topicStats = useAppStore((s) => s.topicStats)
  const mapData = useRosStore((s) => s.mapData)
  const mapStatus = useRosStore((s) => s.mapStatus)
  const diagnostics = useRosStore((s) => s.diagnostics)
  const navigationStatus = useRosStore((s) => s.navigationStatus)
  const showMonitor = effectiveConfig.display.showTopicMonitor
  const [, tick] = useState(0)

  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [])

  if (!showMonitor) return null

  const topics = [
    { label: '点云', name: effectiveConfig.topics.pointCloud },
    { label: '位姿', name: effectiveConfig.topics.pose, detail: diagnostics.poseSource?.mode ? `${diagnostics.poseSource.mode} / ${diagnostics.poseSource.frameId || '-'}` : null },
    { label: '地图', name: effectiveConfig.topics.map, detail: mapStatus !== '未加载' ? mapStatus : null, isMap: true },
    { label: '全局路径', name: effectiveConfig.topics.globalPlan },
    { label: '局部路径', name: effectiveConfig.topics.localPlan },
    { label: '全局代价地图', name: effectiveConfig.topics.globalCostmap },
    { label: '局部代价地图', name: effectiveConfig.topics.localCostmap },
    { label: '定位健康', name: effectiveConfig.topics.localizationHealth, detail: diagnostics.localizationHealthValue || null }
  ]

  return (
    <div style={panelStyle}>
      <div style={titleStyle}>运行监控</div>
      <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8 }}>
        {runtimeProfile.deploymentProfileName} / {runtimeProfile.localizationMode}
      </div>
      <div style={summaryStyle}>TF：{diagnostics.tfAvailable ? '已建立' : '未建立'}</div>
      <div style={summaryStyle}>地图来源：{diagnostics.lastMapSource || '未加载'}</div>
      <div style={summaryStyle}>导航状态：{navigationStatus}</div>
      {topics.map((topic) => {
        const stat = topicStats[topic.name]
        const fresh = (stat && (Date.now() - stat.lastUpdate < 2000)) || (topic.isMap && mapData)
        const hz = topic.isMap && mapData ? '已加载' : (stat ? stat.hz.toFixed(1) : '0.0')
        return (
          <div key={topic.name} style={rowStyle}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: fresh ? '#22c55e' : '#555' }} />
            <div style={{ flex: 1, fontSize: 11 }}>
              <div style={{ color: '#ccc' }}>{topic.label}</div>
              <div style={{ color: '#666', fontFamily: 'monospace' }}>{topic.name}</div>
              {topic.detail && <div style={{ color: '#7dd3fc', fontFamily: 'monospace' }}>{topic.detail}</div>}
            </div>
            <div style={{ color: fresh ? '#22c55e' : '#666', fontFamily: 'monospace', fontSize: 12 }}>
              {hz} Hz
            </div>
          </div>
        )
      })}
    </div>
  )
}

const panelStyle = {
  position: 'absolute',
  bottom: 20,
  right: 20,
  background: 'rgba(10,10,10,0.85)',
  backdropFilter: 'blur(8px)',
  border: '1px solid #2a2a2a',
  borderRadius: 8,
  padding: 12,
  minWidth: 260,
  color: 'white',
  zIndex: 900
}
const titleStyle = {
  fontSize: 11,
  color: '#888',
  marginBottom: 8,
  textTransform: 'uppercase',
  letterSpacing: 0.5
}
const summaryStyle = {
  fontSize: 11,
  color: '#93c5fd',
  marginBottom: 4
}
const rowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 0',
  borderTop: '1px solid #1f1f1f'
}

export default TopicMonitor
