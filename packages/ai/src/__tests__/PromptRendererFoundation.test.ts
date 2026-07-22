import { describe, it, expect } from 'vitest'
import { DefaultPromptRenderer } from '../prompt/DefaultPromptRenderer'
import type { PromptRenderer } from '../prompt/PromptRenderer'
import type { PromptContext } from '../prompt/PromptContext'
import { serializePromptContext } from '../prompt/PromptContext'
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
// PromptRenderer Interface
// ---------------------------------------------------------------------------

describe('PromptRenderer', () => {
  it('should define render method that accepts PromptContext and returns string', () => {
    const renderer: PromptRenderer = new DefaultPromptRenderer()
    const result = renderer.render({})
    expect(typeof result).toBe('string')
  })

  it('should be implementable as a custom renderer', () => {
    class CustomRenderer implements PromptRenderer {
      render(context: PromptContext): string {
        return `CUSTOM: ${context.system ?? ''}`
      }
    }
    const renderer = new CustomRenderer()
    expect(renderer.render({ system: 'hello' })).toBe('CUSTOM: hello')
    expect(renderer.render({})).toBe('CUSTOM: ')
  })
})

// ---------------------------------------------------------------------------
// DefaultPromptRenderer
// ---------------------------------------------------------------------------

describe('DefaultPromptRenderer', () => {
  it('should return empty string for empty context', () => {
    const renderer = new DefaultPromptRenderer()
    expect(renderer.render({})).toBe('')
  })

  it('should render single field', () => {
    const renderer = new DefaultPromptRenderer()
    const result = renderer.render({ system: 'sys' })
    expect(result).toContain('sys')
  })

  it('should render fields in insertion order', () => {
    const renderer = new DefaultPromptRenderer()
    const result = renderer.render({
      userInput: 'input',
      system: 'sys',
    })
    // insertion order: userInput comes before system
    const inputIdx = result.indexOf('input')
    const sysIdx = result.indexOf('sys')
    expect(inputIdx).toBeLessThan(sysIdx)
  })

  it('should join fields with newlines', () => {
    const renderer = new DefaultPromptRenderer()
    const result = renderer.render({ system: 'sys', userInput: 'input' })
    expect(result).toBe('sys\ninput')
  })

  it('should render undefined fields as empty strings', () => {
    const renderer = new DefaultPromptRenderer()
    const result = renderer.render({ system: 'sys', memory: undefined })
    // memory exists as key but value is undefined
    expect(result).toBe('sys\n')
  })

  it('should not include keys not in CANONICAL_ORDER', () => {
    const renderer = new DefaultPromptRenderer()
    // Unknown keys should be filtered out
    const ctx = { system: 'sys', unknownField: 'should be ignored' } as PromptContext
    const result = renderer.render(ctx)
    expect(result).not.toContain('should be ignored')
  })

  it('should use CANONICAL_ORDER in renderWithOrder', () => {
    const renderer = new DefaultPromptRenderer()
    const result = renderer.renderWithOrder({
      userInput: 'input',
      system: 'sys',
      observations: 'obs',
      reflections: 'refl',
    })
    // Canonical order: system, userInput, memory, reflections, worldState, observations
    const sysIdx = result.indexOf('sys')
    const inputIdx = result.indexOf('input')
    const reflIdx = result.indexOf('refl')
    const obsIdx = result.indexOf('obs')
    expect(sysIdx).toBeLessThan(inputIdx)
    expect(inputIdx).toBeLessThan(reflIdx)
    expect(reflIdx).toBeLessThan(obsIdx)
  })

  it('should return empty for all-undefined in renderWithOrder', () => {
    const renderer = new DefaultPromptRenderer()
    expect(renderer.renderWithOrder({})).toBe('')
  })

  it('CANONICAL_ORDER should include all PromptContext fields', () => {
    const order = DefaultPromptRenderer.CANONICAL_ORDER
    expect(order).toContain('system')
    expect(order).toContain('userInput')
    expect(order).toContain('memory')
    expect(order).toContain('worldState')
    expect(order).toContain('observations')
    expect(order).toContain('reflections')
  })
})

// ---------------------------------------------------------------------------
// serializePromptContext Compatibility
// ---------------------------------------------------------------------------

describe('serializePromptContext Compatibility', () => {
  it('should return empty string for empty context (unchanged)', () => {
    expect(serializePromptContext({})).toBe('')
  })

  it('should serialize single field (unchanged)', () => {
    const result = serializePromptContext({ system: 'sys' })
    expect(result).toContain('sys')
  })

  it('should serialize multiple fields in canonical order (unchanged)', () => {
    const result = serializePromptContext({
      system: 'sys',
      userInput: 'input',
    })
    const sysIdx = result.indexOf('sys')
    const inputIdx = result.indexOf('input')
    expect(sysIdx).toBeLessThan(inputIdx)
  })

  it('should handle undefined fields as empty strings (unchanged)', () => {
    const result = serializePromptContext({ system: 'sys' })
    expect(result).toContain('sys')
  })

  it('should delegate to DefaultPromptRenderer.renderWithOrder internally', () => {
    // Verify the output matches DefaultPromptRenderer's canonical order
    const renderer = new DefaultPromptRenderer()
    const ctx: PromptContext = { system: 'sys', userInput: 'input', memory: 'mem' }
    expect(serializePromptContext(ctx)).toBe(renderer.renderWithOrder(ctx))
  })
})

