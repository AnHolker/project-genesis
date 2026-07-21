import { describe, it, expect, vi } from 'vitest'
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
import type { AgentLoopContext } from '../agent/AgentLoopContext'
import type { AgentLoopResult } from '../agent/AgentLoopResult'
import type { LoopStep } from '../agent/AgentLoopStep'
import type { Planner } from '../planner/Planner'
import type { PlannerResult } from '../planner/PlannerResult'
import type { AIRequest } from '../request'
import type { PipelineEvent } from '../events/PipelineEvent'
import type { ToolRegistry, Tool } from '../tools'
import { PipelineEventEmitter } from '../events/PipelineEventEmitter'

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
 * Creates a controllable multi-step mock planner.
 * Each call returns the next result from the provided array.
 * When results are exhausted, returns the last result.
 */
function createMultiStepPlanner(results: PlannerResult[]): Planner {
  let callIndex = 0
  return {
    async plan(_request: AIRequest): Promise<PlannerResult> {
      const result = results[Math.min(callIndex, results.length - 1)]
      callIndex++
      return result
    },
  }
}

/**
 * Creates a planner that returns toolCalls in metadata.
 * First N calls return empty actions with toolCalls, N+1 call returns final result.
 */
function createToolCallingPlanner(
  toolCalls: Array<{ name: string; input: unknown }>,
  finalResult: PlannerResult = treeResult,
  interimCalls = 1,
): Planner {
  let callIndex = 0
  return {
    async plan(_request: AIRequest): Promise<PlannerResult> {
      if (callIndex < interimCalls) {
        callIndex++
        return {
          actions: [],
          reasoning: `Need to call tools (call ${callIndex})`,
          metadata: { toolCalls },
        }
      }
      callIndex++
      return finalResult
    },
  }
}

/**
 * Creates a simple mock tool.
 */
function createMockTool(name: string, output: unknown = { found: true }): Tool {
  return {
    name,
    description: `Mock tool: ${name}`,
    async execute(input: unknown): Promise<unknown> {
      return output
    },
  }
}

/**
 * Creates a controllable tool that records calls.
 */
function createRecordedTool(): { tool: Tool; calls: Array<{ input: unknown }> } {
  const calls: Array<{ input: unknown }> = []
  const tool: Tool = {
    name: 'recorded_tool',
    description: 'Records all calls',
    async execute(input: unknown): Promise<unknown> {
      calls.push({ input })
      return { recorded: true, input }
    },
  }
  return { tool, calls }
}

/**
 * Creates an AgentLoopContext with the given parameters.
 */
function createContext(
  request: AIRequest = treeRequest,
  planner: Planner = createMockPlanner(),
  maxIterations = 5,
  toolRegistry?: ToolRegistry,
): AgentLoopContext {
  return {
    request,
    planner,
    maxIterations,
    toolRegistry,
  }
}

/**
 * Collects all events emitted during an AgentLoop execution.
 */
async function collectEvents(context: AgentLoopContext): Promise<PipelineEvent[]> {
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
 * Creates a planner that records all requests and returns results in sequence.
 */
function createCallTrackingPlanner(
  results: PlannerResult[],
  capturedRequests: AIRequest[],
): Planner {
  let callCount = 0
  return {
    async plan(request: AIRequest): Promise<PlannerResult> {
      const result = results[Math.min(callCount, results.length - 1)]
      callCount++
      // Store the request for the NEXT iteration (so we can verify observation was appended)
      if (callCount > 1) {
        capturedRequests.push(request)
      }
      return result
    },
  }
}

/**
 * Creates a provider-based planner.
 */
function createProviderBasedPlanner(
  provider: PlannerProvider = new MockPlannerProvider(mockConfig),
): Planner {
  return new MockPlanner(provider)
}

// ---------------------------------------------------------------------------
// Multi-Step Loop — Basic Iteration
// ---------------------------------------------------------------------------

describe('Multi-Step Loop — Basic Iteration', () => {
  it('should complete in 1 iteration when planner returns actions immediately', async () => {
    const planner = createMockPlanner(treeResult)
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner))

    expect(result.iterations).toBe(1)
    expect(result.finished).toBe(true)
    expect(result.steps).toHaveLength(1)
  })

  it('should complete in 2 iterations with one tool call cycle', async () => {
    const tool = createMockTool('find_entity', { id: 'entity-1', type: 'tree' })
    const registry = new DefaultToolRegistry([tool])
    const planner = createToolCallingPlanner(
      [{ name: 'find_entity', input: { id: 'entity-1' } }],
      treeResult,
      1,
    )
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner, 5, registry))

    expect(result.iterations).toBe(2)
    expect(result.finished).toBe(true)
  })

  it('should complete in 3 iterations with two tool call cycles', async () => {
    const tool = createMockTool('find_entity', { id: 'entity-1', type: 'tree' })
    const registry = new DefaultToolRegistry([tool])
    const planner = createToolCallingPlanner(
      [{ name: 'find_entity', input: { id: 'entity-1' } }],
      treeResult,
      2,
    )
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner, 5, registry))

    expect(result.iterations).toBe(3)
    expect(result.finished).toBe(true)
  })

  it('should stop at 1 iteration when planner returns empty actions without tool calls', async () => {
    const planner = createMockPlanner(emptyResult)
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner))

    expect(result.iterations).toBe(1)
    expect(result.finished).toBe(false)
    expect(result.plannerResult.actions).toHaveLength(0)
  })

  it('should stop at 1 iteration when no toolRegistry is provided', async () => {
    const toolCallPlanner: Planner = {
      async plan(): Promise<PlannerResult> {
        return {
          actions: [],
          reasoning: 'Need tools',
          metadata: { toolCalls: [{ name: 'find_entity', input: {} }] },
        }
      },
    }
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, toolCallPlanner))

    // Without toolRegistry, cannot execute tools — stops at iteration 1
    expect(result.iterations).toBe(1)
    expect(result.finished).toBe(false)
  })

  it('should stop at maxIterations when planner never returns actions', async () => {
    const tool = createMockTool('find_entity', { id: 'e1' })
    const registry = new DefaultToolRegistry([tool])
    const alwaysEmpty: Planner = {
      async plan(): Promise<PlannerResult> {
        return {
          actions: [],
          reasoning: 'still thinking',
          metadata: { toolCalls: [{ name: 'find_entity', input: { id: 'e1' } }] },
        }
      },
    }
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, alwaysEmpty, 3, registry))

    expect(result.iterations).toBe(3)
    expect(result.finished).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Multi-Step Loop — maxIterations Edge Cases
