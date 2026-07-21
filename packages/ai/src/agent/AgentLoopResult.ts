import type { PlannerResult } from '../planner'
import type { LoopStep } from './AgentLoopStep'

/**
 * AgentLoopResult represents the outcome of an AgentLoop execution.
 *
 * Contains the final planner result, the complete history of loop steps,
 * and execution metadata (iterations, finished status, reasoning).
 *
 * @property plannerResult - The final PlannerResult from the last iteration
 * @property steps - Complete history of all loop steps
 * @property iterations - Number of iterations executed
 * @property finished - Whether the loop finished successfully
 * @property reasoning - Optional overall reasoning for loop termination
 */
export interface AgentLoopResult {
  /** The final PlannerResult from the last iteration */
  plannerResult: PlannerResult

  /** Complete history of all loop steps */
  steps: LoopStep[]

  /** Number of iterations executed */
  iterations: number

  /** Whether the loop finished successfully */
  finished: boolean

  /** Optional overall reasoning for loop termination */
  reasoning?: string
}