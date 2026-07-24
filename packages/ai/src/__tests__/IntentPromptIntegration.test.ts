import { describe, it, expect } from 'vitest'
import { DefaultPromptRenderer } from '../prompt/DefaultPromptRenderer'
import type { PromptContext } from '../prompt/PromptContext'
import { serializePromptContext } from '../prompt/PromptContext'
import { DefaultPromptBuilder } from '../prompt/DefaultPromptBuilder'
import { RuleBasedIntentAnalyzer } from '../intent/RuleBasedIntentAnalyzer'
import { DefaultIntentAnalyzer } from '../intent/DefaultIntentAnalyzer'
import { DefaultIntentRenderer } from '../intent/DefaultIntentRenderer'
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
import { DefaultPromptRenderer as DefaultPromptRendererFromIndex } from '../prompt/index'
import { DefaultPromptRenderer as DefaultPromptRendererFromRoot } from '../index'

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
// DefaultPromptRenderer — Empty Intent
// ---------------------------------------------------------------------------

describe('DefaultPromptRenderer — empty intent', () => {
  const renderer = new DefaultPromptRenderer()

  it('should not include intentRendered section when empty string', () => {
    const ctx: PromptContext = { intentRendered: '', userInput: 'Draw a tree' }
    const result = renderer.render(ctx)
    expect(result).not.toContain('User Intent:')
    expect(result).toBe('Draw a tree')
  })

  it('should not include intentRendered section when undefined', () => {
    const ctx: PromptContext = { userInput: 'Draw a tree' }
    const result = renderer.render(ctx)
    expect(result).not.toContain('User Intent:')
    expect(result).toBe('Draw a tree')
  })

  it('should produce identical prompt with and without empty intentRendered', () => {
    const renderer = new DefaultPromptRenderer()
    const withEmpty = renderer.render({ intentRendered: '', userInput: 'hello' })
    const without = renderer.render({ userInput: 'hello' })
    expect(withEmpty).toBe(without)
  })

  it('should not create blank lines for empty intent', () => {
    const ctx: PromptContext = { intentRendered: '', system: 'sys', userInput: 'input' }
    const result = renderer.render(ctx)
    // Should NOT start with a blank line
    expect(result.startsWith('\n')).toBe(false)
    expect(result).toBe('sys\n\ninput')
  })
})

// ---------------------------------------------------------------------------
// DefaultPromptRenderer — Single Intent
// ---------------------------------------------------------------------------

describe('DefaultPromptRenderer — single intent', () => {
  const renderer = new DefaultPromptRenderer()

  it('should render single intent before user input', () => {
    const ctx: PromptContext = {
      intentRendered: 'User Intent:\n- Create',
      userInput: 'Draw a tree',
    }
    const result = renderer.render(ctx)
    expect(result).toContain('User Intent:')
    expect(result).toContain('- Create')
    expect(result).toContain('Draw a tree')
    // Intent comes before user input
    expect(result.indexOf('User Intent:')).toBeLessThan(result.indexOf('Draw a tree'))
  })

  it('should render single intent before system when system is present', () => {
    const ctx: PromptContext = {
      intentRendered: 'User Intent:\n- Create',
      system: 'You are a planner.',
      userInput: 'Draw a tree',
    }
    const result = renderer.render(ctx)
    // Intent is first
    expect(result.indexOf('User Intent:')).toBe(0)
    expect(result.indexOf('User Intent:')).toBeLessThan(result.indexOf('You are a planner.'))
  })

  it('should render each intent type correctly', () => {
    const renderer = new DefaultPromptRenderer()
    const types = [
      { type: 'Create', expected: 'User Intent:\n- Create' },
      { type: 'Delete', expected: 'User Intent:\n- Delete' },
      { type: 'Move', expected: 'User Intent:\n- Move' },
      { type: 'Modify', expected: 'User Intent:\n- Modify' },
      { type: 'Query', expected: 'User Intent:\n- Query' },
    ]
    for (const { type, expected } of types) {
      const ctx: PromptContext = { intentRendered: `User Intent:\n- ${type}`, userInput: 'test' }
      const result = renderer.render(ctx)
      expect(result).toContain(expected)
    }
  })
})

// ---------------------------------------------------------------------------
// DefaultPromptRenderer — Multiple Intents
// ---------------------------------------------------------------------------

