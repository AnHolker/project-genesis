import { describe, it, expect } from 'vitest'
import { DefaultPromptBudget } from '../prompt/DefaultPromptBudget'
import type { PromptBudget } from '../prompt/PromptBudget'
import type { PromptBudgetResult } from '../prompt/PromptBudgetResult'
import type { PromptContext } from '../prompt/PromptContext'
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
// PromptBudget Interface
// ---------------------------------------------------------------------------

describe('PromptBudget', () => {
  it('should define calculate method that accepts PromptContext and returns PromptBudgetResult', () => {
    const budget: PromptBudget = new DefaultPromptBudget()
    const result = budget.calculate({})
    expect(result).toHaveProperty('totalLength')
    expect(result).toHaveProperty('sectionLengths')
  })

  it('should be implementable as a custom budget', () => {
    class CustomBudget implements PromptBudget {
      calculate(_context: PromptContext): PromptBudgetResult {
        return {
          totalLength: 42,
          sectionLengths: { custom: 42 },
          estimatedTokens: 10,
        }
      }
    }
    const budget = new CustomBudget()
    const result = budget.calculate({ system: 'hello' })
    expect(result.totalLength).toBe(42)
    expect(result.sectionLengths.custom).toBe(42)
    expect(result.estimatedTokens).toBe(10)
  })

  it('should not require any dependencies', () => {
    const budget: PromptBudget = new DefaultPromptBudget()
    expect(typeof budget.calculate).toBe('function')
  })
})

// ---------------------------------------------------------------------------
// PromptBudgetResult Interface
// ---------------------------------------------------------------------------

describe('PromptBudgetResult', () => {
  it('should define totalLength as number', () => {
    const result: PromptBudgetResult = { totalLength: 0, sectionLengths: {} }
    expect(typeof result.totalLength).toBe('number')
  })

  it('should define sectionLengths as Record<string, number>', () => {
    const result: PromptBudgetResult = { totalLength: 0, sectionLengths: {} }
    expect(typeof result.sectionLengths).toBe('object')
  })

  it('should define estimatedTokens as optional number', () => {
    const result: PromptBudgetResult = { totalLength: 0, sectionLengths: {} }
    expect(result.estimatedTokens).toBeUndefined()

    const resultWithTokens: PromptBudgetResult = { totalLength: 0, sectionLengths: {}, estimatedTokens: 100 }
    expect(resultWithTokens.estimatedTokens).toBe(100)
  })
})

// ---------------------------------------------------------------------------
// DefaultPromptBudget — Empty Context
// ---------------------------------------------------------------------------

