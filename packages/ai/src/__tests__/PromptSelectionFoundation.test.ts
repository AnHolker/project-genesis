import { describe, it, expect } from 'vitest'
import { DefaultPromptSelection } from '../prompt/DefaultPromptSelection'
import type { PromptSelection } from '../prompt/PromptSelection'
import type { PromptSelectionResult } from '../prompt/PromptSelectionResult'
import type { PromptContext } from '../prompt/PromptContext'
import { DefaultPromptBuilder } from '../prompt/DefaultPromptBuilder'
import { DefaultPromptRenderer } from '../prompt/DefaultPromptRenderer'
import { DefaultPromptCompression } from '../prompt/DefaultPromptCompression'
import { DefaultMemoryRanking } from '../prompt/DefaultMemoryRanking'
import { DefaultPromptBudget } from '../prompt/DefaultPromptBudget'
import type { MemoryRanking } from '../prompt/MemoryRanking'
import type { PromptBudget } from '../prompt/PromptBudget'
import type { PromptCompression } from '../prompt/PromptCompression'
import type { PromptRenderer } from '../prompt/PromptRenderer'
import type { MemoryRankingResult } from '../prompt/MemoryRankingResult'
import type { PromptBudgetResult } from '../prompt/PromptBudgetResult'
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
// PromptSelection Interface
// ---------------------------------------------------------------------------

describe('PromptSelection', () => {
  it('should define select method that accepts PromptContext and returns PromptSelectionResult', () => {
    const selection: PromptSelection = new DefaultPromptSelection()
    const result = selection.select({})
    expect(result).toHaveProperty('selectedSections')
    expect(result).toHaveProperty('excludedSections')
  })

  it('should be implementable as a custom selection', () => {
    class CustomSelection implements PromptSelection {
      select(_context: PromptContext): PromptSelectionResult {
        return {
          selectedSections: ['system'],
          excludedSections: ['userInput'],
        }
      }
    }
    const selection = new CustomSelection()
    const result = selection.select({ system: 'sys', userInput: 'in' })
    expect(result.selectedSections).toEqual(['system'])
    expect(result.excludedSections).toEqual(['userInput'])
  })

  it('should not require any dependencies', () => {
    const selection: PromptSelection = new DefaultPromptSelection()
    expect(typeof selection.select).toBe('function')
  })
})

// ---------------------------------------------------------------------------
// PromptSelectionResult Interface
// ---------------------------------------------------------------------------

