import { describe, it, expect } from 'vitest'
import { DefaultPromptBuilder } from '../prompt/DefaultPromptBuilder'
import {
  SystemPromptModule,
  UserInputModule,
  MemoryPromptModule,
  WorldStatePromptModule,
  ObservationPromptModule,
  ReflectionPromptModule,
} from '../prompt/modules'
import { serializePromptContext } from '../prompt/PromptContext'
import { DefaultMemory } from '../memory/DefaultMemory'
import { DefaultReflection } from '../reflection/DefaultReflection'
import { DefaultAgentLoop } from '../agent/DefaultAgentLoop'
import { DefaultToolRegistry } from '../tools/ToolRegistry'
import { DefaultPipeline } from '../pipeline/DefaultPipeline'
import { MockPlanner, RetryPlanner, ToolCallPlanner } from '../planner'
import { MockPlannerProvider, MockStreamingProvider } from '../provider'
import { DefaultAIConfiguration } from '../config'
import type { PromptContext } from '../prompt/PromptContext'
import type { PipelineContext } from '../pipeline/PipelineContext'
import type { PromptModule } from '../prompt/modules/PromptModule'
import type { Planner } from '../planner/Planner'
import type { PlannerResult } from '../planner/PlannerResult'
import type { AIRequest } from '../request'
import type { Tool, ToolRegistry } from '../tools'
import type { ReflectionResult } from '../reflection/ReflectionResult'

// ---------------------------------------------------------------------------
// Test Data
// ---------------------------------------------------------------------------

const singleReflection: ReflectionResult[] = [
  { reasoning: 'Actions found — task complete', continueLoop: false },
]

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

// ---------------------------------------------------------------------------
// PromptContext Interface
// ---------------------------------------------------------------------------

describe('PromptContext', () => {
  it('should define all expected fields as optional', () => {
    const ctx: PromptContext = {}
    expect(ctx.system).toBeUndefined()
    expect(ctx.userInput).toBeUndefined()
    expect(ctx.memory).toBeUndefined()
    expect(ctx.worldState).toBeUndefined()
    expect(ctx.observations).toBeUndefined()
    expect(ctx.reflections).toBeUndefined()
  })

  it('should accept partial population', () => {
    const ctx: PromptContext = { system: 'system text', userInput: 'user input' }
    expect(ctx.system).toBe('system text')
    expect(ctx.userInput).toBe('user input')
    expect(ctx.memory).toBeUndefined()
  })

  it('should accept all fields populated', () => {
    const ctx: PromptContext = {
      system: 'sys',
      userInput: 'in',
      memory: 'mem',
      worldState: 'world',
      observations: 'obs',
      reflections: 'refl',
    }
    expect(ctx.system).toBe('sys')
    expect(ctx.userInput).toBe('in')
    expect(ctx.memory).toBe('mem')
    expect(ctx.worldState).toBe('world')
    expect(ctx.observations).toBe('obs')
    expect(ctx.reflections).toBe('refl')
  })
})

// ---------------------------------------------------------------------------
// serializePromptContext
// ---------------------------------------------------------------------------

describe('serializePromptContext', () => {
  it('should return empty string for empty context', () => {
    expect(serializePromptContext({})).toBe('')
  })

  it('should serialize single field', () => {
    const result = serializePromptContext({ system: 'sys' })
    expect(result).toContain('sys')
  })

  it('should serialize multiple fields in canonical order', () => {
    const result = serializePromptContext({
      system: 'sys',
      userInput: 'input',
    })
    // system comes before userInput
    const sysIdx = result.indexOf('sys')
    const inputIdx = result.indexOf('input')
    expect(sysIdx).toBeLessThan(inputIdx)
  })

  it('should handle undefined fields as empty strings', () => {
    const result = serializePromptContext({ system: 'sys' })
    expect(result).toContain('sys')
  })
})

// ---------------------------------------------------------------------------
// Existing PromptModule — buildContext returns correct fields
// ---------------------------------------------------------------------------

