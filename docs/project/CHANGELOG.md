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

### WO-S3-004 — Planner Retry & Self-Healing

- Created `RetryPolicy` class in `packages/ai/src/retry/RetryPolicy.ts`
  - Configurable maxRetries (default: 2)
  - `isRecoverableError()` — distinguishes recoverable (500 error) from non-recoverable (auth, rate limit, network) errors
  - `isRecoverableFailure()` — detects validation/parse failures in PlannerResult (invalid JSON, schema errors, malformed actions)
  - `shouldRetry()` — combines attempt count and error recoverability check
- Created `RetryPlanner` class in `packages/ai/src/planner/RetryPlanner.ts`
  - Implements `Planner` interface, wraps any `PlannerProvider`
  - Provider-independent — works with Mock, OpenAI, DeepSeek
  - Retries on recoverable failures: invalid JSON, schema validation failure, malformed actions
  - Does NOT retry: empty actions without error reasoning (genuinely empty result)
  - Does NOT retry: provider errors like auth failures, rate limits, network errors
  - On retry: appends validation error feedback to the prompt for LLM correction
  - Metrics in PlannerResult.metadata: `retryCount`, `planningAttempts`, `lastValidationError`
  - Owns `PipelineEventEmitter` for retry lifecycle events
- Added retry event types to `PipelineEventType`: `PlannerRetryStarted`, `PlannerRetryFinished`
  - Payload includes: `retryCount`, `validationReason`
- Updated barrel exports: `RetryPlanner` from `planner/index.ts`, `RetryPolicy` from `src/index.ts`
- Added 50 comprehensive test cases (covering 13 test groups):
  - Success on first try (3 tests)
  - Invalid JSON → retry → success (4 tests)
  - Invalid action → retry → success (3 tests)
  - Retry exhausted (3 tests)
  - Provider error → no retry (4 tests)
  - Max retry respected (2 tests)
  - Metrics (5 tests)
  - Event ordering (3 tests)
  - Non-recoverable empty result (2 tests)
  - Recoverable provider throw (2 tests)
  - Edge cases (3 tests)
  - RetryPolicy unit tests (16 tests)
- All 145 tests pass (50 new + 95 existing)
- TypeScript compilation clean, ESLint clean, full project build passes

### WO-S3-005 — Tool Calling Foundation

- Created `Tool` interface in `packages/ai/src/tools/Tool.ts`
  - `name: string` — unique tool identifier
  - `description: string` — human-readable description
  - `execute(input: unknown): Promise<unknown>` — callable execution
  - AI layer depends only on this abstraction (no Runtime dependency)
- Created `ToolRegistry` interface in `packages/ai/src/tools/ToolRegistry.ts`
  - `getTools(): Tool[]` — returns all registered tools
  - `findTool(name: string): Tool | undefined` — lookup by name
- Created `DefaultToolRegistry` — Map-based implementation with O(1) lookup
- Created `MockFindEntityTool` in `packages/ai/src/tools/MockFindEntityTool.ts`
  - Returns hardcoded mock entity data `{ id: 'entity-1', type: 'tree', x: 5, y: 3 }`
  - No Runtime dependency — pure demonstration tool
- Created `ToolCallPlanner` in `packages/ai/src/planner/ToolCallPlanner.ts`
  - Implements `Planner` interface, wraps `PlannerProvider` + `ToolRegistry`
  - Provider-independent — works with Mock, OpenAI, DeepSeek
  - Enhances AIRequest with tool descriptions in prompt and tool names in metadata
  - Emits `ToolCallStarted`/`ToolCallFinished` events during planning
  - Returns tool info in `PlannerResult.metadata.tools`
  - Additive — existing planners without tools continue working unchanged
- Added tool event types to `PipelineEventType`: `ToolCallStarted`, `ToolCallFinished`
  - Payload includes: `toolNames`, `success`, `tool name`
- Updated barrel exports: `ToolCallPlanner` from `planner/index.ts`, `Tool`/`ToolRegistry`/`DefaultToolRegistry`/`MockFindEntityTool` from `src/index.ts`
- Added 33 comprehensive test cases (covering 8 test groups):
  - DefaultToolRegistry: tool registration (4 tests), registry lookup (4 tests)
  - MockFindEntityTool: name/description (1 test), data shape (1 test), input independence (1 test)
  - Planner receives registry (4 tests)
  - Backward compatibility (4 tests)
  - Mock tool execution (3 tests)
  - Event emission (6 tests)
  - Multiple tools (1 test)
  - Tool interface contract (3 tests)
  - Metadata preservation (1 test)
- All 178 tests pass (33 new + 145 existing)
- TypeScript compilation clean, ESLint clean, full project build passes

### WO-S3-006 — Runtime Tool Execution

