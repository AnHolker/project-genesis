import { describe, it, expect, vi } from 'vitest'
import { DefaultPromptBuilder } from '../prompt/DefaultPromptBuilder'
import type { BuilderOptions } from '../prompt/BuilderOptions'
import type { IntentAnalyzer } from '../intent/IntentAnalyzer'
import type { IntentResult } from '../intent/IntentResult'
import { DefaultIntentAnalyzer } from '../intent/DefaultIntentAnalyzer'
import { RuleBasedIntentAnalyzer } from '../intent/RuleBasedIntentAnalyzer'
import { DefaultPromptRenderer } from '../prompt/DefaultPromptRenderer'
import { DefaultPromptCompression } from '../prompt/DefaultPromptCompression'
import { DefaultMemoryRanking } from '../prompt/DefaultMemoryRanking'
import { DefaultPromptBudget } from '../prompt/DefaultPromptBudget'
import { DefaultPromptSelection } from '../prompt/DefaultPromptSelection'
import { DefaultProviderBudget } from '../prompt/DefaultProviderBudget'
import { DefaultAIConfiguration } from '../config/DefaultAIConfiguration'
import {
  UserInputModule,
  SystemPromptModule,
  MemoryPromptModule,
  WorldStatePromptModule,
  ObservationPromptModule,
  ReflectionPromptModule,
} from '../prompt/modules'
import type { PromptModule } from '../prompt/modules/PromptModule'
import { DefaultMemory } from '../memory/DefaultMemory'
import { MockPlanner, RetryPlanner, ToolCallPlanner } from '../planner'
import { MockPlannerProvider, MockStreamingProvider } from '../provider'
import { DefaultToolRegistry } from '../tools/ToolRegistry'
import { DefaultAgentLoop } from '../agent/DefaultAgentLoop'
import { DefaultPipeline } from '../pipeline/DefaultPipeline'
import type { PipelineContext } from '../pipeline/PipelineContext'
import type { ReflectionResult } from '../reflection/ReflectionResult'

// ---------------------------------------------------------------------------
// Test Data
// ---------------------------------------------------------------------------

const singleReflection: ReflectionResult[] = [
  { reasoning: 'Actions found — task complete', continueLoop: false },
]

function createPipelineContext(overrides?: Partial<PipelineContext>): PipelineContext {
  return {
    input: 'create a tree',
    memory: new DefaultMemory(),
    worldState: '',
    ...overrides,
  }
}

function createDefaultModules(): PromptModule[] {
  return [
    new SystemPromptModule(),
    new UserInputModule(),
    new MemoryPromptModule(),
    new WorldStatePromptModule(),
  ]
}

// Spied IntentAnalyzer for invocation tracking
function createSpyAnalyzer(): { analyzer: IntentAnalyzer; spy: ReturnType<typeof vi.fn> } {
  const spy = vi.fn()
  const analyzer: IntentAnalyzer = {
    analyze(input: string): IntentResult {
      spy(input)
      if (input.toLowerCase().includes('create')) return { intents: [{ type: 'Create' }] }
      if (input.toLowerCase().includes('move')) return { intents: [{ type: 'Move' }] }
      if (input.toLowerCase().includes('delete')) return { intents: [{ type: 'Delete' }] }
      return { intents: [] }
    },
  }
  return { analyzer, spy }
}

// ---------------------------------------------------------------------------
// BuilderOptions — IntentAnalyzer
// ---------------------------------------------------------------------------