// ---------------------------------------------------------------------------

describe('Multi-Step Loop — maxIterations Edge Cases', () => {
  it('should stop immediately when maxIterations is 1 and planner returns empty', async () => {
    const tool = createMockTool('find_entity', { found: true })
    const registry = new DefaultToolRegistry([tool])
    const planner = createToolCallingPlanner(
      [{ name: 'find_entity', input: {} }],
      treeResult,
      1,
    )
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner, 1, registry))

    // maxIterations=1, planner returns empty on first call
    // but since first call returns empty actions AND toolCalls exist,
    // the loop executes tools and records observation, then checks maxIterations
    // and ends. But actually, let's re-check the loop logic.
    // The loop: for (let iteration = 1; iteration <= maxIterations; iteration++)
    // Actually wait - iteration 1 would have empty actions with toolCalls.
    // Tools get executed. LoopIterationFinished is emitted. loopFinished is false.
    // Back to for loop check: iteration=2, 2 <= 1 is false → loop ends.
    // So iterations=1, finished=false.
    expect(result.iterations).toBe(1)
    expect(result.finished).toBe(false)
  })

  it('should respect maxIterations=2 for a 3-step task', async () => {
    const tool = createMockTool('find_entity', { id: 'e1' })
    const registry = new DefaultToolRegistry([tool])
    const planner = createToolCallingPlanner(
      [{ name: 'find_entity', input: { id: 'e1' } }],
      treeResult,
      3, // Needs 3 empty returns before final action
    )
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner, 2, registry))

    // maxIterations=2 prevents reaching the final action
    expect(result.iterations).toBe(2)
    expect(result.finished).toBe(false)
    expect(result.steps).toHaveLength(2)
  })

  it('should complete exactly at maxIterations boundary', async () => {
    const tool = createMockTool('find_entity', { id: 'e1' })
    const registry = new DefaultToolRegistry([tool])
    const planner = createToolCallingPlanner(
      [{ name: 'find_entity', input: { id: 'e1' } }],
      treeResult,
      4, // Needs 4 tool calls before final action
    )
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner, 5, registry))

    expect(result.iterations).toBe(5)
    expect(result.finished).toBe(true)
  })

  it('should set maxIterations from context and enforce it', async () => {
    const tool = createMockTool('find_entity', { id: 'e1' })
    const registry = new DefaultToolRegistry([tool])
    const infiniteEmpty: Planner = {
      async plan(): Promise<PlannerResult> {
        return {
          actions: [],
          metadata: { toolCalls: [{ name: 'find_entity', input: {} }] },
        }
      },
    }
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, infiniteEmpty, 7, registry))

    expect(result.iterations).toBe(7)
    expect(result.finished).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Observation Recording
// ---------------------------------------------------------------------------

describe('Observation Recording', () => {
  it('should record toolName in LoopStep when tool is executed', async () => {
    const tool = createMockTool('find_entity', { id: 'e1' })
    const registry = new DefaultToolRegistry([tool])
    const planner = createToolCallingPlanner(
      [{ name: 'find_entity', input: { id: 'entity-1' } }],
      treeResult,
      1,
    )
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner, 5, registry))

    // Step 1: tool call step
    expect(result.steps[0].toolName).toBe('find_entity')
    // Step 2: final action step
    expect(result.steps[1].toolName).toBeUndefined()
  })

  it('should record toolInput in LoopStep', async () => {
    const tool = createMockTool('find_entity', { id: 'e1' })
    const registry = new DefaultToolRegistry([tool])
    const planner = createToolCallingPlanner(
      [{ name: 'find_entity', input: { id: 'entity-1', type: 'tree' } }],
      treeResult,
      1,
    )
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner, 5, registry))

    expect(result.steps[0].toolInput).toEqual({ id: 'entity-1', type: 'tree' })
  })

  it('should record toolOutput in LoopStep', async () => {
    const output = { id: 'entity-1', type: 'tree', x: 5, y: 3 }
    const tool = createMockTool('find_entity', output)
    const registry = new DefaultToolRegistry([tool])
    const planner = createToolCallingPlanner(
      [{ name: 'find_entity', input: { id: 'entity-1' } }],
      treeResult,
      1,
    )
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner, 5, registry))

    expect(result.steps[0].toolOutput).toEqual(output)
  })

  it('should record observation when tool is not found', async () => {
    const registry = new DefaultToolRegistry() // Empty registry
    const planner = createToolCallingPlanner(
      [{ name: 'nonexistent_tool', input: { id: 'test' } }],
      treeResult,
      1,
    )
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner, 5, registry))

    expect(result.steps[0].toolName).toBe('nonexistent_tool')
    expect(result.steps[0].toolOutput).toContain('Tool not found')
  })

  it('should record error in toolOutput when tool execution throws', async () => {
    const failingTool: Tool = {
      name: 'failing_tool',
      description: 'Always throws',
      async execute(): Promise<unknown> {
        throw new Error('Tool execution failed')
      },
    }
    const registry = new DefaultToolRegistry([failingTool])
    const planner = createToolCallingPlanner(
      [{ name: 'failing_tool', input: { id: 'test' } }],
      treeResult,
      1,
    )
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner, 5, registry))

    expect(result.steps[0].toolName).toBe('failing_tool')
    expect(result.steps[0].toolOutput).toBe('Tool execution failed')
  })

  it('should record observations for multiple tool calls in one iteration', async () => {
    const tool1 = createMockTool('find_entity', { id: 'e1' })
    const tool2 = createMockTool('find_entities', [{ id: 'e1' }, { id: 'e2' }])
    const registry = new DefaultToolRegistry([tool1, tool2])
    const planner = createToolCallingPlanner(
      [
        { name: 'find_entity', input: { id: 'e1' } },
        { name: 'find_entities', input: { type: 'tree' } },
      ],
      treeResult,
      1,
    )
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner, 5, registry))

    // Multiple tools in one iteration — LoopStep records the last one
    expect(result.steps[0].toolName).toBe('find_entities')
    expect(result.steps[0].toolInput).toEqual({ type: 'tree' })
    expect(result.steps).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// Loop History
