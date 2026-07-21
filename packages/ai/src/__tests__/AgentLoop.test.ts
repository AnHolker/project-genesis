import { describe, it, expect } from 'vitest'
import { DefaultAgentLoop } from '../agent/DefaultAgentLoop'
import { MockPlanner } from '../planner/MockPlanner'
import { RetryPlanner } from '../planner/RetryPlanner'
import { ToolCallPlanner } from '../planner/ToolCallPlanner'
import { DefaultToolRegistry } from '../tools/ToolRegistry'
import { MockFindEntityTool } from '../tools/MockFindEntityTool'
import { MockPlannerProvider } from '../provider/MockPlannerProvider'
import { MockStreamingProvider } from '../provider/MockStreamingProvider'
import { RetryPolicy } from '../retry/RetryPolicy'
import type { PlannerProvider } from '../provider/PlannerProvider'
import { DefaultAIConfiguration } from '../config/DefaultAIConfiguration'
import { PipelineEventEmitter } from '../events/PipelineEventEmitter'
import type { AgentLoop } from '../agent/AgentLoop'
import type { AgentLoopContext } from '../agent/AgentLoopContext'
import type { AgentLoopResult } from '../agent/AgentLoopResult'
import type { LoopStep } from '../agent/AgentLoopStep'
import type { Planner } from '../planner/Planner'
import type { PlannerResult } from '../planner/PlannerResult'
import type { AIRequest } from '../request'
import type { PipelineEvent } from '../events/PipelineEvent'

// ---------------------------------------------------------------------------
// Test Constants
// ---------------------------------------------------------------------------

const mockConfig = new DefaultAIConfiguration()

const treeResult: PlannerResult = {
  actions: [{ type: 'CreateEntity', entityType: 'tree', x: 5, y: 3 }],
}

const moveResult: PlannerResult = {
  actions: [{ type: 'MoveEntity', id: 'entity-1', x: 7, y: 3 }],
}

const emptyResult: PlannerResult = {
  actions: [],
  reasoning: 'No actions needed',
}

const treeRequest: AIRequest = { prompt: 'create a tree' }
const moveRequest: AIRequest = { prompt: 'move entity-1 to 7,3' }
const unknownRequest: AIRequest = { prompt: 'do something random' }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a simple mock planner returning a fixed result.
 */
function createMockPlanner(result: PlannerResult = treeResult): Planner {
  return {
    async plan(_request: AIRequest): Promise<PlannerResult> {
      return result
    },
  }
}

/**
 * Creates an AgentLoopContext with the given parameters.
 */
function createContext(
  request: AIRequest = treeRequest,
  planner: Planner = createMockPlanner(),
  maxIterations = 5,
): AgentLoopContext {
  return {
    request,
    planner,
    maxIterations,
  }
}

/**
 * Collects events emitted during an AgentLoop execution.
 */
async function collectEvents(
  context: AgentLoopContext,
): Promise<PipelineEvent[]> {
  const loop = new DefaultAgentLoop()
  const events: PipelineEvent[] = []

  loop.events.subscribe({
    onEvent(event: PipelineEvent) {
      events.push(event)
    },
  })

  await loop.execute(context)

  return events
}

/**
 * Creates a mock planner that wraps a provider, like MockPlanner does.
 */
function createProviderBasedPlanner(provider: PlannerProvider = new MockPlannerProvider(mockConfig)): Planner {
  return new MockPlanner(provider)
}

// ---------------------------------------------------------------------------
// AgentLoop Interface
// ---------------------------------------------------------------------------

describe('AgentLoop Interface', () => {
  it('should define AgentLoop interface with execute method', () => {
    const loop: AgentLoop = new DefaultAgentLoop()
    expect(typeof loop.execute).toBe('function')
  })

  it('should define AgentLoopContext interface with required fields', () => {
    const context: AgentLoopContext = createContext()
    expect(context.request).toBeDefined()
    expect(context.planner).toBeDefined()
    expect(context.maxIterations).toBeDefined()
  })

  it('should define AgentLoopResult interface with required fields', () => {
    const loop = new DefaultAgentLoop()
    const promise = loop.execute(createContext())

    // Verify the promise resolves to an object with correct shape
    expect(promise).toBeInstanceOf(Promise)
    const resultShape: AgentLoopResult = {
      plannerResult: { actions: [] },
      steps: [],
      iterations: 0,
      finished: false,
    }
    expect(resultShape).toHaveProperty('plannerResult')
    expect(resultShape).toHaveProperty('steps')
    expect(resultShape).toHaveProperty('iterations')
    expect(resultShape).toHaveProperty('finished')
  })

  it('should define LoopStep interface with iteration field', () => {
    const step: LoopStep = { iteration: 1 }
    expect(step.iteration).toBe(1)

    // Verify the type contract: all optional fields accept undefined
    const fullStep: LoopStep = {
      iteration: 1,
      thought: 'reasoning text',
      toolName: 'find_entity',
      toolInput: { name: 'test' },
      toolOutput: { id: '1' },
      plannerResult: { actions: [] },
    }
    expect(fullStep.thought).toBe('reasoning text')
    expect(fullStep.toolName).toBe('find_entity')
    expect(fullStep.toolInput).toEqual({ name: 'test' })
    expect(fullStep.toolOutput).toEqual({ id: '1' })
    expect(fullStep.plannerResult).toEqual({ actions: [] })
  })
})

