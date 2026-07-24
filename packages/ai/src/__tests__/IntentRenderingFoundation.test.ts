import { describe, it, expect } from 'vitest'
import type { IntentRenderer } from '../intent/IntentRenderer'
import { DefaultIntentRenderer } from '../intent/DefaultIntentRenderer'
import type { IntentResult } from '../intent/IntentResult'
import { RuleBasedIntentAnalyzer } from '../intent/RuleBasedIntentAnalyzer'
import { DefaultIntentAnalyzer } from '../intent/DefaultIntentAnalyzer'
import { DefaultPromptBuilder } from '../prompt/DefaultPromptBuilder'
import type { BuilderOptions } from '../prompt/BuilderOptions'
import {
  UserInputModule,
  SystemPromptModule,
  MemoryPromptModule,
  WorldStatePromptModule,
} from '../prompt/modules'
import type { PromptModule } from '../prompt/modules/PromptModule'
import { DefaultMemory } from '../memory/DefaultMemory'
import { MockPlanner, RetryPlanner, ToolCallPlanner } from '../planner'
import { MockPlannerProvider, MockStreamingProvider } from '../provider'
import { DefaultToolRegistry } from '../tools/ToolRegistry'
import { DefaultAgentLoop } from '../agent/DefaultAgentLoop'
import { DefaultPipeline } from '../pipeline/DefaultPipeline'
import { DefaultAIConfiguration } from '../config/DefaultAIConfiguration'
import type { PipelineContext } from '../pipeline/PipelineContext'
import type { IntentRenderer as IntentRendererFromIndex } from '../intent/index'
import { DefaultIntentRenderer as DefaultIntentRendererFromIndex } from '../intent/index'
import type { IntentRenderer as IntentRendererFromRoot } from '../index'
import { DefaultIntentRenderer as DefaultIntentRendererFromRoot } from '../index'

// ---------------------------------------------------------------------------
// Test Data
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// IntentRenderer Interface
// ---------------------------------------------------------------------------

describe('IntentRenderer interface', () => {
  it('should define a render method that accepts IntentResult and returns string', () => {
    const renderer: IntentRenderer = new DefaultIntentRenderer()
    expect(renderer.render).toBeDefined()
    expect(typeof renderer.render).toBe('function')
  })

  it('should be implementable with custom logic', () => {
    const customRenderer: IntentRenderer = {
      render: (intent: IntentResult): string => intent.intents.map((i) => i.type).join(', '),
    }
    const result = customRenderer.render({ intents: [{ type: 'Create' }, { type: 'Move' }] })
    expect(result).toBe('Create, Move')
  })
})

// ---------------------------------------------------------------------------
// DefaultIntentRenderer — Empty Intents
// ---------------------------------------------------------------------------

describe('DefaultIntentRenderer — empty intents', () => {
  const renderer = new DefaultIntentRenderer()

  it('should return empty string for empty intents array', () => {
    expect(renderer.render({ intents: [] })).toBe('')
  })

  it('should return empty string for IntentResult with no intents', () => {
    expect(renderer.render({ intents: [] })).toBe('')
  })
})

// ---------------------------------------------------------------------------
// DefaultIntentRenderer — Single Intent
// ---------------------------------------------------------------------------

describe('DefaultIntentRenderer — single intent', () => {
  const renderer = new DefaultIntentRenderer()

  it('should format a single Create intent', () => {
    expect(renderer.render({ intents: [{ type: 'Create' }] })).toBe('User Intent:\n- Create')
  })

  it('should format a single Delete intent', () => {
    expect(renderer.render({ intents: [{ type: 'Delete' }] })).toBe('User Intent:\n- Delete')
  })

  it('should format a single Move intent', () => {
    expect(renderer.render({ intents: [{ type: 'Move' }] })).toBe('User Intent:\n- Move')
  })

  it('should format a single Modify intent', () => {
    expect(renderer.render({ intents: [{ type: 'Modify' }] })).toBe('User Intent:\n- Modify')
  })

  it('should format a single Query intent', () => {
    expect(renderer.render({ intents: [{ type: 'Query' }] })).toBe('User Intent:\n- Query')
  })
})

