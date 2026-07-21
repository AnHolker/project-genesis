# ADR-0027: Multi-Step Agent Loop

**Status:** Accepted  
**Date:** Sprint 3  
**Work Order:** WO-S3-010  
**Architecture Version:** v0.14

---

## Context

After WO-S3-009 (Pipeline Agent Loop Integration), the execution flow was:

```
Pipeline
    ↓
AgentLoop
    ↓
Planner.plan()
    ↓
End
```

The `DefaultAgentLoop` executed exactly **one** `Planner.plan()` call per `execute()` invocation. This meant:

- The Agent could not call multiple tools sequentially
- No feedback loop existed between tool execution and planning
- Tool observations were never fed back to the Planner
- The `LoopStep` fields (`toolName`, `toolInput`, `toolOutput`) were declared but never populated

### Constraints

1. **Planner interface unchanged** — `Planner.plan(request): Promise<PlannerResult>` must remain as-is
2. **No Planner modifications** — Planner, PlannerProvider, RetryPlanner, ToolCallPlanner must not be modified
3. **No Provider modifications** — all provider implementations unchanged
4. **No Pipeline changes** — Pipeline.execute() and stream() remain unchanged
5. **No Runtime changes** — AgentLoop stays in the AI layer
6. **No Renderer changes** — Renderer completely unaffected
7. **Streaming unaffected** — streaming path does not use AgentLoop
8. **Backward compatible** — all existing tests continue passing
9. **State-oriented design** — prefer state-driven execution over while + if branching
10. **YAGNI** — do not implement future capabilities (Reflection, Replay, Memory Ranking, etc.)

---

## Decision

### 1. Multi-Step Loop Design

The `DefaultAgentLoop.execute()` is refactored from a single-iteration implementation to a **controlled loop**:

```
AgentLoop.execute(context)
    ↓
Emit AgentLoopStarted
    ↓
for iteration = 1 to maxIterations:
    │
    ├── Emit LoopIterationStarted(iteration)
    │
    ├── planner.plan(request) → PlannerResult
    │
    ├── Create LoopStep { iteration, plannerResult }
    │
    ├── Is PlannerResult.actions.length > 0?
    │   ├── Yes → final result, break loop (finished = true)
    │   └── No  → continue
    │
    ├── Are toolCalls in metadata AND toolRegistry available?
    │   ├── Yes → for each toolCall:
    │   │         ├── Emit ToolExecuted
    │   │         ├── tool.execute(input) → output
    │   │         ├── Record observation in LoopStep
    │   │         └── Emit ObservationRecorded
    │   │         Append observations to request prompt
    │   └── No  → break loop (finished = false)
    │
    └── Emit LoopIterationFinished
    ↓
Emit AgentLoopFinished
    ↓
Return AgentLoopResult
```

### 2. Stop Conditions

Two stop conditions:

| Condition | Trigger | Outcome |
|-----------|---------|---------|
| **Primary** | `PlannerResult.actions.length > 0` | `finished: true`, loop ends immediately |
| **Secondary** | `iteration >= maxIterations` | `finished: false`, loop ends gracefully |

Additional implicit stops:
- No `toolCalls` in metadata → cannot proceed → `finished: false`
- No `toolRegistry` available → cannot execute tools → `finished: false`

### 3. Loop Iteration Lifecycle

Each iteration follows a clear lifecycle:

```
Planning Phase
    ↓
planner.plan(request) → PlannerResult
    ↓
Decision Phase
    ├── Has actions → done
    └── No actions → Tool Execution Phase
                      ↓
                Tool Execute Phase
                    ↓
                tool.execute(input) → output
                    ↓
                Observation Phase
                    ↓
                Record toolName, toolInput, toolOutput in LoopStep
                    ↓
                Feed observations back into request
                    ↓
                Next Iteration
```

This lifecycle ensures future capabilities (Reflection, Memory Ranking, Context Compression) can be inserted at their respective phases without restructuring the loop.

### 4. Tool Call Detection

Tool calls are communicated via `PlannerResult.metadata.toolCalls`:

```typescript
// In PlannerResult.metadata:
{
  toolCalls: Array<{
    name: string    // Tool name to execute
    input: unknown  // Input to pass to the tool
  }>
}
```