describe('DefaultPromptRenderer — multiple intents', () => {
  const renderer = new DefaultPromptRenderer()

  it('should render multiple intents before user input', () => {
    const ctx: PromptContext = {
      intentRendered: 'User Intent:\n- Create\n- Move',
      userInput: 'Draw a tree then move it',
    }
    const result = renderer.render(ctx)
    expect(result).toContain('User Intent:')
    expect(result).toContain('- Create')
    expect(result).toContain('- Move')
    expect(result).toContain('Draw a tree then move it')
    expect(result.indexOf('User Intent:')).toBeLessThan(result.indexOf('Draw a tree'))
  })

  it('should render all five intent types', () => {
    const ctx: PromptContext = {
      intentRendered: 'User Intent:\n- Create\n- Delete\n- Move\n- Modify\n- Query',
      userInput: 'do everything',
    }
    const result = renderer.render(ctx)
    expect(result).toContain('User Intent:')
    expect(result).toContain('- Create\n- Delete\n- Move')
    expect(result).toContain('- Modify\n- Query')
  })
})

// ---------------------------------------------------------------------------
// Prompt Ordering
// ---------------------------------------------------------------------------

describe('DefaultPromptRenderer — prompt ordering', () => {
  const renderer = new DefaultPromptRenderer()

  it('should render intentRendered first in canonical order', () => {
    const order = DefaultPromptRenderer.CANONICAL_ORDER
    expect(order[0]).toBe('intentRendered')
  })

  it('should produce correct section order: intent → system → userInput', () => {
    const ctx: PromptContext = {
      intentRendered: 'User Intent:\n- Create',
      system: 'System instructions',
      userInput: 'Draw a tree',
    }
    const result = renderer.render(ctx)
    const lines = result.split('\n\n')
    expect(lines[0]).toContain('User Intent:')
    expect(lines[1]).toContain('System instructions')
    expect(lines[2]).toContain('Draw a tree')
  })
})

// ---------------------------------------------------------------------------
// Blank Line Rules
// ---------------------------------------------------------------------------

describe('DefaultPromptRenderer — blank line rules', () => {
  const renderer = new DefaultPromptRenderer()

  it('should have exactly one blank line between intent and user input', () => {
    const ctx: PromptContext = {
      intentRendered: 'User Intent:\n- Create',
      userInput: 'Draw a tree',
    }
    const result = renderer.render(ctx)
    expect(result).toBe('User Intent:\n- Create\n\nDraw a tree')
  })

  it('should have exactly one blank line between system and user input', () => {
    const ctx: PromptContext = {
      system: 'System instructions',
      userInput: 'Draw a tree',
    }
    const result = renderer.render(ctx)
    expect(result).toBe('System instructions\n\nDraw a tree')
  })

  it('should have exactly one blank line between each section', () => {
    const ctx: PromptContext = {
      intentRendered: 'User Intent:\n- Create',
      system: 'System instructions',
      userInput: 'Draw a tree',
    }
    const result = renderer.render(ctx)
    // Each section is separated by blank line
    expect(result).toBe('User Intent:\n- Create\n\nSystem instructions\n\nDraw a tree')
  })
})

// ---------------------------------------------------------------------------
// No Duplicate Rendering
// ---------------------------------------------------------------------------

describe('DefaultPromptRenderer — no duplicate rendering', () => {
  const renderer = new DefaultPromptRenderer()

  it('should not render intentRendered twice', () => {
    const ctx: PromptContext = {
      intentRendered: 'User Intent:\n- Create',
      userInput: 'Draw a tree',
    }
    const result = renderer.render(ctx)
    // Count occurrences of "User Intent:"
    const matches = result.match(/User Intent:/g)
    expect(matches).toHaveLength(1)
  })

  it('should not have duplicate blank lines', () => {
    const ctx: PromptContext = {
      intentRendered: 'User Intent:\n- Create',
      system: 'System instructions',
      userInput: 'Draw a tree',
    }
    const result = renderer.render(ctx)
    // Should not have triple newlines
    expect(result).not.toContain('\n\n\n')
  })
})

// ---------------------------------------------------------------------------
// Prompt Equality Without Intent
// ---------------------------------------------------------------------------

