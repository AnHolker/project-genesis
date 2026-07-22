import type { PromptCompression } from './PromptCompression'
import type { PromptContext } from './PromptContext'

/**
 * DefaultPromptCompression is the default implementation of PromptCompression.
 *
 * Current behavior:
 * - Returns a NEW PromptContext with undefined and empty string fields removed
 * - All other fields are preserved verbatim
 *
 * This is intentionally minimal. No token counting, no LLM summarization,
 * no semantic compression — those belong in future Work Orders.
 *
 * The implementation is:
 * - Idempotent: compress(compress(ctx)) === compress(ctx)
 * - Non-mutating: returns a new object
 * - Deterministic: same input always produces same output
 *
 * Future: This will be replaced by or composed with more sophisticated
 * compression strategies as the system evolves.
 */
export class DefaultPromptCompression implements PromptCompression {
  compress(context: PromptContext): PromptContext {
    const result: PromptContext = {}

    for (const [key, value] of Object.entries(context)) {
      // Skip undefined and empty string values
      if (value === undefined || value === '') {
        continue
      }

      // Copy only valid PromptContext keys
      if (this.isPromptContextKey(key)) {
        result[key] = value
      }
    }

    return result
  }

  /**
   * Type guard to ensure we only copy known PromptContext keys.
   */
  private isPromptContextKey(key: string): key is keyof PromptContext {
    const validKeys: Array<keyof PromptContext> = [
      'system',
      'userInput',
      'memory',
      'worldState',
      'observations',
      'reflections',
    ]
    return validKeys.includes(key as keyof PromptContext)
  }
}