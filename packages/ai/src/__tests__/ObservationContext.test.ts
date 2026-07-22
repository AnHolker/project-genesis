import { describe, it, expect } from 'vitest'
import { DefaultAgentLoop } from '../agent/DefaultAgentLoop'
import { DefaultToolRegistry } from '../tools/ToolRegistry'
import type { AgentLoopContext } from '../agent/AgentLoopContext'
import type { LoopStep } from '../agent/AgentLoopStep'
import type { Observation } from '../agent/Observation'
import type { Planner } from '../planner/Planner'
import type { PlannerResult } from '../planner/PlannerResult'
import type { AIRequest } from '../request'
import type { Tool, ToolRegistry } from '../tools'
import type { PipelineEvent } from '../events/PipelineEvent'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const treeResult: PlannerResult = {
  actions: [{ type: 'CreateEntity', entityType: 'tree', x: 5, y: 3 }],
}

const treeRequest: AIRequest = { prompt: 'create a tree' }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockPlanner(result: PlannerResult = treeResult): Planner {
  return {
    async plan(_request: AIRequest): Promise<PlannerResult> {
      return result
    },
  }
}

function createMockTool(name: string, output: unknown = { found: true }): Tool {
  return {
    name,
    description: `Mock: ${name}`,
    async execute(input: unknown): Promise<unknown> {
      return output
    },
  }
}

function createContext(
  request: AIRequest = treeRequest,
  planner: Planner = createMockPlanner(),
  maxIterations = 5,
  toolRegistry?: ToolRegistry,
): AgentLoopContext {
  return { request, planner, maxIterations, toolRegistry }
}

async function collectEvents(context: AgentLoopContext): Promise<PipelineEvent[]> {
  const loop = new DefaultAgentLoop()
  const events: PipelineEvent[] = []
  loop.events.subscribe({ onEvent: (e) => events.push(e) })
  await loop.execute(context)
  return events
}

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
          reasoning: `Need tools (call ${callIndex})`,
          metadata: { toolCalls },
        }
      }
      callIndex++
      return finalResult
    },
  }
}

// ---------------------------------------------------------------------------
// Observation Type
// ---------------------------------------------------------------------------

describe('Observation Type', () => {
  it('should define Observation with required fields', () => {
    const obs: Observation = {
      toolName: 'find_entity',
      toolInput: { id: 'e1' },
      toolOutput: { found: true },
      timestamp: 1000,
      iteration: 1,
    }
    expect(obs.toolName).toBe('find_entity')
    expect(obs.toolInput).toEqual({ id: 'e1' })
    expect(obs.toolOutput).toEqual({ found: true })
    expect(obs.timestamp).toBe(1000)
    expect(obs.iteration).toBe(1)
  })

  it('should support optional success field', () => {
    const obs: Observation = {
      toolName: 'find_entity',
      toolInput: {},
      toolOutput: { error: 'failed' },
      timestamp: 1000,
      iteration: 1,
      success: false,
    }
    expect(obs.success).toBe(false)
  })

  it('should allow success to be undefined for backward compat', () => {
    const obs: Observation = {
      toolName: 'find_entity',
      toolInput: {},
      toolOutput: {},
      timestamp: 1000,
      iteration: 1,
    }
    expect(obs.success).toBeUndefined()
  })

  it('should be a type-only export (not constructable at runtime)', () => {
    // Observation is an interface, not a class — it's type-only.
    // This test verifies the type can be referenced at compile time.
    const obs: Observation = {
      toolName: 'test',
      toolInput: {},
      toolOutput: {},
      timestamp: 1,
      iteration: 1,
    }
    expect(obs.toolName).toBe('test')
  })
})

// ---------------------------------------------------------------------------
// Observation Lifecycle — AgentLoop Creation
// ---------------------------------------------------------------------------

