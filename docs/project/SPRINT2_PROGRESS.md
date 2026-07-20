# Sprint 2 Progress

> Project Genesis — Sprint 2: AI Foundation
> Status: **Completed (Frozen)**
> Architecture Version: v0.8

---

## Sprint Summary

| Metric | Value |
|--------|-------|
| Total Work Orders | 20 (WO-S2-001 through WO-S2-020) |
| Source Packages | 5 (`@genesis/shared`, `@genesis/ai`, `@genesis/runtime`, `@genesis/renderer`, `apps/web`) |
| Architecture Version Start | v0.6 |
| Architecture Version End | v0.8 |
| AI Public API Items | 12 (Pipeline, PipelineContext, AIRequest, PromptBuilder, PromptModule, SystemPromptModule, UserInputModule, MemoryPromptModule, WorldStatePromptModule, Planner, PlannerResult, PlannerProvider) |
| AI Providers | 3 (Mock, OpenAI, DeepSeek) |
| Total Tests | 64 across 9 test files |

---

## Completed Work Orders

| ID | Title | Key Artifacts |
|----|-------|---------------|
| WO-S2-001 | AI Pipeline Interface | `Pipeline` interface, `DefaultPipeline` class |
| WO-S2-002 | PipelineContext | `PipelineContext` interface, stage communication contract |
| WO-S2-003 | AIRequest | `AIRequest` interface, `Planner.plan(request)` signature change |
| WO-S2-004 | PromptBuilder | `PromptBuilder` interface, `DefaultPromptBuilder` |
| WO-S2-005 | Pipeline Events | `PipelineEvent`, `PipelineEventListener`, `PipelineEventEmitter` |
| WO-S2-006 | Prompt Modules | `PromptModule` interface, `UserInputModule` |
| WO-S2-007 | Memory Interface | `Memory` interface, `DefaultMemory`, Vitest + memory tests |
| WO-S2-008 | Memory Integration | `MemoryPromptModule`, conversation storage in gameStore |
| WO-S2-009 | Planner Provider | `PlannerProvider` interface, `MockPlannerProvider`, delegation pattern |
| WO-S2-010 | AI Configuration | `AIConfiguration` interface, `DefaultAIConfiguration` |
| WO-S2-011 | OpenAI Planner Provider | `OpenAIPlannerProvider` with `openai` SDK |
| WO-S2-012 | Responses API Migration | `OpenAIPlannerProvider` migrated to Responses API |
| WO-S2-013 | DeepSeek Planner Provider | `DeepSeekPlannerProvider` with OpenAI-compatible Chat Completions |
| WO-S2-014 | Provider Factory | `ProviderFactory.create(config)`, replaces manual provider construction |
| WO-S2-015 | Structured Output Validator | `StructuredOutputValidator`, unified validation for all providers |
| WO-S2-016 | Environment Configuration | `createAIConfiguration(env?)` with VITE_AI_* environment variable support |
| WO-S2-017 | Pipeline Integration Tests | `DefaultPipeline.test.ts` — full end-to-end pipeline test (7 tests) |
| WO-S2-018 | Prompt Snapshot Tests | `PromptBuilder.snapshot.test.ts` — prompt output stability (6 snapshots) |
| WO-S2-019 | System Prompt Module | `SystemPromptModule` — unified system prompt in PromptBuilder |
| WO-S2-020 | World State Prompt Module | `WorldStatePromptModule` — world snapshot via PipelineContext |

---

## Final Architecture

```
User Natural Language
    ↓
Pipeline.execute(PipelineContext)
    ↓
PromptBuilder.build(context)          ← PromptModule[4]
    ├── SystemPromptModule            ← system instructions, action schema
    ├── UserInputModule               ← context.input
    ├── MemoryPromptModule            ← "conversation" from Memory
    └── WorldStatePromptModule        ← context.worldState
    ↓
AIRequest { prompt }
    ↓
Planner.plan(request)
    ↓
ProviderFactory.create(config)        ← AIConfiguration.provider selects
    ├── MockPlannerProvider           ← keyword matching
    ├── OpenAIPlannerProvider         ← Responses API
    └── DeepSeekPlannerProvider       ← Chat Completions API
    ↓
PlannerResult { actions }
    ↓
StructuredOutputValidator.validate(parsed)  ← schema validation
    ↓
Runtime.applyActions(actions)
    ↓
World
    ↓
Renderer (Canvas)

Events: PipelineStarted → PromptBuilt → PlannerStarted → PlannerFinished → PipelineFinished
Memory: DefaultMemory in PipelineContext, conversation history stored per session
Config: AIConfiguration → ProviderFactory.create(config) → PlannerProvider
Env: VITE_AI_* → createAIConfiguration() → AIConfiguration
```

---

## AI Capabilities (Sprint 2 End State)

### Prompt Pipeline

| Module | Status | Responsibility |
|--------|--------|---------------|
| SystemPromptModule | ✅ Complete | System instructions, action schemas, JSON format requirements |
| UserInputModule | ✅ Complete | User's natural language input |
| MemoryPromptModule | ✅ Complete | Conversation history from DefaultMemory |
| WorldStatePromptModule | ✅ Complete | Current world entity snapshot |

### Planning