// ---------------------------------------------------------------------------
// DefaultIntentRenderer — Multiple Intents
// ---------------------------------------------------------------------------

describe('DefaultIntentRenderer — multiple intents', () => {
  const renderer = new DefaultIntentRenderer()

  it('should format two intents', () => {
    const result = renderer.render({
      intents: [{ type: 'Create' }, { type: 'Move' }],
    })
    expect(result).toBe('User Intent:\n- Create\n- Move')
  })

  it('should format three intents', () => {
    const result = renderer.render({
      intents: [{ type: 'Create' }, { type: 'Delete' }, { type: 'Move' }],
    })
    expect(result).toBe('User Intent:\n- Create\n- Delete\n- Move')
  })

  it('should format duplicate intents', () => {
    const result = renderer.render({
      intents: [{ type: 'Create' }, { type: 'Create' }],
    })
    expect(result).toBe('User Intent:\n- Create\n- Create')
  })

  it('should format all five intent types together', () => {
    const result = renderer.render({
      intents: [
        { type: 'Create' },
        { type: 'Delete' },
        { type: 'Move' },
        { type: 'Modify' },
        { type: 'Query' },
      ],
    })
    expect(result).toBe('User Intent:\n- Create\n- Delete\n- Move\n- Modify\n- Query')
  })
})

// ---------------------------------------------------------------------------
// DefaultIntentRenderer — Deterministic
// ---------------------------------------------------------------------------

describe('DefaultIntentRenderer — deterministic', () => {
  const renderer = new DefaultIntentRenderer()
  const input: IntentResult = {
    intents: [{ type: 'Create' }, { type: 'Move' }],
  }

  it('should produce same output for same input (idempotent)', () => {
    const result1 = renderer.render(input)
    const result2 = renderer.render(input)
    expect(result1).toBe(result2)
  })

  it('should produce consistent output across 10 calls', () => {
    const results = Array.from({ length: 10 }, () => renderer.render(input))
    const first = results[0]
    results.forEach((r) => expect(r).toBe(first))
  })

  it('should produce deterministic output for empty input', () => {
    const empty: IntentResult = { intents: [] }
    const result1 = renderer.render(empty)
    const result2 = renderer.render(empty)
    expect(result1).toBe(result2)
    expect(result1).toBe('')
  })
})

// ---------------------------------------------------------------------------
// DefaultIntentRenderer — Stateless
// ---------------------------------------------------------------------------

describe('DefaultIntentRenderer — stateless', () => {
  it('should not retain state between calls', () => {
    const renderer = new DefaultIntentRenderer()
    const result1 = renderer.render({ intents: [{ type: 'Create' }] })
    const result2 = renderer.render({ intents: [{ type: 'Move' }] })
    const result3 = renderer.render({ intents: [{ type: 'Create' }] })
    expect(result1).toBe('User Intent:\n- Create')
    expect(result2).toBe('User Intent:\n- Move')
    expect(result3).toBe('User Intent:\n- Create')
  })

  it('should produce independent results from separate instances', () => {
    const renderer1 = new DefaultIntentRenderer()
    const renderer2 = new DefaultIntentRenderer()
    const result1 = renderer1.render({ intents: [{ type: 'Create' }] })
    const result2 = renderer2.render({ intents: [{ type: 'Create' }] })
    expect(result1).toBe(result2)
  })
})

// ---------------------------------------------------------------------------
// DefaultIntentRenderer — Immutability
// ---------------------------------------------------------------------------

describe('DefaultIntentRenderer — immutability', () => {
  const renderer = new DefaultIntentRenderer()

  it('should not mutate the input IntentResult', () => {
    const input: IntentResult = {
      intents: [{ type: 'Create' }, { type: 'Move' }],
    }
    const inputJson = JSON.stringify(input)
    renderer.render(input)
    expect(JSON.stringify(input)).toBe(inputJson)
  })

  it('should return new string each time', () => {
    const input: IntentResult = { intents: [{ type: 'Create' }] }
    const result1 = renderer.render(input)
    const result2 = renderer.render(input)
    // Same value but independence is guaranteed by string immutability
    expect(result1).toBe(result2)
  })
})

