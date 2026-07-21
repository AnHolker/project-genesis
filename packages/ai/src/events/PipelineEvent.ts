export type PipelineEventType =
  | 'PipelineStarted'
  | 'PromptBuilt'
  | 'PlannerStarted'
  | 'StreamChunk'
  | 'PlannerFinished'
  | 'PipelineFinished'

export interface PipelineEvent {
  type: PipelineEventType
  timestamp: number
  payload?: Record<string, unknown>
}