import React, { useEffect, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { useRosStore } from '../store/rosStore'

function TopicMonitor() {
  const settings = useAppStore((s) => s.settings)
  const topicStats = useAppStore((s) => s.topicStats)
  const mapData = useRosStore((s) => s.mapData)
  const mapStatus = useRosStore((s) => s.mapStatus)
  const showMonitor = settings.display.showTopicMonitor
  const [, tick] = useState(0)

  // 每秒刷新显示
  useEffect(() => {
    const t = setInterval(() => tick(n => n + 1), 1000)
    return () => clearInterval(t)
  }, [])

  if (!showMonitor) return null

  const topics = [
    { label: '点云', name: settings.topics.pointCloud },
    { label: '位姿', name: settings.topics.pose },
    { label: '地图', name: settings.topics.map, detail: mapStatus !== '未加载' ? mapStatus : null, isMap: true }
  ]

  return (
    <div style={panelStyle}>
      <div style={titleStyle}>话题监控</div>
      {topics.map(t => {
        const stat = topicStats[t.name]
        const fresh = (stat && (Date.now() - stat.lastUpdate < 2000)) || (t.isMap && mapData)
        const hz = t.isMap && mapData ? '已加载' : (stat ? stat.hz.toFixed(1) : '0.0')
        return (
          <div key={t.name} style={rowStyle}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: fresh ? '#22c55e' : '#555' }} />
            <div style={{ flex: 1, fontSize: 11 }}>
              <div style={{ color: '#ccc' }}>{t.label}</div>
              <div style={{ color: '#666', fontFamily: 'monospace' }}>{t.name}</div>
              {t.detail && <div style={{ color: '#7dd3fc', fontFamily: 'monospace' }}>{t.detail}</div>}
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
  minWidth: 220,
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
const rowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 0',
  borderTop: '1px solid #1f1f1f'
}

export default TopicMonitor
