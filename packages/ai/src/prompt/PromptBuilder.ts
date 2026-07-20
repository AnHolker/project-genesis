import type { AIRequest } from '../request'
import type { PipelineContext } from '../pipeline'

export interface PromptBuilder {
  build(context: PipelineContext): Promise<AIRequest>
}