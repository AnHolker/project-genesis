import type { Action } from '@genesis/shared'

export interface PlannerResult {
  actions: Action[]
  reasoning?: string
  metadata?: Record<string, unknown>
}