import { describe, it, expect } from 'vitest'
import { DefaultPromptBuilder } from '../prompt/DefaultPromptBuilder'
import {
  ReflectionPromptModule,
  SystemPromptModule,
  UserInputModule,
  MemoryPromptModule,
  WorldStatePromptModule,
  ObservationPromptModule,
  formatReflectionResults,
} from '../prompt/modules'
import { DefaultReflection } from '../reflection/DefaultReflection'
import { DefaultAgentLoop } from '../agent/DefaultAgentLoop'
import { DefaultToolRegistry } from '../tools/ToolRegistry'
import { DefaultPipeline } from '../pipeline/DefaultPipeline'
import { MockPlanner, RetryPlanner, ToolCallPlanner } from '../planner'
import { DefaultMemory } from '../memory/DefaultMemory'
import { MockPlannerProvider, MockStreamingProvider } from '../provider'
import { DefaultAIConfiguration } from '../config'
import type { PipelineContext } from '../pipeline/PipelineContext'
import type { ReflectionResult } from '../reflection/ReflectionResult'
import type { AIRequest } from '../request'
import type { Planner } from '../planner/Planner'
import type { PlannerResult } from '../planner/PlannerResult'
import type { AgentLoopContext } from '../agent/AgentLoopContext'
import type { Tool, ToolRegistry } from '../tools'

// ---------------------------------------------------------------------------
// Test Data
// ---------------------------------------------------------------------------

const singleReflection: ReflectionResult[] = [
  { reasoning: 'Actions found — task complete', continueLoop: false },
]

const multiReflection: ReflectionResult[] = [
  { reasoning: 'No actions yet, continuing', continueLoop: true },
  { reasoning: 'Actions found — task complete', continueLoop: false },
]

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

function createAgentLoopContext(
  request: AIRequest = treeRequest,
  planner: Planner = createMockPlanner(),
  maxIterations = 5,
  toolRegistry?: ToolRegistry,
): AgentLoopContext {
  return { request, planner, maxIterations, toolRegistry }
}

// ---------------------------------------------------------------------------
// formatReflectionResults
// ---------------------------------------------------------------------------

describe('formatReflectionResults', () => {
  it('should return empty string for empty array', () => {
    expect(formatReflectionResults([])).toBe('')
  })

  it('should format single reflection result', () => {
    const result = formatReflectionResults(singleReflection)
    expect(result).toContain('## Previous Reflection')
    expect(result).toContain('Iteration 1')
    expect(result).toContain('Reasoning:')
    expect(result).toContain('Actions found — task complete')
    expect(result).toContain('Continue:')
    expect(result).toContain('false')
  })

  it('should format multiple reflection results in order', () => {
    const result = formatReflectionResults(multiReflection)
    expect(result).toContain('Iteration 1')
    expect(result).toContain('Iteration 2')
    expect(result).toContain('No actions yet, continuing')
    expect(result).toContain('Actions found — task complete')
    // Iteration 1 comes before Iteration 2
    const idx1 = result.indexOf('Iteration 1')
    const idx2 = result.indexOf('Iteration 2')
    expect(idx1).toBeLessThan(idx2)
  })

  it('should format continueLoop as lowercase string', () => {
    const results: ReflectionResult[] = [
      { reasoning: 'test', continueLoop: true },
    ]
    const result = formatReflectionResults(results)
    expect(result).toContain('true')
  })

  it('should format continueLoop false as lowercase string', () => {
    const results: ReflectionResult[] = [
      { reasoning: 'test', continueLoop: false },
    ]
    const result = formatReflectionResults(results)
    expect(result).toContain('false')
  })

  it('should handle reflection with metadata', () => {
    const results: ReflectionResult[] = [
      { reasoning: 'test', continueLoop: true, metadata: { score: 0.9 } },
    ]
    const result = formatReflectionResults(results)
    // Metadata not included in prompt format (only reasoning and continueLoop)
    expect(result).toContain('test')
    expect(result).toContain('true')
  })
})