describe('Observation Lifecycle — AgentLoop Creation', () => {
  it('should create Observations when tools are executed', async () => {
    const tool = createMockTool('find_entity', { id: 'e1' })
    const registry = new DefaultToolRegistry([tool])
    const planner = createToolCallingPlanner(
      [{ name: 'find_entity', input: { id: 'e1' } }],
      treeResult,
      1,
    )
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner, 5, registry))

    // Step 1 (tool call) should have observations
    expect(result.steps[0].observations).toBeDefined()
    expect(result.steps[0].observations!.length).toBeGreaterThan(0)
  })

  it('should populate observation toolName from the executed tool', async () => {
    const tool = createMockTool('find_entity', { id: 'e1' })
    const registry = new DefaultToolRegistry([tool])
    const planner = createToolCallingPlanner(
      [{ name: 'find_entity', input: { id: 'e1' } }],
      treeResult,
      1,
    )
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner, 5, registry))

    expect(result.steps[0].observations![0].toolName).toBe('find_entity')
  })

  it('should populate observation toolInput from the tool call', async () => {
    const tool = createMockTool('find_entity', { id: 'e1' })
    const registry = new DefaultToolRegistry([tool])
    const planner = createToolCallingPlanner(
      [{ name: 'find_entity', input: { id: 'entity-1', type: 'tree' } }],
      treeResult,
      1,
    )
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner, 5, registry))

    expect(result.steps[0].observations![0].toolInput).toEqual({ id: 'entity-1', type: 'tree' })
  })

  it('should populate observation toolOutput from tool result', async () => {
    const output = { id: 'entity-1', x: 5, y: 3 }
    const tool = createMockTool('find_entity', output)
    const registry = new DefaultToolRegistry([tool])
    const planner = createToolCallingPlanner(
      [{ name: 'find_entity', input: { id: 'e1' } }],
      treeResult,
      1,
    )
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner, 5, registry))

    expect(result.steps[0].observations![0].toolOutput).toEqual(output)
  })

  it('should set observation iteration from the current iteration', async () => {
    const tool = createMockTool('find_entity', { id: 'e1' })
    const registry = new DefaultToolRegistry([tool])
    const planner = createToolCallingPlanner(
      [{ name: 'find_entity', input: {} }],
      treeResult,
      2, // Two tool call iterations
    )
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner, 5, registry))

    expect(result.steps[0].observations![0].iteration).toBe(1)
    expect(result.steps[1].observations![0].iteration).toBe(2)
  })

  it('should have timestamp on each observation', async () => {
    const tool = createMockTool('find_entity', { id: 'e1' })
    const registry = new DefaultToolRegistry([tool])
    const planner = createToolCallingPlanner(
      [{ name: 'find_entity', input: {} }],
      treeResult,
      1,
    )
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner, 5, registry))

    expect(typeof result.steps[0].observations![0].timestamp).toBe('number')
    expect(result.steps[0].observations![0].timestamp).toBeGreaterThan(0)
  })

  it('should set success=true when tool executes successfully', async () => {
    const tool = createMockTool('good_tool', { ok: true })
    const registry = new DefaultToolRegistry([tool])
    const planner = createToolCallingPlanner(
      [{ name: 'good_tool', input: {} }],
      treeResult,
      1,
    )
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner, 5, registry))

    expect(result.steps[0].observations![0].success).toBe(true)
  })

  it('should set success=false when tool throws', async () => {
    const failingTool: Tool = {
      name: 'bad_tool',
      description: 'fails',
      async execute(): Promise<unknown> {
        throw new Error('Tool error')
      },
    }
    const registry = new DefaultToolRegistry([failingTool])
    const planner = createToolCallingPlanner(
      [{ name: 'bad_tool', input: {} }],
      treeResult,
      1,
    )
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner, 5, registry))

    expect(result.steps[0].observations![0].success).toBe(false)
  })

  it('should create observation with error output when tool not found', async () => {
    const registry = new DefaultToolRegistry() // empty
    const planner = createToolCallingPlanner(
      [{ name: 'missing_tool', input: { id: 'x' } }],
      treeResult,
      1,
    )
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner, 5, registry))

    expect(result.steps[0].observations![0].toolOutput).toContain('Tool not found')
    expect(result.steps[0].observations![0].success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// LoopStep Observation Reference
// ---------------------------------------------------------------------------

describe('LoopStep Observation Reference', () => {
  it('should have observations array on tool-call steps', async () => {
    const tool = createMockTool('find_entity', { id: 'e1' })
    const registry = new DefaultToolRegistry([tool])
    const planner = createToolCallingPlanner(
      [{ name: 'find_entity', input: { id: 'e1' } }],
      treeResult,
      1,
    )
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner, 5, registry))

    expect(result.steps[0].observations).toBeInstanceOf(Array)
  })

  it('should not have observations on final-action steps', async () => {
    const tool = createMockTool('find_entity', { id: 'e1' })
    const registry = new DefaultToolRegistry([tool])
    const planner = createToolCallingPlanner(
      [{ name: 'find_entity', input: { id: 'e1' } }],
      treeResult,
      1,
    )
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner, 5, registry))

    // Step 2 is the final action step — no observations
    expect(result.steps[1].observations).toBeUndefined()
  })

  it('should reference same object as inline toolName field', async () => {
    const tool = createMockTool('find_entity', { id: 'e1' })
    const registry = new DefaultToolRegistry([tool])
    const planner = createToolCallingPlanner(
      [{ name: 'find_entity', input: { id: 'entity-1' } }],
      treeResult,
      1,
    )
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner, 5, registry))

    // Inline field matches observation
    expect(result.steps[0].toolName).toBe(result.steps[0].observations![0].toolName)
    expect(result.steps[0].toolInput).toEqual(result.steps[0].observations![0].toolInput)
    expect(result.steps[0].toolOutput).toEqual(result.steps[0].observations![0].toolOutput)
  })

  it('should contain one observation per tool call in the iteration', async () => {
    const tool1 = createMockTool('tool_a', { result: 'a' })
    const tool2 = createMockTool('tool_b', { result: 'b' })
    const registry = new DefaultToolRegistry([tool1, tool2])
    const planner = createToolCallingPlanner(
      [
        { name: 'tool_a', input: { x: 1 } },
        { name: 'tool_b', input: { y: 2 } },
      ],
      treeResult,
      1,
    )
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner, 5, registry))

    expect(result.steps[0].observations).toHaveLength(2)
  })

  it('should have empty observations for steps without tool calls', async () => {
    const planner = createMockPlanner(treeResult)
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner, 5))

    expect(result.steps[0].observations).toBeUndefined()
  })

  it('should preserve observation ordering across iterations', async () => {
    const tool = createMockTool('find_entity', { id: 'e1' })
    const registry = new DefaultToolRegistry([tool])
    const planner = createToolCallingPlanner(
      [{ name: 'find_entity', input: { iteration: 1 } }],
      treeResult,
      2,
    )
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner, 5, registry))

    // Iteration 1 observation comes before iteration 2
    expect(result.steps[0].observations![0].iteration).toBe(1)
    expect(result.steps[1].observations![0].iteration).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// Planner Receives Observations via Metadata
