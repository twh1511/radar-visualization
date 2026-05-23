import React, { useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Grid, Stats } from '@react-three/drei'
import PointCloud from './components/PointCloud'
import RobotPose from './components/RobotPose'
import MapDisplay from './components/MapDisplay'
import TopBar from './components/TopBar'
import ConnectionManager from './components/ConnectionManager'
import SettingsPanel from './components/SettingsPanel'
import TopicMonitor from './components/TopicMonitor'
import { useAppStore } from './store/appStore'
import { useRosStore } from './store/rosStore'

function App() {
  const {
    savedRobots,
    currentRobotId,
    showConnectionManager,
    showSettings,
    setShowConnectionManager,
    settings
  } = useAppStore()
  const { connect, connected, connecting } = useRosStore()

  // 启动时自动连接上次的机器人
  useEffect(() => {
    if (currentRobotId && !connected && !connecting) {
      const robot = savedRobots.find(r => r.id === currentRobotId)
      if (robot) {
        connect(robot.host, robot.port)
        setShowConnectionManager(false)
      }
    } else if (!currentRobotId) {
      setShowConnectionManager(true)
    }
    // eslint-disable-next-line
  }, [])

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#0a0a0a' }}>
      <TopBar />

      <Canvas
        style={{ position: 'absolute', top: 44, left: 0, right: 0, bottom: 0 }}
        camera={{ position: [8, 8, 8], fov: 60, near: 0.1, far: 1000 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        dpr={[1, 2]}
        frameloop="always"
      >
        <color attach="background" args={['#0f1419']} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 20, 10]} intensity={0.8} />

        {settings.display.showGrid && (
          <Grid
            args={[100, 100]}
            cellSize={1}
            cellThickness={0.5}
            cellColor="#2a3a4a"
            sectionSize={10}
            sectionThickness={1}
            sectionColor="#4a5a6a"
            fadeDistance={80}
            fadeStrength={1}
            infiniteGrid
          />
        )}

        {settings.display.showAxes && <axesHelper args={[1]} />}

        <MapDisplay />
        <PointCloud />
        <RobotPose />

        <OrbitControls
          enableDamping
          dampingFactor={0.08}
          minDistance={0.5}
          maxDistance={200}
          makeDefault
        />

        {settings.display.showFPS && <Stats />}
      </Canvas>

      <TopicMonitor />

      {showSettings && <SettingsPanel />}
      {showConnectionManager && <ConnectionManager />}
    </div>
  )
}

export default App