// ---------------------------------------------------------------------------
// DefaultAgentLoop — Single Iteration
// ---------------------------------------------------------------------------

describe('DefaultAgentLoop — Single Iteration', () => {
  it('should return iterations === 1', async () => {
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext())

    expect(result.iterations).toBe(1)
  })

  it('should return finished === true', async () => {
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext())

    expect(result.finished).toBe(true)
  })

  it('should return plannerResult with correct actions', async () => {
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext())

    expect(result.plannerResult.actions).toHaveLength(1)
    expect(result.plannerResult.actions[0]).toMatchObject({
      type: 'CreateEntity',
      entityType: 'tree',
      x: 5,
      y: 3,
    })
  })

  it('should return plannerResult with correct reasoning when provided', async () => {
    const reasoning = 'The user wants to create a tree at position (5, 3)'
    const planner = createMockPlanner({
      actions: [{ type: 'CreateEntity', entityType: 'tree', x: 5, y: 3 }],
      reasoning,
    })
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner))

    expect(result.plannerResult.reasoning).toBe(reasoning)
  })

  it('should work with empty actions result', async () => {
    const planner = createMockPlanner(emptyResult)
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(unknownRequest, planner))

    expect(result.plannerResult.actions).toHaveLength(0)
    expect(result.plannerResult.reasoning).toBe('No actions needed')
  })

  it('should implement AgentLoop interface', () => {
    const loop = new DefaultAgentLoop()
    expect(loop).toBeInstanceOf(DefaultAgentLoop)
    expect(typeof (loop as AgentLoop).execute).toBe('function')
  })
})

// ---------------------------------------------------------------------------
// DefaultAgentLoop — Step History
// ---------------------------------------------------------------------------

