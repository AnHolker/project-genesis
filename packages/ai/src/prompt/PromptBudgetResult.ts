import type { PromptContext } from './PromptContext'

/**
 * PromptBudgetResult is the output of a PromptBudget calculation.
 *
 * It provides sizing information about a PromptContext without
 * modifying the context. This information can be consumed by future
 * components like Compression, Memory Ranking, or Context Window
 * management.
 *
 * Design principles:
 * - Pure data — no behavior or methods
 * - Independent — no dependencies on any other component
 * - Extensible — future budgets can add more fields
 *
 * @property totalLength — Total character length across all sections
 * @property sectionLengths — Per-section character length map
 * @property estimatedTokens — Optional estimated token count (null by default)
 */
export interface PromptBudgetResult {
  /** Total character length across all populated sections */
  totalLength: number

  /** Per-section character length map (section name → length) */
  sectionLengths: Record<string, number>

  /**
   * Estimated token count.
   *
   * Default implementations leave this undefined.
   * Future TokenBudget, ProviderBudget, or ModelSpecificBudget
   * implementations may populate this field.
   */
  estimatedTokens?: number
}