// ---------------------------------------------------------------------------
// ReflectionPromptModule
// ---------------------------------------------------------------------------

describe('ReflectionPromptModule', () => {
  it('should return empty string when no reflectionResults in context', async () => {
    const module = new ReflectionPromptModule()
    const context: PipelineContext = { input: 'create a tree' }
    expect(await module.build(context)).toBe('')
  })

  it('should return empty string when reflectionResults is empty array', async () => {
    const module = new ReflectionPromptModule()
    const context: PipelineContext = {
      input: 'create a tree',
      metadata: { reflectionResults: [] },
    }
    expect(await module.build(context)).toBe('')
  })

  it('should return empty string when metadata is undefined', async () => {
    const module = new ReflectionPromptModule()
    const context: PipelineContext = { input: 'create a tree' }
    expect(await module.build(context)).toBe('')
  })

  it('should return empty string when reflectionResults is not an array', async () => {
    const module = new ReflectionPromptModule()
    const context: PipelineContext = {
      input: 'create a tree',
      metadata: { reflectionResults: 'not-an-array' },
    }
    expect(await module.build(context)).toBe('')
  })

  it('should format single reflection result from context', async () => {
    const module = new ReflectionPromptModule()
    const context: PipelineContext = {
      input: 'create a tree',
      metadata: { reflectionResults: singleReflection },
    }
    const result = await module.build(context)
    expect(result).toContain('## Previous Reflection')
    expect(result).toContain('Actions found — task complete')
  })

  it('should format multiple reflection results from context', async () => {
    const module = new ReflectionPromptModule()
    const context: PipelineContext = {
      input: 'create a tree',
      metadata: { reflectionResults: multiReflection },
    }
    const result = await module.build(context)
    expect(result).toContain('Iteration 1')
    expect(result).toContain('Iteration 2')
    expect(result).toContain('No actions yet, continuing')
    expect(result).toContain('Actions found — task complete')
  })
})

// ---------------------------------------------------------------------------
// DefaultPromptBuilder Integration
// ---------------------------------------------------------------------------

describe('DefaultPromptBuilder — Reflection Integration', () => {
  it('should include ReflectionPromptModule output in composed prompt', async () => {
    const builder = new DefaultPromptBuilder([
      new SystemPromptModule(),
      new ReflectionPromptModule(),
      new UserInputModule(),
    ])
    const context: PipelineContext = {
      input: 'create a tree',
      metadata: { reflectionResults: singleReflection },
    }
    const request = await builder.build(context)
    expect(request.prompt).toContain('## Previous Reflection')
    expect(request.prompt).toContain('Actions found — task complete')
  })

  it('should not include Reflection section when no reflectionResults', async () => {
    const builder = new DefaultPromptBuilder([
      new SystemPromptModule(),
      new ReflectionPromptModule(),
      new UserInputModule(),
    ])
    const context: PipelineContext = {
      input: 'create a tree',
    }
    const request = await builder.build(context)
    expect(request.prompt).not.toContain('## Previous Reflection')
    expect(request.prompt).toContain('Project Genesis')
    expect(request.prompt).toContain('create a tree')
  })

  it('should compose Reflection with all other modules', async () => {
    const builder = new DefaultPromptBuilder([
      new SystemPromptModule(),
      new ReflectionPromptModule(),
      new UserInputModule(),
      new MemoryPromptModule(),
      new WorldStatePromptModule(),
      new ObservationPromptModule(),
    ])
    const memory = new DefaultMemory()
    await memory.set('conversation', [
      { input: 'add tree', summary: 'Created a tree' },
    ])
    const context: PipelineContext = {
      input: 'move tree',
      memory,
      worldState: 'Tree\nid: tree-1\nposition: (3,5)',
      metadata: { reflectionResults: singleReflection },
    }
    const request = await builder.build(context)
    expect(request.prompt).toContain('## Previous Reflection')
    expect(request.prompt).toContain('Project Genesis')
    expect(request.prompt).toContain('move tree')
    expect(request.prompt).toContain('Previous conversation')
    expect(request.prompt).toContain('Current World')
  })

  it('should maintain suggested module order: System > Memory > Reflection > Observation > User', async () => {
    const builder = new DefaultPromptBuilder([
      new SystemPromptModule(),
      new WorldStatePromptModule(),
      new ReflectionPromptModule(),
      new UserInputModule(),
    ])
    const context: PipelineContext = {
      input: 'move tree',
      metadata: { reflectionResults: singleReflection },
      worldState: 'Tree\nid: tree-1\nposition: (3,5)',
    }
    const request = await builder.build(context)
    const prompt = request.prompt
    const sysIdx = prompt.indexOf('Project Genesis')
    const worldIdx = prompt.indexOf('Current World')
    const reflectionIdx = prompt.indexOf('## Previous Reflection')
    const userIdx = prompt.indexOf('move tree')
    expect(sysIdx).toBeLessThan(worldIdx)
    expect(worldIdx).toBeLessThan(reflectionIdx)
    expect(reflectionIdx).toBeLessThan(userIdx)
  })
})

