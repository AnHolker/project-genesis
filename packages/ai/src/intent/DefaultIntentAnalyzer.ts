import type { IntentAnalyzer } from './IntentAnalyzer'
import type { IntentResult } from './IntentResult'

/**
 * DefaultIntentAnalyzer — foundation-only placeholder implementation.
 *
 * Current behavior:
 *   Returns an empty IntentResult ({ intents: [] }) for every input.
 *
 * No parsing. No AI. No heuristics. No runtime dependencies.
 *
 * This is the baseline for future implementations:
 *   - RuleBasedIntentAnalyzer  — keyword matching
 *   - HeuristicIntentAnalyzer  — pattern-based intent detection
 *   - LLMIntentAnalyzer        — LLM-based semantic understanding
 */
export class DefaultIntentAnalyzer implements IntentAnalyzer {
  analyze(_input: string): IntentResult {
    return { intents: [] }
  }
}