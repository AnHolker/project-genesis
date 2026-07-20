<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useGameStore } from './stores/gameStore'
import { renderWorld, CANVAS_WIDTH, CANVAS_HEIGHT } from '@genesis/renderer'

const store = useGameStore()
const input = ref('')
const canvasRef = ref<HTMLCanvasElement | null>(null)

function getCtx(): CanvasRenderingContext2D | null {
  return canvasRef.value?.getContext('2d') ?? null
}

function draw() {
  const ctx = getCtx()
  if (!ctx) return
  renderWorld(ctx, store.runtime.world)
}

onMounted(() => {
  draw()
})

watch(() => store.renderVersion, () => {
  draw()
})

function handleSend() {
  const text = input.value.trim()
  if (!text) return
  store.send(text)
  input.value = ''
}
</script>

<template>
  <div class="app">
    <h1>Project Genesis</h1>
    <canvas
      ref="canvasRef"
      :width="CANVAS_WIDTH"
      :height="CANVAS_HEIGHT"
      class="canvas"
    />
    <div class="controls">
      <input
        v-model="input"
        type="text"
        placeholder="输入指令... (例如: 增加一棵树)"
        class="input"
        @keyup.enter="handleSend"
      />
      <button class="btn" @click="handleSend">发送</button>
    </div>
    <div class="log" v-if="store.log.length">
      <div v-for="(entry, i) in store.log" :key="i" class="log-entry">{{ entry }}</div>
    </div>
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #0a0a0a;
  color: #ffffff;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.app {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

h1 {
  font-size: 2rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin-bottom: 0.25rem;
}

.canvas {
  border: 1px solid #333;
  border-radius: 8px;
}

.controls {
  display: flex;
  gap: 0.5rem;
  width: 100%;
  max-width: 600px;
}

.input {
  flex: 1;
  padding: 0.6rem 1rem;
  border: 1px solid #333;
  border-radius: 6px;
  background: #1a1a1a;
  color: #fff;
  font-size: 0.95rem;
  outline: none;
}

.input:focus {
  border-color: #2E8B57;
}

.btn {
  padding: 0.6rem 1.2rem;
  border: none;
  border-radius: 6px;
  background: #2E8B57;
  color: #fff;
  font-size: 0.95rem;
  cursor: pointer;
  transition: background 0.2s;
}

.btn:hover {
  background: #3aa86a;
}

.log {
  width: 100%;
  max-width: 600px;
  text-align: left;
}

.log-entry {
  font-size: 0.8rem;
  color: #666;
  padding: 0.15rem 0;
  font-family: monospace;
}
</style>