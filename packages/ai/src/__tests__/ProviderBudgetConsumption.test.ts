import { describe, it, expect } from 'vitest'
import { DefaultPromptSelection } from '../prompt/DefaultPromptSelection'
import { DefaultPromptBuilder } from '../prompt/DefaultPromptBuilder'
import { DefaultProviderBudget } from '../prompt/DefaultProviderBudget'
import type { PromptSelection } from '../prompt/PromptSelection'
import type { PromptSelectionResult } from '../prompt/PromptSelectionResult'
import type { PromptContext } from '../prompt/PromptContext'
import type { ProviderBudget } from '../prompt/ProviderBudget'
import type { ProviderBudgetResult } from '../prompt/ProviderBudgetResult'
import type { MemoryRankingResult } from '../prompt/MemoryRankingResult'
import type { PromptBudgetResult } from '../prompt/PromptBudgetResult'
import type { MemoryRanking } from '../prompt/MemoryRanking'
import type { PromptBudget } from '../prompt/PromptBudget'
import type { PromptCompression } from '../prompt/PromptCompression'
import type { PromptRenderer } from '../prompt/PromptRenderer'
import { DefaultPromptRenderer } from '../prompt/DefaultPromptRenderer'
import { DefaultPromptCompression } from '../prompt/DefaultPromptCompression'
import { DefaultMemoryRanking } from '../prompt/DefaultMemoryRanking'
import { DefaultPromptBudget } from '../prompt/DefaultPromptBudget'
import {
  SystemPromptModule,
  UserInputModule,
  MemoryPromptModule,
} from '../prompt/modules'
import { DefaultMemory } from '../memory/DefaultMemory'
import { DefaultReflection } from '../reflection/DefaultReflection'
import { DefaultAgentLoop } from '../agent/DefaultAgentLoop'
import { DefaultToolRegistry } from '../tools/ToolRegistry'
import { DefaultPipeline } from '../pipeline/DefaultPipeline'
import { MockPlanner, RetryPlanner, ToolCallPlanner } from '../planner'
import { MockPlannerProvider, MockStreamingProvider } from '../provider'
import { DefaultAIConfiguration } from '../config'
import type { Tool } from '../tools'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockTool(name: string, output: unknown = { found: true }): Tool {
  return {
    name,
    description: `Mock: ${name}`,
    async execute(_input: unknown): Promise<unknown> {
      return output
    },
  }
}

function makeContext(overrides?: Partial<PromptContext>): PromptContext {
  return {
    system: 'System instructions.',
    userInput: 'User query.',
    memory: 'Conversation history.',
    worldState: 'World snapshot.',
    observations: 'Tool observations.',
    reflections: 'Reflection result.',
    ...overrides,
  }
}

function makeRanking(): MemoryRankingResult {
  return {
    rankedSections: ['userInput', 'reflections', 'observations', 'memory', 'worldState', 'system'],
    priorities: { userInput: 100, reflections: 80, observations: 60, memory: 40, worldState: 20, system: 10 },
  }
}

function makeBudget(totalLength: number = 100): PromptBudgetResult {
  return {
    totalLength,
    sectionLengths: {
      system: 10,
      userInput: 10,
      memory: 20,
      worldState: 20,
      observations: 20,
      reflections: 20,
    },
  }
}

function makeProviderBudget(
  maxInputTokens: number = 8192,
  maxOutputTokens?: number,
): ProviderBudgetResult {
  return { maxInputTokens, ...(maxOutputTokens !== undefined ? { maxOutputTokens } : {}) }
}

// ---------------------------------------------------------------------------
// ProviderBudget Consumption — DefaultPromptSelection
// ---------------------------------------------------------------------------

