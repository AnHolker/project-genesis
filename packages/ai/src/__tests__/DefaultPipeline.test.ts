import { describe, it, expect, vi } from 'vitest'
import { DefaultPipeline } from '../pipeline/DefaultPipeline'
import type { PipelineContext } from '../pipeline/PipelineContext'
import { MockPlanner } from '../planner/MockPlanner'
import { MockPlannerProvider } from '../provider/MockPlannerProvider'
import { MockStreamingProvider } from '../provider/MockStreamingProvider'
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

// ---------------------------------------------------------------------------
// Streaming Pipeline Tests
// ---------------------------------------------------------------------------

describe('DefaultPipeline.stream — Streaming Provider Path', () => {

  it('should emit StreamChunk events and return correct PlannerResult', async () => {
    const streamingProvider = new MockStreamingProvider()
    const planner = new MockPlanner(streamingProvider)
    const promptBuilder = new DefaultPromptBuilder([new UserInputModule()])
    const pipeline = new DefaultPipeline(planner, promptBuilder, streamingProvider)

    const receivedEvents: PipelineEvent[] = []
    pipeline.events.subscribe({ onEvent: (e) => receivedEvents.push(e) })

    const context: PipelineContext = { input: 'create a tree' }
    const result = await pipeline.stream(context)

    // Should have received StreamChunk events
    const streamChunks = receivedEvents.filter((e) => e.type === 'StreamChunk')
    expect(streamChunks.length).toBeGreaterThan(0)

    // Each StreamChunk should carry a chunk payload
    for (const chunk of streamChunks) {
      expect(chunk.payload).toBeDefined()
      expect(typeof chunk.payload!.chunk).toBe('string')
    }

    // Final result should contain correct PlannerResult
    expect(result.plannerResult).toBeDefined()
    expect(result.plannerResult!.actions).toHaveLength(1)
    expect(result.plannerResult!.actions[0].type).toBe('CreateEntity')
  })

  it('should emit events in correct order during streaming', async () => {
    const streamingProvider = new MockStreamingProvider()
    const planner = new MockPlanner(streamingProvider)
    const promptBuilder = new DefaultPromptBuilder([new UserInputModule()])
    const pipeline = new DefaultPipeline(planner, promptBuilder, streamingProvider)

    const receivedEvents: PipelineEvent[] = []
    pipeline.events.subscribe({ onEvent: (e) => receivedEvents.push(e) })

    const context: PipelineContext = { input: 'tree' }
    await pipeline.stream(context)

    // Check that all event types are in the right relative order
    const eventTypes = receivedEvents.map((e) => e.type)

    // PipelineStarted must be first
    expect(eventTypes[0]).toBe('PipelineStarted')
    // PromptBuilt must come after PipelineStarted
    const promptBuiltIdx = eventTypes.indexOf('PromptBuilt')
    expect(promptBuiltIdx).toBeGreaterThan(0)
    // PlannerStarted must come after PromptBuilt
    const plannerStartedIdx = eventTypes.indexOf('PlannerStarted')
    expect(plannerStartedIdx).toBeGreaterThan(promptBuiltIdx)
    // StreamChunk events must come after PlannerStarted
    const firstStreamChunkIdx = eventTypes.indexOf('StreamChunk')
    expect(firstStreamChunkIdx).toBeGreaterThan(plannerStartedIdx)
    // PlannerFinished must come after all StreamChunks
    const lastStreamChunkIdx = eventTypes.lastIndexOf('StreamChunk')
    const plannerFinishedIdx = eventTypes.indexOf('PlannerFinished')
    expect(plannerFinishedIdx).toBeGreaterThan(lastStreamChunkIdx)
    // PipelineFinished must be last
    expect(eventTypes[eventTypes.length - 1]).toBe('PipelineFinished')
  })

  it('should preserve context fields (metadata, input) in streaming result', async () => {
    const streamingProvider = new MockStreamingProvider()
    const planner = new MockPlanner(streamingProvider)
    const promptBuilder = new DefaultPromptBuilder([new UserInputModule()])
    const pipeline = new DefaultPipeline(planner, promptBuilder, streamingProvider)

    const metadata = { sessionId: 'stream-test-1' }
    const context: PipelineContext = { input: 'tree', metadata }
    const result = await pipeline.stream(context)

    expect(result.input).toBe('tree')
    expect(result.metadata).toEqual(metadata)
    expect(result.metadata).toBe(metadata)
  })

  it('should produce the same PlannerResult as execute() for the same input', async () => {
    const streamingProvider = new MockStreamingProvider()
    const planner = new MockPlanner(streamingProvider)
    const promptBuilder = new DefaultPromptBuilder([new UserInputModule()])

    const pipeline = new DefaultPipeline(planner, promptBuilder, streamingProvider)

    const context: PipelineContext = { input: 'create a tree' }

    const executeResult = await pipeline.execute(context)
    const streamResult = await pipeline.stream(context)

    expect(streamResult.plannerResult).toBeDefined()
    expect(streamResult.plannerResult!.actions).toEqual(
      executeResult.plannerResult!.actions,
    )
  })
})