- Created `RuntimeQuery` interface in `@genesis/shared/src/RuntimeQuery.ts`
  - `findEntity(id: string): Entity | undefined` — find entity by unique ID
  - `findEntities(type?: string): Entity[]` — find entities by type (or all if type omitted)
  - `getWorldSnapshot(): Readonly<World>` — get read-only snapshot of entire world
  - Belongs in `@genesis/shared` so both `@genesis/runtime` and `@genesis/ai` can depend on it
  - No mutation APIs exposed — read-only by design
- Updated `@genesis/runtime/src/query/RuntimeQuery.ts`
  - Now implements `RuntimeQuery` interface from `@genesis/shared`
  - Added `findEntity()`, `findEntities()`, `getWorldSnapshot()` methods
  - Kept `findById()` and `findByType()` as deprecated aliases for backward compatibility
  - `getWorldSnapshot()` returns a defensive copy (not internal reference)
- Created `FindEntityTool` in `packages/ai/src/tools/FindEntityTool.ts`
  - Takes `RuntimeQuery` interface via constructor (no Runtime dependency)
  - Finds entity by `{ id: string }` input, returns entity or null
  - Validates input — returns error message for missing/malformed parameters
- Created `FindEntitiesByTypeTool` in `packages/ai/src/tools/FindEntitiesByTypeTool.ts`
  - Takes `RuntimeQuery` interface via constructor
  - Filters by `{ type: string }` or returns all entities when type omitted
- Created `GetWorldSnapshotTool` in `packages/ai/src/tools/GetWorldSnapshotTool.ts`
  - Takes `RuntimeQuery` interface via constructor
  - Returns `{ entities: [...], entityCount: number }` snapshot
- All three tools implement the `Tool` interface from `@genesis/ai`
- Added 23 test cases (covering 8 test groups):
  - FindEntityTool: populated world (4 tests), empty world (1 test), metadata (1 test)
  - FindEntitiesByTypeTool: populated world (4 tests), empty world (2 tests), metadata (1 test)
  - GetWorldSnapshotTool: populated world (2 tests), empty world (1 test), independence (1 test), metadata (1 test)
  - Registry integration (3 tests)
  - Backward compatibility (2 tests)
- Updated runtime tests: added 9 new tests for interface methods (findEntity, findEntities, getWorldSnapshot)
- All 201 tests pass (23 new tool + 9 new runtime + 169 existing)
- TypeScript compilation clean, ESLint clean, full project build passes

### WO-S3-007 — Provider-native Tool Calling

- Created `ToolCallingProvider` interface extending `PlannerProvider` with `completeWithTools(request, tools)`
- Created `ProviderToolSchemas` utility with `ToolInputSchema`, `getToolInputSchema()`, `hasToolSchema()`, `getSchemaTools()`
  - Built-in schemas for: `find_entity`, `find_entities`, `get_world_snapshot`
  - Unknown tools return `undefined` — providers fall back to prompt-based descriptions
- Updated `OpenAIPlannerProvider`
  - Implements `ToolCallingProvider` via `completeWithTools()`
  - Translates Tool → OpenAI Responses API function schema (`{ type, name, description, parameters, strict }`)
  - Native tool calling lifecycle: send prompt + tools → receive function_calls → execute tools → send results (via `previous_response_id`) → receive final response
  - Parses final JSON response into PlannerResult
  - Includes tool execution details in `PlannerResult.metadata.toolCalls`
- Updated `DeepSeekPlannerProvider`
  - Implements `ToolCallingProvider` via `completeWithTools()`
  - Translates Tool → DeepSeek Chat Completions function schema (`{ type, function: { name, description, parameters } }`)
  - Native tool calling lifecycle: send prompt + tools → receive tool_calls → execute tools → append tool messages → receive final response
  - Parses final JSON response into PlannerResult
  - Supports `allowBrowser` config for development OpenAI client construction
- Updated `ToolCallPlanner`
  - Detects if provider implements `ToolCallingProvider` (`'completeWithTools' in provider`)
  - Routes to `completeWithTools(request, tools)` when native support exists
  - Falls back to prompt-based tool description injection for non-native providers
  - Enhanced `ToolCallStarted` event payload: `{ toolNames, tools?, native }`
  - Enhanced `ToolCallFinished` event payload: `{ toolNames, success, native, toolResults?, duration?, totalToolCallDuration? }`
  - Adds `toolCallNative: boolean` to `PlannerResult.metadata`
- Added browser development support
  - `AIConfiguration.allowBrowser?: boolean` — explicit flag for OpenAI SDK
  - `createAIConfiguration()` reads `VITE_AI_ALLOW_BROWSER` env var
  - Both providers pass `dangerouslyAllowBrowser` to OpenAI client only when `allowBrowser === true`
  - Updated `apps/web/.env.example` with documentation
  - Production-safe: default `false`, must be explicitly enabled
  - No `dangerouslyAllowBrowser: true` hardcoded anywhere
