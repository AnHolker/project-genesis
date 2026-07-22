import type { PromptSelection } from './PromptSelection'
import type { PromptSelectionResult } from './PromptSelectionResult'
import type { PromptContext } from './PromptContext'

/**
 * DefaultPromptSelection is the default pass-through implementation.
 *
 * It preserves ALL populated sections in their original order without
 * any filtering, exclusion, or prioritization.
 *
 * This is intentionally minimal — no token awareness, no ranking
 * consumption, no heuristics, no embeddings, no LLM selection.
 *
 * Behavior:
 * - Returns ALL populated (defined and non-empty) sections as selected
 * - Returns an EMPTY excludedSections array
 * - Returns sections in the order they appear in the context object
 * - Non-mutating: never modifies the input PromptContext
 * - Idempotent: select(select(ctx)) produces the same result
 * - Deterministic: same input always produces same output
 * - No side effects: pure function
 *
 * Future implementations (BudgetAwareSelection, EmbeddingSelection, etc.)
 * will implement the same PromptSelection interface.
 */
export class DefaultPromptSelection implements PromptSelection {
  /**
   * Select sections from a PromptContext.
   *
   * Default implementation: preserve every populated section.
   *
   * @param context — The PromptContext to evaluate
   * @returns A PromptSelectionResult with all sections selected
   */
  select(context: PromptContext): PromptSelectionResult {
    const selectedSections: string[] = []
    const excludedSections: string[] = []

    for (const [key, value] of Object.entries(context)) {
      if (value !== undefined && value !== '') {
        selectedSections.push(key)
      }
    }

    return { selectedSections, excludedSections }
  }
}