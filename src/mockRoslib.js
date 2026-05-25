import ROSLIB from 'roslib'

const makeStamp = () => {
  const now = Date.now()
  return {
    sec: Math.floor(now / 1000),
    nanosec: (now % 1000) * 1000000
  }
}

function getScenarioFlags() {
  if (typeof window === 'undefined') {
    return new Set()
  }
  const param = new URLSearchParams(window.location.search).get('mockScenario') || ''
  return new Set(param.split(',').map((item) => item.trim()).filter(Boolean))
}

function createMockTfMessage(flags) {
  if (flags.has('missing-tf')) {
    return { transforms: [] }
  }
  return {
    transforms: [
      {
        header: { frame_id: 'map', stamp: makeStamp() },
        child_frame_id: 'odom',
        transform: {
          translation: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0, w: 1 }
        }
      },
      {
        header: { frame_id: 'odom', stamp: makeStamp() },
        child_frame_id: 'base_link',
        transform: {
          translation: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0, w: 1 }
        }
      }
    ]
  }
}

function createMockPointCloudBase64() {
  const pointStep = 16
  const pointCount = 64
  const buffer = new ArrayBuffer(pointStep * pointCount)
  const view = new DataView(buffer)
  for (let i = 0; i < pointCount; i++) {
    const offset = i * pointStep
    const angle = (i / pointCount) * Math.PI * 2
    const radius = 2 + (i % 8) * 0.1
    view.setFloat32(offset + 0, Math.cos(angle) * radius, true)
    view.setFloat32(offset + 4, Math.sin(angle) * radius, true)
    view.setFloat32(offset + 8, (i % 6) * 0.05, true)
  }
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return {
    header: { frame_id: 'base_link', stamp: makeStamp() },
    width: pointCount,
    height: 1,
    point_step: pointStep,
    is_bigendian: false,
    fields: [
      { name: 'x', offset: 0 },
      { name: 'y', offset: 4 },
      { name: 'z', offset: 8 }
    ],
    data: btoa(binary)
  }
}

function createMockPose(flags) {
  return {
    header: { frame_id: flags.has('pose-in-odom') ? 'odom' : 'map', stamp: makeStamp() },
    child_frame_id: 'base_link',
    pose: {
      pose: {
        position: { x: 1.2, y: 0.6, z: 0 },
        orientation: { x: 0, y: 0, z: 0.12, w: 0.99 }
      },
      covariance: new Array(36).fill(0)
    }
  }
}

function createMockOccupancyGrid(size, offset = 0) {
  const width = size
  const height = size
  const data = new Array(width * height).fill(0).map((_, index) => {
    const x = index % width
    const y = Math.floor(index / width)
    if (x === 0 || y === 0 || x === width - 1 || y === height - 1) return 100
    if ((x + y + offset) % 11 === 0) return 65
    return 0
  })
  return {
    header: { frame_id: 'map', stamp: makeStamp() },
    info: {
      width,
      height,
      resolution: 0.1,
      origin: {
        position: { x: -width * 0.05, y: -height * 0.05, z: 0 },
        orientation: { x: 0, y: 0, z: 0.05, w: 0.9987 }
      }
    },
    data
  }
}

function createMockPath(length, amplitude = 0.5, startX = 0) {
  return {
    header: { frame_id: 'map', stamp: makeStamp() },
    poses: new Array(length).fill(0).map((_, index) => ({
      header: { frame_id: 'map', stamp: makeStamp() },
      pose: {
        position: { x: startX + index * 0.25, y: Math.sin(index / 3) * amplitude, z: 0 },
        orientation: { x: 0, y: 0, z: 0, w: 1 }
      }
    }))
  }
}

function createMockLookaheadPoint() {
  return {
    header: { frame_id: 'map', stamp: makeStamp() },
    point: { x: 2.2, y: 0.35, z: 0 }
  }
}

function createTopicPayload(name, type, flags) {
  if (flags.has('missing-topic')) {
    if (name.includes('local_plan') || name.includes('localization_health')) {
      return null
    }
  }
  if (name === '/tf' || name === '/tf_static') return createMockTfMessage(flags)
  if (type.includes('PointCloud2')) return createMockPointCloudBase64()
  if (type.includes('Odometry') || type.includes('PoseWithCovarianceStamped') || type.includes('PoseStamped')) return createMockPose(flags)
  if (type.includes('OccupancyGrid')) {
    if (name.includes('local_costmap')) return createMockOccupancyGrid(30, 2)
    if (name.includes('global_costmap')) return createMockOccupancyGrid(60, 5)
    return createMockOccupancyGrid(50, 0)
  }
  if (type.includes('Path')) {
    if (name.includes('local_plan')) return createMockPath(12, 0.18, 1)
    return createMockPath(20, 0.35, 0.4)
  }
  if (type.includes('PointStamped')) return createMockLookaheadPoint()
  if (name.includes('localization_health')) {
    return { data: flags.has('stale-health') ? 'STALE' : 'OK' }
  }
  return { data: 'OK' }
}

export function installRoslibMock() {
  if (window.__roslibMockInstalled) return
  window.__roslibMockInstalled = true
  const flags = getScenarioFlags()

  class MockRos {
    constructor({ url }) {
      this.url = url
      this.handlers = {}
      setTimeout(() => this.handlers.connection?.(), 50)
    }
    on(event, handler) {
      this.handlers[event] = handler
    }
    close() {
      this.handlers.close?.()
    }
  }

  class MockTopic {
    constructor({ name, messageType }) {
      this.name = name
      this.messageType = messageType
      this.timer = null
    }
    subscribe(callback) {
      const emit = () => {
        const payload = createTopicPayload(this.name, this.messageType, flags)
        if (payload) callback(payload)
      }
      emit()
      this.timer = setInterval(emit, this.name.includes('costmap') ? 2500 : 1000)
    }
    unsubscribe() {
      if (this.timer) clearInterval(this.timer)
    }
  }

  class MockService {
    constructor({ name }) {
      this.name = name
    }
    callService(_request, onSuccess, onError) {
      setTimeout(() => {
        if (flags.has('service-fail') && !this.name.includes('map')) {
          onError?.(new Error(`${this.name} failed in mock scenario`))
          return
        }
        if (this.name.includes('map')) {
          onSuccess({ map: createMockOccupancyGrid(50, 1) })
        } else {
          onSuccess({ success: true, message: `${this.name} ok` })
        }
      }, 80)
    }
  }

  class MockActionClient {
    constructor({ serverName, actionName }) {
      this.serverName = serverName
      this.actionName = actionName
    }
  }

  class MockGoal {
    constructor({ actionClient, goalMessage }) {
      this.actionClient = actionClient
      this.goalMessage = goalMessage
      this.handlers = {}
    }
    on(event, handler) {
      this.handlers[event] = handler
    }
    send() {
      setTimeout(() => {
        this.handlers.feedback?.({ distance_remaining: 1.25, number_of_recoveries: flags.has('navigation-recovery') ? 1 : 0 })
      }, 120)
      setTimeout(() => {
        if (flags.has('navigation-fail')) {
          this.handlers.result?.({ result: { error_code: 42, message: 'mock navigation failure' } })
        } else {
          this.handlers.result?.({ result: { error_code: 0 } })
        }
      }, 300)
    }
    cancel() {
      this.handlers.result?.({ result: { error_code: 0, cancelled: true } })
    }
  }

  ROSLIB.Ros = MockRos
  ROSLIB.Topic = MockTopic
  ROSLIB.Service = MockService
  ROSLIB.ActionClient = MockActionClient
  ROSLIB.Goal = MockGoal
}
