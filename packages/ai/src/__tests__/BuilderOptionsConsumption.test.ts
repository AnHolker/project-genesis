import { describe, it, expect } from 'vitest'
import { DefaultPromptBuilder } from '../prompt/DefaultPromptBuilder'
import type { BuilderOptions } from '../prompt/BuilderOptions'
import type { PromptRenderer } from '../prompt/PromptRenderer'
import type { PromptCompression } from '../prompt/PromptCompression'
import type { MemoryRanking } from '../prompt/MemoryRanking'
import type { PromptBudget } from '../prompt/PromptBudget'
import type { PromptSelection } from '../prompt/PromptSelection'
import type { ProviderBudget } from '../prompt/ProviderBudget'
import type { AIConfiguration } from '../config/AIConfiguration'
import { DefaultPromptRenderer } from '../prompt/DefaultPromptRenderer'
import { DefaultPromptCompression } from '../prompt/DefaultPromptCompression'
import { DefaultMemoryRanking } from '../prompt/DefaultMemoryRanking'
import { DefaultPromptBudget } from '../prompt/DefaultPromptBudget'
import { DefaultPromptSelection } from '../prompt/DefaultPromptSelection'
import { DefaultProviderBudget } from '../prompt/DefaultProviderBudget'
import { DefaultAIConfiguration } from '../config/DefaultAIConfiguration'
import type { PromptContext } from '../prompt/PromptContext'
import { UserInputModule, SystemPromptModule, MemoryPromptModule } from '../prompt/modules'
import { DefaultMemory } from '../memory/DefaultMemory'
import { DefaultReflection } from '../reflection/DefaultReflection'
import { DefaultAgentLoop } from '../agent/DefaultAgentLoop'
import { DefaultToolRegistry } from '../tools/ToolRegistry'
import { DefaultPipeline } from '../pipeline/DefaultPipeline'
import { MockPlanner, RetryPlanner, ToolCallPlanner } from '../planner'
import { MockPlannerProvider, MockStreamingProvider } from '../provider'

// ---------------------------------------------------------------------------
// BuilderOptions Consumption — Constructor
// ---------------------------------------------------------------------------

