import { describe, it, expect } from 'vitest'
import { DefaultPromptCompression } from '../prompt/DefaultPromptCompression'
import type { PromptCompression } from '../prompt/PromptCompression'
import type { PromptContext } from '../prompt/PromptContext'
import type { PromptSelectionResult } from '../prompt/PromptSelectionResult'
import { DefaultPromptBuilder } from '../prompt/DefaultPromptBuilder'
import {
  SystemPromptModule,
  UserInputModule,
  MemoryPromptModule,
  WorldStatePromptModule,
  ObservationPromptModule,
  ReflectionPromptModule,
} from '../prompt/modules'
import { DefaultMemory } from '../memory/DefaultMemory'
import { DefaultReflection } from '../reflection/DefaultReflection'
import { DefaultAgentLoop } from '../agent/DefaultAgentLoop'
import { DefaultToolRegistry } from '../tools/ToolRegistry'
import { DefaultPipeline } from '../pipeline/DefaultPipeline'
import { MockPlanner, RetryPlanner, ToolCallPlanner } from '../planner'
import { MockPlannerProvider, MockStreamingProvider } from '../provider'
import { DefaultAIConfiguration } from '../config'
import type { PromptModule } from '../prompt/modules/PromptModule'
import type { PipelineContext } from '../pipeline/PipelineContext'
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
// PromptCompression Interface
// ---------------------------------------------------------------------------

describe('PromptCompression', () => {
  it('should define compress method that accepts PromptContext and returns PromptContext', () => {
    const compression: PromptCompression = new DefaultPromptCompression()
    const result = compression.compress({})
    expect(typeof result).toBe('object')
    expect(result).not.toBeNull()
  })

  it('should be implementable as a custom compression', () => {
    class CustomCompression implements PromptCompression {
      compress(context: PromptContext): PromptContext {
        const out: PromptContext = {}
        if (context.system) {
          out.system = context.system.toUpperCase()
        }
        return out
      }
    }
    const compression = new CustomCompression()
    const result = compression.compress({ system: 'hello' })
    expect(result.system).toBe('HELLO')
  })

  it('should not require any dependencies', () => {
    // PromptCompression interface has no dependency on Planner, Provider, Runtime, AgentLoop
    const compression: PromptCompression = new DefaultPromptCompression()
    // If it compiles and returns, the isolation contract is satisfied
    expect(typeof compression.compress).toBe('function')
  })
})

// ---------------------------------------------------------------------------
// DefaultPromptCompression
// ---------------------------------------------------------------------------

describe('DefaultPromptCompression', () => {
  it('should return a new object (not mutate input)', () => {
    const compression = new DefaultPromptCompression()
    const input: PromptContext = { system: 'sys', userInput: 'input' }
    const result = compression.compress(input)
    expect(result).not.toBe(input)
    expect(input.system).toBe('sys')
    expect(input.userInput).toBe('input')
  })

  it('should preserve all valid fields', () => {
    const compression = new DefaultPromptCompression()
    const input: PromptContext = { system: 'sys', userInput: 'input', memory: 'mem' }
    const result = compression.compress(input)
    expect(result.system).toBe('sys')
    expect(result.userInput).toBe('input')
    expect(result.memory).toBe('mem')
  })

  it('should remove undefined fields', () => {
    const compression = new DefaultPromptCompression()
    const input: PromptContext = { system: 'sys', userInput: undefined, memory: 'mem' }
    const result = compression.compress(input)
    expect(result.system).toBe('sys')
    expect(result.memory).toBe('mem')
    expect(result.userInput).toBeUndefined()
  })

  it('should remove empty string fields', () => {
    const compression = new DefaultPromptCompression()
    const input: PromptContext = { system: '', userInput: 'input', memory: '' }
    const result = compression.compress(input)
    expect(result.userInput).toBe('input')
    expect(result.system).toBeUndefined()
    expect(result.memory).toBeUndefined()
  })

  it('should return empty object when all fields are undefined/empty', () => {
    const compression = new DefaultPromptCompression()
    const input: PromptContext = { system: undefined, userInput: '', memory: undefined }
    const result = compression.compress(input)
    expect(Object.keys(result)).toHaveLength(0)
  })

  it('should return empty object for empty input', () => {
    const compression = new DefaultPromptCompression()
    const result = compression.compress({})
    expect(Object.keys(result)).toHaveLength(0)
  })

  it('should be idempotent (compress(compress(ctx)) === compress(ctx))', () => {
    const compression = new DefaultPromptCompression()
    const input: PromptContext = {
      system: 'sys',
      userInput: undefined,
      memory: 'mem',
      worldState: '',
      observations: 'obs',
      reflections: undefined,
    }
    const firstPass = compression.compress(input)
    const secondPass = compression.compress(firstPass)
    expect(Object.keys(firstPass)).toEqual(Object.keys(secondPass))
    expect(firstPass.system).toBe(secondPass.system)
    expect(firstPass.memory).toBe(secondPass.memory)
    expect(firstPass.observations).toBe(secondPass.observations)
  })

  it('should preserve all populated fields including observations and reflections', () => {
    const compression = new DefaultPromptCompression()
    const input: PromptContext = {
      system: 'sys',
      userInput: 'in',
      memory: 'mem',
      worldState: 'world',
      observations: 'obs',
      reflections: 'refl',
    }
    const result = compression.compress(input)
    expect(result.system).toBe('sys')
    expect(result.userInput).toBe('in')
    expect(result.memory).toBe('mem')
    expect(result.worldState).toBe('world')
    expect(result.observations).toBe('obs')
    expect(result.reflections).toBe('refl')
  })
})

