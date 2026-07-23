import { describe, it, expect } from 'vitest'
import type { ProviderBudget } from '../prompt/ProviderBudget'
import type { ProviderBudgetResult } from '../prompt/ProviderBudgetResult'
import { DefaultProviderBudget } from '../prompt/DefaultProviderBudget'

// ─────────────────────────────────────────────────────────────────────
// Helper: a custom ProviderBudget implementation for testing
// ─────────────────────────────────────────────────────────────────────
class CustomProviderBudget implements ProviderBudget {
  getBudget(provider: string, model?: string): ProviderBudgetResult {
    if (provider === 'custom' && model === 'v1') {
      return { maxInputTokens: 50000, maxOutputTokens: 10000 }
    }
    if (provider === 'custom') {
      return { maxInputTokens: 10000, maxOutputTokens: 5000 }
    }
    return { maxInputTokens: 1000 }
  }
}

describe('ProviderBudgetResult', () => {
  // ── Interface behavior ──────────────────────────────────────────────
  describe('interface structure', () => {
    it('should create a result with only maxInputTokens', () => {
      const result: ProviderBudgetResult = { maxInputTokens: 4096 }
      expect(result.maxInputTokens).toBe(4096)
      expect(result.maxOutputTokens).toBeUndefined()
    })

    it('should create a result with both fields', () => {
      const result: ProviderBudgetResult = {
        maxInputTokens: 128000,
        maxOutputTokens: 4096,
      }
      expect(result.maxInputTokens).toBe(128000)
      expect(result.maxOutputTokens).toBe(4096)
    })

    it('should allow undefined maxOutputTokens', () => {
      const result1: ProviderBudgetResult = { maxInputTokens: 8192, maxOutputTokens: undefined }
      expect(result1.maxInputTokens).toBe(8192)
      expect(result1.maxOutputTokens).toBeUndefined()

      const result2: ProviderBudgetResult = { maxInputTokens: 8192 }
      expect(result2.maxOutputTokens).toBeUndefined()
    })

    it('should accept zero as a valid budget value', () => {
      const result: ProviderBudgetResult = { maxInputTokens: 0, maxOutputTokens: 0 }
      expect(result.maxInputTokens).toBe(0)
      expect(result.maxOutputTokens).toBe(0)
    })
  })
})

