# Changelog

> Records every completed Work Order for Project Genesis.

---

## Sprint 1 — Runtime Foundation

### WO-S1-001 — Create Entity

- Defined Entity and World types in `@genesis/shared`
- Defined CreateEntityAction
- Implemented Canvas Renderer with grid
- Implemented Mock Planner (keyword matching)
- Vue 3 app shell with Pinia store

### WO-S1-002 — Runtime Owns World

- Introduced `Runtime` class
- Runtime owns `world`
- Planner returns `Action[]`
- Runtime.applyActions() executes actions against World
- Renderer reads World through Runtime

### WO-S1-003 — Move Entity

- Defined MoveEntityAction
- Implemented entity movement (x, y update)
- Mock Planner supports "move" keyword

### WO-S1-004 — Runtime Action Registry

- Introduced `ActionHandler` interface
- Introduced `RuntimeHost` interface
- `CreateEntityHandler` implements ActionHandler
- `MoveEntityHandler` implements ActionHandler
- Runtime uses `Map<string, ActionHandler>` registry
- Removed `switch(action.type)` entirely

### WO-S1-005 — Runtime Unit Tests

- Added Vitest test framework (v1.6.1)
- Created `vitest.config.ts` for runtime package
- Implemented 5 test cases covering:
  - CreateEntity (world state after creation)
  - MoveEntity (x/y position changes)
  - Unknown Action (no crash, world remains valid)
  - Unknown Action with existing entities (no side effects)
  - Multiple Actions (create → move → create sequence)
- All tests use only Runtime public API, no Vue/Renderer dependency

### WO-S1-006 — Runtime Query Layer

- Created `RuntimeQuery` class in `packages/runtime/src/query/`
- `runtime.query.findById(id)` — find entity by ID
- `runtime.query.findByType(type)` — find entities by type
- `RuntimeQuery` receives `Readonly<World>`, never mutates
- Added 4 test cases for query methods
- Runtime public API now includes `.query`

### WO-S1-007 — Planner Interface

- Defined `Planner` interface in `packages/ai` with async `plan(input: string): Promise<Action[]>`
- Moved `mockPlanner` into `MockPlanner` class implementing `Planner`
- UI (`gameStore.ts`) now depends on `Planner` interface only
- Planner is injected as `planner: Planner = new MockPlanner()`
- Removed old `apps/web/src/planner/mockPlanner.ts`
- Prepared architecture for future LLM planners

### WO-S1-008 — PlannerResult

- Created `PlannerResult` interface: `{ actions, reasoning?, metadata? }`
- `Planner.plan()` now returns `Promise<PlannerResult>` instead of `Promise<Action[]>`
- `MockPlanner` returns `{ actions: [...] }`
- UI uses `result.actions` after `await planner.plan(input)`
- Zero-cost optional fields for future LLM integration

### WO-S1-009 — Sprint 1 Freeze

- Sprint 1 declared complete and frozen
- All 8 work orders verified: 5 source packages, 1 application, 0 regressions
- Sprint 2 backlog initialized

---

## Sprint 2 — AI Foundation

### WO-S2-001 — AI Pipeline Interface

- Defined `Pipeline` interface: `execute(context: PipelineContext): Promise<PipelineContext>`
- Implemented `DefaultPipeline` class
- Pipeline is the only AI entry point

### WO-S2-002 — PipelineContext

- Defined `PipelineContext` interface: `{ input, plannerResult?, metadata? }`
- Pipeline stages communicate only through PipelineContext
- `DefaultPipeline.execute()` receives and returns PipelineContext

### WO-S2-003 — AIRequest

- Defined `AIRequest` interface: `{ prompt, metadata? }`
- `Planner.plan()` now accepts `AIRequest` instead of raw string
- Pipeline constructs AIRequest from PipelineContext
- MockPlanner reads `request.prompt`

### WO-S2-004 — PromptBuilder

- Defined `PromptBuilder` interface: `build(context): Promise<AIRequest>`
- Implemented `DefaultPromptBuilder`
- Pipeline delegates AIRequest construction to PromptBuilder

### WO-S2-005 — Pipeline Events

- Defined `PipelineEvent` type (5 event variants)
- Defined `PipelineEventListener` interface
- Implemented `PipelineEventEmitter` (subscribe/unsubscribe/emit)
- DefaultPipeline emits lifecycle events during execution

### WO-S2-006 — Prompt Modules

- Defined `PromptModule` interface: `build(context): Promise<string>`
- Implemented `UserInputModule` (returns `context.input`)
- DefaultPromptBuilder composes prompt from PromptModule[] fragments

### WO-S2-007 — Memory Interface

- Defined `Memory` interface: `get(key)`, `set(key, value)`
- Implemented `DefaultMemory` (Map-based, no dependencies)
- PipelineContext includes optional `memory` field
- Added Vitest to `packages/ai` with 2 Memory test cases

