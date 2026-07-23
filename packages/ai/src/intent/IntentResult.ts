import type { Intent } from './Intent'

/**
 * IntentResult — the output of an IntentAnalyzer.
 *
 * Supports multiple intents from a single input.
 *
 * Example:
 *   Input: "Draw a tree and a flower"
 *   Output: { intents: [{ type: 'Create' }, { type: 'Create' }] }
 */
export interface IntentResult {
  readonly intents: Intent[]
}