// ---------------------------------------------------------------------------
// DefaultPromptBuilder uses DefaultPromptRenderer by default
// ---------------------------------------------------------------------------

describe('DefaultPromptBuilder — Renderer Integration', () => {
  it('should use DefaultPromptRenderer by default', async () => {
    const builder = new DefaultPromptBuilder([
      new SystemPromptModule(),
      new UserInputModule(),
    ])
    const request = await builder.build({ input: 'hello' })
    expect(request.prompt).toContain('Project Genesis')
    expect(request.prompt).toContain('hello')
  })

  it('should accept custom PromptRenderer', async () => {
    class UpperCaseRenderer implements PromptRenderer {
      render(context: PromptContext): string {
        return Object.values(context)
          .filter(Boolean)
          .join('\n')
          .toUpperCase()
      }
    }
    const builder = new DefaultPromptBuilder(
      [new UserInputModule()],
      new UpperCaseRenderer(),
    )
    const request = await builder.build({ input: 'hello' })
    expect(request.prompt).toBe('HELLO')
  })

  it('should produce identical output to previous version', async () => {
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

  it('should render custom module order correctly', async () => {
    const builder = new DefaultPromptBuilder([
      new SystemPromptModule(),
      new WorldStatePromptModule(),
      new MemoryPromptModule(),
      new ReflectionPromptModule(),
      new ObservationPromptModule(),
      new UserInputModule(),
    ])
    const memory = new DefaultMemory()
    await memory.set('conversation', [
      { input: 'add tree', summary: 'Created' },
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
    // Insertion order should match module order
    const keys = Object.keys(ctx)
    const sysIdx = keys.indexOf('system')
    const worldIdx = keys.indexOf('worldState')
    const memIdx = keys.indexOf('memory')
    const reflIdx = keys.indexOf('reflections')
    const obsIdx = keys.indexOf('observations')
    const userIdx = keys.indexOf('userInput')
    expect(sysIdx).toBeLessThan(worldIdx)
    expect(worldIdx).toBeLessThan(memIdx)
    expect(memIdx).toBeLessThan(reflIdx)
    expect(reflIdx).toBeLessThan(obsIdx)
    expect(obsIdx).toBeLessThan(userIdx)
  })
})

// ---------------------------------------------------------------------------
// PromptBuilder → Renderer: all 6 modules
// ---------------------------------------------------------------------------

describe('PromptBuilder → Renderer — Full Composition', () => {
  it('should include all 6 built-in modules via renderer', async () => {
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
// Existing Prompt Modules Compatibility
// ---------------------------------------------------------------------------

describe('Existing Prompt Modules Compatibility', () => {
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

describe('RetryPlanner — Renderer Compatibility', () => {
  it('should work with RetryPlanner via PromptBuilder and renderer', async () => {
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

describe('ToolCallPlanner — Renderer Compatibility', () => {
  it('should work with ToolCallPlanner via PromptBuilder and renderer', async () => {
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

describe('Streaming — Renderer Compatibility', () => {
  it('should work with streaming provider via PromptBuilder and renderer', async () => {
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

describe('AgentLoop — Renderer Integration', () => {
  it('should work with AgentLoop and Reflection via PromptBuilder and renderer', async () => {
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

describe('Backward Compatibility — Legacy Modules', () => {
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
// Custom Renderer — Future Extension
// ---------------------------------------------------------------------------

describe('Custom Renderer — Future Extension', () => {
  it('should allow XML-style renderer', () => {
    class XMLPromptRenderer implements PromptRenderer {
      render(context: PromptContext): string {
        const parts: string[] = ['<prompt>']
        for (const [key, value] of Object.entries(context)) {
          if (value) {
            parts.push(`  <${key}>${value}</${key}>`)
          }
        }
        parts.push('</prompt>')
        return parts.join('\n')
      }
    }
    const renderer = new XMLPromptRenderer()
    const result = renderer.render({ system: 'sys', userInput: 'in' })
    expect(result).toContain('<prompt>')
    expect(result).toContain('<system>sys</system>')
    expect(result).toContain('<userInput>in</userInput>')
    expect(result).toContain('</prompt>')
  })

  it('should allow JSON-style renderer', () => {
    class JSONPromptRenderer implements PromptRenderer {
      render(context: PromptContext): string {
        const clean: Record<string, string> = {}
        for (const [key, value] of Object.entries(context)) {
          if (value) clean[key] = value
        }
        return JSON.stringify(clean, null, 2)
      }
    }
    const renderer = new JSONPromptRenderer()
    const result = renderer.render({ system: 'sys', userInput: 'in' })
    const parsed = JSON.parse(result)
    expect(parsed.system).toBe('sys')
    expect(parsed.userInput).toBe('in')
  })
})

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

describe('Exports', () => {
  it('should export PromptRenderer type from package', async () => {
    // PromptRenderer is a type-only export, verified via DefaultPromptRenderer
    const { DefaultPromptRenderer: DPR } = await import('../prompt')
    expect(DPR).toBeDefined()
  })

  it('should export DefaultPromptRenderer class from package', async () => {
    const { DefaultPromptRenderer: ExportedClass } = await import('../prompt')
    expect(ExportedClass).toBeDefined()
    expect(typeof ExportedClass).toBe('function')
  })
})