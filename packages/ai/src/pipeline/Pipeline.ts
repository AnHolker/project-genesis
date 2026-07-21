import type { PipelineContext } from './PipelineContext'

export interface Pipeline {
  execute(context: PipelineContext): Promise<PipelineContext>

  /**
   * Execute the pipeline in streaming mode.
   *
   * Unlike execute(), stream() emits StreamChunk events while the provider
   * generates the response incrementally. The final PipelineContext contains
   * the exact same PlannerResult as execute() would produce.
   *
   * If the underlying provider does not support streaming, this method
   * gracefully falls back to a non-streaming completion. No StreamChunk
   * events are emitted in that case.
   */
  stream(context: PipelineContext): Promise<PipelineContext>
}