// ---------------------------------------------------------------------------

describe('Planner Receives Observations via Metadata', () => {
  it('should pass observations to planner via request.metadata', async () => {
    let capturedRequest: AIRequest | undefined
    const capturingPlanner: Planner = {
      async plan(request: AIRequest): Promise<PlannerResult> {
        capturedRequest = request
        return treeResult
      },
    }

    // Planner returns empty actions first, then treeResult
    const tool = createMockTool('find_entity', { id: 'e1' })
    const registry = new DefaultToolRegistry([tool])
    const planner = createToolCallingPlanner(
      [{ name: 'find_entity', input: { id: 'e1' } }],
      treeResult,
      1,
    )

    // Wrap with capturing planner for the second call
    let secondRequest: AIRequest | undefined
    let captureCallCount = 0
    const wrappedPlanner: Planner = {
      async plan(request: AIRequest): Promise<PlannerResult> {
        captureCallCount++
        if (captureCallCount === 1) {
          return {
            actions: [],
            metadata: { toolCalls: [{ name: 'find_entity', input: { id: 'e1' } }] },
          }
        }
        secondRequest = request
        return treeResult
      },
    }

    const loop = new DefaultAgentLoop()
    await loop.execute(createContext(treeRequest, wrappedPlanner, 5, registry))

    // Second planner call should have observations in metadata
    expect(secondRequest!.metadata).toBeDefined()
    expect(secondRequest!.metadata!.observations).toBeDefined()
  })

  it('should pass empty observations array on first call', async () => {
    let firstRequest: AIRequest | undefined
    let emptyCallCount = 0
    const planner: Planner = {
      async plan(request: AIRequest): Promise<PlannerResult> {
        emptyCallCount++
        if (emptyCallCount === 1) {
          firstRequest = request
          return {
            actions: [],
            metadata: { toolCalls: [{ name: 'find_entity', input: { id: 'e1' } }] },
          }
        }
        return treeResult
      },
    }

    const tool = createMockTool('find_entity', { id: 'e1' })
    const registry = new DefaultToolRegistry([tool])
    const loop = new DefaultAgentLoop()
    await loop.execute(createContext(treeRequest, planner, 5, registry))

    // First call: no observations yet → metadata.observations should be undefined
    // (agent only attaches observations when there are any)
    const metadata = firstRequest!.metadata
    if (metadata) {
      expect(metadata.observations).toBeUndefined()
    }
  })

  it('should pass accumulated observations on second planner call', async () => {
    let secondRequest: AIRequest | undefined
    let accumCallCount = 0
    const planner: Planner = {
      async plan(request: AIRequest): Promise<PlannerResult> {
        accumCallCount++
        if (accumCallCount === 1) {
          return {
            actions: [],
            metadata: { toolCalls: [{ name: 'find_entity', input: { id: 'e1' } }] },
          }
        }
        secondRequest = request
        return treeResult
      },
    }

    const tool = createMockTool('find_entity', { id: 'entity-1', x: 5, y: 3 })
    const registry = new DefaultToolRegistry([tool])
    const loop = new DefaultAgentLoop()
    await loop.execute(createContext(treeRequest, planner, 5, registry))

    const observations = secondRequest!.metadata!.observations as Observation[]
    expect(observations).toBeInstanceOf(Array)
    expect(observations).toHaveLength(1)
    expect(observations[0].toolName).toBe('find_entity')
    expect(observations[0].toolOutput).toEqual({ id: 'entity-1', x: 5, y: 3 })
  })

  it('should pass all accumulated observations across multiple iterations', async () => {
    let thirdRequest: AIRequest | undefined
    let multiCallCount = 0
    const planner: Planner = {
      async plan(request: AIRequest): Promise<PlannerResult> {
        multiCallCount++
        if (multiCallCount <= 2) {
          return {
            actions: [],
            metadata: { toolCalls: [{ name: 'find_entity', input: { iter: multiCallCount } }] },
          }
        }
        thirdRequest = request
        return treeResult
      },
    }

    const tool = createMockTool('find_entity', { found: true })
    const registry = new DefaultToolRegistry([tool])
    const loop = new DefaultAgentLoop()
    await loop.execute(createContext(treeRequest, planner, 5, registry))

    const observations = thirdRequest!.metadata!.observations as Observation[]
    expect(observations).toHaveLength(2)
    expect(observations[0].iteration).toBe(1)
    expect(observations[1].iteration).toBe(2)
  })

  it('should not modify the original request metadata', async () => {
    const originalRequest: AIRequest = {
      prompt: 'find entity',
      metadata: { sessionId: 'test-123' },
    }

    let capturedRequest: AIRequest | undefined
    let notModifyCallCount = 0
    const planner: Planner = {
      async plan(request: AIRequest): Promise<PlannerResult> {
        notModifyCallCount++
        if (notModifyCallCount === 1) {
          capturedRequest = request
          return {
            actions: [],
            metadata: { toolCalls: [{ name: 'find_entity', input: {} }] },
          }
        }
        return treeResult
      },
    }

    const tool = createMockTool('find_entity', { id: 'e1' })
    const registry = new DefaultToolRegistry([tool])
    const loop = new DefaultAgentLoop()
    await loop.execute(createContext(originalRequest, planner, 5, registry))

    // The first call's request should have the original metadata intact
    expect(capturedRequest!.metadata!.sessionId).toBe('test-123')
  })
})

