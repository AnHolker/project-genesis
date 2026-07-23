# Project State

> Single source of truth for Project Genesis.
> Intended for both humans and AI assistants.

---

## Current Sprint

**Sprint 5** — Post-Freeze Capabilities (Upcoming)

---

## Current Status

| Item | Status |
|------|--------|
| Status | Sprint 4 **Completed (Frozen)** |
| Architecture Version | v0.35 (Sprint 4 Frozen) |
| Architecture Status | **Frozen** — Sprint 4 baseline locked. New capabilities slot into existing interfaces. |
| Runtime Status | Stable (Action Registry + Query Layer) |
| Renderer Status | Stable (Canvas Renderer) |
| Planner Status | Stable (Planner Interface + PlannerResult + PlannerProvider + ProviderFactory) |
| AI Status | Provider Architecture Complete + Streaming Pipeline + Provider Native Tool Calling + Agent Loop Foundation + Pipeline-AgentLoop Integration + Multi-Step Agent Loop + Structured Observation Context + Planner Observation Awareness + Reflection Foundation + Structured Prompt Context + Prompt Renderer Foundation + Context Compression Foundation + Prompt Budget Foundation (Token Estimation) + Memory Ranking Foundation + Prompt Selection Foundation + Prompt Selection Consumption + Prompt Compression Consumption + Prompt Assembly Integration + Provider Budget Foundation + Provider Budget Consumption + AI Configuration Foundation + AI Configuration Consumption + BuilderOptions Foundation + BuilderOptions Consumption + Architecture Review — Mock / OpenAI / DeepSeek Providers + ProviderFactory + StructuredOutputValidator + StreamingPlannerProvider + ToolCallingProvider + AgentLoop (Multi-Step, Structured Observations, Reflection) |
| Prompt Pipeline | **Frozen** — Structured Prompt Context (PromptContext) → PromptModule[] → PromptBuilder → MemoryRanking → PromptBudget → ProviderBudget → PromptSelection (consumes Ranking + Budget + ProviderBudget) → PromptCompression (consumes Selection) → PromptRenderer → AIRequest |
| Validator | StructuredOutputValidator — unified response validation for all providers |
| Streaming | Complete — Pipeline.stream() + StreamChunk events + Streaming UI Integration |
| Current Provider | ProviderFactory (configured via AIConfiguration) |
| Backend Status | None |
| Networking Status | None |
| Development Standards | **Established** — AI_DEVELOPMENT_STANDARD.md v1.0 |
| Architecture Principles | **Established** — ARCHITECTURE_PRINCIPLES.md v1.0 |

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

### Sprint 3 — AI Integration & Polish

| ID | Title |
|----|-------|
| WO-S3-001 | Streaming Provider Interface |
| WO-S3-002 | Streaming Pipeline |
| WO-S3-003 | Streaming UI Integration |
| WO-S3-004 | Planner Retry & Self-Healing |
| WO-S3-005 | Tool Calling Foundation |
| WO-S3-006 | Runtime Tool Execution |
| WO-S3-007 | Provider-native Tool Calling |
| WO-S3-008 | Agent Loop Foundation |
| WO-S3-009 | Pipeline Agent Loop Integration |
| WO-S3-010 | Multi-Step Agent Loop |
| WO-S3-011 | Structured Observation Context |
| WO-S3-012 | Planner Observation Awareness |
| WO-S3-013 | Reflection Foundation |
| WO-S3-014 | Reflection Prompt Integration |
| WO-S3-015 | Structured Prompt Context |
| WO-S3-016 | Prompt Renderer Foundation |
| WO-S3-017 | Context Compression Foundation |
| WO-S3-018 | Prompt Budget Foundation |
| WO-S3-019 | Memory Ranking Foundation |
| WO-S3-020 | Prompt Assembly Integration |
| WO-S3-021 | Sprint 3 Freeze |

### Sprint 4 — AI Polish & Production Readiness

