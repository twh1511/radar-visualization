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

export function buildRobotDraft(robot = {}, deploymentProfile = null, robotPreset = null) {
  return {
    ...robot,
    name: robot.name || robotPreset?.name || robot.host || 'unnamed-robot',
    host: robot.host || '127.0.0.1',
    port: robot.port || 9090,
    deploymentProfileId: robot.deploymentProfileId || robotPreset?.deploymentProfileId || deploymentProfile?.id,
    robotPresetId: robot.robotPresetId || robotPreset?.id,
    environment: robot.environment || deploymentProfile?.environment,
    localizationMode: robot.localizationMode || deploymentProfile?.localizationMode
  }
}

export function resolveRobotConfig(robot = {}, userSettings = {}, autoDiscoveredSettings = {}) {
  const preset = getRobotPreset(robot.robotPresetId)
  const profile = getDeploymentProfile(robot.deploymentProfileId || preset?.deploymentProfileId)
  const draftRobot = buildRobotDraft(robot, profile, preset)
  const effectiveConfig = deepMerge(
    DEFAULT_SETTINGS,
    profile?.defaults || {},
    preset?.defaults || {},
    draftRobot.settings || {},
    autoDiscoveredSettings || {},
    userSettings || {}
  )

  return {
    robot: draftRobot,
    deploymentProfile: profile,
    robotPreset: preset,
    effectiveConfig,
    connection: {
      host: draftRobot.host,
      port: draftRobot.port,
      path: draftRobot.path || profile?.network?.rosbridgePath || ''
    },
    metadata: {
      environment: draftRobot.environment || profile?.environment || 'real',
      localizationMode: draftRobot.localizationMode || profile?.localizationMode || 'odom'
    }
  }
}
