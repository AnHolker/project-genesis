import type { PlannerResult } from '../planner'
import type { Memory } from '../memory'

export interface PipelineContext {
  input: string
  plannerResult?: PlannerResult
  memory?: Memory
  worldState?: string
  metadata?: Record<string, unknown>
}