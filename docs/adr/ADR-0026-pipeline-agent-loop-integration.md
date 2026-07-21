# ADR-0026: Pipeline Agent Loop Integration

**Status:** Accepted  
**Date:** Sprint 3  
**Work Order:** WO-S3-009  
**Architecture Version:** v0.13

---

## Context

After WO-S3-008 (Agent Loop Foundation), two separate execution paths existed:

```
Pipeline ──→ Planner.plan()
```

```
AgentLoop ──→ Planner.plan()
```

These two paths were independent:
- `Pipeline.execute()` called `this.planner.plan(request)` directly
- `DefaultAgentLoop.execute()` called `context.planner.plan(context.request)` internally

This created a gap: the Pipeline was the canonical AI entry point, but it bypassed the AgentLoop abstraction. Any future multi-iteration logic added to AgentLoop would never execute through the Pipeline.

### Constraints

1. **Pipeline must remain the only AI entry point** — consumers must not need to choose between Pipeline and AgentLoop
2. **Zero behavioral change** — since AgentLoop currently executes exactly one `planner.plan()` call, the overall system behavior must be identical
3. **Full backward compatibility** — all existing constructor signatures must continue working
4. **Streaming must be unaffected** — the streaming provider path (`doStream()`) must remain unchanged
5. **AgentLoop stays independent** — Pipeline uses AgentLoop, but AgentLoop doesn't depend on Pipeline
6. **All existing tests must continue passing** — 304 existing tests must remain green

---

## Decision

### 1. Constructor Change

`DefaultPipeline` receives an optional `agentLoop?: AgentLoop` parameter:

```typescript
constructor(
  private readonly planner: Planner,
  private readonly promptBuilder: PromptBuilder,
  private readonly provider?: PlannerProvider,
  agentLoop?: AgentLoop,      // NEW: optional AgentLoop
) {
  this.agentLoop = agentLoop ?? new DefaultAgentLoop()
}
```

- If no `agentLoop` is passed: internally creates a `DefaultAgentLoop`
- If an `agentLoop` is passed: uses the provided implementation

All existing constructor signatures remain valid:
```typescript
// Old (still works)
new DefaultPipeline(planner, promptBuilder)
new DefaultPipeline(planner, promptBuilder, provider)

// New
new DefaultPipeline(planner, promptBuilder, undefined, agentLoop)
new DefaultPipeline(planner, promptBuilder, provider, agentLoop)
```

### 2. execute() — AgentLoop Integration

Before:
```
PromptBuilder.build(context)
  ↓
Planner.plan(request)
  ↓
PlannerResult
```

After:
```
PromptBuilder.build(context)
  ↓
AgentLoop.execute({ request, planner, maxIterations: 5 })
  ↓
AgentLoopResult.plannerResult
  ↓
PlannerResult
```

The `AgentLoopContext` is constructed with:
- `request` — from `PromptBuilder.build()`
- `planner` — the same `Planner` instance the Pipeline already holds
- `maxIterations: 5` — the default maximum

Since `DefaultAgentLoop.execute()` internally calls `planner.plan(request)` once, the result is identical.

### 3. stream() — Streaming Path Unchanged

The streaming provider path is NOT modified:

```
streamPlannerResult(request)
  ├── if provider has 'stream' → doStream()     ← unchanged
  └── else → AgentLoop.execute() → plannerResult  ← changed from Planner.plan()
```

The `doStream()` method continues to use the `StreamingPlannerProvider.stream()` API directly, emitting `StreamChunk` events and parsing the final JSON. AgentLoop does not participate in streaming.

The non-streaming fallback path now goes through `AgentLoop.execute()` instead of `Planner.plan()`, maintaining consistency with `execute()`.

### 4. Events — Independent Emitters

The Pipeline and AgentLoop maintain separate `PipelineEventEmitter` instances:

| Emitter | Events |
|---------|--------|
| `Pipeline.events` | `PipelineStarted`, `PromptBuilt`, `PlannerStarted`, `PlannerFinished`, `PipelineFinished` |
| `AgentLoop.events` | `AgentLoopStarted`, `LoopIterationStarted`, `LoopIterationFinished`, `AgentLoopFinished` |

The execution timeline:
```
Pipeline: PipelineStarted
Pipeline: PromptBuilt
Pipeline: PlannerStarted
  AgentLoop: AgentLoopStarted
  AgentLoop: LoopIterationStarted
  (Planner.plan executes)
  AgentLoop: LoopIterationFinished
  AgentLoop: AgentLoopFinished
Pipeline: PlannerFinished
Pipeline: PipelineFinished
```

---

## Consequences

**Positive:**
- Pipeline is now the unified entry point for all AI execution
- AgentLoop integration is fully backward compatible
- All 351 tests pass (47 new + 304 existing)
- TypeScript 0 errors, ESLint 0 errors
- Streaming behavior is completely unchanged
- RetryPlanner, ToolCallPlanner, and all providers work through AgentLoop
- Future multi-iteration logic added to AgentLoop will automatically execute through Pipeline
- Custom AgentLoop implementations can be injected for testing or extension

**Negative:**
- Slight indirection increase: `execute()` now calls AgentLoop instead of Planner directly
- AgentLoop events are on a separate emitter from Pipeline events
- maxIterations (5) is hardcoded in the AgentLoopContext — not configurable through Pipeline

**Neutral:**
- AgentLoop is still a separate capability — consumers who don't use Pipeline can use AgentLoop directly
- The 4th constructor parameter (agentLoop) may be unfamiliar to existing consumers

---

## Future Work

| Capability | Dependency |
|-----------|-----------|
| Configurable maxIterations through PipelineContext.metadata | Pipeline |
| Multi-iteration AgentLoop | AgentLoop (future WO) |
| AgentLoop event forwarding to Pipeline emitter | Pipeline, AgentLoop |
| Runtime-backed AgentLoop (tool execution between iterations) | Tool Calling, Runtime |

---

## References

- ADR-0006: AI Pipeline
- ADR-0025: Agent Loop Foundation
- WO-S3-008: Agent Loop Foundation
- WO-S3-009: Pipeline Agent Loop Integration (this Work Order)