# ADR-0031: Reflection Prompt Integration

**Status:** Accepted  
**Date:** Sprint 3  
**Work Order:** WO-S3-014  
**Architecture Version:** v0.17

---

## Context

After WO-S3-013 (Reflection Foundation), the AgentLoop can produce `ReflectionResult[]` via the `Reflection` interface. These results are recorded in `AgentLoopResult.reflectionResults` but are **not** included in the prompt — the Planner never sees them.

To make reflection results visible to the planning process, they must be formatted as prompt text. Per the architecture (ADR-0008, ADR-0009), all prompt text generation is the responsibility of `PromptBuilder` via `PromptModule` implementations.

### Constraints

1. **PromptBuilder is the only Prompt organizer** — no component may format reflection text inline
2. **New context must be added as PromptModule** — no if/else chains in PromptBuilder
3. **Each PromptModule must be independent** — composable, testable, pluggable, closable
4. **PromptBuilder must not depend on AgentLoop** — maintains one-way dependency direction
5. **AgentLoop only maintains state** — records reflectionResults, does not format them
6. **Backward compatible** — all existing tests continue passing without modification
7. **No Planner, Pipeline interface, or AgentLoop interface changes** — only internal implementations

---

## Decision

### 1. New Module: `packages/ai/src/prompt/modules/ReflectionPromptModule.ts`

```
packages/ai/src/prompt/modules/
  ReflectionPromptModule.ts    ← NEW
```

Implements `PromptModule` interface:

```typescript
class ReflectionPromptModule implements PromptModule {
  async build(context: PipelineContext): Promise<string>
}
```

- Reads `PipelineContext.metadata?.reflectionResults`
- Returns empty string when no reflection results exist
- Delegates formatting to shared `formatReflectionResults()` function

### 2. formatReflectionResults Function

Shared formatting function (same pattern as `formatObservations` / `formatObservationsInline`):

```typescript
function formatReflectionResults(results: ReflectionResult[]): string
```

Output format:

```
## Previous Reflection

Iteration 1

Reasoning:
Actions found — task complete

Continue:
false

Iteration 2

Reasoning:
No actions yet, continuing

Continue:
true
```

- Empty array → returns empty string
- Each iteration is numbered sequentially (1-based)
- `reasoning` and `continueLoop` fields included
- `metadata` on ReflectionResult is excluded from prompt (future use)

### 3. PromptBuilder Integration

`DefaultPromptBuilder` gains a `formatReflectionResults()` instance method:

```typescript
class DefaultPromptBuilder implements PromptBuilder {
  formatReflectionResults(results: ReflectionResult[]): string
}
```

- Delegates to the shared `formatReflectionResults()` function
- Follows the same pattern as `formatObservations()`
- Provides a canonical API for any component needing reflection formatting

The module is included in the PromptBuilder module array at composition time:

```typescript
new DefaultPromptBuilder([
  new SystemPromptModule(),
  new UserInputModule(),
  new MemoryPromptModule(),
  new WorldStatePromptModule(),
  new ObservationPromptModule(),
  new ReflectionPromptModule(),  // ← NEW
])
```

Suggested composition order: System → Memory → Reflection → Observation → User

### 4. Pipeline Data Flow

`DefaultPipeline.execute()` and `DefaultPipeline.stream()` propagate `reflectionResults` from `AgentLoopResult` to `PipelineContext.metadata`:

```
AgentLoop.execute(context)
  ↓
AgentLoopResult { ..., reflectionResults }
  ↓
Pipeline.execute() → PipelineContext { metadata: { reflectionResults: [...] } }
  ↓ (next call)
PromptBuilder.build(context)
  ↓
ReflectionPromptModule reads context.metadata?.reflectionResults
  ↓
formatted prompt text: "## Previous Reflection\n..."
```

- Only propagates when `reflectionResults` is defined (no empty metadata mutation)
- Streaming provider path (native streaming) does not use AgentLoop → no reflection
- Streaming fallback path (non-streaming provider) uses AgentLoop → reflection propagated

### 5. Data Flow Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                     AgentLoop (iteration)                     │
│                                                              │
│  planner.plan() → PlannerResult                               │
│  ↓                                                            │
│  [tool execution, observation recording]                      │
│  ↓                                                            │
│  reflection.execute() → ReflectionResult                     │
│  ↓                                                            │
│  AgentLoopResult { reflectionResults }                       │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│                   DefaultPipeline.execute()                   │
│                                                              │
│  Extracts reflectionResults from AgentLoopResult             │
│  Writes to PipelineContext.metadata.reflectionResults        │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼ (next pipeline call)
┌──────────────────────────────────────────────────────────────┐
│                    DefaultPromptBuilder.build()               │
│                                                              │
│  Iterates PromptModule[]                                     │
│  ├── SystemPromptModule                                      │
│  ├── MemoryPromptModule                                      │
│  ├── ReflectionPromptModule ← reads metadata.reflectionResults│
│  ├── ObservationPromptModule                                 │
│  └── UserInputModule                                         │
│  ↓                                                            │
│  AIRequest { prompt composed from all modules }              │
└──────────────────────────────────────────────────────────────┘
```

---

## Consequences

**Positive:**
- Reflection results are now visible in the prompt for the Planner
- ReflectionPromptModule follows the established PromptModule pattern
- No changes to PromptBuilder's core composition logic (still a generic composer)
- All existing 536 tests pass with zero modifications
- AgentLoop does not format reflection text — delegates entirely to PromptBuilder
- PromptBuilder does not depend on AgentLoop

**Negative:**
- Reflection is only available on the NEXT pipeline call (formatted after execution)
- Streaming provider path does not produce reflection (no AgentLoop involvement)

**Neutral:**
- `DefaultPipeline.execute()` now destructures `reflectionResults` from `AgentLoopResult`
- `DefaultPipeline.stream()` returns richer context with optional `reflectionResults`
- `DefaultPipeline.streamPlannerResult()` return type changed to `{ plannerResult, reflectionResults? }`

---

## Future Work (Not Implemented)

| Capability | Description |
|-----------|-------------|
| Reflection-driven loop control | AgentLoop uses `continueLoop` from ReflectionResult |
| LLM-based Reflection | Replace DefaultReflection with LLM self-critique |
| Auto re-plan from Reflection | Trigger re-planning when reflection indicates plan is flawed |
| Context Compression | Use reflection to decide what to summarize between iterations |

---

## References

- ADR-0008: PromptBuilder
- ADR-0009: Prompt Modules
- ADR-0028: Structured Observation Context
- ADR-0029: Planner Observation Awareness
- ADR-0030: Reflection Foundation
- WO-S3-013: Reflection Foundation
- WO-S3-014: Reflection Prompt Integration (this Work Order)