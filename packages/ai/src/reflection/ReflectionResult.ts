/**
 * ReflectionResult represents the outcome of a reflection evaluation.
 *
 * Contains the reflection reasoning and a suggestion for whether the loop
 * should continue. Currently, AgentLoop records the result but does not
 * use it for decision making — this is reserved for future WO.
 *
 * @property reasoning - Explanation from the reflection component
 * @property continueLoop - Suggested loop continuation status
 *   - true: reflection thinks the loop should continue
 *   - false: reflection thinks the loop should stop
 * @property metadata - Optional extensible metadata for future use
 */
export interface ReflectionResult {
  /** Explanation from the reflection component */
  reasoning: string

  /**
   * Suggested loop continuation status.
   * Currently recorded but not used for AgentLoop decision making.
   */
  continueLoop: boolean

  /** Optional extensible metadata for future use */
  metadata?: Record<string, unknown>
}