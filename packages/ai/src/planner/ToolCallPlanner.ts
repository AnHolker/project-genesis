import type { PlannerResult } from './PlannerResult'
import type { Planner } from './Planner'
import type { AIRequest } from '../request'
import type { PlannerProvider } from '../provider'
import type { ToolCallingProvider } from '../provider'
import type { ToolRegistry } from '../tools'
import { PipelineEventEmitter } from '../events'

/**
 * ToolCallPlanner extends the Planner with tool calling support.
 *
 * It wraps a PlannerProvider and a ToolRegistry. When plan() is called,
 * it detects whether the provider supports native tool calling via the
 * ToolCallingProvider interface. If so, it delegates to the provider's
 * completeWithTools() method for native function/tool calling. Otherwise,
 * it falls back to prompt-based tool description injection.
 *
 * Architecture:
 * - Lives **above** concrete providers (works with Mock, OpenAI, DeepSeek)
 * - AI layer depends only on Tool/ToolRegistry abstractions (no Runtime)
 * - Tool support is additive — existing planners without tools remain unchanged
 * - Concrete tool execution remains outside providers
 *
 * Events emitted:
 * - `ToolCallStarted` — before tool calling (payload: { toolNames, tools?, native? })
 * - `ToolCallFinished` — after tool calling (payload: { toolNames, success, native?, toolResults?, duration? })
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

    // Check if the provider supports native tool calling
    const isToolCallingProvider = this.isToolCallingProvider(this.provider)

    // Emit ToolCallStarted with rich payload
    this.events.emit({
      type: 'ToolCallStarted',
      timestamp: Date.now(),
      payload: {
        toolNames,
        tools: tools.map((t) => ({ name: t.name, description: t.description })),
        native: isToolCallingProvider,
      },
    })

    const startTime = Date.now()
    let success = true
    let result: PlannerResult

    try {
      if (isToolCallingProvider) {
        // Native tool calling — provider handles the full lifecycle
        result = await (this.provider as ToolCallingProvider).completeWithTools(request, tools)
      } else {
        // Prompt-based tool injection (backward compatible)
        const enhancedRequest = this.enhanceWithTools(request, tools, toolNames)
        result = await this.provider.complete(enhancedRequest)
      }
    } catch (error) {
      success = false
      result = {
        actions: [],
        reasoning: `ToolCallPlanner error: ${error instanceof Error ? error.message : String(error)}`,
      }
    }

    const duration = Date.now() - startTime

    // Extract tool execution details from result metadata
    const toolCalls = (result.metadata?.toolCalls as Array<{
      name: string
      duration: number
      success: boolean
      error?: string
    }>) || toolNames.map((name) => ({
      name,
      duration: 0,
      success,
    }))

    // Emit ToolCallFinished with rich payload
    this.events.emit({
      type: 'ToolCallFinished',
      timestamp: Date.now(),
      payload: {
        toolNames,
        success,
        native: isToolCallingProvider,
        toolResults: toolCalls,
        duration,
        totalToolCallDuration: result.metadata?.totalToolCallDuration as number | undefined,
      },
    })

    // Add tool metadata to the result
    return {
      ...result,
      metadata: {
        ...result.metadata,
        tools: toolNames,
        toolCallDuration: duration,
        toolCallNative: isToolCallingProvider,
      },
    }
  }

  /**
   * Check if the provider implements the ToolCallingProvider interface.
   */
  private isToolCallingProvider(provider: PlannerProvider): provider is ToolCallingProvider {
    return 'completeWithTools' in provider
  }

  /**
   * Enhances the AIRequest with tool definitions for prompt-based fallback.
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