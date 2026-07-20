import type { PromptBuilder } from './PromptBuilder'
import type { PromptModule } from './modules'
import type { PipelineContext } from '../pipeline'
import type { AIRequest } from '../request'

export class DefaultPromptBuilder implements PromptBuilder {
  constructor(private readonly modules: PromptModule[]) {}

  async build(context: PipelineContext): Promise<AIRequest> {
    const fragments = await Promise.all(
      this.modules.map((m) => m.build(context)),
    )
    return {
      prompt: fragments.join('\n'),
    }
  }
}