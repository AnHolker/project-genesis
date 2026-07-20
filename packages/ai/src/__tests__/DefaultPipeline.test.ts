import { describe, it, expect, vi } from 'vitest'
import { DefaultPipeline } from '../pipeline/DefaultPipeline'
import type { PipelineContext } from '../pipeline/PipelineContext'
import { MockPlanner } from '../planner/MockPlanner'
import { MockPlannerProvider } from '../provider/MockPlannerProvider'
import { DefaultPromptBuilder } from '../prompt/DefaultPromptBuilder'
import { UserInputModule, MemoryPromptModule, SystemPromptModule } from '../prompt/modules'
import { DefaultMemory } from '../memory/DefaultMemory'
import { DefaultAIConfiguration } from '../config/DefaultAIConfiguration'
import type { PipelineEvent } from '../events'

describe('DefaultPipeline Integration', () => {
  const mockConfig = new DefaultAIConfiguration()

  function createBasicPipeline() {
    const provider = new MockPlannerProvider(mockConfig)
    const planner = new MockPlanner(provider)
    const promptBuilder = new DefaultPromptBuilder([new UserInputModule()])
    const pipeline = new DefaultPipeline(planner, promptBuilder)
    return { pipeline, planner, promptBuilder }
  }

  // --- Test 1: Basic Pipeline ---
  it('should execute basic pipeline and return PipelineContext with plannerResult', async () => {
    const { pipeline } = createBasicPipeline()
    const context: PipelineContext = { input: 'create a tree' }

    const result = await pipeline.execute(context)

    expect(result).toBeDefined()
    expect(result.plannerResult).toBeDefined()
    expect(result.plannerResult!.actions).toHaveLength(1)
    expect(result.plannerResult!.actions[0]).toMatchObject({
      type: 'CreateEntity',
      entityType: 'tree',
    })
  })

  // --- Test 2: Memory Integration ---
  it('should include memory content in the prompt sent to Planner', async () => {
    const provider = new MockPlannerProvider(mockConfig)
    const planner = new MockPlanner(provider)
    const planSpy = vi.spyOn(planner, 'plan')
    const promptBuilder = new DefaultPromptBuilder([
      new SystemPromptModule(),
      new UserInputModule(),
      new MemoryPromptModule(),
    ])
    const pipeline = new DefaultPipeline(planner, promptBuilder)

    const memory = new DefaultMemory()
    await memory.set('conversation', [
      { input: 'add a tree', summary: 'Created a tree' },
    ])

    const context: PipelineContext = { input: 'create a tree', memory }
    await pipeline.execute(context)

    expect(planSpy).toHaveBeenCalledTimes(1)
    const receivedRequest = planSpy.mock.calls[0][0]
    expect(receivedRequest.prompt).toContain('Previous conversation:')
    expect(receivedRequest.prompt).toContain('User: add a tree')
    expect(receivedRequest.prompt).toContain('Assistant: Created a tree')
    expect(receivedRequest.prompt).toContain('create a tree')

    planSpy.mockRestore()
  })

  // --- Test 3: Pipeline Events ---
  it('should emit events in correct order during execution', async () => {
    const { pipeline } = createBasicPipeline()
    const receivedEvents: PipelineEvent[] = []

    pipeline.events.subscribe({
      onEvent(event: PipelineEvent) {
        receivedEvents.push(event)
      },
    })

    const context: PipelineContext = { input: 'tree' }
    await pipeline.execute(context)

    expect(receivedEvents).toHaveLength(5)

    const eventTypes = receivedEvents.map((e) => e.type)
    expect(eventTypes).toEqual([
      'PipelineStarted',
      'PromptBuilt',
      'PlannerStarted',
      'PlannerFinished',
      'PipelineFinished',
    ])

    // Each event must have a valid timestamp
    for (const event of receivedEvents) {
      expect(event.timestamp).toBeGreaterThan(0)
    }

    // PromptBuilt should carry the prompt in payload
    const promptBuiltEvent = receivedEvents[1]
    expect(promptBuiltEvent.type).toBe('PromptBuilt')
    expect(promptBuiltEvent.payload).toBeDefined()
    expect(promptBuiltEvent.payload!.prompt).toBe('tree')
  })

  // --- Test 4: PromptBuilder is called ---
  it('should call PromptBuilder.build during execution', async () => {
    const provider = new MockPlannerProvider(mockConfig)
    const planner = new MockPlanner(provider)
    const promptBuilder = new DefaultPromptBuilder([new UserInputModule()])
    const buildSpy = vi.spyOn(promptBuilder, 'build')
    const pipeline = new DefaultPipeline(planner, promptBuilder)

    const context: PipelineContext = { input: 'tree' }
    await pipeline.execute(context)

    expect(buildSpy).toHaveBeenCalledTimes(1)
    expect(buildSpy).toHaveBeenCalledWith(context)

    buildSpy.mockRestore()
  })

  // --- Test 5: Planner is called ---
  it('should call Planner.plan during execution', async () => {
    const provider = new MockPlannerProvider(mockConfig)
    const planner = new MockPlanner(provider)
    const planSpy = vi.spyOn(planner, 'plan')
    const promptBuilder = new DefaultPromptBuilder([new UserInputModule()])
    const pipeline = new DefaultPipeline(planner, promptBuilder)

    const context: PipelineContext = { input: 'tree' }
    await pipeline.execute(context)

    expect(planSpy).toHaveBeenCalledTimes(1)

    planSpy.mockRestore()
  })

  // --- Test 6: PipelineContext extension fields preserved ---
  it('should preserve metadata and extension fields in result', async () => {
    const { pipeline } = createBasicPipeline()

    const metadata = { sessionId: 'test-123', userId: 'user-42' }
    const context: PipelineContext = {
      input: 'tree',
      metadata,
    }

    const result = await pipeline.execute(context)

    expect(result.metadata).toEqual(metadata)
    expect(result.metadata).toBe(metadata) // same reference — not a copy
  })

  // --- Test 7: PlannerResult correctly written back ---
  it('should return the exact PlannerResult from Planner in result.plannerResult', async () => {
    const { pipeline } = createBasicPipeline()

    const context: PipelineContext = { input: 'tree' }
    const result = await pipeline.execute(context)

    // Verify the plannerResult matches what the MockPlannerProvider would produce
    expect(result.plannerResult).toBeDefined()
    expect(result.plannerResult!.actions).toHaveLength(1)
    expect(result.plannerResult!.actions[0].type).toBe('CreateEntity')

    // Verify the result has the same input as the original context
    expect(result.input).toBe('tree')
  })
})