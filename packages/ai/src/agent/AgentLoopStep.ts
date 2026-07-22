import type { PlannerResult } from '../planner'
import type { Observation } from './Observation'

/**
 * LoopStep represents a single iteration within the AgentLoop.
 *
 * Each iteration may include:
 * - A thought (LLM reasoning before tool call)
 * - A tool call (name + input)
 * - A tool output (observation)
 * - A planner result (the action plan generated in that iteration)
 *
 * The `observations` field references structured Observation objects
 * maintained by the AgentLoop. The inline `toolName`, `toolInput`,
 * `toolOutput` fields are kept for quick access and backward compatibility.
 *
 * @property iteration - The iteration number (1-based)
 * @property thought - Optional LLM reasoning text for this iteration
 * @property toolName - Optional name of the tool called in this iteration
 * @property toolInput - Optional input passed to the tool
 * @property toolOutput - Optional output returned by the tool
 * @property observations - Structured observations from this iteration (references, no duplication)
 * @property plannerResult - Optional PlannerResult from this iteration
 */
export interface LoopStep {
  /** The iteration number (1-based) */
  iteration: number

  /** Optional LLM reasoning text for this iteration */
  thought?: string

  /** Optional name of the tool called in this iteration */
  toolName?: string

  /** Optional input passed to the tool */
  toolInput?: unknown

  /** Optional output returned by the tool */
  toolOutput?: unknown

  /**
   * Structured observations recorded during this iteration.
   * References the same Observation objects maintained by the AgentLoop.
   * No data duplication — the inline toolName/toolInput/toolOutput fields
   * mirror the last observation for quick access.
   */
  observations?: Observation[]

  /** Optional PlannerResult from this iteration */
  plannerResult?: PlannerResult
}