// ---------------------------------------------------------------------------
// BuilderOptions — IntentRenderer
// ---------------------------------------------------------------------------

describe('BuilderOptions — IntentRenderer field', () => {
  it('should accept IntentRenderer in BuilderOptions', () => {
    const options: BuilderOptions = {
      intentAnalyzer: new DefaultIntentAnalyzer(),
      intentRenderer: new DefaultIntentRenderer(),
    }
    const builder = new DefaultPromptBuilder([new UserInputModule()], options)
    expect(builder).toBeDefined()
  })

  it('should accept IntentRenderer without IntentAnalyzer', () => {
    const options: BuilderOptions = {
      intentRenderer: new DefaultIntentRenderer(),
    }
    const builder = new DefaultPromptBuilder([new UserInputModule()], options)
    expect(builder).toBeDefined()
  })

  it('should accept IntentRenderer alongside all BuilderOptions fields', () => {
    const options: BuilderOptions = {
      intentAnalyzer: new RuleBasedIntentAnalyzer(),
      intentRenderer: new DefaultIntentRenderer(),
    }
    const builder = new DefaultPromptBuilder(createDefaultModules(), options)
    expect(builder).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// PromptBuilder Integration — Metadata Generation
// ---------------------------------------------------------------------------

describe('DefaultPromptBuilder — IntentRenderer metadata', () => {
  it('should include intentRendered in promptAssembly metadata', async () => {
    const builder = new DefaultPromptBuilder(createDefaultModules(), {
      intentAnalyzer: new RuleBasedIntentAnalyzer(),
      intentRenderer: new DefaultIntentRenderer(),
    })
    const request = await builder.build(createPipelineContext({ input: 'draw a tree' }))

    const assembly = request.metadata?.promptAssembly as Record<string, unknown>
    expect(assembly).toBeDefined()
    expect(assembly.intentRendered).toBeDefined()
    expect(assembly.intentRendered).toBe('User Intent:\n- Create')
  })

  it('should include intentRendered for multi-intent input', async () => {
    const builder = new DefaultPromptBuilder(createDefaultModules(), {
      intentAnalyzer: new RuleBasedIntentAnalyzer(),
      intentRenderer: new DefaultIntentRenderer(),
    })
    const request = await builder.build(createPipelineContext({ input: 'draw a tree, and remove the flower' }))

    const assembly = request.metadata?.promptAssembly as Record<string, unknown>
    expect(assembly.intentRendered).toBe('User Intent:\n- Create\n- Delete')
  })

  it('should NOT include intentRendered when no IntentRenderer is provided', async () => {
    const builder = new DefaultPromptBuilder(createDefaultModules(), {
      intentAnalyzer: new RuleBasedIntentAnalyzer(),
    })
    const request = await builder.build(createPipelineContext({ input: 'draw a tree' }))

    const assembly = request.metadata?.promptAssembly as Record<string, unknown>
    expect(assembly.intentRendered).toBeUndefined()
  })

  it('should NOT include intentRendered when no IntentAnalyzer is provided even if IntentRenderer is', async () => {
    const builder = new DefaultPromptBuilder(createDefaultModules(), {
      intentRenderer: new DefaultIntentRenderer(),
    })
    const request = await builder.build(createPipelineContext({ input: 'draw a tree' }))

    const assembly = request.metadata?.promptAssembly as Record<string, unknown>
    expect(assembly.intentRendered).toBeUndefined()
  })

  it('should include both intent and intentRendered in metadata', async () => {
    const builder = new DefaultPromptBuilder(createDefaultModules(), {
      intentAnalyzer: new RuleBasedIntentAnalyzer(),
      intentRenderer: new DefaultIntentRenderer(),
    })
    const request = await builder.build(createPipelineContext({ input: 'draw a tree' }))

    const assembly = request.metadata?.promptAssembly as Record<string, unknown>
    expect(assembly.intent).toBeDefined()
    expect(assembly.intentRendered).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// IntentRenderer with DefaultIntentAnalyzer (empty result)
// ---------------------------------------------------------------------------

describe('DefaultIntentBuilder — DefaultIntentAnalyzer + IntentRenderer', () => {
  it('should produce empty intentRendered when DefaultIntentAnalyzer returns empty', async () => {
    const builder = new DefaultPromptBuilder(createDefaultModules(), {
      intentAnalyzer: new DefaultIntentAnalyzer(),
      intentRenderer: new DefaultIntentRenderer(),
    })
    const request = await builder.build(createPipelineContext({ input: 'draw a tree' }))

    const assembly = request.metadata?.promptAssembly as Record<string, unknown>
    expect(assembly.intentRendered).toBe('')
  })

  it('should produce empty intentRendered for unknown intents with RuleBasedIntentAnalyzer', async () => {
    const builder = new DefaultPromptBuilder(createDefaultModules(), {
      intentAnalyzer: new RuleBasedIntentAnalyzer(),
      intentRenderer: new DefaultIntentRenderer(),
    })
    const request = await builder.build(createPipelineContext({ input: 'hello world' }))

    const assembly = request.metadata?.promptAssembly as Record<string, unknown>
    expect(assembly.intentRendered).toBe('')
  })
})

// ---------------------------------------------------------------------------
// Existing Prompts Unchanged
// ---------------------------------------------------------------------------

describe('DefaultPromptBuilder — existing prompts unchanged with IntentRenderer', () => {
  it('should produce SystemPromptModule output unchanged', async () => {
    const builder = new DefaultPromptBuilder(
      [new SystemPromptModule(), new UserInputModule()],
      {
        intentAnalyzer: new DefaultIntentAnalyzer(),
        intentRenderer: new DefaultIntentRenderer(),
      },
    )
    const request = await builder.build({ input: 'hello' })
    expect(request.prompt).toContain('Project Genesis')
    expect(request.prompt).toContain('hello')
    // IntentRendered should NOT be in the prompt
    expect(request.prompt).not.toContain('User Intent:')
  })

  it('should produce identical prompt output with and without IntentRenderer', async () => {
    const context = createPipelineContext({ input: 'draw a tree' })

    const builderWithout = new DefaultPromptBuilder(createDefaultModules(), {
      intentAnalyzer: new RuleBasedIntentAnalyzer(),
    })
    const builderWith = new DefaultPromptBuilder(createDefaultModules(), {
      intentAnalyzer: new RuleBasedIntentAnalyzer(),
      intentRenderer: new DefaultIntentRenderer(),
    })

    const requestWithout = await builderWithout.build(context)
    const requestWith = await builderWith.build(context)

    // Prompt should be identical - intentRendered is only in metadata, not prompt
    expect(requestWith.prompt).toBe(requestWithout.prompt)
  })
})

// ---------------------------------------------------------------------------
// Existing Metadata Unchanged
// ---------------------------------------------------------------------------

describe('DefaultPromptBuilder — existing metadata unchanged with IntentRenderer', () => {
  it('should preserve ranking, budget, selection, intent in metadata', async () => {
    const builder = new DefaultPromptBuilder(createDefaultModules(), {
      intentAnalyzer: new RuleBasedIntentAnalyzer(),
      intentRenderer: new DefaultIntentRenderer(),
    })
    const request = await builder.build(createPipelineContext({ input: 'draw a tree' }))

    const assembly = request.metadata?.promptAssembly as Record<string, unknown>
    expect(assembly.ranking).toBeDefined()
    expect(assembly.budget).toBeDefined()
    expect(assembly.selection).toBeDefined()
    expect(assembly.intent).toBeDefined()
    expect(assembly.intentRendered).toBeDefined()
  })

  it('should preserve existing context metadata', async () => {
    const builder = new DefaultPromptBuilder(createDefaultModules(), {
      intentAnalyzer: new RuleBasedIntentAnalyzer(),
      intentRenderer: new DefaultIntentRenderer(),
    })
    const request = await builder.build({
      ...createPipelineContext({ input: 'draw a tree' }),
      metadata: { sessionId: 'test-123' },
    })

    expect(request.metadata!.sessionId).toBe('test-123')
  })
})

// ---------------------------------------------------------------------------
// Deterministic Behavior
// ---------------------------------------------------------------------------

describe('DefaultPromptBuilder — deterministic intent rendering', () => {
  it('should produce identical intentRendered for identical inputs', async () => {
    const builder = new DefaultPromptBuilder(createDefaultModules(), {
      intentAnalyzer: new RuleBasedIntentAnalyzer(),
      intentRenderer: new DefaultIntentRenderer(),
    })
    const context = createPipelineContext({ input: 'draw a tree' })

    const request1 = await builder.build(context)
    const request2 = await builder.build(context)

    const assembly1 = request1.metadata?.promptAssembly as Record<string, unknown>
    const assembly2 = request2.metadata?.promptAssembly as Record<string, unknown>
    expect(assembly1.intentRendered).toBe(assembly2.intentRendered)
  })

  it('should produce different intentRendered for different inputs', async () => {
    const builder = new DefaultPromptBuilder(createDefaultModules(), {
      intentAnalyzer: new RuleBasedIntentAnalyzer(),
      intentRenderer: new DefaultIntentRenderer(),
    })

    const request1 = await builder.build(createPipelineContext({ input: 'draw a tree' }))
    const request2 = await builder.build(createPipelineContext({ input: 'move the tree' }))

    const assembly1 = request1.metadata?.promptAssembly as Record<string, unknown>
    const assembly2 = request2.metadata?.promptAssembly as Record<string, unknown>
    expect(assembly1.intentRendered).toContain('Create')
    expect(assembly2.intentRendered).toContain('Move')
  })
})

// ---------------------------------------------------------------------------
// Stateless Behavior
// ---------------------------------------------------------------------------

describe('DefaultPromptBuilder — stateless intent rendering', () => {
  it('should not share state between invocations', async () => {
    const builder = new DefaultPromptBuilder(
      [new SystemPromptModule(), new UserInputModule()],
      {
        intentAnalyzer: new RuleBasedIntentAnalyzer(),
        intentRenderer: new DefaultIntentRenderer(),
      },
    )

    const request1 = await builder.build(createPipelineContext({ input: 'draw a tree' }))
    const request2 = await builder.build(createPipelineContext({ input: 'move the tree' }))

    const assembly1 = request1.metadata?.promptAssembly as Record<string, unknown>
    const assembly2 = request2.metadata?.promptAssembly as Record<string, unknown>
    expect(assembly1.intentRendered).not.toBe(assembly2.intentRendered)
  })
})

// ---------------------------------------------------------------------------
// Backward Compatibility
// ---------------------------------------------------------------------------

describe('DefaultPromptBuilder — backward compatibility with IntentRenderer', () => {
  it('should support legacy 1-param constructor', async () => {
    const builder = new DefaultPromptBuilder([new UserInputModule()])
    const request = await builder.build({ input: 'hello' })
    expect(request.prompt).toContain('hello')
  })

  it('should support legacy 8-param constructor', async () => {
    const builder = new DefaultPromptBuilder(
      [new UserInputModule()],
      undefined, undefined, undefined, undefined, undefined, undefined, undefined,
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
})

// ---------------------------------------------------------------------------
// RetryPlanner Compatibility
// ---------------------------------------------------------------------------

describe('DefaultPromptBuilder — RetryPlanner compatibility with IntentRenderer', () => {
  it('should produce valid AIRequest consumable by RetryPlanner', async () => {
    const builder = new DefaultPromptBuilder(createDefaultModules(), {
      intentAnalyzer: new RuleBasedIntentAnalyzer(),
      intentRenderer: new DefaultIntentRenderer(),
    })
    const request = await builder.build(createPipelineContext({ input: 'draw a tree' }))

    const planner = new RetryPlanner(new MockPlannerProvider(new DefaultAIConfiguration()))
    const result = await planner.plan(request)
    expect(result.actions).toBeDefined()
  })

  it('should preserve intentRendered in metadata through RetryPlanner', async () => {
    const builder = new DefaultPromptBuilder(createDefaultModules(), {
      intentAnalyzer: new RuleBasedIntentAnalyzer(),
      intentRenderer: new DefaultIntentRenderer(),
    })
    const request = await builder.build(createPipelineContext({ input: 'draw a tree' }))

    const planner = new RetryPlanner(new MockPlannerProvider(new DefaultAIConfiguration()))
    await planner.plan(request)

    const assembly = request.metadata?.promptAssembly as Record<string, unknown>
    expect(assembly.intentRendered).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// ToolCallPlanner Compatibility
// ---------------------------------------------------------------------------

describe('DefaultPromptBuilder — ToolCallPlanner compatibility with IntentRenderer', () => {
  it('should produce valid AIRequest consumable by ToolCallPlanner', async () => {
    const builder = new DefaultPromptBuilder(createDefaultModules(), {
      intentAnalyzer: new RuleBasedIntentAnalyzer(),
      intentRenderer: new DefaultIntentRenderer(),
    })
    const request = await builder.build(createPipelineContext({ input: 'draw a tree' }))

    const planner = new ToolCallPlanner(
      new MockPlannerProvider(new DefaultAIConfiguration()),
      new DefaultToolRegistry(),
    )
    const result = await planner.plan(request)
    expect(result.actions).toBeDefined()
  })

  it('should preserve intentRendered in metadata through ToolCallPlanner', async () => {
    const builder = new DefaultPromptBuilder(createDefaultModules(), {
      intentAnalyzer: new RuleBasedIntentAnalyzer(),
      intentRenderer: new DefaultIntentRenderer(),
    })
    const request = await builder.build(createPipelineContext({ input: 'draw a tree' }))

    const planner = new ToolCallPlanner(
      new MockPlannerProvider(new DefaultAIConfiguration()),
      new DefaultToolRegistry(),
    )
    await planner.plan(request)

    const assembly = request.metadata?.promptAssembly as Record<string, unknown>
    expect(assembly.intentRendered).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Streaming Compatibility
// ---------------------------------------------------------------------------

describe('DefaultPromptBuilder — streaming compatibility with IntentRenderer', () => {
  it('should produce valid AIRequest consumable by streaming providers', async () => {
    const builder = new DefaultPromptBuilder(createDefaultModules(), {
      intentAnalyzer: new RuleBasedIntentAnalyzer(),
      intentRenderer: new DefaultIntentRenderer(),
    })
    const request = await builder.build(createPipelineContext({ input: 'draw a tree' }))

    const provider = new MockStreamingProvider()
    const result = await provider.complete(request)
    expect(result.actions).toBeDefined()
  })

  it('should preserve intentRendered in metadata through streaming', async () => {
    const builder = new DefaultPromptBuilder(createDefaultModules(), {
      intentAnalyzer: new RuleBasedIntentAnalyzer(),
      intentRenderer: new DefaultIntentRenderer(),
    })
    const request = await builder.build(createPipelineContext({ input: 'draw a tree' }))

    const provider = new MockStreamingProvider()
    await provider.complete(request)

    const assembly = request.metadata?.promptAssembly as Record<string, unknown>
    expect(assembly.intentRendered).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// AgentLoop Compatibility
// ---------------------------------------------------------------------------

describe('DefaultPromptBuilder — AgentLoop compatibility with IntentRenderer', () => {
  it('should produce valid AIRequest consumable by AgentLoop', async () => {
    const builder = new DefaultPromptBuilder(createDefaultModules(), {
      intentAnalyzer: new RuleBasedIntentAnalyzer(),
      intentRenderer: new DefaultIntentRenderer(),
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

  it('should preserve intentRendered in metadata through AgentLoop', async () => {
    const builder = new DefaultPromptBuilder(createDefaultModules(), {
      intentAnalyzer: new RuleBasedIntentAnalyzer(),
      intentRenderer: new DefaultIntentRenderer(),
    })
    const request = await builder.build(createPipelineContext({ input: 'draw a tree' }))

    const loop = new DefaultAgentLoop()
    await loop.execute({
      request,
      planner: new MockPlanner(new MockStreamingProvider()),
      maxIterations: 3,
    })

    const assembly = request.metadata?.promptAssembly as Record<string, unknown>
    expect(assembly.intentRendered).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

describe('IntentRenderer — exports', () => {
  it('should export IntentRenderer type from intent/index', () => {
    // Type check — this compiles only if correctly exported
    const _renderer: IntentRendererFromIndex = new DefaultIntentRenderer()
    expect(_renderer).toBeDefined()
  })

  it('should export DefaultIntentRenderer class from intent/index', () => {
    const renderer = new DefaultIntentRendererFromIndex()
    expect(renderer).toBeInstanceOf(DefaultIntentRenderer)
  })

  it('should export IntentRenderer type from package root', () => {
    const _renderer: IntentRendererFromRoot = new DefaultIntentRenderer()
    expect(_renderer).toBeDefined()
  })

  it('should export DefaultIntentRenderer class from package root', () => {
    const renderer = new DefaultIntentRendererFromRoot()
    expect(renderer).toBeInstanceOf(DefaultIntentRenderer)
  })
})

// ---------------------------------------------------------------------------
// Pipeline Integration
// ---------------------------------------------------------------------------

describe('DefaultPipeline — IntentRenderer integration', () => {
  it('should propagate intentRendered through full Pipeline', async () => {
    const builder = new DefaultPromptBuilder(createDefaultModules(), {
      intentAnalyzer: new RuleBasedIntentAnalyzer(),
      intentRenderer: new DefaultIntentRenderer(),
    })
    const pipeline = new DefaultPipeline(new MockPlanner(new MockStreamingProvider()), builder)

    const result = await pipeline.execute({
      input: 'draw a tree',
      memory: new DefaultMemory(),
    })

    expect(result.plannerResult).toBeDefined()
  })

  it('should work without IntentRenderer in full Pipeline', async () => {
    const builder = new DefaultPromptBuilder(createDefaultModules(), {
      intentAnalyzer: new RuleBasedIntentAnalyzer(),
    })
    const pipeline = new DefaultPipeline(new MockPlanner(new MockStreamingProvider()), builder)

    const result = await pipeline.execute({
      input: 'draw a tree',
      memory: new DefaultMemory(),
    })

    expect(result.plannerResult).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Edge Cases
// ---------------------------------------------------------------------------

describe('DefaultPromptBuilder — edge cases with IntentRenderer', () => {
  it('should handle empty input with both IntentAnalyzer and IntentRenderer', async () => {
    const builder = new DefaultPromptBuilder(createDefaultModules(), {
      intentAnalyzer: new RuleBasedIntentAnalyzer(),
      intentRenderer: new DefaultIntentRenderer(),
    })
    const request = await builder.build(createPipelineContext({ input: '' }))
    expect(request.prompt).toBeDefined()
  })

  it('should handle blank input with both IntentAnalyzer and IntentRenderer', async () => {
    const builder = new DefaultPromptBuilder(createDefaultModules(), {
      intentAnalyzer: new RuleBasedIntentAnalyzer(),
      intentRenderer: new DefaultIntentRenderer(),
    })
    const request = await builder.build(createPipelineContext({ input: '   ' }))
    const assembly = request.metadata?.promptAssembly as Record<string, unknown>
    expect(assembly.intentRendered).toBe('')
  })

  it('should not inject intentRendered into the final prompt', async () => {
    const builder = new DefaultPromptBuilder(createDefaultModules(), {
      intentAnalyzer: new RuleBasedIntentAnalyzer(),
      intentRenderer: new DefaultIntentRenderer(),
    })
    const request = await builder.build(createPipelineContext({ input: 'draw a tree' }))
    expect(request.prompt).not.toContain('User Intent:')
    expect(request.prompt).not.toContain('- Create')
  })
})