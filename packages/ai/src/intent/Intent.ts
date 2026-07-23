import type { IntentType } from './IntentType'

/**
 * Intent — minimal immutable data object representing a single user intention.
 *
 * Foundation only — no behavior, no methods, no dependencies on Planner, Runtime, or Provider.
 *
 * Future extensions may add an optional payload (e.g., target entity, parameters)
 * without breaking this base interface.
 */
export interface Intent {
  readonly type: IntentType
}