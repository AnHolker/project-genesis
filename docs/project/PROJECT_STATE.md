# Project State

> Single source of truth for Project Genesis.
> Intended for both humans and AI assistants.

---

## Current Sprint

**Sprint 2** — AI Foundation (Frozen)

---

## Current Status

| Item | Status |
|------|--------|
| Status | Sprint 2 Frozen |
| Architecture Version | v0.8 |
| Runtime Status | Stable (Action Registry + Query Layer) |
| Renderer Status | Stable (Canvas Renderer) |
| Planner Status | Stable (Planner Interface + PlannerResult + PlannerProvider + ProviderFactory) |
| AI Status | Provider Architecture Complete — Mock / OpenAI / DeepSeek Providers + ProviderFactory + StructuredOutputValidator — Ready for Real Integration |
| Prompt Pipeline | Complete — SystemPromptModule → UserInputModule → MemoryPromptModule → WorldStatePromptModule → AIRequest |
| Validator | StructuredOutputValidator — unified response validation for all providers |
| Current Provider | ProviderFactory (configured via AIConfiguration) |
| Backend Status | None |
| Networking Status | None |

---

## Completed Work Orders

### Sprint 1 — Runtime Foundation

| ID | Title |
|----|-------|
| WO-S1-001 | Create Entity |
| WO-S1-002 | Runtime Owns World |
| WO-S1-003 | Move Entity |
| WO-S1-004 | Runtime Action Registry |
| WO-S1-005 | Runtime Unit Tests |
| WO-S1-006 | Runtime Query Layer |
| WO-S1-007 | Planner Interface |
| WO-S1-008 | PlannerResult |
| WO-S1-009 | Sprint 1 Freeze |

### Sprint 2 — AI Foundation

| ID | Title |
|----|-------|
| WO-S2-001 | AI Pipeline Interface |
| WO-S2-002 | PipelineContext |
| WO-S2-003 | AIRequest |
| WO-S2-004 | PromptBuilder |
| WO-S2-005 | Pipeline Events |
| WO-S2-006 | Prompt Modules |
| WO-S2-007 | Memory Interface |
| WO-S2-008 | Memory Integration |
| WO-S2-009 | Planner Provider |
| WO-S2-010 | AI Configuration |
| WO-S2-011 | OpenAI Planner Provider |
| WO-S2-012 | Responses API Migration |
| WO-S2-013 | DeepSeek Planner Provider |
| WO-S2-014 | Provider Factory |
| WO-S2-015 | Structured Output Validator |
| WO-S2-016 | Environment Configuration |
| WO-S2-017 | Pipeline Integration Tests |
| WO-S2-018 | Prompt Snapshot Tests |
| WO-S2-019 | System Prompt Module |
| WO-S2-020 | World State Prompt Module |

---

## Runtime Public API

```
Runtime()
  .world                → World (readonly)
  .query                → RuntimeQuery
    .findById(id)       → Entity | undefined
    .findByType(type)   → Entity[]
  .applyActions(actions) → void
  .generateId()         → string
```

### Action Types

| Action | Fields |
|--------|--------|
| `CreateEntity` | `entityType: string`, `x: number`, `y: number` |
| `MoveEntity` | `id: string`, `x: number`, `y: number` |

### Handler Registry

| Action Type | Handler |
|-------------|---------|
| `CreateEntity` | `CreateEntityHandler` |
| `MoveEntity` | `MoveEntityHandler` |

---

## AI Public API

### Pipeline

```typescript
interface Pipeline {
  execute(context: PipelineContext): Promise<PipelineContext>
}
```

### PipelineContext

```typescript
interface PipelineContext {
  input: string
  plannerResult?: PlannerResult
  memory?: Memory
  worldState?: string
  metadata?: Record<string, unknown>
}
```

### AIRequest

```typescript
interface AIRequest {
  prompt: string
  metadata?: Record<string, unknown>
}
```

### Planner

