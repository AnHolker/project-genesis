import type { IntentResult } from './IntentResult'

/**
 * IntentRenderer — interface for converting IntentResult into a formatted string.
 *
 * The IntentRenderer produces a human-readable string representation of
 * analyzed user intents. This formatted string can be used in prompt assembly
 * or stored in metadata for downstream consumption.
 *
 * Implementations MUST be:
 * - Pure functions (same input always produces same output)
 * - Stateless (no internal state between calls)
 * - Deterministic (no randomness or external factors)
 * - Side-effect free (no I/O, no mutation of inputs)
 *
 * @see DefaultIntentRenderer — default implementation
 */
export interface IntentRenderer {
  /**
   * Convert IntentResult to a formatted string.
   *
   * @param intent — the IntentResult to format
   * @returns formatted string. Empty string for empty intent results.
   */
  render(intent: IntentResult): string
}