describe('DefaultPromptRenderer — prompt equality without intent', () => {
  const renderer = new DefaultPromptRenderer()

  it('should produce identical output when intentRendered is undefined vs empty', () => {
    const ctx1: PromptContext = { system: 'sys', userInput: 'input' }
    const ctx2: PromptContext = { intentRendered: '', system: 'sys', userInput: 'input' }
    expect(renderer.render(ctx1)).toBe(renderer.render(ctx2))
  })

  it('should not change output when no intent is present', () => {
    const ctx: PromptContext = { system: 'sys', userInput: 'input' }
    const result = renderer.render(ctx)
    expect(result).toBe('sys\n\ninput')
  })
})

// ---------------------------------------------------------------------------
// Deterministic Behavior
// ---------------------------------------------------------------------------

describe('DefaultPromptRenderer — deterministic', () => {
  const renderer = new DefaultPromptRenderer()

  it('should produce same output for same input', () => {
    const ctx: PromptContext = {
      intentRendered: 'User Intent:\n- Create',
      userInput: 'Draw a tree',
    }
    const result1 = renderer.render(ctx)
    const result2 = renderer.render(ctx)
    expect(result1).toBe(result2)
  })

  it('should produce consistent output across 10 calls', () => {
    const ctx: PromptContext = {
      intentRendered: 'User Intent:\n- Create',
      userInput: 'Draw a tree',
    }
    const results = Array.from({ length: 10 }, () => renderer.render(ctx))
    const first = results[0]
    results.forEach((r) => expect(r).toBe(first))
  })
})

// ---------------------------------------------------------------------------
// Stateless Behavior
// ---------------------------------------------------------------------------

describe('DefaultPromptRenderer — stateless', () => {
  it('should not retain state between calls', () => {
    const renderer = new DefaultPromptRenderer()
    const result1 = renderer.render({ intentRendered: 'User Intent:\n- Create', userInput: 'input1' })
    const result2 = renderer.render({ intentRendered: 'User Intent:\n- Move', userInput: 'input2' })
    expect(result1).toContain('- Create')
    expect(result2).toContain('- Move')
  })

  it('should produce independent results from separate instances', () => {
    const r1 = new DefaultPromptRenderer()
    const r2 = new DefaultPromptRenderer()
    const ctx: PromptContext = {
      intentRendered: 'User Intent:\n- Create',
      userInput: 'Draw a tree',
    }
    expect(r1.render(ctx)).toBe(r2.render(ctx))
  })
})

// ---------------------------------------------------------------------------
// Immutability
// ---------------------------------------------------------------------------

describe('DefaultPromptRenderer — immutability', () => {
  const renderer = new DefaultPromptRenderer()

  it('should not mutate the input PromptContext', () => {
    const ctx: PromptContext = {
      intentRendered: 'User Intent:\n- Create',
      userInput: 'Draw a tree',
    }
    const before = JSON.stringify(ctx)
    renderer.render(ctx)
    expect(JSON.stringify(ctx)).toBe(before)
  })
})

// ---------------------------------------------------------------------------
// serializePromptContext Compatibility
// ---------------------------------------------------------------------------

describe('serializePromptContext — intent rendering', () => {
  it('should render intentRendered via serializePromptContext', () => {
    const result = serializePromptContext({
      intentRendered: 'User Intent:\n- Create',
      userInput: 'Draw a tree',
    })
    expect(result).toContain('User Intent:')
    expect(result).toContain('- Create')
    expect(result).toContain('Draw a tree')
  })

  it('should skip empty intentRendered in serializePromptContext', () => {
    const result = serializePromptContext({
      intentRendered: '',
      userInput: 'Draw a tree',
    })
    expect(result).not.toContain('User Intent:')
    expect(result).toBe('Draw a tree')
  })
})

// ---------------------------------------------------------------------------
// PromptBuilder Integration
// ---------------------------------------------------------------------------

