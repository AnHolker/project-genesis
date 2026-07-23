import type { PromptRenderer } from './PromptRenderer'
import type { PromptCompression } from './PromptCompression'
import type { MemoryRanking } from './MemoryRanking'
import type { PromptBudget } from './PromptBudget'
import type { PromptSelection } from './PromptSelection'
import type { ProviderBudget } from './ProviderBudget'
import type { AIConfiguration } from '../config'

/**
 * BuilderOptions consolidates all optional collaborators for DefaultPromptBuilder
 * into a single options object, preventing constructor parameter growth.
 *
 * Since WO-S4-010, DefaultPromptBuilder consumes BuilderOptions directly
 * via constructor overloads. The legacy positional parameter form is preserved
 * for backward compatibility.
 *
 * Design principles:
 * - All fields are optional — no breaking changes
 * - Each field maps to an existing constructor parameter
 * - No new fields beyond what the constructor already accepts
 * - Pure data object — no methods, no behavior
 *
 * @see DefaultPromptBuilder — consumes BuilderOptions via constructor overload
 */
export interface BuilderOptions {
  /** Optional PromptRenderer (defaults to DefaultPromptRenderer) */
  renderer?: PromptRenderer
  /** Optional PromptCompression (defaults to DefaultPromptCompression) */
  compression?: PromptCompression
  /** Optional MemoryRanking (defaults to DefaultMemoryRanking) */
  ranking?: MemoryRanking
  /** Optional PromptBudget (defaults to DefaultPromptBudget) */
  budget?: PromptBudget
  /** Optional PromptSelection (defaults to DefaultPromptSelection) */
  selection?: PromptSelection
  /** Optional ProviderBudget (defaults to undefined — no provider budget lookup) */
  providerBudget?: ProviderBudget
  /** Optional AIConfiguration (defaults to undefined — falls back to 'openai' provider) */
  configuration?: AIConfiguration
}