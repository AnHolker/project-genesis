import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@genesis/shared': resolve(__dirname, '../shared/src'),
    },
  },
  test: {
    include: ['src/__tests__/**/*.test.ts'],
  },
})