// ---------------------------------------------------------------------------
// DefaultPromptBuilder.formatReflectionResults
// ---------------------------------------------------------------------------

describe('DefaultPromptBuilder.formatReflectionResults', () => {
  it('should delegate to the module formatter via instance method', () => {
    const builder = new DefaultPromptBuilder([new UserInputModule()])
    const result = builder.formatReflectionResults(singleReflection)
    expect(result).toContain('## Previous Reflection')
    expect(result).toContain('Actions found — task complete')
  })

  it('should return empty string for empty array', () => {
    const builder = new DefaultPromptBuilder([new UserInputModule()])
    expect(builder.formatReflectionResults([])).toBe('')
  })
})

// ---------------------------------------------------------------------------
// AgentLoop Integration
// ---------------------------------------------------------------------------

describe('AgentLoop — ReflectionResults Propagation', () => {
  it('should propagate reflectionResults from AgentLoop to PipelineContext.metadata via execute()', async () => {
    const reflection = new DefaultReflection()
    const agentLoop = new DefaultAgentLoop(reflection)
    const pipeline = new DefaultPipeline(
      createMockPlanner(treeResult),
      new DefaultPromptBuilder([new SystemPromptModule(), new ReflectionPromptModule(), new UserInputModule()]),
      undefined,
      agentLoop,
    )
    const context: PipelineContext = { input: 'create a tree' }
    const result = await pipeline.execute(context)
    expect(result.metadata?.reflectionResults).toBeDefined()
    const results = result.metadata!.reflectionResults as ReflectionResult[]
    expect(results.length).toBe(1)
    expect(results[0].continueLoop).toBe(false)
  })

  it('should not include reflectionResults when no reflection on AgentLoop', async () => {
    const agentLoop = new DefaultAgentLoop()
    const pipeline = new DefaultPipeline(
      createMockPlanner(treeResult),
      new DefaultPromptBuilder([new SystemPromptModule(), new ReflectionPromptModule(), new UserInputModule()]),
      undefined,
      agentLoop,
    )
    const context: PipelineContext = { input: 'create a tree' }
    const result = await pipeline.execute(context)
    // ReflectionPromptModule would output nothing since no reflectionResults
    expect(result.metadata?.reflectionResults).toBeUndefined()
  })

  it('should propagate reflectionResults via stream() fallback path', async () => {
    const reflection = new DefaultReflection()
    const agentLoop = new DefaultAgentLoop(reflection)
    const pipeline = new DefaultPipeline(
      createMockPlanner(treeResult),
      new DefaultPromptBuilder([new SystemPromptModule(), new ReflectionPromptModule(), new UserInputModule()]),
      undefined,
      agentLoop,
    )
    const context: PipelineContext = { input: 'create a tree' }
    const result = await pipeline.stream(context)
    expect(result.metadata?.reflectionResults).toBeDefined()
    const results = result.metadata!.reflectionResults as ReflectionResult[]
    expect(results.length).toBe(1)
  })

  it('should include reflection prompt text in subsequent pipeline calls', async () => {
    const reflection = new DefaultReflection()
    const agentLoop = new DefaultAgentLoop(reflection)
    const promptBuilder = new DefaultPromptBuilder([
      new SystemPromptModule(),
      new ReflectionPromptModule(),
      new UserInputModule(),
    ])
    const pipeline = new DefaultPipeline(
      createMockPlanner(treeResult),
      promptBuilder,
      undefined,
      agentLoop,
    )

    // First call generates reflection
    const firstResult = await pipeline.execute({ input: 'create a tree' })
    expect(firstResult.metadata?.reflectionResults).toBeDefined()

    // Second call with reflection from previous result
    const secondRequest = await promptBuilder.build(firstResult)
    expect(secondRequest.prompt).toContain('## Previous Reflection')
  })
})