describe('DefaultAgentLoop — Step History', () => {
  it('should return steps array with length === 1', async () => {
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext())

    expect(result.steps).toHaveLength(1)
  })

  it('should have steps[0].iteration === 1', async () => {
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext())

    expect(result.steps[0].iteration).toBe(1)
  })

  it('should have steps[0].plannerResult matching the returned plannerResult', async () => {
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext())

    expect(result.steps[0].plannerResult).toBe(result.plannerResult)
    expect(result.steps[0].plannerResult!.actions).toEqual(
      result.plannerResult.actions,
    )
  })

  it('should have undefined thought/toolName/toolInput/toolOutput when not set', async () => {
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext())

    expect(result.steps[0].thought).toBeUndefined()
    expect(result.steps[0].toolName).toBeUndefined()
    expect(result.steps[0].toolInput).toBeUndefined()
    expect(result.steps[0].toolOutput).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Event Emission
// ---------------------------------------------------------------------------

describe('Event Emission', () => {
  it('should emit AgentLoopStarted event', async () => {
    const events = await collectEvents(createContext())
    const types = events.map((e) => e.type)

    expect(types).toContain('AgentLoopStarted')
  })

  it('should emit LoopIterationStarted event', async () => {
    const events = await collectEvents(createContext())
    const types = events.map((e) => e.type)

    expect(types).toContain('LoopIterationStarted')
  })

  it('should emit LoopIterationFinished event', async () => {
    const events = await collectEvents(createContext())
    const types = events.map((e) => e.type)

    expect(types).toContain('LoopIterationFinished')
  })

  it('should emit AgentLoopFinished event', async () => {
    const events = await collectEvents(createContext())
    const types = events.map((e) => e.type)

    expect(types).toContain('AgentLoopFinished')
  })

  it('should emit events in correct order: AgentLoopStarted → LoopIterationStarted → LoopIterationFinished → AgentLoopFinished', async () => {
    const events = await collectEvents(createContext())
    const types = events.map((e) => e.type)

    const agentLoopStartedIdx = types.indexOf('AgentLoopStarted')
    const loopIterationStartedIdx = types.indexOf('LoopIterationStarted')
    const loopIterationFinishedIdx = types.indexOf('LoopIterationFinished')
    const agentLoopFinishedIdx = types.indexOf('AgentLoopFinished')

    expect(agentLoopStartedIdx).toBeLessThan(loopIterationStartedIdx)
    expect(loopIterationStartedIdx).toBeLessThan(loopIterationFinishedIdx)
    expect(loopIterationFinishedIdx).toBeLessThan(agentLoopFinishedIdx)
  })

  it('should have AgentLoopStarted payload with maxIterations', async () => {
    const events = await collectEvents(createContext())
    const startedEvent = events.find((e) => e.type === 'AgentLoopStarted')

    expect(startedEvent).toBeDefined()
    expect(startedEvent!.payload).toBeDefined()
    expect(startedEvent!.payload!.maxIterations).toBe(5)
  })

  it('should have LoopIterationStarted payload with iteration and maxIterations', async () => {
    const events = await collectEvents(createContext())
    const iterStarted = events.find((e) => e.type === 'LoopIterationStarted')

    expect(iterStarted).toBeDefined()
    expect(iterStarted!.payload!.iteration).toBe(1)
    expect(iterStarted!.payload!.maxIterations).toBe(5)
  })

  it('should have AgentLoopFinished payload with iterations and finished', async () => {
    const events = await collectEvents(createContext())
    const finishedEvent = events.find((e) => e.type === 'AgentLoopFinished')

    expect(finishedEvent).toBeDefined()
    expect(finishedEvent!.payload!.iterations).toBe(1)
    expect(finishedEvent!.payload!.finished).toBe(true)
  })

  it('should have timestamp on all emitted events', async () => {
    const events = await collectEvents(createContext())

    for (const event of events) {
      expect(typeof event.timestamp).toBe('number')
      expect(event.timestamp).toBeGreaterThan(0)
    }
  })
})

// ---------------------------------------------------------------------------
// Compatibility — MockPlanner
// ---------------------------------------------------------------------------

describe('Compatibility — MockPlanner', () => {
  it('should work with MockPlanner wrapping MockPlannerProvider', async () => {
    const planner = createProviderBasedPlanner()
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner))

    expect(result.iterations).toBe(1)
    expect(result.finished).toBe(true)
    expect(result.plannerResult.actions).toHaveLength(1)
  })

  it('should produce tree action for tree prompt via MockPlannerProvider', async () => {
    const planner = createProviderBasedPlanner()
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner))

    expect(result.plannerResult.actions[0]).toMatchObject({
      type: 'CreateEntity',
      entityType: 'tree',
    })
  })

  it('should produce move action for move prompt via MockPlannerProvider', async () => {
    const planner = createProviderBasedPlanner()
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(moveRequest, planner))

    expect(result.plannerResult.actions[0]).toMatchObject({
      type: 'MoveEntity',
      id: 'entity-1',
    })
  })

  it('should produce empty actions for unknown prompt via MockPlannerProvider', async () => {
    const planner = createProviderBasedPlanner()
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(unknownRequest, planner))

    expect(result.plannerResult.actions).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Compatibility — RetryPlanner
// ---------------------------------------------------------------------------

describe('Compatibility — RetryPlanner', () => {
  it('should work with RetryPlanner wrapping a valid provider', async () => {
    const provider = new MockPlannerProvider(mockConfig)
    const planner = new RetryPlanner(provider)
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner))

    expect(result.iterations).toBe(1)
    expect(result.finished).toBe(true)
    expect(result.plannerResult.actions).toHaveLength(1)
  })

  it('should preserve RetryPlanner result metadata when used through AgentLoop', async () => {
    const provider = new MockPlannerProvider(mockConfig)
    const planner = new RetryPlanner(provider)
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner))

    expect(result.plannerResult.metadata).toBeDefined()
    expect(result.plannerResult.metadata!.retryCount).toBe(0)
    expect(result.plannerResult.metadata!.planningAttempts).toBe(1)
  })

  it('should handle RetryPlanner with RetryPolicy configuration', async () => {
    const provider = new MockPlannerProvider(mockConfig)
    const retryPolicy = new RetryPolicy({ maxRetries: 3 })
    const planner = new RetryPlanner(provider, retryPolicy)
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner))

    expect(result.iterations).toBe(1)
    expect(result.plannerResult.actions).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// Compatibility — ToolCallPlanner