The AgentLoop extracts tool calls from metadata via `extractToolCalls()`. Each tool is executed through `toolRegistry.findTool(name)` and `tool.execute(input)`.

### 5. Observation Recording

Observations are recorded in `LoopStep`:

```typescript
interface LoopStep {
  iteration: number
  thought?: string
  toolName?: string        // Populated when tools are executed
  toolInput?: unknown      // Populated when tools are executed
  toolOutput?: unknown     // Populated when tools are executed
  plannerResult?: PlannerResult
}
```

Observations are also appended to the request prompt for the next Planner call:

```
[original prompt]

Observation:
Tool find_entity returned: {"id":"entity-1","type":"tree"}
```

### 6. New Events

Two new event types added to `PipelineEventType`:

| Event | When | Payload |
|-------|------|---------|
| `ToolExecuted` | After each tool execution | `{ toolName, toolInput, success? }` |
| `ObservationRecorded` | After each observation recorded | `{ toolName, toolInput, toolOutput, success? }` |

These events enable observability of the tool execution cycle without coupling.

### 7. Tool Error Handling

| Scenario | Behavior |
|----------|----------|
| Tool not found in registry | Records `"Tool not found: {name}"` as output, emits `ToolExecuted({ success: false })` |
| Tool execution throws | Records error message as output, emits `ObservationRecorded({ success: false })` |
| No toolRegistry provided | Loop cannot execute tools, stops iteration |
| Empty toolCalls array | No tools to execute, loop stops iteration |
| Non-array toolCalls | Treated as empty, loop stops iteration |

### 8. Request Mutation

When observations are recorded, the request for the next iteration is a shallow copy with `prompt` extended:

```typescript
currentRequest = {
  ...currentRequest,
  prompt: `${currentRequest.prompt}\n\nObservation:\n${observationText}`,
}
```

This preserves the original prompt content and appends observation context.

### 9. Backward Compatibility

For the common case where `Planner.plan()` returns non-empty actions on the first call, the loop behaves identically to the previous single-iteration implementation:

- `iterations === 1`
- `finished === true`
- `steps.length === 1`
- 4 events: AgentLoopStarted → LoopIterationStarted → LoopIterationFinished → AgentLoopFinished
- All existing tests pass without modification

---

## Consequences

**Positive:**
- AgentLoop now supports true multi-step execution with tool calling
- Tools can be called sequentially across iterations
- Observations are fully recorded in LoopStep history
- Each iteration has a clear lifecycle (Planning → Tool Execution → Observation)
- Two new events (ToolExecuted, ObservationRecorded) enable observability
- Stop conditions are explicit and testable
- All existing tests (351) continue passing + 69 new tests
- **No changes** to Planner, PlannerProvider, ToolCallPlanner, RetryPlanner, Pipeline, Runtime, Renderer
- Full TypeScript 0 errors, ESLint 0 errors

**Negative:**
- Slight increase in DefaultAgentLoop complexity (from 95 to 190 lines)
- Tool calls must be communicated through metadata (existing field, but new usage)
- Request mutation (observation appending) creates a new object each iteration

**Neutral:**
- maxIterations now actually enforced (previously stored but unused)
- AgentLoop now actively uses toolRegistry (previously accepted but unused)
- Existing LoopStep fields (toolName, toolInput, toolOutput) now populated

---

## Future Work (Not Implemented)

| Capability | Reason Deferred |
|-----------|-----------------|
| Reflection | Requires self-critique prompt, secondary planner call |
| Replay | Requires action logging, not needed yet |
| Memory Ranking | Requires scoring mechanism |
| Context Compression | Requires token counting |
| Parallel Tool Calling | Requires different execution model |
| Human Approval | Requires human-in-the-loop interface |
| Planner Self Reflection | Future WO |
| Streaming Loop | Future WO |

The current architecture allows these to be inserted at the appropriate lifecycle phase without restructuring.

---

## References

- ADR-0025: Agent Loop Foundation
- ADR-0026: Pipeline Agent Loop Integration
- WO-S3-008: Agent Loop Foundation
- WO-S3-009: Pipeline Agent Loop Integration
- WO-S3-010: Multi-Step Agent Loop (this Work Order)