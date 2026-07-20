import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@genesis/runtime': resolve(__dirname, '../../packages/runtime/src'),
      '@genesis/renderer': resolve(__dirname, '../../packages/renderer/src'),
      '@genesis/ai': resolve(__dirname, '../../packages/ai/src'),
      '@genesis/shared': resolve(__dirname, '../../packages/shared/src'),
    },
  },
})