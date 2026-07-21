import { describe, it, expect, vi } from 'vitest'
import { RetryPlanner } from '../planner/RetryPlanner'
import { RetryPolicy } from '../retry/RetryPolicy'
import type { PlannerProvider } from '../provider/PlannerProvider'
import type { AIRequest } from '../request'
import type { PlannerResult } from '../planner'
import type { PipelineEvent } from '../events'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a mock provider that returns a specified sequence of results.
 * Each call returns the next result from the sequence.
 */
function createSequenceProvider(results: PlannerResult[]): PlannerProvider {
  let index = 0
  return {
    async complete(_request: AIRequest): Promise<PlannerResult> {
      if (index >= results.length) {
        return { actions: [] }
      }
      return results[index++]
    },
  }
}

/**
 * Creates a mock provider that returns a single result on every call.
 */
function createFixedProvider(result: PlannerResult): PlannerProvider {
  return {
    async complete(_request: AIRequest): Promise<PlannerResult> {
      return result
    },
  }
}

/**
 * Creates a mock provider that returns an error result on the first N calls,
 * then returns a valid result.
 */
function createFailingThenSuccessProvider(
  failCount: number,
  failResult: PlannerResult,
  successResult: PlannerResult,
): PlannerProvider {
  let callCount = 0
  return {
    async complete(_request: AIRequest): Promise<PlannerResult> {
      callCount++
      if (callCount <= failCount) {
        return failResult
      }
      return successResult
    },
  }
}

/**
 * Creates a mock provider that throws on the first N calls,
 * then returns a valid result.
 */
function createThrowingThenSuccessProvider(
  throwCount: number,
  successResult: PlannerResult,
): PlannerProvider {
  let callCount = 0
  return {
    async complete(_request: AIRequest): Promise<PlannerResult> {
      callCount++
      if (callCount <= throwCount) {
        throw new Error('API error: 500 Internal Server Error')
      }
      return successResult
    },
  }
}

const validResult: PlannerResult = {
  actions: [{ type: 'CreateEntity', entityType: 'tree', x: 5, y: 3 }],
}

const parseErrorResult: PlannerResult = {
  actions: [],
  reasoning: 'Failed to parse response as JSON',
}

const validationErrorResult: PlannerResult = {
  actions: [],
  reasoning: 'Discarded 1 invalid action(s): MoveEntity.id must be a string',
}

const emptyNoActionResult: PlannerResult = {
  actions: [],
}

// ---------------------------------------------------------------------------
// RetryPlanner — Core Behavior
// ---------------------------------------------------------------------------

