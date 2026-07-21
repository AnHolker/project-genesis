import type { AgentLoop } from './AgentLoop'
import type { AgentLoopContext } from './AgentLoopContext'
import type { AgentLoopResult } from './AgentLoopResult'
import type { LoopStep } from './AgentLoopStep'
import type { PlannerResult } from '../planner'
import { PipelineEventEmitter } from '../events'

/**
 * DefaultAgentLoop implements the AgentLoop interface.
 *
 * This implementation supports multi-step execution:
 * - Each iteration calls planner.plan(request) → PlannerResult
 * - If the Planner returns actions (actions.length > 0), the loop ends
 * - If actions are empty AND toolCalls exist in metadata, tools are executed
 * - Tool observations are fed back into the request for the next iteration
 * - The loop stops when one of: Planner returns actions, maxIterations reached
 *
 * Current flow:
 * 1. Emit AgentLoopStarted
 * 2. Loop (iteration 1..N):
 *    a. Emit LoopIterationStarted (iteration)
 *    b. planner.plan(request) → plannerResult
 *    c. Create LoopStep with iteration and plannerResult
 *    d. If plannerResult.actions.length > 0 → final result, break
 *    e. If toolRegistry and toolCalls exist → execute tools, record observations
 *       - For each tool: execute, emit ToolExecuted, record in LoopStep, emit ObservationRecorded
 *       - Append observations to request prompt
 *    f. Emit LoopIterationFinished
 * 3. Build AgentLoopResult
 * 4. Emit AgentLoopFinished
 * 5. Return AgentLoopResult
 *
 * Events:
 * - AgentLoopStarted — before any planning (payload: { maxIterations })
 * - LoopIterationStarted — before each iteration (payload: { iteration, maxIterations })
 * - ToolExecuted — after each tool execution (payload: { toolName, toolInput })
 * - ObservationRecorded — after each observation (payload: { toolName, toolInput, toolOutput })
 * - LoopIterationFinished — after each iteration (payload: { iteration })
 * - AgentLoopFinished — after all iterations (payload: { iterations, finished })
 */
export class DefaultAgentLoop implements AgentLoop {
  readonly events = new PipelineEventEmitter()

  async execute(context: AgentLoopContext): Promise<AgentLoopResult> {
    const maxIterations = context.maxIterations
    const steps: LoopStep[] = []
    let currentRequest = context.request
    let finalPlannerResult: PlannerResult = { actions: [] }
    let loopFinished = false

    // Emit AgentLoopStarted
    this.events.emit({
      type: 'AgentLoopStarted',
      timestamp: Date.now(),
      payload: { maxIterations },
    })

    for (let iteration = 1; iteration <= maxIterations; iteration++) {
      // Emit LoopIterationStarted
      this.events.emit({
        type: 'LoopIterationStarted',
        timestamp: Date.now(),
        payload: { iteration, maxIterations },
      })

      // Execute planning via the injected Planner
      const plannerResult = await context.planner.plan(currentRequest)

      // Check if the Planner returned final actions
      if (plannerResult.actions.length > 0) {
        const step: LoopStep = {
          iteration,
          plannerResult,
        }
        steps.push(step)

        finalPlannerResult = plannerResult
        loopFinished = true

        // Emit LoopIterationFinished
        this.events.emit({
          type: 'LoopIterationFinished',
          timestamp: Date.now(),
          payload: { iteration },
        })

        break
      }

      // Empty actions — check for tool calls in metadata
      const toolCalls = this.extractToolCalls(plannerResult)

      if (toolCalls.length > 0 && context.toolRegistry) {
        const observations: string[] = []
        let lastToolName: string | undefined
        let lastToolInput: unknown
        let lastToolOutput: unknown

        for (const toolCall of toolCalls) {
          const tool = context.toolRegistry.findTool(toolCall.name)

          if (!tool) {
            const error = `Tool not found: ${toolCall.name}`
            lastToolName = toolCall.name
            lastToolInput = toolCall.input
            lastToolOutput = error
            observations.push(`Error: ${error}`)

            this.events.emit({
              type: 'ToolExecuted',
              timestamp: Date.now(),
              payload: { toolName: toolCall.name, toolInput: toolCall.input, success: false },
            })

            this.events.emit({
              type: 'ObservationRecorded',
              timestamp: Date.now(),
              payload: { toolName: toolCall.name, toolInput: toolCall.input, toolOutput: error },
            })

            continue
          }

          // Emit ToolExecuted
          this.events.emit({
            type: 'ToolExecuted',
            timestamp: Date.now(),
            payload: { toolName: toolCall.name, toolInput: toolCall.input },
          })

          // Execute the tool
          let output: unknown
          let success = true
          try {
            output = await tool.execute(toolCall.input)
          } catch (err) {
            output = err instanceof Error ? err.message : String(err)
            success = false
          }

          // Record observation
          const observation = `Tool ${toolCall.name} returned: ${JSON.stringify(output)}`
          observations.push(observation)

          lastToolName = toolCall.name
          lastToolInput = toolCall.input
          lastToolOutput = output

          // Emit ObservationRecorded
          this.events.emit({
            type: 'ObservationRecorded',
            timestamp: Date.now(),
            payload: { toolName: toolCall.name, toolInput: toolCall.input, toolOutput: output, success },
          })
        }

        // Build the LoopStep for this iteration
        const step: LoopStep = {
          iteration,
          plannerResult,
          toolName: lastToolName,
          toolInput: lastToolInput,
          toolOutput: lastToolOutput,
        }
        steps.push(step)

        // Update request with observations for next iteration
        const observationText = observations.join('\n')
        currentRequest = {
          ...currentRequest,
          prompt: `${currentRequest.prompt}\n\nObservation:\n${observationText}`,
        }
      } else {
        // No tool calls or no tool registry — record the step and end
        const step: LoopStep = {
          iteration,
          plannerResult,
        }
        steps.push(step)

        finalPlannerResult = plannerResult
        loopFinished = true
      }

      // Emit LoopIterationFinished
      this.events.emit({
        type: 'LoopIterationFinished',
        timestamp: Date.now(),
        payload: { iteration },
      })

      if (loopFinished) {
        break
      }
    }

    // Build the AgentLoopResult
    const result: AgentLoopResult = {
      plannerResult: finalPlannerResult,
      steps,
      iterations: steps.length,
      finished: finalPlannerResult.actions.length > 0,
    }

    // Emit AgentLoopFinished
    this.events.emit({
      type: 'AgentLoopFinished',
      timestamp: Date.now(),
      payload: {
        iterations: result.iterations,
        finished: result.finished,
      },
    })

    return result
  }

  /**
   * Extract tool calls from planner result metadata.
   * Returns an array of { name, input } pairs.
   */
  private extractToolCalls(
    plannerResult: { metadata?: Record<string, unknown> },
  ): Array<{ name: string; input: unknown }> {
    const raw = plannerResult.metadata?.toolCalls
    if (!Array.isArray(raw)) {
      return []
    }
    return raw as Array<{ name: string; input: unknown }>
  }
}