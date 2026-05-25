import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_SETTINGS } from '../config/defaultSettings'
import { DEPLOYMENT_PROFILES } from '../config/deploymentProfiles'
import { ROBOT_PRESETS } from '../config/robotPresets'
import { resolveRobotConfig } from '../config/configResolver'

const SETTINGS_VERSION = 7

const DEFAULT_ROBOT = {
  id: 'default',
  name: '机器狗 Alpha',
  host: '192.168.1.247',
  port: 9090,
  deploymentProfileId: 'generic-rosbridge',
  robotPresetId: 'generic-radar-viz',
  environment: 'real',
  localizationMode: 'odom',
  settings: {}
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function resolveState(state) {
  const robots = state.savedRobots?.length ? state.savedRobots : [DEFAULT_ROBOT]
  const currentRobotId = state.currentRobotId || robots[0]?.id || null
  const currentRobot = robots.find((robot) => robot.id === currentRobotId) || robots[0] || null
  const currentRobotDiscovery = state.discoveredSettingsByRobotId?.[currentRobotId] || {}
  const currentDiscoveryReport = state.discoveryReportsByRobotId?.[currentRobotId] || null
  const currentDeployStatus = state.deployStatusByRobotId?.[currentRobotId] || null
  const resolved = resolveRobotConfig(currentRobot, state.settings, currentRobotDiscovery)

  return {
    ...state,
    savedRobots: robots,
    currentRobotId,
    deploymentProfiles: DEPLOYMENT_PROFILES,
    robotPresets: ROBOT_PRESETS,
    currentRobot: resolved.robot,
    effectiveConfig: resolved.effectiveConfig,
    connectionProfile: resolved.connection,
    runtimeProfile: {
      deploymentProfileId: currentRobot?.deploymentProfileId || DEPLOYMENT_PROFILES[0].id,
      deploymentProfileName: resolved.deploymentProfile?.name || DEPLOYMENT_PROFILES[0].name,
      robotPresetId: currentRobot?.robotPresetId || ROBOT_PRESETS[0].id,
      robotPresetName: resolved.robotPreset?.name || ROBOT_PRESETS[0].name,
      environment: resolved.metadata.environment,
      localizationMode: resolved.metadata.localizationMode,
      network: resolved.deploymentProfile?.network || {},
      autoDiscoveredTopics: currentRobotDiscovery.topics || {},
      discoveryReport: currentDiscoveryReport,
      deployStatus: currentDeployStatus
    }
  }
}

export const useAppStore = create(
  persist(
    (set, get) => resolveState({
      savedRobots: [DEFAULT_ROBOT],
      currentRobotId: null,
      showSettings: false,
      showConnectionManager: true,
      // 仅存放用户显式覆盖（稀疏）。完整生效配置由 resolveRobotConfig 合并
      // DEFAULT_SETTINGS→部署档案→机器人预设→自动识别→本层 得到 effectiveConfig。
      settings: {},
      topicStats: {},
      discoveredSettingsByRobotId: {},
      discoveryReportsByRobotId: {},
      deployStatusByRobotId: {},

      addRobot: (robot) => {
        const id = robot.id || Date.now().toString()
        set((state) => resolveState({
          ...state,
          savedRobots: [
            ...state.savedRobots.filter((item) => item.id !== id),
            {
              ...DEFAULT_ROBOT,
              ...robot,
              id,
              settings: clone(robot.settings || {})
            }
          ]
        }))
        return id
      },

      updateRobot: (id, updates) => {
        set((state) => resolveState({
          ...state,
          savedRobots: state.savedRobots.map((robot) =>
            robot.id === id
              ? {
                  ...robot,
                  ...updates,
                  settings: updates.settings ? clone(updates.settings) : robot.settings
                }
              : robot
          )
        }))
      },

      removeRobot: (id) => {
        set((state) => {
          const nextDiscovered = { ...state.discoveredSettingsByRobotId }
          delete nextDiscovered[id]
          return resolveState({
            ...state,
            savedRobots: state.savedRobots.filter((robot) => robot.id !== id),
            currentRobotId: state.currentRobotId === id ? null : state.currentRobotId,
            discoveredSettingsByRobotId: nextDiscovered
          })
        })
      },

      setCurrentRobot: (id) => set((state) => resolveState({ ...state, currentRobotId: id })),

      getCurrentRobot: () => get().currentRobot,

      getCurrentDeploymentProfile: () => {
        const { deploymentProfiles, runtimeProfile } = get()
        return deploymentProfiles.find((profile) => profile.id === runtimeProfile.deploymentProfileId) || deploymentProfiles[0]
      },

      getCurrentRobotPreset: () => {
        const { robotPresets, runtimeProfile } = get()
        return robotPresets.find((preset) => preset.id === runtimeProfile.robotPresetId) || robotPresets[0]
      },

      toggleSettings: () => set((state) => ({ showSettings: !state.showSettings })),
      setShowConnectionManager: (show) => set((state) => ({
        showConnectionManager: show,
        showSettings: show ? false : state.showSettings
      })),

      updateSettings: (path, value) => {
        set((state) => {
          const newSettings = clone(state.settings)
          const keys = path.split('.')
          let obj = newSettings
          for (let i = 0; i < keys.length - 1; i++) {
            // settings 是稀疏的，按需创建中间层级
            if (obj[keys[i]] == null || typeof obj[keys[i]] !== 'object') obj[keys[i]] = {}
            obj = obj[keys[i]]
          }
          obj[keys[keys.length - 1]] = value
          return resolveState({ ...state, settings: newSettings })
        })
      },

      resetSettings: () => set((state) => resolveState({ ...state, settings: {} })),

      applyDeploymentProfile: (profileId) => {
        set((state) => {
          const currentRobotId = state.currentRobotId || state.savedRobots[0]?.id
          return resolveState({
            ...state,
            savedRobots: state.savedRobots.map((robot) =>
              robot.id === currentRobotId
                ? {
                    ...robot,
                    deploymentProfileId: profileId,
                    settings: {}
                  }
                : robot
            )
          })
        })
      },

      applyRobotPreset: (presetId) => {
        set((state) => {
          const currentRobotId = state.currentRobotId || state.savedRobots[0]?.id
          return resolveState({
            ...state,
            savedRobots: state.savedRobots.map((robot) =>
              robot.id === currentRobotId
                ? {
                    ...robot,
                    robotPresetId: presetId,
                    settings: {}
                  }
                : robot
            )
          })
        })
      },

      setAutoDiscoveredSettings: (robotId, discoveredSettings) => {
        set((state) => resolveState({
          ...state,
          discoveredSettingsByRobotId: {
            ...state.discoveredSettingsByRobotId,
            [robotId]: discoveredSettings
          }
        }))
      },

      setDiscoveryReport: (robotId, report) => {
        set((state) => resolveState({
          ...state,
          discoveryReportsByRobotId: {
            ...state.discoveryReportsByRobotId,
            [robotId]: {
              source: report?.source || state.discoveryReportsByRobotId?.[robotId]?.source || 'browser-rosapi',
              envSource: report?.envSource || state.discoveryReportsByRobotId?.[robotId]?.envSource || 'unknown',
              ...report,
              updatedAt: Date.now()
            }
          }
        }))
      },

      setDeployStatus: (robotId, status) => {
        set((state) => resolveState({
          ...state,
          deployStatusByRobotId: {
            ...state.deployStatusByRobotId,
            [robotId]: {
              ...status,
              updatedAt: Date.now()
            }
          }
        }))
      },

      clearAutoDiscoveredSettings: (robotId) => {
        set((state) => {
          const nextDiscovered = { ...state.discoveredSettingsByRobotId }
          delete nextDiscovered[robotId]
          return resolveState({ ...state, discoveredSettingsByRobotId: nextDiscovered })
        })
      },

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
        discoveredSettingsByRobotId: state.discoveredSettingsByRobotId,
        _settingsVersion: SETTINGS_VERSION
      }),
      migrate: (persistedState, version) => {
        if (!persistedState || version !== SETTINGS_VERSION) {
          console.log('[AppStore] 设置版本变更，重置为新默认值')
          return {
            ...persistedState,
            savedRobots: persistedState?.savedRobots?.length ? persistedState.savedRobots.map((robot) => ({
              ...DEFAULT_ROBOT,
              ...robot,
              settings: clone(robot.settings || {})
            })) : [DEFAULT_ROBOT],
            // 旧版本里 settings 是完整 DEFAULT_SETTINGS 克隆（会覆盖档案/预设/识别）；
            // 新模型改为稀疏，迁移时清空，让 effectiveConfig 重新按合并链生效。
            settings: {},
            discoveredSettingsByRobotId: persistedState?.discoveredSettingsByRobotId || {},
            _settingsVersion: SETTINGS_VERSION
          }
        }
        return {
          ...persistedState,
          savedRobots: persistedState.savedRobots?.map((robot) => ({
            ...DEFAULT_ROBOT,
            ...robot,
            settings: clone(robot.settings || {})
          })) || [DEFAULT_ROBOT],
          settings: persistedState.settings ? clone(persistedState.settings) : {},
          discoveredSettingsByRobotId: persistedState.discoveredSettingsByRobotId || {},
          _settingsVersion: SETTINGS_VERSION
        }
      }
    }
  )
)
