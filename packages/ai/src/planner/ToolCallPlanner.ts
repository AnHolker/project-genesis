import type { PlannerResult } from './PlannerResult'
import type { Planner } from './Planner'
import type { AIRequest } from '../request'
import type { PlannerProvider } from '../provider'
import type { ToolRegistry } from '../tools'
import { PipelineEventEmitter } from '../events'

/**
 * ToolCallPlanner extends the Planner with tool calling support.
 *
 * It wraps a PlannerProvider and a ToolRegistry. When plan() is called,
 * it enhances the request with tool definitions, delegates to the provider,
 * and emits ToolCallStarted/ToolCallFinished lifecycle events.
 *
 * Architecture:
 * - Lives **above** concrete providers (works with Mock, OpenAI, DeepSeek)
 * - AI layer depends only on Tool/ToolRegistry abstractions (no Runtime)
 * - Tool support is additive — existing planners without tools remain unchanged
 * - Concrete tool execution remains outside providers
 *
 * Events emitted:
 * - `ToolCallStarted` — before provider call (payload: { toolNames })
 * - `ToolCallFinished` — after provider call (payload: { toolNames, success })
 */
export class ToolCallPlanner implements Planner {
  readonly events = new PipelineEventEmitter()

  constructor(
    private readonly provider: PlannerProvider,
    private readonly toolRegistry: ToolRegistry,
  ) {}

  async plan(request: AIRequest): Promise<PlannerResult> {
    const tools = this.toolRegistry.getTools()
    const toolNames = tools.map((t) => t.name)

    // Enhance the request with tool definitions
    const enhancedRequest = this.enhanceWithTools(request, tools, toolNames)

    // Emit ToolCallStarted
    this.events.emit({
      type: 'ToolCallStarted',
      timestamp: Date.now(),
      payload: { toolNames },
    })

    // Delegate to the provider
    let success = true
    let result: PlannerResult
    try {
      result = await this.provider.complete(enhancedRequest)
    } catch (error) {
      success = false
      result = {
        actions: [],
        reasoning: `ToolCallPlanner error: ${error instanceof Error ? error.message : String(error)}`,
      }
    }

    // Emit ToolCallFinished
    this.events.emit({
      type: 'ToolCallFinished',
      timestamp: Date.now(),
      payload: { toolNames, success },
    })

    // Add tool metadata to the result
    return {
      ...result,
      metadata: {
        ...result.metadata,
        tools: toolNames,
      },
    }
  }

  /**
   * Enhances the AIRequest with tool definitions.
   * Tool descriptions are added to the prompt text so the LLM knows
   * which tools are available. Tool names are included in metadata.
   */
  private enhanceWithTools(
    request: AIRequest,
    tools: { name: string; description: string }[],
    toolNames: string[],
  ): AIRequest {
    if (tools.length === 0) return request

    const toolDescriptions = tools
      .map((t) => `- ${t.name}: ${t.description}`)
      .join('\n')

    const toolBlock = `\n\nAvailable Tools:\n${toolDescriptions}`

    return {
      ...request,
      prompt: `${request.prompt}${toolBlock}`,
      metadata: {
        ...request.metadata,
        toolNames,
      },
    }
  }
}