// ---------------------------------------------------------------------------

describe('Loop History', () => {
  it('should record correct step count for multi-iteration loop', async () => {
    const tool = createMockTool('find_entity', { id: 'e1' })
    const registry = new DefaultToolRegistry([tool])
    const planner = createToolCallingPlanner(
      [{ name: 'find_entity', input: { id: 'e1' } }],
      treeResult,
      2,
    )
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner, 5, registry))

    expect(result.steps).toHaveLength(3)
    expect(result.steps[0].iteration).toBe(1)
    expect(result.steps[1].iteration).toBe(2)
    expect(result.steps[2].iteration).toBe(3)
  })

  it('should preserve plannerResult in each step', async () => {
    const tool = createMockTool('find_entity', { id: 'e1' })
    const registry = new DefaultToolRegistry([tool])
    const planner = createToolCallingPlanner(
      [{ name: 'find_entity', input: { id: 'e1' } }],
      treeResult,
      2,
    )
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner, 5, registry))

    // Each step should have a plannerResult
    for (const step of result.steps) {
      expect(step.plannerResult).toBeDefined()
    }
  })

  it('should record empty action steps with reasoning in history', async () => {
    const tool = createMockTool('find_entity', { id: 'e1' })
    const registry = new DefaultToolRegistry([tool])
    const planner = createToolCallingPlanner(
      [{ name: 'find_entity', input: { id: 'e1' } }],
      treeResult,
      1,
    )
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner, 5, registry))

    // Step 1 should have empty actions with reasoning
    expect(result.steps[0].plannerResult!.actions).toHaveLength(0)
    expect(result.steps[0].plannerResult!.reasoning).toContain('Need to call tools')

    // Step 2 should have final actions
    expect(result.steps[1].plannerResult!.actions).toHaveLength(1)
  })

  it('should record toolName/toolInput/toolOutput only on tool steps', async () => {
    const tool = createMockTool('find_entity', { id: 'e1' })
    const registry = new DefaultToolRegistry([tool])
    const planner = createToolCallingPlanner(
      [{ name: 'find_entity', input: { id: 'e1' } }],
      treeResult,
      1,
    )
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner, 5, registry))

    // Step 1: tool step — has tool fields
    expect(result.steps[0].toolName).toBeDefined()
    expect(result.steps[0].toolInput).toBeDefined()
    expect(result.steps[0].toolOutput).toBeDefined()

    // Step 2: final step — no tool fields
    expect(result.steps[1].toolName).toBeUndefined()
    expect(result.steps[1].toolInput).toBeUndefined()
    expect(result.steps[1].toolOutput).toBeUndefined()
  })

  it('should return correct finished status for different scenarios', async () => {
    // Scenario 1: complete with actions
    const planner1 = createMockPlanner(treeResult)
    const loop1 = new DefaultAgentLoop()
    const result1 = await loop1.execute(createContext(treeRequest, planner1))
    expect(result1.finished).toBe(true)

    // Scenario 2: empty actions, no tools
    const planner2 = createMockPlanner(emptyResult)
    const loop2 = new DefaultAgentLoop()
    const result2 = await loop2.execute(createContext(treeRequest, planner2))
    expect(result2.finished).toBe(false)

    // Scenario 3: maxIterations reached (always empty)
    const tool = createMockTool('find_entity', { id: 'e1' })
    const registry = new DefaultToolRegistry([tool])
    const alwaysEmpty: Planner = {
      async plan(): Promise<PlannerResult> {
        return {
          actions: [],
          metadata: { toolCalls: [{ name: 'find_entity', input: {} }] },
        }
      },
    }
    const loop3 = new DefaultAgentLoop()
    const result3 = await loop3.execute(createContext(treeRequest, alwaysEmpty, 2, registry))
    expect(result3.finished).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Event Emission — ToolExecuted and ObservationRecorded
// ---------------------------------------------------------------------------

describe('Event Emission — ToolExecuted and ObservationRecorded', () => {
  it('should emit ToolExecuted event when a tool is executed', async () => {
    const tool = createMockTool('find_entity', { id: 'e1' })
    const registry = new DefaultToolRegistry([tool])
    const planner = createToolCallingPlanner(
      [{ name: 'find_entity', input: { id: 'e1' } }],
      treeResult,
      1,
    )
    const events = await collectEvents(createContext(treeRequest, planner, 5, registry))
    const toolExecutedEvents = events.filter((e) => e.type === 'ToolExecuted')

    expect(toolExecutedEvents.length).toBeGreaterThan(0)
  })

  it('should emit ObservationRecorded event after tool execution', async () => {
    const tool = createMockTool('find_entity', { id: 'e1' })
    const registry = new DefaultToolRegistry([tool])
    const planner = createToolCallingPlanner(
      [{ name: 'find_entity', input: { id: 'e1' } }],
      treeResult,
      1,
    )
    const events = await collectEvents(createContext(treeRequest, planner, 5, registry))
    const observationEvents = events.filter((e) => e.type === 'ObservationRecorded')

    expect(observationEvents.length).toBeGreaterThan(0)
  })

  it('should emit correct ToolExecuted event payload', async () => {
    const tool = createMockTool('find_entity', { id: 'e1' })
    const registry = new DefaultToolRegistry([tool])
    const planner = createToolCallingPlanner(
      [{ name: 'find_entity', input: { id: 'entity-1' } }],
      treeResult,
      1,
    )
    const events = await collectEvents(createContext(treeRequest, planner, 5, registry))
    const toolExecEvent = events.find((e) => e.type === 'ToolExecuted')

    expect(toolExecEvent).toBeDefined()
    expect(toolExecEvent!.payload!.toolName).toBe('find_entity')
    expect(toolExecEvent!.payload!.toolInput).toEqual({ id: 'entity-1' })
  })

  it('should emit correct ObservationRecorded event payload', async () => {
    const output = { id: 'entity-1', type: 'tree' }
    const tool = createMockTool('find_entity', output)
    const registry = new DefaultToolRegistry([tool])
    const planner = createToolCallingPlanner(
      [{ name: 'find_entity', input: { id: 'e1' } }],
      treeResult,
      1,
    )
    const events = await collectEvents(createContext(treeRequest, planner, 5, registry))
    const obsEvent = events.find((e) => e.type === 'ObservationRecorded')

    expect(obsEvent).toBeDefined()
    expect(obsEvent!.payload!.toolName).toBe('find_entity')
    expect(obsEvent!.payload!.toolOutput).toEqual(output)
  })

  it('should emit ToolExecuted before ObservationRecorded for the same tool', async () => {
    const tool = createMockTool('find_entity', { id: 'e1' })
    const registry = new DefaultToolRegistry([tool])
    const planner = createToolCallingPlanner(
      [{ name: 'find_entity', input: { id: 'e1' } }],
      treeResult,
      1,
    )
    const events = await collectEvents(createContext(treeRequest, planner, 5, registry))
    const toolExecIdx = events.findIndex((e) => e.type === 'ToolExecuted')
    const obsIdx = events.findIndex((e) => e.type === 'ObservationRecorded')

    expect(toolExecIdx).toBeGreaterThan(-1)
    expect(obsIdx).toBeGreaterThan(toolExecIdx)
  })

  it('should emit ToolExecuted with success=false for tool not found', async () => {
    const registry = new DefaultToolRegistry()
    const planner = createToolCallingPlanner(
      [{ name: 'missing_tool', input: { id: 'e1' } }],
      treeResult,
      1,
    )
    const events = await collectEvents(createContext(treeRequest, planner, 5, registry))
    const toolExecEvent = events.find((e) => e.type === 'ToolExecuted')

    expect(toolExecEvent).toBeDefined()
    expect(toolExecEvent!.payload!.success).toBe(false)
  })

  it('should emit ObservationRecorded with success=false when tool throws', async () => {
    const failingTool: Tool = {
      name: 'failing_tool',
      description: 'Always throws',
      async execute(): Promise<unknown> {
        throw new Error('Kaboom')
      },
    }
    const registry = new DefaultToolRegistry([failingTool])
    const planner = createToolCallingPlanner(
      [{ name: 'failing_tool', input: { id: 'e1' } }],
      treeResult,
      1,
    )
    const events = await collectEvents(createContext(treeRequest, planner, 5, registry))
    const obsEvent = events.find((e) => e.type === 'ObservationRecorded')

    expect(obsEvent).toBeDefined()
    expect(obsEvent!.payload!.success).toBe(false)
    expect(obsEvent!.payload!.toolOutput).toBe('Kaboom')
  })
})

// ---------------------------------------------------------------------------
// Event Emission — Complete Event Chain
// ---------------------------------------------------------------------------

describe('Event Emission — Complete Event Chain', () => {
  it('should emit all events for a 2-iteration loop', async () => {
    const tool = createMockTool('find_entity', { id: 'e1' })
    const registry = new DefaultToolRegistry([tool])
    const planner = createToolCallingPlanner(
      [{ name: 'find_entity', input: { id: 'e1' } }],
      treeResult,
      1,
    )
    const events = await collectEvents(createContext(treeRequest, planner, 5, registry))
    const eventTypes = events.map((e) => e.type)

    expect(eventTypes).toContain('AgentLoopStarted')
    expect(eventTypes).toContain('LoopIterationStarted')
    expect(eventTypes).toContain('ToolExecuted')
    expect(eventTypes).toContain('ObservationRecorded')
    expect(eventTypes).toContain('LoopIterationFinished')
    expect(eventTypes).toContain('AgentLoopFinished')
  })

  it('should emit AgentLoopFinished with correct iterations on multi-step', async () => {
    const tool = createMockTool('find_entity', { id: 'e1' })
    const registry = new DefaultToolRegistry([tool])
    const planner = createToolCallingPlanner(
      [{ name: 'find_entity', input: { id: 'e1' } }],
      treeResult,
      2,
    )
    const loop = new DefaultAgentLoop()
    const events: PipelineEvent[] = []
    loop.events.subscribe({ onEvent: (e) => events.push(e) })
    await loop.execute(createContext(treeRequest, planner, 5, registry))

    const finishedEvent = events.find((e) => e.type === 'AgentLoopFinished')
    expect(finishedEvent!.payload!.iterations).toBe(3)
    expect(finishedEvent!.payload!.finished).toBe(true)
  })

  it('should emit correct number of LoopIteration events for multi-step loop', async () => {
    const tool = createMockTool('find_entity', { id: 'e1' })
    const registry = new DefaultToolRegistry([tool])
    const planner = createToolCallingPlanner(
      [{ name: 'find_entity', input: { id: 'e1' } }],
      treeResult,
      2,
    )
    const events = await collectEvents(createContext(treeRequest, planner, 5, registry))

    const loopStarted = events.filter((e) => e.type === 'LoopIterationStarted')
    const loopFinished = events.filter((e) => e.type === 'LoopIterationFinished')

    expect(loopStarted).toHaveLength(3)
    expect(loopFinished).toHaveLength(3)
  })

  it('should have correct event order for multi-step loop', async () => {
    const tool = createMockTool('find_entity', { id: 'e1' })
    const registry = new DefaultToolRegistry([tool])
    const planner = createToolCallingPlanner(
      [{ name: 'find_entity', input: { id: 'e1' } }],
      treeResult,
      1,
    )
    const events = await collectEvents(createContext(treeRequest, planner, 5, registry))
    const eventTypes = events.map((e) => e.type)

    // Check the pattern for iteration 1 tool call
    const agentLoopStartIdx = eventTypes.indexOf('AgentLoopStarted')
    const iter1Start = eventTypes.indexOf('LoopIterationStarted')
    const toolExecIdx = eventTypes.indexOf('ToolExecuted')
    const obsIdx = eventTypes.indexOf('ObservationRecorded')
    const iter1End = eventTypes.indexOf('LoopIterationFinished')
    const agentLoopEndIdx = eventTypes.indexOf('AgentLoopFinished')

    expect(agentLoopStartIdx).toBeLessThan(iter1Start)
    expect(iter1Start).toBeLessThan(toolExecIdx)
    expect(toolExecIdx).toBeLessThan(obsIdx)
    expect(obsIdx).toBeLessThan(iter1End)
    // There are 2 loop iterations, so there are more events between
    expect(iter1End).toBeLessThan(agentLoopEndIdx)
  })

  it('should have timestamps on all emitted events (including new types)', async () => {
    const tool = createMockTool('find_entity', { id: 'e1' })
    const registry = new DefaultToolRegistry([tool])
    const planner = createToolCallingPlanner(
      [{ name: 'find_entity', input: { id: 'e1' } }],
      treeResult,
      1,
    )
    const events = await collectEvents(createContext(treeRequest, planner, 5, registry))

    for (const event of events) {
      expect(typeof event.timestamp).toBe('number')
      expect(event.timestamp).toBeGreaterThan(0)
    }
  })
})

// ---------------------------------------------------------------------------
// Stop Conditions
// ---------------------------------------------------------------------------

describe('Stop Conditions', () => {
  it('should stop when Planner returns actions (primary stop condition)', async () => {
    const planner = createMockPlanner(treeResult)
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner, 10))

    expect(result.iterations).toBe(1)
    expect(result.plannerResult.actions).toHaveLength(1)
  })

  it('should stop when maxIterations is reached (secondary stop condition)', async () => {
    const tool = createMockTool('find_entity', { id: 'e1' })
    const registry = new DefaultToolRegistry([tool])
    const alwaysEmpty: Planner = {
      async plan(): Promise<PlannerResult> {
        return {
          actions: [],
          metadata: { toolCalls: [{ name: 'find_entity', input: {} }] },
        }
      },
    }
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, alwaysEmpty, 2, registry))

    expect(result.iterations).toBe(2)
    expect(result.finished).toBe(false)
  })

  it('should stop when toolCalls are missing from metadata', async () => {
    const registry = new DefaultToolRegistry([createMockTool('find_entity', {})])
    // Planner returns empty actions but NO toolCalls metadata
    const noToolCallsPlanner: Planner = {
      async plan(): Promise<PlannerResult> {
        return { actions: [], reasoning: 'No tool calls' }
      },
    }
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, noToolCallsPlanner, 10, registry))

    expect(result.iterations).toBe(1)
    expect(result.finished).toBe(false)
  })

  it('should stop when toolRegistry is not provided', async () => {
    const toolCallsPlanner: Planner = {
      async plan(): Promise<PlannerResult> {
        return {
          actions: [],
          metadata: { toolCalls: [{ name: 'find_entity', input: {} }] },
        }
      },
    }
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, toolCallsPlanner, 10))

    expect(result.iterations).toBe(1)
    expect(result.finished).toBe(false)
  })

  it('should not execute tools from iterations beyond maxIterations', async () => {
    const recorded = createRecordedTool()
    const registry = new DefaultToolRegistry([recorded.tool])
    const alwaysEmpty: Planner = {
      async plan(): Promise<PlannerResult> {
        return {
          actions: [],
          metadata: { toolCalls: [{ name: recorded.tool.name, input: {} }] },
        }
      },
    }
    const loop = new DefaultAgentLoop()
    await loop.execute(createContext(treeRequest, alwaysEmpty, 3, registry))

    // Tool should be called exactly 3 times (one per iteration)
    expect(recorded.calls).toHaveLength(3)
  })

  it('should have finished=true when loop ends with non-empty actions', async () => {
    const planner = createMockPlanner(treeResult)
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner))
    expect(result.finished).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Tool Execution — Integration
