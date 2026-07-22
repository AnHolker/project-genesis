import type { MemoryRanking } from './MemoryRanking'
import type { PromptContext } from './PromptContext'
import type { MemoryRankingResult } from './MemoryRankingResult'

/**
 * The canonical priority order for DefaultMemoryRanking.
 *
 * Priority is from highest to lowest:
 * 1. userInput    — What the user actually asked (most important)
 * 2. reflections  — Reflection evaluation results (task-specific insight)
 * 3. observations — Tool observation results (current execution context)
 * 4. memory       — Conversation history (relevant for context)
 * 5. worldState   — Current world snapshot (useful for spatial reasoning)
 * 6. system       — System prompt (always the same, lowest priority for retention)
 *
 * This order reflects the principle that dynamic, user-facing content
 * is more important than static, always-present content.
 */
export const DEFAULT_RANKING_PRIORITY: Record<string, number> = {
  userInput: 100,
  reflections: 80,
  observations: 60,
  memory: 40,
  worldState: 20,
  system: 10,
}

/**
 * DefaultMemoryRanking is the default implementation of MemoryRanking.
 *
 * Current behavior:
 * - Uses a fixed priority table to rank sections
 * - Only includes sections that are populated (defined and non-empty)
 * - Returns ranked section names in descending priority order
 *
 * This is intentionally simple. No embedding, no cosine similarity,
 * no vector search, no LLM evaluation — those belong in future WOs.
 *
 * The implementation is:
 * - Non-mutating: reads PromptContext, returns new MemoryRankingResult
 * - Deterministic: same input always produces same output
 * - Pure: no side effects, no dependencies
 * - Provider-agnostic: no binding to OpenAI, DeepSeek, or any provider
 *
 * Future: This will be replaced by or composed with more sophisticated
 * ranking strategies as the system evolves.
 */
export class DefaultMemoryRanking implements MemoryRanking {
  rank(context: PromptContext): MemoryRankingResult {
    // Collect populated sections only (defined and non-empty)
    const populatedSections: Array<{ key: string; value: string }> = []

    for (const [key, value] of Object.entries(context)) {
      if (value !== undefined && value !== '') {
        populatedSections.push({ key, value })
      }
    }

    // Sort by priority (descending — highest priority first)
    const sorted = [...populatedSections].sort((a, b) => {
      const priorityA = DEFAULT_RANKING_PRIORITY[a.key] ?? 0
      const priorityB = DEFAULT_RANKING_PRIORITY[b.key] ?? 0
      return priorityB - priorityA
    })

    // Build ranked sections list and priorities map
    const rankedSections: string[] = sorted.map((s) => s.key)
    const priorities: Record<string, number> = {}
    for (const section of sorted) {
      priorities[section.key] = DEFAULT_RANKING_PRIORITY[section.key] ?? 0
    }

    return { rankedSections, priorities }
  }
}