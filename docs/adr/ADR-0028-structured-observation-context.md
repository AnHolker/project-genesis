# ADR-0028: Structured Observation Context

**Status:** Accepted  
**Date:** Sprint 3  
**Work Order:** WO-S3-011  
**Architecture Version:** v0.15

---

## Context

After WO-S3-010 (Multi-Step Agent Loop), tool observations were converted to plain strings and appended to the request prompt:

```
Tool
  ↓
output
  ↓
string
  ↓
append to request.prompt
```

This approach had several limitations:

1. **No structured access** — Observations were embedded in prompt text, not queryable
2. **No ordering** — Multiple observations were concatenated as a single string blob
3. **No independent lifecycle** — Observations could not be managed, sorted, or compressed independently
4. **No foundation for future capabilities** — Reflection, Memory Ranking, Context Compression, and Replay all need structured observation data

### Constraints

1. **Planner interface unchanged** — `Planner.plan(request): Promise<PlannerResult>` must remain as-is
2. **No Planner/Provider modifications** — Planner, PlannerProvider, ToolCallPlanner, RetryPlanner unchanged
3. **No Pipeline modifications** — Pipeline.execute() and stream() unchanged
4. **No Runtime modifications**
5. **No Renderer modifications**
6. **Observation lifecycle stays in AgentLoop** — not in PromptBuilder or PromptModule
7. **Backward compatible** — all existing tests continue passing
8. **YAGNI** — do not implement Reflection, Replay, Compression, Ranking
9. **No data duplication** — LoopStep references Observation objects, does not copy data

---

## Decision

### 1. Observation Type

Create a formal `Observation` interface:

```typescript
interface Observation {
  toolName: string
  toolInput: unknown
  toolOutput: unknown
  timestamp: number
  iteration: number
  success?: boolean
}
```

- `toolName` — which tool was executed
- `toolInput` — what input was passed
- `toolOutput` — what the tool returned (or error message)
- `timestamp` — when execution completed (epoch ms)
- `iteration` — which loop iteration (1-based)
- `success` — whether execution succeeded (optional for backward compatibility)

### 2. AgentLoop Maintains Observation[]

The `DefaultAgentLoop` maintains a structured `Observation[]` array throughout execution:

```
DefaultAgentLoop.execute()
  ↓
Create structuredObservations: Observation[]
  ↓
For each iteration:
  ├── Attach observations to request.metadata
  ├── planner.plan(request) → PlannerResult
  ├── If actions: done
  ├── If toolCalls:
  │     ├── Execute tool → output
  │     ├── Create Observation { toolName, toolInput, toolOutput, timestamp, iteration, success }
  │     ├── Push to structuredObservations
  │     └── Push to iteration's observation list
  └── LoopStep references iteration's Observation objects
```

### 3. Observations Passed to Planner via Metadata

Observations are passed to the Planner through `AIRequest.metadata.observations`:

```typescript
request.metadata.observations = structuredObservations
```

This is done **before** each `planner.plan()` call, ensuring the Planner always has the accumulated observation context. The `AIRequest` interface is not modified — metadata is already an extensible `Record<string, unknown>`.

### 4. LoopStep References Observation Objects

The `LoopStep` interface gains an `observations?: Observation[]` field:

```typescript
interface LoopStep {
  iteration: number
  thought?: string
  toolName?: string
  toolInput?: unknown
  toolOutput?: unknown
  observations?: Observation[]   // NEW: references same objects as AgentLoop maintains
  plannerResult?: PlannerResult
}
```

**No data duplication.** The `observations` array references the same `Observation` objects created by the AgentLoop. The existing inline `toolName`, `toolInput`, `toolOutput` fields remain for backward compatibility and quick access.

### 5. Prompt Formatting Still Handled by AgentLoop

The AgentLoop still converts observations to prompt text (appending `"Observation:\nTool X returned: ..."` to the request prompt). This ensures backward compatibility with planners that do not read `metadata.observations`.

The decision of whether/how to format observations for the prompt is entirely the AgentLoop's responsibility — not the PromptBuilder's or a PromptModule's.

### 6. Package Structure

```
packages/ai/src/agent/
  AgentLoop.ts           ← Interface (unchanged)
  AgentLoopContext.ts    ← Context (unchanged)
  AgentLoopResult.ts     ← Result (unchanged)
  AgentLoopStep.ts       ← LoopStep (added observations field)
  Observation.ts         ← NEW: Observation type
  DefaultAgentLoop.ts    ← Implementation (maintains Observation[])
  index.ts               ← Barrel export (added Observation)
```

---

## Consequences

**Positive:**
- Observations are now a formal, structured data type
- AgentLoop maintains a canonical `Observation[]` across all iterations
- Observations are passed to the Planner via `request.metadata.observations`
- LoopStep references Observation objects (no data duplication)
- All 473 tests pass (53 new + 420 existing)
- No changes to Planner, PlannerProvider, ToolCallPlanner, RetryPlanner, Pipeline, Runtime, Renderer
- Backward compatible: inline `toolName`/`toolInput`/`toolOutput` fields remain
- Foundation for future Reflection, Memory Ranking, Context Compression, Replay

**Negative:**
- Slight increase in DefaultAgentLoop complexity (more state to manage)
- Observations are passed via metadata (extensible but not type-safe at the interface level)

**Neutral:**
- Prompt text is still appended alongside structured observations (dual path, AgentLoop decides)
- The `success` field is optional — existing code doesn't need to set it

---

## Future Work (Not Implemented)

| Capability | Reason Deferred |
|-----------|-----------------|
| Reflection | Requires secondary planner call with self-critique prompt |
| Memory Ranking | Requires scoring mechanism based on observations |
| Context Compression | Requires token counting and summarization |
| Replay | Requires action logging |
| Observation subscription API | Not needed yet |
| Persistent Observation storage | Not needed yet |

---

## References

- ADR-0025: Agent Loop Foundation
- ADR-0026: Pipeline Agent Loop Integration
- ADR-0027: Multi-Step Agent Loop
- WO-S3-008: Agent Loop Foundation
- WO-S3-009: Pipeline Agent Loop Integration
- WO-S3-010: Multi-Step Agent Loop
- WO-S3-011: Structured Observation Context (this Work Order)