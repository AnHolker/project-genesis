export type PipelineEventType =
  | 'PipelineStarted'
  | 'PromptBuilt'
  | 'PlannerStarted'
  | 'StreamChunk'
  | 'PlannerRetryStarted'
  | 'PlannerRetryFinished'
  | 'ToolCallStarted'
  | 'ToolCallFinished'
  | 'PlannerFinished'
  | 'PipelineFinished'
  | 'AgentLoopStarted'
  | 'LoopIterationStarted'
  | 'LoopIterationFinished'
  | 'AgentLoopFinished'

export interface PipelineEvent {
  type: PipelineEventType
  timestamp: number
  payload?: Record<string, unknown>
}