| ID | Title |
|----|-------|
| WO-S4-000 | Project Development Standards Foundation |
| WO-S4-001 | Prompt Selection Foundation |
| WO-S4-002 | Prompt Selection Consumption |
| WO-S4-003 | Prompt Compression Consumption |
| WO-S4-004 | Prompt Budget Token Estimation |
| WO-S4-005 | Provider Budget Foundation |
| WO-S4-006 | Provider Budget Consumption |
| WO-S4-007 | AI Configuration Foundation |
| WO-S4-008 | AI Configuration Consumption |
| WO-S4-009 | BuilderOptions Foundation |
| WO-S4-010 | BuilderOptions Consumption |
| WO-S4-011 | Sprint 4 Architecture Review |
| WO-S4-012 | Sprint 4 Freeze |

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
  stream(context: PipelineContext): Promise<PipelineContext>
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
  /** @deprecated Use maxOutputTokens instead. Kept for backward compatibility. */
  maxTokens: number
  maxOutputTokens?: number
  streaming?: boolean
  toolCalling?: boolean
  apiKey?: string
  baseURL?: string
  allowBrowser?: boolean
}

class DefaultAIConfiguration implements AIConfiguration {
  readonly provider = 'mock'
  readonly model = 'mock'
  readonly temperature = 0
  readonly maxTokens = 0
  readonly streaming = false
  readonly toolCalling = false
  readonly maxOutputTokens = undefined
  readonly apiKey = undefined
  readonly baseURL = undefined
  readonly allowBrowser = undefined
}
```

### PromptBuilder

```typescript
interface PromptBuilder {
  build(context: PipelineContext): Promise<AIRequest>
}

interface PromptModule {
  build(context: PipelineContext): Promise<string>
  buildContext?(context: PipelineContext): Promise<Partial<PromptContext>>
}

interface PromptRenderer {
  render(context: PromptContext): string
}

// Available modules:
//   SystemPromptModule       — system instructions (Project Genesis planner, JSON output)
//   UserInputModule          — returns context.input
//   MemoryPromptModule       — reads "conversation" from Memory
//   WorldStatePromptModule   — reads context.worldState
//   ObservationPromptModule  — reads context.metadata.observations, formats as "## Previous Observations"
//   ReflectionPromptModule   — reads context.metadata.reflectionResults, formats as "## Previous Reflection"
//
// All built-in modules also implement buildContext():
//   SystemPromptModule.buildContext()  → { system: "..." }
//   UserInputModule.buildContext()     → { userInput: "..." }
//   MemoryPromptModule.buildContext()  → { memory: "..." }
//   WorldStatePromptModule.buildContext() → { worldState: "..." }
//   ObservationPromptModule.buildContext() → { observations: "..." }
//   ReflectionPromptModule.buildContext()  → { reflections: "..." }
//
// PromptBuilder collects PromptContext → PromptSelection decides which sections → PromptRenderer renders to string
//
// DefaultPromptBuilder now accepts optional PromptRenderer, PromptCompression, MemoryRanking, PromptBudget, PromptSelection, ProviderBudget, and AIConfiguration
//   (defaults to DefaultPromptRenderer — renders in insertion order)
//   (defaults to DefaultPromptCompression — strips undefined/empty fields)
//   (defaults to DefaultMemoryRanking — fixed priority ranking)
//   (defaults to DefaultPromptBudget — character count budget)
//   (defaults to DefaultPromptSelection — rule-based budget-aware selection)
//   (defaults to no ProviderBudget — no provider budget lookup)
//   (defaults to no AIConfiguration — falls back to 'openai' provider)
//
// BuilderOptions consolidates all optional params into a single options object
//   (consumed by DefaultPromptBuilder constructor since WO-S4-010)
//   Recommended form: new DefaultPromptBuilder(modules, { renderer, compression, ... })
//   Legacy positional form preserved for backward compatibility
//
// Observation formatting is owned by PromptBuilder:
//   formatObservations(obs: Observation[]): string         — rich format for ObservationPromptModule
//   formatObservationsInline(obs: Observation[]): string   — compact format for AgentLoop iterations
//
// Reflection formatting is owned by PromptBuilder:
//   formatReflectionResults(results: ReflectionResult[]): string  — formats as "## Previous Reflection"
//
// PromptContext provides structured access:
//   PromptContext { system?, userInput?, memory?, worldState?, observations?, reflections? }
//   DefaultPromptBuilder.buildContext(context) → PromptContext
//   serializePromptContext(ctx: PromptContext) → string  (delegates to DefaultPromptRenderer)
//
// PromptRenderer is the ONLY text renderer:
//   PromptRenderer.render(context: PromptContext): string
//   DefaultPromptRenderer — default implementation (insertion order for builder, canonical order via renderWithOrder)
//   Future: MarkdownPromptRenderer, XMLPromptRenderer, JSONPromptRenderer, etc.
```

### Pipeline Events

```typescript
type PipelineEventType =
  | 'PipelineStarted'
  | 'PromptBuilt'
  | 'PlannerStarted'
  | 'StreamChunk'
  | 'PlannerRetryStarted'
  | 'PlannerRetryFinished'
  | 'ToolCallStarted'
  | 'ToolCallFinished'
  | 'PlannerFinished'
  | 'PipelineFinished'
  | 'AgentLoopStarted'
  | 'LoopIterationStarted'
  | 'LoopIterationFinished'
  | 'AgentLoopFinished'

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

