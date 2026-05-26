#!/usr/bin/env node
// 本地伴随服务（deploy-agent）
// - 同源托管前端 dist/（替代 python http.server）
// - POST /api/deploy : 接收前端生成的 manifest YAML + SSH 密码，调用 deploy/scripts/deploy.sh
//   把 rosbridge 配置一键部署到机器人；部署日志流式回传。
// - GET  /api/health : 供前端探测 helper 是否在线，决定显示"一键部署"还是回退到"导出命令"。
//
// 仅监听 127.0.0.1：只有本机浏览器能访问。SSH 密码用完即弃，不落盘。

import http from 'node:http'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join, normalize, extname } from 'node:path'
import { createReadStream, existsSync, statSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = join(__dirname, '..', '..')
const DIST_DIR = join(PROJECT_ROOT, 'dist')
const DEPLOY_SCRIPT = join(PROJECT_ROOT, 'deploy', 'scripts', 'deploy.sh')
const PORT = Number(process.env.PORT || 3000)
const HOST = process.env.HOST || '127.0.0.1'

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.map': 'application/json'
}

function readBody(req, limit = 8 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (c) => {
      size += c.length
      if (size > limit) {
        reject(new Error('请求体过大'))
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function handleHealth(res) {
  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify({ ok: true, service: 'radar-deploy-agent', deployScript: existsSync(DEPLOY_SCRIPT) }))
}

async function handleDeploy(req, res) {
  let payload
  try {
    payload = JSON.parse(await readBody(req))
  } catch (e) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ ok: false, error: '请求体不是合法 JSON' }))
    return
  }

  const { manifestYaml, sshPassword } = payload || {}
  if (!manifestYaml || typeof manifestYaml !== 'string') {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ ok: false, error: '缺少 manifestYaml' }))
    return
  }
  if (!existsSync(DEPLOY_SCRIPT)) {
    res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ ok: false, error: `找不到部署脚本: ${DEPLOY_SCRIPT}` }))
    return
  }

  // manifest 写到临时文件；密码只通过子进程环境变量传递，不落盘。
  const workDir = mkdtempSync(join(tmpdir(), 'radar-deploy-'))
  const manifestPath = join(workDir, 'deploy-manifest.yaml')
  writeFileSync(manifestPath, manifestYaml, 'utf8')

  // 流式回传部署日志
  res.writeHead(200, {
    'content-type': 'text/plain; charset=utf-8',
    'cache-control': 'no-cache',
    'x-content-type-options': 'nosniff'
  })

  const child = spawn('bash', [DEPLOY_SCRIPT, manifestPath], {
    cwd: PROJECT_ROOT,
    env: { ...process.env, DEPLOY_SSH_PASSWORD: sshPassword || '' }
  })

  const cleanup = () => { try { rmSync(workDir, { recursive: true, force: true }) } catch {} }

  child.stdout.on('data', (d) => res.write(d))
  child.stderr.on('data', (d) => res.write(d))
  child.on('error', (err) => {
    res.write(`\n[deploy-agent] 启动部署脚本失败: ${err.message}\n`)
    cleanup()
    res.end(`\n__DEPLOY_RESULT__ FAILED\n`)
  })
  child.on('close', (code) => {
    cleanup()
    res.end(`\n__DEPLOY_RESULT__ ${code === 0 ? 'OK' : 'FAILED(exit=' + code + ')'}\n`)
  })

  req.on('close', () => { try { child.kill('SIGTERM') } catch {} })
}

