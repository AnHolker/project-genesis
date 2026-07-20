# ADR-0005: PlannerResult

**Status:** Accepted  
**Date:** Sprint 1  
**Architecture Version:** v0.3  

---

## Context

`Planner.plan()` originally returned `Promise<Action[]>` — a bare array of actions.

While sufficient for the mock planner, LLM integrations typically produce additional information alongside actions:
- Chain-of-thought reasoning
- Confidence scores
- Tool usage metadata
- Partial or streaming results
- Error information

Returning a bare array provides no room for this metadata. Changing the return type later would break all consumers.

---

## Decision

Introduce a `PlannerResult` wrapper type:

```typescript
interface PlannerResult {
  actions: Action[]
  reasoning?: string
  metadata?: Record<string, unknown>
}
```

`Planner.plan()` now returns `Promise<PlannerResult>`.

MockPlanner returns `{ actions: [...] }` without optional fields.

Consumers use:

```typescript
const result = await planner.plan(input)
runtime.applyActions(result.actions)
```

---

## Consequences

**Positive:**
- LLM planners can attach reasoning, metadata, and other data
- Zero cost for mock planner (optional fields omitted)
- Backward-compatible — adding fields to PlannerResult does not break consumers
- Type-safe metadata via `Record<string, unknown>`
- Minimal API surface: only three fields

**Negative:**
- Additional wrapping: consumers must access `result.actions` instead of using the array directly
- Slightly more verbose for the simple case

**Neutral:**
- No runtime overhead for optional fields
- `reasoning` and `metadata` are purely opt-in