// ---------------------------------------------------------------------------

describe('Tool Execution — Integration', () => {
  it('should call tool.execute() with correct input', async () => {
    const recorded = createRecordedTool()
    const registry = new DefaultToolRegistry([recorded.tool])
    const planner = createToolCallingPlanner(
      [{ name: recorded.tool.name, input: { id: 'entity-1' } }],
      treeResult,
      1,
    )
    const loop = new DefaultAgentLoop()
    await loop.execute(createContext(treeRequest, planner, 5, registry))

    expect(recorded.calls).toHaveLength(1)
    expect(recorded.calls[0].input).toEqual({ id: 'entity-1' })
  })

  it('should call tool multiple times across iterations', async () => {
    const recorded = createRecordedTool()
    recorded.tool.name = 'find_entity'
    const registry = new DefaultToolRegistry([recorded.tool])
    const planner = createToolCallingPlanner(
      [{ name: 'find_entity', input: { iteration: 1 } }],
      treeResult,
      3,
    )
    const loop = new DefaultAgentLoop()
    await loop.execute(createContext(treeRequest, planner, 5, registry))

    // Tools should be called 3 times (one per iteration before final action)
    expect(recorded.calls).toHaveLength(3)
  })

  it('should feed observation back into the request prompt', async () => {
    const tool = createMockTool('find_entity', { found: true, entity: { id: 'e1', x: 5, y: 3 } })
    const registry = new DefaultToolRegistry([tool])

    const capturedRequests: AIRequest[] = []
    const capturingPlanner = createCallTrackingPlanner([
      {
        actions: [],
        metadata: { toolCalls: [{ name: 'find_entity', input: { id: 'e1' } }] },
      },
      treeResult,
    ], capturedRequests)

    const loop = new DefaultAgentLoop()
    await loop.execute(createContext(treeRequest, capturingPlanner, 5, registry))

    // Second call should have observation appended
    expect(capturedRequests[0]!.prompt).toContain('Observation:')
    expect(capturedRequests[0]!.prompt).toContain('Tool find_entity returned:')
  })

  it('should append observation from failing tool to the prompt', async () => {
    const failingTool: Tool = {
      name: 'failing_tool',
      description: 'Always fails',
      async execute(): Promise<unknown> {
        throw new Error('Connection timeout')
      },
    }
    const registry = new DefaultToolRegistry([failingTool])

    const capturedRequests: AIRequest[] = []
    const planner = createCallTrackingPlanner([
      {
        actions: [],
        metadata: { toolCalls: [{ name: 'failing_tool', input: { id: 'e1' } }] },
      },
      treeResult,
    ], capturedRequests)

    const loop = new DefaultAgentLoop()
    await loop.execute(createContext(treeRequest, planner, 5, registry))

    // Error message should be in the observation
    expect(capturedRequests[0]!.prompt).toContain('Connection timeout')
  })

  it('should handle multiple tool calls in the same iteration', async () => {
    const tool1 = createMockTool('find_entity', { id: 'e1' })
    const tool2 = createMockTool('find_entities', [{ id: 'e1' }, { id: 'e2' }])
    const registry = new DefaultToolRegistry([tool1, tool2])

    const capturedRequests: AIRequest[] = []
    const planner = createCallTrackingPlanner([
      {
        actions: [],
        metadata: {
          toolCalls: [
            { name: 'find_entity', input: { id: 'e1' } },
            { name: 'find_entities', input: { type: 'tree' } },
          ],
        },
      },
      treeResult,
    ], capturedRequests)

    const loop = new DefaultAgentLoop()
    await loop.execute(createContext(treeRequest, planner, 5, registry))

    // Second request should have both observations
    expect(capturedRequests[0]!.prompt).toContain('Tool find_entity returned:')
    expect(capturedRequests[0]!.prompt).toContain('Tool find_entities returned:')
  })
})

