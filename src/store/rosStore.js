import { create } from 'zustand'
import ROSLIB from 'roslib'
import { useAppStore } from './appStore'
import { applyTFMessage, lookupTransform, rosPositionToThree } from '../utils/transforms'
import * as THREE from 'three'

function applyTFToPointCloud(rawPoints, sourceFrame, targetFrame, tfTree) {
  const count = rawPoints.length / 3
  const out = new Float32Array(count * 3)
  let tf = null
  let tfQuat = null
  let tfPos = null

  if (sourceFrame && targetFrame && sourceFrame !== targetFrame && tfTree && tfTree.size > 0) {
    tf = lookupTransform(tfTree, sourceFrame, targetFrame)
    if (tf) {
      tfQuat = tf.quaternion
      tfPos = tf.position
    }
  }

  const tmp = new THREE.Vector3()
  for (let i = 0; i < count; i++) {
    const base = i * 3
    let rx = rawPoints[base]
    let ry = rawPoints[base + 1]
    let rz = rawPoints[base + 2]
    if (tf && tfQuat) {
      tmp.set(rx, ry, rz).applyQuaternion(tfQuat).add(tfPos)
      rx = tmp.x; ry = tmp.y; rz = tmp.z
    }
    // ROS → Three.js: (x,y,z) → (x, z, -y)
    out[base]     = rx
    out[base + 1] = rz
    out[base + 2] = -ry
  }
  return out
}