### StreamingPlannerProvider

```typescript
interface StreamingPlannerProvider extends PlannerProvider {
  stream(request: AIRequest): AsyncIterable<string>
}

class MockStreamingProvider implements PlannerProvider, StreamingPlannerProvider { /* char-by-char streaming */ }
```

### Observation

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

- Structured record of a tool execution within the AgentLoop
- Maintained across all iterations by DefaultAgentLoop
- Passed to Planner via AIRequest.metadata.observations
- Prompt formatting owned by PromptBuilder (ObservationPromptModule + formatObservations)

### Reflection

```typescript
interface Reflection {
  execute(context: ReflectionContext): Promise<ReflectionResult>
}

interface ReflectionContext {
  plannerResult: PlannerResult
  observations: Observation[]
  steps: LoopStep[]
  iteration: number
  maxIterations: number
  metadata?: Record<string, unknown>
}

interface ReflectionResult {
  reasoning: string
  continueLoop: boolean
  metadata?: Record<string, unknown>
}

class DefaultReflection implements Reflection {
  // Simple rule-based reflection:
  // - Actions present → continueLoop=false
  // - Max iterations reached → continueLoop=false
  // - Otherwise → continueLoop=true
}
```

- Independent capability: no Runtime, Renderer, Provider, or Planner dependency
- Results recorded in AgentLoopResult.reflectionResults
- Currently does NOT affect AgentLoop behavior (future WO)
- DefaultReflection provides deterministic baseline

### AgentLoop

```typescript
interface AgentLoop {
  execute(context: AgentLoopContext): Promise<AgentLoopResult>
}

interface AgentLoopContext {
  request: AIRequest
  planner: Planner
  toolRegistry?: ToolRegistry
  maxIterations: number
  metadata?: Record<string, unknown>
}

interface AgentLoopResult {
  plannerResult: PlannerResult
  steps: LoopStep[]
  iterations: number
  finished: boolean
  reasoning?: string
}

interface LoopStep {
  iteration: number
  thought?: string
  toolName?: string
  toolInput?: unknown
  toolOutput?: unknown
  plannerResult?: PlannerResult
}

class DefaultAgentLoop implements AgentLoop {
  // Multi-step execution with structured Observation context
  // Each iteration: attach observations → plan → check actions → execute tools → observe → repeat
  // Observations passed to planner via request.metadata.observations
  // Observation prompt formatting delegated to PromptBuilder (formatObservationsInline)
  // Optional Reflection: evaluates planning state, recorded in reflectionResults (no behavior impact)
  // LoopStep references Observation objects (no data duplication)
  // Stop conditions: Planner returns actions, or maxIterations reached
  // Events: AgentLoopStarted → LoopIterationStarted → [ToolExecuted] → [ObservationRecorded] → LoopIterationFinished → ... → AgentLoopFinished
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

## Current Architecture (v0.35)

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

  During streaming (when using Pipeline.stream()):
    StreamChunk (emitted while provider generates response)

  During retry (when using RetryPlanner):
    PlannerRetryStarted → PlannerRetryFinished (emitted per retry attempt)

  During tool calling (when using ToolCallPlanner):
    ToolCallStarted → ToolCallFinished (emitted per planning request)

  During agent loop (when using DefaultAgentLoop):
    AgentLoopStarted → LoopIterationStarted → LoopIterationFinished → AgentLoopFinished

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

RetryPlanner (decorator, implements Planner)
  └── wraps any PlannerProvider with automatic retry
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
  4. ReflectionPromptModule  — previous reflection results from context.metadata
  5. WorldStatePromptModule  — current world entities snapshot
  6. ObservationPromptModule — structured tool observations

PromptBuilder composition flow:
  PromptModule[6]
    ├── Each module.buildContext() → Partial<PromptContext>
    ├── Merge into unified PromptContext
    ├── MemoryRanking → pure measurement (ranks sections)
    ├── PromptBudget → pure measurement (measures sizes)
    ├── ProviderBudget → pure lookup (provider/model token capacity)
    ├── PromptSelection → decides which sections to preserve
    ├── PromptCompression → strips undefined/empty fields
    └── PromptRenderer → serializes to string → AIRequest

  PromptContext fields:
    system?, userInput?, memory?, worldState?, observations?, reflections?

  DefaultPromptBuilder.buildContext(context) → PromptContext (compressed, pipeline run)
  serializePromptContext(ctx: PromptContext) → string (standalone serialization)
```

