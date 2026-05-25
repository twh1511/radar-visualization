import { create } from 'zustand'
import ROSLIB from 'roslib'
import { useAppStore } from './appStore'
import { applyTFMessage, lookupTransform } from '../utils/transforms'
import { getRobotPreset } from '../config/robotPresets'
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
      rx = tmp.x
      ry = tmp.y
      rz = tmp.z
    }
    out[base] = rx
    out[base + 1] = rz
    out[base + 2] = -ry
  }
  return out
}

function createPoseState(pose, frameId, sourceTopic, sourceType, sourceMode, stamp, covariance = null, childFrameId = null) {
  return {
    x: pose.position.x,
    y: pose.position.y,
    z: pose.position.z,
    qx: pose.orientation.x,
    qy: pose.orientation.y,
    qz: pose.orientation.z,
    qw: pose.orientation.w,
    frameId,
    childFrameId,
    sourceTopic,
    sourceType,
    sourceMode,
    stamp,
    covariance,
    isGlobalPose: frameId === 'map'
  }
}

function extractHealthValue(message) {
  if (typeof message?.data === 'string') return message.data
  if (typeof message?.data === 'number') return String(message.data)
  if (typeof message?.status === 'string') return message.status
  return JSON.stringify(message)
}

function evaluateTopicDiagnostics(topicStats, effectiveConfig, diagnostics, tfTree) {
  const now = Date.now()
  const requiredTopics = [
    effectiveConfig.topics.pointCloud,
    effectiveConfig.topics.pose,
    effectiveConfig.topics.map,
    effectiveConfig.topics.globalPlan,
    effectiveConfig.topics.localPlan,
    effectiveConfig.topics.localizationHealth
  ]
  if (effectiveConfig.capabilities.supportsCostmap) {
    requiredTopics.push(effectiveConfig.topics.globalCostmap, effectiveConfig.topics.localCostmap)
  }

  const missingTopics = requiredTopics.filter((topicName) => {
    const stat = topicStats[topicName]
    return !stat || !stat.lastUpdate || now - stat.lastUpdate > 15000
  })

  const frameReachable = tfTree.size > 0 && (diagnostics.poseSource?.frameId ? !!lookupTransform(tfTree, diagnostics.poseSource.frameId, effectiveConfig.frames.targetFrame) : true)

  return {
    ...diagnostics,
    missingTopics,
    tfAvailable: tfTree.size > 0 && frameReachable,
    localizationHealthState: diagnostics.localizationHealthFresh
      ? 'healthy'
      : diagnostics.localizationHealthValue
        ? 'stale'
        : 'missing'
  }
}

function createDiscoveryOverride(candidates, topicTypes = {}) {
  const topics = {}
  const topicTypeKeys = {
    pointCloud: 'pointCloudType',
    pose: 'poseType',
    map: 'mapType',
    globalPlan: 'globalPlanType',
    localPlan: 'localPlanType',
    lookaheadPoint: 'lookaheadPointType',
    localizationHealth: 'localizationHealthType',
    globalCostmap: 'globalCostmapType',
    localCostmap: 'localCostmapType'
  }

  for (const [key, value] of Object.entries(candidates)) {
    if (!value) continue
    topics[key] = value
    const type = topicTypes[value]
    if (type && topicTypeKeys[key]) {
      topics[topicTypeKeys[key]] = type
    }
  }

  return { topics }
}

