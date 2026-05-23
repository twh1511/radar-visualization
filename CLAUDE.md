# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start the Vite dev server.
- `npm run build` — create a production build in `dist/`.
- `npm run preview` — serve the built app locally.
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

- `src/store/appStore.js` stores persisted user state with Zustand `persist`: saved robots, selected robot, topic names/types, display toggles, and performance settings. It also keeps transient topic frequency stats.
- `src/store/rosStore.js` owns the live `ROSLIB.Ros` connection, current connection status, active topic subscriptions, and latest incoming data (`pointCloudData`, `robotPose`, `mapData`).

When changing behavior, keep this boundary intact: configuration belongs in `appStore`, live transport/subscription logic belongs in `rosStore`.

### Connection and subscription flow

- `ConnectionManager` edits/saves robot endpoints and initiates `connect(host, port)`.
- `App.jsx` auto-reconnects to the last selected robot on startup if one is persisted.
- `rosStore.connect()` creates a `ROSLIB.Ros` WebSocket client and, on successful connection, calls `subscribeTopics()`.
- `subscribeTopics()` reads the latest topic names/types and throttle settings from `useAppStore.getState()`, unsubscribes old topics, and recreates subscriptions.
- `SettingsPanel` updates persisted settings first, then explicitly calls `resubscribe()` when the user clicks “应用并重订阅”, so topic/config edits do not take effect until resubscription.

This means settings changes are not purely reactive; if you change subscription-related UX, account for the explicit apply step.

### Visualization data flow

- `PointCloud.jsx` consumes `pointCloudData` from `rosStore`, writes it into a reusable `THREE.BufferGeometry`, and derives per-vertex colors from height when enabled.
- `MapDisplay.jsx` converts incoming `nav_msgs/OccupancyGrid` data into a canvas-backed texture and places it in the scene as a plane.
- `RobotPose.jsx` updates a simple robot marker every frame from the latest pose in `rosStore`.
- `TopicMonitor.jsx` reads rolling message timestamps from `appStore.topicStats` to compute approximate Hz and freshness.

### Coordinate-system conventions

This repo contains explicit ROS→Three.js coordinate transforms and they are central to correct rendering:

- Point clouds are transformed in `parsePointCloud2()` inside `src/store/rosStore.js`: ROS `(x forward, y left, z up)` becomes Three.js `(x right/forward in scene, y up, z forward/back)` via `(x, z, -y)`.
- Robot pose uses the same convention in `src/components/RobotPose.jsx` for both position and quaternion remapping.
- Occupancy maps are flipped vertically in `src/components/MapDisplay.jsx` because ROS map origin is bottom-left while canvas texture origin is top-left.

If a rendering change looks “almost right but rotated/flipped”, check these transforms first before changing scene controls or sensor parsing.

## Important files

- `src/App.jsx` — top-level scene and UI composition.
- `src/store/appStore.js` — persisted robot list, settings, and topic stats.
- `src/store/rosStore.js` — WebSocket lifecycle, subscriptions, PointCloud2 parsing, latest ROS message cache.
- `src/components/ConnectionManager.jsx` — saved robot management and connect flow.
- `src/components/SettingsPanel.jsx` — user-editable topic/type/performance/display settings.
- `src/components/PointCloud.jsx`, `src/components/MapDisplay.jsx`, `src/components/RobotPose.jsx` — renderers for the three primary ROS data streams.

## Documentation-derived constraints

From `README.md` and `docs/SETUP.md`:

- The app is intended to connect to ROS2 through `rosbridge_server`, typically launched with `ros2 launch rosbridge_server rosbridge_websocket_launch.xml` on the robot.
- The documented operator workflow is Windows frontend + remote ROS2 robot.
- Topic names in docs and topic names in current persisted defaults are not fully aligned; verify whether a requested change should update documentation-era defaults (`src/config.js`) or the actual runtime defaults used by the app (`src/store/appStore.js`). `src/config.js` is not the active source of truth for subscriptions in the current app flow.
