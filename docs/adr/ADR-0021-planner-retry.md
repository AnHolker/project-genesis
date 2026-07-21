# ADR-0021: Planner Retry & Self-Healing

**Status:** Accepted  
**Date:** Sprint 3  
**Work Order:** WO-S3-004  
**Architecture Version:** v0.9

---

## Context

When an LLM provider returns a malformed response (invalid JSON, schema validation failure, malformed actions), the pipeline previously returned `{ actions: [], reasoning: "..." }` with no retry attempt. The user would see "Applied 0 action(s)" with no way to recover.

Without a retry mechanism:

1. **Transient LLM failures are invisible** — A one-off invalid JSON response results in an empty action list. The user sees a failed response with no explanation.
2. **No feedback loop** — The LLM is not told that its output was invalid, so it has no chance to correct itself.
3. **Provider error handling is duplicated** — Each provider catches errors and returns `{ actions: [] }` with different reasoning strings. There's no unified retry layer.

### Constraints

1. Retry must remain **inside the AI layer** — no Runtime or UI dependency.
2. Retry must work **above concrete providers** — Mock, OpenAI, and DeepSeek share the same retry logic without code duplication.
3. The `PlannerProvider` interface must not change — providers remain pure API adapters.

---

## Decision

### 1. RetryPolicy — Reusable retry configuration

A standalone `RetryPolicy` class defines when to retry:

```typescript
class RetryPolicy {
  readonly maxRetries: number  // default: 2

  isRecoverableError(error: unknown): boolean
  isRecoverableFailure(result: PlannerResult): boolean
  shouldRetry(attempt: number, error?: unknown): boolean
}
```

- **Recoverable failures**: invalid JSON (`"Failed to parse response as JSON"`), schema validation errors (`"Discarded 1 invalid action(s): MoveEntity.id must be a string"`), malformed actions.
- **Non-recoverable errors**: authentication failures (401), invalid API key, rate limits (429), network errors (ENOTFOUND, ECONNREFUSED).
- **Non-recoverable results**: empty actions with no reasoning (LLM genuinely had nothing to do), or empty actions with non-error reasoning (e.g., `"No actions needed"`).

### 2. RetryPlanner — Retry wrapper implementing Planner

`RetryPlanner` implements `Planner` and wraps a `PlannerProvider`:

```typescript
class RetryPlanner implements Planner {
  readonly events = new PipelineEventEmitter()

  constructor(
    private readonly provider: PlannerProvider,
    private readonly retryPolicy: RetryPolicy = new RetryPolicy(),
  ) {}

  async plan(request: AIRequest): Promise<PlannerResult>
}
```

**Retry flow:**

1. Call `this.provider.complete(request)`
2. If `result.actions.length > 0` → success, return immediately
3. If `retryPolicy.isRecoverableFailure(result)` → recoverable:
   - If `shouldRetry(attempt)`: append validation error feedback to the prompt, retry
   - If retries exhausted: return `{ actions: [], reasoning: "Planning failed after N attempts..." }`
4. If not recoverable (empty actions, no error) → return as-is (LLM genuinely produced nothing)
5. If provider throws a non-recoverable error (auth, rate limit) → re-throw

### 3. Retry Events

Two new event types added to `PipelineEventType`:

```typescript
type PipelineEventType =
  | ...
  | 'PlannerRetryStarted'
  | 'PlannerRetryFinished'
```

Payload includes `retryCount` and `validationReason`. Events are emitted before and after each retry attempt.

### 4. Metrics in PlannerResult.metadata

Each `PlannerResult` returned by `RetryPlanner` includes:

```typescript
metadata: {
  retryCount: number           // number of retries performed
  planningAttempts: number     // total calls to provider (initial + retries)
  lastValidationError?: string // last validation error (omitted if no retry needed)
}
```

### 5. Provider Independence

`RetryPlanner` operates at the `Planner` level, above all concrete providers:
- `new RetryPlanner(new MockPlannerProvider(config))`
- `new RetryPlanner(new OpenAIPlannerProvider(config))`
- `new RetryPlanner(new DeepSeekPlannerProvider(config))`

No provider modification needed.

### 6. Why not retry in the Pipeline?

Retry was deliberately placed in the `Planner` layer, not `Pipeline`:

- Pipeline orchestrates the full flow (PromptBuilder → Planner → events). Retry is a planning concern.
- Keeping retry in Planner preserves the Pipeline as a simple orchestrator.
- `Planner` was already established as the orchestration layer for providers (ADR-0012).

### 7. Why not retry in concrete providers?

- Would duplicate retry logic across Mock, OpenAI, and DeepSeek providers.
- Providers should remain pure API adapters — they call an API and return a result.
- The `PlannerProvider` interface would need to change to support retry configuration.

---

## Consequences

**Positive:**
- LLM malformed responses are automatically retried with corrective feedback
- Provider-independent — works with Mock, OpenAI, DeepSeek without code duplication
- No changes to `PlannerProvider` interface or any concrete provider
- Retry events provide observability into the retry lifecycle
- Metrics enable monitoring of retry frequency and effectiveness
- Non-recoverable errors (auth, rate limits) are not retried — no wasted API calls
- Configurable `maxRetries` — testable with different configurations

**Negative:**
- Slight latency increase for requests that require retries (the LLM is called again)
- `RetryPlanner` adds indirection — simple first-try success paths now flow through retry logic
- The retry prompt includes validation error text, which may confuse some LLM models

**Neutral:**
- `RetryPlanner` is an optional component — existing code can use `MockPlanner` directly (unchanged)
- `RetryPolicy` can be extended with exponential backoff or jitter without changing `RetryPlanner`
- Retry events are fire-and-forget (same as Pipeline events) — no component is required to listen

---

## Files Changed

| File | Change |
|------|--------|
| `packages/ai/src/retry/RetryPolicy.ts` | New — retry policy with recoverability checks |
| `packages/ai/src/retry/index.ts` | New — barrel export |
| `packages/ai/src/planner/RetryPlanner.ts` | New — retry wrapper implementing Planner |
| `packages/ai/src/events/PipelineEvent.ts` | Modified — added `PlannerRetryStarted`, `PlannerRetryFinished` |
| `packages/ai/src/planner/index.ts` | Modified — added `RetryPlanner` export |
| `packages/ai/src/index.ts` | Modified — added `RetryPolicy` export |
| `packages/ai/src/__tests__/RetryPlanner.test.ts` | New — 50 tests |
| `docs/project/CHANGELOG.md` | Modified — added WO-S3-004 entry |
| `docs/project/PROJECT_STATE.md` | Modified — updated status, completed work orders, architecture diagram |
| `docs/project/AI_ARCHITECTURE.md` | Modified — added RetryPlanner to architecture diagrams |
| `docs/project/TECH_DEBT.md` | Modified — marked "Provider Retry Policy Absent" as resolved |
| `docs/adr/ADR-0021-planner-retry.md` | New — this document |

---

## Test Summary

| Category | Count |
|----------|-------|
| Success on first try | 3 |
| Invalid JSON → retry → success | 4 |
| Invalid action → retry → success | 3 |
| Retry exhausted | 3 |
| Provider error → no retry | 4 |
| Max retry respected | 2 |
| Metrics | 5 |
| Event ordering | 3 |
| Non-recoverable empty result | 2 |
| Recoverable provider throw | 2 |
| Edge cases | 3 |
| RetryPolicy unit tests | 16 |
| **Total Retry tests** | **50** |
| **All existing tests** | **95** |
| **Grand total (all passing)** | **145** |

Existing tests continue to pass with zero modifications.