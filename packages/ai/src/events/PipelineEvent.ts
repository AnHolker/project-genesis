export type PipelineEventType =
  | 'PipelineStarted'
  | 'PromptBuilt'
  | 'PlannerStarted'
  | 'StreamChunk'
  | 'PlannerRetryStarted'
  | 'PlannerRetryFinished'
  | 'PlannerFinished'
  | 'PipelineFinished'

export interface PipelineEvent {
  type: PipelineEventType
  timestamp: number
  payload?: Record<string, unknown>
}