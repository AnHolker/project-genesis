import type { PlannerResult } from './PlannerResult'
import type { AIRequest } from '../request'

export interface Planner {
  plan(request: AIRequest): Promise<PlannerResult>
}