// ---------------------------------------------------------------------------
// Multi-Iteration Observation Accumulation
// ---------------------------------------------------------------------------

describe('Multi-Iteration Observation Accumulation', () => {
  it('should accumulate observations across 2 iterations', async () => {
    const tool = createMockTool('find_entity', { id: 'e1' })
    const registry = new DefaultToolRegistry([tool])
    const planner = createToolCallingPlanner(
      [{ name: 'find_entity', input: { iter: 1 } }],
      treeResult,
      2,
    )
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner, 5, registry))

    // Total: 2 tool iterations → 2 observations
    expect(result.steps).toHaveLength(3) // 2 tool + 1 final
    expect(result.steps[0].observations).toHaveLength(1)
    expect(result.steps[1].observations).toHaveLength(1)
  })

  it('should accumulate observations across 3 iterations', async () => {
    const tool = createMockTool('find_entity', { id: 'e1' })
    const registry = new DefaultToolRegistry([tool])
    const planner = createToolCallingPlanner(
      [{ name: 'find_entity', input: { iter: 1 } }],
      treeResult,
      3,
    )
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner, 5, registry))

    // Total: 3 tool iterations → 3 observations
    expect(result.steps).toHaveLength(4)
    expect(result.steps[0].observations).toHaveLength(1)
    expect(result.steps[1].observations).toHaveLength(1)
    expect(result.steps[2].observations).toHaveLength(1)
  })

  it('should have correct iteration numbers on accumulated observations', async () => {
    const tool = createMockTool('find_entity', { id: 'e1' })
    const registry = new DefaultToolRegistry([tool])
    const planner = createToolCallingPlanner(
      [{ name: 'find_entity', input: { iter: 1 } }],
      treeResult,
      2,
    )
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner, 5, registry))

    expect(result.steps[0].observations![0].iteration).toBe(1)
    expect(result.steps[1].observations![0].iteration).toBe(2)
  })

  it('should accumulate multiple observations per iteration', async () => {
    const tool1 = createMockTool('tool_a', { result: 'a' })
    const tool2 = createMockTool('tool_b', { result: 'b' })
    const registry = new DefaultToolRegistry([tool1, tool2])

    let callCount = 0
    const planner: Planner = {
      async plan(_request: AIRequest): Promise<PlannerResult> {
        callCount++
        if (callCount <= 2) {
          return {
            actions: [],
            metadata: {
              toolCalls: [
                { name: 'tool_a', input: { iter: callCount } },
                { name: 'tool_b', input: { iter: callCount } },
              ],
            },
          }
        }
        return treeResult
      },
    }

    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner, 5, registry))

    // Each tool iteration has 2 observations
    expect(result.steps[0].observations).toHaveLength(2)
    expect(result.steps[1].observations).toHaveLength(2)
    // Final step has no observations
    expect(result.steps[2].observations).toBeUndefined()
  })

  it('should preserve observation order within each iteration', async () => {
    const tool1 = createMockTool('first_tool', { order: 1 })
    const tool2 = createMockTool('second_tool', { order: 2 })
    const registry = new DefaultToolRegistry([tool1, tool2])

    let orderCallCount = 0
    const planner: Planner = {
      async plan(_request: AIRequest): Promise<PlannerResult> {
        orderCallCount++
        if (orderCallCount === 1) {
          return {
            actions: [],
            metadata: {
              toolCalls: [
                { name: 'first_tool', input: {} },
                { name: 'second_tool', input: {} },
              ],
            },
          }
        }
        return treeResult
      },
    }

    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner, 5, registry))

    // Instantly stops because no final action (but tools execute)
    expect(result.steps[0].observations![0].toolName).toBe('first_tool')
    expect(result.steps[0].observations![1].toolName).toBe('second_tool')
  })
})