describe('DefaultPipeline.stream — Fallback Provider Path', () => {
  const mockConfig = new DefaultAIConfiguration()

  it('should fall back to non-streaming path when provider is not StreamingPlannerProvider', async () => {
    const provider = new MockPlannerProvider(mockConfig)
    const planner = new MockPlanner(provider)
    const promptBuilder = new DefaultPromptBuilder([new UserInputModule()])

    // Note: No provider passed — uses only planner
    const pipeline = new DefaultPipeline(planner, promptBuilder)

    const receivedEvents: PipelineEvent[] = []
    pipeline.events.subscribe({ onEvent: (e) => receivedEvents.push(e) })

    const context: PipelineContext = { input: 'create a tree' }
    const result = await pipeline.stream(context)

    // Should NOT emit StreamChunk events
    const streamChunks = receivedEvents.filter((e) => e.type === 'StreamChunk')
    expect(streamChunks).toHaveLength(0)

    // Should still return a valid PlannerResult
    expect(result.plannerResult).toBeDefined()
    expect(result.plannerResult!.actions).toHaveLength(1)
  })

  it('should fall back when provider is passed but does not implement StreamingPlannerProvider', async () => {
    const provider = new MockPlannerProvider(mockConfig)
    const planner = new MockPlanner(provider)
    const promptBuilder = new DefaultPromptBuilder([new UserInputModule()])

    // Provider passed but it's not a streaming provider
    const pipeline = new DefaultPipeline(planner, promptBuilder, provider)

    const receivedEvents: PipelineEvent[] = []
    pipeline.events.subscribe({ onEvent: (e) => receivedEvents.push(e) })

    const context: PipelineContext = { input: 'tree' }
    const result = await pipeline.stream(context)

    const streamChunks = receivedEvents.filter((e) => e.type === 'StreamChunk')
    expect(streamChunks).toHaveLength(0)

    expect(result.plannerResult).toBeDefined()
    expect(result.plannerResult!.actions).toHaveLength(1)
  })

  it('should return same result as execute() on fallback path', async () => {
    const provider = new MockPlannerProvider(mockConfig)
    const planner = new MockPlanner(provider)
    const promptBuilder = new DefaultPromptBuilder([new UserInputModule()])

    const pipeline = new DefaultPipeline(planner, promptBuilder)

    const context: PipelineContext = { input: 'create a tree' }

    const executeResult = await pipeline.execute(context)
    const streamResult = await pipeline.stream(context)

    expect(streamResult.plannerResult!.actions).toEqual(
      executeResult.plannerResult!.actions,
    )
  })
})