// ---------------------------------------------------------------------------
// RetryPlanner Compatibility
// ---------------------------------------------------------------------------

describe('RetryPlanner Compatibility — Multi-Step', () => {
  it('should work with RetryPlanner in a multi-step loop', async () => {
    const provider = new MockPlannerProvider(mockConfig)
    const planner = new RetryPlanner(provider)
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner))

    // RetryPlanner returns actions → loop ends at 1 iteration
    expect(result.iterations).toBe(1)
    expect(result.plannerResult.actions).toHaveLength(1)
  })

  it('should preserve RetryPlanner metadata through multi-step loop', async () => {
    const provider = new MockPlannerProvider(mockConfig)
    const planner = new RetryPlanner(provider)
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner))

    expect(result.plannerResult.metadata).toBeDefined()
    expect(result.plannerResult.metadata!.retryCount).toBe(0)
    expect(result.plannerResult.metadata!.planningAttempts).toBe(1)
  })

  it('should work with RetryPlanner when tool calls are involved', async () => {
    const provider = new MockPlannerProvider(mockConfig)
    const retryPolicy = new RetryPolicy({ maxRetries: 2 })
    const planner = new RetryPlanner(provider, retryPolicy)
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner))

    expect(result.iterations).toBe(1)
    expect(result.plannerResult.actions).toHaveLength(1)
  })

  it('should emit retry events inside AgentLoop iteration', async () => {
    // Create a provider that fails on first attempt with a recoverable failure
    let attempt = 0
    const failingProvider: PlannerProvider = {
      async complete(request: AIRequest): Promise<PlannerResult> {
        attempt++
        if (attempt === 1) {
          return { actions: [], reasoning: 'failed to parse: invalid JSON response from LLM' }
        }
        return treeResult
      },
    }

    const planner = new RetryPlanner(failingProvider)
    const loop = new DefaultAgentLoop()
    const agentEvents: PipelineEvent[] = []
    loop.events.subscribe({ onEvent: (e) => agentEvents.push(e) })

    const result = await loop.execute(createContext(treeRequest, planner))

    const eventTypes = agentEvents.map((e) => e.type)
    expect(eventTypes).toContain('AgentLoopStarted')
    expect(eventTypes).toContain('AgentLoopFinished')
    expect(result.plannerResult.actions).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// ToolCallPlanner Compatibility
// ---------------------------------------------------------------------------

describe('ToolCallPlanner Compatibility — Multi-Step', () => {
  it('should work with ToolCallPlanner in multi-step loop', async () => {
    const provider = new MockPlannerProvider(mockConfig)
    const registry = new DefaultToolRegistry()
    const planner = new ToolCallPlanner(provider, registry)
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner))

    // ToolCallPlanner returns actions → loop ends at 1 iteration
    expect(result.iterations).toBe(1)
    expect(result.plannerResult.actions).toHaveLength(1)
  })

  it('should preserve ToolCallPlanner metadata in loop result', async () => {
    const provider = new MockPlannerProvider(mockConfig)
    const registry = new DefaultToolRegistry()
    const planner = new ToolCallPlanner(provider, registry)
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner))

    expect(result.plannerResult.metadata).toBeDefined()
    expect(result.plannerResult.metadata!.tools).toBeDefined()
    expect(result.plannerResult.metadata!.toolCallDuration).toBeGreaterThanOrEqual(0)
  })

  it('should work with ToolCallPlanner plus tools in multi-step loop', async () => {
    const provider = new MockPlannerProvider(mockConfig)
    const tool = createMockTool('find_entity', { id: 'e1' })
    const registry = new DefaultToolRegistry([tool])
    const planner = new ToolCallPlanner(provider, registry)
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner))

    expect(result.iterations).toBe(1)
    expect(result.plannerResult.actions).toHaveLength(1)
  })

  it('should not interfere with ToolCallPlanner event emission', async () => {
    const provider = new MockPlannerProvider(mockConfig)
    const registry = new DefaultToolRegistry()
    const planner = new ToolCallPlanner(provider, registry)
    const loop = new DefaultAgentLoop()

    // Collect events from both ToolCallPlanner and AgentLoop
    const toolPlannerEvents: PipelineEvent[] = []
    planner.events.subscribe({ onEvent: (e) => toolPlannerEvents.push(e) })

    await loop.execute(createContext(treeRequest, planner))

    // ToolCallPlanner should still emit its own events
    const toolEventTypes = toolPlannerEvents.map((e) => e.type)
    expect(toolEventTypes).toContain('ToolCallStarted')
    expect(toolEventTypes).toContain('ToolCallFinished')
  })
})