describe('DefaultPromptBudget — Empty Context', () => {
  it('should return totalLength 0 for empty context', () => {
    const budget = new DefaultPromptBudget()
    const result = budget.calculate({})
    expect(result.totalLength).toBe(0)
  })

  it('should return empty sectionLengths for empty context', () => {
    const budget = new DefaultPromptBudget()
    const result = budget.calculate({})
    expect(Object.keys(result.sectionLengths)).toHaveLength(0)
  })

  it('should ignore undefined fields', () => {
    const budget = new DefaultPromptBudget()
    const result = budget.calculate({
      system: undefined,
      userInput: undefined,
      memory: undefined,
    })
    expect(result.totalLength).toBe(0)
    expect(Object.keys(result.sectionLengths)).toHaveLength(0)
  })

  it('should ignore empty string fields', () => {
    const budget = new DefaultPromptBudget()
    const result = budget.calculate({
      system: '',
      userInput: '',
      memory: '',
    })
    expect(result.totalLength).toBe(0)
    expect(Object.keys(result.sectionLengths)).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// DefaultPromptBudget — Section Length
// ---------------------------------------------------------------------------

describe('DefaultPromptBudget — Section Length', () => {
  it('should calculate length for a single section', () => {
    const budget = new DefaultPromptBudget()
    const result = budget.calculate({ system: 'hello' })
    expect(result.sectionLengths.system).toBe(5)
    expect(result.totalLength).toBe(5)
  })

  it('should calculate lengths for multiple sections', () => {
    const budget = new DefaultPromptBudget()
    const result = budget.calculate({
      system: 'sys',
      userInput: 'user input',
      memory: 'memory text',
    })
    expect(result.sectionLengths.system).toBe(3)
    expect(result.sectionLengths.userInput).toBe(10)
    expect(result.sectionLengths.memory).toBe(11)
    expect(result.totalLength).toBe(3 + 10 + 11)
  })

  it('should include all populated fields', () => {
    const budget = new DefaultPromptBudget()
    const result = budget.calculate({
      system: 'sys',
      userInput: 'in',
      memory: 'mem',
      worldState: 'world',
      observations: 'obs',
      reflections: 'refl',
    })
    expect(result.sectionLengths.system).toBe(3)
    expect(result.sectionLengths.userInput).toBe(2)
    expect(result.sectionLengths.memory).toBe(3)
    expect(result.sectionLengths.worldState).toBe(5)
    expect(result.sectionLengths.observations).toBe(3)
    expect(result.sectionLengths.reflections).toBe(4)
    expect(result.totalLength).toBe(3 + 2 + 3 + 5 + 3 + 4)
  })
})

// ---------------------------------------------------------------------------
// DefaultPromptBudget — Full Context
// ---------------------------------------------------------------------------

describe('DefaultPromptBudget — Full Context', () => {
  it('should calculate totalLength correctly for full context', () => {
    const budget = new DefaultPromptBudget()
    const result = budget.calculate({
      system: 'You are a helpful assistant.',
      userInput: 'Create a tree at position (5, 3).',
      memory: 'Previous conversation:\n- Created a house',
      worldState: 'Current World:\nTree at (3, 5)',
      observations: '## Previous Observations\nTool: find',
      reflections: '## Previous Reflection\nTask complete',
    })
    expect(result.totalLength).toBe(result.sectionLengths.system! +
      result.sectionLengths.userInput! +
      result.sectionLengths.memory! +
      result.sectionLengths.worldState! +
      result.sectionLengths.observations! +
      result.sectionLengths.reflections!)
  })

  it('should not set estimatedTokens by default', () => {
    const budget = new DefaultPromptBudget()
    const result = budget.calculate({ system: 'hello' })
    expect(result.estimatedTokens).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// DefaultPromptBudget — Non-mutating
// ---------------------------------------------------------------------------

describe('DefaultPromptBudget — Non-mutating', () => {
  it('should not modify the input context', () => {
    const budget = new DefaultPromptBudget()
    const input: PromptContext = { system: 'hello', userInput: 'world' }
    const inputCopy = { ...input }
    budget.calculate(input)
    expect(input).toEqual(inputCopy)
  })
})

// ---------------------------------------------------------------------------
// Custom Budget
// ---------------------------------------------------------------------------

describe('Custom Budget', () => {
  it('should support custom budget implementation', () => {
    class WeightedBudget implements PromptBudget {
      calculate(context: PromptContext): PromptBudgetResult {
        const sectionLengths: Record<string, number> = {}
        let weightedTotal = 0
        for (const [key, value] of Object.entries(context)) {
          if (typeof value === 'string' && value.length > 0) {
            // Weight system prompt 2x for "importance"
            const weight = key === 'system' ? 2 : 1
            sectionLengths[key] = value.length * weight
            weightedTotal += value.length * weight
          }
        }
        return { totalLength: weightedTotal, sectionLengths }
      }
    }
    const budget = new WeightedBudget()
    const result = budget.calculate({ system: 'sys', userInput: 'in' })
    // system: 3 * 2 = 6, userInput: 2 * 1 = 2
    expect(result.sectionLengths.system).toBe(6)
    expect(result.sectionLengths.userInput).toBe(2)
    expect(result.totalLength).toBe(8)
  })

  it('should allow TokenBudget-like implementation that sets estimatedTokens', () => {
    class MockTokenBudget implements PromptBudget {
      calculate(context: PromptContext): PromptBudgetResult {
        const sectionLengths: Record<string, number> = {}
        let totalChars = 0
        for (const [key, value] of Object.entries(context)) {
          if (typeof value === 'string') {
            sectionLengths[key] = value.length
            totalChars += value.length
          }
        }
        // Rough estimate: ~4 chars per token
        return {
          totalLength: totalChars,
          sectionLengths,
          estimatedTokens: Math.ceil(totalChars / 4),
        }
      }
    }
    const budget = new MockTokenBudget()
    const result = budget.calculate({ system: 'hello world' })
    // 11 chars / 4 = 2.75 → ceil to 3
    expect(result.estimatedTokens).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// RetryPlanner Compatibility
// ---------------------------------------------------------------------------

describe('PromptBudget — RetryPlanner Compatibility', () => {
  it('should work with RetryPlanner (budget is standalone)', async () => {
    // Budget does not depend on Planner — verify no interference
    const provider = new MockPlannerProvider(new DefaultAIConfiguration())
    const retryPlanner = new RetryPlanner(provider)
    const pipeline = new DefaultPipeline(
      retryPlanner,
      new DefaultPromptBuilder([new SystemPromptModule(), new UserInputModule()]),
    )
    const result = await pipeline.execute({ input: 'tree' })
    expect(result.plannerResult!.actions).toBeDefined()

    // Budget works independently
    const budget = new DefaultPromptBudget()
    const budgetResult = budget.calculate({ system: 'test' })
    expect(budgetResult.totalLength).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// ToolCallingPlanner Compatibility
// ---------------------------------------------------------------------------

describe('PromptBudget — ToolCallPlanner Compatibility', () => {
  it('should work with ToolCallPlanner (budget is standalone)', async () => {
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

describe('PromptBudget — Streaming Compatibility', () => {
  it('should work with streaming provider (budget is standalone)', async () => {
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

describe('PromptBudget — AgentLoop Integration', () => {
  it('should work with AgentLoop and Reflection (budget is standalone)', async () => {
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

describe('PromptBudget — Backward Compatibility', () => {
  it('should not break any existing interfaces', () => {
    // Budget is standalone — verify it doesn't affect existing components
    const budget = new DefaultPromptBudget()
    const result = budget.calculate({})
    expect(typeof result.totalLength).toBe('number')
  })

  it('should not modify PromptContext', () => {
    const budget = new DefaultPromptBudget()
    const ctx: PromptContext = { system: 'hello' }
    const ctxBefore = JSON.stringify(ctx)
    budget.calculate(ctx)
    expect(JSON.stringify(ctx)).toBe(ctxBefore)
  })
})

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

describe('PromptBudget Exports', () => {
  it('should export PromptBudget type from prompt module', async () => {
    const { DefaultPromptBudget: DPB } = await import('../prompt')
    expect(DPB).toBeDefined()
  })

  it('should export DefaultPromptBudget class from prompt module', async () => {
    const { DefaultPromptBudget: ExportedClass } = await import('../prompt')
    expect(ExportedClass).toBeDefined()
    expect(typeof ExportedClass).toBe('function')
  })

  it('should export PromptBudgetResult type from prompt module', async () => {
    const m = await import('../prompt')
    // type-only — verify by checking that DefaultPromptBudget returns it
    const budget = new DefaultPromptBudget()
    const result: PromptBudgetResult = budget.calculate({ system: 'test' })
    expect(result.totalLength).toBe(4)
  })

  it('should export DefaultPromptBudget from package root', async () => {
    const { DefaultPromptBudget: DPB } = await import('..')
    expect(DPB).toBeDefined()
  })
})