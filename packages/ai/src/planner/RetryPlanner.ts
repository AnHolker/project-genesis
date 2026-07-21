import type { PlannerResult } from './PlannerResult'
import type { Planner } from './Planner'
import type { AIRequest } from '../request'
import type { PlannerProvider } from '../provider'
import { RetryPolicy } from '../retry'
import { PipelineEventEmitter } from '../events'

/**
 * RetryPlanner wraps a PlannerProvider with automatic retry logic.
 *
 * When the provider returns an invalid result (malformed JSON, schema validation
 * failure, malformed actions), RetryPlanner automatically asks the provider to
 * regenerate a corrected response by appending validation error feedback to
 * the prompt.
 *
 * Architecture:
 * - Lives **above** concrete providers (works with Mock, OpenAI, DeepSeek)
 * - Lives **inside** the AI layer (no Runtime or UI dependency)
 * - Non-recoverable errors (auth, rate limits, network) are NOT retried
 *
 * Events emitted:
 * - `PlannerRetryStarted` — before each retry attempt (payload: retryCount, validationReason)
 * - `PlannerRetryFinished` — after each retry attempt (payload: retryCount, validationReason)
 *
 * Metrics in PlannerResult.metadata:
 * - `retryCount` — number of retries performed
 * - `planningAttempts` — total attempts (initial + retries)
 * - `lastValidationError` — last validation error message
 */
export class RetryPlanner implements Planner {
  readonly events = new PipelineEventEmitter()

  constructor(
    private readonly provider: PlannerProvider,
    private readonly retryPolicy: RetryPolicy = new RetryPolicy(),
  ) {}

  async plan(request: AIRequest): Promise<PlannerResult> {
    let lastError: string | undefined
    let attempt = 0
    let currentRequest = request

    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        const result = await this.provider.complete(currentRequest)

        // Success: actions were produced
        if (result.actions.length > 0) {
          return this.withMetrics(result, {
            retryCount: attempt,
            planningAttempts: attempt + 1,
            lastValidationError: lastError,
          })
        }

        // Check if this is a recoverable validation/parse failure
        if (this.retryPolicy.isRecoverableFailure(result)) {
          lastError = result.reasoning

          if (this.retryPolicy.shouldRetry(attempt)) {
            this.emitRetryStarted(attempt + 1, lastError!)
            currentRequest = this.buildRetryRequest(currentRequest, lastError!)
            this.emitRetryFinished(attempt + 1, lastError!)
            attempt++
            continue
          }

          // Retries exhausted: return empty result with reasoning
          return this.withMetrics(
            {
              actions: [],
              reasoning: `Planning failed after ${attempt + 1} attempt(s). Last error: ${lastError}`,
            },
            {
              retryCount: attempt,
              planningAttempts: attempt + 1,
              lastValidationError: lastError,
            },
          )
        }

        // Non-recoverable result: empty actions with no error reasoning,
        // or the AI genuinely had nothing to do — return as-is
        return this.withMetrics(result, {
          retryCount: attempt,
          planningAttempts: attempt + 1,
          lastValidationError: lastError,
        })
      } catch (error) {
        // Provider threw an error
        const errorMsg = error instanceof Error ? error.message : String(error)

        if (this.retryPolicy.shouldRetry(attempt, error)) {
          this.emitRetryStarted(attempt + 1, errorMsg)
          this.emitRetryFinished(attempt + 1, errorMsg)
          attempt++
          continue
        }

        // Non-recoverable error — re-throw
        throw error
      }
    }
  }

  private emitRetryStarted(retryCount: number, validationReason: string): void {
    this.events.emit({
      type: 'PlannerRetryStarted',
      timestamp: Date.now(),
      payload: { retryCount, validationReason },
    })
  }

  private emitRetryFinished(retryCount: number, validationReason: string): void {
    this.events.emit({
      type: 'PlannerRetryFinished',
      timestamp: Date.now(),
      payload: { retryCount, validationReason },
    })
  }

  private buildRetryRequest(original: AIRequest, errorMessage: string): AIRequest {
    return {
      ...original,
      prompt: `${original.prompt}\n\nThe previous planning attempt failed.\nValidation error:\n${errorMessage}\nPlease regenerate a valid JSON plan correcting this error. Do NOT include any text outside the JSON object.`,
    }
  }

  private withMetrics(
    result: PlannerResult,
    metrics: {
      retryCount: number
      planningAttempts: number
      lastValidationError?: string
    },
  ): PlannerResult {
    return {
      ...result,
      metadata: {
        ...result.metadata,
        retryCount: metrics.retryCount,
        planningAttempts: metrics.planningAttempts,
        ...(metrics.lastValidationError
          ? { lastValidationError: metrics.lastValidationError }
          : {}),
      },
    }
  }
}