describe('DefaultPromptBuilder — BuilderOptions Constructor', () => {
  it('should accept BuilderOptions with all fields', () => {
    const options: BuilderOptions = {
      renderer: new DefaultPromptRenderer(),
      compression: new DefaultPromptCompression(),
      ranking: new DefaultMemoryRanking(),
      budget: new DefaultPromptBudget(),
      selection: new DefaultPromptSelection(),
      providerBudget: new DefaultProviderBudget(),
      configuration: new DefaultAIConfiguration(),
    }
    const builder = new DefaultPromptBuilder([new UserInputModule()], options)
    expect(builder).toBeDefined()
  })

  it('should accept BuilderOptions with no options (empty object)', () => {
    const builder = new DefaultPromptBuilder([new UserInputModule()], {})
    expect(builder).toBeDefined()
  })

  it('should accept BuilderOptions with single field', () => {
    const builder = new DefaultPromptBuilder([new UserInputModule()], {
      renderer: new DefaultPromptRenderer(),
    })
    expect(builder).toBeDefined()
  })

  it('should accept BuilderOptions with partial fields', () => {
    const builder = new DefaultPromptBuilder([new UserInputModule()], {
      renderer: new DefaultPromptRenderer(),
      budget: new DefaultPromptBudget(),
      configuration: new DefaultAIConfiguration(),
    })
    expect(builder).toBeDefined()
  })

  it('should accept BuilderOptions with custom implementation', () => {
    const customSelection: PromptSelection = {
      select: () => ({ selectedSections: ['userInput'], excludedSections: [] }),
    }
    const builder = new DefaultPromptBuilder([new UserInputModule()], {
      selection: customSelection,
    })
    expect(builder).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// BuilderOptions Consumption — Default Options
// ---------------------------------------------------------------------------

describe('DefaultPromptBuilder — Default Options', () => {
  it('should use defaults when no BuilderOptions provided', async () => {
    const builder = new DefaultPromptBuilder([new UserInputModule()])
    const request = await builder.build({ input: 'hello' })
    expect(request.prompt).toContain('hello')
  })

  it('should use defaults when BuilderOptions is undefined', async () => {
    const builder = new DefaultPromptBuilder([new UserInputModule()], undefined)
    const request = await builder.build({ input: 'hello' })
    expect(request.prompt).toContain('hello')
  })

  it('should use defaults when BuilderOptions is empty', async () => {
    const builder = new DefaultPromptBuilder([new UserInputModule()], {})
    const request = await builder.build({ input: 'hello' })
    expect(request.prompt).toContain('hello')
  })

  it('should use defaults for omitted fields only', async () => {
    const customRenderer = new DefaultPromptRenderer()
    const builder = new DefaultPromptBuilder([new UserInputModule()], {
      renderer: customRenderer,
      // compression, ranking, budget, selection omitted — should use defaults
    })
    const request = await builder.build({ input: 'hello' })
    expect(request.prompt).toContain('hello')
  })
})

// ---------------------------------------------------------------------------
// BuilderOptions Consumption — Full Options
// ---------------------------------------------------------------------------

describe('DefaultPromptBuilder — Full Options', () => {
  it('should produce identical build output with full BuilderOptions', async () => {
    const builder = new DefaultPromptBuilder(
      [new SystemPromptModule(), new UserInputModule()],
      {
        renderer: new DefaultPromptRenderer(),
        compression: new DefaultPromptCompression(),
        ranking: new DefaultMemoryRanking(),
        budget: new DefaultPromptBudget(),
        selection: new DefaultPromptSelection(),
        providerBudget: new DefaultProviderBudget(),
        configuration: new DefaultAIConfiguration(),
      },
    )
    const request = await builder.build({ input: 'hello' })
    expect(request.prompt).toContain('Project Genesis')
    expect(request.prompt).toContain('hello')
  })

  it('should produce identical buildContext output with full BuilderOptions', async () => {
    const builder = new DefaultPromptBuilder(
      [new SystemPromptModule(), new UserInputModule()],
      {
        renderer: new DefaultPromptRenderer(),
        compression: new DefaultPromptCompression(),
        ranking: new DefaultMemoryRanking(),
        budget: new DefaultPromptBudget(),
        selection: new DefaultPromptSelection(),
      },
    )
    const ctx = await builder.buildContext({ input: 'hello' })
    expect(ctx.system).toBeDefined()
    expect(ctx.userInput).toBe('hello')
  })
})

// ---------------------------------------------------------------------------
// BuilderOptions Consumption — Backward Compatibility (Legacy Positional Form)
// ---------------------------------------------------------------------------

describe('DefaultPromptBuilder — Backward Compatibility (Legacy Positional Form)', () => {
  it('should support legacy 1-param constructor (modules only)', async () => {
    const builder = new DefaultPromptBuilder([new UserInputModule()])
    const request = await builder.build({ input: 'hello' })
    expect(request.prompt).toContain('hello')
  })

  it('should support legacy 2-param constructor (modules + renderer)', async () => {
    const builder = new DefaultPromptBuilder(
      [new UserInputModule()],
      new DefaultPromptRenderer(),
    )
    const request = await builder.build({ input: 'hello' })
    expect(request.prompt).toContain('hello')
  })

  it('should support legacy 3-param constructor (modules + renderer + compression)', async () => {
    const builder = new DefaultPromptBuilder(
      [new UserInputModule()],
      new DefaultPromptRenderer(),
      new DefaultPromptCompression(),
    )
    const request = await builder.build({ input: 'hello' })
    expect(request.prompt).toContain('hello')
  })

  it('should support legacy 4-param constructor (modules + renderer + compression + ranking)', async () => {
    const builder = new DefaultPromptBuilder(
      [new UserInputModule()],
      new DefaultPromptRenderer(),
      new DefaultPromptCompression(),
      new DefaultMemoryRanking(),
    )
    const request = await builder.build({ input: 'hello' })
    expect(request.prompt).toContain('hello')
  })

  it('should support legacy 5-param constructor (modules + renderer + compression + ranking + budget)', async () => {
    const builder = new DefaultPromptBuilder(
      [new UserInputModule()],
      new DefaultPromptRenderer(),
      new DefaultPromptCompression(),
      new DefaultMemoryRanking(),
      new DefaultPromptBudget(),
    )
    const request = await builder.build({ input: 'hello' })
    expect(request.prompt).toContain('hello')
  })

  it('should support legacy 6-param constructor (modules + renderer + compression + ranking + budget + selection)', async () => {
    const builder = new DefaultPromptBuilder(
      [new UserInputModule()],
      new DefaultPromptRenderer(),
      new DefaultPromptCompression(),
      new DefaultMemoryRanking(),
      new DefaultPromptBudget(),
      new DefaultPromptSelection(),
    )
    const request = await builder.build({ input: 'hello' })
    expect(request.prompt).toContain('hello')
  })

  it('should support legacy 7-param constructor (modules + renderer + compression + ranking + budget + selection + providerBudget)', async () => {
    const builder = new DefaultPromptBuilder(
      [new UserInputModule()],
      new DefaultPromptRenderer(),
      new DefaultPromptCompression(),
      new DefaultMemoryRanking(),
      new DefaultPromptBudget(),
      new DefaultPromptSelection(),
      new DefaultProviderBudget(),
    )
    const request = await builder.build({ input: 'hello' })
    expect(request.prompt).toContain('hello')
  })

  it('should support legacy 8-param constructor (modules + renderer + compression + ranking + budget + selection + providerBudget + configuration)', async () => {
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
    const request = await builder.build({ input: 'hello' })
    expect(request.prompt).toContain('hello')
  })

  it('should support legacy constructor with undefined for some params', async () => {
    const builder = new DefaultPromptBuilder(
      [new UserInputModule()],
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      new DefaultProviderBudget(),
      new DefaultAIConfiguration(),
    )
    const request = await builder.build({ input: 'hello' })
    expect(request.prompt).toContain('hello')
  })
})

// ---------------------------------------------------------------------------
// BuilderOptions Consumption — Identical Behavior (BuilderOptions vs Legacy)
// ---------------------------------------------------------------------------

describe('DefaultPromptBuilder — Identical Behavior (BuilderOptions vs Legacy)', () => {
  it('should produce identical output with BuilderOptions vs legacy full param form', async () => {
    const modules = [new SystemPromptModule(), new UserInputModule()]

    const builderOptions = new DefaultPromptBuilder(modules, {
      renderer: new DefaultPromptRenderer(),
      compression: new DefaultPromptCompression(),
      ranking: new DefaultMemoryRanking(),
      budget: new DefaultPromptBudget(),
      selection: new DefaultPromptSelection(),
      providerBudget: new DefaultProviderBudget(),
      configuration: new DefaultAIConfiguration(),
    })

    const builderLegacy = new DefaultPromptBuilder(
      modules,
      new DefaultPromptRenderer(),
      new DefaultPromptCompression(),
      new DefaultMemoryRanking(),
      new DefaultPromptBudget(),
      new DefaultPromptSelection(),
      new DefaultProviderBudget(),
      new DefaultAIConfiguration(),
    )

    const result1 = await builderOptions.build({ input: 'hello' })
    const result2 = await builderLegacy.build({ input: 'hello' })

    expect(result1.prompt).toBe(result2.prompt)
  })

  it('should produce identical output with BuilderOptions vs legacy partial param form', async () => {
    const modules = [new SystemPromptModule(), new UserInputModule()]

    const builderOptions = new DefaultPromptBuilder(modules, {
      renderer: new DefaultPromptRenderer(),
      budget: new DefaultPromptBudget(),
    })

    const builderLegacy = new DefaultPromptBuilder(
      modules,
      new DefaultPromptRenderer(),
      undefined,
      undefined,
      new DefaultPromptBudget(),
    )

    const result1 = await builderOptions.build({ input: 'hello' })
    const result2 = await builderLegacy.build({ input: 'hello' })

    expect(result1.prompt).toBe(result2.prompt)
  })
})

// ---------------------------------------------------------------------------
// BuilderOptions Consumption — PromptAssembly Unchanged
// ---------------------------------------------------------------------------

describe('DefaultPromptBuilder — PromptAssembly Unchanged', () => {
  it('should attach assembly metadata with BuilderOptions form', async () => {
    const builder = new DefaultPromptBuilder([new UserInputModule()], {
      ranking: new DefaultMemoryRanking(),
      budget: new DefaultPromptBudget(),
    })
    const request = await builder.build({ input: 'hello' })
    expect(request.metadata).toBeDefined()
    const assembly = request.metadata!.promptAssembly as Record<string, unknown>
    expect(assembly).toBeDefined()
    expect(assembly.ranking).toBeDefined()
    expect(assembly.budget).toBeDefined()
  })

  it('should preserve execution order with BuilderOptions form', async () => {
    const executionOrder: string[] = []

    class TracedRanking implements MemoryRanking {
      rank(context: PromptContext): import('../prompt/MemoryRankingResult').MemoryRankingResult {
        executionOrder.push('ranking')
        return { rankedSections: Object.keys(context), priorities: {} }
      }
    }

    class TracedBudget implements PromptBudget {
      calculate(context: PromptContext): import('../prompt/PromptBudgetResult').PromptBudgetResult {
        executionOrder.push('budget')
        const sectionLengths: Record<string, number> = {}
        for (const key of Object.keys(context)) {
          sectionLengths[key] = String(context[key as keyof PromptContext] ?? '').length
        }
        return { totalLength: Object.values(sectionLengths).reduce((a, b) => a + b, 0), sectionLengths }
      }
    }

    const builder = new DefaultPromptBuilder([new UserInputModule()], {
      ranking: new TracedRanking(),
      budget: new TracedBudget(),
    })

    await builder.build({ input: 'hello' })

    expect(executionOrder).toEqual(['ranking', 'budget'])
  })
})

// ---------------------------------------------------------------------------
// BuilderOptions Consumption — ProviderBudget Integration
// ---------------------------------------------------------------------------

describe('DefaultPromptBuilder — ProviderBudget Integration', () => {
  it('should pass ProviderBudget result with BuilderOptions form', async () => {
    const builder = new DefaultPromptBuilder(
      [new UserInputModule()],
      {
        providerBudget: new DefaultProviderBudget(),
        configuration: { provider: 'openai', model: 'gpt-4', temperature: 0, maxTokens: 0 },
      },
    )
    const request = await builder.build({ input: 'hello' })
    expect(request.metadata).toBeDefined()
    const assembly = request.metadata!.promptAssembly as Record<string, unknown>
    expect(assembly.providerBudget).toBeDefined()
  })

  it('should not include providerBudget metadata when not configured', async () => {
    const builder = new DefaultPromptBuilder([new UserInputModule()], {})
    const request = await builder.build({ input: 'hello' })
    expect(request.metadata).toBeDefined()
    const assembly = request.metadata!.promptAssembly as Record<string, unknown>
    expect(assembly.providerBudget).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// BuilderOptions Consumption — AIConfiguration Integration
// ---------------------------------------------------------------------------

describe('DefaultPromptBuilder — AIConfiguration Integration', () => {
  it('should accept AIConfiguration via BuilderOptions', async () => {
    const builder = new DefaultPromptBuilder([new UserInputModule()], {
      configuration: {
        provider: 'openai',
        model: 'gpt-4o',
        temperature: 0,
        maxTokens: 0,
      },
    })
    const request = await builder.build({ input: 'hello' })
    expect(request.prompt).toContain('hello')
  })

  it('should use configuration for ProviderBudget lookup', async () => {
    const builder = new DefaultPromptBuilder(
      [new UserInputModule()],
      {
        providerBudget: new DefaultProviderBudget(),
        configuration: { provider: 'deepseek', model: 'deepseek-chat', temperature: 0, maxTokens: 0 },
      },
    )
    const request = await builder.build({ input: 'hello' })
    expect(request.metadata).toBeDefined()
    const assembly = request.metadata!.promptAssembly as Record<string, unknown>
    expect(assembly.providerBudget).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// BuilderOptions Consumption — Deterministic Behavior
// ---------------------------------------------------------------------------

describe('DefaultPromptBuilder — Deterministic', () => {
  it('should produce identical output for same BuilderOptions input', async () => {
    const builder = new DefaultPromptBuilder([new UserInputModule()], {
      renderer: new DefaultPromptRenderer(),
      compression: new DefaultPromptCompression(),
    })
    const r1 = await builder.build({ input: 'test' })
    const r2 = await builder.build({ input: 'test' })
    expect(r1.prompt).toBe(r2.prompt)
  })

  it('should produce identical output for different instances with same options', async () => {
    const b1 = new DefaultPromptBuilder([new UserInputModule()], {
      renderer: new DefaultPromptRenderer(),
    })
    const b2 = new DefaultPromptBuilder([new UserInputModule()], {
      renderer: new DefaultPromptRenderer(),
    })
    const r1 = await b1.build({ input: 'test' })
    const r2 = await b2.build({ input: 'test' })
    expect(r1.prompt).toBe(r2.prompt)
  })
})

// ---------------------------------------------------------------------------
// BuilderOptions Consumption — Immutability
// ---------------------------------------------------------------------------

describe('DefaultPromptBuilder — Immutability', () => {
  it('should not mutate the BuilderOptions object', () => {
    const options: BuilderOptions = {
      renderer: new DefaultPromptRenderer(),
      compression: new DefaultPromptCompression(),
    }
    const beforeKeys = Object.keys(options)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const builder = new DefaultPromptBuilder([new UserInputModule()], options)
    expect(Object.keys(options)).toEqual(beforeKeys)
    expect(options.renderer).toBeDefined()
    expect(options.compression).toBeDefined()
  })

  it('should not modify option fields after construction', async () => {
    const options: BuilderOptions = {
      renderer: new DefaultPromptRenderer(),
    }
    const builder = new DefaultPromptBuilder([new UserInputModule()], options)
    options.renderer = undefined // Would only affect our local reference
    const request = await builder.build({ input: 'hello' })
    expect(request.prompt).toContain('hello')
  })
})

// ---------------------------------------------------------------------------
// BuilderOptions Consumption — RetryPlanner Compatibility
// ---------------------------------------------------------------------------

describe('BuilderOptions — RetryPlanner Compatibility', () => {
  it('should work with RetryPlanner when constructed with BuilderOptions', async () => {
    const builder = new DefaultPromptBuilder([new UserInputModule()], {
      renderer: new DefaultPromptRenderer(),
    })
    const planner = new RetryPlanner(new MockPlannerProvider(new DefaultAIConfiguration()))
    const request = await builder.build({ input: 'hello' })
    const result = await planner.plan(request)
    expect(result.actions).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// BuilderOptions Consumption — ToolCallPlanner Compatibility
// ---------------------------------------------------------------------------

describe('BuilderOptions — ToolCallPlanner Compatibility', () => {
  it('should work with ToolCallPlanner when constructed with BuilderOptions', async () => {
    const builder = new DefaultPromptBuilder([new UserInputModule()], {
      renderer: new DefaultPromptRenderer(),
    })
    const planner = new ToolCallPlanner(new MockPlannerProvider(new DefaultAIConfiguration()), new DefaultToolRegistry())
    const request = await builder.build({ input: 'hello' })
    const result = await planner.plan(request)
    expect(result.actions).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// BuilderOptions Consumption — Streaming Compatibility
// ---------------------------------------------------------------------------

describe('BuilderOptions — Streaming Compatibility', () => {
  it('should work with streaming when constructed with BuilderOptions', async () => {
    const builder = new DefaultPromptBuilder([new UserInputModule()], {
      renderer: new DefaultPromptRenderer(),
    })
    const provider = new MockStreamingProvider()
    const planner = new MockPlanner(provider)
    const pipeline = new DefaultPipeline(planner, builder, provider)
    const context = await pipeline.stream({ input: 'hello' })
    expect(context.plannerResult).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// BuilderOptions Consumption — AgentLoop Compatibility
// ---------------------------------------------------------------------------

describe('BuilderOptions — AgentLoop Compatibility', () => {
  it('should work with AgentLoop and Reflection when constructed with BuilderOptions', async () => {
    const builder = new DefaultPromptBuilder([new SystemPromptModule(), new UserInputModule()], {
      renderer: new DefaultPromptRenderer(),
      compression: new DefaultPromptCompression(),
    })
    const provider = new MockPlannerProvider(new DefaultAIConfiguration())
    const planner = new MockPlanner(provider)
    const pipeline = new DefaultPipeline(planner, builder, provider)
    const context = await pipeline.execute({ input: 'hello' })
    expect(context.plannerResult).toBeDefined()
  })

  it('should work with DefaultAgentLoop directly when constructed with BuilderOptions', async () => {
    const builder = new DefaultPromptBuilder([new UserInputModule()], {
      renderer: new DefaultPromptRenderer(),
    })
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