describe('PromptModule.buildContext', () => {
  it('should have buildContext on SystemPromptModule', async () => {
    const module = new SystemPromptModule()
    expect(module.buildContext).toBeDefined()
    const ctx = await module.buildContext!({ input: '' })
    expect(ctx.system).toBeDefined()
    expect(ctx.system).toContain('Project Genesis')
  })

  it('should have buildContext on UserInputModule', async () => {
    const module = new UserInputModule()
    expect(module.buildContext).toBeDefined()
    const ctx = await module.buildContext!({ input: 'hello' })
    expect(ctx.userInput).toBe('hello')
  })

  it('should have buildContext on MemoryPromptModule', async () => {
    const module = new MemoryPromptModule()
    expect(module.buildContext).toBeDefined()
    // No memory → memory should be undefined
    const ctx = await module.buildContext!({ input: '' })
    expect(ctx.memory).toBeUndefined()
  })

  it('should have buildContext on WorldStatePromptModule', async () => {
    const module = new WorldStatePromptModule()
    expect(module.buildContext).toBeDefined()
    const ctx = await module.buildContext!({ input: '', worldState: 'Tree\nid: t1' })
    expect(ctx.worldState).toContain('Current World')
  })

  it('should have buildContext on ObservationPromptModule', async () => {
    const module = new ObservationPromptModule()
    expect(module.buildContext).toBeDefined()
    const ctx = await module.buildContext!({ input: '' })
    // No observations → undefined
    expect(ctx.observations).toBeUndefined()
  })

  it('should have buildContext on ReflectionPromptModule', async () => {
    const module = new ReflectionPromptModule()
    expect(module.buildContext).toBeDefined()
    const ctx = await module.buildContext!({ input: '' })
    // No reflections → undefined
    expect(ctx.reflections).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Legacy Module — buildContext not present
// ---------------------------------------------------------------------------

describe('Legacy Module (no buildContext)', () => {
  it('should work with module that only has build()', async () => {
    class LegacyModule implements PromptModule {
      async build(_context: PipelineContext): Promise<string> {
        return 'legacy output'
      }
    }

    const builder = new DefaultPromptBuilder([new LegacyModule()])
    const request = await builder.build({ input: '' })
    expect(request.prompt).toBe('legacy output')
  })

  it('should mix legacy and context-aware modules', async () => {
    class LegacyModule implements PromptModule {
      async build(_context: PipelineContext): Promise<string> {
        return 'legacy'
      }
    }

    const builder = new DefaultPromptBuilder([
      new SystemPromptModule(),
      new LegacyModule(),
      new UserInputModule(),
    ])
    const request = await builder.build({ input: 'hello' })
    expect(request.prompt).toContain('Project Genesis')
    expect(request.prompt).toContain('legacy')
    expect(request.prompt).toContain('hello')
  })
})

// ---------------------------------------------------------------------------
// PromptBuilder.buildContext()
// ---------------------------------------------------------------------------

describe('DefaultPromptBuilder.buildContext', () => {
  it('should return structured PromptContext from modules', async () => {
    const builder = new DefaultPromptBuilder([
      new SystemPromptModule(),
      new UserInputModule(),
    ])
    const ctx = await builder.buildContext({ input: 'hello' })
    expect(ctx.system).toContain('Project Genesis')
    expect(ctx.userInput).toBe('hello')
    expect(ctx.memory).toBeUndefined()
    expect(ctx.worldState).toBeUndefined()
  })

  it('should merge context from all modules', async () => {
    const memory = new DefaultMemory()
    await memory.set('conversation', [
      { input: 'add tree', summary: 'Created' },
    ])
    const builder = new DefaultPromptBuilder([
      new SystemPromptModule(),
      new UserInputModule(),
      new MemoryPromptModule(),
      new WorldStatePromptModule(),
    ])
    const ctx = await builder.buildContext({
      input: 'move',
      memory,
      worldState: 'Tree\nid: t1',
    })
    expect(ctx.system).toBeDefined()
    expect(ctx.userInput).toBe('move')
    expect(ctx.memory).toContain('Previous conversation')
    expect(ctx.worldState).toContain('Current World')
  })
})

// ---------------------------------------------------------------------------
// PromptBuilder.build() — Backward Compatibility
// ---------------------------------------------------------------------------

describe('DefaultPromptBuilder.build() — Backward Compatibility', () => {
  it('should produce same output as before for System + User', async () => {
    const builder = new DefaultPromptBuilder([
      new SystemPromptModule(),
      new UserInputModule(),
    ])
    const request = await builder.build({ input: 'create a tree' })
    expect(request.prompt).toContain('Project Genesis')
    expect(request.prompt).toContain('create a tree')
  })

  it('should produce same output for all modules with data', async () => {
    const memory = new DefaultMemory()
    await memory.set('conversation', [
      { input: 'add tree', summary: 'Created' },
    ])
    const builder = new DefaultPromptBuilder([
      new SystemPromptModule(),
      new UserInputModule(),
      new MemoryPromptModule(),
      new WorldStatePromptModule(),
    ])
    const request = await builder.build({
      input: 'move',
      memory,
      worldState: 'Tree\nid: t1\nposition: (3,5)',
    })
    expect(request.prompt).toContain('Project Genesis')
    expect(request.prompt).toContain('move')
    expect(request.prompt).toContain('Previous conversation')
    expect(request.prompt).toContain('Current World')
  })

  it('should preserve module order: System > User > Memory > World', async () => {
    const memory = new DefaultMemory()
    await memory.set('conversation', [
      { input: 'add tree', summary: 'Created' },
    ])
    const builder = new DefaultPromptBuilder([
      new SystemPromptModule(),
      new UserInputModule(),
      new MemoryPromptModule(),
      new WorldStatePromptModule(),
    ])
    const context: PipelineContext = {
      input: 'move',
      memory,
      worldState: 'Tree\nid: t1\nposition: (3,5)',
    }
    const request = await builder.build(context)
    const prompt = request.prompt
    const sysIdx = prompt.indexOf('Project Genesis')
    const userIdx = prompt.indexOf('move')
    const memIdx = prompt.indexOf('Previous conversation')
    const worldIdx = prompt.indexOf('Current World')
    expect(sysIdx).toBeLessThan(userIdx)
    expect(userIdx).toBeLessThan(memIdx)
    expect(memIdx).toBeLessThan(worldIdx)
  })

  it('should work with empty memory and worldState (empty modules produce empty sections)', async () => {
    const memory = new DefaultMemory()
    await memory.set('conversation', [])
    const builder = new DefaultPromptBuilder([
      new SystemPromptModule(),
      new UserInputModule(),
      new MemoryPromptModule(),
      new WorldStatePromptModule(),
    ])
    const context: PipelineContext = { input: '增加一棵树', memory }
    const request = await builder.build(context)
    expect(request.prompt).not.toContain('Previous conversation')
    expect(request.prompt).not.toContain('Current World')
  })
})

// ---------------------------------------------------------------------------
// PromptBuilder Composition with All Modules
// ---------------------------------------------------------------------------

describe('PromptBuilder — Full Composition', () => {
  it('should include all 6 built-in modules via buildContext', async () => {
    const memory = new DefaultMemory()
    await memory.set('conversation', [
      { input: 'add tree', summary: 'Created' },
    ])
    const builder = new DefaultPromptBuilder([
      new SystemPromptModule(),
      new UserInputModule(),
      new MemoryPromptModule(),
      new WorldStatePromptModule(),
      new ObservationPromptModule(),
      new ReflectionPromptModule(),
    ])
    const ctx = await builder.buildContext({
      input: 'move tree',
      memory,
      worldState: 'Tree\nid: t1',
      metadata: {
        observations: [
          { toolName: 'find', toolInput: {}, toolOutput: {}, timestamp: 1, iteration: 1 },
        ],
        reflectionResults: singleReflection,
      },
    })
    expect(ctx.system).toBeDefined()
    expect(ctx.userInput).toBe('move tree')
    expect(ctx.memory).toContain('Previous conversation')
    expect(ctx.worldState).toContain('Current World')
    expect(ctx.observations).toContain('## Previous Observations')
    expect(ctx.reflections).toContain('## Previous Reflection')
  })

  it('should serialize all modules correctly in build() output', async () => {
    const memory = new DefaultMemory()
    await memory.set('conversation', [
      { input: 'add tree', summary: 'Created' },
    ])
    const builder = new DefaultPromptBuilder([
      new SystemPromptModule(),
      new UserInputModule(),
      new MemoryPromptModule(),
      new WorldStatePromptModule(),
      new ObservationPromptModule(),
      new ReflectionPromptModule(),
    ])
    const request = await builder.build({
      input: 'move tree',
      memory,
      worldState: 'Tree\nid: t1',
      metadata: {
        observations: [
          { toolName: 'find', toolInput: {}, toolOutput: {}, timestamp: 1, iteration: 1 },
        ],
        reflectionResults: singleReflection,
      },
    })
    expect(request.prompt).toContain('## Previous Observations')
    expect(request.prompt).toContain('## Previous Reflection')
    expect(request.prompt).toContain('Project Genesis')
    expect(request.prompt).toContain('move tree')
  })
})

// ---------------------------------------------------------------------------
// RetryPlanner Compatibility
// ---------------------------------------------------------------------------

describe('RetryPlanner — PromptContext Compatibility', () => {
  it('should work with RetryPlanner via PromptBuilder', async () => {
    const provider = new MockPlannerProvider(new DefaultAIConfiguration())
    const retryPlanner = new RetryPlanner(provider)
    const pipeline = new DefaultPipeline(
      retryPlanner,
      new DefaultPromptBuilder([new SystemPromptModule(), new UserInputModule()]),
    )
    const result = await pipeline.execute({ input: 'tree' })
    expect(result.plannerResult!.actions).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// ToolCallPlanner Compatibility
// ---------------------------------------------------------------------------

describe('ToolCallPlanner — PromptContext Compatibility', () => {
  it('should work with ToolCallPlanner via PromptBuilder', async () => {
    const tool = createMockTool('find_entity', { found: true })
    const registry = new DefaultToolRegistry([tool])
    const provider = new MockPlannerProvider(new DefaultAIConfiguration())
    const toolCallPlanner = new ToolCallPlanner(provider, registry)
    const pipeline = new DefaultPipeline(
      toolCallPlanner,
      new DefaultPromptBuilder([new SystemPromptModule(), new UserInputModule()]),
    )
    const result = await pipeline.execute({ input: 'tree' })
    expect(result.plannerResult!.actions).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Streaming Compatibility
// ---------------------------------------------------------------------------

describe('Streaming — PromptContext Compatibility', () => {
  it('should work with streaming provider via PromptBuilder', async () => {
    const streamingProvider = new MockStreamingProvider()
    const planner = new MockPlanner(streamingProvider)
    const pipeline = new DefaultPipeline(
      planner,
      new DefaultPromptBuilder([new SystemPromptModule(), new UserInputModule()]),
      streamingProvider,
    )
    const result = await pipeline.stream({ input: 'tree' })
    expect(result.plannerResult!.actions).toBeDefined()
  })

  it('should fall back to agent loop with PromptBuilder when provider does not stream', async () => {
    const pipeline = new DefaultPipeline(
      createMockPlanner(treeResult),
      new DefaultPromptBuilder([new SystemPromptModule(), new UserInputModule()]),
    )
    const result = await pipeline.stream({ input: 'tree' })
    expect(result.plannerResult!.actions).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// AgentLoop + Reflection Integration
// ---------------------------------------------------------------------------

describe('AgentLoop — PromptContext Integration', () => {
  it('should work with AgentLoop and Reflection via PromptBuilder', async () => {
    const reflection = new DefaultReflection()
    const agentLoop = new DefaultAgentLoop(reflection)
    const pipeline = new DefaultPipeline(
      createMockPlanner(treeResult),
      new DefaultPromptBuilder([new SystemPromptModule(), new ReflectionPromptModule(), new UserInputModule()]),
      undefined,
      agentLoop,
    )
    const result = await pipeline.execute({ input: 'create a tree' })
    expect(result.plannerResult!.actions).toHaveLength(1)
  })
})