```typescript
interface Planner {
  plan(request: AIRequest): Promise<PlannerResult>
}

interface PlannerResult {
  actions: Action[]
  reasoning?: string
  metadata?: Record<string, unknown>
}
```

### PlannerProvider

```typescript
interface PlannerProvider {
  complete(request: AIRequest): Promise<PlannerResult>
}

class MockPlannerProvider implements PlannerProvider { /* keyword matching */ }
class OpenAIPlannerProvider implements PlannerProvider { /* OpenAI Responses API */ }
class DeepSeekPlannerProvider implements PlannerProvider { /* DeepSeek via OpenAI-compatible Chat Completions */ }

class ProviderFactory {
  static create(config: AIConfiguration): PlannerProvider
}
```

### AIConfiguration

```typescript
interface AIConfiguration {
  provider: string
  model: string
  temperature: number
  maxTokens: number
  apiKey?: string
  baseURL?: string
}

class DefaultAIConfiguration implements AIConfiguration {
  readonly provider = 'mock'
  readonly model = 'mock'
  readonly temperature = 0
  readonly maxTokens = 0
}
```

### PromptBuilder

```typescript
interface PromptBuilder {
  build(context: PipelineContext): Promise<AIRequest>
}

interface PromptModule {
  build(context: PipelineContext): Promise<string>
}

// Available modules:
//   SystemPromptModule    — system instructions (Project Genesis planner, JSON output)
//   UserInputModule       — returns context.input
//   MemoryPromptModule    — reads "conversation" from Memory
//   WorldStatePromptModule — reads context.worldState
```

### Pipeline Events

```typescript
type PipelineEventType =
  | 'PipelineStarted'
  | 'PromptBuilt'
  | 'PlannerStarted'
  | 'PlannerFinished'
  | 'PipelineFinished'

interface PipelineEvent {
  type: PipelineEventType
  timestamp: number
  payload?: Record<string, unknown>
}

interface PipelineEventListener {
  onEvent(event: PipelineEvent): void
}

class PipelineEventEmitter {
  subscribe(listener: PipelineEventListener): void
  unsubscribe(listener: PipelineEventListener): void
  emit(event: PipelineEvent): void
}
```

### Memory

```typescript
interface Memory {
  get(key: string): Promise<unknown>
  set(key: string, value: unknown): Promise<void>
}

class DefaultMemory implements Memory {
  // Map-based, no persistence
}
```

---

## Current Architecture (v0.8)

```
User Natural Language
    ↓
Pipeline.execute(context)
    ↓
PipelineContext { input, memory?, metadata?, worldState? }
    ↓
PromptBuilder.build(context)         ← uses PromptModule[]
    ├── SystemPromptModule            ← Project Genesis system instructions
    ├── UserInputModule               ← returns context.input
    ├── MemoryPromptModule            ← reads "conversation" from Memory
    └── WorldStatePromptModule        ← reads context.worldState
    ↓
AIRequest { prompt }
    ↓
Planner.plan(request)
    ↓
ProviderFactory.create(config)        ← selects provider from AIConfiguration.provider
    ├── MockPlannerProvider           ← keyword matching
    ├── OpenAIPlannerProvider         ← OpenAI Responses API
    └── DeepSeekPlannerProvider       ← DeepSeek Chat Completions API
    ↓
PlannerResult { actions, ... }
    ↓
StructuredOutputValidator.validate(parsed)  ← validates action schema
    ↓
Runtime.applyActions(actions)        ← dispatches through Action Handlers
    ↓
World (owned by Runtime)
    ↓
Renderer.renderWorld(ctx, world)     ← reads World, draws to Canvas

Events (fire-and-forget during Pipeline execution):
  PipelineStarted → PromptBuilt → PlannerStarted → PlannerFinished → PipelineFinished

Memory (optional, in PipelineContext):
  DefaultMemory stores conversation history under "conversation" key
  Used by MemoryPromptModule to provide multi-turn context

Configuration:
  AIConfiguration → ProviderFactory.create(config) → PlannerProvider
  DefaultAIConfiguration: provider="mock", model="mock"
  Environment variables (VITE_AI_PROVIDER, VITE_AI_API_KEY, etc.) → createAIConfiguration()
```

