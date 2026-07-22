import type { PromptCompression } from './PromptCompression'
import type { PromptContext } from './PromptContext'
import type { PromptSelectionResult } from './PromptSelectionResult'

/**
 * DefaultPromptCompression is the default implementation of PromptCompression.
 *
 * Since WO-S4-003, it consumes PromptSelectionResult to remove sections
 * that were excluded by PromptSelection.
 *
 * Behavior:
 * - Removes sections listed in selection.excludedSections (when provided)
 * - Removes undefined fields
 * - Removes empty string fields
 * - Preserves all other fields verbatim
 * - Returns a NEW PromptContext (never mutates input)
 *
 * When selection is NOT provided, behavior is identical to WO-S3-017
 * (strips undefined and empty string fields only).
 *
 * The implementation is:
 * - Idempotent: compress(compress(ctx)) === compress(ctx)
 * - Non-mutating: returns a new object
 * - Deterministic: same input always produces same output
 * - Provider-agnostic: no binding to any provider
 *
 * Future: This will be replaced by or composed with more sophisticated
 * compression strategies as the system evolves.
 */
export class DefaultPromptCompression implements PromptCompression {
  /**
   * Compress a PromptContext, optionally consuming PromptSelectionResult
   * to exclude sections.
   *
   * @param context — The PromptContext to compress
   * @param selection — Optional PromptSelectionResult with excluded sections
   * @returns A new, compressed PromptContext
   */
  compress(
    context: PromptContext,
    selection?: PromptSelectionResult,
  ): PromptContext {
    const result: PromptContext = {}

    // Build a set of excluded section names for O(1) lookup
    const excludedSet = selection
      ? new Set(selection.excludedSections)
      : new Set<string>()

    for (const [key, value] of Object.entries(context)) {
      // Skip sections excluded by PromptSelection
      if (excludedSet.has(key)) {
        continue
      }

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