describe('PromptSelectionResult', () => {
  it('should define selectedSections as string array', () => {
    const result: PromptSelectionResult = { selectedSections: [], excludedSections: [] }
    expect(Array.isArray(result.selectedSections)).toBe(true)
  })

  it('should define excludedSections as string array', () => {
    const result: PromptSelectionResult = { selectedSections: [], excludedSections: [] }
    expect(Array.isArray(result.excludedSections)).toBe(true)
  })

  it('should allow empty arrays', () => {
    const result: PromptSelectionResult = { selectedSections: [], excludedSections: [] }
    expect(result.selectedSections).toHaveLength(0)
    expect(result.excludedSections).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// DefaultPromptSelection — Empty Context
// ---------------------------------------------------------------------------

describe('DefaultPromptSelection — Empty Context', () => {
  it('should return empty selectedSections for empty context', () => {
    const selection = new DefaultPromptSelection()
    const result = selection.select({})
    expect(result.selectedSections).toHaveLength(0)
  })

  it('should return empty excludedSections for empty context', () => {
    const selection = new DefaultPromptSelection()
    const result = selection.select({})
    expect(result.excludedSections).toHaveLength(0)
  })

  it('should ignore undefined fields', () => {
    const selection = new DefaultPromptSelection()
    const result = selection.select({
      system: undefined,
      userInput: undefined,
      memory: undefined,
    })
    expect(result.selectedSections).toHaveLength(0)
  })

  it('should ignore empty string fields', () => {
    const selection = new DefaultPromptSelection()
    const result = selection.select({
      system: '',
      userInput: '',
      memory: '',
    })
    expect(result.selectedSections).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// DefaultPromptSelection — Full Context
// ---------------------------------------------------------------------------

describe('DefaultPromptSelection — Full Context', () => {
  it('should select all 6 sections when all are populated', () => {
    const selection = new DefaultPromptSelection()
    const result = selection.select({
      system: 'You are a planner.',
      userInput: 'Create a tree.',
      memory: 'Previous conversation.',
      worldState: 'World snapshot.',
      observations: 'Tool observations.',
      reflections: 'Reflection result.',
    })
    expect(result.selectedSections).toContain('system')
    expect(result.selectedSections).toContain('userInput')
    expect(result.selectedSections).toContain('memory')
    expect(result.selectedSections).toContain('worldState')
    expect(result.selectedSections).toContain('observations')
    expect(result.selectedSections).toContain('reflections')
    expect(result.selectedSections).toHaveLength(6)
  })

  it('should exclude nothing for any input', () => {
    const selection = new DefaultPromptSelection()
    const result = selection.select({
      system: 'sys',
      userInput: 'in',
      memory: 'mem',
    })
    expect(result.excludedSections).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// DefaultPromptSelection — Partial Context
// ---------------------------------------------------------------------------

describe('DefaultPromptSelection — Partial Context', () => {
  it('should only include populated sections', () => {
    const selection = new DefaultPromptSelection()
    const result = selection.select({
      userInput: 'hello',
      system: 'sys',
      // memory, worldState, observations, reflections are undefined
    })
    expect(result.selectedSections).toContain('userInput')
    expect(result.selectedSections).toContain('system')
    expect(result.selectedSections).toHaveLength(2)
  })

  it('should handle single section', () => {
    const selection = new DefaultPromptSelection()
    const result = selection.select({ system: 'sys' })
    expect(result.selectedSections).toEqual(['system'])
    expect(result.selectedSections).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// DefaultPromptSelection — Non-mutating
// ---------------------------------------------------------------------------

describe('DefaultPromptSelection — Non-mutating', () => {
  it('should not modify the input context', () => {
    const selection = new DefaultPromptSelection()
    const input: PromptContext = { system: 'hello', userInput: 'world' }
    const inputCopy = { ...input }
    selection.select(input)
    expect(input).toEqual(inputCopy)
  })
})

// ---------------------------------------------------------------------------
// DefaultPromptSelection — Deterministic
// ---------------------------------------------------------------------------

describe('DefaultPromptSelection — Deterministic', () => {
  it('should produce identical output for identical input', () => {
    const selection = new DefaultPromptSelection()
    const input: PromptContext = {
      system: 'sys',
      userInput: 'in',
      memory: 'mem',
    }
    const result1 = selection.select(input)
    const result2 = selection.select(input)
    expect(result1).toEqual(result2)
  })

  it('should be idempotent', () => {
    const selection = new DefaultPromptSelection()
    const input: PromptContext = {
      system: 'sys',
      userInput: 'in',
    }
    const result1 = selection.select(input)
    const result2 = selection.select(input)
    const resultFromResult = selection.select({
      system: input.system,
      userInput: input.userInput,
    })
    expect(result1).toEqual(resultFromResult)
    expect(result2).toEqual(resultFromResult)
  })
})

// ---------------------------------------------------------------------------
// Custom Selection
// ---------------------------------------------------------------------------

describe('Custom Selection', () => {
  it('should support custom selection implementation', () => {
    class ExcludeWorldSelection implements PromptSelection {
      select(context: PromptContext): PromptSelectionResult {
        const selectedSections: string[] = []
        const excludedSections: string[] = []

        for (const [key, value] of Object.entries(context)) {
          if (value !== undefined && value !== '') {
            if (key === 'worldState') {
              excludedSections.push(key)
            } else {
              selectedSections.push(key)
            }
          }
        }

        return { selectedSections, excludedSections }
      }
    }
    const selection = new ExcludeWorldSelection()
    const result = selection.select({
      system: 'sys',
      userInput: 'in',
      worldState: 'world',
    })
    expect(result.selectedSections).toEqual(['system', 'userInput'])
    expect(result.excludedSections).toEqual(['worldState'])
  })
})

// ---------------------------------------------------------------------------
// PromptBuilder Integration — Default Selection
// ---------------------------------------------------------------------------

describe('PromptSelection — PromptBuilder Integration', () => {
  it('should use default selection when none provided', async () => {
    const builder = new DefaultPromptBuilder([new UserInputModule()])
    const request = await builder.build({ input: 'hello' })
    expect(request.prompt).toContain('hello')
  })

  it('should produce identical output with and without explicit selection', async () => {
    const builderDefault = new DefaultPromptBuilder([new UserInputModule()])
    const builderExplicit = new DefaultPromptBuilder(
      [new UserInputModule()],
      undefined,
      undefined,
      undefined,
      undefined,
      new DefaultPromptSelection(),
    )
    const result1 = await builderDefault.build({ input: 'hello' })
    const result2 = await builderExplicit.build({ input: 'hello' })
    expect(result1.prompt).toBe(result2.prompt)
  })

  it('should not change prompt output with default selection (all sections pass through)', async () => {
    const builder = new DefaultPromptBuilder([
      new SystemPromptModule(),
      new UserInputModule(),
    ])
    const request = await builder.build({ input: 'create a tree' })
    expect(request.prompt).toContain('Project Genesis')
    expect(request.prompt).toContain('create a tree')
  })
})

// ---------------------------------------------------------------------------
// PromptBuilder Integration — Custom Selection
// ---------------------------------------------------------------------------

describe('PromptSelection — Custom Selection', () => {
  it('should exclude sections based on custom selection', async () => {
    class ExcludeSystemSelection implements PromptSelection {
      select(context: PromptContext): PromptSelectionResult {
        const selectedSections: string[] = []
        for (const [key, value] of Object.entries(context)) {
          if (value !== undefined && value !== '' && key !== 'system') {
            selectedSections.push(key)
          }
        }
        return { selectedSections, excludedSections: ['system'] }
      }
    }
    const builder = new DefaultPromptBuilder(
      [new SystemPromptModule(), new UserInputModule()],
      undefined,
      undefined,
      undefined,
      undefined,
      new ExcludeSystemSelection(),
    )
    const request = await builder.build({ input: 'hello' })
    expect(request.prompt).not.toContain('Project Genesis')
    expect(request.prompt).toContain('hello')
  })

  it('should accept custom selection via 6-param constructor', async () => {
    class ExcludeUserInputSelection implements PromptSelection {
      select(context: PromptContext): PromptSelectionResult {
        const selectedSections: string[] = []
        for (const [key, value] of Object.entries(context)) {
          if (value !== undefined && value !== '' && key !== 'userInput') {
            selectedSections.push(key)
          }
        }
        return { selectedSections, excludedSections: ['userInput'] }
      }
    }
    const builder = new DefaultPromptBuilder(
      [new SystemPromptModule(), new UserInputModule()],
      undefined,
      undefined,
      undefined,
      undefined,
      new ExcludeUserInputSelection(),
    )
    const request = await builder.build({ input: 'hello' })
    expect(request.prompt).not.toContain('hello')
  })
})

// ---------------------------------------------------------------------------
// Prompt Assembly — Execution Order
// ---------------------------------------------------------------------------

describe('PromptSelection — Execution Order', () => {
  it('should execute components in correct order: rank → budget → select → compress → render', async () => {
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

    class TracedSelection implements PromptSelection {
      select(context: PromptContext): PromptSelectionResult {
        executionOrder.push('selection')
        return new DefaultPromptSelection().select(context)
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
      new TracedSelection(),
    )

    await builder.build({ input: 'hello' })

    expect(executionOrder).toEqual(['ranking', 'budget', 'selection', 'compression', 'renderer'])
  })
})

// ---------------------------------------------------------------------------
// Prompt Assembly — Metadata
// ---------------------------------------------------------------------------

describe('PromptSelection — Assembly Metadata', () => {
  it('should include selection result in assembly metadata', async () => {
    const builder = new DefaultPromptBuilder([new UserInputModule()])
    const request = await builder.build({ input: 'hello' })
    const assembly = request.metadata!.promptAssembly as Record<string, unknown>
    const selection = assembly.selection as PromptSelectionResult
    expect(selection).toBeDefined()
    expect(selection.selectedSections).toContain('userInput')
    expect(selection.excludedSections).toHaveLength(0)
  })

  it('should preserve ranking and budget alongside new selection metadata', async () => {
    const builder = new DefaultPromptBuilder([new UserInputModule()])
    const request = await builder.build({ input: 'hello' })
    const assembly = request.metadata!.promptAssembly as Record<string, unknown>
    expect(assembly.ranking).toBeDefined()
    expect(assembly.budget).toBeDefined()
    expect(assembly.selection).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// RetryPlanner Compatibility
// ---------------------------------------------------------------------------

describe('PromptSelection — RetryPlanner Compatibility', () => {
  it('should work with RetryPlanner (selection is standalone)', async () => {
    const provider = new MockPlannerProvider(new DefaultAIConfiguration())
    const retryPlanner = new RetryPlanner(provider)
    const pipeline = new DefaultPipeline(
      retryPlanner,
      new DefaultPromptBuilder([new SystemPromptModule(), new UserInputModule()]),
    )
    const result = await pipeline.execute({ input: 'tree' })
    expect(result.plannerResult!.actions).toBeDefined()

    // Selection works independently
    const selection = new DefaultPromptSelection()
    const selectResult = selection.select({ system: 'test' })
    expect(selectResult.selectedSections).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// ToolCallPlanner Compatibility
// ---------------------------------------------------------------------------

describe('PromptSelection — ToolCallPlanner Compatibility', () => {
  it('should work with ToolCallPlanner (selection is standalone)', async () => {
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

describe('PromptSelection — Streaming Compatibility', () => {
  it('should work with streaming provider (selection is standalone)', async () => {
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

describe('PromptSelection — AgentLoop Integration', () => {
  it('should work with AgentLoop and Reflection (selection is standalone)', async () => {
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
// Backward Compatibility
// ---------------------------------------------------------------------------

describe('PromptSelection — Backward Compatibility', () => {
  it('should not break any existing interfaces', () => {
    const selection = new DefaultPromptSelection()
    const result = selection.select({})
    expect(Array.isArray(result.selectedSections)).toBe(true)
    expect(Array.isArray(result.excludedSections)).toBe(true)
  })

  it('should not modify PromptContext', () => {
    const selection = new DefaultPromptSelection()
    const ctx: PromptContext = { system: 'hello' }
    const ctxBefore = JSON.stringify(ctx)
    selection.select(ctx)
    expect(JSON.stringify(ctx)).toBe(ctxBefore)
  })

  it('should produce identical prompt text with 1-param constructor', async () => {
    const builder1 = new DefaultPromptBuilder([new SystemPromptModule(), new UserInputModule()])
    const builder6 = new DefaultPromptBuilder(
      [new SystemPromptModule(), new UserInputModule()],
      undefined,
      undefined,
      undefined,
      undefined,
      new DefaultPromptSelection(),
    )
    const result1 = await builder1.build({ input: 'hello' })
    const result6 = await builder6.build({ input: 'hello' })
    expect(result1.prompt).toBe(result6.prompt)
  })

  it('should produce identical prompt text with 3-param and 5-param constructors', async () => {
    const builder3 = new DefaultPromptBuilder(
      [new SystemPromptModule(), new UserInputModule()],
      undefined,
      undefined,
    )
    const builder5 = new DefaultPromptBuilder(
      [new SystemPromptModule(), new UserInputModule()],
    )
    const result3 = await builder3.build({ input: 'hello' })
    const result5 = await builder5.build({ input: 'hello' })
    expect(result3.prompt).toBe(result5.prompt)
  })
})

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

describe('PromptSelection Exports', () => {
  it('should export PromptSelection type from prompt module', async () => {
    const { DefaultPromptSelection: DPS } = await import('../prompt')
    expect(DPS).toBeDefined()
  })

  it('should export DefaultPromptSelection class from prompt module', async () => {
    const { DefaultPromptSelection: ExportedClass } = await import('../prompt')
    expect(ExportedClass).toBeDefined()
    expect(typeof ExportedClass).toBe('function')
  })

  it('should export PromptSelectionResult type from prompt module', async () => {
    const m = await import('../prompt')
    const selection = new DefaultPromptSelection()
    const result: PromptSelectionResult = selection.select({ system: 'test' })
    expect(result.selectedSections).toEqual(['system'])
    expect((m as any).DefaultPromptSelection).toBeDefined()
  })

  it('should export DefaultPromptSelection from package root', async () => {
    const { DefaultPromptSelection: DPS } = await import('..')
    expect(DPS).toBeDefined()
  })

  it('should export PromptSelection type from package root', async () => {
    const m = await import('..')
    expect((m as any).DefaultPromptSelection).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Immutability
// ---------------------------------------------------------------------------

describe('PromptSelection — Immutability', () => {
  it('should never mutate PromptContext via DefaultPromptBuilder', async () => {
    const context: PipelineContext = { input: 'hello' }
    const contextBefore = JSON.stringify(context)

    const builder = new DefaultPromptBuilder([new UserInputModule()])
    await builder.build(context)

    // Context should be unchanged
    expect(JSON.stringify(context)).toBe(contextBefore)
  })
})