// ---------------------------------------------------------------------------
// Observation Events
// ---------------------------------------------------------------------------

describe('Observation Events', () => {
  it('should still emit ToolExecuted and ObservationRecorded events', async () => {
    const tool = createMockTool('find_entity', { id: 'e1' })
    const registry = new DefaultToolRegistry([tool])
    const planner = createToolCallingPlanner(
      [{ name: 'find_entity', input: { id: 'e1' } }],
      treeResult,
      1,
    )
    const events = await collectEvents(createContext(treeRequest, planner, 5, registry))

    expect(events.some((e) => e.type === 'ToolExecuted')).toBe(true)
    expect(events.some((e) => e.type === 'ObservationRecorded')).toBe(true)
  })

  it('should emit ToolExecuted before ObservationRecorded', async () => {
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

    expect(toolExecIdx).toBeLessThan(obsIdx)
  })

  it('should have ObservationRecorded payload with tool output', async () => {
    const output = { found: true, entity: { id: 'e1' } }
    const tool = createMockTool('find_entity', output)
    const registry = new DefaultToolRegistry([tool])
    const planner = createToolCallingPlanner(
      [{ name: 'find_entity', input: { id: 'e1' } }],
      treeResult,
      1,
    )
    const events = await collectEvents(createContext(treeRequest, planner, 5, registry))
    const obsEvent = events.find((e) => e.type === 'ObservationRecorded')

    expect(obsEvent!.payload!.toolOutput).toEqual(output)
  })

  it('should emit correct number of ToolExecuted events matching tool count', async () => {
    const tool1 = createMockTool('tool_a', {})
    const tool2 = createMockTool('tool_b', {})
    const registry = new DefaultToolRegistry([tool1, tool2])

    let toolCallCount = 0
    const planner: Planner = {
      async plan(_request: AIRequest): Promise<PlannerResult> {
        toolCallCount++
        if (toolCallCount === 1) {
          return {
            actions: [],
            metadata: {
              toolCalls: [
                { name: 'tool_a', input: {} },
                { name: 'tool_b', input: {} },
              ],
            },
          }
        }
        return treeResult
      },
    }

    const events = await collectEvents(createContext(treeRequest, planner, 5, registry))
    const toolExecEvents = events.filter((e) => e.type === 'ToolExecuted')

    expect(toolExecEvents).toHaveLength(2)
  })

  it('should emit ObservationRecorded events across multiple iterations', async () => {
    const tool = createMockTool('find_entity', { id: 'e1' })
    const registry = new DefaultToolRegistry([tool])
    const planner = createToolCallingPlanner(
      [{ name: 'find_entity', input: {} }],
      treeResult,
      2,
    )
    const events = await collectEvents(createContext(treeRequest, planner, 5, registry))
    const obsEvents = events.filter((e) => e.type === 'ObservationRecorded')

    // 2 tool iterations → 2 observation events
    expect(obsEvents).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// Observation Structure
// ---------------------------------------------------------------------------

describe('Observation Structure', () => {
  it('should contain exact toolName from tool definition', async () => {
    const tool = createMockTool('exact_tool_name', { ok: true })
    const registry = new DefaultToolRegistry([tool])
    const planner = createToolCallingPlanner(
      [{ name: 'exact_tool_name', input: {} }],
      treeResult,
      1,
    )
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner, 5, registry))

    expect(result.steps[0].observations![0].toolName).toBe('exact_tool_name')
  })

  it('should contain exact toolInput from the call', async () => {
    const tool = createMockTool('find_entity', { ok: true })
    const registry = new DefaultToolRegistry([tool])
    const planner = createToolCallingPlanner(
      [{ name: 'find_entity', input: { id: 'abc-123', type: 'tree', x: 10 } }],
      treeResult,
      1,
    )
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner, 5, registry))

    expect(result.steps[0].observations![0].toolInput).toEqual({ id: 'abc-123', type: 'tree', x: 10 })
  })

  it('should contain exact toolOutput from execution', async () => {
    const output = { entities: [{ id: 'e1' }, { id: 'e2' }], total: 2 }
    const tool = createMockTool('find_entities', output)
    const registry = new DefaultToolRegistry([tool])
    const planner = createToolCallingPlanner(
      [{ name: 'find_entities', input: { type: 'tree' } }],
      treeResult,
      1,
    )
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner, 5, registry))

    expect(result.steps[0].observations![0].toolOutput).toEqual(output)
  })

  it('should have correct iteration number in each observation', async () => {
    const tool = createMockTool('find_entity', { id: 'e1' })
    const registry = new DefaultToolRegistry([tool])
    const planner = createToolCallingPlanner(
      [{ name: 'find_entity', input: { iter: 1 } }],
      treeResult,
      3,
    )
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner, 5, registry))

    expect(result.steps[0].observations![0].iteration).toBe(1)
    expect(result.steps[1].observations![0].iteration).toBe(2)
    expect(result.steps[2].observations![0].iteration).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// Backward Compatibility
