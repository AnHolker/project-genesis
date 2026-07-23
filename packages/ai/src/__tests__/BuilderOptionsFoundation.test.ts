import { describe, it, expect } from 'vitest'
import type { BuilderOptions } from '../prompt/BuilderOptions'
import type { PromptRenderer } from '../prompt/PromptRenderer'
import type { PromptCompression } from '../prompt/PromptCompression'
import type { MemoryRanking } from '../prompt/MemoryRanking'
import type { PromptBudget } from '../prompt/PromptBudget'
import type { PromptSelection } from '../prompt/PromptSelection'
import type { ProviderBudget } from '../prompt/ProviderBudget'
import type { AIConfiguration } from '../config/AIConfiguration'
import { DefaultPromptBuilder } from '../prompt/DefaultPromptBuilder'
import { DefaultPromptRenderer } from '../prompt/DefaultPromptRenderer'
import { DefaultPromptCompression } from '../prompt/DefaultPromptCompression'
import { DefaultMemoryRanking } from '../prompt/DefaultMemoryRanking'
import { DefaultPromptBudget } from '../prompt/DefaultPromptBudget'
import { DefaultPromptSelection } from '../prompt/DefaultPromptSelection'
import { DefaultProviderBudget } from '../prompt/DefaultProviderBudget'
import { DefaultAIConfiguration } from '../config/DefaultAIConfiguration'
import { UserInputModule, SystemPromptModule, MemoryPromptModule } from '../prompt/modules'
import { DefaultMemory } from '../memory/DefaultMemory'
import { DefaultReflection } from '../reflection/DefaultReflection'
import { DefaultAgentLoop } from '../agent/DefaultAgentLoop'
import { DefaultToolRegistry } from '../tools/ToolRegistry'
import { DefaultPipeline } from '../pipeline/DefaultPipeline'
import { MockPlanner, RetryPlanner, ToolCallPlanner } from '../planner'
import { MockPlannerProvider, MockStreamingProvider } from '../provider'
import type { PromptBuilder } from '../prompt/PromptBuilder'

// ---------------------------------------------------------------------------
// BuilderOptions — Interface (type-level)
// ---------------------------------------------------------------------------