// ---------------------------------------------------------------------------

describe('Compatibility — ToolCallPlanner', () => {
  it('should work with ToolCallPlanner wrapping a provider', async () => {
    const provider = new MockPlannerProvider(mockConfig)
    const registry = new DefaultToolRegistry()
    const planner = new ToolCallPlanner(provider, registry)
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner))

    expect(result.iterations).toBe(1)
    expect(result.finished).toBe(true)
    expect(result.plannerResult.actions).toHaveLength(1)
  })

  it('should work with ToolCallPlanner plus tools', async () => {
    const provider = new MockPlannerProvider(mockConfig)
    const tool = new MockFindEntityTool()
    const registry = new DefaultToolRegistry([tool])
    const planner = new ToolCallPlanner(provider, registry)
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner))

    expect(result.iterations).toBe(1)
    expect(result.plannerResult.actions).toHaveLength(1)
  })

  it('should work with empty tool registry', async () => {
    const provider = new MockPlannerProvider(mockConfig)
    const registry = new DefaultToolRegistry([])
    const planner = new ToolCallPlanner(provider, registry)
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner))

    expect(result.iterations).toBe(1)
    expect(result.plannerResult.actions).toHaveLength(1)
  })

  it('should not interfere with tool planner result metadata', async () => {
    const provider = new MockPlannerProvider(mockConfig)
    const registry = new DefaultToolRegistry()
    const planner = new ToolCallPlanner(provider, registry)
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner))

    expect(result.plannerResult.metadata).toBeDefined()
    expect(result.plannerResult.metadata!.tools).toBeDefined()
    expect(result.plannerResult.metadata!.toolCallDuration).toBeGreaterThanOrEqual(0)
    expect(result.plannerResult.metadata!.toolCallNative).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Compatibility — StreamingPlannerProvider
// ---------------------------------------------------------------------------

describe('Compatibility — StreamingPlannerProvider', () => {
  it('should work with StreamingPlannerProvider via complete() method', async () => {
    const provider = new MockStreamingProvider()
    const planner = createProviderBasedPlanner(provider)
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner))

    expect(result.iterations).toBe(1)
    expect(result.finished).toBe(true)
  })

  it('should return correct actions through AgentLoop with streaming provider', async () => {
    const provider = new MockStreamingProvider()
    const planner = createProviderBasedPlanner(provider)
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner))

    expect(result.plannerResult.actions).toHaveLength(1)
    expect(result.plannerResult.actions[0]).toMatchObject({
      type: 'CreateEntity',
      entityType: 'tree',
    })
  })
})

// ---------------------------------------------------------------------------
// Future Extension — LoopStep History
// ---------------------------------------------------------------------------

describe('Future Extension — LoopStep History', () => {
  it('should support adding thought to a LoopStep', () => {
    const step: LoopStep = {
      iteration: 1,
      thought: 'I need to find the entity first',
      plannerResult: treeResult,
    }

    expect(step.thought).toBe('I need to find the entity first')
  })

  it('should support adding toolName, toolInput, and toolOutput to a LoopStep', () => {
    const step: LoopStep = {
      iteration: 1,
      thought: 'Let me find that entity',
      toolName: 'find_entity',
      toolInput: { name: 'tree-1' },
      toolOutput: { id: 'entity-1', type: 'tree', x: 5, y: 3 },
      plannerResult: treeResult,
    }

    expect(step.toolName).toBe('find_entity')
    expect(step.toolInput).toEqual({ name: 'tree-1' })
    expect(step.toolOutput).toEqual({ id: 'entity-1', type: 'tree', x: 5, y: 3 })
  })

  it('should support multiple steps for future multi-iteration loops', () => {
    const steps: LoopStep[] = [
      {
        iteration: 1,
        thought: 'First, find the entity',
        toolName: 'find_entity',
        toolInput: { name: 'tree' },
        toolOutput: { found: true },
      },
      {
        iteration: 2,
        thought: 'Now move it',
        toolName: 'move_entity',
        toolInput: { id: 'tree-1', x: 10, y: 5 },
        toolOutput: { moved: true },
        plannerResult: moveResult,
      },
    ]

    expect(steps).toHaveLength(2)
    expect(steps[0].iteration).toBe(1)
    expect(steps[1].iteration).toBe(2)
    expect(steps[1].plannerResult!.actions[0].type).toBe('MoveEntity')
  })
})

