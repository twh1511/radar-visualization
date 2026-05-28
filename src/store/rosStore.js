import { create } from 'zustand'
import ROSLIB from 'roslib'
import { useAppStore } from './appStore'
import { applyTFMessage, lookupTransform } from '../utils/transforms'
import { getRobotPreset } from '../config/robotPresets'
import * as THREE from 'three'

// 点云大流量连接的页面可见性监听器(单例)：切后台/锁屏时暂停点云，
// 避免灌爆服务端 rosbridge 发送缓冲(Python 不还内存→RSS 涨到 GB 级)。
let _cloudVisibilityHandler = null

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
  rosCloud: null,
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
  _cloudSubs: [],
  _cloudReconnectTimer: null,
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
    // 移除上一次连接残留的可见性监听器，避免重连后多个监听器叠加。
    if (_cloudVisibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', _cloudVisibilityHandler)
      _cloudVisibilityHandler = null
    }

    const runtimeProfile = useAppStore.getState().runtimeProfile
    const normalizedPath = path ? (path.startsWith('/') ? path : `/${path}`) : ''
    const url = `ws://${host}:${port}${normalizedPath}`

    // static map 是恒定的：重连到同一机器人时保留已加载的地图，不清空、不重取，
    // 避免每次(频繁)重连都把地图清掉→重新 GetMap→视觉上"一直在加载/闪"。
    // 只有切换到不同机器人(host 变)或主动 disconnect 时才清。
    const prev = get()
    const keepMap = prev._connectedHost === host && !!prev.mapData

    set({
      connecting: true,
      connected: false,
      connectionStatus: `连接中 ${host}:${port}${normalizedPath}...`,
      errorMessage: '',
      _connectedHost: host,
      tfTree: new Map(),
      targetFrame: useAppStore.getState().effectiveConfig.frames.targetFrame,
      pointCloudData: null,
      pointCloudFrame: null,
      robotPoseFrame: null,
      mapData: keepMap ? prev.mapData : null,
      mapFrame: keepMap ? prev.mapFrame : null,
      _mapSig: keepMap ? prev._mapSig : null,
      mapStatus: keepMap ? prev.mapStatus : '未加载',
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
      rosCloud: null,
      _cloudReconnectTimer: null,
      _cloudBackoff: 0,
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

    // 点云走独立的第二个 WebSocket 连接。点云是 5.7MB/s 大流量，会把所在连接的 TCP
    // 发送队列撑爆 → ping 超时 → 断连。把它与导航/位姿/地图(小流量)隔离到不同连接后，
    // 导航连接(ros)永不积压、永不断；点云连接(rosCloud)卡/断只影响点云本身，独立自动重连。
    const startCloud = () => {
      if (get().ros !== ros || !get().connected) return
      // 页面不可见(切后台/锁屏/最小化)时不开点云：否则 5.7MB/s 点云灌进不读的标签页，
      // 撑爆服务端 rosbridge 发送缓冲(Python 不还内存→RSS 涨到 GB 级)。恢复可见后由 visibilitychange 拉起。
      if (typeof document !== 'undefined' && document.hidden) return
      try { get().rosCloud?.close?.() } catch (e) {}
      const rosCloud = new ROSLIB.Ros({ url })
      rosCloud.on('connection', () => {
        if (get().rosCloud !== rosCloud) return
        set({ _cloudBackoff: 0 })  // 连上即重置退避
        get().subscribeCloud(rosCloud)
      })
      rosCloud.on('close', () => {
        if (get().rosCloud !== rosCloud) return
        if (get()._cloudReconnectTimer) clearTimeout(get()._cloudReconnectTimer)
        // 页面不可见时不重连，等恢复可见由 visibilitychange 拉起，避免对饱和 wifi 反复重灌。
        if (typeof document !== 'undefined' && document.hidden) {
          set({ rosCloud: null, _cloudReconnectTimer: null })
          return
        }
        // 指数退避 3s→6s→…→30s 封顶：带宽打满时别每 3s 重连又灌满 5.7MB/s。
        const delay = get()._cloudBackoff || 3000
        const t = setTimeout(() => startCloud(), delay)
        set({ _cloudReconnectTimer: t, _cloudBackoff: Math.min(delay * 2, 30000) })
      })
      rosCloud.on('error', () => {})  // 错误后会触发 close，统一在 close 里重连
      set({ rosCloud })
    }

    // 只有「当前活跃」连接的事件才允许改状态。重连时旧 ros 被 close()，其 close
    // 回调会异步触发；若不校验，它会把新连接的 connecting 重置为 false，导致
    // App 的重连 effect 再次 connect()，循环新建 WebSocket → 服务端订阅/连接堆积。
    ros.on('connection', () => {
      if (get().ros !== ros) return
      set({ connected: true, connecting: false, connectionStatus: '已连接', errorMessage: '' })
      get().autoDiscoverResources()
      setTimeout(() => { if (get().ros === ros) { get().subscribeTopics(); startCloud() } }, 150)
    })

    ros.on('error', (error) => {
      if (get().ros !== ros) return
      set({ connected: false, connecting: false, connectionStatus: '连接失败', errorMessage: error?.toString?.() || '未知错误' })
    })

    ros.on('close', () => {
      if (get().ros !== ros) return
      // 主连接断开：连同点云连接一起清理（避免悬挂的点云重连）
      if (get()._cloudReconnectTimer) clearTimeout(get()._cloudReconnectTimer)
      try { get().rosCloud?.close?.() } catch (e) {}
      set({ connected: false, connecting: false, connectionStatus: '连接已断开', rosCloud: null, _cloudReconnectTimer: null })
    })

    set({ ros })

    // 页面可见性联动：隐藏→关掉点云大流量连接并退订；恢复→重新订阅。
    // 这是根治"后台标签页/锁屏卡死消费者撑爆 rosbridge 内存"的核心开关。
    if (typeof document !== 'undefined') {
      if (_cloudVisibilityHandler) document.removeEventListener('visibilitychange', _cloudVisibilityHandler)
      _cloudVisibilityHandler = () => {
        if (get().ros !== ros) return
        if (document.hidden) {
          if (get()._cloudReconnectTimer) clearTimeout(get()._cloudReconnectTimer)
          ;(get()._cloudSubs || []).forEach((s) => { try { s.unsubscribe?.() } catch (e) {} })
          try { get().rosCloud?.close?.() } catch (e) {}
          set({ rosCloud: null, _cloudSubs: [], _cloudReconnectTimer: null })
        } else if (get().connected && !get().rosCloud) {
          set({ _cloudBackoff: 0 })
          startCloud()
        }
      }
      document.addEventListener('visibilitychange', _cloudVisibilityHandler)
    }
  },

  disconnect: () => {
    const { ros, rosCloud, _subscribers, _cloudSubs, _mapFetchTimer, _cloudReconnectTimer, _navigationGoalHandle } = get()
    if (_mapFetchTimer) clearTimeout(_mapFetchTimer)
    if (_cloudReconnectTimer) clearTimeout(_cloudReconnectTimer)
    if (_cloudVisibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', _cloudVisibilityHandler)
      _cloudVisibilityHandler = null
    }
    if (_navigationGoalHandle?.cancel) {
      try { _navigationGoalHandle.cancel() } catch (e) {}
    }
    _subscribers.forEach((sub) => {
      try { sub.unsubscribe() } catch (e) {}
    })
    ;(_cloudSubs || []).forEach((s) => { try { s.unsubscribe?.() } catch (e) {} })
    if (ros) {
      try { ros.close() } catch (e) {}
    }
    if (rosCloud) {
      try { rosCloud.close() } catch (e) {}
    }
    set({
      ros: null,
      rosCloud: null,
      _cloudSubs: [],
      _cloudReconnectTimer: null,
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

    // 点云不在此主连接订阅 —— 它走独立的 rosCloud 连接（见 subscribeCloud），
    // 与导航/位姿/地图隔离，避免点云大流量把主连接的发送队列撑爆导致导航断连。

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

    // 注意：costmap(尤其 global costmap ~1.5MB/s 全量重发)是大流量，不放在此导航连接，
    // 改到 rosCloud(见 subscribeCloud)，否则会堵塞导航连接让位姿等小数据断断续续。

    set({ _subscribers: newSubs, targetFrame: effectiveConfig.frames.targetFrame })

    if (get()._mapFetchTimer) clearTimeout(get()._mapFetchTimer)
    const timer = setTimeout(() => {
      if (!get().mapData) get().fetchMap(services.getMap)
      get().refreshDiagnostics()
    }, 1200)
    set({ _mapFetchTimer: timer, mapStatus: '等待地图话题...' })
  },

  // 大流量话题(点云 + 全局/局部 costmap)统一在 rosCloud(第二连接)订阅，与导航数据隔离。
  // 这条连接卡/断只影响这些大数据，导航连接(位姿/地图/路径)不受影响。
  subscribeCloud: (rosCloud) => {
    if (!rosCloud) return
    const { effectiveConfig } = useAppStore.getState()
    const { topics, performance } = effectiveConfig
    const recordMsg = useAppStore.getState().recordTopicMessage
    ;(get()._cloudSubs || []).forEach((s) => { try { s.unsubscribe?.() } catch (e) {} })
    const cloudSubs = []

    const pcSub = new ROSLIB.Topic({ ros: rosCloud, name: topics.pointCloud, messageType: topics.pointCloudType, throttle_rate: performance.pointCloudThrottle, queue_length: 1, compression: performance.pointCloudCompression || 'cbor' })
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
    cloudSubs.push(pcSub)

    // ⚠ costmap 只在「确实要显示」时才订阅。它们是大流量(global costmap ~1.5MB/帧)，
    // 不显示却订阅 = 白占满 WiFi → 连主连接 ping 都被冲断 → 整体每 10s 重连 → 地图一直重载。
    const display = effectiveConfig.display || {}
    if (effectiveConfig.capabilities.supportsCostmap && display.showGlobalCostmap) {
      // global costmap 是 ~1.5MB/帧全量栅格(nav2 always_send_full_costmap)，基本是静态层+膨胀、
      // 不用高频 → 限转发 0.2Hz(5s)，把它对 WiFi 的占用压到最低，避免饱和冲断连接。
      const globalCostmapSub = new ROSLIB.Topic({ ros: rosCloud, name: topics.globalCostmap, messageType: topics.globalCostmapType, queue_length: 1, throttle_rate: 5000 })
      globalCostmapSub.subscribe((message) => {
        recordMsg(topics.globalCostmap)
        set({ globalCostmap: message, globalCostmapFrame: message.header?.frame_id || null })
        get().refreshDiagnostics()
      })
      cloudSubs.push(globalCostmapSub)
    }

    if (effectiveConfig.capabilities.supportsCostmap && display.showLocalCostmap) {
      const localCostmapSub = new ROSLIB.Topic({ ros: rosCloud, name: topics.localCostmap, messageType: topics.localCostmapType, queue_length: 1, throttle_rate: 1000 })
      localCostmapSub.subscribe((message) => {
        recordMsg(topics.localCostmap)
        set({ localCostmap: message, localCostmapFrame: message.header?.frame_id || null })
        get().refreshDiagnostics()
      })
      cloudSubs.push(localCostmapSub)
    }

    set({ _cloudSubs: cloudSubs })
  },

  handleMapMessage: (message, source = 'topic') => {
    if (!message?.info || !message?.data) return
    const { effectiveConfig, recordTopicMessage } = useAppStore.getState()
    recordTopicMessage(effectiveConfig.topics.map)
    // 内容签名：map_server 常以 0.1Hz 反复重发同一张图，若每次都更新 mapData(新引用)，
    // MapDisplay 的 useMemo 会重建整张地图纹理→视觉上不停"加载/闪烁"。同图则跳过更新。
    const info = message.info
    const d = message.data
    const n = (d && d.length) || 0
    const sig = `${info.width}x${info.height}|${info.origin?.position?.x},${info.origin?.position?.y}|${n}|${n ? `${d[0]},${d[(n / 2) | 0]},${d[n - 1]}` : ''}`
    if (get().mapData && get()._mapSig === sig) return
    const frameId = message.header?.frame_id || null
    set((state) => ({
      mapData: message,
      _mapSig: sig,
      mapFrame: frameId,
      mapStatus: `已加载 ${info.width || 0}x${info.height || 0}`,
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
    const actionName = effectiveConfig.actions.navigateToPose
    // 优先用已选目标(地图点击)，否则机器人前方 1m
    const goal = goalPose || get().navigationGoal || {
      target_pose: {
        header: { frame_id: targetFrame },
        pose: {
          position: { x: robotPose.x + 1, y: robotPose.y, z: 0 },
          orientation: { x: 0, y: 0, z: robotPose.qz, w: robotPose.qw || 1 }
        }
      }
    }

    // ⚠ ROS2 nav2 用的是 ROS2 action 协议。roslib 的 ActionClient 是 ROS1 actionlib(发到
    // /navigate_to_pose/goal 话题)，ROS2 收不到 → 目标丢失、nav2 不规划。必须用 rosbridge
    // 的 send_action_goal op 直接发。args 是 NavigateToPose 的 Goal: { pose, behavior_tree }。
    const prev = get()._navigationGoalHandle
    if (prev?.listener && ros.socket?.removeEventListener) {
      try { ros.socket.removeEventListener('message', prev.listener) } catch (e) {}
    }
    const goalId = `nav_goal_${Date.now()}`

    // roslib 的 SocketAdapter 不分发 action_feedback/action_result，这里挂一个原始 socket
    // 监听器解析它们(rosbridge 默认以 JSON 文本帧回传)，用于显示导航状态/诊断 abort。
    const listener = (event) => {
      if (typeof event.data !== 'string') return
      let data
      try { data = JSON.parse(event.data) } catch (e) { return }
      if (!data || data.id !== goalId) return
      if (data.op === 'action_feedback') {
        const fb = data.values?.feedback || data.values || {}
        set({ navigationStatus: '导航中', navigationTask: { action: actionName, message: `剩余距离: ${fb?.distance_remaining ?? '-'}，恢复: ${fb?.number_of_recoveries ?? 0}`, feedback: fb } })
      } else if (data.op === 'action_result') {
        const ok = data.result !== false
        const res = data.values
        set({ navigationStatus: ok ? '导航结束' : '导航失败/拒绝', navigationTask: { action: actionName, message: `结果: ${JSON.stringify(res?.result ?? res ?? data.status ?? '—')}`, result: data } })
        try { ros.socket?.removeEventListener?.('message', listener) } catch (e) {}
      }
    }
    try { ros.socket?.addEventListener?.('message', listener) } catch (e) {}

    ros.callOnConnection({
      op: 'send_action_goal',
      id: goalId,
      action: actionName,
      action_type: 'nav2_msgs/action/NavigateToPose',
      args: { pose: goal.target_pose, behavior_tree: '' },
      feedback: true
    })

    set({
      navigationStatus: '导航请求已发送',
      navigationTask: { action: actionName, message: `目标已发送到 ${goal.target_pose?.header?.frame_id || targetFrame}（路径应显示在地图上）`, goal },
      navigationGoal: goal,
      _navigationGoalHandle: { goalId, action: actionName, listener }
    })
  },

  cancelNavigationAction: () => {
    const { ros, _navigationGoalHandle } = get()
    if (!ros || !_navigationGoalHandle?.goalId) {
      set({ navigationStatus: '无可取消任务', navigationTask: { message: '当前没有进行中的导航任务' } })
      return
    }
    ros.callOnConnection({ op: 'cancel_action_goal', id: _navigationGoalHandle.goalId, action: _navigationGoalHandle.action })
    if (_navigationGoalHandle.listener && ros.socket?.removeEventListener) {
      try { ros.socket.removeEventListener('message', _navigationGoalHandle.listener) } catch (e) {}
    }
    set({ navigationStatus: '导航取消中...', navigationTask: { message: '已发送取消请求' }, _navigationGoalHandle: null })
  },

  callNavigationService: (serviceKey) => {
    const { ros } = get()
    const { effectiveConfig } = useAppStore.getState()
    const serviceName = effectiveConfig.services[serviceKey]
    if (!ros || !serviceName) {
      set({ navigationStatus: '服务不可用', navigationTask: { message: `未找到服务 ${serviceKey}` } })
      return
    }

    // /relocalize 实测是 std_srvs/srv/Empty（不是 Trigger，类型不符会静默失败）
    const serviceType = serviceKey === 'relocalize' ? 'std_srvs/srv/Empty' : 'nav2_msgs/srv/ClearEntireCostmap'
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
