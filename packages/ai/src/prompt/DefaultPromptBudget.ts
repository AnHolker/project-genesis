import type { PromptBudget } from './PromptBudget'
import type { PromptContext } from './PromptContext'
import type { PromptBudgetResult } from './PromptBudgetResult'

/**
 * DefaultPromptBudget is the default implementation of PromptBudget.
 *
 * Since WO-S4-004, it calculates an estimated token count using a
 * configurable chars-per-token ratio. This is a lightweight, rule-based
 * estimation — not a real tokenizer.
 *
 * Behavior:
 * - Calculates character length for each populated section
 * - Returns total length across all sections
 * - Calculates estimatedTokens = Math.ceil(totalLength / charsPerToken)
 * - Returns estimatedTokens as undefined when totalLength is 0
 *
 * The charsPerToken ratio is configurable via constructor (default: 4).
 * A ratio of 4 means approximately 4 characters per token, which is a
 * common rule-of-thumb estimate for English text.
 *
 * This is intentionally simple. No tiktoken, no GPT tokenizer,
 * no Claude tokenizer — those belong in future Work Orders.
 *
 * The implementation is:
 * - Non-mutating: reads PromptContext, returns new PromptBudgetResult
 * - Deterministic: same input always produces same output
 * - Pure: no side effects, no dependencies
 * - Provider-agnostic: no binding to any provider or tokenizer
 */
export class DefaultPromptBudget implements PromptBudget {
  private readonly charsPerToken: number

  /**
   * @param charsPerToken — Characters per token ratio (default: 4)
   *   Used to estimate token count: Math.ceil(totalLength / charsPerToken)
   *   A lower value produces a higher estimated token count.
   */
  constructor(charsPerToken?: number) {
    this.charsPerToken = charsPerToken ?? 4
  }

  calculate(context: PromptContext): PromptBudgetResult {
    const sectionLengths: Record<string, number> = {}
    let totalLength = 0

    const knownKeys: Array<keyof PromptContext> = [
      'system',
      'userInput',
      'memory',
      'worldState',
      'observations',
      'reflections',
    ]

    for (const key of knownKeys) {
      const value = context[key]
      if (value !== undefined && value !== '') {
        const length = value.length
        sectionLengths[key] = length
        totalLength += length
      }
    }

    // Calculate estimated token count using chars-per-token ratio
    const estimatedTokens = totalLength > 0
      ? Math.ceil(totalLength / this.charsPerToken)
      : undefined

    return {
      totalLength,
      sectionLengths,
      estimatedTokens,
    }
  }
}