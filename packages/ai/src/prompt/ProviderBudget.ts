import type { ProviderBudgetResult } from './ProviderBudgetResult'

/**
 * ProviderBudget is a pure lookup component that returns the token
 * capacity of different AI providers and models.
 *
 * This is NOT:
 * - PromptBudget (measures prompt size — ProviderBudget measures provider capacity)
 * - A tokenizer (ProviderBudget does not count tokens)
 * - A prompt compression mechanism
 * - A prompt selection mechanism
 * - A provider communication layer
 *
 * Design principles:
 * - Pure lookup — no side effects, no network requests, no I/O
 * - Deterministic — same input always produces same output
 * - Immutable — does not modify any input
 * - Independent — no dependency on PromptBudget, PromptSelection, Planner,
 *   Provider implementations, or any other component
 *
 * @see DefaultProviderBudget — the default implementation with predefined limits
 * @see ProviderBudgetResult — the output structure
 */
export interface ProviderBudget {
  /**
   * Get the budget for a given provider and optional model.
   *
   * Implementations MUST:
   * - Be deterministic (same input always produces same output)
   * - Be pure (no side effects, no I/O, no network requests)
   * - NOT depend on any external SDK or tokenizer
   *
   * @param provider — The provider name (e.g., "openai", "deepseek", "anthropic", "mock")
   * @param model — Optional model name (e.g., "gpt-4", "claude-3-opus")
   * @returns A ProviderBudgetResult with token capacity information
   */
  getBudget(provider: string, model?: string): ProviderBudgetResult
}