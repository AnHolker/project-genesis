import type { PromptSelection } from './PromptSelection'
import type { PromptSelectionResult } from './PromptSelectionResult'
import type { PromptContext } from './PromptContext'
import type { MemoryRankingResult } from './MemoryRankingResult'
import type { PromptBudgetResult } from './PromptBudgetResult'
import type { ProviderBudgetResult } from './ProviderBudgetResult'

/**
 * DefaultPromptSelection implements rule-based Prompt Selection.
 *
 * This implementation CONSUMES MemoryRanking and PromptBudget results
 * to make deterministic section inclusion decisions.
 *
 * Since WO-S4-006, it also CONSUMES ProviderBudgetResult to dynamically
 * calculate the budget threshold based on provider/model token capacity.
 *
 * ## Behavior
 *
 * ### ProviderBudget Provided
 * - Uses providerBudget.maxInputTokens * charsPerToken as the effective budget threshold
 * - Overrides the static maxBudgetChars (if set via constructor)
 *
 * ### Budget Sufficient (totalLength <= effective threshold)
 * - Preserves ALL populated sections
 * - Returns empty excludedSections array
 * - Identical behavior to the pass-through implementation in WO-S4-001
 *
 * ### Budget Constrained (totalLength > effective threshold)
 * - Removes sections according to MemoryRanking priority
 * - Lowest priority sections removed FIRST
 * - Continues removing until remaining sections fit within budget
 * - If ranking is not provided, falls back to preserving all sections
 * - If budget is not provided, falls back to preserving all sections
 *
 * ## Properties
 * - Non-mutating: never modifies the input PromptContext
 * - Idempotent: same input always produces same output
 * - Deterministic: fully rule-based, no probabilistic logic
 * - Pure: no side effects
 * - Provider-independent: no binding to any provider
 * - No AI: no embeddings, no LLM calls, no semantic search
 *
 * ## Constructor
 * @param maxBudgetChars — Maximum allowed character count (default: Infinity)
 *   Used only when ProviderBudgetResult is NOT provided to select().
 *   When ProviderBudgetResult IS provided, the threshold is dynamically
 *   calculated as providerBudget.maxInputTokens * charsPerToken.
 * @param charsPerToken — Characters per token ratio for converting provider
 *   token limits to character thresholds (default: 4).
 *   Only used when ProviderBudgetResult is provided to select().
 */
export class DefaultPromptSelection implements PromptSelection {
  private readonly maxBudgetChars: number
  private readonly charsPerToken: number

  constructor(maxBudgetChars?: number, charsPerToken?: number) {
    this.maxBudgetChars = maxBudgetChars ?? Infinity
    this.charsPerToken = charsPerToken ?? 4
  }

  /**
   * Select sections from a PromptContext.
   *
   * When ranking and budget are both provided, uses rule-based logic:
   * - Within budget → preserve all sections
   * - Over budget → remove lowest-priority sections first
   *
   * When providerBudget is provided, the effective budget threshold is
   * dynamically calculated as maxInputTokens * charsPerToken, overriding
   * the static maxBudgetChars.
   *
   * When ranking or budget is missing, preserves all sections (passthrough).
   *
   * @param context — The PromptContext to evaluate
   * @param ranking — Optional MemoryRankingResult with section priorities
   * @param budget — Optional PromptBudgetResult with section sizes
   * @param providerBudget — Optional ProviderBudgetResult for dynamic threshold
   * @returns A PromptSelectionResult with selected and excluded section names
   */
  select(
    context: PromptContext,
    ranking?: MemoryRankingResult,
    budget?: PromptBudgetResult,
    providerBudget?: ProviderBudgetResult,
  ): PromptSelectionResult {
    // Step 1: Identify populated sections
    const populatedKeys: string[] = []
    for (const [key, value] of Object.entries(context)) {
      if (value !== undefined && value !== '') {
        populatedKeys.push(key)
      }
    }

    // If no ranking or budget provided, preserve all (backward compatible passthrough)
    if (!ranking || !budget) {
      return {
        selectedSections: [...populatedKeys],
        excludedSections: [],
      }
    }

    // Step 2: Determine effective budget threshold
    // ProviderBudget takes precedence when available
    const effectiveMaxBudgetChars = providerBudget !== undefined
      ? providerBudget.maxInputTokens * this.charsPerToken
      : this.maxBudgetChars

    // Step 3: Check budget
    if (budget.totalLength <= effectiveMaxBudgetChars) {
      // Budget sufficient — preserve all sections
      return {
        selectedSections: [...populatedKeys],
        excludedSections: [],
      }
    }

    // Step 4: Budget constrained — remove lowest priority sections first
    const { rankedSections, priorities } = ranking

    // Build a set of populated sections for fast lookup
    const populatedSet = new Set(populatedKeys)

    // Only consider ranking entries for sections that are actually populated
    const relevantRanked = rankedSections.filter((s) => populatedSet.has(s))

    // Sort from lowest priority to highest for removal order
    const removalOrder = [...relevantRanked].sort((a, b) => {
      const priA = priorities[a] ?? 0
      const priB = priorities[b] ?? 0
      return priA - priB
    })

    // Iteratively remove lowest priority sections until within budget.
    // Guard: never exclude the very last section (at least one must remain).
    const excludedSections: string[] = []

    for (let i = 0; i < removalOrder.length; i++) {
      const sectionToTry = removalOrder[i]

      // Never exclude the last remaining section
      if (excludedSections.length >= removalOrder.length - 1) {
        break
      }

      // Calculate what the size would be without this section
      const candidateExcluded = [...excludedSections, sectionToTry]
      const remainingSize = Object.entries(budget.sectionLengths)
        .filter(([key]) => !candidateExcluded.includes(key))
        .reduce((sum, [, len]) => sum + len, 0)

      if (remainingSize <= effectiveMaxBudgetChars) {
        // Removing this section gets us within budget
        excludedSections.push(sectionToTry)
        break
      }

      // Still over budget, continue removing
      excludedSections.push(sectionToTry)
    }

    const excludedSet = new Set(excludedSections)
    const selectedSections = populatedKeys.filter((s) => !excludedSet.has(s))

    return {
      selectedSections,
      excludedSections,
    }
  }
}