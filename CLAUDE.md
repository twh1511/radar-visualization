# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start the Vite dev server.
- `npm run build` — create a production build in `dist/`.
- `npm run preview` — serve the built app locally.
- `npm run serve:product` — serve the built `dist/` bundle on port 3000 with Python.
- There is no test runner or linter configured in `package.json`.
- There is no single-test command because no test framework is set up.

## Project context

This is a React + Vite frontend for ROS2 robot visualization over `rosbridge` WebSocket. It behaves like a lightweight web RViz: users connect to one of several saved robots, subscribe to ROS topics, and render point clouds, robot pose, and occupancy maps in a Three.js scene.

The README and docs are oriented around a robot at `192.168.1.247` running `rosbridge_server` on port `9090`. The frontend assumes the browser can reach that host directly over WebSocket.

## Architecture

### App shell and rendering pipeline

- `src/main.jsx` mounts the app.
- `src/App.jsx` is the composition root. It creates the full-screen layout, top bar, settings and connection overlays, topic monitor, and the main `@react-three/fiber` canvas.
- The Three.js scene is always present; feature components (`MapDisplay`, `PointCloud`, `RobotPose`) render from shared Zustand state rather than owning their own transport logic.

### State split: app state vs ROS runtime state

The app intentionally separates persistent UI/configuration state from live ROS connection state:

- `src/store/appStore.js` stores persisted user state with Zustand `persist`: saved robots, selected robot, deployment/profile selection, merged effective settings inputs, deploy/discovery status, and topic frequency stats.
- `src/store/rosStore.js` owns the live `ROSLIB.Ros` connection, current connection status, active topic subscriptions, TF tree, navigation action state, and latest incoming ROS data (`pointCloudData`, `robotPose`, `mapData`, plans, costmaps, health topics).

When changing behavior, keep this boundary intact: configuration, profiles, and remembered robot metadata belong in `appStore`; live transport/subscription/action logic belongs in `rosStore`.

### Configuration resolution pipeline

Robot-specific runtime settings are not sourced from a single file. `resolveRobotConfig()` in `src/config/configResolver.js` merges, in order: `DEFAULT_SETTINGS`, deployment-profile defaults, robot-preset defaults, per-robot overrides, auto-discovered settings, and global user settings. `appStore` recomputes `effectiveConfig`, `connectionProfile`, and `runtimeProfile` from that merged result.

If a setting seems to “come from nowhere”, check all layers before editing defaults. In practice:

- deployment-wide assumptions live in `src/config/deploymentProfiles.js`
- robot-family assumptions and discovery candidates live in `src/config/robotPresets.js`
- global fallback defaults live in `src/config/defaultSettings.js`
- browser-discovered or imported deploy-discovered topics/env override those defaults at runtime

This layered merge is now the source of truth; `src/config.js` is legacy documentation-era config, not the active runtime pipeline.

### Connection, discovery, and subscription flow

- `ConnectionManager` is no longer just a host/port form: it selects deployment profiles and robot presets, saves robot metadata, imports deploy-side discovery JSON, and generates deployment manifests.
- `App.jsx` auto-reconnects to the last selected robot on startup if one is persisted.
- `rosStore.connect()` creates a `ROSLIB.Ros` WebSocket client using the resolved connection path from `connectionProfile` / deployment profile.
- On connection, `rosStore.autoDiscoverResources()` calls `/rosapi/topics_and_raw_types` to match live topics against preset-specific candidate lists, stores the result in `appStore.discoveredSettingsByRobotId`, then `subscribeTopics()` rebuilds subscriptions from the merged `effectiveConfig`.
- `SettingsPanel` updates persisted settings first, then explicitly calls `resubscribe()` when the user clicks “应用并重订阅”, so topic/config edits do not take effect until resubscription.

This means topic and capability behavior is partly declarative and partly discovery-driven; when debugging a wrong subscription, inspect both the saved settings and the latest discovery report.

### Visualization and navigation data flow