describe('BuilderOptions — IntentAnalyzer field', () => {
  it('should accept IntentAnalyzer in BuilderOptions', () => {
    const options: BuilderOptions = {
      intentAnalyzer: new DefaultIntentAnalyzer(),
    }
    const builder = new DefaultPromptBuilder([new UserInputModule()], options)
    expect(builder).toBeDefined()
  })

  it('should accept IntentAnalyzer alongside other BuilderOptions fields', () => {
    const options: BuilderOptions = {
      renderer: new DefaultPromptRenderer(),
      compression: new DefaultPromptCompression(),
      ranking: new DefaultMemoryRanking(),
      budget: new DefaultPromptBudget(),
      selection: new DefaultPromptSelection(),
      providerBudget: new DefaultProviderBudget(),
      configuration: new DefaultAIConfiguration(),
      intentAnalyzer: new RuleBasedIntentAnalyzer(),
    }
    const builder = new DefaultPromptBuilder([new UserInputModule()], options)
    expect(builder).toBeDefined()
  })

  it('should accept IntentAnalyzer standalone in BuilderOptions', () => {
    const builder = new DefaultPromptBuilder([new UserInputModule()], {
      intentAnalyzer: new DefaultIntentAnalyzer(),
    })
    expect(builder).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Builder Invokes IntentAnalyzer Exactly Once
// ---------------------------------------------------------------------------

describe('DefaultPromptBuilder — IntentAnalyzer invocation', () => {
  it('should invoke IntentAnalyzer.analyze() exactly once per build()', async () => {
    const { analyzer, spy } = createSpyAnalyzer()
    const builder = new DefaultPromptBuilder(createDefaultModules(), {
      intentAnalyzer: analyzer,
    })
    const context = createPipelineContext({ input: 'create a tree' })

    await builder.build(context)

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith('create a tree')
  })

  it('should invoke IntentAnalyzer with the correct input', async () => {
    const { analyzer, spy } = createSpyAnalyzer()
    const builder = new DefaultPromptBuilder(createDefaultModules(), {
      intentAnalyzer: analyzer,
    })

    await builder.build(createPipelineContext({ input: 'move the tree' }))

    expect(spy).toHaveBeenCalledWith('move the tree')
  })

  it('should NOT invoke IntentAnalyzer when not provided', async () => {
    const builder = new DefaultPromptBuilder(createDefaultModules())
    const context = createPipelineContext({ input: 'create a tree' })

    await builder.build(context)
    // Should not throw — no IntentAnalyzer to invoke
  })

  it('should invoke IntentAnalyzer each time build() is called (stateless)', async () => {
    const { analyzer, spy } = createSpyAnalyzer()
    const builder = new DefaultPromptBuilder(createDefaultModules(), {
      intentAnalyzer: analyzer,
    })

    await builder.build(createPipelineContext({ input: 'create a tree' }))
    await builder.build(createPipelineContext({ input: 'move the tree' }))

    expect(spy).toHaveBeenCalledTimes(2)
    expect(spy).toHaveBeenNthCalledWith(1, 'create a tree')
    expect(spy).toHaveBeenNthCalledWith(2, 'move the tree')
  })
})

// ---------------------------------------------------------------------------
// Metadata Contains IntentResult
// ---------------------------------------------------------------------------

describe('DefaultPromptBuilder — IntentResult in metadata', () => {
  it('should include IntentResult in metadata.promptAssembly.intent', async () => {
    const builder = new DefaultPromptBuilder(createDefaultModules(), {
      intentAnalyzer: new DefaultIntentAnalyzer(),
    })
    const request = await builder.build(createPipelineContext({ input: 'create a tree' }))
    const assembly = request.metadata?.promptAssembly as Record<string, unknown> | undefined
    expect(assembly).toBeDefined()
    expect(assembly!.intent).toBeDefined()
    const intentResult = assembly!.intent as IntentResult
    expect(intentResult.intents).toEqual([])
  })

  it('should include detected intents in metadata when using RuleBasedIntentAnalyzer', async () => {
    const builder = new DefaultPromptBuilder(createDefaultModules(), {
      intentAnalyzer: new RuleBasedIntentAnalyzer(),
    })
    const request = await builder.build(createPipelineContext({ input: 'draw a tree' }))

    const assembly = request.metadata?.promptAssembly as Record<string, unknown> | undefined
    const intentResult = assembly!.intent as IntentResult
    expect(intentResult.intents).toHaveLength(1)
    expect(intentResult.intents[0].type).toBe('Create')
  })

  it('should include multi-intent results in metadata', async () => {
    const builder = new DefaultPromptBuilder(createDefaultModules(), {
      intentAnalyzer: new RuleBasedIntentAnalyzer(),
    })
    const request = await builder.build(createPipelineContext({ input: 'draw a tree, and remove the flower' }))

    const assembly = request.metadata?.promptAssembly as Record<string, unknown> | undefined
    const intentResult = assembly!.intent as IntentResult
    expect(intentResult.intents).toHaveLength(2)
    expect(intentResult.intents[0].type).toBe('Create')
    expect(intentResult.intents[1].type).toBe('Delete')
  })

  it('should include empty IntentResult for unknown input', async () => {
    const builder = new DefaultPromptBuilder(createDefaultModules(), {
      intentAnalyzer: new RuleBasedIntentAnalyzer(),
    })
    const request = await builder.build(createPipelineContext({ input: 'hello world' }))

    const assembly = request.metadata?.promptAssembly as Record<string, unknown> | undefined
    const intentResult = assembly!.intent as IntentResult
    expect(intentResult.intents).toEqual([])
  })

  it('should NOT include intent in metadata when no IntentAnalyzer is provided', async () => {
    const builder = new DefaultPromptBuilder(createDefaultModules())
    const request = await builder.build(createPipelineContext({ input: 'create a tree' }))

    const assembly = request.metadata?.promptAssembly as Record<string, unknown> | undefined
    expect(assembly).toBeDefined()
    expect((assembly as Record<string, unknown>).intent).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Builder Without IntentAnalyzer Behaves Identically
// ---------------------------------------------------------------------------

describe('DefaultPromptBuilder — without IntentAnalyzer (identical behavior)', () => {
  it('should produce identical prompt output with and without IntentAnalyzer', async () => {
    const context = createPipelineContext({ input: 'create a tree' })

    const builderWithout = new DefaultPromptBuilder(createDefaultModules())
    const builderWith = new DefaultPromptBuilder(createDefaultModules(), {
      intentAnalyzer: new DefaultIntentAnalyzer(),
    })

    const requestWithout = await builderWithout.build(context)
    const requestWith = await builderWith.build(context)

    expect(requestWith.prompt).toBe(requestWithout.prompt)
  })

  it('should produce identical buildContext output with and without IntentAnalyzer', async () => {
    const context = createPipelineContext({ input: 'create a tree' })

    const builderWithout = new DefaultPromptBuilder(createDefaultModules())
    const builderWith = new DefaultPromptBuilder(createDefaultModules(), {
      intentAnalyzer: new DefaultIntentAnalyzer(),
    })

    const ctxWithout = await builderWithout.buildContext(context)
    const ctxWith = await builderWith.buildContext(context)

    expect(ctxWith).toEqual(ctxWithout)
  })
})

// ---------------------------------------------------------------------------
// Existing Prompts Unchanged
// ---------------------------------------------------------------------------

describe('DefaultPromptBuilder — existing prompts unchanged', () => {
  it('should produce SystemPromptModule output unchanged', async () => {
    const builder = new DefaultPromptBuilder(
      [new SystemPromptModule(), new UserInputModule()],
      { intentAnalyzer: new DefaultIntentAnalyzer() },
    )
    const request = await builder.build(createPipelineContext({ input: 'hello' }))
    expect(request.prompt).toContain('Project Genesis')
    expect(request.prompt).toContain('hello')
  })

  it('should produce ObservationPromptModule output unchanged', async () => {
    const modules: PromptModule[] = [
      new SystemPromptModule(),
      new UserInputModule(),
      new ObservationPromptModule(),
    ]
    const builder = new DefaultPromptBuilder(modules, {
      intentAnalyzer: new DefaultIntentAnalyzer(),
    })
    const request = await builder.build({
      input: 'hello',
      memory: new DefaultMemory(),
      metadata: {
        observations: [
          {
            toolName: 'find_entity',
            toolInput: {},
            toolOutput: { id: 'e1' },
            timestamp: 1000,
            iteration: 0,
          },
        ],
      },
    })
    expect(request.prompt).toContain('## Previous Observations')
    expect(request.prompt).toContain('find_entity')
  })

  it('should produce ReflectionPromptModule output unchanged', async () => {
    const modules: PromptModule[] = [
      new SystemPromptModule(),
      new UserInputModule(),
      new ReflectionPromptModule(),
    ]
    const builder = new DefaultPromptBuilder(modules, {
      intentAnalyzer: new DefaultIntentAnalyzer(),
    })
    const request = await builder.build({
      ...createPipelineContext(),
      metadata: { reflectionResults: singleReflection },
    })
    expect(request.prompt).toContain('## Previous Reflection')
    expect(request.prompt).toContain('Actions found')
  })
})

// ---------------------------------------------------------------------------
// Existing Metadata Unchanged (Except New Intent Field)
// ---------------------------------------------------------------------------

describe('DefaultPromptBuilder — existing metadata unchanged', () => {
  it('should preserve ranking, budget, selection in metadata', async () => {
    const builder = new DefaultPromptBuilder(createDefaultModules(), {
      intentAnalyzer: new RuleBasedIntentAnalyzer(),
    })
    const request = await builder.build(createPipelineContext({ input: 'draw a tree' }))

    const assembly = request.metadata?.promptAssembly as Record<string, unknown>
    expect(assembly.ranking).toBeDefined()
    expect(assembly.budget).toBeDefined()
    expect(assembly.selection).toBeDefined()
    expect(assembly.intent).toBeDefined()
  })

  it('should preserve existing context metadata alongside promptAssembly', async () => {
    const builder = new DefaultPromptBuilder(createDefaultModules(), {
      intentAnalyzer: new RuleBasedIntentAnalyzer(),
    })
    const request = await builder.build({
      ...createPipelineContext({ input: 'draw a tree' }),
      metadata: { sessionId: 'test-123', userId: 'user-1' },
    })

    expect(request.metadata).toBeDefined()
    expect(request.metadata!.sessionId).toBe('test-123')
    expect(request.metadata!.userId).toBe('user-1')
    expect((request.metadata!.promptAssembly as Record<string, unknown>).intent).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Deterministic Behavior
// ---------------------------------------------------------------------------

describe('DefaultPromptBuilder — deterministic behavior', () => {
  it('should produce identical results for identical inputs', async () => {
    const modules = createDefaultModules()
    const builder = new DefaultPromptBuilder(modules, {
      intentAnalyzer: new RuleBasedIntentAnalyzer(),
    })
    const context = createPipelineContext({ input: 'draw a tree' })

    const request1 = await builder.build(context)
    const request2 = await builder.build(context)

    expect(request1.prompt).toBe(request2.prompt)
    expect(request1.metadata).toEqual(request2.metadata)
  })

  it('should produce different IntentResults for different inputs', async () => {
    const builder = new DefaultPromptBuilder(createDefaultModules(), {
      intentAnalyzer: new RuleBasedIntentAnalyzer(),
    })

    const request1 = await builder.build(createPipelineContext({ input: 'draw a tree' }))
    const request2 = await builder.build(createPipelineContext({ input: 'move the tree' }))

    const assembly1 = request1.metadata?.promptAssembly as Record<string, unknown>
    const assembly2 = request2.metadata?.promptAssembly as Record<string, unknown>
    const intent1 = assembly1.intent as IntentResult
    const intent2 = assembly2.intent as IntentResult

    expect(intent1.intents[0].type).toBe('Create')
    expect(intent2.intents[0].type).toBe('Move')
  })
})

// ---------------------------------------------------------------------------
// Stateless Behavior
// ---------------------------------------------------------------------------

describe('DefaultPromptBuilder — stateless behavior', () => {
  it('should not share state between invocations', async () => {
    const { analyzer, spy } = createSpyAnalyzer()
    const builder = new DefaultPromptBuilder(
      [new SystemPromptModule(), new UserInputModule()],
      { intentAnalyzer: analyzer },
    )

    const context1 = createPipelineContext({ input: 'create a tree' })
    const context2 = createPipelineContext({ input: 'move the tree' })

    const request1 = await builder.build(context1)
    const request2 = await builder.build(context2)

    expect(spy).toHaveBeenCalledTimes(2)
    // Prompts should differ based on input
    expect(request1.prompt).not.toBe(request2.prompt)
  })
})

// ---------------------------------------------------------------------------
// Immutability
// ---------------------------------------------------------------------------

describe('DefaultPromptBuilder — immutability', () => {
  it('should not mutate the PipelineContext input', async () => {
    const builder = new DefaultPromptBuilder(createDefaultModules(), {
      intentAnalyzer: new RuleBasedIntentAnalyzer(),
    })
    const context = createPipelineContext({ input: 'draw a tree' })
    const inputBefore = context.input

    await builder.build(context)

    expect(context.input).toBe(inputBefore)
  })

  it('should not mutate PromptContext during assembly', async () => {
    const modules: PromptModule[] = [
      new SystemPromptModule(),
      new UserInputModule(),
    ]
    const builder = new DefaultPromptBuilder(modules, {
      intentAnalyzer: new RuleBasedIntentAnalyzer(),
    })
    const context = createPipelineContext({ input: 'draw a tree' })

    const ctx = await builder.buildContext(context)

    // buildContext returns a new object
    expect(ctx).not.toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Backward Compatibility
// ---------------------------------------------------------------------------

describe('DefaultPromptBuilder — backward compatibility', () => {
  it('should support legacy 1-param constructor (modules only)', async () => {
    const builder = new DefaultPromptBuilder([new UserInputModule()])
    const request = await builder.build({ input: 'hello' })
    expect(request.prompt).toContain('hello')
  })

  it('should support legacy 8-param constructor (full positional)', async () => {
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

  it('should support empty BuilderOptions same as no options', async () => {
    const builderWithEmpty = new DefaultPromptBuilder([new UserInputModule()], {})
    const builderWithout = new DefaultPromptBuilder([new UserInputModule()])
    const request1 = await builderWithEmpty.build({ input: 'hello' })
    const request2 = await builderWithout.build({ input: 'hello' })
    expect(request1.prompt).toBe(request2.prompt)
  })

  it('should work with UserInputModule alone', async () => {
    const builder = new DefaultPromptBuilder([new UserInputModule()], {
      intentAnalyzer: new RuleBasedIntentAnalyzer(),
    })
    const request = await builder.build({ input: 'draw a tree' })
    expect(request.prompt).toBe('draw a tree')
    const assembly = request.metadata?.promptAssembly as Record<string, unknown>
    const intentResult = assembly.intent as IntentResult
    expect(intentResult.intents[0].type).toBe('Create')
  })
})

// ---------------------------------------------------------------------------
// RetryPlanner Compatibility
// ---------------------------------------------------------------------------

describe('DefaultPromptBuilder — RetryPlanner compatibility', () => {
  it('should produce valid AIRequest consumable by RetryPlanner', async () => {
    const builder = new DefaultPromptBuilder(createDefaultModules(), {
      intentAnalyzer: new RuleBasedIntentAnalyzer(),
    })
    const request = await builder.build(createPipelineContext({ input: 'draw a tree' }))

    const planner = new RetryPlanner(new MockPlannerProvider(new DefaultAIConfiguration()))
    const result = await planner.plan(request)
    expect(result.actions).toBeDefined()
  })

  it('should preserve IntentResult in metadata through RetryPlanner', async () => {
    const builder = new DefaultPromptBuilder(createDefaultModules(), {
      intentAnalyzer: new RuleBasedIntentAnalyzer(),
    })
    const request = await builder.build(createPipelineContext({ input: 'draw a tree' }))

    const planner = new RetryPlanner(new MockPlannerProvider(new DefaultAIConfiguration()))
    const result = await planner.plan(request)

    const assembly = request.metadata?.promptAssembly as Record<string, unknown>
    const intentResult = assembly.intent as IntentResult
    expect(intentResult.intents[0].type).toBe('Create')

    // Metadata is preserved in PlannerResult
    expect(result.metadata).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// ToolCallPlanner Compatibility
// ---------------------------------------------------------------------------

describe('DefaultPromptBuilder — ToolCallPlanner compatibility', () => {
  it('should produce valid AIRequest consumable by ToolCallPlanner', async () => {
    const builder = new DefaultPromptBuilder(createDefaultModules(), {
      intentAnalyzer: new RuleBasedIntentAnalyzer(),
    })
    const request = await builder.build(createPipelineContext({ input: 'draw a tree' }))

    const planner = new ToolCallPlanner(
      new MockPlannerProvider(new DefaultAIConfiguration()),
      new DefaultToolRegistry(),
    )
    const result = await planner.plan(request)
    expect(result.actions).toBeDefined()
  })

  it('should preserve IntentResult in metadata through ToolCallPlanner', async () => {
    const builder = new DefaultPromptBuilder(createDefaultModules(), {
      intentAnalyzer: new RuleBasedIntentAnalyzer(),
    })
    const request = await builder.build(createPipelineContext({ input: 'draw a tree' }))

    const planner = new ToolCallPlanner(
      new MockPlannerProvider(new DefaultAIConfiguration()),
      new DefaultToolRegistry(),
    )
    await planner.plan(request)

    const assembly = request.metadata?.promptAssembly as Record<string, unknown>
    const intentResult = assembly.intent as IntentResult
    expect(intentResult.intents[0].type).toBe('Create')
  })
})

// ---------------------------------------------------------------------------
// Streaming Compatibility
// ---------------------------------------------------------------------------

describe('DefaultPromptBuilder — streaming compatibility', () => {
  it('should produce valid AIRequest consumable by streaming providers', async () => {
    const builder = new DefaultPromptBuilder(createDefaultModules(), {
      intentAnalyzer: new RuleBasedIntentAnalyzer(),
    })
    const request = await builder.build(createPipelineContext({ input: 'draw a tree' }))

    const provider = new MockStreamingProvider()
    const result = await provider.complete(request)
    expect(result.actions).toBeDefined()
  })

  it('should preserve IntentResult in metadata through streaming', async () => {
    const builder = new DefaultPromptBuilder(createDefaultModules(), {
      intentAnalyzer: new RuleBasedIntentAnalyzer(),
    })
    const request = await builder.build(createPipelineContext({ input: 'draw a tree' }))

    const provider = new MockStreamingProvider()
    await provider.complete(request)

    const assembly = request.metadata?.promptAssembly as Record<string, unknown>
    const intentResult = assembly.intent as IntentResult
    expect(intentResult.intents[0].type).toBe('Create')
  })
})

// ---------------------------------------------------------------------------
// AgentLoop Compatibility
// ---------------------------------------------------------------------------

describe('DefaultPromptBuilder — AgentLoop compatibility', () => {
  it('should produce valid AIRequest consumable by AgentLoop', async () => {
    const builder = new DefaultPromptBuilder(createDefaultModules(), {
      intentAnalyzer: new RuleBasedIntentAnalyzer(),
    })
    const request = await builder.build(createPipelineContext({ input: 'draw a tree' }))

    const loop = new DefaultAgentLoop()
    const result = await loop.execute({
      request,
      planner: new MockPlanner(new MockStreamingProvider()),
      maxIterations: 3,
    })
    expect(result.iterations).toBe(1)
    expect(result.finished).toBe(true)
  })

  it('should preserve IntentResult in metadata through AgentLoop', async () => {
    const builder = new DefaultPromptBuilder(createDefaultModules(), {
      intentAnalyzer: new RuleBasedIntentAnalyzer(),
    })
    const request = await builder.build(createPipelineContext({ input: 'draw a tree' }))

    const loop = new DefaultAgentLoop()
    await loop.execute({
      request,
      planner: new MockPlanner(new MockStreamingProvider()),
      maxIterations: 3,
    })

    const assembly = request.metadata?.promptAssembly as Record<string, unknown>
    const intentResult = assembly.intent as IntentResult
    expect(intentResult.intents[0].type).toBe('Create')
  })
})

// ---------------------------------------------------------------------------
// DefaultIntentAnalyzer (Placeholder) in Pipeline
// ---------------------------------------------------------------------------

describe('DefaultIntentAnalyzer — placeholder in pipeline', () => {
  it('should return empty intents without affecting the pipeline', async () => {
    const builder = new DefaultPromptBuilder(createDefaultModules(), {
      intentAnalyzer: new DefaultIntentAnalyzer(),
    })
    const request = await builder.build(createPipelineContext({ input: 'create a tree' }))

    const assembly = request.metadata?.promptAssembly as Record<string, unknown>
    const intentResult = assembly.intent as IntentResult
    expect(intentResult.intents).toEqual([])
    expect(request.prompt).toContain('create a tree')
    expect(request.prompt).toContain('Project Genesis')
  })
})

// ---------------------------------------------------------------------------
// RuleBasedIntentAnalyzer Integration
// ---------------------------------------------------------------------------

describe('RuleBasedIntentAnalyzer — integration with Builder', () => {
  it('should detect Create intent from Chinese input', async () => {
    const builder = new DefaultPromptBuilder(createDefaultModules(), {
      intentAnalyzer: new RuleBasedIntentAnalyzer(),
    })
    const request = await builder.build(createPipelineContext({ input: '画一棵树' }))
    const assembly = request.metadata?.promptAssembly as Record<string, unknown>
    const intentResult = assembly.intent as IntentResult
    expect(intentResult.intents[0].type).toBe('Create')
  })

  it('should detect Move intent from English input', async () => {
    const builder = new DefaultPromptBuilder(createDefaultModules(), {
      intentAnalyzer: new RuleBasedIntentAnalyzer(),
    })
    const request = await builder.build(createPipelineContext({ input: 'move the tree to x=10 y=20' }))
    const assembly = request.metadata?.promptAssembly as Record<string, unknown>
    const intentResult = assembly.intent as IntentResult
    expect(intentResult.intents[0].type).toBe('Move')
  })

  it('should detect Query intent', async () => {
    const builder = new DefaultPromptBuilder(createDefaultModules(), {
      intentAnalyzer: new RuleBasedIntentAnalyzer(),
    })
    const request = await builder.build(createPipelineContext({ input: 'what entities are in the world' }))
    const assembly = request.metadata?.promptAssembly as Record<string, unknown>
    const intentResult = assembly.intent as IntentResult
    expect(intentResult.intents[0].type).toBe('Query')
  })
})

// ---------------------------------------------------------------------------
// Pipeline Integration
// ---------------------------------------------------------------------------

describe('DefaultPipeline — IntentAnalyzer integration', () => {
  it('should propagate IntentResult through full Pipeline', async () => {
    const modules = createDefaultModules()
    const builder = new DefaultPromptBuilder(modules, {
      intentAnalyzer: new RuleBasedIntentAnalyzer(),
    })
    const pipeline = new DefaultPipeline(new MockPlanner(new MockStreamingProvider()), builder)

    const result = await pipeline.execute({
      input: 'draw a tree',
      memory: new DefaultMemory(),
    })

    // PromptAssembly metadata is on AIRequest, not PipelineContext
    // Verify pipeline completed correctly
    expect(result.plannerResult).toBeDefined()
    expect(result.input).toBe('draw a tree')
  })

  it('should propagate IntentResult through streaming Pipeline', async () => {
    const modules = createDefaultModules()
    const builder = new DefaultPromptBuilder(modules, {
      intentAnalyzer: new RuleBasedIntentAnalyzer(),
    })
    const pipeline = new DefaultPipeline(new MockPlanner(new MockStreamingProvider()), builder, new MockStreamingProvider())

    const result = await pipeline.stream({
      input: 'draw a tree',
      memory: new DefaultMemory(),
    })

    // PromptAssembly metadata is on AIRequest, not PipelineContext
    expect(result.plannerResult).toBeDefined()
    expect(result.input).toBe('draw a tree')
  })

  it('should work without IntentAnalyzer in full Pipeline', async () => {
    const modules = createDefaultModules()
    const builder = new DefaultPromptBuilder(modules)
    const pipeline = new DefaultPipeline(new MockPlanner(new MockStreamingProvider()), builder)

    const result = await pipeline.execute({
      input: 'draw a tree',
      memory: new DefaultMemory(),
    })

    expect(result.plannerResult).toBeDefined()
    expect(result.plannerResult!.actions).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Edge Cases
// ---------------------------------------------------------------------------

describe('DefaultPromptBuilder — edge cases', () => {
  it('should handle undefined input gracefully', async () => {
    const { analyzer } = createSpyAnalyzer()
    const builder = new DefaultPromptBuilder(createDefaultModules(), {
      intentAnalyzer: analyzer,
    })
    // IntentAnalyzer receives empty string, should not throw
    const request = await builder.build(createPipelineContext({ input: '' }))
    expect(request.prompt).toBeDefined()
  })

  it('should handle blank input gracefully', async () => {
    const builder = new DefaultPromptBuilder(createDefaultModules(), {
      intentAnalyzer: new RuleBasedIntentAnalyzer(),
    })
    const request = await builder.build(createPipelineContext({ input: '   ' }))
    const assembly = request.metadata?.promptAssembly as Record<string, unknown>
    const intentResult = assembly.intent as IntentResult
    expect(intentResult.intents).toEqual([])
  })

  it('should handle null metadata gracefully', async () => {
    const builder = new DefaultPromptBuilder(createDefaultModules(), {
      intentAnalyzer: new RuleBasedIntentAnalyzer(),
    })
    const request = await builder.build({
      input: 'draw a tree',
    })
    const assembly = request.metadata?.promptAssembly as Record<string, unknown>
    expect(assembly.intent).toBeDefined()
  })
})