describe('DefaultPromptBuilder — intent prompt integration', () => {
  it('should include intent in the final prompt', async () => {
    const builder = new DefaultPromptBuilder(createDefaultModules(), {
      intentAnalyzer: new RuleBasedIntentAnalyzer(),
      intentRenderer: new DefaultIntentRenderer(),
    })
    const request = await builder.build(createPipelineContext({ input: 'draw a tree' }))
    expect(request.prompt).toContain('User Intent:')
    expect(request.prompt).toContain('- Create')
    expect(request.prompt).toContain('draw a tree')
  })

  it('should place intent section before user input in prompt', async () => {
    const builder = new DefaultPromptBuilder(createDefaultModules(), {
      intentAnalyzer: new RuleBasedIntentAnalyzer(),
      intentRenderer: new DefaultIntentRenderer(),
    })
    const request = await builder.build(createPipelineContext({ input: 'draw a tree' }))
    const intentIdx = request.prompt.indexOf('User Intent:')
    const inputIdx = request.prompt.indexOf('draw a tree')
    expect(intentIdx).toBeLessThan(inputIdx)
  })

  it('should include intent section for multi-intent input', async () => {
    const builder = new DefaultPromptBuilder(createDefaultModules(), {
      intentAnalyzer: new RuleBasedIntentAnalyzer(),
      intentRenderer: new DefaultIntentRenderer(),
    })
    const request = await builder.build(createPipelineContext({ input: 'draw a tree, and remove the flower' }))
    expect(request.prompt).toContain('- Create')
    expect(request.prompt).toContain('- Delete')
  })

  it('should NOT include intent in prompt when no IntentAnalyzer provided', async () => {
    const builder = new DefaultPromptBuilder(createDefaultModules())
    const request = await builder.build(createPipelineContext({ input: 'draw a tree' }))
    expect(request.prompt).not.toContain('User Intent:')
  })

  it('should NOT include intent in prompt when IntentAnalyzer returns empty', async () => {
    const builder = new DefaultPromptBuilder(createDefaultModules(), {
      intentAnalyzer: new DefaultIntentAnalyzer(),
      intentRenderer: new DefaultIntentRenderer(),
    })
    const request = await builder.build(createPipelineContext({ input: 'hello world' }))
    expect(request.prompt).not.toContain('User Intent:')
  })

  it('should include intent in prompt with DefaultIntentAnalyzer when intent is detected', async () => {
    const builder = new DefaultPromptBuilder(createDefaultModules(), {
      intentAnalyzer: new RuleBasedIntentAnalyzer(),
      intentRenderer: new DefaultIntentRenderer(),
    })
    const request = await builder.build(createPipelineContext({ input: 'create a tree' }))
    expect(request.prompt).toContain('User Intent:')
    expect(request.prompt).toContain('- Create')
  })
})

// ---------------------------------------------------------------------------
// Backward Compatibility
// ---------------------------------------------------------------------------

describe('DefaultPromptBuilder — backward compatibility', () => {
  it('should produce identical prompt when no IntentAnalyzer is configured', async () => {
    const builder = new DefaultPromptBuilder(createDefaultModules())
    const request = await builder.build(createPipelineContext({ input: 'draw a tree' }))
    expect(request.prompt).toBeDefined()
    expect(request.prompt).not.toContain('User Intent:')
  })

  it('should support legacy 1-param constructor', async () => {
    const builder = new DefaultPromptBuilder([new UserInputModule()])
    const request = await builder.build({ input: 'hello' })
    expect(request.prompt).toContain('hello')
    expect(request.prompt).not.toContain('User Intent:')
  })

  it('should support legacy 8-param constructor', async () => {
    const builder = new DefaultPromptBuilder(
      [new UserInputModule()],
      undefined, undefined, undefined, undefined, undefined, undefined, undefined,
    )
    const request = await builder.build({ input: 'hello' })
    expect(request.prompt).toContain('hello')
    expect(request.prompt).not.toContain('User Intent:')
  })

  it('should preserve existing metadata without IntentRenderer', async () => {
    const builder = new DefaultPromptBuilder(createDefaultModules(), {
      intentAnalyzer: new RuleBasedIntentAnalyzer(),
    })
    const request = await builder.build(createPipelineContext({ input: 'draw a tree' }))
    const assembly = request.metadata?.promptAssembly as Record<string, unknown>
    expect(assembly.ranking).toBeDefined()
    expect(assembly.budget).toBeDefined()
    expect(assembly.selection).toBeDefined()
    expect(assembly.intent).toBeDefined()
    // No intent in prompt when no IntentRenderer
    expect(request.prompt).not.toContain('User Intent:')
  })
})

// ---------------------------------------------------------------------------
// RetryPlanner Compatibility
// ---------------------------------------------------------------------------