// 通过 SSH 下发 systemctl restart（仅 rosbridge 等本 app 管理的服务）。
// sudo 密码经子进程 stdin 传给远端 sudo -S，不出现在命令行/远端进程参数里。
async function handleRestart(req, res) {
  let payload
  try {
    payload = JSON.parse(await readBody(req))
  } catch (e) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ ok: false, error: '请求体不是合法 JSON' }))
    return
  }

  const { host, user = 'wl', sshPort = 22, serviceName, sshPassword } = payload || {}
  const safe = /^[A-Za-z0-9._@-]+$/
  // 严格校验，避免拼进 shell 命令时被注入
  if (!host || !safe.test(String(host))) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ ok: false, error: 'host 非法' }))
    return
  }
  if (!serviceName || !safe.test(String(serviceName))) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ ok: false, error: 'serviceName 非法' }))
    return
  }
  if (!safe.test(String(user)) || !/^\d+$/.test(String(sshPort))) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ ok: false, error: 'user/sshPort 非法' }))
    return
  }

  res.writeHead(200, {
    'content-type': 'text/plain; charset=utf-8',
    'cache-control': 'no-cache',
    'x-content-type-options': 'nosniff'
  })

  // 远端命令：sudo -S 从 stdin 读密码 → 重启 → 报告状态
  const remoteCmd =
    `sudo -S -p '' systemctl restart '${serviceName}' && ` +
    `echo "[robot] restarted ${serviceName}" && ` +
    `systemctl is-active '${serviceName}'`

  const child = spawn(
    'sshpass',
    ['-e', 'ssh', '-o', 'StrictHostKeyChecking=accept-new', '-o', 'ConnectTimeout=15',
      '-p', String(sshPort), `${user}@${host}`, remoteCmd],
    { env: { ...process.env, SSHPASS: sshPassword || '' } }
  )

  // 把 sudo 密码喂给远端 sudo -S（经 ssh 转发的 stdin）
  child.stdin.write(`${sshPassword || ''}\n`)
  child.stdin.end()

  let buf = ''
  child.stdout.on('data', (d) => { buf += d; res.write(d) })
  child.stderr.on('data', (d) => res.write(d))
  child.on('error', (err) => {
    res.write(`\n[deploy-agent] 启动 ssh 失败: ${err.message}（本机需安装 sshpass）\n`)
    res.end(`\n__RESTART_RESULT__ FAILED\n`)
  })
  child.on('close', (code) => {
    const ok = code === 0 && /\bactive\b/.test(buf)
    res.end(`\n__RESTART_RESULT__ ${ok ? 'OK' : 'FAILED(exit=' + code + ')'}\n`)
  })

  req.on('close', () => { try { child.kill('SIGTERM') } catch {} })
}

function serveStatic(req, res) {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0])
  let rel = normalize(urlPath).replace(/^(\.\.[/\\])+/, '')
  if (rel === '/' || rel === '') rel = '/index.html'
  let filePath = join(DIST_DIR, rel)

  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403)
    res.end('Forbidden')
    return
  }

  // SPA 回退：路径不存在的当作前端路由，返回 index.html
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    filePath = join(DIST_DIR, 'index.html')
    if (!existsSync(filePath)) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
      res.end('dist/ 未构建，请先运行 npm run build')
      return
    }
  }

  res.writeHead(200, { 'content-type': MIME[extname(filePath)] || 'application/octet-stream' })
  createReadStream(filePath).pipe(res)
}

const server = http.createServer((req, res) => {
  if (req.url === '/api/health' && req.method === 'GET') return handleHealth(res)
  if (req.url === '/api/deploy' && req.method === 'POST') return handleDeploy(req, res)
  if (req.url === '/api/restart' && req.method === 'POST') return handleRestart(req, res)
  if (req.url?.startsWith('/api/')) {
    res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ ok: false, error: 'unknown api' }))
    return
  }
  serveStatic(req, res)
})

server.listen(PORT, HOST, () => {
  console.log(`[deploy-agent] serving ${DIST_DIR}`)
  console.log(`[deploy-agent] listening on http://${HOST}:${PORT}/`)
  console.log(`[deploy-agent] deploy script: ${DEPLOY_SCRIPT} (${existsSync(DEPLOY_SCRIPT) ? 'found' : 'MISSING'})`)
})
