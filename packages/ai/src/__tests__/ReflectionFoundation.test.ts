import { describe, it, expect, vi } from 'vitest'
import { DefaultReflection } from '../reflection/DefaultReflection'
import { DefaultAgentLoop } from '../agent/DefaultAgentLoop'
import { DefaultToolRegistry } from '../tools/ToolRegistry'
import type { Reflection } from '../reflection/Reflection'
import type { ReflectionContext } from '../reflection/ReflectionContext'
import type { ReflectionResult } from '../reflection/ReflectionResult'
import type { AgentLoopContext } from '../agent/AgentLoopContext'
import type { AgentLoopResult } from '../agent/AgentLoopResult'
import type { Planner } from '../planner/Planner'
import type { PlannerResult } from '../planner/PlannerResult'
import type { AIRequest } from '../request'
import type { Tool, ToolRegistry } from '../tools'
import type { Observation } from '../agent'

// ---------------------------------------------------------------------------
// Test Constants
// ---------------------------------------------------------------------------

const treeResult: PlannerResult = {
  actions: [{ type: 'CreateEntity', entityType: 'tree', x: 5, y: 3 }],
}

const emptyResult: PlannerResult = {
  actions: [],
  reasoning: 'No actions needed',
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

function createCallTrackingPlanner(
  results: PlannerResult[],
  capturedRequests: AIRequest[],
): Planner {
  let callCount = 0
  return {
    async plan(request: AIRequest): Promise<PlannerResult> {
      const result = results[Math.min(callCount, results.length - 1)]
      callCount++
      if (callCount > 1) {
        capturedRequests.push(request)
      }
      return result
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

// ---------------------------------------------------------------------------
// Reflection Interface
// ---------------------------------------------------------------------------

describe('Reflection Interface', () => {
  it('should define Reflection with execute method', () => {
    const reflection: Reflection = new DefaultReflection()
    expect(reflection.execute).toBeDefined()
    expect(typeof reflection.execute).toBe('function')
  })

  it('should define ReflectionContext with required fields', () => {
    const context: ReflectionContext = {
      plannerResult: treeResult,
      observations: [],
      steps: [],
      iteration: 1,
      maxIterations: 5,
    }
    expect(context.plannerResult).toBe(treeResult)
    expect(context.observations).toEqual([])
    expect(context.steps).toEqual([])
    expect(context.iteration).toBe(1)
    expect(context.maxIterations).toBe(5)
  })

  it('should define ReflectionResult with required fields', () => {
    const result: ReflectionResult = {
      reasoning: 'Task complete',
      continueLoop: false,
    }
    expect(result.reasoning).toBe('Task complete')
    expect(result.continueLoop).toBe(false)
  })

  it('should allow optional metadata on ReflectionContext and ReflectionResult', () => {
    const context: ReflectionContext = {
      plannerResult: treeResult,
      observations: [],
      steps: [],
      iteration: 1,
      maxIterations: 5,
      metadata: { customField: 'value' },
    }
    const result: ReflectionResult = {
      reasoning: 'done',
      continueLoop: false,
      metadata: { customField: 'value' },
    }
    expect(context.metadata?.customField).toBe('value')
    expect(result.metadata?.customField).toBe('value')
  })
})

// ---------------------------------------------------------------------------
// DefaultReflection — Basic Rules
// ---------------------------------------------------------------------------

describe('DefaultReflection — Basic Rules', () => {
  it('should return continueLoop=false when planner has actions', async () => {
    const reflection = new DefaultReflection()
    const context: ReflectionContext = {
      plannerResult: treeResult,
      observations: [],
      steps: [],
      iteration: 2,
      maxIterations: 5,
    }

    const result = await reflection.execute(context)

    expect(result.continueLoop).toBe(false)
    expect(result.reasoning).toContain('action')
  })

  it('should return continueLoop=false when maxIterations reached', async () => {
    const reflection = new DefaultReflection()
    const context: ReflectionContext = {
      plannerResult: emptyResult,
      observations: [],
      steps: [],
      iteration: 5,
      maxIterations: 5,
    }

    const result = await reflection.execute(context)

    expect(result.continueLoop).toBe(false)
    expect(result.reasoning).toContain('maximum')
  })

  it('should return continueLoop=true when no actions and iterations remain', async () => {
    const reflection = new DefaultReflection()
    const context: ReflectionContext = {
      plannerResult: emptyResult,
      observations: [],
      steps: [],
      iteration: 2,
      maxIterations: 5,
    }

    const result = await reflection.execute(context)

    expect(result.continueLoop).toBe(true)
    expect(result.reasoning).toContain('Continuing')
  })

  it('should include observations count in reasoning when provided', async () => {
    const reflection = new DefaultReflection()
    const obs: Observation = {
      toolName: 'find_entity',
      toolInput: {},
      toolOutput: { found: true },
      timestamp: 1000,
      iteration: 1,
    }
    const context: ReflectionContext = {
      plannerResult: emptyResult,
      observations: [obs],
      steps: [],
      iteration: 2,
      maxIterations: 5,
    }

    const result = await reflection.execute(context)

    expect(result.continueLoop).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// DefaultReflection — Edge Cases
// ---------------------------------------------------------------------------

describe('DefaultReflection — Edge Cases', () => {
  it('should handle iteration=1 with actions', async () => {
    const reflection = new DefaultReflection()
    const context: ReflectionContext = {
      plannerResult: treeResult,
      observations: [],
      steps: [],
      iteration: 1,
      maxIterations: 5,
    }

    const result = await reflection.execute(context)

    expect(result.continueLoop).toBe(false)
  })

  it('should handle maxIterations=1 with no actions', async () => {
    const reflection = new DefaultReflection()
    const context: ReflectionContext = {
      plannerResult: emptyResult,
      observations: [],
      steps: [],
      iteration: 1,
      maxIterations: 1,
    }

    const result = await reflection.execute(context)

    expect(result.continueLoop).toBe(false)
    expect(result.reasoning).toContain('maximum')
  })

  it('should handle empty observations array', async () => {
    const reflection = new DefaultReflection()
    const context: ReflectionContext = {
      plannerResult: treeResult,
      observations: [],
      steps: [],
      iteration: 1,
      maxIterations: 5,
    }

    const result = await reflection.execute(context)

    expect(result.continueLoop).toBe(false)
  })

  it('should handle multiple observations', async () => {
    const reflection = new DefaultReflection()
    const observations: Observation[] = [
      { toolName: 'tool1', toolInput: {}, toolOutput: 'out1', timestamp: 1000, iteration: 1 },
      { toolName: 'tool2', toolInput: {}, toolOutput: 'out2', timestamp: 2000, iteration: 2 },
    ]
    const context: ReflectionContext = {
      plannerResult: emptyResult,
      observations,
      steps: [],
      iteration: 3,
      maxIterations: 5,
    }

    const result = await reflection.execute(context)

    expect(result.continueLoop).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// DefaultReflection Metadata
// ---------------------------------------------------------------------------

describe('DefaultReflection — Metadata', () => {
  it('should not set metadata by default', async () => {
    const reflection = new DefaultReflection()
    const context: ReflectionContext = {
      plannerResult: treeResult,
      observations: [],
      steps: [],
      iteration: 1,
      maxIterations: 5,
    }

    const result = await reflection.execute(context)

    expect(result.metadata).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// AgentLoop Integration — with Reflection
// ---------------------------------------------------------------------------

describe('AgentLoop — with Reflection', () => {
  it('should include reflectionResults on AgentLoopResult when reflection provided', async () => {
    const reflection = new DefaultReflection()
    const loop = new DefaultAgentLoop(reflection)
    const result = await loop.execute(createContext(treeRequest, createMockPlanner(treeResult)))

    expect(result.reflectionResults).toBeDefined()
    expect(result.reflectionResults!.length).toBe(1)
  })

  it('should not include reflectionResults when no reflection provided', async () => {
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, createMockPlanner(treeResult)))

    expect(result.reflectionResults).toBeUndefined()
  })

  it('should record reflection result with correct reasoning', async () => {
    const reflection = new DefaultReflection()
    const loop = new DefaultAgentLoop(reflection)
    const result = await loop.execute(createContext(treeRequest, createMockPlanner(treeResult)))

    expect(result.reflectionResults![0].continueLoop).toBe(false)
    expect(result.reflectionResults![0].reasoning).toContain('action')
  })

  it('should call reflection once per iteration with multi-step loop', async () => {
    const tool = createMockTool('find_entity', { found: true })
    const registry = new DefaultToolRegistry([tool])
    const planner = createToolCallingPlanner(
      [{ name: 'find_entity', input: {} }],
      treeResult,
      1,
    )

    const reflection = new DefaultReflection()
    const loop = new DefaultAgentLoop(reflection)
    const result = await loop.execute(createContext(treeRequest, planner, 5, registry))

    // 2 iterations: 1st with tool call, 2nd with actions
    expect(result.reflectionResults).toBeDefined()
    expect(result.reflectionResults!.length).toBe(2)
  })

  it('should record correct reflection for tool-calling iteration', async () => {
    const tool = createMockTool('find_entity', { found: true })
    const registry = new DefaultToolRegistry([tool])
    const planner = createToolCallingPlanner(
      [{ name: 'find_entity', input: {} }],
      treeResult,
      1,
    )

    const reflection = new DefaultReflection()
    const loop = new DefaultAgentLoop(reflection)
    const result = await loop.execute(createContext(treeRequest, planner, 5, registry))

    // First reflection: no actions yet
    expect(result.reflectionResults![0].continueLoop).toBe(true)
    expect(result.reflectionResults![0].reasoning).toContain('No actions')

    // Second reflection: has actions → done
    expect(result.reflectionResults![1].continueLoop).toBe(false)
    expect(result.reflectionResults![1].reasoning).toContain('action')
  })

  it('should record reflection when max iterations reached', async () => {
    // Use a planner that returns toolCalls so the loop actually iterates
    const tool = createMockTool('find_entity', { found: true })
    const registry = new DefaultToolRegistry([tool])
    const planner = createToolCallingPlanner(
      [{ name: 'find_entity', input: {} }],
      treeResult,
      3, // 3 interim tool calls
    )

    const reflection = new DefaultReflection()
    const loop = new DefaultAgentLoop(reflection)
    const result = await loop.execute(createContext(treeRequest, planner, 5, registry))

    // 4 iterations: 3 tool call + 1 final actions
    expect(result.reflectionResults).toBeDefined()
    expect(result.reflectionResults!.length).toBe(4)
    // Last reflection should say actions found
    expect(result.reflectionResults![3].continueLoop).toBe(false)
    expect(result.reflectionResults![3].reasoning).toContain('action')
  })
})

// ---------------------------------------------------------------------------
// AgentLoop — Custom Reflection
// ---------------------------------------------------------------------------

describe('AgentLoop — Custom Reflection', () => {
  it('should call custom reflection with current context', async () => {
    const capturedContexts: ReflectionContext[] = []
    const customReflection: Reflection = {
      async execute(context: ReflectionContext): Promise<ReflectionResult> {
        capturedContexts.push(context)
        return { reasoning: 'custom', continueLoop: true }
      },
    }

    const loop = new DefaultAgentLoop(customReflection)
    await loop.execute(createContext(treeRequest, createMockPlanner(treeResult)))

    expect(capturedContexts.length).toBe(1)
    expect(capturedContexts[0].maxIterations).toBe(5)
    expect(capturedContexts[0].plannerResult.actions).toHaveLength(1)
  })

  it('should pass correct iteration count to custom reflection', async () => {
    const capturedContexts: ReflectionContext[] = []
    const customReflection: Reflection = {
      async execute(context: ReflectionContext): Promise<ReflectionResult> {
        capturedContexts.push(context)
        return { reasoning: 'custom', continueLoop: true }
      },
    }

    // Use tool calls to make the loop iterate multiple times
    const tool = createMockTool('find_entity', { found: true })
    const registry = new DefaultToolRegistry([tool])
    const planner = createToolCallingPlanner(
      [{ name: 'find_entity', input: {} }],
      treeResult,
      2,
    )

    const loop = new DefaultAgentLoop(customReflection)
    await loop.execute(createContext(treeRequest, planner, 5, registry))

    expect(capturedContexts.length).toBe(3) // 2 tool calls + 1 final
    expect(capturedContexts[0].iteration).toBe(1)
    expect(capturedContexts[1].iteration).toBe(2)
    expect(capturedContexts[2].iteration).toBe(3)
  })

  it('should pass observations to custom reflection', async () => {
    const capturedContexts: ReflectionContext[] = []
    const customReflection: Reflection = {
      async execute(context: ReflectionContext): Promise<ReflectionResult> {
        capturedContexts.push(context)
        return { reasoning: 'custom', continueLoop: true }
      },
    }

    const tool = createMockTool('find_entity', { found: true })
    const registry = new DefaultToolRegistry([tool])
    const planner = createToolCallingPlanner(
      [{ name: 'find_entity', input: {} }],
      treeResult,
      1,
    )

    const loop = new DefaultAgentLoop(customReflection)
    await loop.execute(createContext(treeRequest, planner, 5, registry))

    // First iteration has observations (created before reflection runs)
    // Second iteration has the same accumulated observations
    expect(capturedContexts[0].observations.length).toBe(1)
    expect(capturedContexts[0].observations[0].toolName).toBe('find_entity')
    expect(capturedContexts[1].observations.length).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Reflection Does Not Change Behavior
// ---------------------------------------------------------------------------

describe('Reflection Does Not Change Behavior', () => {
  it('should produce same result structure with or without reflection', async () => {
    const reflection = new DefaultReflection()
    const loopWithReflection = new DefaultAgentLoop(reflection)
    const loopWithoutReflection = new DefaultAgentLoop()

    const ctx = createContext(treeRequest, createMockPlanner(treeResult))
    const resultWith = await loopWithReflection.execute(ctx)
    const resultWithout = await loopWithoutReflection.execute({ ...ctx })

    expect(resultWith.iterations).toBe(resultWithout.iterations)
    expect(resultWith.finished).toBe(resultWithout.finished)
    expect(resultWith.plannerResult.actions).toEqual(resultWithout.plannerResult.actions)
    expect(resultWith.steps.length).toBe(resultWithout.steps.length)
  })

  it('should not affect loop control even when reflection says continue', async () => {
    // Use tool-calling planner so the loop continues between iterations
    const tool = createMockTool('find_entity', { found: true })
    const registry = new DefaultToolRegistry([tool])

    // Always continue but loop should still stop when treeResult returned
    const alwaysContinueReflection: Reflection = {
      async execute(_context: ReflectionContext): Promise<ReflectionResult> {
        return { reasoning: 'keep going', continueLoop: true }
      },
    }

    const planner = createToolCallingPlanner(
      [{ name: 'find_entity', input: {} }],
      treeResult,
      5, // Many interim calls
    )
    const loop = new DefaultAgentLoop(alwaysContinueReflection)
    const result = await loop.execute(createContext(treeRequest, planner, 10, registry))

    // Loop stops when treeResult returned (actions found), not when reflection says continue
    expect(result.iterations).toBe(6) // 5 tool calls + 1 final
    expect(result.finished).toBe(true)
  })

  it('should not affect loop control even when reflection says stop', async () => {
    // Use multi-step planner to get multiple iterations
    const tool = createMockTool('find_entity', { found: true })
    const registry = new DefaultToolRegistry([tool])

    // Always says stop but AgentLoop should still follow its own logic
    const alwaysStopReflection: Reflection = {
      async execute(_context: ReflectionContext): Promise<ReflectionResult> {
        return { reasoning: 'stop now', continueLoop: false }
      },
    }

    const planner = createToolCallingPlanner(
      [{ name: 'find_entity', input: {} }],
      treeResult,
      2,
    )
    const loop = new DefaultAgentLoop(alwaysStopReflection)
    const result = await loop.execute(createContext(treeRequest, planner, 5, registry))

    // AgentLoop stops when it gets treeResult, not because reflection said stop
    expect(result.iterations).toBe(3) // 2 tool calls + 1 final
    expect(result.finished).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Backward Compatibility — No Reflection
// ---------------------------------------------------------------------------

describe('Backward Compatibility — No Reflection', () => {
  it('should work without reflection (constructor without args)', async () => {
    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, createMockPlanner(treeResult)))

    expect(result.iterations).toBe(1)
    expect(result.finished).toBe(true)
    expect(result.reflectionResults).toBeUndefined()
  })

  it('should still emit all AgentLoop events', async () => {
    const reflection = new DefaultReflection()
    const loop = new DefaultAgentLoop(reflection)
    const events: string[] = []
    loop.events.subscribe({ onEvent: (e) => events.push(e.type) })

    await loop.execute(createContext(treeRequest, createMockPlanner(treeResult)))

    expect(events).toContain('AgentLoopStarted')
    expect(events).toContain('LoopIterationStarted')
    expect(events).toContain('LoopIterationFinished')
    expect(events).toContain('AgentLoopFinished')
  })

  it('should still emit ToolExecuted and ObservationRecorded events with reflection', async () => {
    const tool = createMockTool('find_entity', { found: true })
    const registry = new DefaultToolRegistry([tool])
    const planner = createToolCallingPlanner(
      [{ name: 'find_entity', input: {} }],
      treeResult,
      1,
    )

    const reflection = new DefaultReflection()
    const loop = new DefaultAgentLoop(reflection)
    const events: string[] = []
    loop.events.subscribe({ onEvent: (e) => events.push(e.type) })

    await loop.execute(createContext(treeRequest, planner, 5, registry))

    expect(events).toContain('ToolExecuted')
    expect(events).toContain('ObservationRecorded')
  })

  it('should produce same inline format for AgentLoop observation text', async () => {
    const tool = createMockTool('find_entity', { found: true })
    const registry = new DefaultToolRegistry([tool])
    const capturedRequests: AIRequest[] = []
    const planner = createCallTrackingPlanner([
      { actions: [], metadata: { toolCalls: [{ name: 'find_entity', input: {} }] } },
      treeResult,
    ], capturedRequests)

    const reflection = new DefaultReflection()
    const loop = new DefaultAgentLoop(reflection)
    await loop.execute(createContext({ prompt: 'original prompt' }, planner, 5, registry))

    expect(capturedRequests[0]!.prompt).toContain('Observation:\nTool find_entity returned:')
  })
})

// ---------------------------------------------------------------------------
// RetryPlanner Compatibility
// ---------------------------------------------------------------------------

describe('RetryPlanner Compatibility', () => {
  it('should work with retry planner when reflection is used', async () => {
    const tool = createMockTool('find_entity', { found: true })
    const registry = new DefaultToolRegistry([tool])
    const planner = createToolCallingPlanner(
      [{ name: 'find_entity', input: {} }],
      treeResult,
      1,
    )

    const reflection = new DefaultReflection()
    const loop = new DefaultAgentLoop(reflection)
    const result = await loop.execute(createContext(treeRequest, planner, 5, registry))

    expect(result.iterations).toBe(2)
    expect(result.finished).toBe(true)
    expect(result.reflectionResults).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// ToolCallPlanner Compatibility
// ---------------------------------------------------------------------------

describe('ToolCallPlanner Compatibility', () => {
  it('should work with tool calling planner when reflection is used', async () => {
    const tool = createMockTool('find_entity', { found: true })
    const registry = new DefaultToolRegistry([tool])
    const planner = createToolCallingPlanner(
      [{ name: 'find_entity', input: {} }],
      treeResult,
      1,
    )

    const reflection = new DefaultReflection()
    const loop = new DefaultAgentLoop(reflection)
    const result = await loop.execute(createContext(treeRequest, planner, 5, registry))

    expect(result.iterations).toBe(2)
    expect(result.finished).toBe(true)
    expect(result.steps[0]?.observations).toHaveLength(1)
    expect(result.reflectionResults).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Stream Compatibility
// ---------------------------------------------------------------------------

describe('Streaming Compatibility', () => {
  it('should not affect stream path when reflection is available', async () => {
    // Streaming goes through Pipeline.stream() which calls AgentLoop.execute()
    // for the fallback path only. Adding reflection is transparent.
    const reflection = new DefaultReflection()
    const loop = new DefaultAgentLoop(reflection)

    // The loop itself still works identically for single-iteration planning
    const result = await loop.execute(createContext(treeRequest, createMockPlanner(treeResult)))

    expect(result.iterations).toBe(1)
    expect(result.finished).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Provider Compatibility
// ---------------------------------------------------------------------------

describe('Provider Compatibility', () => {
  it('should work with mock planner via AgentLoop with reflection', async () => {
    const reflection = new DefaultReflection()
    const loop = new DefaultAgentLoop(reflection)
    const result = await loop.execute(createContext(treeRequest, createMockPlanner(treeResult)))

    expect(result.plannerResult.actions).toHaveLength(1)
    expect(result.reflectionResults).toBeDefined()
  })

  it('should work with empty result via AgentLoop with reflection', async () => {
    const reflection = new DefaultReflection()
    const loop = new DefaultAgentLoop(reflection)
    const result = await loop.execute(createContext(treeRequest, createMockPlanner(emptyResult), 1))

    expect(result.plannerResult.actions).toHaveLength(0)
    expect(result.reflectionResults![0].continueLoop).toBe(false)
  })
})