// ---------------------------------------------------------------------------
// RetryPlanner Compatibility
// ---------------------------------------------------------------------------

describe('RetryPlanner — Reflection Compatibility', () => {
  it('should work with RetryPlanner and reflection', async () => {
    const provider = new MockPlannerProvider(new DefaultAIConfiguration())
    const retryPlanner = new RetryPlanner(provider)
    const reflection = new DefaultReflection()
    const agentLoop = new DefaultAgentLoop(reflection)
    const pipeline = new DefaultPipeline(
      retryPlanner,
      new DefaultPromptBuilder([new SystemPromptModule(), new ReflectionPromptModule(), new UserInputModule()]),
      undefined,
      agentLoop,
    )
    const result = await pipeline.execute({ input: 'tree' })
    expect(result.plannerResult!.actions.length).toBeGreaterThanOrEqual(0)
    // Reflection should be propagated
    expect(result.metadata?.reflectionResults).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// ToolCallPlanner Compatibility
// ---------------------------------------------------------------------------

describe('ToolCallPlanner — Reflection Compatibility', () => {
  it('should work with ToolCallPlanner and reflection', async () => {
    const tool = createMockTool('find_entity', { found: true })
    const registry = new DefaultToolRegistry([tool])
    const provider = new MockPlannerProvider(new DefaultAIConfiguration())
    const toolCallPlanner = new ToolCallPlanner(provider, registry)
    const reflection = new DefaultReflection()
    const agentLoop = new DefaultAgentLoop(reflection)
    const pipeline = new DefaultPipeline(
      toolCallPlanner,
      new DefaultPromptBuilder([new SystemPromptModule(), new ReflectionPromptModule(), new UserInputModule()]),
      undefined,
      agentLoop,
    )
    const result = await pipeline.execute({ input: 'tree' })
    expect(result.plannerResult!.actions.length).toBeGreaterThanOrEqual(0)
    expect(result.metadata?.reflectionResults).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Streaming Compatibility
// ---------------------------------------------------------------------------

describe('Streaming — Reflection Compatibility', () => {
  it('should work with streaming provider path (no agent loop, no reflection)', async () => {
    const streamingProvider = new MockStreamingProvider()
    const planner = new MockPlanner(streamingProvider)
    const pipeline = new DefaultPipeline(
      planner,
      new DefaultPromptBuilder([new SystemPromptModule(), new ReflectionPromptModule(), new UserInputModule()]),
      streamingProvider,
    )
    const context: PipelineContext = { input: 'tree' }
    const result = await pipeline.stream(context)
    // Streaming provider path uses doStream(), no AgentLoop, no reflection
    expect(result.metadata?.reflectionResults).toBeUndefined()
    expect(result.plannerResult!.actions).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Backward Compatibility
// ---------------------------------------------------------------------------

describe('Backward Compatibility', () => {
  it('should not change existing prompt output when no reflection', async () => {
    const builder = new DefaultPromptBuilder([
      new SystemPromptModule(),
      new UserInputModule(),
      new MemoryPromptModule(),
      new WorldStatePromptModule(),
    ])
    const memory = new DefaultMemory()
    await memory.set('conversation', [
      { input: 'add tree', summary: 'Created a tree' },
    ])
    const context: PipelineContext = {
      input: '增加一棵树',
      memory,
      worldState: 'Tree\nid: tree-1\nposition: (3,5)',
    }
    const request = await builder.build(context)
    // Should not contain reflection section
    expect(request.prompt).not.toContain('## Previous Reflection')
    // Should still contain all expected sections
    expect(request.prompt).toContain('Project Genesis')
    expect(request.prompt).toContain('增加一棵树')
    expect(request.prompt).toContain('Previous conversation')
    expect(request.prompt).toContain('Current World')
  })

  it('should work with ReflectionPromptModule added but no reflection data', async () => {
    const builder = new DefaultPromptBuilder([
      new SystemPromptModule(),
      new ReflectionPromptModule(),
      new UserInputModule(),
    ])
    const context: PipelineContext = { input: 'create a tree' }
    const request = await builder.build(context)
    // No reflection data → no Reflection section
    expect(request.prompt).not.toContain('## Previous Reflection')
    // System and user still work
    expect(request.prompt).toContain('Project Genesis')
    expect(request.prompt).toContain('create a tree')
  })

  it('should not affect existing module behavior when ReflectionPromptModule added', async () => {
    const builderWithReflection = new DefaultPromptBuilder([
      new SystemPromptModule(),
      new ReflectionPromptModule(),
      new UserInputModule(),
    ])
    const builderWithoutReflection = new DefaultPromptBuilder([
      new SystemPromptModule(),
      new UserInputModule(),
    ])
    const context: PipelineContext = { input: 'create a tree' }
    const withReflection = await builderWithReflection.build(context)
    const withoutReflection = await builderWithoutReflection.build(context)
    // Both should contain user input
    expect(withReflection.prompt).toContain('create a tree')
    expect(withoutReflection.prompt).toContain('create a tree')
    // Reflection module should be no-op when no data (backward compatible)
    expect(withReflection.prompt).not.toContain('## Previous Reflection')
  })

  it('should not affect Pipeline interface or execute() signature', async () => {
    const pipeline = new DefaultPipeline(
      createMockPlanner(treeResult),
      new DefaultPromptBuilder([new UserInputModule()]),
    )
    const result = await pipeline.execute({ input: 'tree' })
    expect(result.plannerResult!.actions).toHaveLength(1)
    expect(result.input).toBe('tree')
  })

  it('should not affect stream() signature', async () => {
    const streamingProvider = new MockStreamingProvider()
    const planner = new MockPlanner(streamingProvider)
    const pipeline = new DefaultPipeline(
      planner,
      new DefaultPromptBuilder([new UserInputModule()]),
      streamingProvider,
    )
    const result = await pipeline.stream({ input: 'tree' })
    expect(result.plannerResult!.actions).toBeDefined()
  })

  it('should work without ReflectionPromptModule in PromptBuilder chain', async () => {
    const builder = new DefaultPromptBuilder([
      new SystemPromptModule(),
      new UserInputModule(),
    ])
    const context: PipelineContext = {
      input: 'create a tree',
      metadata: { reflectionResults: singleReflection },
    }
    const request = await builder.build(context)
    // No ReflectionPromptModule → prompt should not contain reflection text
    expect(request.prompt).not.toContain('## Previous Reflection')
  })

  it('should work with AgentLoop without Reflection', async () => {
    const pipeline = new DefaultPipeline(
      createMockPlanner(treeResult),
      new DefaultPromptBuilder([new UserInputModule()]),
    )
    const result = await pipeline.execute({ input: 'tree' })
    expect(result.metadata?.reflectionResults).toBeUndefined()
    expect(result.plannerResult!.actions).toHaveLength(1)
  })
})