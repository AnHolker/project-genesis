import type { PromptContext } from './PromptContext'
import type { PromptBudgetResult } from './PromptBudgetResult'

/**
 * PromptBudget is a pluggable budget calculation interface for PromptContext.
 *
 * Budget calculates sizing information about a prompt context WITHOUT
 * modifying the context itself. It is a pure measurement — not a transformer.
 *
 * This is NOT:
 * - Compression (budget does not modify PromptContext)
 * - Memory Ranking (budget does not filter/score)
 * - Token Optimization (budget does not truncate)
 *
 * This is the abstract foundation that provides unified sizing info for
 * future components like Compression, Memory Ranking, and Context Window.
 *
 * Design principles:
 * - Pure function: input → output, no side effects
 * - Non-mutating: never modifies the PromptContext
 * - Replaceable: unified interface for all budget strategies
 * - Compos(able: can be chained, wrapped, or decorated
 * - No dependency on Planner, Provider, Runtime, or AgentLoop
 *
 * Future implementations:
 * - CharacterBudget        — string length per section (current default)
 * - TokenBudget            — token count via tokenizer
 * - ProviderBudget         — provider-specific token counting
 * - ModelSpecificBudget    — model-aware budget (e.g., GPT-4 vs Claude)
 *
 * @see DefaultPromptBudget — the default character-count implementation
 * @see PromptBudgetResult — the output structure
 */
export interface PromptBudget {
  /**
   * Calculate budget for a PromptContext.
   *
   * Implementations MUST:
   * - NOT modify the input PromptContext
   * - Be idempotent (same input always produces same output)
   * - Be pure (no side effects)
   *
   * @param context — The PromptContext to measure
   * @returns A PromptBudgetResult with sizing information
   */
  calculate(context: PromptContext): PromptBudgetResult
}