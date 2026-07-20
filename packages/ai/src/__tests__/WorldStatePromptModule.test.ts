import { describe, it, expect } from 'vitest'
import { WorldStatePromptModule } from '../prompt/modules/WorldStatePromptModule'
import type { PipelineContext } from '../pipeline/PipelineContext'

describe('WorldStatePromptModule', () => {
  const module = new WorldStatePromptModule()

  // --- Test 1: Empty world ---
  it('should return empty string when worldState is undefined', async () => {
    const context: PipelineContext = { input: 'test' }
    const result = await module.build(context)
    expect(result).toBe('')
  })

  it('should return empty string when worldState is empty', async () => {
    const context: PipelineContext = { input: 'test', worldState: '' }
    const result = await module.build(context)
    expect(result).toBe('')
  })

  // --- Test 2: Single entity ---
  it('should format a single entity correctly', async () => {
    const context: PipelineContext = {
      input: 'test',
      worldState: 'Tree\nid: tree-1\nposition: (3,5)',
    }
    const result = await module.build(context)
    expect(result).toBe('Current World:\n\nTree\nid: tree-1\nposition: (3,5)')
  })

  // --- Test 3: Multiple entities ---
  it('should format multiple entities correctly', async () => {
    const context: PipelineContext = {
      input: 'test',
      worldState:
        'Tree\nid: tree-1\nposition: (3,5)\n\nHouse\nid: house-1\nposition: (6,4)',
    }
    const result = await module.build(context)
    expect(result).toContain('Current World:')
    expect(result).toContain('Tree')
    expect(result).toContain('id: tree-1')
    expect(result).toContain('House')
    expect(result).toContain('id: house-1')
    expect(result).toContain('position: (6,4)')
  })

  // --- Test 4: WorldState output is independent of input ---
  it('should only depend on worldState, not input', async () => {
    const worldState = 'Rock\nid: rock-1\nposition: (0,0)'
    const context1: PipelineContext = { input: 'a', worldState }
    const context2: PipelineContext = { input: 'b', worldState }
    expect(await module.build(context1)).toBe(await module.build(context2))
  })
})