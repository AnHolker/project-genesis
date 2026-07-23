import type { ProviderBudget } from './ProviderBudget'
import type { ProviderBudgetResult } from './ProviderBudgetResult'

/**
 * DefaultProviderBudget is a pure lookup table that maps provider/model
 * combinations to their conservative token capacity limits.
 *
 * This is a configuration-only component with no external dependencies,
 * no SDK integrations, and no network requests.
 *
 * Design:
 * - Lookup by `provider` first, then `model` for fine-grained matching
 * - Falls back to generic provider entry when model is not found
 * - Falls back to a very conservative default when provider is unknown
 * - All values are conservative estimates — not guaranteed API limits
 *
 * @remarks
 * Values are conservative defaults based on publicly documented limits.
 * They may be lower than actual API limits to provide a safety margin
 * for prompt optimization logic.
 */
export class DefaultProviderBudget implements ProviderBudget {
  private readonly providerDefaults: Record<string, ProviderBudgetResult> = {
    openai: { maxInputTokens: 8192, maxOutputTokens: 4096 },
    deepseek: { maxInputTokens: 65536, maxOutputTokens: 8192 },
    anthropic: { maxInputTokens: 100000, maxOutputTokens: 4096 },
    mock: { maxInputTokens: 4096, maxOutputTokens: 1024 },
  }

  private readonly modelOverrides: Record<string, Record<string, ProviderBudgetResult>> = {
    openai: {
      'gpt-4': { maxInputTokens: 8192, maxOutputTokens: 4096 },
      'gpt-4-turbo': { maxInputTokens: 128000, maxOutputTokens: 4096 },
      'gpt-4o': { maxInputTokens: 128000, maxOutputTokens: 16384 },
      'gpt-3.5-turbo': { maxInputTokens: 16385, maxOutputTokens: 4096 },
    },
    deepseek: {
      'deepseek-chat': { maxInputTokens: 65536, maxOutputTokens: 8192 },
    },
    anthropic: {
      'claude-3-opus': { maxInputTokens: 200000, maxOutputTokens: 4096 },
      'claude-3-sonnet': { maxInputTokens: 200000, maxOutputTokens: 4096 },
      'claude-3-haiku': { maxInputTokens: 200000, maxOutputTokens: 4096 },
    },
  }

  /** Fallback for unknown providers — very conservative estimate */
  private readonly unknownProviderFallback: ProviderBudgetResult = {
    maxInputTokens: 4096,
    maxOutputTokens: 1024,
  }

  /**
   * Get the budget for a given provider and optional model.
   *
   * Lookup order:
   * 1. Exact model override (provider + model)
   * 2. Generic provider default
   * 3. Unknown provider fallback
   *
   * @param provider — The provider name
   * @param model — Optional model name for fine-grained lookup
   * @returns A ProviderBudgetResult with token capacity information
   */
  getBudget(provider: string, model?: string): ProviderBudgetResult {
    // 1. Try exact model override
    if (model !== undefined) {
      const modelMap = this.modelOverrides[provider]
      if (modelMap !== undefined) {
        const overridden = modelMap[model]
        if (overridden !== undefined) {
          return overridden
        }
      }
    }

    // 2. Try generic provider default
    const defaultResult = this.providerDefaults[provider]
    if (defaultResult !== undefined) {
      return defaultResult
    }

    // 3. Unknown provider fallback
    return this.unknownProviderFallback
  }
}