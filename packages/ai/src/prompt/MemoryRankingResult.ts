import type { PromptContext } from './PromptContext'

/**
 * MemoryRankingResult is the output of a MemoryRanking calculation.
 *
 * It provides prioritized section ordering without modifying the
 * PromptContext. This information can be consumed by future components
 * like PromptCompression, Memory Ranking-based truncation, or
 * Context Window management.
 *
 * Design principles:
 * - Pure data — no behavior or methods
 * - Independent — no dependencies on any other component
 * - Extensible — future rankings can add more metadata
 *
 * @property rankedSections — Section names ordered by priority (highest first)
 * @property priorities — Per-section priority score (higher = more important)
 */
export interface MemoryRankingResult {
  /**
   * Section names ordered by priority, from highest priority to lowest.
   * Only sections that exist (are defined and non-empty) in the context
   * are included. Sections not present in the context are excluded.
   *
   * Example: ['userInput', 'reflections', 'observations', 'memory', 'worldState', 'system']
   */
  rankedSections: string[]

  /**
   * Per-section priority scores.
   * Higher values indicate higher importance.
   *
   * Example: { userInput: 100, reflections: 80, observations: 60, memory: 40, worldState: 20, system: 10 }
   */
  priorities: Record<string, number>
}