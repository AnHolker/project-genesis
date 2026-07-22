import type { PromptContext } from './PromptContext'
import type { PromptSelectionResult } from './PromptSelectionResult'
import type { MemoryRankingResult } from './MemoryRankingResult'
import type { PromptBudgetResult } from './PromptBudgetResult'

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
 * - Compression (selection does not truncate or summarize content)
 * - Token counting (no tokenizer integration)
 *
 * The selection result is consumed by DefaultPromptBuilder to create a filtered
 * PromptContext before passing it to PromptCompression.
 *
 * Starting in WO-S4-002, selection CONSUMES MemoryRanking and PromptBudget
 * results to make rule-based decisions. When ranking and budget are provided,
 * implementations may use them to determine which sections to exclude.
 *
 * Design principles:
 * - Pure function: input → output, no side effects
 * - Non-mutating: never modifies the PromptContext
 * - Replaceable: unified interface for all selection strategies
 * - Deterministic: same input always produces same output
 * - Provider-independent: no binding to any provider
 * - No dependency on Planner, Provider, Runtime, or AgentLoop
 *
 * Future implementations:
 * - EmbeddingSelection — relevance-based section selection
 * - LLMSelection — LLM-based section importance evaluation
 *
 * @see DefaultPromptSelection — the default rule-based implementation
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
   * When ranking and budget are provided, implementations SHOULD use
   * ranking priorities and budget sizes to decide section inclusion.
   * When not provided, implementations MUST preserve all sections.
   *
   * @param context — The PromptContext to evaluate
   * @param ranking — Optional MemoryRankingResult with section priorities
   * @param budget — Optional PromptBudgetResult with section sizes
   * @returns A PromptSelectionResult with selected and excluded section names
   */
  select(
    context: PromptContext,
    ranking?: MemoryRankingResult,
    budget?: PromptBudgetResult,
  ): PromptSelectionResult
}