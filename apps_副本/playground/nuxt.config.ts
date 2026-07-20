/**
 * 文件职责 / File responsibility
 * Nuxt Playground 构建和运行配置。
 * Nuxt Playground build and runtime configuration.
 */
import { templateCompilerOptions } from '@tresjs/core'

const env = (globalThis as typeof globalThis & {
  process?: { env?: Record<string, string | undefined> }
}).process?.env ?? {}

export default defineNuxtConfig({
  compatibilityDate: '2026-07-01',

  modules: [
    '@pinia/nuxt',
  ],

  css: ['~/assets/css/main.css'],

  devtools: {
    enabled: true,
  },

  build: {
    transpile: [/@tresjs/],
  },

  vue: {
    compilerOptions: {
      isCustomElement: templateCompilerOptions.template.compilerOptions.isCustomElement,
    },
  },

  vite: {
    resolve: {
      dedupe: ['three'],
    },
    optimizeDeps: {
      include: ['three'],
    },
  },

  typescript: {
    strict: true,
  },

  runtimeConfig: {
    openaiApiKey: env.OPENAI_API_KEY || '',
    openaiModel: env.OPENAI_MODEL || 'gpt-5.6-luna',
  },

  app: {
    head: {
      htmlAttrs: {
        lang: 'zh-CN',
      },
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#090b13' },
      ],
    },
  },
})
