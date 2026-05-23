import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const SETTINGS_VERSION = 3  // 每次默认配置改动时递增

const DEFAULT_SETTINGS = {
  topics: {
    pointCloud: '/points2',
    pointCloudType: 'sensor_msgs/msg/PointCloud2',
    pose: '/odom',
    poseType: 'nav_msgs/msg/Odometry',
    map: '/map',
    mapType: 'nav_msgs/msg/OccupancyGrid'
  },
  performance: {
    downsample: 5,
    pointCloudThrottle: 100,
    poseThrottle: 50,
    pointSize: 0.05
  },
  display: {
    showGrid: true,
    showAxes: true,
    showFPS: false,
    showTopicMonitor: true,
    colorByHeight: true
  }
}

export const useAppStore = create(
  persist(
    (set, get) => ({
      // 已保存的机器人列表
      savedRobots: [
        { id: 'default', name: '机器狗 Alpha', host: '192.168.1.247', port: 9090 }
      ],

      // 当前选中的机器人
      currentRobotId: null,

      // UI 状态（不持久化通过 partialize 控制）
      showSettings: false,
      showConnectionManager: true,

      // 设置
      settings: DEFAULT_SETTINGS,

      // 话题统计（运行时，不持久化）
      topicStats: {},

      // ========== Actions ==========
      addRobot: (robot) => {
        const id = robot.id || Date.now().toString()
        set((state) => ({
          savedRobots: [...state.savedRobots.filter(r => r.id !== id), { ...robot, id }]
        }))
        return id
      },

      updateRobot: (id, updates) => {
        set((state) => ({
          savedRobots: state.savedRobots.map(r =>
            r.id === id ? { ...r, ...updates } : r
          )
        }))
      },

      removeRobot: (id) => {
        set((state) => ({
          savedRobots: state.savedRobots.filter(r => r.id !== id),
          currentRobotId: state.currentRobotId === id ? null : state.currentRobotId
        }))
      },

      setCurrentRobot: (id) => set({ currentRobotId: id }),

      getCurrentRobot: () => {
        const { savedRobots, currentRobotId } = get()
        return savedRobots.find(r => r.id === currentRobotId) || null
      },

      // UI
      toggleSettings: () => set((state) => ({ showSettings: !state.showSettings })),
      setShowConnectionManager: (show) => set({ showConnectionManager: show }),

      // 设置更新
      updateSettings: (path, value) => {
        set((state) => {
          const newSettings = JSON.parse(JSON.stringify(state.settings))
          const keys = path.split('.')
          let obj = newSettings
          for (let i = 0; i < keys.length - 1; i++) {
            obj = obj[keys[i]]
          }
          obj[keys[keys.length - 1]] = value
          return { settings: newSettings }
        })
      },

      resetSettings: () => set({ settings: DEFAULT_SETTINGS }),

      // 话题统计
      recordTopicMessage: (topicName) => {
        const now = Date.now()
        set((state) => {
          const stat = state.topicStats[topicName] || { hz: 0, lastUpdate: null, samples: [] }
          const samples = [...(stat.samples || []), now].slice(-20)
          let hz = 0
          if (samples.length >= 2) {
            const span = (samples[samples.length - 1] - samples[0]) / 1000
            hz = span > 0 ? (samples.length - 1) / span : 0
          }
          return {
            topicStats: {
              ...state.topicStats,
              [topicName]: { hz, lastUpdate: now, samples }
            }
          }
        })
      }
    }),
    {
      name: 'ros-viz-storage',
      version: SETTINGS_VERSION,
      partialize: (state) => ({
        savedRobots: state.savedRobots,
        currentRobotId: state.currentRobotId,
        settings: state.settings,
        _settingsVersion: SETTINGS_VERSION
      }),
      // 版本不匹配时强制重置 settings 到新默认值
      migrate: (persistedState, version) => {
        if (!persistedState || version !== SETTINGS_VERSION) {
          console.log('[AppStore] 设置版本变更，重置为新默认值')
          return {
            ...persistedState,
            settings: DEFAULT_SETTINGS,
            _settingsVersion: SETTINGS_VERSION
          }
        }
        return persistedState
      }
    }
  )
)
