import type { PromptModule } from './PromptModule'
import type { PipelineContext } from '../../pipeline'
import type { PromptContext } from '../PromptContext'

export class UserInputModule implements PromptModule {
  async build(context: PipelineContext): Promise<string> {
    return context.input
  }

  async buildContext(context: PipelineContext): Promise<Partial<PromptContext>> {
    return { userInput: context.input }
  }
}