import React, { useState, useEffect } from 'react'
import { useAppStore } from '../store/appStore'
import { useRosStore } from '../store/rosStore'

function ConnectionManager() {
  const {
    savedRobots,
    currentRobotId,
    addRobot,
    removeRobot,
    updateRobot,
    setCurrentRobot,
    setShowConnectionManager
  } = useAppStore()

  const { connect, connecting, connectionStatus, errorMessage } = useRosStore()

  const [name, setName] = useState('')
  const [host, setHost] = useState('192.168.1.247')
  const [port, setPort] = useState('9090')
  const [selectedId, setSelectedId] = useState(currentRobotId)

  useEffect(() => {
    if (selectedId) {
      const robot = savedRobots.find(r => r.id === selectedId)
      if (robot) {
        setName(robot.name)
        setHost(robot.host)
        setPort(String(robot.port))
      }
    }
  }, [selectedId])

  const handleConnect = () => {
    if (!host) return
    const portNum = parseInt(port) || 9090
    let id = selectedId
    if (!id) {
      id = addRobot({ name: name || host, host, port: portNum })
    } else {
      updateRobot(id, { name: name || host, host, port: portNum })
    }
    setCurrentRobot(id)
    connect(host, portNum)
    setShowConnectionManager(false)
  }

  const handleSave = () => {
    if (!host) return
    const portNum = parseInt(port) || 9090
    if (selectedId) {
      updateRobot(selectedId, { name: name || host, host, port: portNum })
    } else {
      const id = addRobot({ name: name || host, host, port: portNum })
      setSelectedId(id)
    }
  }

  const handleNew = () => {
    setSelectedId(null)
    setName('')
    setHost('')
    setPort('9090')
  }

  const handleDelete = (id) => {
    if (confirm('确认删除此机器人配置？')) {
      removeRobot(id)
      if (selectedId === id) handleNew()
    }
  }

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={headerStyle}>
          <h2 style={{ margin: 0, fontSize: 20 }}>ROS2 可视化客户端</h2>
          <p style={{ margin: '6px 0 0', color: '#888', fontSize: 13 }}>
            连接到你的机器人 (需要在机器人端运行 rosbridge_server)
          </p>
        </div>

        <div style={contentStyle}>
          <div style={{ flex: '0 0 240px', borderRight: '1px solid #2a2a2a', paddingRight: 16 }}>
            <div style={sectionTitleStyle}>已保存的机器人</div>
            <div style={{ marginTop: 8, maxHeight: 320, overflowY: 'auto' }}>
              {savedRobots.length === 0 && (
                <div style={{ color: '#666', fontSize: 13, padding: 8 }}>暂无</div>
              )}
              {savedRobots.map(r => (
                <div
                  key={r.id}
                  onClick={() => setSelectedId(r.id)}
                  style={{
                    ...robotItemStyle,
                    background: selectedId === r.id ? '#2563eb' : 'transparent',
                    borderColor: selectedId === r.id ? '#3b82f6' : '#2a2a2a'
                  }}
                >
                  <div style={{ fontWeight: 500 }}>{r.name}</div>
                  <div style={{ fontSize: 11, color: selectedId === r.id ? '#cbd5e1' : '#888' }}>
                    {r.host}:{r.port}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(r.id) }}
                    style={deleteBtnStyle}
                    title="删除"
                  >×</button>
                </div>
              ))}
            </div>
            <button onClick={handleNew} style={{ ...btnStyle, marginTop: 12, width: '100%' }}>
              + 新建连接
            </button>
          </div>

          <div style={{ flex: 1, paddingLeft: 16 }}>
            <div style={sectionTitleStyle}>连接配置</div>

            <div style={fieldStyle}>
              <label style={labelStyle}>名称</label>
              <input
                style={inputStyle}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例: 机器狗 Alpha"
              />
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>IP 地址 *</label>
              <input
                style={inputStyle}
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="192.168.1.247"
              />
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>端口</label>
              <input
                style={inputStyle}
                value={port}
                onChange={(e) => setPort(e.target.value)}
                placeholder="9090"
              />
            </div>

            {(connecting || errorMessage) && (
              <div style={{
                padding: 10,
                marginTop: 12,
                borderRadius: 6,
                background: errorMessage ? '#3f1d1d' : '#1e3a5f',
                color: errorMessage ? '#fca5a5' : '#93c5fd',
                fontSize: 13
              }}>
                {errorMessage || connectionStatus}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button
                onClick={handleConnect}
                disabled={!host || connecting}
                style={{
                  ...primaryBtnStyle,
                  opacity: (!host || connecting) ? 0.5 : 1,
                  cursor: (!host || connecting) ? 'not-allowed' : 'pointer'
                }}
              >
                {connecting ? '连接中...' : '连接'}
              </button>
              <button onClick={handleSave} style={btnStyle}>保存配置</button>
            </div>

            <div style={{ marginTop: 20, padding: 12, background: '#1a1a1a', borderRadius: 6, fontSize: 12, color: '#888' }}>
              <div style={{ fontWeight: 600, color: '#aaa', marginBottom: 6 }}>提示</div>
              <div>机器人端需要先启动 rosbridge：</div>
              <code style={{ display: 'block', marginTop: 4, padding: 6, background: '#0a0a0a', borderRadius: 4, color: '#9cdcfe' }}>
                ros2 launch rosbridge_server rosbridge_websocket_launch.xml
              </code>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const overlayStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.75)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 2000,
  backdropFilter: 'blur(8px)'
}
const modalStyle = {
  background: '#141414',
  color: 'white',
  borderRadius: 12,
  width: 720,
  maxWidth: '92vw',
  border: '1px solid #2a2a2a',
  boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
  overflow: 'hidden'
}
const headerStyle = {
  padding: '20px 24px',
  borderBottom: '1px solid #2a2a2a',
  background: 'linear-gradient(135deg, #1e3a8a, #1e1b4b)'
}
const contentStyle = {
  display: 'flex',
  padding: 20
}
const sectionTitleStyle = {
  fontSize: 13,
  fontWeight: 600,
  color: '#aaa',
  textTransform: 'uppercase',
  letterSpacing: 0.5
}
const robotItemStyle = {
  position: 'relative',
  padding: '10px 12px',
  borderRadius: 6,
  marginBottom: 6,
  cursor: 'pointer',
  border: '1px solid #2a2a2a',
  fontSize: 13
}
const deleteBtnStyle = {
  position: 'absolute',
  top: 4,
  right: 6,
  background: 'transparent',
  border: 'none',
  color: '#888',
  cursor: 'pointer',
  fontSize: 18,
  lineHeight: 1,
  padding: '0 4px'
}
const fieldStyle = {
  marginTop: 12
}
const labelStyle = {
  display: 'block',
  fontSize: 12,
  color: '#aaa',
  marginBottom: 4
}
const inputStyle = {
  width: '100%',
  padding: '8px 12px',
  background: '#0a0a0a',
  border: '1px solid #2a2a2a',
  borderRadius: 6,
  color: 'white',
  fontSize: 14,
  outline: 'none',
  fontFamily: 'monospace'
}
const btnStyle = {
  padding: '8px 16px',
  background: '#2a2a2a',
  color: 'white',
  border: '1px solid #3a3a3a',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 500
}
const primaryBtnStyle = {
  ...btnStyle,
  background: '#2563eb',
  border: '1px solid #3b82f6',
  flex: 1
}

export default ConnectionManager
