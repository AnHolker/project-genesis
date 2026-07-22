import { describe, it, expect } from 'vitest'
import { DefaultPromptBuilder } from '../prompt/DefaultPromptBuilder'
import { DefaultPromptRenderer } from '../prompt/DefaultPromptRenderer'
import { DefaultPromptCompression } from '../prompt/DefaultPromptCompression'
import { DefaultMemoryRanking } from '../prompt/DefaultMemoryRanking'
import { DefaultPromptBudget } from '../prompt/DefaultPromptBudget'
import type { MemoryRanking } from '../prompt/MemoryRanking'
import type { PromptBudget } from '../prompt/PromptBudget'
import type { PromptCompression } from '../prompt/PromptCompression'
import type { PromptRenderer } from '../prompt/PromptRenderer'
import type { PromptContext } from '../prompt/PromptContext'
import type { PromptBudgetResult } from '../prompt/PromptBudgetResult'
import type { MemoryRankingResult } from '../prompt/MemoryRankingResult'
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
// Prompt Assembly — DefaultPromptBuilder uses all 5 components
// ---------------------------------------------------------------------------

describe('Prompt Assembly — Default Constructor', () => {
  it('should use all defaults (backward compatible)', async () => {
    const builder = new DefaultPromptBuilder([new SystemPromptModule(), new UserInputModule()])
    const request = await builder.build({ input: 'hello' })
    expect(request.prompt).toContain('Project Genesis')
    expect(request.prompt).toContain('hello')
  })

  it('should attach assembly metadata to AIRequest', async () => {
    const builder = new DefaultPromptBuilder([new UserInputModule()])
    const request = await builder.build({ input: 'hello' })
    expect(request.metadata).toBeDefined()
    expect(request.metadata!.promptAssembly).toBeDefined()
    const assembly = request.metadata!.promptAssembly as Record<string, unknown>
    expect(assembly.ranking).toBeDefined()
    expect(assembly.budget).toBeDefined()
  })

  it('should include ranking result in assembly metadata', async () => {
    const builder = new DefaultPromptBuilder([new UserInputModule()])
    const request = await builder.build({ input: 'hello' })
    const assembly = request.metadata!.promptAssembly as Record<string, unknown>
    const ranking = assembly.ranking as MemoryRankingResult
    expect(ranking.rankedSections).toContain('userInput')
    expect(ranking.priorities.userInput).toBe(100)
  })

  it('should include budget result in assembly metadata', async () => {
    const builder = new DefaultPromptBuilder([new UserInputModule()])
    const request = await builder.build({ input: 'hello' })
    const assembly = request.metadata!.promptAssembly as Record<string, unknown>
    const budget = assembly.budget as PromptBudgetResult
    expect(budget.totalLength).toBe(5)
    expect(budget.sectionLengths.userInput).toBe(5)
  })

  it('should preserve existing metadata when adding assembly info', async () => {
    const builder = new DefaultPromptBuilder([new UserInputModule()])
    const request = await builder.build({
      input: 'hello',
      metadata: { existingKey: 'existingValue' },
    })
    expect(request.metadata!.existingKey).toBe('existingValue')
    expect(request.metadata!.promptAssembly).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Prompt Assembly — Execution Order
// ---------------------------------------------------------------------------

describe('Prompt Assembly — Execution Order', () => {
  it('should execute components in correct order: rank → budget → compress → render', async () => {
    const executionOrder: string[] = []

    class TracedRanking implements MemoryRanking {
      rank(context: PromptContext): MemoryRankingResult {
        executionOrder.push('ranking')
        return new DefaultMemoryRanking().rank(context)
      }
    }

    class TracedBudget implements PromptBudget {
      calculate(context: PromptContext): PromptBudgetResult {
        executionOrder.push('budget')
        return new DefaultPromptBudget().calculate(context)
      }
    }

    class TracedCompression implements PromptCompression {
      compress(context: PromptContext): PromptContext {
        executionOrder.push('compression')
        return new DefaultPromptCompression().compress(context)
      }
    }

    class TracedRenderer implements PromptRenderer {
      render(context: PromptContext): string {
        executionOrder.push('renderer')
        return new DefaultPromptRenderer().render(context)
      }
    }

    const builder = new DefaultPromptBuilder(
      [new UserInputModule()],
      new TracedRenderer(),
      new TracedCompression(),
      new TracedRanking(),
      new TracedBudget(),
    )

    await builder.build({ input: 'hello' })

    expect(executionOrder).toEqual(['ranking', 'budget', 'compression', 'renderer'])
  })
})

// ---------------------------------------------------------------------------
// Prompt Assembly — Custom Components
// ---------------------------------------------------------------------------

describe('Prompt Assembly — Custom Components', () => {
  it('should accept custom ranking', async () => {
    class ReverseRanking implements MemoryRanking {
      rank(_context: PromptContext): MemoryRankingResult {
        return {
          rankedSections: ['system', 'userInput'],
          priorities: { system: 200, userInput: 100 },
        }
      }
    }
    const builder = new DefaultPromptBuilder(
      [new SystemPromptModule(), new UserInputModule()],
      undefined,
      undefined,
      new ReverseRanking(),
    )
    const request = await builder.build({ input: 'hello' })
    const assembly = request.metadata!.promptAssembly as Record<string, unknown>
    const ranking = assembly.ranking as MemoryRankingResult
    expect(ranking.rankedSections[0]).toBe('system')
  })

  it('should accept custom budget', async () => {
    class DoubleBudget implements PromptBudget {
      calculate(context: PromptContext): PromptBudgetResult {
        const base = new DefaultPromptBudget().calculate(context)
        return {
          totalLength: base.totalLength * 2,
          sectionLengths: Object.fromEntries(
            Object.entries(base.sectionLengths).map(([k, v]) => [k, v * 2]),
          ),
        }
      }
    }
    const builder = new DefaultPromptBuilder(
      [new UserInputModule()],
      undefined,
      undefined,
      undefined,
      new DoubleBudget(),
    )
    const request = await builder.build({ input: 'hello' })
    const assembly = request.metadata!.promptAssembly as Record<string, unknown>
    const budget = assembly.budget as PromptBudgetResult
    expect(budget.totalLength).toBe(10) // 5 * 2
  })

  it('should accept custom renderer', async () => {
    const builder = new DefaultPromptBuilder(
      [new UserInputModule()],
      { render: () => 'CUSTOM RENDER' },
      undefined,
      undefined,
      undefined,
    )
    const request = await builder.build({ input: 'hello' })
    expect(request.prompt).toBe('CUSTOM RENDER')
  })

  it('should accept custom compression', async () => {
    class StripAllCompression implements PromptCompression {
      compress(_context: PromptContext): PromptContext {
        return {}
      }
    }
    const builder = new DefaultPromptBuilder(
      [new UserInputModule()],
      undefined,
      new StripAllCompression(),
    )
    const request = await builder.build({ input: 'hello' })
    expect(request.prompt).toBe('')
  })
})

// ---------------------------------------------------------------------------
// Prompt Assembly — buildContext also runs full pipeline
// ---------------------------------------------------------------------------

describe('Prompt Assembly — buildContext', () => {
  it('should return compressed context from buildContext', async () => {
    const builder = new DefaultPromptBuilder([new UserInputModule()])
    const ctx = await builder.buildContext({ input: 'hello' })
    expect(ctx.userInput).toBe('hello')
  })

  it('should strip empty fields via compression in buildContext', async () => {
    const builder = new DefaultPromptBuilder([
      new SystemPromptModule(),
      new UserInputModule(),
    ])
    const ctx = await builder.buildContext({ input: '' })
    // userInput is '' → compression strips it
    expect(ctx.userInput).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Existing Prompt Modules Compatibility
// ---------------------------------------------------------------------------

describe('Prompt Assembly — Existing Prompt Modules', () => {
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
// Prompt Assembly — Backward Compatibility
// ---------------------------------------------------------------------------

describe('Prompt Assembly — Backward Compatibility', () => {
  it('should produce identical prompt text with 3-param constructor', async () => {
    const builder3 = new DefaultPromptBuilder(
      [new SystemPromptModule(), new UserInputModule()],
      new DefaultPromptRenderer(),
      new DefaultPromptCompression(),
    )
    const builder5 = new DefaultPromptBuilder(
      [new SystemPromptModule(), new UserInputModule()],
    )
    const result3 = await builder3.build({ input: 'hello' })
    const result5 = await builder5.build({ input: 'hello' })
    expect(result3.prompt).toBe(result5.prompt)
  })

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

  it('should mix legacy and context-aware modules with assembly', async () => {
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
// RetryPlanner Compatibility
// ---------------------------------------------------------------------------

describe('Prompt Assembly — RetryPlanner Compatibility', () => {
  it('should work with RetryPlanner and full assembly', async () => {
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

describe('Prompt Assembly — ToolCallPlanner Compatibility', () => {
  it('should work with ToolCallPlanner and full assembly', async () => {
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

describe('Prompt Assembly — Streaming Compatibility', () => {
  it('should work with streaming provider and full assembly', async () => {
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
// AgentLoop Integration
// ---------------------------------------------------------------------------

describe('Prompt Assembly — AgentLoop Integration', () => {
  it('should work with AgentLoop and Reflection and full assembly', async () => {
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
// Exports and Interface Verification
// ---------------------------------------------------------------------------

describe('Prompt Assembly — Interface Stability', () => {
  it('should not modify PromptBuilder interface', () => {
    const builder: PromptModule = new SystemPromptModule()
    expect(typeof builder.build).toBe('function')
  })
})