import type { PromptModule } from './PromptModule'
import type { PipelineContext } from '../../pipeline'

export class UserInputModule implements PromptModule {
  async build(context: PipelineContext): Promise<string> {
    return context.input
  }
}