// ---------------------------------------------------------------------------
// Backward Compatibility
// ---------------------------------------------------------------------------

describe('Backward Compatibility — Existing Tests Still Pass', () => {
  it('should return iterations === 1 for single-iteration case', async () => {
    const planner = createMockPlanner(treeResult)
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner))

    expect(result.iterations).toBe(1)
  })

  it('should return finished === true for single-iteration case', async () => {
    const planner = createMockPlanner(treeResult)
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner))

    expect(result.finished).toBe(true)
  })

  it('should return steps array with length === 1 for single-iteration', async () => {
    const planner = createMockPlanner(treeResult)
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner))

    expect(result.steps).toHaveLength(1)
  })

  it('should have steps[0].iteration === 1 for single-iteration', async () => {
    const planner = createMockPlanner(treeResult)
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner))

    expect(result.steps[0].iteration).toBe(1)
  })

  it('should emit exactly 4 agent loop events for single-iteration completion', async () => {
    const planner = createMockPlanner(treeResult)
    const events = await collectEvents(createContext(treeRequest, planner))
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

  it('should support being executed multiple times', async () => {
    const planner1 = createMockPlanner(treeResult)
    const planner2 = createMockPlanner({
      actions: [{ type: 'MoveEntity', id: 'entity-1', x: 7, y: 3 }],
    })
    const loop = new DefaultAgentLoop()

    const result1 = await loop.execute(createContext(treeRequest, planner1))
    const result2 = await loop.execute(
      createContext({ prompt: 'move entity' }, planner2),
    )

    expect(result1.iterations).toBe(1)
    expect(result1.plannerResult.actions[0].type).toBe('CreateEntity')
    expect(result2.iterations).toBe(1)
    expect(result2.plannerResult.actions[0].type).toBe('MoveEntity')
  })

  it('should work with empty actions result (single-iteration stop)', async () => {
    const planner = createMockPlanner(emptyResult)
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner))

    expect(result.plannerResult.actions).toHaveLength(0)
    expect(result.plannerResult.reasoning).toBe('No actions needed')
  })

  it('should have timestamp on all events (including ToolExecuted, ObservationRecorded)', async () => {
    const tool = createMockTool('find_entity', { id: 'e1' })
    const registry = new DefaultToolRegistry([tool])
    const planner = createToolCallingPlanner(
      [{ name: 'find_entity', input: { id: 'e1' } }],
      treeResult,
      1,
    )
    const events = await collectEvents(createContext(treeRequest, planner, 5, registry))

    for (const event of events) {
      expect(typeof event.timestamp).toBe('number')
      expect(event.timestamp).toBeGreaterThan(0)
    }
  })
})