- Added 54 new test cases (covering 13 test groups):
  - ProviderToolSchemas (9 tests): schema lookup for all 3 tools, unknown tool, hasToolSchema, getSchemaTools filtering
  - ToolCallingProvider interface (4 tests): interface conformance, completeWithTools with tools, empty tools, error handling
  - ToolCallPlanner Native Routing (5 tests): routing detection, tool passing, metadata enrichment, event payloads
  - ToolCallPlanner Backward Compatibility (5 tests): prompt-based fallback, MockPlannerProvider, event payloads, empty tools, error handling
  - OpenAIPlannerProvider Tool Calling (5 tests): interface conformance, tools-without-schemas fallback, API error, browser config
  - DeepSeekPlannerProvider Tool Calling (4 tests): interface conformance, tools-without-schemas fallback, API error, browser config
  - Failure Handling (4 tests): unknown tool, tool execution failure, provider error, tool name mismatch
  - Event Ordering (2 tests): correct start → finish order for native and non-native
  - Browser Development Configuration (4 tests): VITE_AI_ALLOW_BROWSER all states
  - Provider Factory Compatibility (4 tests): all 3 providers, unknown provider
  - Mock Provider Backward Compatibility (3 tests): ToolCallPlanner, streaming, complete method
  - Retry Integration (3 tests): ToolCallingProvider + RetryPlanner, retry recovery, ToolCallPlanner independence
  - AIConfiguration allowBrowser (2 tests): optional field, factory propagation
- All 255 tests pass (54 new + 201 existing)
- TypeScript compilation clean
- `Tool` interface unchanged — no breaking changes
- `PlannerProvider` interface unchanged — `ToolCallingProvider` added as extension
- `Pipeline`, `Planner`, `PromptBuilder`, `Runtime` interfaces unchanged
- `ToolCallPlanner` enhanced with routing logic (fully backward compatible)

### WO-S3-008 — Agent Loop Foundation

- Created `packages/ai/src/agent/` module with:
  - `AgentLoop` interface — single `execute(context): Promise<AgentLoopResult>` contract
  - `AgentLoopContext` — data object with `request`, `planner`, `toolRegistry?`, `maxIterations`, `metadata?`
  - `AgentLoopResult` — result with `plannerResult`, `steps`, `iterations`, `finished`, `reasoning?`
  - `LoopStep` — iteration record with `iteration`, `thought?`, `toolName?`, `toolInput?`, `toolOutput?`, `plannerResult?`
  - `DefaultAgentLoop` — single-iteration implementation (foundation for future multi-loop)
- Added 4 new event types to `PipelineEventType`:
  - `AgentLoopStarted` — payload: `{ maxIterations }`
  - `LoopIterationStarted` — payload: `{ iteration, maxIterations }`
  - `LoopIterationFinished` — payload: `{ iteration }`
  - `AgentLoopFinished` — payload: `{ iterations, finished }`
- Exported all new types via barrel exports (`agent/index.ts` and main `index.ts`)
- Created ADR-0025: Agent Loop Foundation
- Added 49 new test cases (covering 11 test groups):
  - AgentLoop Interface (4 tests): interface conformance, context/result/step shapes
  - Single Iteration (6 tests): iterations=1, finished=true, correct actions, reasoning, empty actions
  - Step History (4 tests): steps length, iteration index, plannerResult matching, optional fields
  - Event Emission (9 tests): all 4 events emitted, correct order, payloads, timestamps
  - MockPlanner Compatibility (4 tests): tree/move/unknown keywords through MockPlannerProvider
  - RetryPlanner Compatibility (3 tests): valid provider, metadata preservation, RetryPolicy config
  - ToolCallPlanner Compatibility (4 tests): with/without tools, empty registry, metadata preservation
  - StreamingPlannerProvider Compatibility (2 tests): complete() method, correct actions
  - Future Extension (3 tests): LoopStep thought/tool fields, multi-step scenario
  - AgentLoopContext Configuration (5 tests): custom maxIterations, metadata, toolRegistry, request passthrough
  - Event Edge Cases & Multiple Executions (5 tests): event count, fresh subscribers, re-execution
- All 304 tests pass (49 new + 255 existing)
- TypeScript 0 errors, ESLint 0 errors
- No Pipeline, Planner, Provider, or Runtime modifications
- No breaking changes to any Public API

### WO-S3-009 — Pipeline Agent Loop Integration

- Modified `DefaultPipeline` constructor to accept optional `agentLoop?: AgentLoop` (4th parameter)
  - If not provided, internally creates a `DefaultAgentLoop`
  - All existing constructor signatures remain valid (`(planner, promptBuilder)` and `(planner, promptBuilder, provider)`)
