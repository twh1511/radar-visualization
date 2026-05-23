import * as THREE from 'three'

// ─── ROS → Three.js 基础坐标系变换 ────────────────────────────────────────────
// ROS: x 前, y 左, z 上
// Three.js: x 右, y 上, z 后（朝屏幕外）
// 变换规则: Three(x,y,z) = ROS(x, z, -y)

/**
 * 将 ROS 坐标系下的位置转换为 Three.js 坐标系位置
 * @param {number} rx - ROS x（前）
 * @param {number} ry - ROS y（左）
 * @param {number} rz - ROS z（上）
 * @returns {THREE.Vector3}
 */
export function rosPositionToThree(rx, ry, rz) {
  return new THREE.Vector3(rx, rz, -ry)
}

/**
 * 将 ROS 四元数转换为 Three.js 四元数（基础坐标系重映射）
 * @param {number} qx
 * @param {number} qy
 * @param {number} qz
 * @param {number} qw
 * @returns {THREE.Quaternion}
 */
export function rosQuaternionToThree(qx, qy, qz, qw) {
  const rosToThreeBasis = new THREE.Matrix4().makeBasis(
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(0, 0, -1),
    new THREE.Vector3(0, 1, 0)
  )
  const threeToRosBasis = rosToThreeBasis.clone().transpose()
  const rosQ = new THREE.Quaternion(qx, qy, qz, qw)
  const rotRos = new THREE.Matrix4().makeRotationFromQuaternion(rosQ)
  const rotThree = rosToThreeBasis.clone().multiply(rotRos).multiply(threeToRosBasis)
  const q = new THREE.Quaternion()
  q.setFromRotationMatrix(rotThree)
  return q
}

// ─── TF 变换树 ────────────────────────────────────────────────────────────────

/**
 * 将 geometry_msgs/Transform 转换为 { position: THREE.Vector3, quaternion: THREE.Quaternion }（仍在 ROS 坐标系中）
 */
function tfTransformToRos(transform) {
  const t = transform.translation
  const r = transform.rotation
  return {
    position: new THREE.Vector3(t.x, t.y, t.z),
    quaternion: new THREE.Quaternion(r.x, r.y, r.z, r.w)
  }
}

/**
 * 组合两个 ROS 坐标系变换: parent_T_child = a ∘ b
 * a, b 都是 { position: THREE.Vector3, quaternion: THREE.Quaternion }
 */
function composeTf(a, b) {
  const pos = b.position.clone().applyQuaternion(a.quaternion).add(a.position)
  const quat = a.quaternion.clone().multiply(b.quaternion)
  return { position: pos, quaternion: quat }
}

/**
 * 在 TF 变换树中查找从 sourceFrame 到 targetFrame 的变换（BFS）
 * @param {Map<string, {position, quaternion}>} tfTree  key = "parent->child"
 * @param {string} sourceFrame
 * @param {string} targetFrame
 * @returns {{ position: THREE.Vector3, quaternion: THREE.Quaternion } | null}
 */