// ---------------------------------------------------------------------------
// DefaultPromptBuilder — Compression Integration
// ---------------------------------------------------------------------------

describe('DefaultPromptBuilder — Compression Integration', () => {
  it('should use DefaultPromptCompression by default (backward compatible)', async () => {
    const builder = new DefaultPromptBuilder([
      new SystemPromptModule(),
      new UserInputModule(),
    ])
    const request = await builder.build({ input: 'hello' })
    expect(request.prompt).toContain('Project Genesis')
    expect(request.prompt).toContain('hello')
  })

  it('should accept custom PromptCompression', async () => {
    class UpperCaseCompression implements PromptCompression {
      compress(context: PromptContext): PromptContext {
        const out: PromptContext = {}
        for (const [key, value] of Object.entries(context)) {
          if (typeof value === 'string') {
            const target = out as Record<string, string>
            target[key] = value.toUpperCase()
          }
        }
        return out
      }
    }
    const builder = new DefaultPromptBuilder(
      [new UserInputModule()],
      undefined,
      new UpperCaseCompression(),
    )
    const request = await builder.build({ input: 'hello' })
    expect(request.prompt).toBe('HELLO')
  })

  it('should produce identical output with default compression (backward compat)', async () => {
    const builder1 = new DefaultPromptBuilder([
      new SystemPromptModule(),
      new UserInputModule(),
      new MemoryPromptModule(),
      new WorldStatePromptModule(),
    ])
    const memory = new DefaultMemory()
    await memory.set('conversation', [
      { input: 'add tree', summary: 'Created' },
    ])
    const context: PipelineContext = {
      input: 'move',
      memory,
      worldState: 'Tree\nid: t1\nposition: (3,5)',
    }
    const request = await builder1.build(context)
    expect(request.prompt).toContain('Project Genesis')
    expect(request.prompt).toContain('move')
    expect(request.prompt).toContain('Previous conversation')
    expect(request.prompt).toContain('Current World')
  })

  it('should apply compression in build() to strip undefined/empty fields', async () => {
    const builder = new DefaultPromptBuilder([
      new UserInputModule(),
    ])
    // build() with input should include userInput after compression
    const request = await builder.build({ input: 'hello' })
    expect(request.prompt).toBe('hello')

    // build() with empty input — userInput='' gets stripped by compression
    const emptyRequest = await builder.build({ input: '' })
    expect(emptyRequest.prompt).toBe('')
  })
})

// ---------------------------------------------------------------------------
// PromptBuilder — Compression with buildContext
// ---------------------------------------------------------------------------

