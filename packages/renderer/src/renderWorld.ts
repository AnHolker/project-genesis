import type { Entity, World } from '@genesis/shared'

const TILE_SIZE = 48
const CANVAS_WIDTH = 600
const CANVAS_HEIGHT = 400
const GRID_COLS = Math.floor(CANVAS_WIDTH / TILE_SIZE)
const GRID_ROWS = Math.floor(CANVAS_HEIGHT / TILE_SIZE)

function entityToPixel(entity: Entity): { px: number; py: number } {
  return {
    px: Math.min(entity.x, GRID_COLS - 1) * TILE_SIZE + TILE_SIZE / 2,
    py: Math.min(entity.y, GRID_ROWS - 1) * TILE_SIZE + TILE_SIZE / 2,
  }
}

function drawEntity(ctx: CanvasRenderingContext2D, entity: Entity): void {
  const { px, py } = entityToPixel(entity)

  switch (entity.type) {
    case 'tree': {
      // Trunk
      ctx.fillStyle = '#8B4513'
      ctx.fillRect(px - 4, py - 4, 8, 16)

      // Canopy (triangle)
      ctx.fillStyle = '#2E8B57'
      ctx.beginPath()
      ctx.moveTo(px, py - 24)
      ctx.lineTo(px - 16, py + 4)
      ctx.lineTo(px + 16, py + 4)
      ctx.closePath()
      ctx.fill()
      break
    }
  }
}

function drawGrid(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = '#1a1a1a'
  ctx.lineWidth = 1

  for (let col = 0; col <= GRID_COLS; col++) {
    const x = col * TILE_SIZE
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, CANVAS_HEIGHT)
    ctx.stroke()
  }

  for (let row = 0; row <= GRID_ROWS; row++) {
    const y = row * TILE_SIZE
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(CANVAS_WIDTH, y)
    ctx.stroke()
  }
}

export function renderWorld(ctx: CanvasRenderingContext2D, world: World): void {
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

  ctx.fillStyle = '#1a1a2e'
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

  drawGrid(ctx)

  for (const entity of world.entities) {
    drawEntity(ctx, entity)
  }
}

export { CANVAS_WIDTH, CANVAS_HEIGHT }