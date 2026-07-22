import type { PlannerResult } from '../planner'
import type { Observation } from '../agent'
import type { LoopStep } from '../agent'

/**
 * ReflectionContext carries all data needed for reflection.
 *
 * Contains the current planning state including the latest planner result,
 * accumulated observations, loop step history, and iteration metadata.
 *
 * Design:
 * - Self-contained: all reflection-relevant data in one object
 * - Immutable: consumers should not mutate the context
 * - Extensible: designed for future fields (e.g., original user input, memory)
 *
 * @property plannerResult - The latest PlannerResult from the most recent planning call
 * @property observations - All accumulated Observation[] across all iterations
 * @property steps - Complete loop step history
 * @property iteration - The current iteration number (1-based)
 * @property maxIterations - Maximum allowed iterations
 * @property metadata - Optional extensible metadata for future use
 */
export interface ReflectionContext {
  /** The latest PlannerResult from the most recent planning call */
  plannerResult: PlannerResult

  /** All accumulated Observation[] across all iterations */
  observations: Observation[]

  /** Complete loop step history */
  steps: LoopStep[]

  /** The current iteration number (1-based) */
  iteration: number

  /** Maximum allowed iterations */
  maxIterations: number

  /** Optional extensible metadata for future use */
  metadata?: Record<string, unknown>
}