import { describe, it, expect } from 'vitest'
import { SystemPromptModule } from '../prompt/modules/SystemPromptModule'
import type { PipelineContext } from '../pipeline/PipelineContext'

describe('SystemPromptModule', () => {
  const module = new SystemPromptModule()

  it('should produce a stable prompt string', async () => {
    const context: PipelineContext = { input: 'test' }
    const result = await module.build(context)

    expect(result).toBeTruthy()
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(100)
  })

  it('should identify as Project Genesis planner', async () => {
    const context: PipelineContext = { input: 'test' }
    const result = await module.build(context)

    expect(result).toContain('Project Genesis')
    expect(result).toContain('game action planner')
  })

  it('should describe CreateEntity action', async () => {
    const context: PipelineContext = { input: 'test' }
    const result = await module.build(context)

    expect(result).toContain('CreateEntity')
    expect(result).toContain('entityType')
    expect(result).toContain('tree')
  })

  it('should describe MoveEntity action', async () => {
    const context: PipelineContext = { input: 'test' }
    const result = await module.build(context)

    expect(result).toContain('MoveEntity')
    expect(result).toContain('entity ID')
  })

  it('should require JSON output format', async () => {
    const context: PipelineContext = { input: 'test' }
    const result = await module.build(context)

    expect(result).toContain('JSON')
    expect(result).toContain('No markdown')
    expect(result).toContain('{"actions":')
  })

  it('should be independent of context input', async () => {
    const result1 = await module.build({ input: 'tree' })
    const result2 = await module.build({ input: 'move entity' })

    expect(result1).toBe(result2)
  })
})