- `PointCloud.jsx` consumes `pointCloudData` from `rosStore`, writes it into a reusable `THREE.BufferGeometry`, and derives per-vertex colors from height when enabled.
- `MapDisplay.jsx` converts incoming `nav_msgs/OccupancyGrid` data into a canvas-backed texture and places it in the scene as a plane.
- `RobotPose.jsx` updates a simple robot marker every frame from the latest pose in `rosStore`.
- `NavigationOverlay.jsx` renders global/local plans, lookahead point, active goal marker, and optional costmap layers from `rosStore`, transforming them into the current target frame through the TF tree.
- `NavigationControls.jsx` and `NavigationGoalPanel.jsx` drive goal selection and navigation status from the same store rather than owning their own transport clients.
- `TopicMonitor.jsx` reads rolling message timestamps from `appStore.topicStats` to compute approximate Hz and freshness.

### TF and frame handling

Navigation and point-cloud overlays depend on the TF tree in `src/store/rosStore.js` plus helpers in `src/utils/transforms.js`. Point clouds may be transformed through TF before the ROS→Three remap, while plans/costmaps/goal markers are projected into `effectiveConfig.frames.targetFrame`.

If a navigation overlay is missing or offset while raw topics are arriving, check TF availability and target-frame resolution before changing rendering code.

### Coordinate-system conventions

This repo contains explicit ROS→Three.js coordinate transforms and they are central to correct rendering:

- Point clouds are transformed in `parsePointCloud2()` inside `src/store/rosStore.js`: ROS `(x forward, y left, z up)` becomes Three.js `(x right/forward in scene, y up, z forward/back)` via `(x, z, -y)`.
- Robot pose uses the same convention in `src/components/RobotPose.jsx` for both position and quaternion remapping.
- Occupancy maps are flipped vertically in `src/components/MapDisplay.jsx` because ROS map origin is bottom-left while canvas texture origin is top-left.

If a rendering change looks “almost right but rotated/flipped”, check these transforms first before changing scene controls or sensor parsing.

## Deployment tooling

This repo now includes browser-assisted deployment metadata plus shell deployment assets under `deploy/`.

- `ConnectionManager` can generate a deploy manifest in memory from the currently resolved robot/runtime config.
- `src/config/deployManifest.js` is the manifest builder and YAML serializer; it merges robot identity, deployment profile networking, discovered environment variables, and resolved UI topic/action/service settings into a single artifact.
- `deploy/scripts/deploy.sh` renders templates, copies files to the robot over SSH/SCP, installs service assets remotely, restarts services, and performs minimal health checks.
- `deploy/scripts/discover-robot.py` produces JSON that the UI can import so manifest generation prefers real robot env values over profile defaults.

The deploy flow is intentionally asymmetric: the browser prepares artifacts/status, but actual remote execution still happens outside the app via shell scripts.

## Important files

- `src/App.jsx` — top-level scene and UI composition.
- `src/store/appStore.js` — persisted robot list, settings, and topic stats.
- `src/store/rosStore.js` — WebSocket lifecycle, subscriptions, PointCloud2 parsing, latest ROS message cache.
- `src/components/ConnectionManager.jsx` — saved robot management and connect flow.
- `src/components/SettingsPanel.jsx` — user-editable topic/type/performance/display settings.
- `src/components/PointCloud.jsx`, `src/components/MapDisplay.jsx`, `src/components/RobotPose.jsx` — renderers for the three primary ROS data streams.

## Documentation-derived constraints

From `README.md`, `docs/SETUP.md`, and `deploy/README.md`:

- The app is intended to connect to ROS2 through `rosbridge_server`, typically launched with `ros2 launch rosbridge_server rosbridge_websocket_launch.xml` on the robot.
- The documented operator workflow is Windows frontend + remote ROS2 robot.
- Cluster-style deployments may require FastDDS discovery-server wiring and `ROS_SUPER_CLIENT=TRUE`; this assumption is encoded in some deployment profiles and setup docs.
- Topic names in docs and topic names in current persisted defaults are not fully aligned; verify whether a requested change should update documentation-era defaults (`src/config.js`) or the active layered runtime config (`src/config/defaultSettings.js`, deployment profiles, robot presets, or persisted state).
- `src/config.js` is not the active source of truth for subscriptions in the current app flow.