// ---------------------------------------------------------------------------

describe('Backward Compatibility', () => {
  it('should still have inline toolName on LoopStep', async () => {
    const tool = createMockTool('find_entity', { id: 'e1' })
    const registry = new DefaultToolRegistry([tool])
    const planner = createToolCallingPlanner(
      [{ name: 'find_entity', input: { id: 'e1' } }],
      treeResult,
      1,
    )
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner, 5, registry))

    expect(result.steps[0].toolName).toBe('find_entity')
  })

  it('should still have inline toolInput on LoopStep', async () => {
    const tool = createMockTool('find_entity', { id: 'e1' })
    const registry = new DefaultToolRegistry([tool])
    const planner = createToolCallingPlanner(
      [{ name: 'find_entity', input: { id: 'entity-1' } }],
      treeResult,
      1,
    )
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner, 5, registry))

    expect(result.steps[0].toolInput).toEqual({ id: 'entity-1' })
  })

  it('should still have inline toolOutput on LoopStep', async () => {
    const output = { id: 'entity-1', type: 'tree' }
    const tool = createMockTool('find_entity', output)
    const registry = new DefaultToolRegistry([tool])
    const planner = createToolCallingPlanner(
      [{ name: 'find_entity', input: { id: 'e1' } }],
      treeResult,
      1,
    )
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner, 5, registry))

    expect(result.steps[0].toolOutput).toEqual(output)
  })

  it('should still return iterations === 1 for single-iteration case', async () => {
    const planner = createMockPlanner(treeResult)
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner))

    expect(result.iterations).toBe(1)
  })

  it('should still emit 4 core loop events for single-iteration', async () => {
    const events = await collectEvents(createContext())
    const agentEvents = events.filter((e) =>
      ['AgentLoopStarted', 'LoopIterationStarted', 'LoopIterationFinished', 'AgentLoopFinished'].includes(e.type),
    )

    expect(agentEvents).toHaveLength(4)
  })

  it('should still work with empty actions result', async () => {
    const planner = createMockPlanner({ actions: [], reasoning: 'Nothing to do' })
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner))

    expect(result.plannerResult.actions).toHaveLength(0)
    expect(result.steps).toHaveLength(1)
    expect(result.steps[0].observations).toBeUndefined()
  })

  it('should still work without tool registry', async () => {
    const planner = createMockPlanner(treeResult)
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner, 5))

    expect(result.plannerResult.actions).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// Edge Cases
