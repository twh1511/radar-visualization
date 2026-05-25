import { DEFAULT_SETTINGS } from './defaultSettings'
import { getDeploymentProfile } from './deploymentProfiles'
import { getRobotPreset } from './robotPresets'

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
}

export function deepMerge(...sources) {
  return sources.reduce((acc, source) => mergeInto(acc, source), {})
}

function mergeInto(target, source) {
  if (!isPlainObject(source)) return target
  const next = { ...target }
  for (const [key, value] of Object.entries(source)) {
    if (Array.isArray(value)) {
      next[key] = [...value]
    } else if (isPlainObject(value)) {
      next[key] = mergeInto(isPlainObject(next[key]) ? next[key] : {}, value)
    } else if (value !== undefined) {
      next[key] = value
    }
  }
  return next
}

export function resolveRobotConfig(robot = {}, userSettings = {}, autoDiscoveredSettings = {}) {
  const preset = getRobotPreset(robot.robotPresetId)
  const profile = getDeploymentProfile(robot.deploymentProfileId || preset?.deploymentProfileId)
  const effectiveConfig = deepMerge(
    DEFAULT_SETTINGS,
    profile?.defaults || {},
    preset?.defaults || {},
    robot.settings || {},
    autoDiscoveredSettings || {},
    userSettings || {}
  )

  return {
    deploymentProfile: profile,
    robotPreset: preset,
    effectiveConfig,
    connection: {
      host: robot.host || '127.0.0.1',
      port: robot.port || 9090,
      path: robot.path || profile?.network?.rosbridgePath || ''
    },
    metadata: {
      environment: robot.environment || profile?.environment || 'real',
      localizationMode: robot.localizationMode || profile?.localizationMode || 'odom'
    }
  }
}