// ---------------------------------------------------------------------------
// StreamingPlannerProvider Compatibility
// ---------------------------------------------------------------------------

describe('StreamingPlannerProvider — Multi-Step', () => {
  it('should work with MockStreamingProvider through multi-step loop', async () => {
    const provider = new MockStreamingProvider()
    const planner = createProviderBasedPlanner(provider)
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner))

    expect(result.iterations).toBe(1)
    expect(result.plannerResult.actions).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// Edge Cases
// ---------------------------------------------------------------------------

describe('Edge Cases', () => {
  it('should handle toolRegistry with no tools gracefully', async () => {
    const registry = new DefaultToolRegistry([])
    const planner = createToolCallingPlanner(
      [{ name: 'find_entity', input: {} }],
      treeResult,
      1,
    )
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner, 5, registry))

    // Tool not found → observation recorded, loop continues
    // Since tool not found, observation is error, but loop still tries
    // The loop checks toolCalls from metadata, tries to execute, gets "not found"
    expect(result.steps[0].toolOutput).toContain('Tool not found')
  })

  it('should handle empty toolCalls array in metadata', async () => {
    const registry = new DefaultToolRegistry([createMockTool('tool1', {})])
    const emptyToolCallsPlanner: Planner = {
      async plan(): Promise<PlannerResult> {
        return { actions: [], metadata: { toolCalls: [] } }
      },
    }
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, emptyToolCallsPlanner, 5, registry))

    // Empty toolCalls array → no tools to execute → loop ends
    expect(result.iterations).toBe(1)
    expect(result.finished).toBe(false)
  })

  it('should handle non-array toolCalls in metadata', async () => {
    const registry = new DefaultToolRegistry([createMockTool('tool1', {})])
    const badMetadataPlanner: Planner = {
      async plan(): Promise<PlannerResult> {
        return { actions: [], metadata: { toolCalls: 'not-an-array' } }
      },
    }
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, badMetadataPlanner, 5, registry))

    // Non-array toolCalls → treated as no tool calls → loop ends
    expect(result.iterations).toBe(1)
  })

  it('should handle null metadata gracefully', async () => {
    const registry = new DefaultToolRegistry([createMockTool('tool1', {})])
    const nullMetadataPlanner: Planner = {
      async plan(): Promise<PlannerResult> {
        return { actions: [] } // No metadata at all
      },
    }
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, nullMetadataPlanner, 5, registry))

    expect(result.iterations).toBe(1)
    expect(result.plannerResult.actions).toHaveLength(0)
  })

  it('should support fresh event emitter per call (no cross-contamination)', async () => {
    const loop = new DefaultAgentLoop()
    const events1: PipelineEvent[] = []
    const events2: PipelineEvent[] = []

    // First execution
    loop.events.subscribe({ onEvent: (e) => events1.push(e) })
    await loop.execute(createContext(treeRequest, createMockPlanner(treeResult)))
    expect(events1.length).toBeGreaterThan(0)

    // Second execution — same loop, new subscribers
    events1.length = 0
    loop.events.subscribe({ onEvent: (e) => events2.push(e) })
    await loop.execute(createContext(treeRequest, createMockPlanner(treeResult)))
    expect(events1.length).toBeGreaterThan(0)
    expect(events2.length).toBeGreaterThan(0)
  })

  it('should handle many iterations without hitting recursion limit', async () => {
    const tool = createMockTool('find_entity', {})
    const registry = new DefaultToolRegistry([tool])
    const alwaysEmpty: Planner = {
      async plan(): Promise<PlannerResult> {
        return {
          actions: [],
          metadata: { toolCalls: [{ name: 'find_entity', input: {} }] },
        }
      },
    }
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, alwaysEmpty, 10, registry))

    // Should stop at 10 without stack overflow
    expect(result.iterations).toBe(10)
    expect(result.finished).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Tool Call Planning Verification
