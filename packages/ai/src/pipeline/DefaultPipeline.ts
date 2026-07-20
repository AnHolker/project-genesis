import type { Planner } from '../planner'
import type { PromptBuilder } from '../prompt'
import type { Pipeline } from './Pipeline'
import type { PipelineContext } from './PipelineContext'
import { PipelineEventEmitter } from '../events'

export class DefaultPipeline implements Pipeline {
  readonly events = new PipelineEventEmitter()

  constructor(
    private readonly planner: Planner,
    private readonly promptBuilder: PromptBuilder,
  ) {}

  async execute(context: PipelineContext): Promise<PipelineContext> {
    this.events.emit({ type: 'PipelineStarted', timestamp: Date.now() })

    const request = await this.promptBuilder.build(context)
    this.events.emit({ type: 'PromptBuilt', timestamp: Date.now(), payload: { prompt: request.prompt } })

    this.events.emit({ type: 'PlannerStarted', timestamp: Date.now() })
    const plannerResult = await this.planner.plan(request)
    this.events.emit({ type: 'PlannerFinished', timestamp: Date.now() })

    const result = { ...context, plannerResult }
    this.events.emit({ type: 'PipelineFinished', timestamp: Date.now() })
    return result
  }
}