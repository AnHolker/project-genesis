import type { PromptModule } from './PromptModule'
import type { PipelineContext } from '../../pipeline'

export class WorldStatePromptModule implements PromptModule {
  async build(context: PipelineContext): Promise<string> {
    if (!context.worldState) return ''

    const entities = context.worldState.trim()
    if (entities.length === 0) return ''

    return `Current World:\n\n${entities}`
  }
}