// ---------------------------------------------------------------------------

describe('Tool Call Planning Verification', () => {
  it('should record tool output as part of the observation for next planner call', async () => {
    const toolOutput = { id: 'entity-1', type: 'tree', x: 5, y: 3 }
    const tool = createMockTool('find_entity', toolOutput)
    const registry = new DefaultToolRegistry([tool])

    const capturedRequests: AIRequest[] = []
    const planner = createCallTrackingPlanner([
      {
        actions: [],
        metadata: { toolCalls: [{ name: 'find_entity', input: { id: 'e1' } }] },
      },
      treeResult,
    ], capturedRequests)

    const loop = new DefaultAgentLoop()
    await loop.execute(createContext(treeRequest, planner, 5, registry))

    // The observation should contain the JSON-serialized tool output
    expect(capturedRequests[0]!.prompt).toContain(JSON.stringify(toolOutput))
  })

  it('should preserve original request content when appending observations', async () => {
    const tool = createMockTool('find_entity', { found: true })
    const registry = new DefaultToolRegistry([tool])

    const capturedRequests: AIRequest[] = []
    const planner = createCallTrackingPlanner([
      {
        actions: [],
        metadata: { toolCalls: [{ name: 'find_entity', input: {} }] },
      },
      treeResult,
    ], capturedRequests)

    const loop = new DefaultAgentLoop()
    await loop.execute(createContext({ prompt: 'original prompt' }, planner, 5, registry))

    // Original prompt preserved at start
    expect(capturedRequests[0]!.prompt.startsWith('original prompt')).toBe(true)
    // Observation appended at end
    expect(capturedRequests[0]!.prompt).toContain('Observation:\nTool find_entity returned:')
  })
})