export const useRosStore = create((set, get) => ({
  ros: null,
  connected: false,
  connecting: false,
  connectionStatus: '未连接',
  errorMessage: '',
  diagnostics: {
    bridgeMode: 'rosbridge',
    environment: 'real',
    localizationMode: 'odom',
    lastMapSource: null,
    tfAvailable: false,
    poseSource: null,
    localizationHealthValue: null,
    localizationHealthFresh: false,
    localizationHealthState: 'missing',
    missingTopics: []
  },

  tfTree: new Map(),
  targetFrame: 'map',

  pointCloudData: null,
  pointCloudFrame: null,
  robotPose: {
    x: 0, y: 0, z: 0, qx: 0, qy: 0, qz: 0, qw: 1,
    frameId: null,
    childFrameId: null,
    sourceTopic: null,
    sourceType: null,
    sourceMode: null,
    stamp: null,
    covariance: null,
    isGlobalPose: false
  },
  robotPoseFrame: null,
  mapData: null,
  mapFrame: null,
  mapStatus: '未加载',
  globalPlan: null,
  globalPlanFrame: null,
  localPlan: null,
  localPlanFrame: null,
  lookaheadPoint: null,
  localizationHealth: null,
  globalCostmap: null,
  globalCostmapFrame: null,
  localCostmap: null,
  localCostmapFrame: null,
  navigationTask: null,
  navigationStatus: '空闲',
  navigationGoal: null,
  navigationGoalValidity: null,

  setNavigationGoal: (goal, validity = null) => set({
    navigationGoal: goal,
    navigationGoalValidity: validity,
    navigationStatus: '已选择目标点',
    navigationTask: {
      message: `已选择导航点 (${goal?.target_pose?.pose?.position?.x?.toFixed?.(2) ?? '-'}, ${goal?.target_pose?.pose?.position?.y?.toFixed?.(2) ?? '-'})`
    }
  }),

  clearNavigationGoal: () => set({
    navigationGoal: null,
    navigationGoalValidity: null,
    navigationStatus: '空闲',
    navigationTask: { message: '已清除待发送导航点' }
  }),

  _subscribers: [],
  _mapFetchTimer: null,
  _navigationActionClient: null,
  _navigationGoalHandle: null,
  _discoveryInProgress: false,
  _discoveryStatus: 'idle',
  _discoveryError: '',

  refreshDiagnostics: () => {
    const { diagnostics, tfTree } = get()
    const { topicStats, effectiveConfig } = useAppStore.getState()
    set({ diagnostics: evaluateTopicDiagnostics(topicStats, effectiveConfig, diagnostics, tfTree) })
  },

  autoDiscoverResources: () => {
    const { ros, _discoveryInProgress } = get()
    const { currentRobot, setAutoDiscoveredSettings, setDiscoveryReport } = useAppStore.getState()
    if (!ros || !currentRobot || _discoveryInProgress) return

    set({ _discoveryInProgress: true, _discoveryStatus: 'running', _discoveryError: '' })

    const preset = getRobotPreset(currentRobot.robotPresetId)
    const candidates = preset?.discoveryCandidates || {}
    const service = new ROSLIB.Service({
      ros,
      name: '/rosapi/topics_and_raw_types',
      serviceType: 'rosapi/TopicsAndRawTypes'
    })

    service.callService(
      new ROSLIB.ServiceRequest({}),
      (response) => {
        const topics = response?.topics || []
        const types = response?.types || []
        const topicTypes = Object.fromEntries(topics.map((topic, index) => [topic, types[index]]))
        const discovered = {}
        for (const [key, options] of Object.entries(candidates)) {
          const match = options.find((name) => topics.includes(name))
          if (match) discovered[key] = match
        }
        const report = {
          reachable: true,
          env: {},
          topics,
          topicTypes,
          services: [],
          actions: [],
          recommendations: discovered,
          status: topics.length > 2 ? 'success' : 'partial',
          message: topics.length > 2 ? `识别到 ${topics.length} 个 topics` : '只识别到基础图谱，请检查 domain/discovery 配置'
        }
        setAutoDiscoveredSettings(currentRobot.id, createDiscoveryOverride(discovered, topicTypes))
        setDiscoveryReport(currentRobot.id, report)
        set({ _discoveryInProgress: false, _discoveryStatus: report.status, _discoveryError: '' })
      },
      (error) => {
        const report = { reachable: false, env: {}, topics: [], topicTypes: {}, services: [], actions: [], recommendations: {}, status: 'error', message: error?.toString?.() || '执行识别失败' }
        setAutoDiscoveredSettings(currentRobot.id, {})
        setDiscoveryReport(currentRobot.id, report)
        set({ _discoveryInProgress: false, _discoveryStatus: 'error', _discoveryError: report.message })
      }
    )
  },

  connect: (host, port, path = '') => {
    const existing = get().ros
    if (existing) {
      try { existing.close() } catch (e) {}
    }

    const runtimeProfile = useAppStore.getState().runtimeProfile
    const normalizedPath = path ? (path.startsWith('/') ? path : `/${path}`) : ''
    const url = `ws://${host}:${port}${normalizedPath}`

    set({
      connecting: true,
      connected: false,
      connectionStatus: `连接中 ${host}:${port}${normalizedPath}...`,
      errorMessage: '',
      tfTree: new Map(),
      targetFrame: useAppStore.getState().effectiveConfig.frames.targetFrame,
      pointCloudData: null,
      pointCloudFrame: null,
      robotPoseFrame: null,
      mapData: null,
      mapFrame: null,
      mapStatus: '未加载',
      globalPlan: null,
      globalPlanFrame: null,
      localPlan: null,
      localPlanFrame: null,
      lookaheadPoint: null,
      localizationHealth: null,
      globalCostmap: null,
      globalCostmapFrame: null,
      localCostmap: null,
      localCostmapFrame: null,
      navigationTask: null,
      navigationStatus: '空闲',
      navigationGoal: null,
      _navigationActionClient: null,
      _navigationGoalHandle: null,
      diagnostics: {
        bridgeMode: runtimeProfile.network.bridgeMode || 'rosbridge',
        environment: runtimeProfile.environment,
        localizationMode: runtimeProfile.localizationMode,
        lastMapSource: null,
        tfAvailable: false,
        poseSource: null,
        localizationHealthValue: null,
        localizationHealthFresh: false,
        localizationHealthState: 'missing',
        missingTopics: []
      }
    })

    const ros = new ROSLIB.Ros({ url })

    ros.on('connection', () => {
      set({ connected: true, connecting: false, connectionStatus: '已连接', errorMessage: '' })
      get().autoDiscoverResources()
      setTimeout(() => get().subscribeTopics(), 150)
    })

    ros.on('error', (error) => {
      set({ connected: false, connecting: false, connectionStatus: '连接失败', errorMessage: error?.toString?.() || '未知错误' })
    })

    ros.on('close', () => {
      set({ connected: false, connecting: false, connectionStatus: '连接已断开' })
    })

    set({ ros })
  },

  disconnect: () => {
    const { ros, _subscribers, _mapFetchTimer, _navigationGoalHandle } = get()
    if (_mapFetchTimer) clearTimeout(_mapFetchTimer)
    if (_navigationGoalHandle?.cancel) {
      try { _navigationGoalHandle.cancel() } catch (e) {}
    }
    _subscribers.forEach((sub) => {
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
      globalPlan: null,
      globalPlanFrame: null,
      localPlan: null,
      localPlanFrame: null,
      lookaheadPoint: null,
      localizationHealth: null,
      globalCostmap: null,
      globalCostmapFrame: null,
      localCostmap: null,
      localCostmapFrame: null,
      navigationTask: null,
      navigationStatus: '空闲',
      navigationGoal: null,
      _mapFetchTimer: null,
      _navigationActionClient: null,
      _navigationGoalHandle: null,
      diagnostics: {
        ...get().diagnostics,
        lastMapSource: null,
        tfAvailable: false,
        poseSource: null,
        localizationHealthValue: null,
        localizationHealthFresh: false,
        localizationHealthState: 'missing',
        missingTopics: []
      }
    })
  },

  subscribeTopics: () => {
    const { ros, _subscribers } = get()
    if (!ros) return

    _subscribers.forEach((sub) => {
      try { sub.unsubscribe() } catch (e) {}
    })

    const { effectiveConfig, runtimeProfile } = useAppStore.getState()
    const { topics, performance, services } = effectiveConfig
    const recordMsg = useAppStore.getState().recordTopicMessage
    const newSubs = []

    const tfStaticSub = new ROSLIB.Topic({ ros, name: '/tf_static', messageType: 'tf2_msgs/TFMessage', queue_length: 1 })
    tfStaticSub.subscribe((message) => {
      const tree = new Map(get().tfTree)
      applyTFMessage(message, tree)
      set((state) => ({ tfTree: tree, diagnostics: evaluateTopicDiagnostics(useAppStore.getState().topicStats, effectiveConfig, state.diagnostics, tree) }))
    })
    newSubs.push(tfStaticSub)

    const tfSub = new ROSLIB.Topic({ ros, name: '/tf', messageType: 'tf2_msgs/TFMessage', throttle_rate: 100, queue_length: 1 })
    tfSub.subscribe((message) => {
      const tree = new Map(get().tfTree)
      applyTFMessage(message, tree)
      set((state) => ({ tfTree: tree, diagnostics: evaluateTopicDiagnostics(useAppStore.getState().topicStats, effectiveConfig, state.diagnostics, tree) }))
    })
    newSubs.push(tfSub)

    const pcSub = new ROSLIB.Topic({ ros, name: topics.pointCloud, messageType: topics.pointCloudType, throttle_rate: performance.pointCloudThrottle, queue_length: 1 })
    pcSub.subscribe((message) => {
      recordMsg(topics.pointCloud)
      try {
        const rawPoints = parsePointCloud2(message, performance.downsample)
        const frameId = message.header?.frame_id || null
        if (rawPoints.length === 0) {
          set({ pointCloudData: rawPoints, pointCloudFrame: frameId })
          get().refreshDiagnostics()
          return
        }
        const { tfTree, targetFrame } = get()
        const points = applyTFToPointCloud(rawPoints, frameId, targetFrame, tfTree)
        set({ pointCloudData: points, pointCloudFrame: frameId })
        get().refreshDiagnostics()
      } catch (e) {
        console.error('[PointCloud] 解析失败', e, message)
      }
    })
    newSubs.push(pcSub)

    const poseSub = new ROSLIB.Topic({ ros, name: topics.pose, messageType: topics.poseType, throttle_rate: performance.poseThrottle, queue_length: 1 })
    poseSub.subscribe((message) => {
      recordMsg(topics.pose)
      let pose
      let covariance = null
      const frameId = message.header?.frame_id || null
      const stamp = message.header?.stamp || null
      const childFrameId = message.child_frame_id || null
      if (message.pose?.pose) {
        pose = message.pose.pose
        covariance = message.pose.covariance || null
      } else if (message.pose) {
        pose = message.pose
        covariance = message.covariance || null
      } else {
        pose = message
      }
      if (!pose?.position) return

      const poseState = createPoseState(pose, frameId, topics.pose, topics.poseType, runtimeProfile.localizationMode, stamp, covariance, childFrameId)
      set((state) => ({
        robotPose: poseState,
        robotPoseFrame: frameId,
        diagnostics: evaluateTopicDiagnostics(useAppStore.getState().topicStats, effectiveConfig, {
          ...state.diagnostics,
          poseSource: { topic: topics.pose, type: topics.poseType, mode: runtimeProfile.localizationMode, frameId }
        }, get().tfTree)
      }))
    })
    newSubs.push(poseSub)

    const mapSub = new ROSLIB.Topic({ ros, name: topics.map, messageType: topics.mapType, queue_length: 1 })
    mapSub.subscribe((message) => get().handleMapMessage(message, `topic ${topics.map}`))
    newSubs.push(mapSub)

    const globalPlanSub = new ROSLIB.Topic({ ros, name: topics.globalPlan, messageType: topics.globalPlanType, queue_length: 1 })
    globalPlanSub.subscribe((message) => {
      recordMsg(topics.globalPlan)
      set({ globalPlan: message, globalPlanFrame: message.header?.frame_id || null })
      get().refreshDiagnostics()
    })
    newSubs.push(globalPlanSub)

    const localPlanSub = new ROSLIB.Topic({ ros, name: topics.localPlan, messageType: topics.localPlanType, queue_length: 1 })
    localPlanSub.subscribe((message) => {
      recordMsg(topics.localPlan)
      set({ localPlan: message, localPlanFrame: message.header?.frame_id || null })
      get().refreshDiagnostics()
    })
    newSubs.push(localPlanSub)

    const lookaheadSub = new ROSLIB.Topic({ ros, name: topics.lookaheadPoint, messageType: topics.lookaheadPointType, queue_length: 1 })
    lookaheadSub.subscribe((message) => {
      recordMsg(topics.lookaheadPoint)
      set({ lookaheadPoint: message })
    })
    newSubs.push(lookaheadSub)

    const localizationHealthSub = new ROSLIB.Topic({ ros, name: topics.localizationHealth, messageType: topics.localizationHealthType, queue_length: 1 })
    localizationHealthSub.subscribe((message) => {
      recordMsg(topics.localizationHealth)
      const now = Date.now()
      set((state) => ({
        localizationHealth: message,
        diagnostics: evaluateTopicDiagnostics(useAppStore.getState().topicStats, effectiveConfig, {
          ...state.diagnostics,
          localizationHealthValue: extractHealthValue(message),
          localizationHealthFresh: true,
          localizationHealthUpdatedAt: now
        }, get().tfTree)
      }))
    })
    newSubs.push(localizationHealthSub)

    if (effectiveConfig.capabilities.supportsCostmap) {
      const globalCostmapSub = new ROSLIB.Topic({ ros, name: topics.globalCostmap, messageType: topics.globalCostmapType, queue_length: 1 })
      globalCostmapSub.subscribe((message) => {
        recordMsg(topics.globalCostmap)
        set({ globalCostmap: message, globalCostmapFrame: message.header?.frame_id || null })
        get().refreshDiagnostics()
      })
      newSubs.push(globalCostmapSub)

      const localCostmapSub = new ROSLIB.Topic({ ros, name: topics.localCostmap, messageType: topics.localCostmapType, queue_length: 1 })
      localCostmapSub.subscribe((message) => {
        recordMsg(topics.localCostmap)
        set({ localCostmap: message, localCostmapFrame: message.header?.frame_id || null })
        get().refreshDiagnostics()
      })
      newSubs.push(localCostmapSub)
    }

    set({ _subscribers: newSubs, targetFrame: effectiveConfig.frames.targetFrame })

    if (get()._mapFetchTimer) clearTimeout(get()._mapFetchTimer)
    const timer = setTimeout(() => {
      if (!get().mapData) get().fetchMap(services.getMap)
      get().refreshDiagnostics()
    }, 1200)
    set({ _mapFetchTimer: timer, mapStatus: '等待地图话题...' })
  },

  handleMapMessage: (message, source = 'topic') => {
    if (!message?.info || !message?.data) return
    const { effectiveConfig, recordTopicMessage } = useAppStore.getState()
    recordTopicMessage(effectiveConfig.topics.map)
    const frameId = message.header?.frame_id || null
    set((state) => ({
      mapData: message,
      mapFrame: frameId,
      mapStatus: `已加载 ${message.info?.width || 0}x${message.info?.height || 0}`,
      diagnostics: evaluateTopicDiagnostics(useAppStore.getState().topicStats, effectiveConfig, {
        ...state.diagnostics,
        lastMapSource: source
      }, get().tfTree)
    }))
  },

  fetchMap: (serviceNames) => {
    const { ros, mapData } = get()
    if (!ros || mapData) return
    const services = serviceNames?.length ? serviceNames : ['/map_server/map', '/static_map', '/map', '/slam_toolbox/dynamic_map', '/dynamic_map']
    set({ mapStatus: '正在通过 GetMap 服务加载...' })

    const callServiceAt = (index) => {
      if (index >= services.length) {
        set({ mapStatus: '未收到地图，请检查 /map 或 /map_server/map' })
        return
      }
      if (get().mapData) return
      const name = services[index]
      set({ mapStatus: `正在加载 ${name}...` })

      let settled = false
      const timeout = setTimeout(() => {
        if (settled || get().mapData) return
        settled = true
        callServiceAt(index + 1)
      }, 60000)

      const service = new ROSLIB.Service({ ros, name, serviceType: 'nav_msgs/srv/GetMap' })
      service.callService(
        new ROSLIB.ServiceRequest({}),
        (response) => {
          if (settled || get().mapData) return
          settled = true
          clearTimeout(timeout)
          const map = response?.map || response
          if (map?.info && map?.data) get().handleMapMessage(map, `service ${name}`)
          else callServiceAt(index + 1)
        },
        () => {
          if (settled || get().mapData) return
          settled = true
          clearTimeout(timeout)
          callServiceAt(index + 1)
        }
      )
    }

    callServiceAt(0)
  },

  triggerNavigationAction: (goalPose = null) => {
    const { ros, robotPose } = get()
    const { effectiveConfig } = useAppStore.getState()
    if (!get().connected || !ros) {
      set({ navigationStatus: '未连接', navigationTask: { message: '请先连接机器人后再发送导航任务' } })
      return
    }

    const targetFrame = effectiveConfig.frames.targetFrame
    const goal = goalPose || {
      target_pose: {
        header: { frame_id: targetFrame },
        pose: {
          position: { x: robotPose.x + 1, y: robotPose.y, z: 0 },
          orientation: { x: 0, y: 0, z: robotPose.qz, w: robotPose.qw || 1 }
        }
      }
    }

    const actionClient = new ROSLIB.ActionClient({ ros, serverName: effectiveConfig.actions.navigateToPose, actionName: 'nav2_msgs/action/NavigateToPose' })
    const goalHandle = new ROSLIB.Goal({ actionClient, goalMessage: goal })

    goalHandle.on('feedback', (feedback) => {
      set({
        navigationStatus: '导航中',
        navigationTask: {
          action: effectiveConfig.actions.navigateToPose,
          message: `剩余距离：${feedback?.distance_remaining ?? '-'}，恢复次数：${feedback?.number_of_recoveries ?? 0}`,
          feedback
        }
      })
    })

    goalHandle.on('result', (result) => {
      set({
        navigationStatus: result?.result?.cancelled ? '导航已取消' : '导航完成',
        navigationTask: {
          action: effectiveConfig.actions.navigateToPose,
          message: result?.result?.error_code ? `导航结束，错误码 ${result.result.error_code}` : '导航完成',
          result
        },
        _navigationGoalHandle: null
      })
    })

    goalHandle.send()
    set({
      navigationStatus: '导航请求已发送',
      navigationTask: { action: effectiveConfig.actions.navigateToPose, message: `目标已发送到 ${targetFrame}`, goal },
      navigationGoal: goal,
      _navigationActionClient: actionClient,
      _navigationGoalHandle: goalHandle
    })
  },

  cancelNavigationAction: () => {
    const { _navigationGoalHandle } = get()
    if (!_navigationGoalHandle?.cancel) {
      set({ navigationStatus: '无可取消任务', navigationTask: { message: '当前没有进行中的导航任务' } })
      return
    }
    _navigationGoalHandle.cancel()
    set({ navigationStatus: '导航取消中...', navigationTask: { message: '已发送取消请求' } })
  },

  callNavigationService: (serviceKey) => {
    const { ros } = get()
    const { effectiveConfig } = useAppStore.getState()
    const serviceName = effectiveConfig.services[serviceKey]
    if (!ros || !serviceName) {
      set({ navigationStatus: '服务不可用', navigationTask: { message: `未找到服务 ${serviceKey}` } })
      return
    }

    const serviceType = serviceKey === 'relocalize' ? 'std_srvs/srv/Trigger' : 'nav2_msgs/srv/ClearEntireCostmap'
    const service = new ROSLIB.Service({ ros, name: serviceName, serviceType })
    set({ navigationStatus: `调用 ${serviceKey} 中...` })

    service.callService(
      new ROSLIB.ServiceRequest({}),
      (response) => {
        set({
          navigationStatus: `${serviceKey} 已完成`,
          navigationTask: { action: serviceName, message: response?.message || response?.success?.toString?.() || `${serviceKey} 已完成` }
        })
      },
      (error) => {
        set({
          navigationStatus: `${serviceKey} 调用失败`,
          navigationTask: { action: serviceName, message: error?.toString?.() || `${serviceKey} 调用失败` }
        })
      }
    )
  },

  resubscribe: () => {
    if (get().connected) get().subscribeTopics()
  }
}))

function parsePointCloud2(msg, downsample = 5) {
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
      points[idx++] = x
      points[idx++] = y
      points[idx++] = z
    }
  }

  return points.slice(0, idx)
}
