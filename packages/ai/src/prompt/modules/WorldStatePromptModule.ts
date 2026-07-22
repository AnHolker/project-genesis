import type { PromptModule } from './PromptModule'
import type { PipelineContext } from '../../pipeline'
import type { PromptContext } from '../PromptContext'

export class WorldStatePromptModule implements PromptModule {
  async build(context: PipelineContext): Promise<string> {
    if (!context.worldState) return ''

    const entities = context.worldState.trim()
    if (entities.length === 0) return ''

    return `Current World:\n\n${entities}`
  }

  async buildContext(context: PipelineContext): Promise<Partial<PromptContext>> {
    const text = await this.build(context)
    return { worldState: text || undefined }
  }
}