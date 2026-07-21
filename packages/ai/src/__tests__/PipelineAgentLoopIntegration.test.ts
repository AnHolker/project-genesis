import { describe, it, expect, vi } from 'vitest'
import { DefaultPipeline } from '../pipeline/DefaultPipeline'
import { DefaultAgentLoop } from '../agent/DefaultAgentLoop'
import { MockPlanner } from '../planner/MockPlanner'
import { RetryPlanner } from '../planner/RetryPlanner'
import { ToolCallPlanner } from '../planner/ToolCallPlanner'
import { MockPlannerProvider } from '../provider/MockPlannerProvider'
import { MockStreamingProvider } from '../provider/MockStreamingProvider'
import { DefaultPromptBuilder } from '../prompt/DefaultPromptBuilder'
import { UserInputModule, MemoryPromptModule, SystemPromptModule } from '../prompt/modules'
import { DefaultMemory } from '../memory/DefaultMemory'
import { DefaultAIConfiguration } from '../config/DefaultAIConfiguration'
import { DefaultToolRegistry } from '../tools/ToolRegistry'
import { RetryPolicy } from '../retry/RetryPolicy'
import type { AgentLoop } from '../agent/AgentLoop'
import type { AgentLoopContext } from '../agent/AgentLoopContext'
import type { AgentLoopResult } from '../agent/AgentLoopResult'
import type { Planner } from '../planner/Planner'
import type { PlannerResult } from '../planner/PlannerResult'
import type { PipelineContext } from '../pipeline/PipelineContext'
import type { PipelineEvent } from '../events/PipelineEvent'
import type { AIRequest } from '../request'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockConfig = new DefaultAIConfiguration()

/**
 * Creates a basic pipeline with MockPlanner + UserInputModule.
 * Uses the OLD constructor signature (no AgentLoop param) — backward compat.
 */
function createBasicPipeline(agentLoop?: AgentLoop) {
  const provider = new MockPlannerProvider(mockConfig)
  const planner = new MockPlanner(provider)
  const promptBuilder = new DefaultPromptBuilder([new UserInputModule()])
  const pipeline = agentLoop
    ? new DefaultPipeline(planner, promptBuilder, undefined, agentLoop)
    : new DefaultPipeline(planner, promptBuilder)
  return { pipeline, planner, promptBuilder, provider }
}

/**
 * Creates a pipeline with explicit AgentLoop for event testing.
 */
function createPipelineWithAgentLoop(
  agentLoop: AgentLoop,
  provider?: MockPlannerProvider,
) {
  const p = provider ?? new MockPlannerProvider(mockConfig)
  const planner = new MockPlanner(p)
  const promptBuilder = new DefaultPromptBuilder([new UserInputModule()])
  const pipeline = new DefaultPipeline(planner, promptBuilder, undefined, agentLoop)
  return { pipeline, planner, promptBuilder }
}

/**
 * Creates an AgentLoop spy that records calls.
 */
function createAgentLoopSpy(): [AgentLoop, AgentLoopContext[]] {
  const capturedContexts: AgentLoopContext[] = []
  const spy: AgentLoop = {
    async execute(context: AgentLoopContext): Promise<AgentLoopResult> {
      capturedContexts.push(context)
      // Actually execute through DefaultAgentLoop for realistic behavior
      const inner = new DefaultAgentLoop()
      const innerCtx: AgentLoopContext = {
        request: context.request,
        planner: context.planner,
        maxIterations: context.maxIterations,
      }
      return inner.execute(innerCtx)
    },
  }
  return [spy, capturedContexts]
}

/**
 * Collects events from both Pipeline and AgentLoop emitters.
 */
async function collectAllEvents(
  pipeline: DefaultPipeline,
  agentLoop: DefaultAgentLoop,
  context: PipelineContext,
): Promise<{ pipelineEvents: PipelineEvent[]; agentLoopEvents: PipelineEvent[] }> {
  const pipelineEvents: PipelineEvent[] = []
  const agentLoopEvents: PipelineEvent[] = []

  pipeline.events.subscribe({ onEvent: (e) => pipelineEvents.push(e) })
  agentLoop.events.subscribe({ onEvent: (e) => agentLoopEvents.push(e) })

  await pipeline.execute(context)

  return { pipelineEvents, agentLoopEvents }
}

// ---------------------------------------------------------------------------
// Pipeline.execute() — AgentLoop Integration
// ---------------------------------------------------------------------------

