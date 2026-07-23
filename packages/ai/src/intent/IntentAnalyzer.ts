import type { IntentResult } from './IntentResult'

/**
 * IntentAnalyzer — interface for extracting user intentions from natural language input.
 *
 * The IntentAnalyzer is the semantic bridge between natural language
 * and executable runtime actions. It produces IntentResult without
 * any dependency on Planner, Runtime, Provider, or ToolCalling.
 *
 * Foundation only — current implementations must be pure, deterministic,
 * stateless, and side-effect free.
 */
export interface IntentAnalyzer {
  analyze(input: string): IntentResult
}