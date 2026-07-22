/**
 * Observation represents a structured record of a tool execution within
 * the AgentLoop. Each Observation captures the tool call and its result,
 * along with timing and iteration metadata.
 *
 * Observations are the canonical data source for future capabilities
 * including Reflection, Memory Ranking, Context Compression, and Replay.
 *
 * Design principles:
 * - Immutable-ish: created once per tool execution, referenced by LoopStep
 * - Self-contained: all tool call data in one object
 * - Extensible: designed for future fields (e.g., thought, metadata)
 * - No duplication: LoopStep references Observation, does not copy data
 *
 * @property toolName - The name of the tool that was executed
 * @property toolInput - The input passed to the tool
 * @property toolOutput - The output returned by the tool (or error message)
 * @property timestamp - When the tool execution completed
 * @property iteration - Which loop iteration this observation belongs to
 * @property success - Whether the tool executed successfully
 */
export interface Observation {
  /** The name of the tool that was executed */
  toolName: string

  /** The input passed to the tool */
  toolInput: unknown

  /** The output returned by the tool (or error message on failure) */
  toolOutput: unknown

  /** When the tool execution completed (epoch ms) */
  timestamp: number

  /** Which loop iteration this observation belongs to (1-based) */
  iteration: number

  /** Whether the tool executed successfully */
  success?: boolean
}