export function lookupTransform(tfTree, sourceFrame, targetFrame) {
  if (sourceFrame === targetFrame) {
    return { position: new THREE.Vector3(), quaternion: new THREE.Quaternion() }
  }

  // 构建邻接表 (基于存储惯例: tfTree.get('A->B') 表示 A_T_B, 即 A 是 parent, B 是 child)
  const childToParent = new Map()
  const parentToChildren = new Map()

  for (const [key, tf] of tfTree.entries()) {
    const sep = key.indexOf('->')
    if (sep === -1) continue
    const parent = key.slice(0, sep)
    const child = key.slice(sep + 2)
    childToParent.set(child, { parent, tf })
    if (!parentToChildren.has(parent)) parentToChildren.set(parent, [])
    parentToChildren.get(parent).push({ child, tf })
  }

  // BFS:
  // 状态: currentTf 表示 currentFrame_T_source (把 source 系的点变换到 currentFrame 系)
  // - 向上走 (child=frame, parent=next): edgeTf = parent_T_child = next_T_frame  (直接用)
  //   newTf = next_T_frame ∘ frame_T_source = composeTf(edgeTf, currentTf)
  // - 向下走 (parent=frame, child=next): edgeTf = parent_T_child = frame_T_next  (需要取逆)
  //   newTf = next_T_frame ∘ frame_T_source = composeTf(invEdge, currentTf)
  const queue = [{ frame: sourceFrame, tf: { position: new THREE.Vector3(), quaternion: new THREE.Quaternion() } }]
  const visited = new Set([sourceFrame])

  while (queue.length > 0) {
    const { frame, tf: currentTf } = queue.shift()

    // 向上走（frame 是 child, next 是 parent）
    if (childToParent.has(frame)) {
      const { parent, tf: edgeTf } = childToParent.get(frame)
      if (!visited.has(parent)) {
        // edgeTf 已经是 parent_T_child = parent_T_frame，直接用
        const composed = composeTf(edgeTf, currentTf)
        if (parent === targetFrame) return composed
        visited.add(parent)
        queue.push({ frame: parent, tf: composed })
      }
    }

    // 向下走（frame 是 parent, next 是 child）
    if (parentToChildren.has(frame)) {
      for (const { child, tf: edgeTf } of parentToChildren.get(frame)) {
        if (!visited.has(child)) {
          // 需要逆: child_T_parent = inverse(parent_T_child)
          const invQuat = edgeTf.quaternion.clone().invert()
          const invPos = edgeTf.position.clone().negate().applyQuaternion(invQuat)
          const invEdge = { position: invPos, quaternion: invQuat }
          const composed = composeTf(invEdge, currentTf)
          if (child === targetFrame) return composed
          visited.add(child)
          queue.push({ frame: child, tf: composed })
        }
      }
    }
  }

  return null // 无路径
}

/**
 * 将 tf2_msgs/TFMessage 中的 transforms 解析并存入 Map
 * @param {object} message  TFMessage
 * @param {Map} tfMap       目标 Map，key = "parent->child"
 */
export function applyTFMessage(message, tfMap) {
  if (!message?.transforms) return
  for (const t of message.transforms) {
    const key = `${t.header.frame_id}->${t.child_frame_id}`
    tfMap.set(key, tfTransformToRos(t.transform))
  }
}

/**
 * 将 ROS 坐标系中的位置+姿态变换到目标 frame，然后再转换到 Three.js 坐标系
 * @param {{ x, y, z, qx, qy, qz, qw }} poseRos  ROS 坐标系下的位姿
 * @param {string} sourceFrame
 * @param {string} targetFrame
 * @param {Map} tfTree
 * @returns {{ position: THREE.Vector3, quaternion: THREE.Quaternion }}  Three.js 坐标系
 */
export function transformPoseToTarget(poseRos, sourceFrame, targetFrame, tfTree) {
  let posRos = new THREE.Vector3(poseRos.x, poseRos.y, poseRos.z)
  let quatRos = new THREE.Quaternion(poseRos.qx, poseRos.qy, poseRos.qz, poseRos.qw)

  if (sourceFrame && targetFrame && sourceFrame !== targetFrame && tfTree) {
    const tf = lookupTransform(tfTree, sourceFrame, targetFrame)
    if (tf) {
      posRos = posRos.clone().applyQuaternion(tf.quaternion).add(tf.position)
      quatRos = tf.quaternion.clone().multiply(quatRos)
    } else {
      console.warn(`[TF] 无法找到 ${sourceFrame} -> ${targetFrame} 的变换，使用原始位姿`)
    }
  }

  return {
    position: rosPositionToThree(posRos.x, posRos.y, posRos.z),
    quaternion: rosQuaternionToThree(quatRos.x, quatRos.y, quatRos.z, quatRos.w)
  }
}

/**
 * 将 ROS 点云点（已在 ROS 坐标系中）变换到目标 frame 后转为 Three.js 坐标
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {string} sourceFrame
 * @param {string} targetFrame
 * @param {Map} tfTree
 * @returns {[number, number, number]}  Three.js [x, y, z]
 */
export function transformPointToTarget(x, y, z, sourceFrame, targetFrame, tfTree) {
  let p = new THREE.Vector3(x, y, z)

  if (sourceFrame && targetFrame && sourceFrame !== targetFrame && tfTree) {
    const tf = lookupTransform(tfTree, sourceFrame, targetFrame)
    if (tf) {
      p = p.clone().applyQuaternion(tf.quaternion).add(tf.position)
    }
  }

  // ROS → Three.js
  return [p.x, p.z, -p.y]
}
