import type { Planner } from '../planner'
import type { PlannerResult } from '../planner'
import type { PromptBuilder } from '../prompt'
import type { Pipeline } from './Pipeline'
import type { PipelineContext } from './PipelineContext'
import type { PlannerProvider, StreamingPlannerProvider } from '../provider'
import type { AgentLoop, AgentLoopContext } from '../agent'
import { DefaultAgentLoop } from '../agent'
import { PipelineEventEmitter } from '../events'
import { StructuredOutputValidator } from '../validation'

export class DefaultPipeline implements Pipeline {
  readonly events = new PipelineEventEmitter()
  private readonly agentLoop: AgentLoop

  constructor(
    private readonly planner: Planner,
    private readonly promptBuilder: PromptBuilder,
    private readonly provider?: PlannerProvider,
    agentLoop?: AgentLoop,
  ) {
    this.agentLoop = agentLoop ?? new DefaultAgentLoop()
  }

  async execute(context: PipelineContext): Promise<PipelineContext> {
    this.events.emit({ type: 'PipelineStarted', timestamp: Date.now() })

    const request = await this.promptBuilder.build(context)
    this.events.emit({ type: 'PromptBuilt', timestamp: Date.now(), payload: { prompt: request.prompt } })

    this.events.emit({ type: 'PlannerStarted', timestamp: Date.now() })
    const agentLoopContext: AgentLoopContext = {
      request,
      planner: this.planner,
      maxIterations: 5,
    }
    const agentLoopResult = await this.agentLoop.execute(agentLoopContext)
    const plannerResult = agentLoopResult.plannerResult
    this.events.emit({ type: 'PlannerFinished', timestamp: Date.now() })

    const result = { ...context, plannerResult }
    this.events.emit({ type: 'PipelineFinished', timestamp: Date.now() })
    return result
  }

  async stream(context: PipelineContext): Promise<PipelineContext> {
    this.events.emit({ type: 'PipelineStarted', timestamp: Date.now() })

    const request = await this.promptBuilder.build(context)
    this.events.emit({ type: 'PromptBuilt', timestamp: Date.now(), payload: { prompt: request.prompt } })

    this.events.emit({ type: 'PlannerStarted', timestamp: Date.now() })

    const plannerResult = await this.streamPlannerResult(request)

    this.events.emit({ type: 'PlannerFinished', timestamp: Date.now() })

    const result = { ...context, plannerResult }
    this.events.emit({ type: 'PipelineFinished', timestamp: Date.now() })
    return result
  }

  private async streamPlannerResult(request: {
    prompt: string
    metadata?: Record<string, unknown>
  }): Promise<PlannerResult> {
    // Check if the provider supports streaming
    if (this.provider && 'stream' in this.provider) {
      return this.doStream(request, this.provider as StreamingPlannerProvider)
    }

    // Fallback: non-streaming provider — use agentLoop.execute()
    const agentLoopContext: AgentLoopContext = {
      request,
      planner: this.planner,
      maxIterations: 5,
    }
    const agentLoopResult = await this.agentLoop.execute(agentLoopContext)
    return agentLoopResult.plannerResult
  }

  private async doStream(
    request: { prompt: string; metadata?: Record<string, unknown> },
    streamingProvider: StreamingPlannerProvider,
  ): Promise<PlannerResult> {
    const chunks: string[] = []

    try {
      for await (const chunk of streamingProvider.stream(request)) {
        chunks.push(chunk)
        this.events.emit({
          type: 'StreamChunk',
          timestamp: Date.now(),
          payload: { chunk },
        })
      }
    } catch (error) {
      return {
        actions: [],
        reasoning: `Streaming error: ${error instanceof Error ? error.message : String(error)}`,
      }
    }

    const fullText = chunks.join('')
    if (!fullText || fullText.trim().length === 0) {
      return { actions: [], reasoning: 'Empty streaming response' }
    }

    try {
      const parsed = JSON.parse(fullText)
      return StructuredOutputValidator.validate(parsed)
    } catch {
      return { actions: [], reasoning: 'Failed to parse streaming response as JSON' }
    }
  }
}