export const useRosStore = create((set, get) => ({
  ros: null,
  connected: false,
  connecting: false,
  connectionStatus: '未连接',
  errorMessage: '',

  // TF 变换树: key = "parent->child", value = { position: Vector3, quaternion: Quaternion }
  tfTree: new Map(),
  targetFrame: 'map',  // 渲染目标坐标系

  pointCloudData: null,
  pointCloudFrame: null,  // 点云的 frame_id
  robotPose: { x: 0, y: 0, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 },
  robotPoseFrame: null,  // 位姿的 frame_id
  mapData: null,
  mapFrame: null,  // 地图的 frame_id
  mapStatus: '未加载',

  _subscribers: [],
  _mapFetchTimer: null,

  connect: (host, port) => {
    const existing = get().ros
    if (existing) {
      try { existing.close() } catch (e) {}
    }

    set({
      connecting: true,
      connected: false,
      connectionStatus: `连接中 ${host}:${port}...`,
      errorMessage: '',
      tfTree: new Map(),
      pointCloudData: null,
      pointCloudFrame: null,
      robotPoseFrame: null,
      mapData: null,
      mapFrame: null,
      mapStatus: '未加载'
    })

    const ros = new ROSLIB.Ros({ url: `ws://${host}:${port}` })

    ros.on('connection', () => {
      console.log(`[ROS] 已连接 ${host}:${port}`)
      set({
        connected: true,
        connecting: false,
        connectionStatus: '已连接',
        errorMessage: ''
      })
      get().subscribeTopics()
    })

    ros.on('error', (error) => {
      console.error('[ROS] 错误:', error)
      console.error('[ROS] 连接失败可能原因：')
      console.error('  1. rosbridge 服务未启动 - 在机器人上运行: ros2 launch rosbridge_server rosbridge_websocket_launch.xml')
      console.error('  2. 机器人 IP 地址变了 - 检查机器人实际 IP')
      console.error('  3. 防火墙阻止 9090 端口')
      console.error('  4. 网络不通 - ping 192.168.1.247 测试')
      set({
        connected: false,
        connecting: false,
        connectionStatus: '连接失败',
        errorMessage: error?.toString?.() || '未知错误'
      })
    })

    ros.on('close', () => {
      console.log('[ROS] 连接关闭')
      set({
        connected: false,
        connecting: false,
        connectionStatus: '连接已断开'
      })
    })

    set({ ros })
  },

  disconnect: () => {
    const { ros, _subscribers, _mapFetchTimer } = get()
    if (_mapFetchTimer) clearTimeout(_mapFetchTimer)
    _subscribers.forEach(sub => {
      try { sub.unsubscribe() } catch (e) {}
    })
    if (ros) {
      try { ros.close() } catch (e) {}
    }
    set({
      ros: null,
      connected: false,
      connecting: false,
      connectionStatus: '未连接',
      _subscribers: [],
      tfTree: new Map(),
      pointCloudData: null,
      pointCloudFrame: null,
      robotPoseFrame: null,
      mapData: null,
      mapFrame: null,
      mapStatus: '未加载',
      _mapFetchTimer: null
    })
  },

  subscribeTopics: () => {
    const { ros, _subscribers } = get()
    if (!ros) return

    // 取消旧订阅
    _subscribers.forEach(sub => {
      try { sub.unsubscribe() } catch (e) {}
    })

    const { settings } = useAppStore.getState()
    const { topics, performance } = settings
    const recordMsg = useAppStore.getState().recordTopicMessage

    const newSubs = []

    // TF (静态)
    const tfStaticSub = new ROSLIB.Topic({
      ros,
      name: '/tf_static',
      messageType: 'tf2_msgs/TFMessage',
      queue_length: 1
    })
    tfStaticSub.subscribe((message) => {
      const tree = new Map(get().tfTree)  // 创建新 Map
      applyTFMessage(message, tree)
      set({ tfTree: tree })
      console.log('[TF] /tf_static 更新:', message.transforms?.length || 0, '个变换')
    })
    newSubs.push(tfStaticSub)

    // TF (动态)
    const tfSub = new ROSLIB.Topic({
      ros,
      name: '/tf',
      messageType: 'tf2_msgs/TFMessage',
      throttle_rate: 100,
      queue_length: 1
    })
    tfSub.subscribe((message) => {
      const tree = new Map(get().tfTree)  // 创建新 Map 引用，触发 React 更新
      applyTFMessage(message, tree)
      set({ tfTree: tree })
    })
    newSubs.push(tfSub)

    // 点云
    const pcSub = new ROSLIB.Topic({
      ros,
      name: topics.pointCloud,
      messageType: topics.pointCloudType,
      throttle_rate: performance.pointCloudThrottle,
      queue_length: 1
    })
    pcSub.subscribe((message) => {
      recordMsg(topics.pointCloud)
      try {
        const rawPoints = parsePointCloud2(message, performance.downsample)
        const frameId = message.header?.frame_id || null
        if (rawPoints.length === 0) {
          console.warn(`[PointCloud] 解析后 0 个点 (msg: w=${message.width} h=${message.height} step=${message.point_step})`)
          set({ pointCloudData: rawPoints, pointCloudFrame: frameId })
          return
        }
        // 立刻应用 TF 变换并转换为 Three.js 坐标，避免渲染时逐帧处理
        const { tfTree, targetFrame } = get()
        const points = applyTFToPointCloud(rawPoints, frameId, targetFrame, tfTree)
        if (!get()._pcLogged) {
          console.log(`[PointCloud] 接收到 ${points.length / 3} 个点 (原始 ${message.width * message.height}), frame=${frameId}`)
          set({ _pcLogged: true })
        }
        set({ pointCloudData: points, pointCloudFrame: frameId })
      } catch (e) {
        console.error('[PointCloud] 解析失败', e, message)
      }
    })
    newSubs.push(pcSub)

    // 位姿
    const poseSub = new ROSLIB.Topic({
      ros,
      name: topics.pose,
      messageType: topics.poseType,
      throttle_rate: performance.poseThrottle,
      queue_length: 1
    })
    poseSub.subscribe((message) => {
      recordMsg(topics.pose)
      // 支持多种位姿消息类型
      let pose
      let frameId = message.header?.frame_id || null
      if (message.pose?.pose) {
        // nav_msgs/Odometry 或 geometry_msgs/PoseWithCovarianceStamped
        pose = message.pose.pose
      } else if (message.pose) {
        // geometry_msgs/PoseStamped
        pose = message.pose
      } else {
        // 直接是 Pose 消息
        pose = message
      }

      if (!pose?.position) return
      set({
        robotPose: {
          x: pose.position.x,
          y: pose.position.y,
          z: pose.position.z,
          qx: pose.orientation.x,
          qy: pose.orientation.y,
          qz: pose.orientation.z,
          qw: pose.orientation.w
        },
        robotPoseFrame: frameId
      })
    })
    newSubs.push(poseSub)

    // 地图：先订阅实时更新，再用 GetMap 服务兜底获取 transient_local 历史地图。
    const mapSub = new ROSLIB.Topic({
      ros,
      name: topics.map,
      messageType: topics.mapType,
      queue_length: 1
    })
    mapSub.subscribe((message) => {
      get().handleMapMessage(message, `topic ${topics.map}`)
    })
    newSubs.push(mapSub)

    set({ _subscribers: newSubs })

    if (get()._mapFetchTimer) clearTimeout(get()._mapFetchTimer)
    const timer = setTimeout(() => {
      if (!get().mapData) get().fetchMap()
    }, 1200)
    set({ _mapFetchTimer: timer, mapStatus: '等待地图话题...' })
  },

  handleMapMessage: (message, source = 'topic') => {
    if (!message?.info || !message?.data) {
      console.warn('[Map] 收到无效地图消息', message)
      return
    }
    const { settings, recordTopicMessage } = useAppStore.getState()
    recordTopicMessage(settings.topics.map)
    const frameId = message.header?.frame_id || null
    console.log(`[Map] 收到地图消息 (${source})`, {
      width: message.info?.width,
      height: message.info?.height,
      resolution: message.info?.resolution,
      frame: frameId,
      dataType: typeof message.data,
      dataLen: message.data?.length
    })
    set({
      mapData: message,
      mapFrame: frameId,
      mapStatus: `已加载 ${message.info?.width || 0}x${message.info?.height || 0}`
    })
  },

  fetchMap: () => {
    const { ros, mapData } = get()
    if (!ros || mapData) return

    const services = [
      '/map_server/map',
      '/static_map',
      '/map',
      '/slam_toolbox/dynamic_map',
      '/dynamic_map'
    ]

    set({ mapStatus: '正在通过 GetMap 服务加载...' })

    const callServiceAt = (index) => {
      if (index >= services.length) {
        set({ mapStatus: '未收到地图，请检查 /map 或 /map_server/map' })
        return
      }

      if (get().mapData) return

      const name = services[index]
      console.log(`[Map] 尝试 GetMap 服务: ${name}`)
      set({ mapStatus: `正在加载 ${name}...` })

      let settled = false
      const timeout = setTimeout(() => {
        if (settled || get().mapData) return
        settled = true
        console.warn(`[Map] GetMap 服务超时: ${name}`)
        callServiceAt(index + 1)
      }, 60000)

      const service = new ROSLIB.Service({
        ros,
        name,
        serviceType: 'nav_msgs/srv/GetMap'
      })
      service.callService(
        new ROSLIB.ServiceRequest({}),
        (response) => {
          if (settled || get().mapData) return
          settled = true
          clearTimeout(timeout)
          const map = response?.map || response
          if (map?.info && map?.data) {
            get().handleMapMessage(map, `service ${name}`)
          } else {
            console.warn(`[Map] GetMap 服务无地图数据: ${name}`, response)
            callServiceAt(index + 1)
          }
        },
        (error) => {
          if (settled || get().mapData) return
          settled = true
          clearTimeout(timeout)
          console.warn(`[Map] GetMap 服务不可用: ${name}`, error)
          callServiceAt(index + 1)
        }
      )
    }

    callServiceAt(0)
  },

  // 在设置变更后重新订阅
  resubscribe: () => {
    if (get().connected) {
      get().subscribeTopics()
    }
  }
}))