Modules execute in-order. Each module produces both a string fragment (via build()) and a structured context contribution (via buildContext()). The builder serializes using module-specific context keys matching the module order.

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
- ~~Streaming not implemented~~ **Resolved in WO-S3-001 through WO-S3-003**
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
| ADR-0020 | Streaming UI Integration | `docs/adr/ADR-0020-streaming-ui-integration.md` |
| ADR-0021 | Planner Retry & Self-Healing | `docs/adr/ADR-0021-planner-retry.md` |
| ADR-0022 | Tool Calling Foundation | `docs/adr/ADR-0022-tool-calling.md` |
| ADR-0023 | Runtime Tool Execution | `docs/adr/ADR-0023-runtime-tool-execution.md` |
| ADR-0024 | Provider-native Tool Calling | `docs/adr/ADR-0024-provider-native-tool-calling.md` |
| ADR-0025 | Agent Loop Foundation | `docs/adr/ADR-0025-agent-loop-foundation.md` |
| ADR-0026 | Pipeline Agent Loop Integration | `docs/adr/ADR-0026-pipeline-agent-loop-integration.md` |
| ADR-0027 | Multi-Step Agent Loop | `docs/adr/ADR-0027-multi-step-agent-loop.md` |
| ADR-0028 | Structured Observation Context | `docs/adr/ADR-0028-structured-observation-context.md` |
| ADR-0029 | Planner Observation Awareness | `docs/adr/ADR-0029-planner-observation-awareness.md` |
| ADR-0030 | Reflection Foundation | `docs/adr/ADR-0030-reflection-foundation.md` |
| ADR-0031 | Reflection Prompt Integration | `docs/adr/ADR-0031-reflection-prompt-integration.md` |
| ADR-0032 | Structured Prompt Context | `docs/adr/ADR-0032-structured-prompt-context.md` |
| ADR-0033 | Prompt Renderer Foundation | `docs/adr/ADR-0033-prompt-renderer-foundation.md` |
| ADR-0034 | Context Compression Foundation | `docs/adr/ADR-0034-context-compression-foundation.md` |
| ADR-0035 | Prompt Budget Foundation | `docs/adr/ADR-0035-prompt-budget-foundation.md` |
| ADR-0036 | Memory Ranking Foundation | `docs/adr/ADR-0036-memory-ranking-foundation.md` |
| ADR-0037 | Prompt Assembly Integration | `docs/adr/ADR-0037-prompt-assembly-integration.md` |
| ADR-0038 | Prompt Selection Foundation | `docs/adr/ADR-0038-prompt-selection-foundation.md` |
| ADR-0039 | Prompt Selection Consumption | `docs/adr/ADR-0039-prompt-selection-consumption.md` |
| ADR-0040 | Prompt Compression Consumption | `docs/adr/ADR-0040-prompt-compression-consumption.md` |
| ADR-0041 | Prompt Budget Token Estimation |
| ADR-0042 | Provider Budget Foundation | `docs/adr/ADR-0042-provider-budget-foundation.md` |
| ADR-0043 | Provider Budget Consumption | `docs/adr/ADR-0043-provider-budget-consumption.md` |
| ADR-0044 | AI Configuration Foundation | `docs/adr/ADR-0044-ai-configuration-foundation.md` |
| ADR-0045 | AI Configuration Consumption | `docs/adr/ADR-0045-ai-configuration-consumption.md` |
| ADR-0046 | BuilderOptions Foundation | `docs/adr/ADR-0046-builder-options-foundation.md` |

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