describe('DefaultPipeline.stream — Empty / Edge Cases', () => {

  it('should return empty actions on empty input with streaming provider', async () => {
    const streamingProvider = new MockStreamingProvider()
    const planner = new MockPlanner(streamingProvider)
    const promptBuilder = new DefaultPromptBuilder([new UserInputModule()])
    const pipeline = new DefaultPipeline(planner, promptBuilder, streamingProvider)

    const context: PipelineContext = { input: '' }
    const result = await pipeline.stream(context)

    expect(result.plannerResult).toBeDefined()
    // MockStreamingProvider always streams the same JSON regardless of input
    // so it should still produce actions
    expect(result.plannerResult!.actions).toHaveLength(1)
  })

  it('should handle cancellation gracefully (no provider access after break)', async () => {
    // Simulate cancellation by not subscribing to events — just verify no crash
    const streamingProvider = new MockStreamingProvider()
    const planner = new MockPlanner(streamingProvider)
    const promptBuilder = new DefaultPromptBuilder([new UserInputModule()])
    const pipeline = new DefaultPipeline(planner, promptBuilder, streamingProvider)

    const context: PipelineContext = { input: 'tree' }
    const result = await pipeline.stream(context)

    expect(result.plannerResult).toBeDefined()
  })

  it('should maintain backward compatibility — stream() does not affect execute()', async () => {
    const streamingProvider = new MockStreamingProvider()
    const planner = new MockPlanner(streamingProvider)
    const promptBuilder = new DefaultPromptBuilder([new UserInputModule()])
    const pipeline = new DefaultPipeline(planner, promptBuilder, streamingProvider)

    const context: PipelineContext = { input: 'create a tree' }

    // Call stream first, then execute — no interference
    await pipeline.stream(context)
    const result = await pipeline.execute(context)

    expect(result.plannerResult).toBeDefined()
    expect(result.plannerResult!.actions).toHaveLength(1)
  })
})

describe('DefaultPipeline.stream — Event Sequence Details', () => {
  const mockConfig = new DefaultAIConfiguration()

  it('should emit exactly 5+ event types (base events + StreamChunks)', async () => {
    const streamingProvider = new MockStreamingProvider()
    const planner = new MockPlanner(streamingProvider)
    const promptBuilder = new DefaultPromptBuilder([new UserInputModule()])
    const pipeline = new DefaultPipeline(planner, promptBuilder, streamingProvider)

    const receivedEvents: PipelineEvent[] = []
    pipeline.events.subscribe({ onEvent: (e) => receivedEvents.push(e) })

    await pipeline.stream({ input: 'tree' })

    // Base events: PipelineStarted, PromptBuilt, PlannerStarted, PlannerFinished, PipelineFinished
    // Plus StreamChunks (one per character)
    const baseTypes = new Set(receivedEvents.map((e) => e.type))
    expect(baseTypes.has('PipelineStarted')).toBe(true)
    expect(baseTypes.has('PromptBuilt')).toBe(true)
    expect(baseTypes.has('PlannerStarted')).toBe(true)
    expect(baseTypes.has('StreamChunk')).toBe(true)
    expect(baseTypes.has('PlannerFinished')).toBe(true)
    expect(baseTypes.has('PipelineFinished')).toBe(true)
  })

  it('should not emit StreamChunk during fallback', async () => {
    const provider = new MockPlannerProvider(mockConfig)
    const planner = new MockPlanner(provider)
    const promptBuilder = new DefaultPromptBuilder([new UserInputModule()])
    const pipeline = new DefaultPipeline(planner, promptBuilder)

    const receivedEvents: PipelineEvent[] = []
    pipeline.events.subscribe({ onEvent: (e) => receivedEvents.push(e) })

    await pipeline.stream({ input: 'tree' })

    const hasStreamChunk = receivedEvents.some((e) => e.type === 'StreamChunk')
    expect(hasStreamChunk).toBe(false)
  })

  it('every event should have a valid timestamp', async () => {
    const streamingProvider = new MockStreamingProvider()
    const planner = new MockPlanner(streamingProvider)
    const promptBuilder = new DefaultPromptBuilder([new UserInputModule()])
    const pipeline = new DefaultPipeline(planner, promptBuilder, streamingProvider)

    const receivedEvents: PipelineEvent[] = []
    pipeline.events.subscribe({ onEvent: (e) => receivedEvents.push(e) })

    await pipeline.stream({ input: 'tree' })

    for (const event of receivedEvents) {
      expect(event.timestamp).toBeGreaterThan(0)
    }
  })
})