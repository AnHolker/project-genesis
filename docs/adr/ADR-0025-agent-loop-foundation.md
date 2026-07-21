# ADR-0025: Agent Loop Foundation

**Status:** Accepted  
**Date:** Sprint 3  
**Work Order:** WO-S3-008  
**Architecture Version:** v0.12

---

## Context

The current AI Pipeline executes a single linear flow:

```
User Input
  ↓
Pipeline.execute(PipelineContext)
  ↓
PromptBuilder.build(context)
  ↓
Planner.plan(request)
  ↓
PlannerResult
  ↓
Runtime.applyActions()
```

This is a single-shot process. The Planner receives a prompt, generates an action plan, and execution ends. There is no iteration, no feedback loop, and no opportunity for the AI to observe results and adjust.

A true Agent architecture requires:

```
Thought
  ↓
Tool Call
  ↓
Observation
  ↓
Thought
  ↓
Tool Call
  ↓
Observation
  ↓
Final Action
```

This Work Order (WO-S3-008) establishes the **foundation** for this architecture — the abstraction layer and execution framework — without actually enabling multi-loop execution.

### Constraints

1. **Pipeline remains the only application entry point** — AgentLoop is a new independent capability, not inserted into the Pipeline
2. **No Runtime dependency in AgentLoop** — AgentLoop lives entirely inside the AI layer
3. **No Planner modifications** — the existing Planner interface (`plan(request): Promise<PlannerResult>`) is unchanged
4. **No Provider modifications** — PlannerProvider and all concrete providers remain unchanged
5. **No Pipeline behavior change** — existing Pipeline.execute() and Pipeline.stream() continue to work identically
6. **No multi-loop execution** — this WO only establishes the framework; the loop executes exactly 1 iteration
7. **All existing tests must continue passing** — additive changes only

---

## Decision

### 1. AgentLoop Interface

Define the `AgentLoop` interface as the contract for iterative AI execution:

```typescript
interface AgentLoop {
  execute(context: AgentLoopContext): Promise<AgentLoopResult>
}
```

- Single responsibility: receive context, produce result
- No tool-specific or planner-specific logic in the interface
- Extensible for future multi-iteration implementations

### 2. AgentLoopContext

Data object carried into the AgentLoop execution:

```typescript
interface AgentLoopContext {
  request: AIRequest
  planner: Planner
  toolRegistry?: ToolRegistry
  maxIterations: number
  metadata?: Record<string, unknown>
}
```

- `request` — the AI request with the composed prompt
- `planner` — the Planner instance for generating action plans
- `toolRegistry` — optional tool registry for future tool execution
- `maxIterations` — maximum loop iterations (default: 5, currently unused)
- No Runtime dependency — AgentLoop stays in the AI layer

### 3. AgentLoopResult

Outcome of an AgentLoop execution:

```typescript
interface AgentLoopResult {
  plannerResult: PlannerResult
  steps: LoopStep[]
  iterations: number
  finished: boolean
  reasoning?: string
}
```

- `plannerResult` — the final PlannerResult from the last iteration
- `steps` — complete history of all loop steps
- `iterations` — number of iterations executed (always 1 in current implementation)
- `finished` — whether the loop finished successfully
- `reasoning` — optional overall reasoning for loop termination

### 4. LoopStep

Individual iteration record:

```typescript
interface LoopStep {
  iteration: number
  thought?: string
  toolName?: string
  toolInput?: unknown
  toolOutput?: unknown
  plannerResult?: PlannerResult
}
```

- `iteration` — the iteration index (1-based)
- Optional fields (`thought`, `toolName`, `toolInput`, `toolOutput`, `plannerResult`) are reserved for future multi-iteration support (Reflection, Tool Calling loops)

### 5. DefaultAgentLoop — Single-Iteration Implementation

The current implementation is intentionally minimal. `execute()`:

```
1. Emit AgentLoopStarted
2. Emit LoopIterationStarted (iteration 1)
3. planner.plan(request) → plannerResult
4. Create LoopStep with iteration=1 and plannerResult
5. Emit LoopIterationFinished
6. Build AgentLoopResult { iterations: 1, finished: true, steps: [step] }
7. Emit AgentLoopFinished
8. Return AgentLoopResult
```

**What DefaultAgentLoop does NOT do (by design):**
- No `while()` loop
- No multi-turn Tool Calling
- No Reflection
- No Memory Ranking
- No Context Compression
- No Self Critique
- No automatic retry (handled by RetryPlanner separately)

### 6. Agent Loop Events

Four new event types added to `PipelineEventType`:

| Event Type | When | Payload |
|-----------|------|---------|
| `AgentLoopStarted` | Before any planning | `{ maxIterations }` |
| `LoopIterationStarted` | Before each iteration | `{ iteration, maxIterations }` |
| `LoopIterationFinished` | After each iteration | `{ iteration }` |
| `AgentLoopFinished` | After all iterations | `{ iterations, finished }` |

These events are emitted by `DefaultAgentLoop` through its own `PipelineEventEmitter`. They do not interact with existing Pipeline events.

### 7. Package Structure

```
packages/ai/src/agent/
  AgentLoop.ts         ← Interface
  AgentLoopContext.ts   ← Context type
  AgentLoopResult.ts    ← Result type
  AgentLoopStep.ts      ← Step type
  DefaultAgentLoop.ts   ← Implementation
  index.ts              ← Barrel export
```

All new types are exported via the package's main `index.ts` barrel export.

### 8. Configuration

`maxIterations` is stored but not used for loop control. Default: `5`. Future WO will use this to cap the number of loop iterations.

---

## Consequences

**Positive:**
- Agent Loop foundation is established without affecting any existing code
- All 304 tests pass (49 new + 255 existing)
- TypeScript 0 errors, ESLint 0 errors
- AgentLoop is a standalone capability — Pipeline does not depend on it
- All Planner implementations (MockPlanner, RetryPlanner, ToolCallPlanner) are compatible
- All Provider implementations (Mock, MockStreaming, OpenAI, DeepSeek) are compatible
- Streaming is unaffected — AgentLoop does not touch `Pipeline.stream()`
- LoopStep data structure is ready for future multi-iteration execution
- Event system is extensible for future iteration-level observability
- No breaking changes to any Public API

**Negative:**
- The foundation adds abstraction without immediate user-facing benefit
- DefaultAgentLoop currently does less than a direct `Planner.plan()` call (adds event overhead)
- Tool calling through AgentLoop is not yet wired — `toolRegistry` is accepted but unused

**Neutral:**
- DefaultAgentLoop is not automatically used anywhere — consumers must opt in
- maxIterations is stored but not enforced until a future WO enables loops

---

## Future Work

The following capabilities are explicitly deferred to future Work Orders:

| Capability | When | Dependency |
|-----------|------|-----------|
| Multi-iteration loop (while) | WO-S3-009 | This foundation |
| Multi-turn Tool Calling | WO-S3-010 | Tool Calling, Agent Loop |
| Reflection | WO-S3-011 | Multi-iteration loop |
| Pipeline → AgentLoop integration | Future | Pipeline, Agent Loop |
| Memory Ranking | Future | Memory interface |
| Context Compression | Future | Memory, Pipeline |
| Self Critique | Future | Reflection |

---

## References

- ADR-0006: AI Pipeline
- ADR-0010: Pipeline Events
- ADR-0012: Planner Provider
- ADR-0021: Planner Retry
- ADR-0022: Tool Calling Foundation
- ADR-0024: Provider-native Tool Calling
- WO-S3-008: Agent Loop Foundation (this Work Order)
- Sprint 3 Proposal: Agent Loop (P2)