### WO-S2-008 — Memory Integration

- Created `MemoryPromptModule` implementing `PromptModule`
- Reads "conversation" key from PipelineContext.memory
- Formats conversation history as prompt fragment
- Wired DefaultMemory into gameStore.ts — conversation stored after each action
- Both `UserInputModule` and `MemoryPromptModule` active in pipeline

### WO-S2-009 — Planner Provider

- Defined `PlannerProvider` interface: `complete(request): Promise<PlannerResult>`
- Created `MockPlannerProvider` with keyword matching logic (moved from MockPlanner)
- Refactored `MockPlanner` into orchestration layer delegating to provider
- Planner becomes a routing layer, providers own the planning logic

### WO-S2-010 — AI Configuration

- Defined `AIConfiguration` interface: `{ provider, model, temperature, maxTokens, apiKey? }`
- Created `DefaultAIConfiguration` with mock-safe placeholder values
- Injected into `MockPlannerProvider` constructor
- All future providers share the same configuration contract

### WO-S2-011 — OpenAI Planner Provider

- Created `OpenAIPlannerProvider` implementing `PlannerProvider`
- Uses the official `openai` SDK with `responses.create()` (Responses API)
- System prompt defines available actions and JSON output format
- Parses response into `PlannerResult { actions }` compatible with Runtime
- Error handling: empty response, invalid JSON, network failure → `{ actions: [] }`
- Added `openai` dependency to `@genesis/ai`

### WO-S2-012 — Responses API Migration

- Migrated `OpenAIPlannerProvider` from Chat Completions API to Responses API
- Uses `client.responses.create()` with `text: { format: { type: 'json_object' } }`
- Replaced `messages` parameter with `instructions` + `input` parameters
- Replaced `max_tokens` with `max_output_tokens`
- Same interface, same output contract — no other code changed

### WO-S2-013 — DeepSeek Planner Provider

- Created `DeepSeekPlannerProvider` implementing `PlannerProvider`
- Uses the `openai` SDK configured with custom `baseURL` for DeepSeek compatibility
- Uses Chat Completions API (`client.chat.completions.create()`) — DeepSeek's compatible endpoint
- Extended `AIConfiguration` with optional `baseURL?: string` (backward-compatible)
- Same system prompt, same JSON parsing, same error handling as OpenAI provider
- Added 7 test cases covering: missing apiKey, missing baseURL, empty response, valid JSON, invalid JSON, network error, non-array actions

### WO-S2-014 — Provider Factory

- Created `ProviderFactory` with `static create(config: AIConfiguration): PlannerProvider`
- Maps `config.provider` to concrete provider: `"mock"` → MockPlannerProvider, `"openai"` → OpenAIPlannerProvider, `"deepseek"` → DeepSeekPlannerProvider
- Throws readable error for unknown provider values
- Replaced manual provider construction in `gameStore.ts` with `ProviderFactory.create(config)`
- Added 4 test cases covering: mock, openai, deepseek, unknown provider

### WO-S2-015 — Structured Output Validator

- Created `StructuredOutputValidator` with `static validate(parsed: unknown): PlannerResult`
- Unified action validation across OpenAIPlannerProvider and DeepSeekPlannerProvider
- Replaced inline manual parsing in both providers with `StructuredOutputValidator.validate()`
- Validates: actions is array, each action has `type` field, filters out malformed actions
- Added 20 test cases covering: valid actions, empty actions, missing actions field, non-array actions, invalid action types, mixed valid/invalid actions, edge cases

### WO-S2-016 — Environment Configuration

- Created `createAIConfiguration(env?)` function reading `VITE_AI_*` environment variables
- Maps `VITE_AI_PROVIDER` → `provider`, `VITE_AI_API_KEY` → `apiKey`, `VITE_AI_MODEL` → `model`
- Maps `VITE_AI_BASE_URL` → `baseURL`, `VITE_AI_TEMPERATURE` → `temperature`, `VITE_AI_MAX_TOKENS` → `maxTokens`
- Added default models per provider: `gpt-4o-mini` for OpenAI, `deepseek-chat` for DeepSeek
- Integrated into `gameStore.ts` — environment configuration used as primary, falls back to DefaultAIConfiguration
- Added 7 test cases covering: defaults, openai config, deepseek config, numeric parsing, custom model

### WO-S2-017 — Pipeline Integration Tests

- Created `DefaultPipeline.test.ts` with 7 integration test scenarios
- Tests full pipeline flow: `Pipeline.execute()` → `PromptBuilder` → `Planner` → `PlannerResult`
- Verifies memory integration: `MemoryPromptModule` produces correct content in Planner prompt
- Verifies pipeline events: 5 events emitted in correct order (PipelineStarted → PromptBuilt → PlannerStarted → PlannerFinished → PipelineFinished)
- Uses `vi.spyOn()` to verify PromptBuilder.build() and Planner.plan() are called
- Confirms PipelineContext metadata is preserved, plannerResult is written back correctly

