import type { PromptContext } from './PromptContext'
import type { PromptSelectionResult } from './PromptSelectionResult'

/**
 * PromptSelection is a pluggable selection interface for PromptContext sections.
 *
 * Selection determines which sections of a PromptContext should participate in
 * the final prompt WITHOUT modifying the context or performing compression.
 * It is a pure decision — not a transformer.
 *
 * This is NOT:
 * - Compression (selection does not modify or remove content)
 * - Rendering (selection does not convert to string)
 * - Ranking-based selection (selection decisions are separate from priority)
 * - Token-aware selection (no token counting or budget awareness)
 *
 * The selection result is consumed by DefaultPromptBuilder to create a filtered
 * PromptContext before passing it to PromptCompression.
 *
 * Design principles:
 * - Pure function: input → output, no side effects
 * - Non-mutating: never modifies the PromptContext
 * - Replaceable: unified interface for all selection strategies
 * - No dependency on Planner, Provider, Runtime, or AgentLoop
 *
 * Future implementations:
 * - BudgetAwareSelection — exclude sections that exceed budget
 * - EmbeddingSelection — relevance-based section selection
 * - LLMSelection — LLM-based section importance evaluation
 *
 * @see DefaultPromptSelection — the default pass-through implementation
 * @see PromptSelectionResult — the output structure
 */
export interface PromptSelection {
  /**
   * Select which sections of a PromptContext should be preserved.
   *
   * Implementations MUST:
   * - NOT modify the input PromptContext
   * - Be idempotent (same input always produces same output)
   * - Be pure (no side effects)
   * - Be deterministic
   *
   * @param context — The PromptContext to evaluate
   * @returns A PromptSelectionResult with selected and excluded section names
   */
  select(context: PromptContext): PromptSelectionResult
}