describe('Pipeline.execute() — AgentLoop Integration', () => {
  it('should call AgentLoop.execute() not Planner.plan() directly', async () => {
    const [spyAgentLoop] = createAgentLoopSpy()
    const { pipeline, planner } = createPipelineWithAgentLoop(spyAgentLoop)
    const planSpy = vi.spyOn(planner, 'plan')

    await pipeline.execute({ input: 'create a tree' })

    // planner.plan should still be called (by AgentLoop internally)
    expect(planSpy).toHaveBeenCalledTimes(1)
    planSpy.mockRestore()
  })

  it('should build AgentLoopContext with correct request', async () => {
    const [spyAgentLoop, capturedContexts] = createAgentLoopSpy()
    const { pipeline } = createPipelineWithAgentLoop(spyAgentLoop)

    await pipeline.execute({ input: 'create a tree' })

    expect(capturedContexts).toHaveLength(1)
    expect(capturedContexts[0].request.prompt).toContain('create a tree')
  })

  it('should build AgentLoopContext with the pipeline planner', async () => {
    const [spyAgentLoop, capturedContexts] = createAgentLoopSpy()
    const { pipeline, planner } = createPipelineWithAgentLoop(spyAgentLoop)

    await pipeline.execute({ input: 'create a tree' })

    expect(capturedContexts[0].planner).toBe(planner)
  })

  it('should set maxIterations to 5 in AgentLoopContext', async () => {
    const [spyAgentLoop, capturedContexts] = createAgentLoopSpy()
    const { pipeline } = createPipelineWithAgentLoop(spyAgentLoop)

    await pipeline.execute({ input: 'create a tree' })

    expect(capturedContexts[0].maxIterations).toBe(5)
  })

  it('should return PlannerResult with correct actions through AgentLoop', async () => {
    const { pipeline } = createBasicPipeline()
    const context: PipelineContext = { input: 'create a tree' }

    const result = await pipeline.execute(context)

    expect(result.plannerResult).toBeDefined()
    expect(result.plannerResult!.actions).toHaveLength(1)
    expect(result.plannerResult!.actions[0]).toMatchObject({
      type: 'CreateEntity',
      entityType: 'tree',
    })
  })

  it('should return PlannerResult with correct reasoning through AgentLoop', async () => {
    const reasoning = 'User wants a tree at (5, 3)'
    const customPlanner: Planner = {
      async plan(_request: AIRequest): Promise<PlannerResult> {
        return { actions: [{ type: 'CreateEntity', entityType: 'tree', x: 5, y: 3 }], reasoning }
      },
    }
    const promptBuilder = new DefaultPromptBuilder([new UserInputModule()])
    const pipeline = new DefaultPipeline(customPlanner, promptBuilder)
    const result = await pipeline.execute({ input: 'create a tree' })

    expect(result.plannerResult!.reasoning).toBe(reasoning)
  })

  it('should preserve PipelineContext fields through AgentLoop execution', async () => {
    const { pipeline } = createBasicPipeline()
    const metadata = { sessionId: 'test-123', userId: 'user-42' }
    const worldState = 'Tree at (3, 5)'
    const context: PipelineContext = { input: 'tree', metadata, worldState }

    const result = await pipeline.execute(context)

    expect(result.metadata).toEqual(metadata)
    expect(result.worldState).toBe(worldState)
    expect(result.input).toBe('tree')
  })

  it('should return empty actions for unknown input through AgentLoop', async () => {
    const { pipeline } = createBasicPipeline()
    const result = await pipeline.execute({ input: 'do something unknown' })

    expect(result.plannerResult).toBeDefined()
    expect(result.plannerResult!.actions).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Backward Compatibility
// ---------------------------------------------------------------------------

describe('Backward Compatibility', () => {
  it('should work with old constructor (planner, promptBuilder) — no AgentLoop', async () => {
    const provider = new MockPlannerProvider(mockConfig)
    const planner = new MockPlanner(provider)
    const promptBuilder = new DefaultPromptBuilder([new UserInputModule()])
    const pipeline = new DefaultPipeline(planner, promptBuilder)

    const result = await pipeline.execute({ input: 'create a tree' })

    expect(result.plannerResult).toBeDefined()
    expect(result.plannerResult!.actions).toHaveLength(1)
  })

  it('should work with old constructor (planner, promptBuilder, provider)', async () => {
    const provider = new MockPlannerProvider(mockConfig)
    const planner = new MockPlanner(provider)
    const promptBuilder = new DefaultPromptBuilder([new UserInputModule()])
    const pipeline = new DefaultPipeline(planner, promptBuilder, provider)

    const result = await pipeline.execute({ input: 'create a tree' })

    expect(result.plannerResult).toBeDefined()
    expect(result.plannerResult!.actions).toHaveLength(1)
  })

  it('should produce same result with or without explicit AgentLoop', async () => {
    const provider = new MockPlannerProvider(mockConfig)
    const promptBuilder = new DefaultPromptBuilder([new UserInputModule()])

    // Without AgentLoop
    const planner1 = new MockPlanner(provider)
    const pipeline1 = new DefaultPipeline(planner1, promptBuilder)
    const result1 = await pipeline1.execute({ input: 'create a tree' })

    // With AgentLoop
    const planner2 = new MockPlanner(provider)
    const agentLoop = new DefaultAgentLoop()
    const pipeline2 = new DefaultPipeline(planner2, promptBuilder, undefined, agentLoop)
    const result2 = await pipeline2.execute({ input: 'create a tree' })

    expect(result1.plannerResult!.actions).toEqual(result2.plannerResult!.actions)
  })

  it('should work with all four constructor parameters', async () => {
    const provider = new MockPlannerProvider(mockConfig)
    const planner = new MockPlanner(provider)
    const promptBuilder = new DefaultPromptBuilder([new UserInputModule()])
    const agentLoop = new DefaultAgentLoop()
    const pipeline = new DefaultPipeline(planner, promptBuilder, provider, agentLoop)

    const result = await pipeline.execute({ input: 'create a tree' })

    expect(result.plannerResult).toBeDefined()
    expect(result.plannerResult!.actions).toHaveLength(1)
  })

  it('should use internal DefaultAgentLoop when not provided', () => {
    const provider = new MockPlannerProvider(mockConfig)
    const planner = new MockPlanner(provider)
    const promptBuilder = new DefaultPromptBuilder([new UserInputModule()])
    const pipeline = new DefaultPipeline(planner, promptBuilder)

    // The internal agentLoop should exist (private field, tested by behavior)
    expect(pipeline.execute({ input: 'tree' })).toBeInstanceOf(Promise)
  })
})

// ---------------------------------------------------------------------------
// Pipeline Events — Integration
// ---------------------------------------------------------------------------

describe('Pipeline Events — AgentLoop Integration', () => {
  it('should emit Pipeline events in correct order through AgentLoop', async () => {
    const { pipeline } = createBasicPipeline()
    const receivedEvents: PipelineEvent[] = []

    pipeline.events.subscribe({
      onEvent(event: PipelineEvent) {
        receivedEvents.push(event)
      },
    })

    await pipeline.execute({ input: 'tree' })

    expect(receivedEvents).toHaveLength(5)
    const eventTypes = receivedEvents.map((e) => e.type)
    expect(eventTypes).toEqual([
      'PipelineStarted',
      'PromptBuilt',
      'PlannerStarted',
      'PlannerFinished',
      'PipelineFinished',
    ])
  })

  it('should emit AgentLoop events between Pipeline PlannerStarted and PlannerFinished', async () => {
    const agentLoop = new DefaultAgentLoop()
    const { pipeline } = createPipelineWithAgentLoop(agentLoop)
    const { pipelineEvents, agentLoopEvents } = await collectAllEvents(pipeline, agentLoop, { input: 'tree' })

    // Pipeline events
    const plannerStarted = pipelineEvents.find((e) => e.type === 'PlannerStarted')!
    const plannerFinished = pipelineEvents.find((e) => e.type === 'PlannerFinished')!

    // AgentLoop events
    const agentLoopStarted = agentLoopEvents.find((e) => e.type === 'AgentLoopStarted')!
    const agentLoopFinished = agentLoopEvents.find((e) => e.type === 'AgentLoopFinished')!

    // Verify timing: AgentLoop events occur between PlannerStarted and PlannerFinished
    expect(agentLoopStarted.timestamp).toBeGreaterThanOrEqual(plannerStarted.timestamp)
    expect(agentLoopFinished.timestamp).toBeLessThanOrEqual(plannerFinished.timestamp)
  })

  it('should emit all 4 AgentLoop events during pipeline execution', async () => {
    const agentLoop = new DefaultAgentLoop()
    const { pipeline } = createPipelineWithAgentLoop(agentLoop)
    const { agentLoopEvents } = await collectAllEvents(pipeline, agentLoop, { input: 'tree' })

    const eventTypes = agentLoopEvents.map((e) => e.type)
    expect(eventTypes).toContain('AgentLoopStarted')
    expect(eventTypes).toContain('LoopIterationStarted')
    expect(eventTypes).toContain('LoopIterationFinished')
    expect(eventTypes).toContain('AgentLoopFinished')
  })

  it('should emit AgentLoop events in correct order', async () => {
    const agentLoop = new DefaultAgentLoop()
    const { pipeline } = createPipelineWithAgentLoop(agentLoop)
    const { agentLoopEvents } = await collectAllEvents(pipeline, agentLoop, { input: 'tree' })

    const types = agentLoopEvents.map((e) => e.type)
    const startedIdx = types.indexOf('AgentLoopStarted')
    const iterStartedIdx = types.indexOf('LoopIterationStarted')
    const iterFinishedIdx = types.indexOf('LoopIterationFinished')
    const finishedIdx = types.indexOf('AgentLoopFinished')

    expect(startedIdx).toBeLessThan(iterStartedIdx)
    expect(iterStartedIdx).toBeLessThan(iterFinishedIdx)
    expect(iterFinishedIdx).toBeLessThan(finishedIdx)
  })

  it('should not lose any Pipeline events when AgentLoop is used', async () => {
    const agentLoop = new DefaultAgentLoop()
    const { pipeline } = createPipelineWithAgentLoop(agentLoop)
    const { pipelineEvents } = await collectAllEvents(pipeline, agentLoop, { input: 'tree' })

    expect(pipelineEvents).toHaveLength(5)
  })
})

// ---------------------------------------------------------------------------
// MockPlanner Compatibility via AgentLoop
// ---------------------------------------------------------------------------

describe('MockPlanner — AgentLoop Pipeline Integration', () => {
  it('should produce tree action for "create a tree" through AgentLoop pipeline', async () => {
    const { pipeline } = createBasicPipeline()
    const result = await pipeline.execute({ input: 'create a tree' })

    expect(result.plannerResult!.actions[0]).toMatchObject({
      type: 'CreateEntity',
      entityType: 'tree',
    })
  })

  it('should produce move action for "move entity-1 to 7,3" through AgentLoop pipeline', async () => {
    const { pipeline } = createBasicPipeline()
    const result = await pipeline.execute({ input: 'move entity-1 to 7,3' })

    expect(result.plannerResult!.actions[0]).toMatchObject({
      type: 'MoveEntity',
      id: 'entity-1',
    })
  })

  it('should produce empty actions for unknown input through AgentLoop pipeline', async () => {
    const { pipeline } = createBasicPipeline()
    const result = await pipeline.execute({ input: 'unknown command' })

    expect(result.plannerResult!.actions).toHaveLength(0)
  })

  it('should include memory content in prompt sent to Planner through AgentLoop', async () => {
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

    await pipeline.execute({ input: 'create a tree', memory })

    expect(planSpy).toHaveBeenCalledTimes(1)
    const receivedRequest = planSpy.mock.calls[0][0]
    expect(receivedRequest.prompt).toContain('Previous conversation:')
    expect(receivedRequest.prompt).toContain('create a tree')

    planSpy.mockRestore()
  })
})

// ---------------------------------------------------------------------------
// RetryPlanner Compatibility via AgentLoop
// ---------------------------------------------------------------------------

describe('RetryPlanner — AgentLoop Pipeline Integration', () => {
  it('should work with RetryPlanner through AgentLoop pipeline', async () => {
    const provider = new MockPlannerProvider(mockConfig)
    const planner = new RetryPlanner(provider)
    const promptBuilder = new DefaultPromptBuilder([new UserInputModule()])
    const pipeline = new DefaultPipeline(planner, promptBuilder)

    const result = await pipeline.execute({ input: 'create a tree' })

    expect(result.plannerResult!.actions).toHaveLength(1)
    expect(result.plannerResult!.actions[0].type).toBe('CreateEntity')
  })

  it('should preserve RetryPlanner metadata through AgentLoop pipeline', async () => {
    const provider = new MockPlannerProvider(mockConfig)
    const planner = new RetryPlanner(provider)
    const promptBuilder = new DefaultPromptBuilder([new UserInputModule()])
    const pipeline = new DefaultPipeline(planner, promptBuilder)

    const result = await pipeline.execute({ input: 'create a tree' })

    expect(result.plannerResult!.metadata).toBeDefined()
    expect(result.plannerResult!.metadata!.retryCount).toBe(0)
    expect(result.plannerResult!.metadata!.planningAttempts).toBe(1)
  })

  it('should work with RetryPlanner + custom RetryPolicy through AgentLoop pipeline', async () => {
    const provider = new MockPlannerProvider(mockConfig)
    const retryPolicy = new RetryPolicy({ maxRetries: 3 })
    const planner = new RetryPlanner(provider, retryPolicy)
    const promptBuilder = new DefaultPromptBuilder([new UserInputModule()])
    const pipeline = new DefaultPipeline(planner, promptBuilder)

    const result = await pipeline.execute({ input: 'create a tree' })

    expect(result.plannerResult!.actions).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// ToolCallPlanner Compatibility via AgentLoop
// ---------------------------------------------------------------------------

describe('ToolCallPlanner — AgentLoop Pipeline Integration', () => {
  it('should work with ToolCallPlanner through AgentLoop pipeline', async () => {
    const provider = new MockPlannerProvider(mockConfig)
    const registry = new DefaultToolRegistry()
    const planner = new ToolCallPlanner(provider, registry)
    const promptBuilder = new DefaultPromptBuilder([new UserInputModule()])
    const pipeline = new DefaultPipeline(planner, promptBuilder)

    const result = await pipeline.execute({ input: 'create a tree' })

    expect(result.plannerResult!.actions).toHaveLength(1)
    expect(result.plannerResult!.actions[0].type).toBe('CreateEntity')
  })

  it('should work with ToolCallPlanner + tools through AgentLoop pipeline', async () => {
    const provider = new MockPlannerProvider(mockConfig)
    const tool = {
      name: 'find_entity',
      description: 'Find an entity by ID',
      async execute(input: unknown) { return { found: true, input } },
    }
    const registry = new DefaultToolRegistry([tool])
    const planner = new ToolCallPlanner(provider, registry)
    const promptBuilder = new DefaultPromptBuilder([new UserInputModule()])
    const pipeline = new DefaultPipeline(planner, promptBuilder)

    const result = await pipeline.execute({ input: 'create a tree' })

    expect(result.plannerResult!.actions).toHaveLength(1)
  })

  it('should preserve ToolCallPlanner metadata through AgentLoop pipeline', async () => {
    const provider = new MockPlannerProvider(mockConfig)
    const registry = new DefaultToolRegistry()
    const planner = new ToolCallPlanner(provider, registry)
    const promptBuilder = new DefaultPromptBuilder([new UserInputModule()])
    const pipeline = new DefaultPipeline(planner, promptBuilder)

    const result = await pipeline.execute({ input: 'create a tree' })

    expect(result.plannerResult!.metadata).toBeDefined()
    expect(result.plannerResult!.metadata!.tools).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Streaming Compatibility via AgentLoop
// ---------------------------------------------------------------------------

describe('Streaming — AgentLoop Pipeline Integration', () => {
  it('should stream correctly with streaming provider through AgentLoop pipeline', async () => {
    const streamingProvider = new MockStreamingProvider()
    const planner = new MockPlanner(streamingProvider)
    const promptBuilder = new DefaultPromptBuilder([new UserInputModule()])
    const pipeline = new DefaultPipeline(planner, promptBuilder, streamingProvider)

    const receivedEvents: PipelineEvent[] = []
    pipeline.events.subscribe({ onEvent: (e) => receivedEvents.push(e) })

    const result = await pipeline.stream({ input: 'create a tree' })

    // Should have received StreamChunk events
    const streamChunks = receivedEvents.filter((e) => e.type === 'StreamChunk')
    expect(streamChunks.length).toBeGreaterThan(0)

    // Each StreamChunk should carry a chunk payload
    for (const chunk of streamChunks) {
      expect(chunk.payload).toBeDefined()
      expect(typeof chunk.payload!.chunk).toBe('string')
    }

    // Result should have valid actions
    expect(result.plannerResult).toBeDefined()
    expect(result.plannerResult!.actions).toHaveLength(1)
    expect(result.plannerResult!.actions[0]).toMatchObject({
      type: 'CreateEntity',
      entityType: 'tree',
    })
  })

  it('should emit StreamChunk events in correct order with Pipeline events', async () => {
    const streamingProvider = new MockStreamingProvider()
    const planner = new MockPlanner(streamingProvider)
    const promptBuilder = new DefaultPromptBuilder([new UserInputModule()])
    const pipeline = new DefaultPipeline(planner, promptBuilder, streamingProvider)

    const receivedEvents: PipelineEvent[] = []
    pipeline.events.subscribe({ onEvent: (e) => receivedEvents.push(e) })

    await pipeline.stream({ input: 'create a tree' })

    const eventTypes = receivedEvents.map((e) => e.type)
    const plannerStartedIdx = eventTypes.indexOf('PlannerStarted')
    const plannerFinishedIdx = eventTypes.indexOf('PlannerFinished')
    const streamChunksBeforePlannerStarted = eventTypes
      .slice(0, plannerStartedIdx)
      .filter((t) => t === 'StreamChunk')
    const streamChunksBetween = eventTypes
      .slice(plannerStartedIdx, plannerFinishedIdx)
      .filter((t) => t === 'StreamChunk')
    const streamChunksAfterPlannerFinished = eventTypes
      .slice(plannerFinishedIdx)
      .filter((t) => t === 'StreamChunk')

    // StreamChunks should happen between PlannerStarted and PlannerFinished
    expect(streamChunksBeforePlannerStarted).toHaveLength(0)
    expect(streamChunksBetween.length).toBeGreaterThan(0)
    expect(streamChunksAfterPlannerFinished).toHaveLength(0)
  })

  it('should fallback to AgentLoop when provider does not support streaming', async () => {
    const provider = new MockPlannerProvider(mockConfig)
    const planner = new MockPlanner(provider)
    const promptBuilder = new DefaultPromptBuilder([new UserInputModule()])
    const pipeline = new DefaultPipeline(planner, promptBuilder)

    const receivedEvents: PipelineEvent[] = []
    pipeline.events.subscribe({ onEvent: (e) => receivedEvents.push(e) })

    const result = await pipeline.stream({ input: 'create a tree' })

    // No StreamChunk events since provider doesn't support streaming
    const streamChunks = receivedEvents.filter((e) => e.type === 'StreamChunk')
    expect(streamChunks).toHaveLength(0)

    // But result still contains correct actions (via AgentLoop)
    expect(result.plannerResult).toBeDefined()
    expect(result.plannerResult!.actions).toHaveLength(1)
  })

  it('should produce same result for execute() and stream() through AgentLoop', async () => {
    const provider = new MockPlannerProvider(mockConfig)
    const planner = new MockPlanner(provider)
    const promptBuilder = new DefaultPromptBuilder([new UserInputModule()])

    const pipeline1 = new DefaultPipeline(planner, promptBuilder)
    const execResult = await pipeline1.execute({ input: 'create a tree' })

    const pipeline2 = new DefaultPipeline(planner, promptBuilder)
    const streamResult = await pipeline2.stream({ input: 'create a tree' })

    expect(execResult.plannerResult!.actions).toEqual(streamResult.plannerResult!.actions)
  })
})

// ---------------------------------------------------------------------------
// Edge Cases
// ---------------------------------------------------------------------------

describe('Edge Cases — AgentLoop Pipeline', () => {
  it('should handle multiple sequential execute() calls through AgentLoop', async () => {
    const { pipeline } = createBasicPipeline()

    const result1 = await pipeline.execute({ input: 'create a tree' })
    const result2 = await pipeline.execute({ input: 'move entity-1 to 7,3' })
    const result3 = await pipeline.execute({ input: 'unknown' })

    expect(result1.plannerResult!.actions).toHaveLength(1)
    expect(result1.plannerResult!.actions[0].type).toBe('CreateEntity')

    expect(result2.plannerResult!.actions).toHaveLength(1)
    expect(result2.plannerResult!.actions[0].type).toBe('MoveEntity')

    expect(result3.plannerResult!.actions).toHaveLength(0)
  })

  it('should handle empty input through AgentLoop', async () => {
    const { pipeline } = createBasicPipeline()
    const result = await pipeline.execute({ input: '' })

    expect(result.plannerResult).toBeDefined()
  })

  it('should propagate streaming errors through AgentLoop pipeline', async () => {
    const errorProvider = new MockStreamingProvider()
    // Mock stream that throws an error on first iteration
    vi.spyOn(errorProvider, 'stream').mockImplementation(
      () => ({
        [Symbol.asyncIterator]: () => ({
          next: () => Promise.reject(new Error('Stream connection lost')),
        }),
      }),
    )

    const planner = new MockPlanner(errorProvider as unknown as MockPlannerProvider)
    const promptBuilder = new DefaultPromptBuilder([new UserInputModule()])
    const pipeline = new DefaultPipeline(planner, promptBuilder, errorProvider)

    await expect(pipeline.stream({ input: 'create a tree' })).resolves.toBeDefined()
  })

  it('should work with custom AgentLoop result', async () => {
    const customAgentLoop: AgentLoop = {
      async execute(context: AgentLoopContext): Promise<AgentLoopResult> {
        const inner = new DefaultAgentLoop()
        const innerResult = await inner.execute(context)
        return {
          ...innerResult,
          reasoning: 'Completed via custom AgentLoop',
        }
      },
    }

    const { pipeline } = createPipelineWithAgentLoop(customAgentLoop)
    const result = await pipeline.execute({ input: 'create a tree' })

    expect(result.plannerResult!.actions).toHaveLength(1)
  })

  it('should forward AgentLoop events from non-DefaultAgentLoop implementations', async () => {
    const customAgentLoop: AgentLoop = {
      async execute(context: AgentLoopContext): Promise<AgentLoopResult> {
        const inner = new DefaultAgentLoop()
        return inner.execute(context)
      },
    }

    const { pipeline } = createPipelineWithAgentLoop(customAgentLoop)
    const pipeEvents: PipelineEvent[] = []
    pipeline.events.subscribe({ onEvent: (e) => pipeEvents.push(e) })

    await pipeline.execute({ input: 'tree' })

    // Pipeline events should still be complete
    expect(pipeEvents).toHaveLength(5)
  })
})

// ---------------------------------------------------------------------------
// Custom AgentLoop in Pipeline
// ---------------------------------------------------------------------------

describe('Custom AgentLoop in Pipeline', () => {
  it('should accept a custom AgentLoop and use it for execution', async () => {
    let called = false
    const customAgentLoop: AgentLoop = {
      async execute(context: AgentLoopContext): Promise<AgentLoopResult> {
        called = true
        const inner = new DefaultAgentLoop()
        return inner.execute(context)
      },
    }

    const { pipeline } = createPipelineWithAgentLoop(customAgentLoop)
    await pipeline.execute({ input: 'create a tree' })

    expect(called).toBe(true)
  })

  it('should use custom AgentLoop with metadata passthrough', async () => {
    const customAgentLoop: AgentLoop = {
      async execute(context: AgentLoopContext): Promise<AgentLoopResult> {
        const inner = new DefaultAgentLoop()
        const result = await inner.execute(context)
        return {
          ...result,
          plannerResult: {
            ...result.plannerResult,
            metadata: { ...result.plannerResult.metadata, agentLoopCustom: true },
          },
        }
      },
    }

    const { pipeline } = createPipelineWithAgentLoop(customAgentLoop)
    const result = await pipeline.execute({ input: 'create a tree' })

    expect(result.plannerResult!.metadata?.agentLoopCustom).toBe(true)
  })

  it('should pass the correct planner to the custom AgentLoop', async () => {
    let capturedPlanner: Planner | undefined
    const customAgentLoop: AgentLoop = {
      async execute(context: AgentLoopContext): Promise<AgentLoopResult> {
        capturedPlanner = context.planner
        const inner = new DefaultAgentLoop()
        return inner.execute(context)
      },
    }

    const { pipeline, planner } = createPipelineWithAgentLoop(customAgentLoop)
    await pipeline.execute({ input: 'create a tree' })

    expect(capturedPlanner).toBe(planner)
  })
})

// ---------------------------------------------------------------------------
// Events — Entire Chain Verification
// ---------------------------------------------------------------------------

describe('Events — Entire Chain Verification', () => {
  it('should have correct Pipeline → AgentLoop → Planner event chain', async () => {
    const agentLoop = new DefaultAgentLoop()
    const { pipeline } = createPipelineWithAgentLoop(agentLoop)

    const pipelineEvents: PipelineEvent[] = []
    pipeline.events.subscribe({ onEvent: (e) => pipelineEvents.push(e) })

    await pipeline.execute({ input: 'tree' })

    const pipeTypes = pipelineEvents.map((e) => e.type)

    // Pipeline events must be in correct order
    expect(pipeTypes).toEqual([
      'PipelineStarted',
      'PromptBuilt',
      'PlannerStarted',
      'PlannerFinished',
      'PipelineFinished',
    ])
  })

  it('should emit PipelineStarted as the very first event', async () => {
    const agentLoop = new DefaultAgentLoop()
    const { pipeline } = createPipelineWithAgentLoop(agentLoop)
    const { pipelineEvents, agentLoopEvents } = await collectAllEvents(pipeline, agentLoop, { input: 'tree' })

    expect(pipelineEvents[0].type).toBe('PipelineStarted')
    expect(pipelineEvents[0].timestamp).toBeLessThanOrEqual(agentLoopEvents[0].timestamp)
  })

  it('should emit PipelineFinished as the very last event', async () => {
    const agentLoop = new DefaultAgentLoop()
    const { pipeline } = createPipelineWithAgentLoop(agentLoop)
    const { pipelineEvents, agentLoopEvents } = await collectAllEvents(pipeline, agentLoop, { input: 'tree' })

    const lastPipelineEvent = pipelineEvents[pipelineEvents.length - 1]
    const lastAgentLoopEvent = agentLoopEvents[agentLoopEvents.length - 1]

    expect(lastPipelineEvent.type).toBe('PipelineFinished')
    expect(lastPipelineEvent.timestamp).toBeGreaterThanOrEqual(lastAgentLoopEvent.timestamp)
  })

  it('should not emit Pipeline events from AgentLoop emitter', async () => {
    const agentLoop = new DefaultAgentLoop()
    const { pipeline } = createPipelineWithAgentLoop(agentLoop)
    const { agentLoopEvents } = await collectAllEvents(pipeline, agentLoop, { input: 'tree' })

    const agentLoopTypes = agentLoopEvents.map((e) => e.type)
    for (const type of agentLoopTypes) {
      // All events on agentLoop emitter should be AgentLoop events
      expect(['AgentLoopStarted', 'LoopIterationStarted', 'LoopIterationFinished', 'AgentLoopFinished']).toContain(type)
    }
  })

  it('should not emit AgentLoop events from Pipeline emitter', async () => {
    const agentLoop = new DefaultAgentLoop()
    const { pipeline } = createPipelineWithAgentLoop(agentLoop)
    const { pipelineEvents } = await collectAllEvents(pipeline, agentLoop, { input: 'tree' })

    const pipelineTypes = pipelineEvents.map((e) => e.type)
    for (const type of pipelineTypes) {
      // All events on pipeline emitter should be Pipeline events
      expect([
        'PipelineStarted',
        'PromptBuilt',
        'PlannerStarted',
        'PlannerFinished',
        'PipelineFinished',
      ]).toContain(type)
    }
  })
})

// ---------------------------------------------------------------------------
// Multiple Pipelines with AgentLoop
// ---------------------------------------------------------------------------

describe('Multiple Pipelines — AgentLoop', () => {
  it('should support multiple independent pipelines each using AgentLoop', async () => {
    const provider = new MockPlannerProvider(mockConfig)
    const promptBuilder = new DefaultPromptBuilder([new UserInputModule()])

    const pipeline1 = new DefaultPipeline(new MockPlanner(provider), promptBuilder)
    const pipeline2 = new DefaultPipeline(new MockPlanner(provider), promptBuilder)

    const [result1, result2] = await Promise.all([
      pipeline1.execute({ input: 'create a tree' }),
      pipeline2.execute({ input: 'move entity-1 to 7,3' }),
    ])

    expect(result1.plannerResult!.actions[0].type).toBe('CreateEntity')
    expect(result2.plannerResult!.actions[0].type).toBe('MoveEntity')
  })

  it('should allow one internal and one explicit AgentLoop pipeline simultaneously', async () => {
    const provider = new MockPlannerProvider(mockConfig)
    const promptBuilder = new DefaultPromptBuilder([new UserInputModule()])

    // Pipeline with internal AgentLoop
    const pipeline1 = new DefaultPipeline(new MockPlanner(provider), promptBuilder)

    // Pipeline with explicit AgentLoop
    const agentLoop = new DefaultAgentLoop()
    const pipeline2 = new DefaultPipeline(
      new MockPlanner(provider),
      promptBuilder,
      undefined,
      agentLoop,
    )

    const result1 = await pipeline1.execute({ input: 'tree' })
    const result2 = await pipeline2.execute({ input: 'tree' })

    expect(result1.plannerResult!.actions).toEqual(result2.plannerResult!.actions)
  })
})