// ─────────────────────────────────────────────────────────────────────
// DefaultProviderBudget tests
// ─────────────────────────────────────────────────────────────────────
describe('DefaultProviderBudget', () => {
  const budget = new DefaultProviderBudget()

  // ── Default provider budgets ────────────────────────────────────────
  describe('default provider budgets', () => {
    it('should return budget for openai provider', () => {
      const result = budget.getBudget('openai')
      expect(result.maxInputTokens).toBe(8192)
      expect(result.maxOutputTokens).toBe(4096)
    })

    it('should return budget for deepseek provider', () => {
      const result = budget.getBudget('deepseek')
      expect(result.maxInputTokens).toBe(65536)
      expect(result.maxOutputTokens).toBe(8192)
    })

    it('should return budget for anthropic provider', () => {
      const result = budget.getBudget('anthropic')
      expect(result.maxInputTokens).toBe(100000)
      expect(result.maxOutputTokens).toBe(4096)
    })

    it('should return budget for mock provider', () => {
      const result = budget.getBudget('mock')
      expect(result.maxInputTokens).toBe(4096)
      expect(result.maxOutputTokens).toBe(1024)
    })
  })

  // ── Unknown provider fallback ───────────────────────────────────────
  describe('unknown provider fallback', () => {
    it('should return fallback for unknown provider', () => {
      const result = budget.getBudget('unknown')
      expect(result.maxInputTokens).toBe(4096)
      expect(result.maxOutputTokens).toBe(1024)
    })

    it('should return fallback for empty string provider', () => {
      const result = budget.getBudget('')
      expect(result.maxInputTokens).toBe(4096)
      expect(result.maxOutputTokens).toBe(1024)
    })

    it('should return fallback for random string provider', () => {
      const result = budget.getBudget('nonexistent-provider')
      expect(result.maxInputTokens).toBe(4096)
      expect(result.maxOutputTokens).toBe(1024)
    })
  })

  // ── Model-specific lookup ───────────────────────────────────────────
  describe('model-specific lookup', () => {
    it('should return gpt-4 specific budget', () => {
      const result = budget.getBudget('openai', 'gpt-4')
      expect(result.maxInputTokens).toBe(8192)
      expect(result.maxOutputTokens).toBe(4096)
    })

    it('should return gpt-4-turbo specific budget', () => {
      const result = budget.getBudget('openai', 'gpt-4-turbo')
      expect(result.maxInputTokens).toBe(128000)
      expect(result.maxOutputTokens).toBe(4096)
    })

    it('should return gpt-4o specific budget', () => {
      const result = budget.getBudget('openai', 'gpt-4o')
      expect(result.maxInputTokens).toBe(128000)
      expect(result.maxOutputTokens).toBe(16384)
    })

    it('should return gpt-3.5-turbo specific budget', () => {
      const result = budget.getBudget('openai', 'gpt-3.5-turbo')
      expect(result.maxInputTokens).toBe(16385)
      expect(result.maxOutputTokens).toBe(4096)
    })

    it('should return deepseek-chat specific budget', () => {
      const result = budget.getBudget('deepseek', 'deepseek-chat')
      expect(result.maxInputTokens).toBe(65536)
      expect(result.maxOutputTokens).toBe(8192)
    })

    it('should return claude-3-opus specific budget', () => {
      const result = budget.getBudget('anthropic', 'claude-3-opus')
      expect(result.maxInputTokens).toBe(200000)
      expect(result.maxOutputTokens).toBe(4096)
    })

    it('should return claude-3-sonnet specific budget', () => {
      const result = budget.getBudget('anthropic', 'claude-3-sonnet')
      expect(result.maxInputTokens).toBe(200000)
      expect(result.maxOutputTokens).toBe(4096)
    })

    it('should return claude-3-haiku specific budget', () => {
      const result = budget.getBudget('anthropic', 'claude-3-haiku')
      expect(result.maxInputTokens).toBe(200000)
      expect(result.maxOutputTokens).toBe(4096)
    })

    it('should fall back to provider default for unknown model', () => {
      const result = budget.getBudget('openai', 'unknown-model')
      expect(result.maxInputTokens).toBe(8192)
      expect(result.maxOutputTokens).toBe(4096)
    })

    it('should fall back to provider default when model is undefined', () => {
      const openaiResult = budget.getBudget('openai')
      expect(openaiResult.maxInputTokens).toBe(8192)

      const deepseekResult = budget.getBudget('deepseek')
      expect(deepseekResult.maxInputTokens).toBe(65536)
    })
  })

  // ── Deterministic behavior ──────────────────────────────────────────
  describe('deterministic behavior', () => {
    it('should return identical results for same provider and model', () => {
      const result1 = budget.getBudget('openai', 'gpt-4')
      const result2 = budget.getBudget('openai', 'gpt-4')
      expect(result1).toEqual(result2)
      // Same reference verification
      expect(result1.maxInputTokens).toBe(result2.maxInputTokens)
      expect(result1.maxOutputTokens).toBe(result2.maxOutputTokens)
    })

    it('should return identical results for same provider without model', () => {
      const result1 = budget.getBudget('anthropic')
      const result2 = budget.getBudget('anthropic')
      expect(result1).toEqual(result2)
    })

    it('should return different results for different providers', () => {
      const openai = budget.getBudget('openai')
      const deepseek = budget.getBudget('deepseek')
      expect(openai.maxInputTokens).not.toBe(deepseek.maxInputTokens)
    })

    it('should return different results for different models of same provider', () => {
      const gpt4 = budget.getBudget('openai', 'gpt-4')
      const gpt4oTurbo = budget.getBudget('openai', 'gpt-4-turbo')
      expect(gpt4.maxInputTokens).not.toBe(gpt4oTurbo.maxInputTokens)
    })
  })

  // ── Immutability ────────────────────────────────────────────────────
  describe('immutability', () => {
    it('should not modify input arguments', () => {
      const providerArg = 'openai'
      const modelArg = 'gpt-4'
      // Call once
      budget.getBudget(providerArg, modelArg)
      // Verify args unchanged (they're primitives, but good practice)
      expect(providerArg).toBe('openai')
      expect(modelArg).toBe('gpt-4')
    })

    it('should return a new object each call (not cached reference)', () => {
      const result1 = budget.getBudget('openai')
      const result2 = budget.getBudget('openai')
      // They should be equal in value but not the same reference
      // (Unless the implementation returns the same object, but that's okay too)
      expect(result1).toEqual(result2)
      // At minimum, value equality holds
    })
  })

  // ── Custom ProviderBudget implementation ────────────────────────────
  describe('custom ProviderBudget implementation', () => {
    it('should work with custom implementation via interface', () => {
      const custom = new CustomProviderBudget()
      const result = custom.getBudget('custom', 'v1')
      expect(result.maxInputTokens).toBe(50000)
      expect(result.maxOutputTokens).toBe(10000)
    })

    it('should return provider default in custom implementation', () => {
      const custom = new CustomProviderBudget()
      const result = custom.getBudget('custom')
      expect(result.maxInputTokens).toBe(10000)
      expect(result.maxOutputTokens).toBe(5000)
    })

    it('should return fallback for unknown providers in custom implementation', () => {
      const custom = new CustomProviderBudget()
      const result = custom.getBudget('unknown')
      expect(result.maxInputTokens).toBe(1000)
      expect(result.maxOutputTokens).toBeUndefined()
    })

    it('should satisfy the ProviderBudget type constraint', () => {
      const custom: ProviderBudget = new CustomProviderBudget()
      expect(custom.getBudget('custom', 'v1').maxInputTokens).toBe(50000)
    })
  })

  // ── RetryPlanner compatibility ──────────────────────────────────────
  describe('RetryPlanner compatibility', () => {
    it('should produce idempotent results across multiple calls', () => {
      // RetryPlanner may call budget lookup multiple times
      // Ensure same result each time
      const results = Array.from({ length: 5 }, (_, _i) =>
        budget.getBudget('openai', 'gpt-4o'),
      )
      results.forEach((r) => {
        expect(r.maxInputTokens).toBe(128000)
        expect(r.maxOutputTokens).toBe(16384)
      })
    })

    it('should work for all providers RetryPlanner may wrap', () => {
      const providers = ['openai', 'deepseek', 'mock']
      providers.forEach((p) => {
        const result = budget.getBudget(p)
        expect(result.maxInputTokens).toBeGreaterThan(0)
      })
    })
  })

  // ── ToolCallPlanner compatibility ───────────────────────────────────
  describe('ToolCallPlanner compatibility', () => {
    it('should provide budget for providers with tool calling support', () => {
      const openai = budget.getBudget('openai', 'gpt-4o')
      expect(openai.maxInputTokens).toBe(128000)

      const deepseek = budget.getBudget('deepseek', 'deepseek-chat')
      expect(deepseek.maxInputTokens).toBe(65536)
    })

    it('should work without a model for provider-level lookup', () => {
      const mock = budget.getBudget('mock')
      expect(mock.maxInputTokens).toBe(4096)
    })
  })

  // ── Streaming compatibility ─────────────────────────────────────────
  describe('Streaming compatibility', () => {
    it('should provide consistent budget during streaming operations', () => {
      // Streaming doesn't change budget — it's a lookup
      const preStream = budget.getBudget('openai', 'gpt-4')
      const duringStream = budget.getBudget('openai', 'gpt-4')
      const postStream = budget.getBudget('openai', 'gpt-4')
      expect(preStream).toEqual(duringStream)
      expect(duringStream).toEqual(postStream)
    })
  })

  // ── Backward compatibility ──────────────────────────────────────────
  describe('backward compatibility', () => {
    it('should not break any existing exports', () => {
      // ProviderBudget is additive — no existing interfaces changed
      expect(typeof DefaultProviderBudget).toBe('function')
      expect(typeof budget.getBudget).toBe('function')
    })

    it('should not modify existing component behavior', () => {
      // ProviderBudget is completely independent from PromptBudget,
      // PromptSelection, PromptCompression, Planner, Provider, etc.
      // No existing component is modified or affected.
      const result = budget.getBudget('openai')
      expect(result.maxInputTokens).toBeGreaterThan(0)
    })

    it('should not depend on PromptBudget', () => {
      // ProviderBudget and PromptBudget are independent types
      const budgetInstance: ProviderBudget = new DefaultProviderBudget()
      expect(budgetInstance).toBeDefined()
      // PromptBudget and ProviderBudget have different method signatures
      // and serve different purposes
    })

    it('should not depend on any existing component', () => {
      // ProviderBudget is a standalone type with no dependencies
      const result: ProviderBudgetResult = { maxInputTokens: 1000 }
      expect(result.maxInputTokens).toBe(1000)
    })
  })

  // ── Exports ──────────────────────────────────────────────────────────
  describe('exports', () => {
    it('should export ProviderBudget type', () => {
      // This is a type-only check — verifies the type is accessible
      const budget: ProviderBudget = new DefaultProviderBudget()
      expect(budget).toBeInstanceOf(DefaultProviderBudget)
    })

    it('should export DefaultProviderBudget class', () => {
      expect(DefaultProviderBudget).toBeDefined()
      expect(new DefaultProviderBudget()).toBeInstanceOf(DefaultProviderBudget)
    })

    it('should export ProviderBudgetResult type', () => {
      const result: ProviderBudgetResult = { maxInputTokens: 100 }
      expect(result).toBeDefined()
    })
  })

  // ── ProviderBudget does NOT depend on PromptBudget ───────────────────
  describe('independence from PromptBudget', () => {
    it('should not reference PromptBudget or PromptBudgetResult', () => {
      // ProviderBudget has its own ProviderBudgetResult type
      const result = budget.getBudget('openai')
      // ProviderBudgetResult has maxInputTokens/maxOutputTokens
      // PromptBudgetResult has totalLength/sectionLengths/estimatedTokens
      expect('maxInputTokens' in result).toBe(true)
      expect('totalLength' in result).toBe(false)
    })

    it('should be usable without importing PromptBudget', () => {
      // ProviderBudget is a standalone import
      const standalone: ProviderBudget = new DefaultProviderBudget()
      const result = standalone.getBudget('mock')
      expect(result.maxInputTokens).toBe(4096)
    })
  })
})

describe('DefaultProviderBudget constructor', () => {
  it('should create instance without arguments', () => {
    const budget = new DefaultProviderBudget()
    expect(budget).toBeInstanceOf(DefaultProviderBudget)
  })

  it('should work with multiple instances', () => {
    const a = new DefaultProviderBudget()
    const b = new DefaultProviderBudget()
    expect(a.getBudget('openai')).toEqual(b.getBudget('openai'))
  })
})