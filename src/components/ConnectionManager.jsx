import React, { useState, useEffect } from 'react'
import { useAppStore } from '../store/appStore'
import { useRosStore } from '../store/rosStore'
import { buildDeployManifest, buildDeployManifestYaml } from '../config/deployManifest'
import { resolveRobotConfig } from '../config/configResolver'

function ConnectionManager() {
  const {
    savedRobots,
    currentRobotId,
    deploymentProfiles,
    robotPresets,
    runtimeProfile,
    currentRobot,
    effectiveConfig,
    settings,
    discoveryReportsByRobotId,
    discoveredSettingsByRobotId,
    addRobot,
    removeRobot,
    updateRobot,
    setCurrentRobot,
    setShowConnectionManager,
    getCurrentDeploymentProfile,
    setDeployStatus,
    setDiscoveryReport
  } = useAppStore()

  const { connect, connecting, connectionStatus, errorMessage, diagnostics, autoDiscoverResources } = useRosStore()
  const discoveryInProgress = useRosStore((s) => s._discoveryInProgress)
  const discoveryStatus = useRosStore((s) => s._discoveryStatus)
  const discoveryError = useRosStore((s) => s._discoveryError)

  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showDeployPreview, setShowDeployPreview] = useState(false)
  const [name, setName] = useState('')
  const [host, setHost] = useState('192.168.1.247')
  const [port, setPort] = useState('9090')
  const [selectedId, setSelectedId] = useState(currentRobotId)
  const [deploymentProfileId, setDeploymentProfileId] = useState(getCurrentDeploymentProfile()?.id || deploymentProfiles[0]?.id)
  const [robotPresetId, setRobotPresetId] = useState(runtimeProfile.robotPresetId || robotPresets[0]?.id)
  const [deployArtifact, setDeployArtifact] = useState(null)
  const [deployFeedback, setDeployFeedback] = useState(null)
  const [deploymentProfileTouched, setDeploymentProfileTouched] = useState(false)
  const [deployDiscoveryInput, setDeployDiscoveryInput] = useState('')

  useEffect(() => {
    if (selectedId) {
      const robot = savedRobots.find((item) => item.id === selectedId)
      if (robot) {
        setName(robot.name)
        setHost(robot.host)
        setPort(String(robot.port))
        setDeploymentProfileId(robot.deploymentProfileId || deploymentProfiles[0]?.id)
        setRobotPresetId(robot.robotPresetId || robotPresets[0]?.id)
        setDeploymentProfileTouched(false)
      }
    }
  }, [selectedId, savedRobots, deploymentProfiles, robotPresets])

  const selectedProfile = deploymentProfiles.find((profile) => profile.id === deploymentProfileId) || deploymentProfiles[0]
  const selectedPreset = robotPresets.find((preset) => preset.id === robotPresetId) || robotPresets[0]
  const draftRobotId = selectedId || currentRobot?.id || 'draft'
  const discoveryReport = discoveryReportsByRobotId?.[draftRobotId] || runtimeProfile.discoveryReport || null
  const autoDiscoveredSettings = discoveredSettingsByRobotId?.[draftRobotId] || {}

  const draftRobot = {
    ...(currentRobot || {}),
    id: draftRobotId,
    name: name || selectedPreset?.name || host,
    host,
    port: parseInt(port, 10) || 9090,
    deploymentProfileId,
    robotPresetId,
    environment: selectedProfile?.environment,
    localizationMode: selectedProfile?.localizationMode
  }

  const resolvedDraft = resolveRobotConfig(draftRobot, settings, autoDiscoveredSettings)
  const deployRuntimeProfile = {
    ...runtimeProfile,
    deploymentProfileId: resolvedDraft.robot.deploymentProfileId,
    deploymentProfileName: resolvedDraft.deploymentProfile?.name || selectedProfile?.name,
    robotPresetId: resolvedDraft.robot.robotPresetId,
    robotPresetName: resolvedDraft.robotPreset?.name || selectedPreset?.name,
    environment: resolvedDraft.metadata.environment,
    localizationMode: resolvedDraft.metadata.localizationMode,
    network: resolvedDraft.deploymentProfile?.network || {},
    autoDiscoveredTopics: autoDiscoveredSettings.topics || {},
    discoveryReport,
    deployStatus: runtimeProfile.deployStatus
  }

  const detectedCount = Object.values(deployRuntimeProfile.autoDiscoveredTopics || {}).filter(Boolean).length
  const detectionState = detectedCount >= 3 ? '已识别主链路' : detectedCount > 0 ? '部分识别' : '未识别'
  const detectionColor = detectedCount >= 3 ? '#22c55e' : detectedCount > 0 ? '#f59e0b' : '#9ca3af'
  const deployStatus = deployFeedback || deployRuntimeProfile.deployStatus
  const canGenerateManifest = Boolean(resolvedDraft.robot.host)
  const canExportManifest = Boolean(deployArtifact?.yaml)
  const envDetectedFromDeploy = discoveryReport?.envSource === 'deploy-ssh' || discoveryReport?.source === 'deploy-ssh'

  const handleConnect = () => {
    if (!host) return
    const portNum = parseInt(port, 10) || 9090
    let id = selectedId
    if (!id) {
      id = addRobot({
        name: name || selectedPreset?.name || host,
        host,
        port: portNum,
        deploymentProfileId,
        robotPresetId,
        environment: selectedProfile?.environment,
        localizationMode: selectedProfile?.localizationMode
      })
    } else {
      updateRobot(id, {
        name: name || selectedPreset?.name || host,
        host,
        port: portNum,
        deploymentProfileId,
        robotPresetId,
        environment: selectedProfile?.environment,
        localizationMode: selectedProfile?.localizationMode
      })
    }
    setCurrentRobot(id)
    connect(host, portNum, selectedProfile?.network?.rosbridgePath || '')
    setShowConnectionManager(false)
  }

  const handleSave = () => {
    if (!host) return
    const portNum = parseInt(port, 10) || 9090
    if (selectedId) {
      updateRobot(selectedId, {
        name: name || selectedPreset?.name || host,
        host,
        port: portNum,
        deploymentProfileId,
        robotPresetId,
        environment: selectedProfile?.environment,
        localizationMode: selectedProfile?.localizationMode
      })
    } else {
      const id = addRobot({
        name: name || selectedPreset?.name || host,
        host,
        port: portNum,
        deploymentProfileId,
        robotPresetId,
        environment: selectedProfile?.environment,
        localizationMode: selectedProfile?.localizationMode
      })
      setSelectedId(id)
    }
  }

  const handleImportDeployDiscovery = () => {
    if (!deployDiscoveryInput.trim()) {
      setDeployFeedback({
        action: 'import-deploy-discovery',
        status: 'error',
        message: '请先粘贴 deploy/scripts/discover-robot.py 生成的 JSON 报告。'
      })
      return
    }

    try {
      const report = JSON.parse(deployDiscoveryInput)
      setDiscoveryReport(draftRobotId, {
        ...report,
        source: 'deploy-ssh',
        envSource: 'deploy-ssh'
      })
      setDeployFeedback({
        action: 'import-deploy-discovery',
        status: 'success',
        message: '已导入 deploy 探测结果，后续清单将优先使用真实 env。'
      })
    } catch (error) {
      setDeployFeedback({
        action: 'import-deploy-discovery',
        status: 'error',
        message: 'deploy 探测结果不是合法 JSON，请重新粘贴。'
      })
    }
  }

  const handleGenerateManifest = () => {
    try {
      const manifest = buildDeployManifest({
        robot: resolvedDraft.robot,
        runtimeProfile: deployRuntimeProfile,
        effectiveConfig: resolvedDraft.effectiveConfig
      })
      const yaml = buildDeployManifestYaml({
        robot: resolvedDraft.robot,
        runtimeProfile: deployRuntimeProfile,
        effectiveConfig: resolvedDraft.effectiveConfig
      })
      const message = envDetectedFromDeploy
        ? '已根据当前模板、deploy 探测结果和自动识别结果生成部署清单。'
        : discoveryReport?.updatedAt
          ? '已根据当前模板、部署档案和自动识别结果生成部署清单。env 未探测部分仍使用部署档案默认值。'
          : '已根据当前模板和部署档案生成部署清单；未识别部分使用模板默认值。'

      const status = {
        action: 'generate-manifest',
        status: 'success',
        message,
        generatedAt: Date.now(),
        fileName: `${manifest.robotName || 'robot'}-deploy-manifest.yaml`
      }

      setDeployArtifact({ manifest, yaml, status })
      setDeployFeedback(status)
      setShowDeployPreview(true)
      setDeployStatus(draftRobotId, status)
    } catch (error) {
      const status = {
        action: 'generate-manifest',
        status: 'error',
        message: error.message || '生成部署清单失败，请检查当前配置。'
      }
      setDeployArtifact(null)
      setDeployFeedback(status)
      setDeployStatus(draftRobotId, status)
    }
  }

  const handleDeployToRobot = () => {
    const status = {
      action: 'deploy',
      status: 'pending',
      message: '已准备部署，请使用下方命令在本地执行部署。'
    }
    setDeployFeedback(status)
    setDeployStatus(draftRobotId, status)
  }

  const handleRestartRobotServices = () => {
    const status = {
      action: 'restart',
      status: 'pending',
      message: '重启动作需要在部署后通过 deploy 脚本或机器人侧 systemctl 执行。'
    }
    setDeployFeedback(status)
    setDeployStatus(draftRobotId, status)
  }

  const handleExportManifest = () => {
    if (!deployArtifact?.yaml) return
    const blob = new Blob([deployArtifact.yaml], { type: 'text/yaml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const fileName = deployArtifact.status?.fileName || `${deployArtifact.manifest.robotName || 'robot'}-deploy-manifest.yaml`
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    const status = {
      action: 'export-manifest',
      status: 'success',
      message: `YAML 已开始下载：${fileName}`,
      generatedAt: deployArtifact.status?.generatedAt,
      fileName
    }
    setDeployFeedback(status)
    setDeployStatus(draftRobotId, status)
  }

  const handleNew = () => {
    setSelectedId(null)
    setName('')
    setHost('')
    setPort('9090')
    setDeploymentProfileTouched(false)
    setDeploymentProfileId(deploymentProfiles[0]?.id)
    setRobotPresetId(robotPresets[0]?.id)
    setDeployArtifact(null)
    setDeployFeedback(null)
    setDeployDiscoveryInput('')
  }

  const handleDelete = (id) => {
    if (confirm('确认删除此机器人配置？')) {
      removeRobot(id)
      if (selectedId === id) handleNew()
    }
  }

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={headerStyle}>
          <h2 style={{ margin: 0, fontSize: 20 }}>ROS2 可视化客户端</h2>
          <p style={{ margin: '6px 0 0', color: '#888', fontSize: 13 }}>
            选择机器人模板，输入 IP，系统自动识别其余导航资源
          </p>
        </div>

        <div style={contentStyle}>
          <div style={{ flex: '0 0 240px', borderRight: '1px solid #2a2a2a', paddingRight: 16 }}>
            <div style={sectionTitleStyle}>已保存的机器人</div>
            <div style={{ marginTop: 8, maxHeight: 320, overflowY: 'auto' }}>
              {savedRobots.length === 0 && <div style={{ color: '#666', fontSize: 13, padding: 8 }}>暂无</div>}
              {savedRobots.map((robot) => (
                <div
                  key={robot.id}
                  onClick={() => setSelectedId(robot.id)}
                  style={{
                    ...robotItemStyle,
                    background: selectedId === robot.id ? '#2563eb' : 'transparent',
                    borderColor: selectedId === robot.id ? '#3b82f6' : '#2a2a2a'
                  }}
                >
                  <div style={{ fontWeight: 500 }}>{robot.name}</div>
                  <div style={{ fontSize: 11, color: selectedId === robot.id ? '#cbd5e1' : '#888' }}>{robot.host}:{robot.port}</div>
                  <div style={{ fontSize: 11, color: selectedId === robot.id ? '#dbeafe' : '#666', marginTop: 4 }}>
                    {robotPresets.find((preset) => preset.id === robot.robotPresetId)?.name || '未指定预设'}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(robot.id) }}
                    style={deleteBtnStyle}
                    title="删除"
                  >×</button>
                </div>
              ))}
            </div>
            <button onClick={handleNew} style={{ ...btnStyle, marginTop: 12, width: '100%' }}>+ 新建连接</button>
          </div>

          <div style={{ flex: 1, paddingLeft: 16 }}>
            <div style={sectionTitleStyle}>极简连接</div>

            <div style={fieldStyle}>
              <label style={labelStyle}>机器人模板</label>
              <select
                style={inputStyle}
                value={robotPresetId}
                onChange={(e) => {
                  const nextPresetId = e.target.value
                  const nextPreset = robotPresets.find((preset) => preset.id === nextPresetId) || robotPresets[0]
                  setRobotPresetId(nextPresetId)
                  if (!deploymentProfileTouched && nextPreset?.deploymentProfileId) {
                    setDeploymentProfileId(nextPreset.deploymentProfileId)
                  }
                }}
              >
                {robotPresets.map((preset) => (
                  <option key={preset.id} value={preset.id}>{preset.name}</option>
                ))}
              </select>
            </div>

            <div style={profileCardStyle}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>{selectedPreset?.name}</div>
              <div style={profileMetaStyle}>部署档案：{selectedProfile?.name}</div>
              <div style={profileMetaStyle}>环境：{selectedProfile?.environment} / 定位：{selectedProfile?.localizationMode}</div>
              <div style={{ marginTop: 8, fontSize: 12, color: '#93c5fd' }}>{selectedPreset?.description}</div>
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>机器人名称</label>
              <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder={selectedPreset?.name || '例: 机器狗 Alpha'} />
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>IP 地址 *</label>
              <input style={inputStyle} value={host} onChange={(e) => setHost(e.target.value)} placeholder="192.168.1.247" />
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button
                onClick={handleConnect}
                disabled={!host || connecting}
                style={{
                  ...primaryBtnStyle,
                  opacity: (!host || connecting) ? 0.5 : 1,
                  cursor: (!host || connecting) ? 'not-allowed' : 'pointer'
                }}
              >
                {connecting ? '连接中...' : '连接并自动识别'}
              </button>
              <button onClick={() => setShowAdvanced((value) => !value)} style={btnStyle}>
                {showAdvanced ? '收起高级项' : '高级项'}
              </button>
            </div>

            <div style={deployPanelStyle}>
              <div style={deployTitleStyle}>部署操作区</div>
              <div style={deployButtonGridStyle}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => autoDiscoverResources()}
                  style={deployPrimaryButtonStyle}
                  disabled={discoveryInProgress}
                >
                  {discoveryInProgress ? '识别中...' : '立即执行识别'}
                </button>
                <button
                  type="button"
                  onClick={handleGenerateManifest}
                  style={{
                    ...deployActionButtonStyle,
                    opacity: canGenerateManifest ? 1 : 0.5,
                    cursor: canGenerateManifest ? 'pointer' : 'not-allowed'
                  }}
                  disabled={!canGenerateManifest}
                >
                  生成部署清单
                </button>
                <button type="button" onClick={handleDeployToRobot} style={deployActionButtonStyle}>
                  部署到机器人
                </button>
                <button type="button" onClick={handleRestartRobotServices} style={deployActionButtonStyle}>
                  重启机器人服务
                </button>
              </div>
              <div style={deployResultBoxStyle}>
                <div style={deployResultLabelStyle}>识别状态：<span style={{ color: detectionColor }}>{detectionState}</span></div>
                <div style={deployResultLabelStyle}>当前 deploy 目标：<code>{resolvedDraft.robot.name}@{resolvedDraft.robot.host || '未填写 IP'}</code></div>
                <div style={deployResultLabelStyle}>部署清单状态：{deployStatus?.action === 'generate-manifest' || deployStatus?.action === 'export-manifest' ? deployStatus.message : '尚未生成'}</div>
                <div style={deployResultLabelStyle}>最近一次部署结果：{deployStatus?.action === 'deploy' ? deployStatus.message : '暂无'}</div>
                <div style={deployResultLabelStyle}>最近一次重启结果：{deployStatus?.action === 'restart' ? deployStatus.message : '暂无'}</div>
                <div style={deployResultLabelStyle}>最近一次执行时间：{deployStatus?.updatedAt ? new Date(deployStatus.updatedAt).toLocaleString() : deployStatus?.generatedAt ? new Date(deployStatus.generatedAt).toLocaleString() : '暂无'}</div>
                {discoveryReport?.recommendations && Object.keys(discoveryReport.recommendations).length > 0 && (
                  <div style={{ ...deployResultLabelStyle, color: '#93c5fd' }}>
                    推荐覆盖：{Object.entries(discoveryReport.recommendations).map(([k, v]) => `${k}=${v}`).join(', ')}
                  </div>
                )}
              </div>
            </div>

            {(connecting || errorMessage) && (
              <div style={{
                padding: 10,
                marginTop: 12,
                borderRadius: 6,
                background: errorMessage ? '#3f1d1d' : '#1e3a5f',
                color: errorMessage ? '#fca5a5' : '#93c5fd',
                fontSize: 13
              }}>
                {errorMessage || connectionStatus}
              </div>
            )}

            <div style={detectionBannerStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 600, color: '#e5e7eb' }}>自动发现状态</div>
                <span style={{ color: detectionColor, fontSize: 12, fontWeight: 600 }}>{detectionState}</span>
              </div>
              <div style={{ marginTop: 6, fontSize: 12, color: '#93c5fd' }}>
                已自动识别 {detectedCount} 个关键资源。识别成功越多，越接近“开箱即用”。
              </div>
              <div style={{ marginTop: 6, fontSize: 11, color: discoveryStatus === 'error' ? '#fca5a5' : '#cbd5e1' }}>
                {discoveryInProgress ? '正在执行识别，请稍候...' : discoveryError || discoveryReport?.message || '尚未执行主动识别'}
              </div>
              {discoveryReport?.updatedAt && (
                <div style={{ marginTop: 4, fontSize: 11, color: '#6b7280' }}>
                  最近识别时间：{new Date(discoveryReport.updatedAt).toLocaleString()}
                </div>
              )}
            </div>

            <div style={diagnosticCardStyle}>
              <div style={{ fontWeight: 600, color: '#aaa', marginBottom: 6 }}>自动识别结果</div>
              <ResourceRow label="位姿源" value={deployRuntimeProfile.autoDiscoveredTopics.pose} fallback={selectedPreset?.defaults?.topics?.pose || selectedProfile?.defaults?.topics?.pose} />
              <ResourceRow label="点云源" value={deployRuntimeProfile.autoDiscoveredTopics.pointCloud} fallback={selectedPreset?.defaults?.topics?.pointCloud || selectedProfile?.defaults?.topics?.pointCloud} />
              <ResourceRow label="地图源" value={deployRuntimeProfile.autoDiscoveredTopics.map} fallback={selectedPreset?.defaults?.topics?.map || selectedProfile?.defaults?.topics?.map} />
              <ResourceRow label="路径源" value={deployRuntimeProfile.autoDiscoveredTopics.globalPlan} fallback={selectedPreset?.defaults?.topics?.globalPlan || selectedProfile?.defaults?.topics?.globalPlan} />
              <div style={{ marginTop: 8, fontSize: 11, color: '#6b7280' }}>
                如果这里显示“使用模板默认值”，说明该资源尚未自动识别到，但仍会按模板尝试连接。
              </div>
            </div>

            <div style={diagnosticCardStyle}>
              <div style={{ fontWeight: 600, color: '#aaa', marginBottom: 6 }}>Discovery 结果</div>
              <div style={{ marginBottom: 8, fontSize: 11, color: '#9ca3af' }}>
                {envDetectedFromDeploy ? '下列网络环境变量来自 deploy 探测结果。' : '下列网络环境变量尚未真实探测，当前使用部署档案默认值。'}
              </div>
              <div style={profileMetaStyle}>可达性：{discoveryReport?.reachable ? '可达' : '未执行或不可达'}</div>
              <div style={profileMetaStyle}>ROS_DOMAIN_ID（{envDetectedFromDeploy ? 'deploy 探测' : '部署档案'}）：{discoveryReport?.env?.ROS_DOMAIN_ID || deployRuntimeProfile.network.rosDomainId || '未知'}</div>
              <div style={profileMetaStyle}>ROS_DISCOVERY_SERVER（{envDetectedFromDeploy ? 'deploy 探测' : '部署档案'}）：{discoveryReport?.env?.ROS_DISCOVERY_SERVER || deployRuntimeProfile.network.discoveryServer || '未知'}</div>
              <div style={profileMetaStyle}>ROS_SUPER_CLIENT（{envDetectedFromDeploy ? 'deploy 探测' : '部署档案'}）：{discoveryReport?.env?.ROS_SUPER_CLIENT || (deployRuntimeProfile.network.requiresSuperClient ? 'TRUE' : 'FALSE')}</div>
              <div style={profileMetaStyle}>识别到 topics 数量：{discoveryReport?.topics?.length || 0}</div>
              <div style={profileMetaStyle}>识别到 services 数量：{discoveryReport?.services?.length || 0}</div>
              <div style={profileMetaStyle}>识别到 actions 数量：{discoveryReport?.actions?.length || 0}</div>
            </div>

            <div style={diagnosticCardStyle}>
              <div style={{ fontWeight: 600, color: '#aaa', marginBottom: 6 }}>导入 deploy 探测结果</div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 8 }}>
                将 `deploy/scripts/discover-robot.py` 生成的 JSON 报告粘贴到这里，清单会优先使用真实 env。
              </div>
              <textarea
                style={{
                  ...inputStyle,
                  minHeight: 120,
                  resize: 'vertical',
                  whiteSpace: 'pre',
                  lineHeight: 1.4
                }}
                value={deployDiscoveryInput}
                onChange={(e) => setDeployDiscoveryInput(e.target.value)}
                placeholder='{"env":{"ROS_DOMAIN_ID":"219","ROS_DISCOVERY_SERVER":"192.168.1.247:11811"},"topics":[...],"recommendations":{...}}'
              />
              <button onClick={handleImportDeployDiscovery} style={{ ...btnStyle, marginTop: 10 }}>
                导入 deploy 探测 JSON
              </button>
            </div>

            <div style={diagnosticCardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontWeight: 600, color: '#aaa' }}>部署清单入口</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setShowDeployPreview((value) => !value)} style={smallBtnStyle}>
                    {showDeployPreview ? '收起预览' : '预览 YAML'}
                  </button>
                  <button
                    onClick={handleExportManifest}
                    style={{
                      ...smallBtnStyle,
                      opacity: canExportManifest ? 1 : 0.5,
                      cursor: canExportManifest ? 'pointer' : 'not-allowed'
                    }}
                    disabled={!canExportManifest}
                  >导出 YAML</button>
                </div>
              </div>
              <div style={{ fontSize: 11, color: '#93c5fd' }}>
                当前清单基于：表单草稿 + 自动识别结果。若已导入 deploy 探测 JSON，则 env 将优先使用真实探测值。
              </div>
              <div style={{ ...deployResultLabelStyle, marginTop: 8, color: deployStatus?.status === 'error' ? '#fca5a5' : '#cbd5e1' }}>
                {deployStatus?.message || '请先点击“生成部署清单”，再预览或导出 YAML。'}
              </div>
              <div style={commandHintStyle}>
                <div style={{ color: '#d1d5db', fontSize: 12, marginBottom: 6 }}>下一步</div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 6 }}>
                  1. 将导出的 YAML 放到 <code>deploy/manifests/</code> 目录
                </div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 6 }}>
                  2. 在项目根目录执行下面的命令
                </div>
                <pre style={commandPreviewStyle}>{`bash deploy/scripts/deploy.sh deploy/manifests/${(deployArtifact?.manifest?.robotName || resolvedDraft.robot.name || 'your-robot')}-deploy-manifest.yaml`}</pre>
              </div>
              {showDeployPreview && deployArtifact?.yaml && (
                <pre style={manifestPreviewStyle}>{deployArtifact.yaml}</pre>
              )}
              {showDeployPreview && !deployArtifact?.yaml && (
                <div style={{ marginTop: 12, fontSize: 12, color: '#9ca3af' }}>
                  尚未生成 YAML，请先点击“生成部署清单”。
                </div>
              )}
            </div>

            {showAdvanced && (
              <>
                <div style={sectionTitleStyle}>高级配置</div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>部署档案</label>
                  <select
                    style={inputStyle}
                    value={deploymentProfileId}
                    onChange={(e) => {
                      setDeploymentProfileTouched(true)
                      setDeploymentProfileId(e.target.value)
                    }}
                  >
                    {deploymentProfiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>{profile.name}</option>
                    ))}
                  </select>
                </div>

                <div style={fieldStyle}>
                  <label style={labelStyle}>端口</label>
                  <input style={inputStyle} value={port} onChange={(e) => setPort(e.target.value)} placeholder="9090" />
                </div>

                <div style={diagnosticCardStyle}>
                  <div style={{ fontWeight: 600, color: '#aaa', marginBottom: 6 }}>连接诊断</div>
                  <div style={profileMetaStyle}>状态：{connectionStatus}</div>
                  <div style={profileMetaStyle}>定位模式：{diagnostics.localizationMode || '未知'}</div>
                  <div style={profileMetaStyle}>TF：{diagnostics.tfAvailable ? '已建立' : '未建立'}</div>
                  <div style={profileMetaStyle}>地图来源：{diagnostics.lastMapSource || '未加载'}</div>
                  <div style={profileMetaStyle}>定位健康：{diagnostics.localizationHealthValue || '暂无'}</div>
                </div>

                <button onClick={handleSave} style={{ ...btnStyle, marginTop: 12, width: '100%' }}>保存当前配置</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function ResourceRow({ label, value, fallback }) {
  const autoDetected = Boolean(value)
  return (
    <div style={resourceRowStyle}>
      <div style={{ color: '#d1d5db', fontSize: 12 }}>{label}</div>
      <div style={{ fontFamily: 'monospace', fontSize: 11, color: autoDetected ? '#22c55e' : '#f59e0b', marginTop: 2 }}>
        {autoDetected ? value : `${fallback || '未配置'}（使用模板默认值）`}
      </div>
    </div>
  )
}

const overlayStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.75)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 2000,
  backdropFilter: 'blur(8px)'
}
const modalStyle = {
  background: '#141414',
  color: 'white',
  borderRadius: 12,
  width: 860,
  maxWidth: '94vw',
  maxHeight: '92vh',
  border: '1px solid #2a2a2a',
  boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column'
}
const headerStyle = {
  padding: '20px 24px',
  borderBottom: '1px solid #2a2a2a',
  background: 'linear-gradient(135deg, #1e3a8a, #1e1b4b)'
}
const contentStyle = {
  display: 'flex',
  padding: 20,
  overflowY: 'auto',
  minHeight: 0
}
const sectionTitleStyle = {
  fontSize: 13,
  fontWeight: 600,
  color: '#aaa',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  marginTop: 16
}
const robotItemStyle = {
  position: 'relative',
  padding: '10px 12px',
  borderRadius: 6,
  marginBottom: 6,
  cursor: 'pointer',
  border: '1px solid #2a2a2a',
  fontSize: 13
}
const deleteBtnStyle = {
  position: 'absolute',
  top: 4,
  right: 6,
  background: 'transparent',
  border: 'none',
  color: '#888',
  cursor: 'pointer',
  fontSize: 18,
  lineHeight: 1,
  padding: '0 4px'
}
const fieldStyle = {
  marginTop: 12
}
const labelStyle = {
  display: 'block',
  fontSize: 12,
  color: '#aaa',
  marginBottom: 4
}
const inputStyle = {
  width: '100%',
  padding: '8px 12px',
  background: '#0a0a0a',
  border: '1px solid #2a2a2a',
  borderRadius: 6,
  color: 'white',
  fontSize: 14,
  outline: 'none',
  fontFamily: 'monospace'
}
const btnStyle = {
  padding: '8px 16px',
  background: '#2a2a2a',
  color: 'white',
  border: '1px solid #3a3a3a',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 500
}
const smallBtnStyle = {
  padding: '6px 10px',
  background: '#1f2937',
  color: 'white',
  border: '1px solid #374151',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 12
}
const primaryBtnStyle = {
  ...btnStyle,
  background: '#2563eb',
  border: '1px solid #3b82f6',
  flex: 1
}
const profileCardStyle = {
  marginTop: 12,
  padding: 12,
  background: '#111827',
  borderRadius: 8,
  border: '1px solid #1f2937'
}
const deployPanelStyle = {
  marginTop: 16,
  padding: 14,
  background: '#0f172a',
  borderRadius: 10,
  border: '1px solid #1d4ed8'
}
const deployTitleStyle = {
  fontSize: 13,
  fontWeight: 700,
  color: '#e5e7eb',
  marginBottom: 10
}
const deployButtonGridStyle = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 8
}
const deployPrimaryButtonStyle = {
  padding: '10px 12px',
  background: '#2563eb',
  color: 'white',
  border: '1px solid #3b82f6',
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer'
}
const deployActionButtonStyle = {
  padding: '10px 12px',
  background: '#1f2937',
  color: 'white',
  border: '1px solid #374151',
  borderRadius: 8,
  fontSize: 12,
  cursor: 'pointer'
}
const deployResultBoxStyle = {
  marginTop: 12,
  padding: 12,
  background: '#111827',
  borderRadius: 8,
  border: '1px solid #1f2937'
}
const deployResultLabelStyle = {
  fontSize: 12,
  color: '#cbd5e1',
  marginTop: 4
}
const detectionBannerStyle = {
  marginTop: 12,
  padding: 12,
  background: '#111827',
  borderRadius: 8,
  border: '1px solid #1d4ed8'
}
const diagnosticCardStyle = {
  marginTop: 12,
  padding: 12,
  background: '#1a1a1a',
  borderRadius: 8,
  border: '1px solid #2a2a2a'
}
const manifestPreviewStyle = {
  marginTop: 12,
  padding: 12,
  background: '#0a0a0a',
  borderRadius: 8,
  border: '1px solid #262626',
  maxHeight: 220,
  overflow: 'auto',
  fontSize: 11,
  color: '#d1d5db'
}
const commandHintStyle = {
  marginTop: 12,
  padding: 12,
  background: '#0f172a',
  borderRadius: 8,
  border: '1px solid #1e3a8a'
}
const commandPreviewStyle = {
  margin: 0,
  padding: 10,
  background: '#020617',
  borderRadius: 6,
  border: '1px solid #1e293b',
  color: '#93c5fd',
  fontSize: 11,
  overflowX: 'auto'
}
const profileMetaStyle = {
  fontSize: 12,
  color: '#94a3b8',
  marginTop: 4
}
const resourceRowStyle = {
  paddingTop: 8,
  borderTop: '1px solid #262626'
}

export default ConnectionManager
