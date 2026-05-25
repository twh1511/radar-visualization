export const RENDER_PROFILES = {
  'high-quality': {
    dpr: [1.25, 2],
    antialias: true,
    powerPreference: 'high-performance',
    pointSizeMultiplier: 1.1,
    showStatsByDefault: true
  },
  balanced: {
    dpr: [1, 1.5],
    antialias: true,
    powerPreference: 'high-performance',
    pointSizeMultiplier: 1,
    showStatsByDefault: false
  },
  'low-latency': {
    dpr: [1, 1],
    antialias: false,
    powerPreference: 'low-power',
    pointSizeMultiplier: 0.9,
    showStatsByDefault: false
  }
}

export function getRenderProfile(profileId) {
  return RENDER_PROFILES[profileId] || RENDER_PROFILES.balanced
}
