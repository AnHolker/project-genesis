import type { AgentLoop } from './AgentLoop'
import type { AgentLoopContext } from './AgentLoopContext'
import type { AgentLoopResult } from './AgentLoopResult'
import type { LoopStep } from './AgentLoopStep'
import { PipelineEventEmitter } from '../events'

/**
 * DefaultAgentLoop implements the AgentLoop interface.
 *
 * This is a foundation implementation that executes exactly ONE iteration.
 * It does NOT implement:
 * - while loop / multi-iteration execution
 * - Multi-turn Tool Calling
 * - Reflection
 * - Memory Ranking
 * - Context Compression
 * - Self Critique
 *
 * Those capabilities will be added in future work orders.
 *
 * Current flow:
 * 1. Emit AgentLoopStarted
 * 2. Emit LoopIterationStarted (iteration 1)
 * 3. planner.plan(request) → plannerResult
 * 4. Create LoopStep with iteration=1 and plannerResult
 * 5. Emit LoopIterationFinished
 * 6. Build AgentLoopResult { iterations: 1, finished: true, steps: [step] }
 * 7. Emit AgentLoopFinished
 * 8. Return AgentLoopResult
 *
 * Events:
 * - AgentLoopStarted — before any planning (payload: { maxIterations })
 * - LoopIterationStarted — before each iteration (payload: { iteration, maxIterations })
 * - LoopIterationFinished — after each iteration (payload: { iteration })
 * - AgentLoopFinished — after all iterations (payload: { iterations, finished })
 */
export class DefaultAgentLoop implements AgentLoop {
  readonly events = new PipelineEventEmitter()

  async execute(context: AgentLoopContext): Promise<AgentLoopResult> {
    const maxIterations = context.maxIterations

    // Emit AgentLoopStarted
    this.events.emit({
      type: 'AgentLoopStarted',
      timestamp: Date.now(),
      payload: { maxIterations },
    })

    // --- Iteration 1 (currently the only iteration) ---

    // Emit LoopIterationStarted
    this.events.emit({
      type: 'LoopIterationStarted',
      timestamp: Date.now(),
      payload: { iteration: 1, maxIterations },
    })

    // Execute planning via the injected Planner
    const plannerResult = await context.planner.plan(context.request)

    // Build the LoopStep for iteration 1
    const step: LoopStep = {
      iteration: 1,
      plannerResult,
    }

    // Emit LoopIterationFinished
    this.events.emit({
      type: 'LoopIterationFinished',
      timestamp: Date.now(),
      payload: { iteration: 1 },
    })

    // Build the AgentLoopResult
    const result: AgentLoopResult = {
      plannerResult,
      steps: [step],
      iterations: 1,
      finished: true,
    }

    // Emit AgentLoopFinished
    this.events.emit({
      type: 'AgentLoopFinished',
      timestamp: Date.now(),
      payload: {
        iterations: 1,
        finished: true,
      },
    })

    return result
  }
}