import type { PlannerResult } from '../planner'

/**
 * LoopStep represents a single iteration within the AgentLoop.
 *
 * Each iteration may include:
 * - A thought (LLM reasoning before tool call)
 * - A tool call (name + input)
 * - A tool output (observation)
 * - A planner result (the action plan generated in that iteration)
 *
 * The current implementation records only iteration number and planner
 * result. The thought, toolName, toolInput, and toolOutput fields are
 * reserved for future multi-iteration support.
 *
 * @property iteration - The iteration number (1-based)
 * @property thought - Optional LLM reasoning text for this iteration
 * @property toolName - Optional name of the tool called in this iteration
 * @property toolInput - Optional input passed to the tool
 * @property toolOutput - Optional output returned by the tool
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

  /** Optional PlannerResult from this iteration */
  plannerResult?: PlannerResult
}