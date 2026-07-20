import type { PlannerProvider } from './PlannerProvider'
import type { AIRequest } from '../request'
import type { PlannerResult } from '../planner'
import type { AIConfiguration } from '../config'

export class MockPlannerProvider implements PlannerProvider {
  constructor(private readonly config: AIConfiguration) {}
  async complete(request: AIRequest): Promise<PlannerResult> {
    const trimmed = request.prompt.trim()

    if (trimmed.includes('树') || trimmed.includes('tree')) {
      return {
        actions: [
          {
            type: 'CreateEntity',
            entityType: 'tree',
            x: 5,
            y: 3,
          },
        ],
      }
    }

    if (trimmed.includes('移动') || trimmed.includes('move')) {
      return {
        actions: [
          {
            type: 'MoveEntity',
            id: 'entity-1',
            x: 7,
            y: 3,
          },
        ],
      }
    }

    return { actions: [] }
  }
}