### WO-S2-018 — Prompt Snapshot Tests

- Created `PromptBuilder.snapshot.test.ts` with 6 Vitest snapshot scenarios
- Snapshot protects SystemPromptModule output (single module)
- Snapshot protects SystemPromptModule + UserInputModule combined prompt
- Snapshot protects full pipeline: System + User + Memory + World
- Snapshot protects empty memory case (no "Previous conversation" section)
- Verifies module order: System > User > Memory > World (via index comparison)
- All snapshots deterministic and repeatable

### WO-S2-019 — System Prompt Module

- Created `SystemPromptModule` implementing `PromptModule` interface
- Unified system prompt extracted from providers into PromptBuilder pipeline
- Removed duplicated `SYSTEM_PROMPT` constant from `OpenAIPlannerProvider` (26 lines)
- Removed duplicated `SYSTEM_PROMPT` constant from `DeepSeekPlannerProvider` (26 lines)
- OpenAIPlannerProvider: removed `instructions: SYSTEM_PROMPT` parameter
- DeepSeekPlannerProvider: removed system message from `messages[]` array
- Providers now delegate fully to PromptBuilder for prompt composition
- Wired into `gameStore.ts` as first module in DefaultPromptBuilder
- Added 6 unit tests covering: stable output, identity, action descriptions, JSON format, input independence
- Added `SystemPromptModule.test.ts` for isolated module testing
- Updated snapshots to reflect new SystemPromptModule presence

### WO-S2-020 — World State Prompt Module

- Created `WorldStatePromptModule` implementing `PromptModule` interface
- Reads pre-formatted world state from `PipelineContext.worldState` string field
- Added `worldState?: string` to `PipelineContext` interface
- Output format: `Current World:\n\nTree\nid: tree-1\nposition: (3,5)`
- Empty world returns empty string (module is no-op when no worldState provided)
- Created `formatWorldState()` helper in `gameStore.ts` — serializes `Runtime.world.entities` to string
- Wired into `gameStore.ts` as last module in DefaultPromptBuilder
- Added 5 unit tests covering: undefined/empty worldState, single entity, multiple entities, input independence
- Created `WorldStatePromptModule.test.ts` for isolated module testing
- Updated snapshots to include WorldStatePromptModule in prompt composition
- Architecture decision: world state is injected via PipelineContext, not queried by PromptModule (keeps decoupling)

---

## Sprint 3 — AI Integration & Polish

### WO-S3-001 — Streaming Provider Interface

- Created `StreamingPlannerProvider` interface extending `PlannerProvider` with `stream(request): AsyncIterable<string>`
- Added `MockStreamingProvider` implementing both `PlannerProvider` and `StreamingPlannerProvider`
- OpenAIPlannerProvider and DeepSeekPlannerProvider now implement `StreamingPlannerProvider`
- Both LLM providers support streaming via their respective SDK streaming APIs
- Backward compatible — `PlannerProvider` interface unchanged
- Added 18 streaming provider tests

### WO-S3-002 — Streaming Pipeline

- Added `Pipeline.stream(context): Promise<PipelineContext>` method to Pipeline interface
- `DefaultPipeline.stream()` checks if provider implements `StreamingPlannerProvider`
- If yes: streams chunks, emits `StreamChunk` events, assembles JSON, validates via `StructuredOutputValidator`
- If no: falls back to `Planner.plan()` (non-streaming)
- `StreamChunk` event type added to `PipelineEventType`
- Streaming error handling: returns `{ actions: [], reasoning: "Streaming error: ..." }` on failure
- Added 13 streaming pipeline tests
- All 95 existing tests continue passing

### WO-S3-003 — Streaming UI Integration

- Added reactive streaming state to `gameStore`: `isStreaming`, `streamingText`, `streamingFinished`
- Added `useStreaming` toggle ref — configurable streaming mode (default: off)
- Subscribed to `StreamChunk` events via `PipelineEventListener` during streaming
- `sendStreaming()` method: subscribes listener, calls `pipeline.stream()`, accumulates text, applies result
- Error handling: clears streaming state, logs error, falls back to `pipeline.execute()`
- Provider passed to `DefaultPipeline` constructor for runtime streaming detection
- Updated `App.vue`: streaming panel with progress indicator, streaming toggle, disabled input during streaming
- Added vitest config and test infrastructure for web app
- Added 15 streaming UI integration tests
- All 119 tests pass (95 AI + 9 Runtime + 15 Web)
- TypeScript, build, lint all pass
- Created ADR-0020