### Provider Hierarchy

```
PlannerProvider (interface)
  ├── MockPlannerProvider       — keyword matching, no API required
  ├── OpenAIPlannerProvider     — OpenAI Responses API (client.responses.create)
  └── DeepSeekPlannerProvider   — OpenAI-compatible Chat Completions (client.chat.completions.create)
```

Provider selection is handled by `ProviderFactory.create(config)` based on `config.provider`:
- `"mock"` → MockPlannerProvider
- `"openai"` → OpenAIPlannerProvider
- `"deepseek"` → DeepSeekPlannerProvider
- Unknown → throws `Error`

### Prompt Module Pipeline

```
PromptBuilder modules (in order):
  1. SystemPromptModule     — system instructions, action schema, JSON format
  2. UserInputModule         — user natural language input
  3. MemoryPromptModule      — conversation history from Memory
  4. WorldStatePromptModule  — current world entities snapshot
```

Modules execute in parallel via Promise.all. Output is joined with '\n' separator.

### Architecture Rules

1. Runtime owns World. Only Runtime may mutate World.
2. Planner never mutates World. Planner produces PlannerResult.
3. Renderer never mutates World. Renderer reads World only.
4. Pipeline is the only AI entry point.
5. Pipeline stages communicate only through PipelineContext.
6. Pipeline never manually constructs AIRequest (delegates to PromptBuilder).
7. PromptBuilder composes AIRequest from PromptModule[] fragments.
8. Pipeline emits events. No component knows listeners.
9. Planner delegates to PlannerProvider. Provider is swappable via config.
10. AIConfiguration provides uniform settings across all providers.
11. Runtime mutations happen only through Action Handlers.
12. One Action → One Handler. No switch(action.type).
13. Query Layer is read-only. Never mutates World.
14. Every new abstraction begins with an interface.
15. Keep code simple.

---

## Known Technical Debt

See [TECH_DEBT.md](./TECH_DEBT.md) for full list.

Resolved during Sprint 1:
- ~~Planner Interface~~ (WO-S1-007)

Resolved during Sprint 2:
- ~~AI Pipeline Abstraction~~ (WO-S2-001, WO-S2-002)
- ~~AIRequest Input Model~~ (WO-S2-003)
- ~~PromptBuilder~~ (WO-S2-004)
- ~~Pipeline Events~~ (WO-S2-005)
- ~~Prompt Modules~~ (WO-S2-006)
- ~~Memory Interface~~ (WO-S2-007)
- ~~Memory Integration~~ (WO-S2-008)
- ~~Planner Provider~~ (WO-S2-009)
- ~~AI Configuration~~ (WO-S2-010)
- ~~OpenAI Planner Provider~~ (WO-S2-011)
- ~~Responses API Migration~~ (WO-S2-012)
- ~~DeepSeek Planner Provider~~ (WO-S2-013)
- ~~Provider Factory~~ (WO-S2-014)
- ~~Structured Output Validator~~ (WO-S2-015)
- ~~Environment Configuration~~ (WO-S2-016)
- ~~Pipeline Integration Tests~~ (WO-S2-017)
- ~~Prompt Snapshot Tests~~ (WO-S2-018)
- ~~System Prompt Module~~ (WO-S2-019)
- ~~World State Prompt Module~~ (WO-S2-020)