- Updated `DefaultPipeline.execute()` to call `AgentLoop.execute()` instead of `Planner.plan()` directly
  - Builds `AgentLoopContext` with `{ request, planner, maxIterations: 5 }`
  - Extracts `plannerResult` from `AgentLoopResult`
  - Pipeline behavior remains 100% identical (AgentLoop currently executes exactly 1 iteration)
- Updated `DefaultPipeline.stream()` fallback path (non-streaming provider) to use `AgentLoop.execute()` instead of `Planner.plan()`
- Streaming provider path (`doStream()`) remains completely unchanged — AgentLoop does not participate in streaming
- AgentLoop events (`AgentLoopStarted`, `LoopIterationStarted`, `LoopIterationFinished`, `AgentLoopFinished`) fire on AgentLoop's own `PipelineEventEmitter`, independent from Pipeline events
- Created ADR-0026: Pipeline Agent Loop Integration
- Added 47 new integration test cases (covering 9 test groups):
  - AgentLoop Integration (8 tests): AgentLoop called instead of direct Planner, context built correctly, maxIterations/planner passthrough, result preservation
  - Backward Compatibility (5 tests): old constructors, same results with/without AgentLoop, all 4 parameters
  - Pipeline Events (5 tests): correct order, AgentLoop events between PlannerStarted/PlannerFinished, all 4 AgentLoop events
  - MockPlanner Compatibility (4 tests): tree/move/unknown/memory
  - RetryPlanner Compatibility (3 tests): valid provider, metadata, RetryPolicy
  - ToolCallPlanner Compatibility (3 tests): with/without tools, metadata
  - Streaming Compatibility (4 tests): StreamChunk events, correct order, fallback, same result as execute
  - Edge Cases & Custom AgentLoop (6 tests): multiple calls, empty input, error handling, custom AgentLoop
  - Event Chain & Multiple Pipelines (10 tests): full event verification, independent emitters, parallel pipelines
- All 351 tests pass (47 new + 304 existing)
- TypeScript 0 errors, ESLint 0 errors
- No Planner, Provider, Runtime, or Renderer modifications
- No breaking changes to any Public API

### WO-S3-010 — Multi-Step Agent Loop

- Refactored `DefaultAgentLoop` from single-iteration to multi-step execution loop
  - Each iteration: `planner.plan()` → check actions → execute tools → observe → repeat
  - Two stop conditions: Planner returns non-empty actions, or `maxIterations` reached
  - Tool calls read from `PlannerResult.metadata.toolCalls`
  - Observations appended to request prompt for next iteration
- Added 2 new event types to `PipelineEventType`:
  - `ToolExecuted` — payload: `{ toolName, toolInput, success? }`
  - `ObservationRecorded` — payload: `{ toolName, toolInput, toolOutput, success? }`
- `LoopStep` fields (`toolName`, `toolInput`, `toolOutput`) now populated during tool execution
- Tool error handling: tool not found, execution failure, empty/non-array toolCalls
- No changes to Planner, PlannerProvider, ToolCallPlanner, RetryPlanner, Pipeline, Runtime, or Renderer
- Added 69 new test cases in `AgentLoopMultiStep.test.ts` (covering 16 test groups):
  - Multi-Step Loop (6 tests): 1/2/3 iterations, empty actions, no toolRegistry, maxIterations
  - maxIterations Edge Cases (4 tests): boundary, enforcement, exact match
  - Observation Recording (6 tests): toolName, toolInput, toolOutput, tool not found, tool error, multiple tools
  - Loop History (5 tests): step count, iteration indices, plannerResult preservation, tool fields, finished status
  - Event Emission ToolExecuted/ObservationRecorded (7 tests): event types, payloads, order, failure scenarios
  - Event Emission Complete Chain (5 tests): all event types, correct count, order, timestamps
  - Stop Conditions (6 tests): actions, maxIterations, no toolCalls, no toolRegistry, maxIterations enforcement, finished status
  - Tool Execution Integration (5 tests): correct input, multiple calls, observation feedback, tool error, multiple tools
  - RetryPlanner Compatibility (4 tests): multi-step loop, metadata preservation, RetryPolicy, retry events
  - ToolCallPlanner Compatibility (4 tests): multi-step loop, metadata, tools, event isolation
  - Backward Compatibility (8 tests): iterations=1, finished=true, steps length, event count, multiple executions
  - StreamingPlannerProvider Compatibility (1 test): complete() method
  - Edge Cases (6 tests): empty registry, empty toolCalls, non-array toolCalls, null metadata, event emitter isolation, many iterations
  - Tool Call Planning Verification (2 tests): observation serialization, original prompt preservation
- Created ADR-0027: Multi-Step Agent Loop
- Updated PROJECT_STATE.md (v0.14), AI_ARCHITECTURE.md (v0.14)
- All 420 tests pass (351 existing + 69 new)
- TypeScript 0 errors, ESLint 0 errors