import type { AIRequest } from '../request'
import type { PlannerResult } from '../planner'

export interface PlannerProvider {
  complete(request: AIRequest): Promise<PlannerResult>
}