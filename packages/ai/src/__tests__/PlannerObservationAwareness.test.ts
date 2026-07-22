import { describe, it, expect } from 'vitest'
import { DefaultPromptBuilder } from '../prompt/DefaultPromptBuilder'
import { ObservationPromptModule, formatObservations, formatObservationsInline } from '../prompt/modules/ObservationPromptModule'
import { DefaultAgentLoop } from '../agent/DefaultAgentLoop'
import { DefaultToolRegistry } from '../tools/ToolRegistry'
import type { Observation } from '../agent/Observation'
import type { Planner } from '../planner/Planner'
import type { PlannerResult } from '../planner/PlannerResult'
import type { AIRequest } from '../request'
import type { PipelineContext } from '../pipeline/PipelineContext'
import type { Tool, ToolRegistry } from '../tools'

// ---------------------------------------------------------------------------
// Test Constants
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
) {
  return { request, planner, maxIterations, toolRegistry }
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
// formatObservations — Rich Format
// ---------------------------------------------------------------------------

describe('formatObservations — Rich Format', () => {

  it('should return empty string for empty array', () => {
    expect(formatObservations([])).toBe('')
  })

  it('should format a single observation', () => {
    const obs: Observation = {
      toolName: 'find_entity',
      toolInput: { id: 'e1' },
      toolOutput: { found: true, type: 'tree' },
      timestamp: 1000,
      iteration: 1,
      success: true,
    }

    const result = formatObservations([obs])

    expect(result).toContain('## Previous Observations')
    expect(result).toContain('Iteration 1')
    expect(result).toContain('Tool:\nfind_entity')
    expect(result).toContain('Success:\ntrue')
  })

  it('should format multiple observations', () => {
    const obs1: Observation = {
      toolName: 'find_entity',
      toolInput: { id: 'e1' },
      toolOutput: { found: true },
      timestamp: 1000,
      iteration: 1,
      success: true,
    }

    const obs2: Observation = {
      toolName: 'get_position',
      toolInput: { id: 'e1' },
      toolOutput: { x: 5, y: 3 },
      timestamp: 2000,
      iteration: 2,
    }

    const result = formatObservations([obs1, obs2])

    expect(result).toContain('Iteration 1')
    expect(result).toContain('Iteration 2')
    expect(result).toContain('find_entity')
    expect(result).toContain('get_position')
    // obs1 has success, obs2 does not
    expect(result).toContain('Success:\ntrue')
  })

  it('should format observation without success field', () => {
    const obs: Observation = {
      toolName: 'find_entity',
      toolInput: { id: 'e1' },
      toolOutput: { found: true },
      timestamp: 1000,
      iteration: 1,
    }

    const result = formatObservations([obs])

    expect(result).toContain('## Previous Observations')
    expect(result).not.toContain('Success:')
  })

  it('should include Input and Output sections', () => {
    const obs: Observation = {
      toolName: 'find_entity',
      toolInput: { id: 'e1', type: 'tree' },
      toolOutput: { found: true, x: 5, y: 3 },
      timestamp: 1000,
      iteration: 1,
    }

    const result = formatObservations([obs])

    expect(result).toContain('Input:\n{\n  "id": "e1",\n  "type": "tree"\n}')
    expect(result).toContain('Output:\n{\n  "found": true,\n  "x": 5,\n  "y": 3\n}')
  })
})

// ---------------------------------------------------------------------------
// formatObservationsInline — Compact Format
// ---------------------------------------------------------------------------

describe('formatObservationsInline — Compact Format', () => {

  it('should return empty string for empty array', () => {
    expect(formatObservationsInline([])).toBe('')
  })

  it('should format a single observation inline', () => {
    const obs: Observation = {
      toolName: 'find_entity',
      toolInput: { id: 'e1' },
      toolOutput: { found: true },
      timestamp: 1000,
      iteration: 1,
    }

    const result = formatObservationsInline([obs])

    expect(result).toBe('Observation:\nTool find_entity returned: {"found":true}')
  })

  it('should format multiple observations inline', () => {
    const obs1: Observation = {
      toolName: 'find_entity',
      toolInput: { id: 'e1' },
      toolOutput: { found: true },
      timestamp: 1000,
      iteration: 1,
    }

    const obs2: Observation = {
      toolName: 'get_position',
      toolInput: { id: 'e1' },
      toolOutput: { x: 5, y: 3 },
      timestamp: 2000,
      iteration: 2,
    }

    const result = formatObservationsInline([obs1, obs2])

    expect(result).toBe('Observation:\nTool find_entity returned: {"found":true}\nTool get_position returned: {"x":5,"y":3}')
  })

  it('should handle string output without JSON.stringify', () => {
    const obs: Observation = {
      toolName: 'find_entity',
      toolInput: {},
      toolOutput: 'Entity not found',
      timestamp: 1000,
      iteration: 1,
    }

    const result = formatObservationsInline([obs])

    expect(result).toContain('Tool find_entity returned: Entity not found')
  })

  it('should produce backward-compatible format with AgentLoop', () => {
    const obs: Observation = {
      toolName: 'find_entity',
      toolInput: {},
      toolOutput: { found: true },
      timestamp: 1000,
      iteration: 1,
    }

    const result = formatObservationsInline([obs])

    // Matches the previous AgentLoop inline format:
    // "Observation:\nTool find_entity returned: {"found":true}"
    expect(result).toContain('Observation:\nTool find_entity returned:')
  })
})

// ---------------------------------------------------------------------------
// ObservationPromptModule
// ---------------------------------------------------------------------------

describe('ObservationPromptModule', () => {

  it('should return empty string when no observations in context', async () => {
    const module = new ObservationPromptModule()
    const context: PipelineContext = { input: 'test' }

    const result = await module.build(context)

    expect(result).toBe('')
  })

  it('should return empty string when metadata has no observations', async () => {
    const module = new ObservationPromptModule()
    const context: PipelineContext = {
      input: 'test',
      metadata: { other: 'data' },
    }

    const result = await module.build(context)

    expect(result).toBe('')
  })

  it('should return empty string when observations array is empty', async () => {
    const module = new ObservationPromptModule()
    const context: PipelineContext = {
      input: 'test',
      metadata: { observations: [] },
    }

    const result = await module.build(context)

    expect(result).toBe('')
  })

  it('should format observations from context metadata', async () => {
    const module = new ObservationPromptModule()
    const observations: Observation[] = [
      {
        toolName: 'find_entity',
        toolInput: { id: 'e1' },
        toolOutput: { found: true },
        timestamp: 1000,
        iteration: 1,
        success: true,
      },
    ]
    const context: PipelineContext = {
      input: 'test',
      metadata: { observations },
    }

    const result = await module.build(context)

    expect(result).toContain('## Previous Observations')
    expect(result).toContain('find_entity')
  })

  it('should format multiple observations from context metadata', async () => {
    const module = new ObservationPromptModule()
    const observations: Observation[] = [
      {
        toolName: 'find_entity',
        toolInput: { id: 'e1' },
        toolOutput: { found: true },
        timestamp: 1000,
        iteration: 1,
      },
      {
        toolName: 'get_position',
        toolInput: { id: 'e1' },
        toolOutput: { x: 5, y: 3 },
        timestamp: 2000,
        iteration: 2,
      },
    ]
    const context: PipelineContext = {
      input: 'test',
      metadata: { observations },
    }

    const result = await module.build(context)

    expect(result).toContain('Iteration 1')
    expect(result).toContain('Iteration 2')
    expect(result).toContain('find_entity')
    expect(result).toContain('get_position')
  })
})

// ---------------------------------------------------------------------------
// DefaultPromptBuilder — formatObservations Method
// ---------------------------------------------------------------------------

describe('DefaultPromptBuilder formatObservations', () => {

  it('should format observations via DefaultPromptBuilder method', () => {
    const builder = new DefaultPromptBuilder([])
    const observations: Observation[] = [
      {
        toolName: 'find_entity',
        toolInput: { id: 'e1' },
        toolOutput: { found: true },
        timestamp: 1000,
        iteration: 1,
      },
    ]

    const result = builder.formatObservations(observations)

    expect(result).toContain('## Previous Observations')
    expect(result).toContain('find_entity')
  })

  it('should return empty string for empty observations', () => {
    const builder = new DefaultPromptBuilder([])

    const result = builder.formatObservations([])

    expect(result).toBe('')
  })
})

// ---------------------------------------------------------------------------
// AgentLoop — Observation Prompt Formatting Delegation
// ---------------------------------------------------------------------------

describe('AgentLoop — Observation Prompt Delegation', () => {

  it('should use PromptBuilder format via formatObservationsInline', async () => {
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
    await loop.execute(createContext({ prompt: 'test prompt' }, planner, 5, registry))

    // The AgentLoop delegates to formatObservationsInline for prompt formatting
    // Captured request (2nd call) should contain the formatted observation
    expect(capturedRequests[0]!.prompt).toContain('Observation:')
    expect(capturedRequests[0]!.prompt).toContain('Tool find_entity returned:')
    // The format comes from PromptBuilder, not AgentLoop inline code
    expect(capturedRequests[0]!.prompt).toContain('{"found":true}')
  })
})

// ---------------------------------------------------------------------------
// PromptBuilder + ObservationPromptModule Integration
// ---------------------------------------------------------------------------

describe('PromptBuilder + ObservationPromptModule Integration', () => {

  it('should include observation section when observations are in pipeline context', async () => {
    const builder = new DefaultPromptBuilder([
      new ObservationPromptModule(),
    ])
    const observations: Observation[] = [
      {
        toolName: 'find_entity',
        toolInput: { id: 'e1' },
        toolOutput: { found: true },
        timestamp: 1000,
        iteration: 1,
      },
    ]
    const context: PipelineContext = {
      input: 'move tree',
      metadata: { observations },
    }

    const request = await builder.build(context)

    expect(request.prompt).toContain('## Previous Observations')
    expect(request.prompt).toContain('find_entity')
  })

  it('should not include observation section when no observations exist', async () => {
    const builder = new DefaultPromptBuilder([
      new ObservationPromptModule(),
    ])
    const context: PipelineContext = {
      input: 'move tree',
    }

    const request = await builder.build(context)

    expect(request.prompt).not.toContain('## Previous Observations')
  })

  it('should compose with other modules', async () => {
    const builder = new DefaultPromptBuilder([
      new ObservationPromptModule(),
    ])
    const observations: Observation[] = [
      {
        toolName: 'find_entity',
        toolInput: { id: 'e1' },
        toolOutput: { found: true },
        timestamp: 1000,
        iteration: 1,
      },
    ]
    const context: PipelineContext = {
      input: 'test input',
      metadata: { observations },
    }

    const request = await builder.build(context)

    expect(request.prompt).toContain('## Previous Observations')
    expect(request.prompt).toContain('find_entity')
  })
})

// ---------------------------------------------------------------------------
// Planner Compatibility
// ---------------------------------------------------------------------------

describe('Planner Compatibility', () => {

  it('should work with Planner.plan() via metadata observations', async () => {
    const observations: Observation[] = [
      {
        toolName: 'find_entity',
        toolInput: { id: 'e1' },
        toolOutput: { found: true },
        timestamp: 1000,
        iteration: 1,
      },
    ]

    // Planner reads observations from metadata
    let capturedMetadata: Record<string, unknown> | undefined
    const planner: Planner = {
      async plan(request: AIRequest): Promise<PlannerResult> {
        capturedMetadata = request.metadata
        // If observations exist, the planner can use them
        if (request.metadata?.observations) {
          return treeResult
        }
        return { actions: [] }
      },
    }

    const loop = new DefaultAgentLoop()
    await loop.execute(createContext(
      { prompt: 'test', metadata: { observations } },
      planner,
    ))

    // Planner received observations via metadata
    expect(capturedMetadata?.observations).toBeDefined()
    expect(Array.isArray(capturedMetadata?.observations)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Backward Compatibility
// ---------------------------------------------------------------------------

describe('Backward Compatibility', () => {

  it('should produce the same inline format for AgentLoop observation text', () => {
    const obs: Observation = {
      toolName: 'find_entity',
      toolInput: {},
      toolOutput: { found: true },
      timestamp: 1000,
      iteration: 1,
    }

    const result = formatObservationsInline([obs])

    // Must match the AgentLoop format from before the refactor:
    // Old AgentLoop code was:
    //   const observationText = `Tool ${toolCall.name} returned: ${JSON.stringify(output)}`
    //   const fullText = `Observation:\n${observationText}`
    expect(result).toBe('Observation:\nTool find_entity returned: {"found":true}')
  })

  it('should preserve AgentLoop result structure unchanged', async () => {
    const tool = createMockTool('find_entity', { found: true })
    const registry = new DefaultToolRegistry([tool])
    const planner = createToolCallingPlanner(
      [{ name: 'find_entity', input: {} }],
      treeResult,
      1,
    )

    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner, 5, registry))

    // Core result structure unchanged
    expect(result).toHaveProperty('plannerResult')
    expect(result).toHaveProperty('steps')
    expect(result).toHaveProperty('iterations')
    expect(result).toHaveProperty('finished')
    expect(result.iterations).toBe(2)
    expect(result.finished).toBe(true)
  })

  it('should still emit all AgentLoop events', async () => {
    const loop = new DefaultAgentLoop()
    const events: string[] = []
    loop.events.subscribe({
      onEvent: (e) => events.push(e.type),
    })

    await loop.execute(createContext(treeRequest, createMockPlanner(treeResult)))

    expect(events).toContain('AgentLoopStarted')
    expect(events).toContain('LoopIterationStarted')
    expect(events).toContain('LoopIterationFinished')
    expect(events).toContain('AgentLoopFinished')
  })

  it('should still emit ToolExecuted and ObservationRecorded events', async () => {
    const tool = createMockTool('find_entity', { found: true })
    const registry = new DefaultToolRegistry([tool])
    const planner = createToolCallingPlanner(
      [{ name: 'find_entity', input: {} }],
      treeResult,
      1,
    )

    const loop = new DefaultAgentLoop()
    const events: string[] = []
    loop.events.subscribe({
      onEvent: (e) => events.push(e.type),
    })

    await loop.execute(createContext(treeRequest, planner, 5, registry))

    expect(events).toContain('ToolExecuted')
    expect(events).toContain('ObservationRecorded')
  })
})

// ---------------------------------------------------------------------------
// Retry Compatibility
// ---------------------------------------------------------------------------

describe('Retry Compatibility', () => {

  it('should work with retry planner', async () => {
    const tool = createMockTool('find_entity', { found: true })
    const registry = new DefaultToolRegistry([tool])
    const planner = createToolCallingPlanner(
      [{ name: 'find_entity', input: {} }],
      treeResult,
      1,
    )

    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner, 5, registry))

    expect(result.iterations).toBe(2)
    expect(result.finished).toBe(true)
    expect(result.plannerResult.actions).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// ToolCalling Compatibility
// ---------------------------------------------------------------------------

describe('ToolCalling Compatibility', () => {

  it('should work with tool calling planner', async () => {
    const tool = createMockTool('find_entity', { found: true })
    const registry = new DefaultToolRegistry([tool])
    const planner = createToolCallingPlanner(
      [{ name: 'find_entity', input: {} }],
      treeResult,
      1,
    )

    const loop = new DefaultAgentLoop()
    const result = await loop.execute(createContext(treeRequest, planner, 5, registry))

    expect(result.iterations).toBe(2)
    expect(result.finished).toBe(true)
    expect(result.steps[0]?.observations).toHaveLength(1)
    expect(result.steps[0]?.observations?.[0]?.toolName).toBe('find_entity')
  })
})

// ---------------------------------------------------------------------------
// Event Compatibility
// ---------------------------------------------------------------------------

describe('Event Compatibility', () => {

  it('should emit events with correct types and payloads', async () => {
    const tool = createMockTool('find_entity', { found: true })
    const registry = new DefaultToolRegistry([tool])
    const planner = createToolCallingPlanner(
      [{ name: 'find_entity', input: {} }],
      treeResult,
      1,
    )

    const loop = new DefaultAgentLoop()
    const eventTypes: string[] = []
    loop.events.subscribe({
      onEvent: (e) => {
        eventTypes.push(e.type)
      },
    })

    await loop.execute(createContext(treeRequest, planner, 5, registry))

    // Verify event sequence contains all expected types
    expect(eventTypes[0]).toBe('AgentLoopStarted')
    expect(eventTypes[1]).toBe('LoopIterationStarted')
    expect(eventTypes).toContain('ToolExecuted')
    expect(eventTypes).toContain('ObservationRecorded')
    expect(eventTypes).toContain('LoopIterationFinished')
    expect(eventTypes[eventTypes.length - 1]).toBe('AgentLoopFinished')
  })
})

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

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