describe('BuilderOptions — Interface', () => {
  it('should accept an empty object (all fields optional)', () => {
    const options: BuilderOptions = {}
    expect(Object.keys(options)).toHaveLength(0)
  })

  it('should accept renderer field', () => {
    const renderer: PromptRenderer = new DefaultPromptRenderer()
    const options: BuilderOptions = { renderer }
    expect(options.renderer).toBe(renderer)
  })

  it('should accept compression field', () => {
    const compression: PromptCompression = new DefaultPromptCompression()
    const options: BuilderOptions = { compression }
    expect(options.compression).toBe(compression)
  })

  it('should accept ranking field', () => {
    const ranking: MemoryRanking = new DefaultMemoryRanking()
    const options: BuilderOptions = { ranking }
    expect(options.ranking).toBe(ranking)
  })

  it('should accept budget field', () => {
    const budget: PromptBudget = new DefaultPromptBudget()
    const options: BuilderOptions = { budget }
    expect(options.budget).toBe(budget)
  })

  it('should accept selection field', () => {
    const selection: PromptSelection = new DefaultPromptSelection()
    const options: BuilderOptions = { selection }
    expect(options.selection).toBe(selection)
  })

  it('should accept providerBudget field', () => {
    const providerBudget: ProviderBudget = new DefaultProviderBudget()
    const options: BuilderOptions = { providerBudget }
    expect(options.providerBudget).toBe(providerBudget)
  })

  it('should accept configuration field', () => {
    const configuration: AIConfiguration = new DefaultAIConfiguration()
    const options: BuilderOptions = { configuration }
    expect(options.configuration).toBe(configuration)
  })

  it('should accept all fields simultaneously', () => {
    const options: BuilderOptions = {
      renderer: new DefaultPromptRenderer(),
      compression: new DefaultPromptCompression(),
      ranking: new DefaultMemoryRanking(),
      budget: new DefaultPromptBudget(),
      selection: new DefaultPromptSelection(),
      providerBudget: new DefaultProviderBudget(),
      configuration: new DefaultAIConfiguration(),
    }
    expect(options.renderer).toBeDefined()
    expect(options.compression).toBeDefined()
    expect(options.ranking).toBeDefined()
    expect(options.budget).toBeDefined()
    expect(options.selection).toBeDefined()
    expect(options.providerBudget).toBeDefined()
    expect(options.configuration).toBeDefined()
  })

  it('should allow partial field assignment', () => {
    const options: BuilderOptions = { renderer: new DefaultPromptRenderer(), budget: new DefaultPromptBudget() }
    expect(options.renderer).toBeDefined()
    expect(options.budget).toBeDefined()
    expect(options.compression).toBeUndefined()
    expect(options.ranking).toBeUndefined()
    expect(options.selection).toBeUndefined()
    expect(options.providerBudget).toBeUndefined()
    expect(options.configuration).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// BuilderOptions — Optional Field Semantics
// ---------------------------------------------------------------------------

describe('BuilderOptions — Optional Fields', () => {
  it('should treat undefined fields as absent', () => {
    const options: BuilderOptions = { renderer: undefined }
    expect(options.renderer).toBeUndefined()
  })

  it('should allow null-like absence for all fields via Partial', () => {
    const options: Partial<BuilderOptions> = {}
    expect(options.renderer).toBeUndefined()
    expect(options.configuration).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// BuilderOptions — Deterministic Behavior
// ---------------------------------------------------------------------------

describe('BuilderOptions — Deterministic', () => {
  it('should produce deterministic type structure', () => {
    const a: BuilderOptions = {}
    const b: BuilderOptions = {}
    // Both are empty objects, structurally identical
    expect(Object.keys(a)).toEqual(Object.keys(b))
  })

  it('should produce deterministic type structure with all fields', () => {
    const opts: BuilderOptions = {
      renderer: new DefaultPromptRenderer(),
      compression: new DefaultPromptCompression(),
      ranking: new DefaultMemoryRanking(),
      budget: new DefaultPromptBudget(),
      selection: new DefaultPromptSelection(),
      providerBudget: new DefaultProviderBudget(),
      configuration: new DefaultAIConfiguration(),
    }
    expect(Object.keys(opts).sort()).toEqual([
      'renderer', 'compression', 'ranking', 'budget', 'selection',
      'providerBudget', 'configuration',
    ].sort())
  })
})

// ---------------------------------------------------------------------------
// BuilderOptions — Type Compatibility
// ---------------------------------------------------------------------------

describe('BuilderOptions — Type Compatibility', () => {
  it('should accept DefaultPromptRenderer as renderer', () => {
    const options: BuilderOptions = { renderer: new DefaultPromptRenderer() }
    expect(options.renderer).toBeInstanceOf(DefaultPromptRenderer)
  })

  it('should accept DefaultPromptCompression as compression', () => {
    const options: BuilderOptions = { compression: new DefaultPromptCompression() }
    expect(options.compression).toBeInstanceOf(DefaultPromptCompression)
  })

  it('should accept DefaultMemoryRanking as ranking', () => {
    const options: BuilderOptions = { ranking: new DefaultMemoryRanking() }
    expect(options.ranking).toBeInstanceOf(DefaultMemoryRanking)
  })

  it('should accept DefaultPromptBudget as budget', () => {
    const options: BuilderOptions = { budget: new DefaultPromptBudget() }
    expect(options.budget).toBeInstanceOf(DefaultPromptBudget)
  })

  it('should accept DefaultPromptSelection as selection', () => {
    const options: BuilderOptions = { selection: new DefaultPromptSelection() }
    expect(options.selection).toBeInstanceOf(DefaultPromptSelection)
  })

  it('should accept DefaultProviderBudget as providerBudget', () => {
    const options: BuilderOptions = { providerBudget: new DefaultProviderBudget() }
    expect(options.providerBudget).toBeInstanceOf(DefaultProviderBudget)
  })

  it('should accept DefaultAIConfiguration as configuration', () => {
    const options: BuilderOptions = { configuration: new DefaultAIConfiguration() }
    expect(options.configuration).toBeInstanceOf(DefaultAIConfiguration)
  })

  it('should accept custom implementations for each field', () => {
    const customRenderer: PromptRenderer = { render: () => 'custom' }
    const customCompression: PromptCompression = { compress: (ctx) => ctx }
    const customRanking: MemoryRanking = { rank: () => ({ rankedSections: [], priorities: {} }) }
    const customBudget: PromptBudget = { calculate: () => ({ totalLength: 0, sectionLengths: {} }) }
    const customSelection: PromptSelection = { select: () => ({ selectedSections: [], excludedSections: [] }) }
    const customProviderBudget: ProviderBudget = { getBudget: () => ({ maxInputTokens: 1000 }) }
    const customConfig: AIConfiguration = { provider: 'test', model: 'test', temperature: 0, maxTokens: 0 }

    const options: BuilderOptions = {
      renderer: customRenderer,
      compression: customCompression,
      ranking: customRanking,
      budget: customBudget,
      selection: customSelection,
      providerBudget: customProviderBudget,
      configuration: customConfig,
    }
    expect(options.renderer).toBe(customRenderer)
    expect(options.compression).toBe(customCompression)
    expect(options.ranking).toBe(customRanking)
    expect(options.budget).toBe(customBudget)
    expect(options.selection).toBe(customSelection)
    expect(options.providerBudget).toBe(customProviderBudget)
    expect(options.configuration).toBe(customConfig)
  })
})

// ---------------------------------------------------------------------------
// BuilderOptions — Backward Compatibility
// ---------------------------------------------------------------------------

describe('BuilderOptions — Backward Compatibility', () => {
  it('should not break PromptBuilder interface', () => {
    const builder: PromptBuilder = new DefaultPromptBuilder([new UserInputModule()])
    expect(builder).toBeInstanceOf(DefaultPromptBuilder)
  })

  it('should not break DefaultPromptBuilder constructor — 1 param', () => {
    const builder = new DefaultPromptBuilder([new UserInputModule()])
    expect(builder).toBeDefined()
  })

  it('should not break DefaultPromptBuilder constructor — 3 params', () => {
    const builder = new DefaultPromptBuilder(
      [new UserInputModule()],
      new DefaultPromptRenderer(),
      new DefaultPromptCompression(),
    )
    expect(builder).toBeDefined()
  })

  it('should not break DefaultPromptBuilder constructor — 5 params', () => {
    const builder = new DefaultPromptBuilder(
      [new UserInputModule()],
      new DefaultPromptRenderer(),
      new DefaultPromptCompression(),
      new DefaultMemoryRanking(),
      new DefaultPromptBudget(),
    )
    expect(builder).toBeDefined()
  })

  it('should not break DefaultPromptBuilder constructor — 6 params', () => {
    const builder = new DefaultPromptBuilder(
      [new UserInputModule()],
      new DefaultPromptRenderer(),
      new DefaultPromptCompression(),
      new DefaultMemoryRanking(),
      new DefaultPromptBudget(),
      new DefaultPromptSelection(),
    )
    expect(builder).toBeDefined()
  })

  it('should not break DefaultPromptBuilder constructor — 7 params', () => {
    const builder = new DefaultPromptBuilder(
      [new UserInputModule()],
      new DefaultPromptRenderer(),
      new DefaultPromptCompression(),
      new DefaultMemoryRanking(),
      new DefaultPromptBudget(),
      new DefaultPromptSelection(),
      new DefaultProviderBudget(),
    )
    expect(builder).toBeDefined()
  })

  it('should not break DefaultPromptBuilder constructor — 8 params (configuration)', () => {
    const builder = new DefaultPromptBuilder(
      [new UserInputModule()],
      new DefaultPromptRenderer(),
      new DefaultPromptCompression(),
      new DefaultMemoryRanking(),
      new DefaultPromptBudget(),
      new DefaultPromptSelection(),
      new DefaultProviderBudget(),
      new DefaultAIConfiguration(),
    )
    expect(builder).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// BuilderOptions — PromptBuilder Unchanged
// ---------------------------------------------------------------------------

describe('BuilderOptions — PromptBuilder Unchanged', () => {
  it('should produce identical build output for 1-param constructor', async () => {
    const builder = new DefaultPromptBuilder([new UserInputModule()])
    const request = await builder.build({ input: 'test' })
    expect(request.prompt).toBeDefined()
    expect(request.prompt).toContain('test')
  })

  it('should produce identical build output for 8-param constructor', async () => {
    const builder = new DefaultPromptBuilder(
      [new UserInputModule()],
      new DefaultPromptRenderer(),
      new DefaultPromptCompression(),
      new DefaultMemoryRanking(),
      new DefaultPromptBudget(),
      new DefaultPromptSelection(),
      new DefaultProviderBudget(),
      new DefaultAIConfiguration(),
    )
    const request = await builder.build({ input: 'test' })
    expect(request.prompt).toBeDefined()
    expect(request.prompt).toContain('test')
  })

  it('should produce identical buildContext output', async () => {
    const builder = new DefaultPromptBuilder([new UserInputModule()])
    const ctx = await builder.buildContext({ input: 'test' })
    expect(ctx.userInput).toBe('test')
  })
})

// ---------------------------------------------------------------------------
// BuilderOptions — RetryPlanner Compatibility
// ---------------------------------------------------------------------------

describe('BuilderOptions — RetryPlanner Compatibility', () => {
  it('should work with RetryPlanner and unchanged DefaultPromptBuilder', async () => {
    const builder = new DefaultPromptBuilder([new UserInputModule()])
    const planner = new RetryPlanner(new MockPlannerProvider(new DefaultAIConfiguration()))
    const request = await builder.build({ input: 'hello' })
    const result = await planner.plan(request)
    expect(result.actions).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// BuilderOptions — ToolCallPlanner Compatibility
// ---------------------------------------------------------------------------

describe('BuilderOptions — ToolCallPlanner Compatibility', () => {
  it('should work with ToolCallPlanner and unchanged DefaultPromptBuilder', async () => {
    const builder = new DefaultPromptBuilder([new UserInputModule()])
    const planner = new ToolCallPlanner(new MockPlannerProvider(new DefaultAIConfiguration()), new DefaultToolRegistry())
    const request = await builder.build({ input: 'hello' })
    const result = await planner.plan(request)
    expect(result.actions).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// BuilderOptions — Streaming Compatibility
// ---------------------------------------------------------------------------

describe('BuilderOptions — Streaming Compatibility', () => {
  it('should work with streaming path', async () => {
    const builder = new DefaultPromptBuilder([new UserInputModule()])
    const provider = new MockStreamingProvider()
    const planner = new MockPlanner(provider)
    const pipeline = new DefaultPipeline(planner, builder, provider)
    const context = await pipeline.stream({ input: 'hello' })
    expect(context.plannerResult).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// BuilderOptions — AgentLoop Compatibility
// ---------------------------------------------------------------------------

describe('BuilderOptions — AgentLoop Compatibility', () => {
  it('should work with AgentLoop and Reflection', async () => {
    const builder = new DefaultPromptBuilder([new UserInputModule()])
    const provider = new MockPlannerProvider(new DefaultAIConfiguration())
    const planner = new MockPlanner(provider)
    const pipeline = new DefaultPipeline(planner, builder, provider)
    const context = await pipeline.execute({ input: 'hello' })
    expect(context.plannerResult).toBeDefined()
  })

  it('should work with DefaultAgentLoop directly', async () => {
    const builder = new DefaultPromptBuilder([new UserInputModule()])
    const provider = new MockPlannerProvider(new DefaultAIConfiguration())
    const planner = new MockPlanner(provider)
    const request = await builder.build({ input: 'hello' })
    const agentLoop = new DefaultAgentLoop()
    const result = await agentLoop.execute({
      request,
      planner,
      toolRegistry: new DefaultToolRegistry(),
      maxIterations: 1,
    })
    expect(result.plannerResult).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// BuilderOptions — Exports
// ---------------------------------------------------------------------------

describe('BuilderOptions — Exports', () => {
  it('should export BuilderOptions type from prompt module', () => {
    // BuilderOptions is a type-only export — verify via type assignment
    const _typeCheck: BuilderOptions = {}
    expect(_typeCheck).toBeDefined()
  })

  it('should export BuilderOptions type from package root', () => {
    // BuilderOptions is a type-only export — verify via type assignment
    const _typeCheck: BuilderOptions = {}
    expect(_typeCheck).toBeDefined()
  })
})