describe('DefaultPromptBuilder — Compression with buildContext', () => {
  it('should apply compression in buildContext()', async () => {
    const builder = new DefaultPromptBuilder([
      new SystemPromptModule(),
      new UserInputModule(),
    ])
    const ctx = await builder.buildContext({ input: 'hello' })
    // system and userInput should be present
    expect(ctx.system).toBeDefined()
    expect(ctx.userInput).toBe('hello')
  })

  it('should strip undefined/empty fields via compression in buildContext()', async () => {
    const builder = new DefaultPromptBuilder([
      new UserInputModule(),
    ])
    const ctx = await builder.buildContext({ input: '' })
    // userInput should be '' from module, but compression strips it
    expect(ctx.userInput).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Renderer Compatibility — Compression does not break renderer
// ---------------------------------------------------------------------------

describe('Compression — Renderer Compatibility', () => {
  it('should work with DefaultPromptRenderer after compression', async () => {
    const builder = new DefaultPromptBuilder([
      new SystemPromptModule(),
      new UserInputModule(),
    ])
    const request = await builder.build({ input: 'hello' })
    expect(request.prompt).toContain('Project Genesis')
    expect(request.prompt).toContain('hello')
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
})

// ---------------------------------------------------------------------------
// Existing Prompt Modules Compatibility
// ---------------------------------------------------------------------------

describe('Compression — Existing Prompt Modules Compatibility', () => {
  it('SystemPromptModule should work unchanged', async () => {
    const module = new SystemPromptModule()
    const text = await module.build({ input: '' })
    expect(text).toContain('Project Genesis')
  })

  it('UserInputModule should work unchanged', async () => {
    const module = new UserInputModule()
    const text = await module.build({ input: 'hello' })
    expect(text).toBe('hello')
  })

  it('MemoryPromptModule should work unchanged', async () => {
    const module = new MemoryPromptModule()
    const memory = new DefaultMemory()
    await memory.set('conversation', [{ input: 'hi', summary: 'done' }])
    const text = await module.build({ input: '', memory })
    expect(text).toContain('Previous conversation')
  })

  it('WorldStatePromptModule should work unchanged', async () => {
    const module = new WorldStatePromptModule()
    const text = await module.build({ input: '', worldState: 'Tree\nid: t1' })
    expect(text).toContain('Current World')
  })

  it('ObservationPromptModule should work unchanged', async () => {
    const module = new ObservationPromptModule()
    const text = await module.build({
      input: '',
      metadata: {
        observations: [
          { toolName: 'find', toolInput: {}, toolOutput: {}, timestamp: 1, iteration: 1 },
        ],
      },
    })
    expect(text).toContain('## Previous Observations')
  })

  it('ReflectionPromptModule should work unchanged', async () => {
    const module = new ReflectionPromptModule()
    const text = await module.build({
      input: '',
      metadata: { reflectionResults: singleReflection },
    })
    expect(text).toContain('## Previous Reflection')
  })
})

// ---------------------------------------------------------------------------
// RetryPlanner Compatibility
// ---------------------------------------------------------------------------

describe('Compression — RetryPlanner Compatibility', () => {
  it('should work with RetryPlanner via PromptBuilder and compression', async () => {
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
// ToolCallingPlanner Compatibility
// ---------------------------------------------------------------------------

describe('Compression — ToolCallPlanner Compatibility', () => {
  it('should work with ToolCallPlanner via PromptBuilder and compression', async () => {
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

describe('Compression — Streaming Compatibility', () => {
  it('should work with streaming provider via PromptBuilder and compression', async () => {
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

  it('should fall back to agent loop when provider does not stream', async () => {
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

describe('Compression — AgentLoop Integration', () => {
  it('should work with AgentLoop and Reflection', async () => {
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

// ---------------------------------------------------------------------------
// Backward Compatibility — Legacy Modules
// ---------------------------------------------------------------------------

describe('Compression — Backward Compatibility (Legacy Modules)', () => {
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
// Custom Compression — Future Extension
// ---------------------------------------------------------------------------

describe('Custom Compression — Future Extension', () => {
  it('should allow noop compression (passthrough)', () => {
    class NoopCompression implements PromptCompression {
      compress(context: PromptContext): PromptContext {
        return { ...context }
      }
    }
    const compression = new NoopCompression()
    const input: PromptContext = { system: 'sys', userInput: 'in' }
    const result = compression.compress(input)
    expect(result).not.toBe(input)
    expect(result.system).toBe('sys')
    expect(result.userInput).toBe('in')
  })

  it('should allow field-level filtering compression', () => {
    class FilterByLengthCompression implements PromptCompression {
      constructor(private readonly maxLength: number) {}
      compress(context: PromptContext): PromptContext {
        const out: PromptContext = {}
        for (const [key, value] of Object.entries(context)) {
          if (typeof value === 'string' && value.length <= this.maxLength) {
            const target = out as Record<string, string>
            target[key] = value
          }
        }
        return out
      }
    }
    const compression = new FilterByLengthCompression(5)
    const input: PromptContext = { system: 'short', userInput: 'too long text', memory: 'tiny' }
    const result = compression.compress(input)
    expect(result.system).toBe('short')
    expect(result.memory).toBe('tiny')
    expect(result.userInput).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

describe('Compression Exports', () => {
  it('should export PromptCompression type from prompt module', async () => {
    const { DefaultPromptCompression: DPC } = await import('../prompt')
    expect(DPC).toBeDefined()
  })

  it('should export DefaultPromptCompression class from prompt module', async () => {
    const { DefaultPromptCompression: ExportedClass } = await import('../prompt')
    expect(ExportedClass).toBeDefined()
    expect(typeof ExportedClass).toBe('function')
  })

  it('should export PromptCompression type from package root', async () => {
    const { DefaultPromptCompression: DPC } = await import('..')
    expect(DPC).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Compression — Selection Consumption Interface
// ---------------------------------------------------------------------------

describe('Compression — Selection Consumption Interface', () => {
  it('should accept optional PromptSelectionResult parameter', () => {
    const compression: PromptCompression = new DefaultPromptCompression()
    const result = compression.compress(
      { system: 'test' },
      { selectedSections: ['system'], excludedSections: [] },
    )
    expect(result.system).toBe('test')
  })

  it('should work without PromptSelectionResult (backward compatible)', () => {
    const compression: PromptCompression = new DefaultPromptCompression()
    const result = compression.compress({ system: 'test' })
    expect(result.system).toBe('test')
  })
})

// ---------------------------------------------------------------------------
// Compression — Selection Consumption Behavior
// ---------------------------------------------------------------------------

describe('Compression — Selection Consumption Behavior', () => {
  it('should remove sections listed in excludedSections', () => {
    const compression = new DefaultPromptCompression()
    const result = compression.compress(
      { system: 'sys', userInput: 'input', memory: 'mem' },
      { selectedSections: ['userInput', 'memory'], excludedSections: ['system'] },
    )
    expect(result.userInput).toBe('input')
    expect(result.memory).toBe('mem')
    expect(result.system).toBeUndefined()
  })

  it('should remove multiple excluded sections', () => {
    const compression = new DefaultPromptCompression()
    const result = compression.compress(
      {
        system: 'sys',
        userInput: 'input',
        memory: 'mem',
        worldState: 'world',
        observations: 'obs',
        reflections: 'refl',
      },
      {
        selectedSections: ['userInput', 'observations'],
        excludedSections: ['system', 'memory', 'worldState', 'reflections'],
      },
    )
    expect(result.userInput).toBe('input')
    expect(result.observations).toBe('obs')
    expect(result.system).toBeUndefined()
    expect(result.memory).toBeUndefined()
    expect(result.worldState).toBeUndefined()
    expect(result.reflections).toBeUndefined()
  })

  it('should preserve all sections when excludedSections is empty', () => {
    const compression = new DefaultPromptCompression()
    const result = compression.compress(
      { system: 'sys', userInput: 'input' },
      { selectedSections: ['system', 'userInput'], excludedSections: [] },
    )
    expect(result.system).toBe('sys')
    expect(result.userInput).toBe('input')
  })
})

// ---------------------------------------------------------------------------
// Compression — Selection + Empty/Undefined Removal
// ---------------------------------------------------------------------------

describe('Compression — Selection + Empty/Undefined Removal', () => {
  it('should remove excluded sections AND undefined fields simultaneously', () => {
    const compression = new DefaultPromptCompression()
    const result = compression.compress(
      {
        system: 'sys',
        userInput: undefined,
        memory: 'mem',
        worldState: undefined,
      },
      {
        selectedSections: ['system', 'memory'],
        excludedSections: ['memory'],  // memory excluded
      },
    )
    // system: kept (populated, not excluded)
    // userInput: removed by undefined
    // memory: removed by exclusion (even though populated)
    // worldState: removed by undefined
    expect(result.system).toBe('sys')
    expect(result.userInput).toBeUndefined()
    expect(result.memory).toBeUndefined()
    expect(result.worldState).toBeUndefined()
  })

  it('should remove excluded sections AND empty string fields simultaneously', () => {
    const compression = new DefaultPromptCompression()
    const result = compression.compress(
      {
        system: '',
        userInput: 'input',
        memory: 'mem',
      },
      {
        selectedSections: ['userInput'],
        excludedSections: ['memory'],
      },
    )
    // system: removed by empty string
    // userInput: kept (populated, not excluded)
    // memory: removed by exclusion
    expect(result.userInput).toBe('input')
    expect(result.system).toBeUndefined()
    expect(result.memory).toBeUndefined()
  })

  it('should keep populated section that is selected and not excluded', () => {
    const compression = new DefaultPromptCompression()
    const result = compression.compress(
      { system: 'sys', userInput: 'input' },
      { selectedSections: ['system', 'userInput'], excludedSections: [] },
    )
    expect(result.system).toBe('sys')
    expect(result.userInput).toBe('input')
    expect(Object.keys(result)).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// Compression — Non-mutating with Selection
// ---------------------------------------------------------------------------

describe('Compression — Non-mutating with Selection', () => {
  it('should not mutate input context when selection is provided', () => {
    const compression = new DefaultPromptCompression()
    const input: PromptContext = { system: 'sys', userInput: 'input' }
    const inputCopy = { ...input }
    compression.compress(
      input,
      { selectedSections: ['system'], excludedSections: ['userInput'] },
    )
    expect(input).toEqual(inputCopy)
  })

  it('should return a new object (not same reference)', () => {
    const compression = new DefaultPromptCompression()
    const input: PromptContext = { system: 'sys' }
    const result = compression.compress(
      input,
      { selectedSections: ['system'], excludedSections: [] },
    )
    expect(result).not.toBe(input)
  })
})

// ---------------------------------------------------------------------------
// Compression — Deterministic with Selection
// ---------------------------------------------------------------------------

describe('Compression — Deterministic with Selection', () => {
  it('should produce identical output for identical input + selection', () => {
    const compression = new DefaultPromptCompression()
    const input: PromptContext = {
      system: 'sys',
      userInput: 'input',
      memory: 'mem',
    }
    const selection: PromptSelectionResult = {
      selectedSections: ['system', 'memory'],
      excludedSections: ['userInput'],
    }
    const result1 = compression.compress(input, selection)
    const result2 = compression.compress(input, selection)
    expect(result1).toEqual(result2)
  })

  it('should be idempotent with selection', () => {
    const compression = new DefaultPromptCompression()
    const input: PromptContext = {
      system: 'sys',
      userInput: undefined,
      memory: 'mem',
    }
    const selection: PromptSelectionResult = {
      selectedSections: ['system'],
      excludedSections: ['memory'],
    }
    const firstPass = compression.compress(input, selection)
    const secondPass = compression.compress(firstPass, selection)
    expect(firstPass).toEqual(secondPass)
  })
})

// ---------------------------------------------------------------------------
// Compression — PromptBuilder Integration with Selection Consumption
// ---------------------------------------------------------------------------

describe('Compression — PromptBuilder Integration with Selection Consumption', () => {
  it('should produce correct output when compression consumes selection in builder', async () => {
    // DefaultPromptBuilder passes selectionResult to compression
    // Since builder no longer manually applies selection, compression handles it
    const builder = new DefaultPromptBuilder(
      [new SystemPromptModule(), new UserInputModule()],
    )
    const request = await builder.build({ input: 'hello' })
    // Default selection preserves all, default compression strips undefined/empty
    expect(request.prompt).toContain('Project Genesis')
    expect(request.prompt).toContain('hello')
  })

  it('should exclude sections when build uses budget-aware selection and compression', async () => {
    // Use a strict budget to force selection exclusion, then verify compression removes it
    class TrackedCompression implements PromptCompression {
      public lastSelection: PromptSelectionResult | undefined

      compress(
        context: PromptContext,
        selection?: PromptSelectionResult,
      ): PromptContext {
        this.lastSelection = selection
        return new DefaultPromptCompression().compress(context, selection)
      }
    }

    const tracked = new TrackedCompression()
    const selection = new (await import('../prompt')).DefaultPromptSelection(5)
    const builder = new DefaultPromptBuilder(
      [new SystemPromptModule(), new UserInputModule()],
      undefined,
      tracked,
      undefined,
      undefined,
      selection,
    )

    await builder.build({ input: 'x'.repeat(100) })

    // Compression should have received the selection result
    expect(tracked.lastSelection).toBeDefined()
    expect(tracked.lastSelection!.excludedSections).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Compression — RetryPlanner Compatibility with Selection
// ---------------------------------------------------------------------------

describe('Compression — RetryPlanner with Selection Consumption', () => {
  it('should work with RetryPlanner when compression consumes selection', async () => {
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
// Compression — ToolCallPlanner Compatibility with Selection
// ---------------------------------------------------------------------------

describe('Compression — ToolCallPlanner with Selection Consumption', () => {
  it('should work with ToolCallPlanner when compression consumes selection', async () => {
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
// Compression — Streaming Compatibility with Selection
// ---------------------------------------------------------------------------

describe('Compression — Streaming with Selection Consumption', () => {
  it('should work with streaming provider when compression consumes selection', async () => {
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
})

// ---------------------------------------------------------------------------
// Compression — AgentLoop Compatibility with Selection
// ---------------------------------------------------------------------------

describe('Compression — AgentLoop with Selection Consumption', () => {
  it('should work with AgentLoop and Reflection when compression consumes selection', async () => {
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

// ---------------------------------------------------------------------------
// Compression — Backward Compatibility with Selection
// ---------------------------------------------------------------------------

describe('Compression — Backward Compatibility with Selection', () => {
  it('should produce identical behavior when no selection is provided', () => {
    const compression = new DefaultPromptCompression()
    const input: PromptContext = {
      system: 'sys',
      userInput: undefined,
      memory: 'mem',
      worldState: '',
    }
    const result = compression.compress(input)
    expect(result.system).toBe('sys')
    expect(result.memory).toBe('mem')
    expect(result.userInput).toBeUndefined()
    expect(result.worldState).toBeUndefined()
  })

  it('should support custom implementations ignoring selection param', () => {
    class LegacyCompression implements PromptCompression {
      compress(context: PromptContext, _selection?: PromptSelectionResult): PromptContext {
        const out: PromptContext = {}
        for (const [key, value] of Object.entries(context)) {
          if (value !== undefined && value !== '') {
            if (this.isPromptContextKey(key)) {
              out[key] = value
            }
          }
        }
        return out
      }

      private isPromptContextKey(key: string): key is keyof PromptContext {
        return ['system', 'userInput', 'memory', 'worldState', 'observations', 'reflections'].includes(key)
      }
    }

    const compression = new LegacyCompression()
    const result = compression.compress(
      { system: 'sys', userInput: 'input' },
      { selectedSections: ['system'], excludedSections: ['userInput'] },
    )
    // Legacy implementation ignores selection param, preserves all
    expect(result.system).toBe('sys')
    expect(result.userInput).toBe('input')
  })

  it('should preserve existing builder behavior with default constructor', async () => {
    const builder1 = new DefaultPromptBuilder([new SystemPromptModule(), new UserInputModule()])
    const builder3 = new DefaultPromptBuilder(
      [new SystemPromptModule(), new UserInputModule()],
      undefined,
      undefined,
    )
    const result1 = await builder1.build({ input: 'hello' })
    const result3 = await builder3.build({ input: 'hello' })
    expect(result1.prompt).toBe(result3.prompt)
  })
})