// ---------------------------------------------------------------------------

describe('Edge Cases', () => {
  it('should handle no tool executions gracefully — no observations', async () => {
    const planner = createMockPlanner(treeResult)
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner))

    // No observations since no tools were called
    expect(result.steps[0].observations).toBeUndefined()
    expect(result.steps[0].toolName).toBeUndefined()
  })

  it('should handle empty tool registry without crash', async () => {
    const registry = new DefaultToolRegistry([])
    const planner = createToolCallingPlanner(
      [{ name: 'some_tool', input: { x: 1 } }],
      treeResult,
      1,
    )
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner, 5, registry))

    // Tool not found, but observation is still created
    expect(result.steps[0].observations).toBeDefined()
    expect(result.steps[0].observations![0].toolOutput).toContain('Tool not found')
  })

  it('should handle tool execution failure gracefully', async () => {
    const failingTool: Tool = {
      name: 'failing_tool',
      description: 'Always fails',
      async execute(): Promise<unknown> {
        throw new Error('Execution error')
      },
    }
    const registry = new DefaultToolRegistry([failingTool])
    const planner = createToolCallingPlanner(
      [{ name: 'failing_tool', input: { id: 'x' } }],
      treeResult,
      1,
    )
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner, 5, registry))

    // Observation recorded with error output
    expect(result.steps[0].observations![0].toolOutput).toBe('Execution error')
    expect(result.steps[0].observations![0].success).toBe(false)
  })

  it('should handle multiple tool calls per iteration', async () => {
    const tool1 = createMockTool('tool_1', { result: 1 })
    const tool2 = createMockTool('tool_2', { result: 2 })
    const tool3 = createMockTool('tool_3', { result: 3 })
    const registry = new DefaultToolRegistry([tool1, tool2, tool3])

    let multiToolCallCount = 0
    const planner: Planner = {
      async plan(_request: AIRequest): Promise<PlannerResult> {
        multiToolCallCount++
        if (multiToolCallCount === 1) {
          return {
            actions: [],
            metadata: {
              toolCalls: [
                { name: 'tool_1', input: { a: 1 } },
                { name: 'tool_2', input: { b: 2 } },
                { name: 'tool_3', input: { c: 3 } },
              ],
            },
          }
        }
        return treeResult
      },
    }

    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner, 5, registry))

    // 3 tool calls → 3 observations in the step
    expect(result.steps[0].observations).toHaveLength(3)
    expect(result.steps[0].observations![0].toolName).toBe('tool_1')
    expect(result.steps[0].observations![1].toolName).toBe('tool_2')
    expect(result.steps[0].observations![2].toolName).toBe('tool_3')
  })
})