| Capability | Status | Notes |
|-----------|--------|-------|
| Pipeline orchestration | ✅ Complete | DefaultPipeline orchestrates PromptBuilder → Planner → result |
| Prompt composition | ✅ Complete | 4 modules compose full prompt |
| Planner interface | ✅ Complete | `Planner.plan(request): Promise<PlannerResult>` |
| Mock keyword planner | ✅ Complete | "tree" → CreateEntity, "move" → MoveEntity |
| OpenAI integration | ✅ Complete | Responses API, JSON mode |
| DeepSeek integration | ✅ Complete | Chat Completions API, OpenAI-compatible |
| Provider selection | ✅ Complete | ProviderFactory with switch(config.provider) |
| Environment config | ✅ Complete | VITE_AI_* environment variables |
| Structured validation | ✅ Complete | Unified StructuredOutputValidator |

### Events & Observability

| Capability | Status | Notes |
|-----------|--------|-------|
| Pipeline lifecycle events | ✅ Complete | 5 events emitted in order |
| Event subscription | ✅ Complete | PipelineEventEmitter with subscribe/unsubscribe |

### Memory

| Capability | Status | Notes |
|-----------|--------|-------|
| Memory interface | ✅ Complete | `Memory.get(key)`, `Memory.set(key, value)` |
| DefaultMemory | ✅ Complete | Map-based in-memory store |
| Conversation persistence | ✅ Complete | Stored per session in gameStore |
| Memory prompt integration | ✅ Complete | MemoryPromptModule formats history |

### Testing (64 tests)

| Test File | Tests | Scope |
|-----------|-------|-------|
| `StructuredOutputValidator.test.ts` | 20 | Validation logic |
| `createAIConfiguration.test.ts` | 7 | Environment configuration |
| `DeepSeekPlannerProvider.test.ts` | 7 | DeepSeek provider edge cases |
| `DefaultPipeline.test.ts` | 7 | Full pipeline integration |
| `SystemPromptModule.test.ts` | 6 | SystemPromptModule unit tests |
| `PromptBuilder.snapshot.test.ts` | 6 | Prompt output snapshots |
| `WorldStatePromptModule.test.ts` | 5 | WorldStatePromptModule unit tests |
| `ProviderFactory.test.ts` | 4 | Provider selection |
| `Memory.test.ts` | 2 | DefaultMemory operations |

---

## Not Implemented (Deferred to Sprint 3)

| Priority | Item | Reason |
|----------|------|--------|
| P0 | Streaming Responses | PlannerProvider returns async iterable for progressive rendering |
| P0 | Tool Calling | AI can query runtime state, memory, available actions at planning time |
| P0 | Context Compression | Summarize/trim conversation history when token budget exceeded |
| P1 | World Snapshot Optimization | Pre-compute world state strings, avoid re-serialization per call |
| P1 | Entity Retrieval | AI can find entity by name/location without exact ID |
| P1 | Planner Retry | Exponential backoff for transient provider failures |
| P2 | Agent Loop | Multi-step planning with intermediate feedback |
| P2 | Reflection | AI critiques its own plans before execution |
| P2 | Memory Ranking | Prioritize relevant memories over older ones |
| P2 | Undo / Replay AI | Action history with inverse operations |

---

## Dependency Graph (Final)

```
Pipeline
  ├── PipelineContext { input, plannerResult?, memory?, worldState?, metadata? }
  ├── PromptBuilder
  │     └── PromptModule[4]
  │           ├── SystemPromptModule
  │           ├── UserInputModule
  │           ├── MemoryPromptModule
  │           │     └── Memory
  │           └── WorldStatePromptModule
  ├── Planner
  │     └── PlannerProvider
  │           ├── ProviderFactory
  │           │     └── AIConfiguration
  │           ├── MockPlannerProvider
  │           ├── OpenAIPlannerProvider
  │           └── DeepSeekPlannerProvider
  └── PipelineEventEmitter

Runtime (independent of AI pipeline)
  ├── ActionHandler[]
  └── RuntimeQuery

StructuredOutputValidator (used by OpenAIPlannerProvider, DeepSeekPlannerProvider)
```

---

## Risks (Sprint 2 Retrospective)

| Risk | Impact | Mitigation | Status |
|------|--------|------------|--------|
| OpenAI API key management | High | Environment variables, fallback to mock | ✅ Mitigated |
| LLM response parsing errors | High | StructuredOutputValidator + error fallback | ✅ Mitigated |
| OpenAI API latency | Medium | Streaming (deferred to Sprint 3) | ⏳ Deferred |
| Context window overflow | Medium | Memory integration complete, compression deferred | ⏳ Deferred |
| Rate limiting / API costs | Low | Mock provider for development | ✅ Mitigated |
| System prompt duplication | Medium | SystemPromptModule unifies prompt text | ✅ Resolved |
| No pipeline integration tests | Medium | DefaultPipeline.test.ts (7 tests) | ✅ Resolved |
| No prompt stability guard | Low | PromptBuilder.snapshot.test.ts (6 snapshots) | ✅ Resolved |

---

## Definition of "Sprint 2 Complete"

- [x] AI Pipeline Interface
- [x] PipelineContext
- [x] AIRequest
- [x] PromptBuilder + PromptModule
- [x] Pipeline Events
- [x] Memory Interface + Integration
- [x] Planner + PlannerProvider
- [x] Mock, OpenAI, DeepSeek providers
- [x] ProviderFactory + AIConfiguration
- [x] Structured Output Validator
- [x] Environment Configuration
- [x] System Prompt Module
- [x] World State Prompt Module
- [x] Pipeline Integration Tests
- [x] Prompt Snapshot Tests
- [x] Sprint 2 Freeze (META-005)

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