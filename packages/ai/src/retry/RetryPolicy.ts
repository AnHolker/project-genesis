import type { PlannerResult } from '../planner'

export const DEFAULT_MAX_RETRIES = 2

export interface RetryPolicyConfig {
  maxRetries?: number
}

/**
 * RetryPolicy defines when and how to retry a planner provider call.
 *
 * It distinguishes between:
 * - **Recoverable** failures: invalid JSON, schema validation failure, malformed actions.
 *   These can be fixed by asking the LLM to regenerate with error feedback.
 * - **Non-recoverable** failures: authentication errors, invalid API key,
 *   network unavailable, rate limit exceeded. These won't be fixed by retrying.
 */
export class RetryPolicy {
  readonly maxRetries: number

  constructor(config?: RetryPolicyConfig) {
    this.maxRetries = config?.maxRetries ?? DEFAULT_MAX_RETRIES
  }

  /**
   * Returns true if the error is recoverable (retryable).
   * Non-recoverable: auth errors, rate limits, network failures.
   */
  isRecoverableError(error: unknown): boolean {
    if (!(error instanceof Error)) return true
    const msg = error.message.toLowerCase()

    if (
      msg.includes('401') ||
      msg.includes('auth') ||
      msg.includes('api key') ||
      msg.includes('rate limit') ||
      msg.includes('429') ||
      msg.includes('network') ||
      msg.includes('econnrefused') ||
      msg.includes('enotfound') ||
      msg.includes('timeout') ||
      msg.includes('bad request')
    ) {
      return false
    }
    return true
  }

  /**
   * Returns true if the planner result indicates a recoverable validation failure.
   *
   * A result is considered recoverable when:
   * - `actions` is empty (no valid actions were produced)
   * - `reasoning` contains known parse/validation error patterns
   */
  isRecoverableFailure(result: PlannerResult): boolean {
    if (result.actions.length > 0) return false
    if (!result.reasoning) return false

    const r = result.reasoning.toLowerCase()
    return (
      r.includes('failed to parse') ||
      r.includes('not an object') ||
      r.includes('not an array') ||
      r.includes('not a string') ||
      r.includes('not a number') ||
      r.includes('discarded') ||
      r.includes('must be')
    )
  }

  /**
   * Returns true if the planner should retry given the current attempt number.
   * attempt is 0-based (first call = attempt 0).
   */
  shouldRetry(attempt: number, _error?: unknown): boolean {
    if (_error && !this.isRecoverableError(_error)) return false
    return attempt < this.maxRetries
  }
}