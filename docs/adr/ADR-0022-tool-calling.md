# ADR-0022: Tool Calling Foundation

**Status:** Accepted  
**Date:** Sprint 3  
**Work Order:** WO-S3-005  
**Architecture Version:** v0.10

---

## Context

The AI Pipeline supports natural language planning, but the Planner has no way to query runtime state, retrieve entity details, or look up available actions mid-plan. Every plan is a single-shot completion with no structured information access.

Future features — Agent Loop, Reflection, Entity Retrieval — all require a mechanism for the Planner to interact with the world beyond generating actions.

Without a Tool Calling foundation:
- Adding a new query capability requires modifying the Planner or adding a new PromptModule
- Every information source needs to be pre-serialized into the prompt string
- The Planner cannot respond dynamically to information it doesn't have at prompt time

### Constraints

1. **No Runtime dependency in AI layer** — Tool abstractions must be provider-independent
2. **No provider imports Runtime** — Providers only receive tool definitions
3. **Do not implement Agent Loop** — This is the architectural foundation only
4. **Do not modify Runtime behavior** — Runtime stays independent
5. **Existing tests must continue passing** — Additive changes only

---

## Decision

### 1. Tool Abstraction

Define a `Tool` interface in the AI layer:

```typescript
interface Tool {
  name: string
  description: string
  execute(input: unknown): Promise<unknown>
}
```

- `name` — unique identifier for referencing the tool
- `description` — human-readable description for LLM context
- `execute()` — callable execution that returns any shape of data
- No dependency on Runtime, World, Entity, or any concrete type

### 2. ToolRegistry Abstraction

Define a `ToolRegistry` interface for tool management:

```typescript
interface ToolRegistry {
  getTools(): Tool[]
  findTool(name: string): Tool | undefined
}
```

`DefaultToolRegistry` provides a Map-based implementation with O(1) lookup.

### 3. ToolCallPlanner

`ToolCallPlanner` implements `Planner` and wraps both a `PlannerProvider` and a `ToolRegistry`:

```typescript
class ToolCallPlanner implements Planner {
  readonly events = new PipelineEventEmitter()

  constructor(
    private readonly provider: PlannerProvider,
    private readonly toolRegistry: ToolRegistry,
  ) {}
}
```

During `plan()`:
1. Retrieves tools from the registry
2. Enhances AIRequest with tool descriptions in the prompt text
3. Includes tool names in request metadata
4. Emits `ToolCallStarted` event
5. Delegates to `provider.complete()`
6. Emits `ToolCallFinished` event
7. Returns `PlannerResult` with `metadata.tools` populated

### 4. Provider Independence

`ToolCallPlanner` operates at the `Planner` level, above all concrete providers:
- `new ToolCallPlanner(new MockPlannerProvider(config), registry)`
- `new ToolCallPlanner(new OpenAIPlannerProvider(config), registry)`
- `new ToolCallPlanner(new DeepSeekPlannerProvider(config), registry)`

No provider modification needed. Providers receive enhanced `AIRequest` with tool descriptions in the prompt.

### 5. Initial Mock Tool

`MockFindEntityTool` — a demonstration tool that returns hardcoded entity data:

```typescript
class MockFindEntityTool implements Tool {
  readonly name = 'find_entity'
  readonly description = 'Find an entity by ID or name...'

  async execute(input: unknown): Promise<unknown> {
    return { id: 'entity-1', type: 'tree', x: 5, y: 3 }
  }
}
```

- No Runtime access — returns mocked data only
- In a future work order, this will be replaced with a real RuntimeQuery-backed tool

### 6. Tool Events

Two new event types added to `PipelineEventType`:

```typescript
type PipelineEventType =
  | ...
  | 'ToolCallStarted'
  | 'ToolCallFinished'
```

`ToolCallStarted` payload: `{ toolNames: string[] }`
`ToolCallFinished` payload: `{ toolNames: string[], success: boolean }`

Events are emitted by `ToolCallPlanner.events` during the `plan()` lifecycle.

---

## Consequences

**Positive:**
- Tool abstractions are provider-independent — any LLM provider can use them
- No Runtime dependency in the AI layer — tools stay abstract
- `ToolCallPlanner` is additive — existing planners work unchanged
- Event observability into tool lifecycle
- Clear extension path for Agent Loop (tool execution → result feedback → replan)

**Negative:**
- Tools are defined at the composition root, adding setup complexity
- The initial mock tool returns hardcoded data — no real Runtime integration yet
- `ToolCallPlanner` adds one more indirection layer between Pipeline and Provider

**Neutral:**
- Tools can be composed via `DefaultToolRegistry` at the composition root
- `ToolCallPlanner` implements the same `Planner` interface as `MockPlanner` — interchangeable
- The `Tool` interface can be extended with JSON schema for tool arguments in the future

---

## Files Changed

| File | Change |
|------|--------|
| `packages/ai/src/tools/Tool.ts` | New — Tool interface |
| `packages/ai/src/tools/ToolRegistry.ts` | New — ToolRegistry interface + DefaultToolRegistry |
| `packages/ai/src/tools/MockFindEntityTool.ts` | New — demonstration mock tool |
| `packages/ai/src/tools/index.ts` | New — barrel export |
| `packages/ai/src/planner/ToolCallPlanner.ts` | New — Planner with tool support |
| `packages/ai/src/events/PipelineEvent.ts` | Modified — added `ToolCallStarted`, `ToolCallFinished` |
| `packages/ai/src/planner/index.ts` | Modified — added `ToolCallPlanner` export |
| `packages/ai/src/index.ts` | Modified — added tool exports |
| `packages/ai/src/__tests__/ToolCallPlanner.test.ts` | New — 33 tests |
| `docs/project/CHANGELOG.md` | Modified — added WO-S3-005 entry |
| `docs/project/PROJECT_STATE.md` | Modified — updated status, ADRs, events |
| `docs/project/AI_ARCHITECTURE.md` | Modified — added tool architecture to diagrams |
| `docs/adr/ADR-0022-tool-calling.md` | New — this document |

---

## Test Summary

| Category | Count |
|----------|-------|
| DefaultToolRegistry — tool registration | 4 |
| DefaultToolRegistry — registry lookup | 4 |
| MockFindEntityTool — name/description/data | 3 |
| Planner receives registry | 4 |
| Backward compatibility (no tools, existing providers) | 4 |
| Mock tool execution | 3 |
| Event emission | 6 |
| Multiple tools | 1 |
| Tool interface contract | 3 |
| Metadata preservation | 1 |
| **Total Tool tests** | **33** |
| **All existing tests** | **145** |
| **Grand total (all passing)** | **178** |

Existing tests continue to pass with zero modifications.