function parsePointCloud2(msg, downsample = 5) {
  // rosbridge 默认以 base64 字符串传输 data
  let bytes
  if (typeof msg.data === 'string') {
    const bin = atob(msg.data)
    bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  } else if (msg.data instanceof Uint8Array) {
    bytes = msg.data
  } else if (Array.isArray(msg.data)) {
    bytes = new Uint8Array(msg.data)
  } else {
    return new Float32Array(0)
  }

  const dataView = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const pointStep = msg.point_step
  const numPoints = msg.width * msg.height

  // 找 x, y, z 字段的偏移
  let xOff = 0, yOff = 4, zOff = 8
  if (Array.isArray(msg.fields)) {
    for (const f of msg.fields) {
      if (f.name === 'x') xOff = f.offset
      else if (f.name === 'y') yOff = f.offset
      else if (f.name === 'z') zOff = f.offset
    }
  }

  const little = !msg.is_bigendian
  const step = Math.max(1, downsample)
  const outSize = Math.ceil(numPoints / step) * 3
  const points = new Float32Array(outSize)
  let idx = 0

  for (let i = 0; i < numPoints; i += step) {
    const offset = i * pointStep
    if (offset + 12 > bytes.byteLength) break
    const x = dataView.getFloat32(offset + xOff, little)
    const y = dataView.getFloat32(offset + yOff, little)
    const z = dataView.getFloat32(offset + zOff, little)
    if (isFinite(x) && isFinite(y) && isFinite(z)) {
      // 保留 ROS 原始坐标，稍后在渲染前应用 TF 变换
      points[idx++] = x
      points[idx++] = y
      points[idx++] = z
    }
  }

  return points.slice(0, idx)
}
