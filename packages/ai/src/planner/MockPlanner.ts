import type { PlannerResult } from './PlannerResult'
import type { Planner } from './Planner'
import type { AIRequest } from '../request'
import type { PlannerProvider } from '../provider'

export class MockPlanner implements Planner {
  constructor(private readonly provider: PlannerProvider) {}

  async plan(request: AIRequest): Promise<PlannerResult> {
    return this.provider.complete(request)
  }
}