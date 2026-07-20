#!/usr/bin/env node
/**
 * 文件职责 / File responsibility
 * 解析 CLI 参数并启动本地 Agent 服务。
 * Parses CLI arguments and starts the Local Agent service.
 */
import { Command } from 'commander'
import { startAgentServer } from './server'
import { loadOrCreateAgentConfig, readProjectInfo, resolveProjectRoot } from './project'

const program = new Command()

program
  .name('nova-agent')
  .description('NOVA 浏览器扩展的本地项目 Agent')
  .version('0.1.0')

program
  .command('dev', { isDefault: true })
  .description('启动仅监听本机回环地址的 WebSocket Agent')
  .option('-r, --root <path>', '项目根目录', '.')
  .option('-p, --port <number>', '监听端口', value => Number.parseInt(value, 10), 4736)
  .option('-t, --token <token>', '覆盖连接口令')
  .option('--allow-origin <origin...>', '额外允许的 WebSocket Origin')
  .action(async (options: { root: string; port: number; token?: string; allowOrigin?: string[] }) => {
    const root = await resolveProjectRoot(options.root)
    const config = await loadOrCreateAgentConfig(root, options.port, options.token)
    const project = await readProjectInfo(root)
    const server = startAgentServer({
      root,
      port: config.port,
      token: config.token,
      allowedOrigins: options.allowOrigin,
    })

    server.on('listening', () => {
      console.log('')
      console.log('NOVA Local Agent 已启动')
      console.log(`项目：${project.name} (${project.framework})`)
      console.log(`根目录：${root}`)
      console.log(`地址：ws://127.0.0.1:${config.port}`)
      console.log(`连接口令：${config.token}`)
      console.log('')
      console.log('请把地址和口令填入浏览器扩展侧边栏。')
    })
  })

program.parseAsync().catch((error) => {
  console.error('[NOVA]', error instanceof Error ? error.message : error)
  process.exitCode = 1
})
