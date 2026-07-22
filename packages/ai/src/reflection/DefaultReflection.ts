import type { Reflection } from './Reflection'
import type { ReflectionContext } from './ReflectionContext'
import type { ReflectionResult } from './ReflectionResult'

/**
 * DefaultReflection implements the Reflection interface with simple rule-based logic.
 *
 * Rules:
 * - If plannerResult has non-empty actions → continueLoop = false (job done)
 * - If iteration >= maxIterations → continueLoop = false (out of runway)
 * - Otherwise → continueLoop = true (keep going)
 *
 * This implementation is intentionally simple. It establishes the abstraction
 * without adding complex LLM-based reflection logic. Future WO can replace
 * this with LLM self-critique or other advanced reflection strategies.
 *
 * Design:
 * - No external dependencies: does not import Runtime, Renderer, Provider, or Planner
 * - Deterministic: same inputs always produce same output
 * - Testable: pure logic with no side effects
 * - No event emission: reflection is for computation, not observability
 */
export class DefaultReflection implements Reflection {
  async execute(context: ReflectionContext): Promise<ReflectionResult> {
    const { plannerResult, iteration, maxIterations } = context

    // Rule 1: Actions present — job is done
    if (plannerResult.actions.length > 0) {
      return {
        reasoning: `Planner returned ${plannerResult.actions.length} action(s). Task appears complete.`,
        continueLoop: false,
      }
    }

    // Rule 2: Reached max iterations — out of runway
    if (iteration >= maxIterations) {
      return {
        reasoning: `Reached maximum iteration count (${iteration}/${maxIterations}). Cannot continue.`,
        continueLoop: false,
      }
    }

    // Rule 3: No actions and still have iterations — keep going
    return {
      reasoning: `No actions yet at iteration ${iteration}/${maxIterations}. Continuing loop.`,
      continueLoop: true,
    }
  }
}