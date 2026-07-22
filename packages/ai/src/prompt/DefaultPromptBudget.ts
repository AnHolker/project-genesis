import type { PromptBudget } from './PromptBudget'
import type { PromptContext } from './PromptContext'
import type { PromptBudgetResult } from './PromptBudgetResult'

/**
 * DefaultPromptBudget is the default implementation of PromptBudget.
 *
 * Current behavior:
 * - Calculates character length for each populated section
 * - Returns total length across all sections
 * - Does NOT estimate tokens (estimatedTokens is left undefined)
 *
 * This is intentionally simple. No tiktoken, no GPT tokenizer,
 * no Claude tokenizer — those belong in future Work Orders.
 *
 * The implementation is:
 * - Non-mutating: reads PromptContext, returns new PromptBudgetResult
 * - Deterministic: same input always produces same output
 * - Pure: no side effects, no dependencies
 *
 * Future: This will be replaced by or composed with more sophisticated
 * budget strategies as the system evolves.
 */
export class DefaultPromptBudget implements PromptBudget {
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

    return {
      totalLength,
      sectionLengths,
      // estimatedTokens left undefined — real token counting is future work
    }
  }
}