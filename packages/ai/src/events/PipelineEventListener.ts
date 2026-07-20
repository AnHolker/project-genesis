import type { PipelineEvent } from './PipelineEvent'

export interface PipelineEventListener {
  onEvent(event: PipelineEvent): void
}