describe('DefaultPromptBuilder — RetryPlanner compatibility', () => {
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

  it('should preserve intent in prompt through RetryPlanner', async () => {
    const builder = new DefaultPromptBuilder(createDefaultModules(), {
      intentAnalyzer: new RuleBasedIntentAnalyzer(),
      intentRenderer: new DefaultIntentRenderer(),
    })
    const request = await builder.build(createPipelineContext({ input: 'draw a tree' }))

    const planner = new RetryPlanner(new MockPlannerProvider(new DefaultAIConfiguration()))
    await planner.plan(request)

    expect(request.prompt).toContain('User Intent:')
    expect(request.prompt).toContain('- Create')
  })
})

// ---------------------------------------------------------------------------
// ToolCallPlanner Compatibility
// ---------------------------------------------------------------------------

describe('DefaultPromptBuilder — ToolCallPlanner compatibility', () => {
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

  it('should preserve intent in prompt through ToolCallPlanner', async () => {
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

    expect(request.prompt).toContain('User Intent:')
  })
})

// ---------------------------------------------------------------------------
// Streaming Compatibility
// ---------------------------------------------------------------------------

describe('DefaultPromptBuilder — streaming compatibility', () => {
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

  it('should preserve intent in prompt through streaming', async () => {
    const builder = new DefaultPromptBuilder(createDefaultModules(), {
      intentAnalyzer: new RuleBasedIntentAnalyzer(),
      intentRenderer: new DefaultIntentRenderer(),
    })
    const request = await builder.build(createPipelineContext({ input: 'draw a tree' }))

    const provider = new MockStreamingProvider()
    await provider.complete(request)

    expect(request.prompt).toContain('User Intent:')
  })
})

// ---------------------------------------------------------------------------
// AgentLoop Compatibility
// ---------------------------------------------------------------------------

describe('DefaultPromptBuilder — AgentLoop compatibility', () => {
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

  it('should preserve intent in prompt through AgentLoop', async () => {
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

    expect(request.prompt).toContain('User Intent:')
  })
})

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

describe('PromptRenderer — exports', () => {
  it('should export DefaultPromptRenderer from prompt/index', () => {
    const renderer = new DefaultPromptRendererFromIndex()
    expect(renderer).toBeInstanceOf(DefaultPromptRenderer)
  })

  it('should export DefaultPromptRenderer from package root', () => {
    const renderer = new DefaultPromptRendererFromRoot()
    expect(renderer).toBeInstanceOf(DefaultPromptRenderer)
  })
})

// ---------------------------------------------------------------------------
// Pipeline Integration
// ---------------------------------------------------------------------------

describe('DefaultPipeline — intent prompt integration', () => {
  it('should pass intent in prompt through full Pipeline', async () => {
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

  it('should pass intent in prompt through streaming Pipeline', async () => {
    const builder = new DefaultPromptBuilder(createDefaultModules(), {
      intentAnalyzer: new RuleBasedIntentAnalyzer(),
      intentRenderer: new DefaultIntentRenderer(),
    })
    const pipeline = new DefaultPipeline(new MockPlanner(new MockStreamingProvider()), builder, new MockStreamingProvider())

    const result = await pipeline.stream({
      input: 'draw a tree',
      memory: new DefaultMemory(),
    })

    expect(result.plannerResult).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Edge Cases
// ---------------------------------------------------------------------------

describe('DefaultPromptBuilder — edge cases', () => {
  it('should handle empty input with intent in prompt', async () => {
    const builder = new DefaultPromptBuilder(createDefaultModules(), {
      intentAnalyzer: new RuleBasedIntentAnalyzer(),
      intentRenderer: new DefaultIntentRenderer(),
    })
    const request = await builder.build(createPipelineContext({ input: '' }))
    expect(request.prompt).toBeDefined()
  })

  it('should handle blank input without intent section', async () => {
    const builder = new DefaultPromptBuilder(createDefaultModules(), {
      intentAnalyzer: new RuleBasedIntentAnalyzer(),
      intentRenderer: new DefaultIntentRenderer(),
    })
    const request = await builder.build(createPipelineContext({ input: '   ' }))
    expect(request.prompt).not.toContain('User Intent:')
  })

  it('should not have leading blank lines when intent is absent', async () => {
    const builder = new DefaultPromptBuilder(createDefaultModules())
    const request = await builder.build(createPipelineContext({ input: 'draw a tree' }))
    expect(request.prompt.startsWith('\n')).toBe(false)
  })
})