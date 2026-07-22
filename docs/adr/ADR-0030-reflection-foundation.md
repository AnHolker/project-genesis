# ADR-0030: Reflection Foundation

**Status:** Accepted  
**Date:** Sprint 3  
**Work Order:** WO-S3-013  
**Architecture Version:** v0.17

---

## Context

After WO-S3-012 (Planner Observation Awareness), the AgentLoop has full structured context: `Observation[]`, `LoopStep[]`, and `PlannerResult`. However, there is no mechanism to **evaluate** the current planning state — to answer questions like:

- "Is the current plan making progress?"
- "Should the loop continue or stop?"
- "Are we stuck in a loop?"

Reflection is a prerequisite for future capabilities:
- LLM Self-Critique (re-plan when plan is flawed)
- Autonomous Agent (decide when to stop based on progress)
- Context Compression (decide what to summarize)
- Memory Ranking (evaluate which observations matter)

### Constraints

1. **Independent capability** — Reflection must not depend on Runtime, Renderer, Provider, or Planner
2. **No behavior change** — Reflection results are recorded but do NOT affect current AgentLoop behavior
3. **No Planner/Provider modifications** — Planner interface, PlannerProvider, ToolCallPlanner, RetryPlanner unchanged
4. **No Pipeline modifications** — Pipeline.execute() and stream() unchanged
5. **No Tool interface changes** — Tool interface unchanged
6. **Backward compatible** — all existing tests continue passing without modification
7. **YAGNI** — do not implement LLM reflection, auto re-plan, context compression, memory ranking, or autonomous agent behavior

---

## Decision

### 1. New Module: `packages/ai/src/reflection/`

```
packages/ai/src/reflection/
  Reflection.ts           ← Interface
  ReflectionContext.ts    ← Context type
  ReflectionResult.ts     ← Result type
  DefaultReflection.ts    ← Simple rule-based implementation
  index.ts                ← Barrel export
```

### 2. Reflection Interface

```typescript
interface Reflection {
  execute(context: ReflectionContext): Promise<ReflectionResult>
}
```

- Single responsibility: evaluate planning state, produce judgment
- No Runtime, Renderer, Provider, or Planner dependency
- Observational only — reads state, does not mutate

### 3. ReflectionContext

```typescript
interface ReflectionContext {
  plannerResult: PlannerResult
  observations: Observation[]
  steps: LoopStep[]
  iteration: number
  maxIterations: number
  metadata?: Record<string, unknown>
}
```

- Self-contained: all reflection-relevant data in one object
- Immutable: consumers should not mutate
- Extensible: `metadata` for future fields

### 4. ReflectionResult

```typescript
interface ReflectionResult {
  reasoning: string
  continueLoop: boolean
  metadata?: Record<string, unknown>
}
```

- `reasoning` — explanation of the reflection judgment
- `continueLoop` — suggested loop continuation (currently recorded, not acted upon)
- `metadata` — extensible for future fields

### 5. DefaultReflection (Simple Rules)

```typescript
class DefaultReflection implements Reflection {
  async execute(context: ReflectionContext): Promise<ReflectionResult>
}
```

Rules:
| Condition | Result |
|-----------|--------|
| `plannerResult.actions.length > 0` | `continueLoop: false` (task done) |
| `iteration >= maxIterations` | `continueLoop: false` (out of runway) |
| Otherwise | `continueLoop: true` (keep going) |

- Deterministic, testable, no side effects
- No event emission — reflection is for computation, not observability
- Can be replaced by LLM-based reflection in a future WO

### 6. AgentLoop Integration

`DefaultAgentLoop` accepts an optional `Reflection` via constructor:

```typescript
class DefaultAgentLoop implements AgentLoop {
  constructor(reflection?: Reflection) { ... }
}
```

- No change to `AgentLoopContext` — reflection is a constructor-level dependency
- After each iteration, `DefaultAgentLoop` calls `reflection.execute()` with the current state
- Results collected in `AgentLoopResult.reflectionResults?: ReflectionResult[]`
- **Reflection does NOT affect loop control** — results are recorded only

### 7. Data Flow

```
AgentLoop.execute(context)
  ↓
for iteration = 1 to maxIterations:
  ├── planner.plan(request) → PlannerResult
  ├── [tool execution, observation recording]
  ├── reflection.execute({
  │     plannerResult,
  │     observations,
  │     steps,
  │     iteration,
  │     maxIterations
  │   }) → ReflectionResult
  ├── reflectionResults.push(result)   ← recorded, not used
  └── LoopIterationFinished
  ↓
AgentLoopResult { ..., reflectionResults }
```

---

## Consequences

**Positive:**
- Reflection abstraction is established without affecting any existing code
- All 502 existing tests pass with zero modifications
- DefaultReflection provides a deterministic, testable baseline
- Future LLM reflection can be injected as a different Reflection implementation
- AgentLoopResult carries reflection results for consumers that want them
- No changes to Planner, PlannerProvider, ToolCallPlanner, RetryPlanner, Pipeline, Runtime, Renderer, Tool

**Negative:**
- DefaultReflection is intentionally trivial (simple rules)
- Reflection does not yet affect AgentLoop behavior (future WO)

**Neutral:**
- AgentLoop constructor gains an optional parameter
- AgentLoopResult gains an optional `reflectionResults` field
- ReflectionContext duplicates some state already in AgentLoop (by design — self-contained context)

---

## Future Work (Not Implemented)

| Capability | Description |
|-----------|-------------|
| LLM Reflection | Replace DefaultReflection with LLM self-critique |
| Auto Re-plan | Use reflection result to trigger re-planning |
| Context Compression | Use reflection to decide what to summarize |
| Memory Ranking | Use reflection to evaluate observation importance |
| Autonomous Agent | Use reflection for stop/continue decisions |

---

## References

- ADR-0027: Multi-Step Agent Loop
- ADR-0028: Structured Observation Context
- ADR-0029: Planner Observation Awareness
- WO-S3-010: Multi-Step Agent Loop
- WO-S3-011: Structured Observation Context
- WO-S3-012: Planner Observation Awareness
- WO-S3-013: Reflection Foundation (this Work Order)