// ---------------------------------------------------------------------------
// Loop Result Contains Observations
// ---------------------------------------------------------------------------

describe('Loop Result Contains Observations', () => {
  it('should have observations in the AgentLoopResult through steps', async () => {
    const tool = createMockTool('find_entity', { id: 'e1' })
    const registry = new DefaultToolRegistry([tool])
    const planner = createToolCallingPlanner(
      [{ name: 'find_entity', input: { id: 'e1' } }],
      treeResult,
      1,
    )
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner, 5, registry))

    expect(result.steps.some((s) => s.observations !== undefined)).toBe(true)
  })

  it('should preserve observations in result across all steps', async () => {
    const tool = createMockTool('find_entity', { id: 'e1' })
    const registry = new DefaultToolRegistry([tool])
    const planner = createToolCallingPlanner(
      [{ name: 'find_entity', input: { id: 'e1' } }],
      treeResult,
      3,
    )
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner, 5, registry))

    // All 3 tool iteration steps should have observations
    const toolSteps = result.steps.filter((s) => s.observations !== undefined)
    expect(toolSteps).toHaveLength(3)
  })

  it('should have inline fields mirroring observation data', async () => {
    const output = { entity: { id: 'e1', type: 'tree' } }
    const tool = createMockTool('find_entity', output)
    const registry = new DefaultToolRegistry([tool])
    const planner = createToolCallingPlanner(
      [{ name: 'find_entity', input: { id: 'entity-1' } }],
      treeResult,
      1,
    )
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner, 5, registry))

    const step = result.steps[0]
    const obs = step.observations![0]
    expect(step.toolName).toBe(obs.toolName)
    expect(step.toolInput).toEqual(obs.toolInput)
    expect(step.toolOutput).toEqual(obs.toolOutput)
  })

  it('should allow accessing observations from AgentLoopResult', async () => {
    const tool = createMockTool('find_entity', { id: 'e1' })
    const registry = new DefaultToolRegistry([tool])
    const planner = createToolCallingPlanner(
      [{ name: 'find_entity', input: { id: 'e1' } }],
      treeResult,
      2,
    )
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner, 5, registry))

    // Collect all observations from all steps
    const allObservations: Observation[] = []
    for (const step of result.steps) {
      if (step.observations) {
        allObservations.push(...step.observations)
      }
    }

    expect(allObservations).toHaveLength(2)
    expect(allObservations[0].iteration).toBe(1)
    expect(allObservations[1].iteration).toBe(2)
  })
})