describe('DefaultPromptSelection — ProviderBudget Consumption', () => {
  it('should use ProviderBudget when provided to calculate dynamic threshold', () => {
    // mock budget: 8000 chars, provider: 1000 tokens * 4 chars/token = 4000 chars
    // 4000 < 8000 → budget constrained
    const selection = new DefaultPromptSelection()
    const ranking = makeRanking()
    const budget = makeBudget(8000)
    const providerBudget = makeProviderBudget(1000) // 1000 * 4 = 4000 chars threshold

    const result = selection.select(makeContext(), ranking, budget, providerBudget)

    // Should exclude low priority sections
    expect(result.excludedSections.length).toBeGreaterThan(0)
    expect(result.selectedSections).toContain('userInput')
    expect(result.selectedSections.length).toBeLessThan(6)
  })

  it('should preserve all sections when provider capacity is large enough', () => {
    // provider: 100000 tokens * 4 = 400000 chars → way more than 100
    const selection = new DefaultPromptSelection()
    const ranking = makeRanking()
    const budget = makeBudget(100)
    const providerBudget = makeProviderBudget(100000)

    const result = selection.select(makeContext(), ranking, budget, providerBudget)

    expect(result.selectedSections).toHaveLength(6)
    expect(result.excludedSections).toHaveLength(0)
  })

  it('should use ProviderBudget threshold over static maxBudgetChars', () => {
    // Static: Infinity (no exclusion)
    // Provider: 100 tokens * 4 = 400 chars → very constrained
    const selection = new DefaultPromptSelection() // maxBudgetChars = Infinity
    const ranking = makeRanking()
    const budget = makeBudget(100)
    const providerBudget = makeProviderBudget(100) // 100 * 4 = 400 chars

    const result = selection.select(makeContext(), ranking, budget, providerBudget)

    // ProviderBudget says 100 tokens → 400 chars → 100 total > 400? No, 100 <= 400
    // Actually 100 totalLength <= 400 maxBudgetChars → preserve all
    expect(result.selectedSections).toHaveLength(6)
  })

  it('should trigger exclusion when provider capacity is very small', () => {
    // Provider: 10 tokens * 4 = 40 chars → everything exceeds
    const selection = new DefaultPromptSelection()
    const ranking = makeRanking()
    const budget = makeBudget(100)
    const providerBudget = makeProviderBudget(10) // 10 * 4 = 40 chars

    const result = selection.select(makeContext(), ranking, budget, providerBudget)

    expect(result.excludedSections.length).toBeGreaterThan(0)
    expect(result.selectedSections.length).toBeGreaterThanOrEqual(1)
  })

  it('should fall back to static maxBudgetChars when ProviderBudget is not provided', () => {
    // Static: 1000 chars → enough
    const selection = new DefaultPromptSelection(1000)
    const ranking = makeRanking()
    const budget = makeBudget(100)

    const result = selection.select(makeContext(), ranking, budget)

    expect(result.selectedSections).toHaveLength(6)
    expect(result.excludedSections).toHaveLength(0)
  })

  it('should fall back to static maxBudgetChars when ProviderBudget is undefined', () => {
    // Static: 50 chars → constrained
    const selection = new DefaultPromptSelection(50)
    const ranking = makeRanking()
    const budget = makeBudget(100)

    const result = selection.select(makeContext(), ranking, budget, undefined)

    expect(result.excludedSections.length).toBeGreaterThan(0)
  })

  it('should exclude correct sections based on token limit', () => {
    const selection = new DefaultPromptSelection()
    const ranking: MemoryRankingResult = {
      rankedSections: ['userInput', 'memory', 'system'],
      priorities: { userInput: 100, memory: 40, system: 10 },
    }
    const budget: PromptBudgetResult = {
      totalLength: 45,
      sectionLengths: { userInput: 15, memory: 15, system: 15 },
    }
    const providerBudget = makeProviderBudget(7) // 7 * 4 = 28 chars

    const result = selection.select(
      { userInput: 'x'.repeat(15), memory: 'x'.repeat(15), system: 'x'.repeat(15) },
      ranking,
      budget,
      providerBudget,
    )

    // 28 chars limit → system (10) removed gives 30 > 28 → userInput alone = 15 <= 28
    expect(result.selectedSections).toContain('userInput')
    expect(result.selectedSections).not.toContain('system')
    expect(result.selectedSections).not.toContain('memory')
  })

  it('should still exclude sections when providerBudget is provided without maxOutputTokens', () => {
    const selection = new DefaultPromptSelection()
    const ranking = makeRanking()
    const budget = makeBudget(200)
    const providerBudget: ProviderBudgetResult = { maxInputTokens: 25 } // 25 * 4 = 100 chars

    const result = selection.select(makeContext(), ranking, budget, providerBudget)

    expect(result.excludedSections.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// Different Provider Budgets
// ---------------------------------------------------------------------------

describe('DefaultPromptSelection — Different Provider Budgets', () => {
  const providerBudgets = new DefaultProviderBudget()
  const ranking = makeRanking()
  const budget = makeBudget(50000) // 50K chars — exceeds some providers, fits others

  it(`should use OpenAI's 8K token limit (32K chars)`, () => {
    const selection = new DefaultPromptSelection()
    const pb = providerBudgets.getBudget('openai') // 8192 tokens * 4 = 32768 chars
    const result = selection.select(makeContext(), ranking, budget, pb)
    // 50000 > 32768 → constrained
    expect(result.excludedSections.length).toBeGreaterThan(0)
  })

  it(`should use DeepSeek's 65K token limit (260K chars)`, () => {
    const selection = new DefaultPromptSelection()
    const pb = providerBudgets.getBudget('deepseek') // 65536 tokens * 4 = 262144 chars
    const result = selection.select(makeContext(), ranking, budget, pb)
    // 50000 <= 262144 → not constrained
    expect(result.excludedSections).toHaveLength(0)
    expect(result.selectedSections).toHaveLength(6)
  })

  it(`should use Anthropic's 100K token limit (400K chars)`, () => {
    const selection = new DefaultPromptSelection()
    const pb = providerBudgets.getBudget('anthropic') // 100000 tokens * 4 = 400000 chars
    const result = selection.select(makeContext(), ranking, budget, pb)
    // 50000 <= 400000 → not constrained
    expect(result.excludedSections).toHaveLength(0)
  })

  it(`should use Mock's 4K token limit (16K chars)`, () => {
    const selection = new DefaultPromptSelection()
    const pb = providerBudgets.getBudget('mock') // 4096 tokens * 4 = 16384 chars
    const result = selection.select(makeContext(), ranking, budget, pb)
    // 50000 > 16384 → constrained
    expect(result.excludedSections.length).toBeGreaterThan(0)
  })

  it('should produce different thresholds for different providers', () => {
    const selection = new DefaultPromptSelection()
    const openai = providerBudgets.getBudget('openai')
    const deepseek = providerBudgets.getBudget('deepseek')

    const resultOpenAI = selection.select(
      { userInput: 'x'.repeat(20000), memory: 'x'.repeat(20000), system: 'x'.repeat(10000) },
      {
        rankedSections: ['userInput', 'memory', 'system'],
        priorities: { userInput: 100, memory: 40, system: 10 },
      },
      { totalLength: 50000, sectionLengths: { userInput: 20000, memory: 20000, system: 10000 } },
      openai,
    )

    const resultDeepSeek = selection.select(
      { userInput: 'x'.repeat(20000), memory: 'x'.repeat(20000), system: 'x'.repeat(10000) },
      {
        rankedSections: ['userInput', 'memory', 'system'],
        priorities: { userInput: 100, memory: 40, system: 10 },
      },
      { totalLength: 50000, sectionLengths: { userInput: 20000, memory: 20000, system: 10000 } },
      deepseek,
    )

    // OpenAI (32K) → constrained with 50K
    // DeepSeek (262K) → not constrained with 50K
    expect(resultOpenAI.excludedSections.length).toBeGreaterThan(0)
    expect(resultDeepSeek.excludedSections).toHaveLength(0)
  })

  it('should use model-specific limits for gpt-4o vs gpt-3.5-turbo', () => {
    const selection = new DefaultPromptSelection()
    const gpt4o = providerBudgets.getBudget('openai', 'gpt-4o') // 128000 tokens * 4 = 512K chars
    const gpt35 = providerBudgets.getBudget('openai', 'gpt-3.5-turbo') // 16385 tokens * 4 = 65540 chars

    const budget: PromptBudgetResult = {
      totalLength: 100000,
      sectionLengths: { userInput: 50000, memory: 30000, system: 20000 },
    }

    const resultGPT4o = selection.select(
      { userInput: 'x'.repeat(50000), memory: 'x'.repeat(30000), system: 'x'.repeat(20000) },
      {
        rankedSections: ['userInput', 'memory', 'system'],
        priorities: { userInput: 100, memory: 40, system: 10 },
      },
      budget,
      gpt4o,
    )

    const resultGPT35 = selection.select(
      { userInput: 'x'.repeat(50000), memory: 'x'.repeat(30000), system: 'x'.repeat(20000) },
      {
        rankedSections: ['userInput', 'memory', 'system'],
        priorities: { userInput: 100, memory: 40, system: 10 },
      },
      budget,
      gpt35,
    )

    // gpt-4o (512K) → not constrained
    // gpt-3.5-turbo (65540) → constrained with 100K
    expect(resultGPT4o.excludedSections).toHaveLength(0)
    expect(resultGPT35.excludedSections.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// Unknown Provider Fallback
// ---------------------------------------------------------------------------

describe('DefaultPromptSelection — Unknown Provider Fallback', () => {
  it('should use fallback budget for unknown provider (4K tokens → 16K chars)', () => {
    const providerBudgets = new DefaultProviderBudget()
    const selection = new DefaultPromptSelection()
    const ranking = makeRanking()
    const budget = makeBudget(20000) // 20K chars > 16K chars fallback
    const pb = providerBudgets.getBudget('unknown') // 4096 * 4 = 16384 chars

    const result = selection.select(makeContext(), ranking, budget, pb)

    expect(result.excludedSections.length).toBeGreaterThan(0)
  })

  it('should still work when providerBudget is fallback (no crash)', () => {
    const providerBudgets = new DefaultProviderBudget()
    const selection = new DefaultPromptSelection()
    const ranking = makeRanking()
    const budget = makeBudget(100) // small prompt
    const pb = providerBudgets.getBudget('nonexistent-provider')

    const result = selection.select(makeContext(), ranking, budget, pb)

    // Prompt fits within fallback budget → no exclusion
    expect(result.excludedSections).toHaveLength(0)
    expect(result.selectedSections).toHaveLength(6)
  })
})

// ---------------------------------------------------------------------------
// Deterministic Behavior with ProviderBudget
// ---------------------------------------------------------------------------

describe('DefaultPromptSelection — Deterministic with ProviderBudget', () => {
  it('should produce identical results for identical inputs with ProviderBudget', () => {
    const selection = new DefaultPromptSelection()
    const ranking = makeRanking()
    const budget = makeBudget(50000)
    const pb = makeProviderBudget(1000) // constrained

    const result1 = selection.select(makeContext(), ranking, budget, pb)
    const result2 = selection.select(makeContext(), ranking, budget, pb)

    expect(result1).toEqual(result2)
  })

  it('should be idempotent with the same ProviderBudget', () => {
    const selection = new DefaultPromptSelection()
    const ctx = makeContext()
    const ranking = makeRanking()
    const budget = makeBudget(50000)
    const pb = makeProviderBudget(1000)

    const result = selection.select(ctx, ranking, budget, pb)
    // Applying the same selection should give the same result
    const resultAgain = selection.select(ctx, ranking, budget, pb)
    expect(result).toEqual(resultAgain)
  })

  it('CharsPerToken ratio affects exclusion threshold', () => {
    // ratio 2 → 1000 tokens * 2 = 2000 chars → very constrained
    const selectionStrict = new DefaultPromptSelection(Infinity, 2)
    // ratio 8 → 1000 tokens * 8 = 8000 chars → less constrained
    const selectionLoose = new DefaultPromptSelection(Infinity, 8)

    const ranking = makeRanking()
    const budget = makeBudget(100) // 100 chars total
    const pb = makeProviderBudget(100) // 100 tokens

    const resultStrict = selectionStrict.select(makeContext(), ranking, budget, pb)
    const resultLoose = selectionLoose.select(makeContext(), ranking, budget, pb)

    // strict: 100 chars <= 200 chars → not constrained
    // loose: 100 chars <= 800 chars → not constrained
    // Both should preserve all at this size
    expect(resultStrict.selectedSections).toHaveLength(6)
    expect(resultLoose.selectedSections).toHaveLength(6)

    // But with larger prompt:
    const bigBudget = makeBudget(500)
    const pbSmall = makeProviderBudget(100)

    const resultStrictBig = selectionStrict.select(makeContext(), ranking, bigBudget, pbSmall)
    const resultLooseBig = selectionLoose.select(makeContext(), ranking, bigBudget, pbSmall)

    // strict: 500 chars > 200 chars → constrained
    // loose: 500 chars <= 800 chars → not constrained
    expect(resultStrictBig.excludedSections.length).toBeGreaterThan(0)
    expect(resultLooseBig.excludedSections).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Immutability with ProviderBudget
// ---------------------------------------------------------------------------

describe('Immutability with ProviderBudget', () => {
  it('should not modify input context when providerBudget is provided', () => {
    const selection = new DefaultPromptSelection()
    const ctx: PromptContext = { system: 'hello', userInput: 'world' }
    const ctxCopy = { ...ctx }
    const ranking = makeRanking()
    const budget = makeBudget(100)
    const pb = makeProviderBudget(1000)

    selection.select(ctx, ranking, budget, pb)
    expect(ctx).toEqual(ctxCopy)
  })

  it('should not modify ranking, budget, or providerBudget inputs', () => {
    const selection = new DefaultPromptSelection()
    const ranking: MemoryRankingResult = {
      rankedSections: ['userInput', 'system'],
      priorities: { userInput: 100, system: 10 },
    }
    const budget: PromptBudgetResult = {
      totalLength: 20,
      sectionLengths: { userInput: 10, system: 10 },
    }
    const pb: ProviderBudgetResult = { maxInputTokens: 5000 }

    const rankingCopy = { ...ranking, priorities: { ...ranking.priorities } }
    const budgetCopy = { ...budget, sectionLengths: { ...budget.sectionLengths } }
    const pbCopy = { ...pb }

    selection.select({ userInput: 'x'.repeat(10), system: 'x'.repeat(10) }, ranking, budget, pb)

    expect(ranking).toEqual(rankingCopy)
    expect(budget).toEqual(budgetCopy)
    expect(pb).toEqual(pbCopy)
  })
})

// ---------------------------------------------------------------------------
// Custom ProviderBudget Implementation
// ---------------------------------------------------------------------------

describe('Custom ProviderBudget with Selection', () => {
  it('should work with custom ProviderBudget implementation', () => {
    class TinyProviderBudget implements ProviderBudget {
      getBudget(_provider: string, _model?: string): ProviderBudgetResult {
        return { maxInputTokens: 50 } // 50 * 4 = 200 chars
      }
    }

    const builder = new DefaultPromptBuilder(
      [new UserInputModule()],
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      new TinyProviderBudget(),
    )

    // The builder passes the providerBudget result to selection
    // User input is ~500 chars (since module wraps it)
    const request = builder.build({ input: 'x'.repeat(500) })
    // Should not throw, should produce a valid result
    expect(request).toBeDefined()
  })

  it('should allow provider budget with 0 maxInputTokens', () => {
    const selection = new DefaultPromptSelection()
    const ranking: MemoryRankingResult = {
      rankedSections: ['userInput'],
      priorities: { userInput: 100 },
    }
    const budget: PromptBudgetResult = {
      totalLength: 100,
      sectionLengths: { userInput: 100 },
    }
    // 0 tokens * 4 = 0 chars — everything is over budget
    const pb: ProviderBudgetResult = { maxInputTokens: 0 }

    const result = selection.select(
      { userInput: 'x'.repeat(100) },
      ranking,
      budget,
      pb,
    )

    // Guard: at least one section must remain
    expect(result.selectedSections.length).toBeGreaterThanOrEqual(1)
    // system is not in the context, only userInput
    expect(result.selectedSections).toContain('userInput')
  })
})

// ---------------------------------------------------------------------------
// Builder Integration — ProviderBudget Injection
// ---------------------------------------------------------------------------

describe('PromptBuilder — ProviderBudget Integration', () => {
  it('should accept providerBudget as 7th constructor param', async () => {
    const providerBudget = new DefaultProviderBudget()
    const builder = new DefaultPromptBuilder(
      [new SystemPromptModule(), new UserInputModule()],
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      providerBudget,
    )
    const request = await builder.build({ input: 'hello' })
    expect(request.prompt).toContain('hello')
  })

  it('should include providerBudget in assembly metadata when injected', async () => {
    const providerBudget = new DefaultProviderBudget()
    const builder = new DefaultPromptBuilder(
      [new UserInputModule()],
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      providerBudget,
    )
    const request = await builder.build({ input: 'hello' })
    expect(request.metadata).toBeDefined()
    const assembly = request.metadata?.promptAssembly as Record<string, unknown>
    expect(assembly).toBeDefined()
    expect(assembly.providerBudget).toBeDefined()
    const pb = assembly.providerBudget as ProviderBudgetResult
    expect(pb.maxInputTokens).toBeGreaterThan(0)
  })

  it('should NOT include providerBudget in metadata when not injected', async () => {
    const builder = new DefaultPromptBuilder([new UserInputModule()])
    const request = await builder.build({ input: 'hello' })
    const assembly = request.metadata?.promptAssembly as Record<string, unknown>
    expect(assembly.providerBudget).toBeUndefined()
  })

  it('should accept providerBudget with custom provider name', async () => {
    const providerBudget = new DefaultProviderBudget()
    const builder = new DefaultPromptBuilder(
      [new UserInputModule()],
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      providerBudget,
      'deepseek',
    )
    const request = await builder.build({ input: 'hello' })
    const assembly = request.metadata?.promptAssembly as Record<string, unknown>
    const pb = assembly.providerBudget as ProviderBudgetResult
    expect(pb.maxInputTokens).toBe(65536)
  })

  it('should accept providerBudget with custom model name', async () => {
    const providerBudget = new DefaultProviderBudget()
    const builder = new DefaultPromptBuilder(
      [new UserInputModule()],
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      providerBudget,
      'openai',
      'gpt-4o',
    )
    const request = await builder.build({ input: 'hello' })
    const assembly = request.metadata?.promptAssembly as Record<string, unknown>
    const pb = assembly.providerBudget as ProviderBudgetResult
    expect(pb.maxInputTokens).toBe(128000)
  })

  it('should produce different metadata with different providers', async () => {
    const providerBudget = new DefaultProviderBudget()

    const builderOpenAI = new DefaultPromptBuilder(
      [new UserInputModule()],
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      providerBudget,
      'openai',
    )

    const builderDeepSeek = new DefaultPromptBuilder(
      [new UserInputModule()],
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      providerBudget,
      'deepseek',
    )

    const requestOpenAI = await builderOpenAI.build({ input: 'hello' })
    const requestDeepSeek = await builderDeepSeek.build({ input: 'hello' })

    const assemblyOpenAI = requestOpenAI.metadata?.promptAssembly as Record<string, unknown>
    const assemblyDeepSeek = requestDeepSeek.metadata?.promptAssembly as Record<string, unknown>

    const pbOpenAI = assemblyOpenAI.providerBudget as ProviderBudgetResult
    const pbDeepSeek = assemblyDeepSeek.providerBudget as ProviderBudgetResult

    expect(pbOpenAI.maxInputTokens).toBe(8192)
    expect(pbDeepSeek.maxInputTokens).toBe(65536)
  })
})

// ---------------------------------------------------------------------------
// Builder Integration — Execution Order
// ---------------------------------------------------------------------------

describe('PromptBuilder — Execution Order with ProviderBudget', () => {
  it('should execute in order: rank → budget → providerBudget → select → compress → render', async () => {
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

    class TracedProviderBudget implements ProviderBudget {
      getBudget(_provider: string, _model?: string): ProviderBudgetResult {
        executionOrder.push('providerBudget')
        return { maxInputTokens: 8192 }
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
      new TracedProviderBudget(),
    )

    await builder.build({ input: 'hello' })

    expect(executionOrder).toEqual(['ranking', 'budget', 'providerBudget', 'selection', 'compression', 'renderer'])
  })
})

// ---------------------------------------------------------------------------
// Backward Compatibility
// ---------------------------------------------------------------------------

describe('Backward Compatibility — ProviderBudget', () => {
  it('should work without ProviderBudget (1-param constructor)', async () => {
    const builder = new DefaultPromptBuilder([new UserInputModule()])
    const request = await builder.build({ input: 'hello' })
    expect(request.prompt).toContain('hello')
  })

  it('should work without ProviderBudget (6-param constructor)', async () => {
    const builder = new DefaultPromptBuilder(
      [new UserInputModule()],
      undefined,
      undefined,
      undefined,
      undefined,
      new DefaultPromptSelection(),
    )
    const request = await builder.build({ input: 'hello' })
    expect(request.prompt).toContain('hello')
  })

  it('should support existing select(context) signature unchanged', () => {
    const selection = new DefaultPromptSelection()
    const result = selection.select({ system: 'sys' })
    expect(result.selectedSections).toContain('system')
    expect(result.excludedSections).toHaveLength(0)
  })

  it('should support existing select(context, ranking, budget) signature unchanged', () => {
    const selection = new DefaultPromptSelection()
    const ranking: MemoryRankingResult = {
      rankedSections: ['userInput', 'system'],
      priorities: { userInput: 100, system: 10 },
    }
    const budget: PromptBudgetResult = {
      totalLength: 20,
      sectionLengths: { userInput: 10, system: 10 },
    }
    const result = selection.select(
      { userInput: 'x'.repeat(10), system: 'x'.repeat(10) },
      ranking,
      budget,
    )
    expect(result.selectedSections).toHaveLength(2)
  })

  it('should support DefaultPromptSelection(Infinity) constructor unchanged', () => {
    const selection = new DefaultPromptSelection(Infinity)
    const result = selection.select({
      system: 'sys',
      userInput: 'in',
    })
    expect(result.selectedSections).toHaveLength(2)
  })

  it('should support DefaultPromptSelection(number) constructor unchanged', () => {
    const selection = new DefaultPromptSelection(50)
    const ranking: MemoryRankingResult = {
      rankedSections: ['userInput', 'system'],
      priorities: { userInput: 100, system: 10 },
    }
    const budget: PromptBudgetResult = {
      totalLength: 60,
      sectionLengths: { userInput: 30, system: 30 },
    }
    const result = selection.select(
      { userInput: 'x'.repeat(30), system: 'x'.repeat(30) },
      ranking,
      budget,
    )
    expect(result.selectedSections).toHaveLength(1) // system removed
  })

  it('should still work with existing PromptSelection implementations that ignore 4th param', () => {
    class SimpleSelection implements PromptSelection {
      select(context: PromptContext): PromptSelectionResult {
        const keys = Object.keys(context)
        return { selectedSections: keys, excludedSections: [] }
      }
    }

    const builder = new DefaultPromptBuilder(
      [new UserInputModule()],
      undefined,
      undefined,
      undefined,
      undefined,
      new SimpleSelection(),
      new DefaultProviderBudget(),
    )

    // Should not throw despite SimpleSelection not using providerBudget
    expect(() => builder.build({ input: 'hello' })).not.toThrow()
  })

  it('should not change metadata structure for existing callers without ProviderBudget', async () => {
    const builder = new DefaultPromptBuilder([new UserInputModule()])
    const request = await builder.build({ input: 'hello' })
    const assembly = request.metadata?.promptAssembly as Record<string, unknown>
    expect(assembly).toHaveProperty('ranking')
    expect(assembly).toHaveProperty('budget')
    expect(assembly).toHaveProperty('selection')
    expect(assembly).not.toHaveProperty('providerBudget')
  })
})

// ---------------------------------------------------------------------------
// RetryPlanner Compatibility
// ---------------------------------------------------------------------------

describe('RetryPlanner — ProviderBudget Compatibility', () => {
  it('should work with RetryPlanner when ProviderBudget is injected into Builder', async () => {
    const providerBudget = new DefaultProviderBudget()
    const builder = new DefaultPromptBuilder(
      [new SystemPromptModule(), new UserInputModule(), new MemoryPromptModule()],
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      providerBudget,
    )
    const memory = new DefaultMemory()
    await memory.set('conversation', [
      { input: 'hello', summary: 'created tree' },
    ])

    const planner = new RetryPlanner(new MockPlannerProvider(new DefaultAIConfiguration()))
    const pipeline = new DefaultPipeline(planner, builder)
    const result = await pipeline.execute({
      input: 'create a tree',
      memory,
    })

    expect(result.plannerResult).toBeDefined()
    expect(result.plannerResult!.actions.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// ToolCallPlanner Compatibility
// ---------------------------------------------------------------------------

describe('ToolCallPlanner — ProviderBudget Compatibility', () => {
  it('should work with ToolCallPlanner when ProviderBudget is injected into Builder', async () => {
    const providerBudget = new DefaultProviderBudget()
    const builder = new DefaultPromptBuilder(
      [new SystemPromptModule(), new UserInputModule(), new MemoryPromptModule()],
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      providerBudget,
    )
    const memory = new DefaultMemory()
    await memory.set('conversation', [
      { input: 'hello', summary: 'created tree' },
    ])

    const tools = new DefaultToolRegistry([
      createMockTool('find_entity'),
    ])
    const planner = new ToolCallPlanner(new MockPlannerProvider(new DefaultAIConfiguration()), tools)
    const pipeline = new DefaultPipeline(planner, builder)
    const result = await pipeline.execute({
      input: 'create a tree',
      memory,
    })

    expect(result.plannerResult).toBeDefined()
    expect(result.plannerResult!.actions.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// Streaming Compatibility
// ---------------------------------------------------------------------------

describe('Streaming — ProviderBudget Compatibility', () => {
  it('should work with streaming when ProviderBudget is injected into Builder', async () => {
    const providerBudget = new DefaultProviderBudget()
    const builder = new DefaultPromptBuilder(
      [new SystemPromptModule(), new UserInputModule()],
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      providerBudget,
    )
    const planner = new MockPlanner(new MockStreamingProvider())
    const pipeline = new DefaultPipeline(planner, builder)
    const result = await pipeline.stream({
      input: 'create a tree',
    })

    expect(result.plannerResult).toBeDefined()
    expect(result.plannerResult!.actions.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// AgentLoop Compatibility
// ---------------------------------------------------------------------------

describe('AgentLoop — ProviderBudget Compatibility', () => {
  it('should work with AgentLoop when ProviderBudget is injected into Builder', async () => {
    const providerBudget = new DefaultProviderBudget()
    const builder = new DefaultPromptBuilder(
      [new SystemPromptModule(), new UserInputModule()],
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      providerBudget,
    )

    const agentLoop = new DefaultAgentLoop(new DefaultReflection())
    const planner = new MockPlanner(new MockPlannerProvider(new DefaultAIConfiguration()))
    const pipeline = new DefaultPipeline(planner, builder, undefined, agentLoop)

    const result = await pipeline.execute({
      input: 'create a tree',
    })

    expect(result.plannerResult).toBeDefined()
    expect(result.plannerResult!.actions.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

describe('PromptSelection — ProviderBudget Metadata', () => {
  it('should include providerBudget with maxInputTokens in assembly metadata', async () => {
    const providerBudget = new DefaultProviderBudget()
    const builder = new DefaultPromptBuilder(
      [new UserInputModule()],
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      providerBudget,
    )

    const request = await builder.build({ input: 'hello' })
    const assembly = request.metadata?.promptAssembly as Record<string, unknown>
    expect(assembly.providerBudget).toBeDefined()
    expect((assembly.providerBudget as ProviderBudgetResult).maxInputTokens).toBe(8192)
  })

  it('should include providerBudget with model-specific maxInputTokens', async () => {
    const providerBudget = new DefaultProviderBudget()
    const builder = new DefaultPromptBuilder(
      [new UserInputModule()],
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      providerBudget,
      'openai',
      'gpt-4o',
    )

    const request = await builder.build({ input: 'hello' })
    const assembly = request.metadata?.promptAssembly as Record<string, unknown>
    const pb = assembly.providerBudget as ProviderBudgetResult
    expect(pb.maxInputTokens).toBe(128000)
    expect(pb.maxOutputTokens).toBe(16384)
  })
})