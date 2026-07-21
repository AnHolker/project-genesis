import type { StreamingPlannerProvider } from './StreamingPlannerProvider'
import type { PlannerProvider } from './PlannerProvider'
import type { AIRequest } from '../request'
import type { PlannerResult } from '../planner'

/**
 * MockStreamingProvider simulates streaming a JSON response character by character.
 *
 * The simulated response represents the standard PlannerResult JSON format
 * for a tree creation action.
 *
 * This provider is useful for:
 * - Testing streaming behavior in the AI pipeline
 * - UI development for progressive rendering
 * - Verifying iterator lifecycle (close, cancellation, etc.)
 */
export class MockStreamingProvider implements PlannerProvider, StreamingPlannerProvider {
  /**
   * Simulated JSON response that will be streamed character by character.
   */
  private readonly simulatedResponse =
    '{"actions":[{"type":"CreateEntity","entityType":"tree","x":5,"y":3}]}'

  async complete(_request: AIRequest): Promise<PlannerResult> {
    const trimmed = _request.prompt.trim()

    if (trimmed.includes('tree') || trimmed.includes('树')) {
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

    if (trimmed.includes('move') || trimmed.includes('移动')) {
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

  async *stream(_request: AIRequest): AsyncIterable<string> {
    // Simulate streaming the JSON response character by character
    for (const char of this.simulatedResponse) {
      yield char
    }
  }
}