describe('RetryPlanner', () => {
  describe('success on first try', () => {
    it('should return the result directly when provider returns valid actions', async () => {
      const provider = createFixedProvider(validResult)
      const planner = new RetryPlanner(provider)

      const result = await planner.plan({ prompt: 'create a tree' })

      expect(result.actions).toHaveLength(1)
      expect(result.actions[0].type).toBe('CreateEntity')
    })

    it('should not emit retry events on success', async () => {
      const provider = createFixedProvider(validResult)
      const planner = new RetryPlanner(provider)

      const receivedEvents: PipelineEvent[] = []
      planner.events.subscribe({ onEvent: (e) => receivedEvents.push(e) })

      await planner.plan({ prompt: 'create a tree' })

      const retryEvents = receivedEvents.filter(
        (e) => e.type === 'PlannerRetryStarted' || e.type === 'PlannerRetryFinished',
      )
      expect(retryEvents).toHaveLength(0)
    })

    it('should set retryCount=0 and planningAttempts=1 in metadata on first-try success', async () => {
      const provider = createFixedProvider(validResult)
      const planner = new RetryPlanner(provider)

      const result = await planner.plan({ prompt: 'create a tree' })

      expect(result.metadata).toBeDefined()
      expect(result.metadata!.retryCount).toBe(0)
      expect(result.metadata!.planningAttempts).toBe(1)
      expect(result.metadata!.lastValidationError).toBeUndefined()
    })
  })

  // -----------------------------------------------------------------------
  // Retry — Invalid JSON
  // -----------------------------------------------------------------------

  describe('invalid JSON → retry → success', () => {
    it('should retry when provider returns parse error, then succeed on second attempt', async () => {
      const provider = createFailingThenSuccessProvider(1, parseErrorResult, validResult)
      const planner = new RetryPlanner(provider)

      const result = await planner.plan({ prompt: 'create a tree' })

      expect(result.actions).toHaveLength(1)
      expect(result.actions[0].type).toBe('CreateEntity')
    })

    it('should emit PlannerRetryStarted and PlannerRetryFinished events', async () => {
      const provider = createFailingThenSuccessProvider(1, parseErrorResult, validResult)
      const planner = new RetryPlanner(provider)

      const receivedEvents: PipelineEvent[] = []
      planner.events.subscribe({ onEvent: (e) => receivedEvents.push(e) })

      await planner.plan({ prompt: 'create a tree' })

      const retryStarted = receivedEvents.filter((e) => e.type === 'PlannerRetryStarted')
      const retryFinished = receivedEvents.filter((e) => e.type === 'PlannerRetryFinished')

      expect(retryStarted).toHaveLength(1)
      expect(retryFinished).toHaveLength(1)

      // Verify payloads
      expect(retryStarted[0].payload).toBeDefined()
      expect(retryStarted[0].payload!.retryCount).toBe(1)
      expect(retryStarted[0].payload!.validationReason).toBe('Failed to parse response as JSON')

      expect(retryFinished[0].payload).toBeDefined()
      expect(retryFinished[0].payload!.retryCount).toBe(1)
      expect(retryFinished[0].payload!.validationReason).toBe('Failed to parse response as JSON')
    })

    it('should set correct metrics when retry succeeds', async () => {
      const provider = createFailingThenSuccessProvider(1, parseErrorResult, validResult)
      const planner = new RetryPlanner(provider)

      const result = await planner.plan({ prompt: 'create a tree' })

      expect(result.metadata!.retryCount).toBe(1)
      expect(result.metadata!.planningAttempts).toBe(2)
      expect(result.metadata!.lastValidationError).toBe('Failed to parse response as JSON')
    })

    it('should include validation feedback in the retry request prompt', async () => {
      const completeMock = vi.fn()
      const provider: PlannerProvider = {
        async complete(request: AIRequest): Promise<PlannerResult> {
          completeMock(request.prompt)
          // Parse error on first call, success on second
          if (completeMock.mock.calls.length === 1) {
            return parseErrorResult
          }
          return validResult
        },
      }
      const planner = new RetryPlanner(provider)

      await planner.plan({ prompt: 'create a tree' })

      expect(completeMock).toHaveBeenCalledTimes(2)

      // First call: original prompt
      const firstPrompt = completeMock.mock.calls[0][0]
      expect(firstPrompt).toBe('create a tree')

      // Second call: feedback appended
      const secondPrompt = completeMock.mock.calls[1][0]
      expect(secondPrompt).toContain('create a tree')
      expect(secondPrompt).toContain('Failed to parse response as JSON')
      expect(secondPrompt).toContain('The previous planning attempt failed.')
    })
  })

  // -----------------------------------------------------------------------
  // Retry — Invalid Action
  // -----------------------------------------------------------------------

  describe('invalid action → retry → success', () => {
    it('should retry when provider returns schema validation error, then succeed', async () => {
      const provider = createFailingThenSuccessProvider(1, validationErrorResult, validResult)
      const planner = new RetryPlanner(provider)

      const result = await planner.plan({ prompt: 'create a tree' })

      expect(result.actions).toHaveLength(1)
      expect(result.actions[0].type).toBe('CreateEntity')
    })

    it('should emit retry events with validation reason for schema errors', async () => {
      const provider = createFailingThenSuccessProvider(1, validationErrorResult, validResult)
      const planner = new RetryPlanner(provider)

      const receivedEvents: PipelineEvent[] = []
      planner.events.subscribe({ onEvent: (e) => receivedEvents.push(e) })

      await planner.plan({ prompt: 'move entity' })

      const retryEvents = receivedEvents.filter((e) => e.type === 'PlannerRetryStarted')
      expect(retryEvents).toHaveLength(1)
      expect(retryEvents[0].payload!.validationReason).toContain('MoveEntity.id must be a string')
    })

    it('should set correct metrics for schema error recovery', async () => {
      const provider = createFailingThenSuccessProvider(1, validationErrorResult, validResult)
      const planner = new RetryPlanner(provider)

      const result = await planner.plan({ prompt: 'move entity' })

      expect(result.metadata!.retryCount).toBe(1)
      expect(result.metadata!.planningAttempts).toBe(2)
      expect(result.metadata!.lastValidationError).toContain('MoveEntity.id must be a string')
    })
  })

  // -----------------------------------------------------------------------
  // Retry Exhausted
  // -----------------------------------------------------------------------

  describe('retry exhausted', () => {
    it('should return empty actions after all retries are exhausted', async () => {
      const provider = createFixedProvider(parseErrorResult)
      const planner = new RetryPlanner(provider)

      const result = await planner.plan({ prompt: 'create a tree' })

      expect(result.actions).toHaveLength(0)
      expect(result.reasoning).toContain('Planning failed after')
      expect(result.reasoning).toContain('Failed to parse response as JSON')
    })

    it('should emit retry events for each retry attempt', async () => {
      const provider = createFixedProvider(parseErrorResult)
      const planner = new RetryPlanner(provider)

      const receivedEvents: PipelineEvent[] = []
      planner.events.subscribe({ onEvent: (e) => receivedEvents.push(e) })

      await planner.plan({ prompt: 'create a tree' })

      // maxRetries=2 means: 1 initial call + 2 retries = 3 total calls
      // Retries happen when attempt < maxRetries
      // Default maxRetries=2, so there should be 2 retry attempts
      const retryStarted = receivedEvents.filter((e) => e.type === 'PlannerRetryStarted')
      expect(retryStarted).toHaveLength(2)

      // Verify retry counts in payloads
      expect(retryStarted[0].payload!.retryCount).toBe(1)
      expect(retryStarted[1].payload!.retryCount).toBe(2)
    })

    it('should set correct metrics when retries exhausted', async () => {
      const provider = createFixedProvider(parseErrorResult)
      const planner = new RetryPlanner(provider)

      const result = await planner.plan({ prompt: 'create a tree' })

      expect(result.metadata!.retryCount).toBe(2)
      // First call + 2 retries = 3 attempts
      expect(result.metadata!.planningAttempts).toBe(3)
      expect(result.metadata!.lastValidationError).toBe('Failed to parse response as JSON')
    })
  })

  // -----------------------------------------------------------------------
  // Provider Error — No Retry
  // -----------------------------------------------------------------------

  describe('provider error → no retry', () => {
    it('should NOT retry non-recoverable provider errors (auth)', async () => {
      const provider: PlannerProvider = {
        async complete(_request: AIRequest): Promise<PlannerResult> {
          throw new Error('401 Authentication failed: invalid API key')
        },
      }
      const planner = new RetryPlanner(provider)

      await expect(planner.plan({ prompt: 'create a tree' })).rejects.toThrow(
        'Authentication failed',
      )
    })

    it('should NOT retry rate limit errors', async () => {
      const provider: PlannerProvider = {
        async complete(_request: AIRequest): Promise<PlannerResult> {
          throw new Error('429 Too Many Requests: rate limit exceeded')
        },
      }
      const planner = new RetryPlanner(provider)

      await expect(planner.plan({ prompt: 'create a tree' })).rejects.toThrow('rate limit')
    })

    it('should NOT retry network errors', async () => {
      const provider: PlannerProvider = {
        async complete(_request: AIRequest): Promise<PlannerResult> {
          throw new Error('ENOTFOUND api.openai.com')
        },
      }
      const planner = new RetryPlanner(provider)

      await expect(planner.plan({ prompt: 'create a tree' })).rejects.toThrow('ENOTFOUND')
    })

    it('should NOT emit retry events for non-recoverable errors', async () => {
      const provider: PlannerProvider = {
        async complete(_request: AIRequest): Promise<PlannerResult> {
          throw new Error('401 Authentication failed: invalid API key')
        },
      }
      const planner = new RetryPlanner(provider)

      const receivedEvents: PipelineEvent[] = []
      planner.events.subscribe({ onEvent: (e) => receivedEvents.push(e) })

      await expect(planner.plan({ prompt: 'create a tree' })).rejects.toThrow()

      const retryEvents = receivedEvents.filter((e) => e.type === 'PlannerRetryStarted')
      expect(retryEvents).toHaveLength(0)
    })
  })

  // -----------------------------------------------------------------------
  // Max Retry Respected
  // -----------------------------------------------------------------------

  describe('max retry respected', () => {
    it('should respect custom maxRetries = 1', async () => {
      const provider = createFixedProvider(parseErrorResult)
      const policy = new RetryPolicy({ maxRetries: 1 })
      const planner = new RetryPlanner(provider, policy)

      const receivedEvents: PipelineEvent[] = []
      planner.events.subscribe({ onEvent: (e) => receivedEvents.push(e) })

      await planner.plan({ prompt: 'create a tree' })

      // maxRetries=1: 1 initial call + 1 retry = 2 total calls
      const retryStarted = receivedEvents.filter((e) => e.type === 'PlannerRetryStarted')
      expect(retryStarted).toHaveLength(1)
    })

    it('should respect custom maxRetries = 0 (no retry)', async () => {
      const provider = createFixedProvider(parseErrorResult)
      const policy = new RetryPolicy({ maxRetries: 0 })
      const planner = new RetryPlanner(provider, policy)

      const receivedEvents: PipelineEvent[] = []
      planner.events.subscribe({ onEvent: (e) => receivedEvents.push(e) })

      const result = await planner.plan({ prompt: 'create a tree' })

      // maxRetries=0: 1 initial call, no retries
      const retryStarted = receivedEvents.filter((e) => e.type === 'PlannerRetryStarted')
      expect(retryStarted).toHaveLength(0)

      expect(result.actions).toHaveLength(0)
      expect(result.metadata!.retryCount).toBe(0)
      expect(result.metadata!.planningAttempts).toBe(1)
    })
  })

  // -----------------------------------------------------------------------
  // Metrics
  // -----------------------------------------------------------------------

  describe('metrics', () => {
    it('should include retryCount in metadata', async () => {
      const provider = createFailingThenSuccessProvider(1, parseErrorResult, validResult)
      const planner = new RetryPlanner(provider)

      const result = await planner.plan({ prompt: 'tree' })

      expect(result.metadata!.retryCount).toBe(1)
    })

    it('should include planningAttempts in metadata', async () => {
      const provider = createFailingThenSuccessProvider(1, parseErrorResult, validResult)
      const planner = new RetryPlanner(provider)

      const result = await planner.plan({ prompt: 'tree' })

      expect(result.metadata!.planningAttempts).toBe(2)
    })

    it('should include lastValidationError in metadata when retry occurred', async () => {
      const provider = createFailingThenSuccessProvider(1, parseErrorResult, validResult)
      const planner = new RetryPlanner(provider)

      const result = await planner.plan({ prompt: 'tree' })

      expect(result.metadata!.lastValidationError).toBe('Failed to parse response as JSON')
    })

    it('should not include lastValidationError in metadata when no retry', async () => {
      const provider = createFixedProvider(validResult)
      const planner = new RetryPlanner(provider)

      const result = await planner.plan({ prompt: 'tree' })

      expect(result.metadata!.lastValidationError).toBeUndefined()
    })

    it('should preserve existing metadata from provider result', async () => {
      const provider = createFixedProvider({
        ...validResult,
        metadata: { tokenCount: 150, existingField: 'keep' },
      })
      const planner = new RetryPlanner(provider)

      const result = await planner.plan({ prompt: 'tree' })

      expect(result.metadata!.tokenCount).toBe(150)
      expect(result.metadata!.existingField).toBe('keep')
      expect(result.metadata!.retryCount).toBe(0)
      expect(result.metadata!.planningAttempts).toBe(1)
    })
  })

  // -----------------------------------------------------------------------
  // Event Ordering
  // -----------------------------------------------------------------------

  describe('event ordering', () => {
    it('should emit PlannerRetryStarted before PlannerRetryFinished', async () => {
      const provider = createFailingThenSuccessProvider(1, parseErrorResult, validResult)
      const planner = new RetryPlanner(provider)

      const receivedEvents: PipelineEvent[] = []
      planner.events.subscribe({ onEvent: (e) => receivedEvents.push(e) })

      await planner.plan({ prompt: 'tree' })

      const retryEvents = receivedEvents.filter(
        (e) => e.type === 'PlannerRetryStarted' || e.type === 'PlannerRetryFinished',
      )

      expect(retryEvents).toHaveLength(2)
      expect(retryEvents[0].type).toBe('PlannerRetryStarted')
      expect(retryEvents[1].type).toBe('PlannerRetryFinished')
    })

    it('should emit events in correct order for multiple retries', async () => {
      const provider = createFixedProvider(parseErrorResult)
      const planner = new RetryPlanner(provider)

      const receivedEvents: PipelineEvent[] = []
      planner.events.subscribe({ onEvent: (e) => receivedEvents.push(e) })

      await planner.plan({ prompt: 'tree' })

      const retryEvents = receivedEvents.filter(
        (e) => e.type === 'PlannerRetryStarted' || e.type === 'PlannerRetryFinished',
      )

      // Should be: Started, Finished, Started, Finished (for 2 retries)
      expect(retryEvents).toHaveLength(4)
      expect(retryEvents[0].type).toBe('PlannerRetryStarted')
      expect(retryEvents[1].type).toBe('PlannerRetryFinished')
      expect(retryEvents[2].type).toBe('PlannerRetryStarted')
      expect(retryEvents[3].type).toBe('PlannerRetryFinished')
    })

    it('each event should have a valid timestamp', async () => {
      const provider = createFailingThenSuccessProvider(1, parseErrorResult, validResult)
      const planner = new RetryPlanner(provider)

      const receivedEvents: PipelineEvent[] = []
      planner.events.subscribe({ onEvent: (e) => receivedEvents.push(e) })

      await planner.plan({ prompt: 'tree' })

      for (const event of receivedEvents) {
        expect(event.timestamp).toBeGreaterThan(0)
      }
    })
  })

  // -----------------------------------------------------------------------
  // Non-Recoverable Result (empty actions, no error reasoning)
  // -----------------------------------------------------------------------

  describe('non-recoverable empty result', () => {
    it('should NOT retry when provider returns empty actions with no reasoning', async () => {
      const provider = createFixedProvider(emptyNoActionResult)
      const planner = new RetryPlanner(provider)

      const receivedEvents: PipelineEvent[] = []
      planner.events.subscribe({ onEvent: (e) => receivedEvents.push(e) })

      const result = await planner.plan({ prompt: 'hello world' })

      expect(result.actions).toHaveLength(0)
      expect(result.reasoning).toBeUndefined()

      const retryEvents = receivedEvents.filter((e) => e.type === 'PlannerRetryStarted')
      expect(retryEvents).toHaveLength(0)
    })

    it('should NOT retry when provider returns empty actions with non-error reasoning', async () => {
      const provider = createFixedProvider({
        actions: [],
        reasoning: 'No actions needed for this request',
      })
      const planner = new RetryPlanner(provider)

      const receivedEvents: PipelineEvent[] = []
      planner.events.subscribe({ onEvent: (e) => receivedEvents.push(e) })

      const result = await planner.plan({ prompt: 'hello' })

      expect(result.actions).toHaveLength(0)
      expect(result.reasoning).toBe('No actions needed for this request')

      const retryEvents = receivedEvents.filter((e) => e.type === 'PlannerRetryStarted')
      expect(retryEvents).toHaveLength(0)
    })
  })

  // -----------------------------------------------------------------------
  // Recoverable provider error (throw then retry)
  // -----------------------------------------------------------------------

  describe('recoverable provider throw', () => {
    it('should retry when provider throws a recoverable error then succeeds', async () => {
      const provider = createThrowingThenSuccessProvider(1, validResult)
      const planner = new RetryPlanner(provider)

      const result = await planner.plan({ prompt: 'create a tree' })

      expect(result.actions).toHaveLength(1)
      expect(result.actions[0].type).toBe('CreateEntity')
    })

    it('should emit retry events when provider throws recoverable error', async () => {
      const provider = createThrowingThenSuccessProvider(1, validResult)
      const planner = new RetryPlanner(provider)

      const receivedEvents: PipelineEvent[] = []
      planner.events.subscribe({ onEvent: (e) => receivedEvents.push(e) })

      await planner.plan({ prompt: 'create a tree' })

      const retryEvents = receivedEvents.filter((e) => e.type === 'PlannerRetryStarted')
      expect(retryEvents).toHaveLength(1)
      expect(retryEvents[0].payload!.validationReason).toContain('500 Internal Server Error')
    })
  })

  // -----------------------------------------------------------------------
  // Edge Cases
  // -----------------------------------------------------------------------

  describe('edge cases', () => {
    it('should work with MockPlannerProvider when it returns valid results', async () => {
      const { MockPlannerProvider } = await import('../provider/MockPlannerProvider')
      const { DefaultAIConfiguration } = await import('../config/DefaultAIConfiguration')
      const provider = new MockPlannerProvider(new DefaultAIConfiguration())
      const planner = new RetryPlanner(provider)

      const result = await planner.plan({ prompt: 'create a tree' })

      expect(result.actions).toHaveLength(1)
      expect(result.actions[0].type).toBe('CreateEntity')
      expect(result.metadata!.retryCount).toBe(0)
      expect(result.metadata!.planningAttempts).toBe(1)
    })

    it('should handle empty prompt gracefully', async () => {
      const provider = createFixedProvider(emptyNoActionResult)
      const planner = new RetryPlanner(provider)

      const result = await planner.plan({ prompt: '' })

      expect(result.actions).toHaveLength(0)
      expect(result.metadata!.retryCount).toBe(0)
      expect(result.metadata!.planningAttempts).toBe(1)
    })

    it('should set correct metrics on multiple retries with different validation reasons', async () => {
      // Sequence: parse error, validation error, then success
      const provider = createSequenceProvider([
        parseErrorResult,
        validationErrorResult,
        validResult,
      ])
      const planner = new RetryPlanner(provider)

      const result = await planner.plan({ prompt: 'do something' })

      expect(result.actions).toHaveLength(1)
      expect(result.metadata!.retryCount).toBe(2)
      expect(result.metadata!.planningAttempts).toBe(3)
      // Last validation error should be the validation error (second failure)
      expect(result.metadata!.lastValidationError).toContain('MoveEntity.id must be a string')
    })
  })

  // -----------------------------------------------------------------------
  // RetryPolicy unit tests
  // -----------------------------------------------------------------------

  describe('RetryPolicy', () => {
    describe('isRecoverableError', () => {
      const policy = new RetryPolicy()

      it('should return false for auth errors', () => {
        expect(policy.isRecoverableError(new Error('401 Auth failed'))).toBe(false)
        expect(policy.isRecoverableError(new Error('invalid API key'))).toBe(false)
      })

      it('should return false for rate limit errors', () => {
        expect(policy.isRecoverableError(new Error('429 rate limit'))).toBe(false)
      })

      it('should return false for network errors', () => {
        expect(policy.isRecoverableError(new Error('ENOTFOUND'))).toBe(false)
        expect(policy.isRecoverableError(new Error('ECONNREFUSED'))).toBe(false)
      })

      it('should return true for server errors', () => {
        expect(policy.isRecoverableError(new Error('500 Internal Server Error'))).toBe(true)
      })

      it('should return true for generic errors', () => {
        expect(policy.isRecoverableError(new Error('Something went wrong'))).toBe(true)
      })
    })

    describe('isRecoverableFailure', () => {
      const policy = new RetryPolicy()

      it('should return true for parse errors', () => {
        expect(policy.isRecoverableFailure(parseErrorResult)).toBe(true)
      })

      it('should return true for schema validation errors', () => {
        expect(policy.isRecoverableFailure(validationErrorResult)).toBe(true)
      })

      it('should return true for "not an object" errors', () => {
        expect(
          policy.isRecoverableFailure({
            actions: [],
            reasoning: 'Response is not an object',
          }),
        ).toBe(true)
      })

      it('should return true for "not an array" errors', () => {
        expect(
          policy.isRecoverableFailure({
            actions: [],
            reasoning: 'actions must be an array',
          }),
        ).toBe(true)
      })

      it('should return false when actions are present', () => {
        expect(policy.isRecoverableFailure(validResult)).toBe(false)
      })

      it('should return false when reasoning is absent', () => {
        expect(policy.isRecoverableFailure(emptyNoActionResult)).toBe(false)
      })

      it('should return false for empty actions with non-error reasoning', () => {
        expect(
          policy.isRecoverableFailure({
            actions: [],
            reasoning: 'No actions needed for this request',
          }),
        ).toBe(false)
      })
    })

    describe('shouldRetry', () => {
      it('should allow retry when attempt < maxRetries and no error', () => {
        const policy = new RetryPolicy({ maxRetries: 2 })
        expect(policy.shouldRetry(0)).toBe(true)
        expect(policy.shouldRetry(1)).toBe(true)
        expect(policy.shouldRetry(2)).toBe(false)
      })

      it('should not retry when maxRetries = 0', () => {
        const policy = new RetryPolicy({ maxRetries: 0 })
        expect(policy.shouldRetry(0)).toBe(false)
      })

      it('should not retry non-recoverable errors', () => {
        const policy = new RetryPolicy({ maxRetries: 2 })
        expect(policy.shouldRetry(0, new Error('401 Auth failed'))).toBe(false)
      })

      it('should retry recoverable errors', () => {
        const policy = new RetryPolicy({ maxRetries: 2 })
        expect(policy.shouldRetry(0, new Error('500 Server Error'))).toBe(true)
      })
    })
  })
})