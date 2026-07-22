import type { PromptContext } from './PromptContext'

/**
 * PromptSelectionResult is the output of a PromptSelection calculation.
 *
 * It determines which sections of a PromptContext should participate in the
 * final prompt, WITHOUT modifying the context itself. This information is
 * consumed by DefaultPromptBuilder to filter the PromptContext before
 * passing it to PromptCompression.
 *
 * Design principles:
 * - Pure data — no behavior or methods
 * - Independent — no dependencies on any other component
 * - Extensible — future selection strategies can add more metadata
 *
 * @property selectedSections — Section names to preserve (subset of PromptContext keys)
 * @property excludedSections — Section names to exclude (empty for default pass-through)
 */
export interface PromptSelectionResult {
  /**
   * Section names to preserve in the final prompt.
   * Only sections that exist (are defined and non-empty) in the context
   * are included. Sections not present in the context are excluded.
   *
   * Example: ['system', 'userInput', 'memory', 'worldState', 'observations', 'reflections']
   */
  selectedSections: string[]

  /**
   * Section names to exclude from the final prompt.
   * Empty by default (all populated sections are preserved).
   *
   * Example: [] — no sections excluded
   */
  excludedSections: string[]
}