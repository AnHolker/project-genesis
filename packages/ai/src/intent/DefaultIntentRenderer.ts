import type { IntentRenderer } from './IntentRenderer'
import type { IntentResult } from './IntentResult'

/**
 * DefaultIntentRenderer — default implementation of IntentRenderer.
 *
 * Formats IntentResult as a human-readable "User Intent:" section.
 *
 * Empty result: returns empty string
 * Single intent:
 *   ```
 *   User Intent:
 *   - Create
 *   ```
 * Multiple intents:
 *   ```
 *   User Intent:
 *   - Create
 *   - Move
 *   ```
 *
 * Properties:
 * - Pure function: same input always produces same output
 * - Stateless: no internal state between calls
 * - Deterministic: no randomness or external factors
 * - Idempotent: calling twice produces the same result as calling once
 * - Immutable: never modifies inputs
 */
export class DefaultIntentRenderer implements IntentRenderer {
  render(intent: IntentResult): string {
    if (intent.intents.length === 0) {
      return ''
    }

    const lines = intent.intents.map((i) => `- ${i.type}`)
    return `User Intent:\n${lines.join('\n')}`
  }
}