// ---------------------------------------------------------------------------
// AgentLoopContext Configuration
// ---------------------------------------------------------------------------

describe('AgentLoopContext Configuration', () => {
  it('should accept custom maxIterations', () => {
    const context = createContext(treeRequest, createMockPlanner(), 10)

    expect(context.maxIterations).toBe(10)
  })

  it('should default maxIterations to 5 when using standard context', () => {
    const context: AgentLoopContext = {
      request: treeRequest,
      planner: createMockPlanner(),
      maxIterations: 5,
    }

    expect(context.maxIterations).toBe(5)
  })

  it('should accept optional metadata', () => {
    const context: AgentLoopContext = {
      request: treeRequest,
      planner: createMockPlanner(),
      maxIterations: 5,
      metadata: { sessionId: 'test-123', userId: 'user-1' },
    }

    expect(context.metadata).toBeDefined()
    expect(context.metadata!.sessionId).toBe('test-123')
    expect(context.metadata!.userId).toBe('user-1')
  })

  it('should accept optional toolRegistry', () => {
    const registry = new DefaultToolRegistry([new MockFindEntityTool()])
    const context: AgentLoopContext = {
      request: treeRequest,
      planner: createMockPlanner(),
      maxIterations: 5,
      toolRegistry: registry,
    }

    expect(context.toolRegistry).toBeDefined()
    expect(context.toolRegistry!.getTools()).toHaveLength(1)
  })

  it('should pass request through to planner correctly', async () => {
    let capturedRequest: AIRequest | undefined
    const capturingPlanner: Planner = {
      async plan(request: AIRequest): Promise<PlannerResult> {
        capturedRequest = request
        return treeResult
      },
    }

    const loop = new DefaultAgentLoop()
    await loop.execute(createContext(treeRequest, capturingPlanner))

    expect(capturedRequest).toBeDefined()
    expect(capturedRequest!.prompt).toBe('create a tree')
  })
})

// ---------------------------------------------------------------------------
// Event — Edge Cases
// ---------------------------------------------------------------------------

describe('Event — Edge Cases', () => {
  it('should emit exactly 4 agent loop events per execution', async () => {
    const events = await collectEvents(createContext())
    const agentEvents = events.filter((e) =>
      [
        'AgentLoopStarted',
        'LoopIterationStarted',
        'LoopIterationFinished',
        'AgentLoopFinished',
      ].includes(e.type),
    )

    expect(agentEvents).toHaveLength(4)
  })

  it('should not emit agent loop events before execution', () => {
    const emitter = new PipelineEventEmitter()
    const events: PipelineEvent[] = []

    emitter.subscribe({ onEvent: (e) => events.push(e) })

    expect(events).toHaveLength(0)
  })

  it('should allow multiple subscribers on the same loop', async () => {
    const loop = new DefaultAgentLoop()
    const events1: PipelineEvent[] = []
    const events2: PipelineEvent[] = []

    loop.events.subscribe({ onEvent: (e) => events1.push(e) })
    loop.events.subscribe({ onEvent: (e) => events2.push(e) })

    await loop.execute(createContext())

    expect(events1).toHaveLength(4)
    expect(events2).toHaveLength(4)
  })
})

// ---------------------------------------------------------------------------
// DefaultAgentLoop — Multiple Executions
// ---------------------------------------------------------------------------

describe('DefaultAgentLoop — Multiple Executions', () => {
  it('should support being executed multiple times', async () => {
    const loop = new DefaultAgentLoop()

    const result1 = await loop.execute(
      createContext(treeRequest, createMockPlanner(treeResult)),
    )
    const result2 = await loop.execute(
      createContext(moveRequest, createMockPlanner(moveResult)),
    )

    expect(result1.iterations).toBe(1)
    expect(result1.plannerResult.actions[0].type).toBe('CreateEntity')

    expect(result2.iterations).toBe(1)
    expect(result2.plannerResult.actions[0].type).toBe('MoveEntity')
  })

  it('should create fresh event emitter each call (no cross-contamination)', async () => {
    const loop = new DefaultAgentLoop()
    const events: PipelineEvent[] = []

    loop.events.subscribe({ onEvent: (e) => events.push(e) })

    await loop.execute(createContext())
    expect(events).toHaveLength(4)

    // Execute again — events should fire again
    events.length = 0
    await loop.execute(createContext())
    expect(events).toHaveLength(4)
  })
})