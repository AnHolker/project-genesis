import type { AgentLoop } from './AgentLoop'
import type { AgentLoopContext } from './AgentLoopContext'
import type { AgentLoopResult } from './AgentLoopResult'
import type { LoopStep } from './AgentLoopStep'
import type { Observation } from './Observation'
import type { PlannerResult } from '../planner'
import type { Reflection } from '../reflection'
import type { ReflectionContext } from '../reflection'
import type { ReflectionResult } from '../reflection'
import { PipelineEventEmitter } from '../events'
import { formatObservationsInline } from '../prompt/modules/ObservationPromptModule'

/**
 * DefaultAgentLoop implements the AgentLoop interface.
 *
 * Supports multi-step execution with structured Observation context.
 * Each iteration:
 * 1. Attaches structured observations to request metadata
 * 2. Calls planner.plan(request) → PlannerResult
 * 3. If actions returned → done
 * 4. If empty actions + toolCalls → execute tools, create structured Observations
 * 5. LoopStep references Observation objects (no duplication)
 * 6. Observations are also converted to prompt text (AgentLoop decides format)
 *
 * Stop conditions:
 * - Planner returns non-empty actions
 * - maxIterations reached
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
  private readonly reflection?: Reflection

  constructor(reflection?: Reflection) {
    this.reflection = reflection
  }

  async execute(context: AgentLoopContext): Promise<AgentLoopResult> {
    const maxIterations = context.maxIterations
    const steps: LoopStep[] = []
    let currentRequest = context.request
    let finalPlannerResult: PlannerResult = { actions: [] }
    let loopFinished = false
    const reflectionResults: ReflectionResult[] = []

    // Structured observations maintained across all iterations
    const structuredObservations: Observation[] = []

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

      // Attach structured observations to request metadata before planning
      const requestWithObservations = this.attachObservations(
        currentRequest,
        structuredObservations,
      )

      // Execute planning via the injected Planner
      const plannerResult = await context.planner.plan(requestWithObservations)

      // Check if the Planner returned final actions
      if (plannerResult.actions.length > 0) {
        const step: LoopStep = {
          iteration,
          plannerResult,
        }
        steps.push(step)

        finalPlannerResult = plannerResult
        loopFinished = true

        // Run reflection (if available) before ending the iteration
        await this.runReflection(plannerResult, structuredObservations, steps, iteration, maxIterations, reflectionResults)

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
        const iterationObservations: Observation[] = []
        let lastToolName: string | undefined
        let lastToolInput: unknown
        let lastToolOutput: unknown

        for (const toolCall of toolCalls) {
          const tool = context.toolRegistry.findTool(toolCall.name)
          const now = Date.now()

          if (!tool) {
            const error = `Tool not found: ${toolCall.name}`
            lastToolName = toolCall.name
            lastToolInput = toolCall.input
            lastToolOutput = error

            // Create structured Observation
            const obs: Observation = {
              toolName: toolCall.name,
              toolInput: toolCall.input,
              toolOutput: error,
              timestamp: now,
              iteration,
              success: false,
            }
            iterationObservations.push(obs)

            this.events.emit({
              type: 'ToolExecuted',
              timestamp: now,
              payload: { toolName: toolCall.name, toolInput: toolCall.input, success: false },
            })

            this.events.emit({
              type: 'ObservationRecorded',
              timestamp: now,
              payload: { toolName: toolCall.name, toolInput: toolCall.input, toolOutput: error },
            })

            continue
          }

          // Emit ToolExecuted
          this.events.emit({
            type: 'ToolExecuted',
            timestamp: now,
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

          // Create structured Observation
          const obs: Observation = {
            toolName: toolCall.name,
            toolInput: toolCall.input,
            toolOutput: output,
            timestamp: now,
            iteration,
            success,
          }
          iterationObservations.push(obs)

          lastToolName = toolCall.name
          lastToolInput = toolCall.input
          lastToolOutput = output

          // Emit ObservationRecorded
          this.events.emit({
            type: 'ObservationRecorded',
            timestamp: now,
            payload: { toolName: toolCall.name, toolInput: toolCall.input, toolOutput: output, success },
          })
        }

        // Add iteration observations to the global array
        // LoopStep references these same objects (no data duplication)
        structuredObservations.push(...iterationObservations)

        // Build the LoopStep for this iteration
        const step: LoopStep = {
          iteration,
          plannerResult,
          toolName: lastToolName,
          toolInput: lastToolInput,
          toolOutput: lastToolOutput,
          observations: iterationObservations,
        }
        steps.push(step)

        // Update request with observations for next iteration
        // PromptBuilder owns the formatting — AgentLoop only calls it
        const promptText = formatObservationsInline(iterationObservations)
        currentRequest = {
          ...currentRequest,
          prompt: `${currentRequest.prompt}\n\n${promptText}`,
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

      // Run reflection (if available) before ending the iteration
      await this.runReflection(plannerResult, structuredObservations, steps, iteration, maxIterations, reflectionResults)

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
      reflectionResults: reflectionResults.length > 0 ? reflectionResults : undefined,
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
   * Attach structured observations to the request metadata.
   * The observerations are passed to the Planner via AIRequest.metadata
   * so the Planner can access structured context without needing the
   * AgentLoop to convert observations to prompt first.
   */
  private attachObservations(
    request: { prompt: string; metadata?: Record<string, unknown> },
    observations: Observation[],
  ): { prompt: string; metadata?: Record<string, unknown> } {
    if (observations.length === 0) {
      return request
    }

    return {
      ...request,
      metadata: {
        ...request.metadata,
        observations,
      },
    }
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

  /**
   * Run reflection on the current planning state.
   * If a Reflection implementation is available, calls it with the
   * accumulated context and records the result.
   *
   * Currently, the reflection result is recorded but does not affect
   * loop control. This is reserved for future WO.
   */
  private async runReflection(
    plannerResult: PlannerResult,
    observations: Observation[],
    steps: LoopStep[],
    iteration: number,
    maxIterations: number,
    reflectionResults: ReflectionResult[],
  ): Promise<void> {
    if (!this.reflection) return

    const reflectionContext: ReflectionContext = {
      plannerResult,
      observations,
      steps,
      iteration,
      maxIterations,
    }

    const result = await this.reflection.execute(reflectionContext)
    reflectionResults.push(result)
  }
}