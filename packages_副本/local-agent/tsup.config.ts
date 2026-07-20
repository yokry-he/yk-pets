/**
 * 文件职责 / File responsibility
 * Local Agent 的 tsup 生产构建配置。
 * Production tsup configuration for the Local Agent.
 */
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/cli.ts', 'src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  target: 'node22',
  noExternal: [/^@nova\/shared/],
})
