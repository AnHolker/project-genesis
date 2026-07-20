import type { PipelineContext } from './PipelineContext'

export interface Pipeline {
  execute(context: PipelineContext): Promise<PipelineContext>
}