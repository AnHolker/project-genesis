import type { PipelineContext } from '../../pipeline'

export interface PromptModule {
  build(context: PipelineContext): Promise<string>
}