Key remaining items:
- Renderer uses inline switch on entity type (no Renderer Registry)
- World uses flat `Entity[]` array (no Entity Map)
- No undo / replay / snapshot support
- Runtime runs in main thread (no Worker Runtime)
- No server-side Runtime
- Prompt versioning missing
- Streaming not implemented
- Provider retry policy absent
- No conversation memory persistence
- System prompt context window not tracked
- World snapshot token budget unknown
- No tool calling support
- No context compression for long conversations
- ~~`@genesis/ai` missing from `apps/web/package.json` dependencies (META-006)~~ **Resolved in WO-S2-021**
- `MockPlanner` naming inconsistent with actual role (META-006)
- ~~4 Sprint 2 ADRs missing: Structured Output Validator, Environment Config, System Prompt Module, Responses API Migration (META-006)~~ **Resolved in WO-S2-021**
- Provider parseResponse duplication (minor) (META-006)
- No compile-time enforcement of StructuredOutputValidator in new providers (META-006)
- Dead `apps/web/src/planner/` directory (META-006)

---

## ADRs Created

| ADR | Title | File |
|-----|-------|------|
| ADR-0006 | AI Pipeline | `docs/adr/ADR-0006-ai-pipeline.md` |
| ADR-0007 | AIRequest Input Model | `docs/adr/ADR-0007-airequest.md` |
| ADR-0008 | PromptBuilder | `docs/adr/ADR-0008-prompt-builder.md` |
| ADR-0009 | Prompt Modules | `docs/adr/ADR-0009-prompt-modules.md` |
| ADR-0010 | Pipeline Events | `docs/adr/ADR-0010-pipeline-events.md` |
| ADR-0011 | Memory Interface | `docs/adr/ADR-0011-memory-interface.md` |
| ADR-0012 | Planner Provider | `docs/adr/ADR-0012-planner-provider.md` |
| ADR-0013 | AI Configuration | `docs/adr/ADR-0013-ai-configuration.md` |
| ADR-0014 | Provider Factory | `docs/adr/ADR-0014-provider-factory.md` |
| ADR-0015 | World State Prompt | `docs/adr/ADR-0015-world-state-prompt.md` |
| ADR-0016 | Structured Output Validator | `docs/adr/ADR-0016-structured-output-validator.md` |
| ADR-0017 | Environment Configuration | `docs/adr/ADR-0017-environment-configuration.md` |
| ADR-0018 | System Prompt Module | `docs/adr/ADR-0018-system-prompt-module.md` |
| ADR-0019 | Responses API Migration | `docs/adr/ADR-0019-responses-api-migration.md` |

---

## Architecture Audit (META-006)

**Date:** Sprint 2 Frozen
**Score:** 9.1 / 10

### Audit Summary

| Item | Result |
|------|--------|
| Duplicate code | Minor — `parseResponse()` 5-line duplication between OpenAI/DeepSeek |
| Dependency direction violations | None found |
| Over-abstraction | None found — all interfaces justified by ADRs |
| Prompt Pipeline conformance | Fully conformant — System→User→Memory→World order matches docs |
| Provider conformance | Fully conformant — Planner→PlannerProvider→Concrete Provider |
| Validation uniformity | LLM providers use StructuredOutputValidator ✅ — Mock bypasses it (correct) |
| Public API cleanliness | Missing `@genesis/ai` in web package.json; concrete providers exported (borderline) |
| Documentation gaps | 4 ADRs missing for Sprint 2 decisions |

### Key Recommendations

| Priority | Item |
|----------|------|
| ~~P0~~ | ~~Add `@genesis/ai` to `apps/web/package.json` dependencies~~ **Done** |
| ~~P0~~ | ~~Write missing ADRs (ADR-0016 through ADR-0019)~~ **Done** |
| P1 | Rename `MockPlanner` → `DefaultPlanner` |
| P1 | Remove dead `apps/web/src/planner/` directory |
| ~~P1~~ | ~~Add TECH_DEBT entries for audit findings~~ **Done** |
| P2 | Consider marking concrete providers as `@internal` |
| P2 | Add validation enforcement for new providers |
| ~~P2~~ | ~~Reference `AI_INTEGRATION.md` from other docs~~ **Done** |