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

### WO-S3-011 — Structured Observation Context

- Created `Observation` type in `packages/ai/src/agent/Observation.ts`
  - Fields: `toolName`, `toolInput`, `toolOutput`, `timestamp`, `iteration`, `success?`
  - Formal structured data type for tool execution results
- Updated `LoopStep` interface with `observations?: Observation[]` field
  - References same Observation objects as AgentLoop (no data duplication)
  - Existing inline `toolName`/`toolInput`/`toolOutput` fields retained for backward compatibility
- Refactored `DefaultAgentLoop` to maintain structured `Observation[]` across all iterations
  - Observations created after each tool execution
  - Accumulated across iterations in a single canonical array
  - Passed to Planner via `AIRequest.metadata.observations` before each `planner.plan()` call
  - AgentLoop still converts observations to prompt text (backward compatible)
  - Observation lifecycle stays in AgentLoop — not in PromptBuilder or PromptModule
- Updated barrel exports: `Observation` type from `agent/index.ts` and `src/index.ts`
- No changes to Planner, PlannerProvider, ToolCallPlanner, RetryPlanner, Pipeline, Runtime, Renderer
- Created ADR-0028: Structured Observation Context
- Added 53 new test cases in `ObservationContext.test.ts` (covering 10 test groups):
  - Observation Type (4 tests): required fields, optional success, type-only export
  - Observation Lifecycle Creation (8 tests): toolName, toolInput, toolOutput, iteration, timestamp, success, error, tool not found
  - LoopStep Observation Reference (6 tests): observations array, final step, inline field matching, multi-tool, empty, ordering
  - Planner Receives Observations via Metadata (6 tests): metadata presence, empty first call, accumulated, cross-iteration, original metadata preserved
  - Multi-Iteration Observation Accumulation (6 tests): 2/3 iterations, iteration numbers, multiple per iteration, order
  - Observation Events (5 tests): ToolExecuted/ObservationRecorded fire, order, payload, count, cross-iteration
  - Observation Structure (4 tests): exact toolName, toolInput, toolOutput, iteration numbers
  - Backward Compatibility (7 tests): inline toolName/toolInput/toolOutput, iterations, events, empty actions, no toolRegistry
  - Edge Cases (4 tests): no tools, empty registry, execution failure, multiple tools
  - Loop Result Contains Observations (4 tests): steps have observations, preserved across all steps, inline field mirroring, accessible from result
- Updated PROJECT_STATE.md (v0.15), AI_ARCHITECTURE.md (v0.15)
- All 473 tests pass (420 existing + 53 new)
- TypeScript 0 errors, ESLint 0 errors

### WO-S3-012 — Planner Observation Awareness

- Created `ObservationPromptModule` in `packages/ai/src/prompt/modules/ObservationPromptModule.ts`
  - Reads `PipelineContext.metadata?.observations` and formats into "## Previous Observations" section
  - Returns empty string when no observations exist
  - Implements the canonical `formatObservations()` function (rich format with iteration/tool/input/output/success)
  - Implements `formatObservationsInline()` function (compact inline format for AgentLoop iterations)
  - Both functions are exported for reuse across the codebase
- Updated `DefaultPromptBuilder` with `formatObservations(observations)` instance method
  - Delegates to the same implementation as ObservationPromptModule
  - Provides a canonical API for any component needing observation formatting
- Refactored `DefaultAgentLoop` to delegate prompt formatting to PromptBuilder
  - Removed all inline observation-to-prompt formatting code
  - Now imports and calls `formatObservationsInline()` from ObservationPromptModule
  - AgentLoop only maintains `Observation[]` and writes to `request.metadata.observations`
  - Prompt organization is entirely owned by PromptBuilder
- Updated barrel exports:
  - `modules/index.ts`: exports `ObservationPromptModule`, `formatObservations`, `formatObservationsInline`
  - `prompt/index.ts`: re-exports new module and functions
  - `src/index.ts`: re-exports new module and functions
- Provider remains completely unaware of Observation — receives only the final prompt
- No changes to: Planner interface, PlannerProvider, StreamingPlannerProvider, ToolCallingProvider, Runtime, Renderer, Tool, RuntimeQuery
- All 473 existing tests pass with zero modifications
- Added 29 new test cases in `PlannerObservationAwareness.test.ts` (covering 11 test groups):
  - formatObservations Rich Format (5 tests): empty array, single/multiple observations, without success, input/output sections with pretty-printed JSON
  - formatObservationsInline Compact Format (5 tests): empty array, single/multiple inline, string output handling, backward-compatible format
  - ObservationPromptModule (5 tests): no observations, metadata without observations, empty array, single/multiple observations via context
  - DefaultPromptBuilder formatObservations (2 tests): method delegation, empty observations
  - AgentLoop Observation Prompt Delegation (1 test): AgentLoop uses PromptBuilder format function
  - PromptBuilder + ObservationPromptModule Integration (3 tests): observation section inclusion/exclusion, composition
  - Planner Compatibility (1 test): Planner reads observations via metadata
  - Backward Compatibility (4 tests): exact inline format match, AgentLoop result structure, event emission, tool events
  - Retry Compatibility (1 test): retry planner multi-step loop
  - ToolCalling Compatibility (1 test): observation shape in tool calling step
  - Event Compatibility (1 test): event type sequence verification
- All 502 tests pass (473 existing + 29 new)
- TypeScript 0 errors, ESLint 0 errors
- Created ADR-0029: Planner Observation Awareness
- Updated PROJECT_STATE.md (v0.16), AI_ARCHITECTURE.md (v0.16)

### WO-S3-013 — Reflection Foundation

- Created `packages/ai/src/reflection/` module with:
  - `Reflection` interface — single `execute(context): Promise<ReflectionResult>` contract
  - `ReflectionContext` — self-contained context with `plannerResult`, `observations`, `steps`, `iteration`, `maxIterations`, `metadata?`
  - `ReflectionResult` — output with `reasoning`, `continueLoop`, `metadata?`
  - `DefaultReflection` — simple rule-based implementation:
    - Actions present → `continueLoop = false` (task done)
    - Max iterations reached → `continueLoop = false` (out of runway)
    - Otherwise → `continueLoop = true` (keep going)
  - `index.ts` — barrel export
- Updated `AgentLoopResult` interface with optional `reflectionResults?: ReflectionResult[]`
- Updated `DefaultAgentLoop`:
  - Constructor accepts optional `Reflection` parameter
  - After each iteration, calls `reflection.execute()` with current state
  - Results collected in `reflectionResults` on `AgentLoopResult`
  - **Reflection does NOT affect loop behavior** — results recorded only
- Updated barrel exports: `src/index.ts` exports `Reflection`, `ReflectionContext`, `ReflectionResult`, `DefaultReflection`
- No changes to: Planner interface, PlannerProvider, StreamingPlannerProvider, ToolCallingProvider, ToolCallPlanner, RetryPlanner, Pipeline, PipelineContext, PromptBuilder, Runtime, Renderer, Tool, RuntimeQuery
- All 502 existing tests pass with zero modifications
- Added 34 new test cases in `ReflectionFoundation.test.ts` (covering 11 test groups):
  - Reflection Interface (4 tests): interface conformance, context/result shapes, optional metadata
  - DefaultReflection Basic Rules (4 tests): actions present, max iterations, continue, observations
  - DefaultReflection Edge Cases (4 tests): iteration=1 with actions, maxIterations=1, empty observations, multiple observations
  - DefaultReflection Metadata (1 test): no metadata by default
  - AgentLoop with Reflection (6 tests): reflectionResults presence, reasoning, multi-step, multi-iteration, correct conclusions
  - AgentLoop Custom Reflection (3 tests): context passthrough, iteration tracking, observation passthrough
  - Reflection Does Not Change Behavior (3 tests): same result structure, reflection says continue/stop but loop unchanged
  - Backward Compatibility (4 tests): no reflection constructor, events, tool events, observation format
  - RetryPlanner Compatibility (1 test): works with RetryPlanner
  - ToolCallPlanner Compatibility (1 test): works with ToolCallPlanner
  - Streaming Compatibility (1 test): transparent to streaming path
  - Provider Compatibility (2 tests): mock planner, empty result
- All 536 tests pass (502 existing + 34 new)
- TypeScript 0 errors, ESLint 0 errors
- Created ADR-0030: Reflection Foundation
- Updated PROJECT_STATE.md (v0.17), AI_ARCHITECTURE.md (v0.17)

### WO-S3-014 — Reflection Prompt Integration

- Created `ReflectionPromptModule` in `packages/ai/src/prompt/modules/ReflectionPromptModule.ts`
  - Implements `PromptModule` interface
  - Reads `PipelineContext.metadata?.reflectionResults` and formats into "## Previous Reflection" section
  - Returns empty string when no reflection results exist
  - Implements the canonical `formatReflectionResults()` function (rich format with iteration/reasoning/continue)
- Updated `DefaultPromptBuilder` with `formatReflectionResults(results)` instance method
  - Delegates to the same implementation as ReflectionPromptModule
  - Provides a canonical API for any component needing reflection formatting
- Updated `DefaultPipeline` to propagate reflection results:
  - `execute()`: writes `agentLoopResult.reflectionResults` to `PipelineContext.metadata.reflectionResults`
  - `stream()`: captures reflectionResults from fallback AgentLoop path and propagates to result metadata
  - `streamPlannerResult()`: returns `{ plannerResult, reflectionResults? }` tuple for reflection propagation
- Updated barrel exports:
  - `modules/index.ts`: exports `ReflectionPromptModule`, `formatReflectionResults`
  - `prompt/index.ts`: re-exports new module and functions
  - `src/index.ts`: re-exports new module and functions
- Pipeline interface, Planner interface, PlannerProvider, AgentLoop interface, AgentLoopResult unchanged
- Created ADR-0031: Reflection Prompt Integration
- Added 32 new test cases in `ReflectionPromptIntegration.test.ts` (covering 11 test groups):
  - formatReflectionResults (6 tests): empty, single, multi, true/false, with metadata
  - ReflectionPromptModule (6 tests): empty context, empty array, undefined metadata, non-array, single/multi results
  - DefaultPromptBuilder Reflection Integration (4 tests): reflection inclusion, exclusion, full composition, module order
  - DefaultPromptBuilder.formatReflectionResults (2 tests): delegation, empty array
  - AgentLoop ReflectionResults Propagation (4 tests): execute propagation, no reflection case, stream fallback, subsequent calls
  - RetryPlanner Compatibility (1 test): works with RetryPlanner
  - ToolCallPlanner Compatibility (1 test): works with ToolCallPlanner
  - Streaming Compatibility (1 test): streaming provider path (no reflection)
  - Backward Compatibility (7 tests): unchanged existing output, no reflection data, module behavior, Pipeline/stream signatures, AgentLoop without reflection
- All 568 tests pass (536 existing + 32 new)
- TypeScript 0 errors, ESLint 0 errors
- Updated PROJECT_STATE.md (v0.18), AI_ARCHITECTURE.md (v0.18)

### WO-S3-015 — Structured Prompt Context

- Created `PromptContext` interface in `packages/ai/src/prompt/PromptContext.ts`
  - Structured data type: `{ system?, userInput?, memory?, worldState?, observations?, reflections? }`
  - All fields optional — only populated sections are present
  - `serializePromptContext(ctx)` — canonical serialization to string with defined field order
  - Independent of AgentLoop, Planner, or Runtime
- Extended `PromptModule` interface with optional `buildContext()` method
  - Returns `Partial<PromptContext>` with only this module's fields
  - `build()` unchanged — fully backward compatible
  - Legacy modules (build() only) continue working via fallback
- Added `buildContext()` to all 6 built-in modules:
  - `SystemPromptModule.buildContext()` → `{ system }`
  - `UserInputModule.buildContext()` → `{ userInput }`
  - `MemoryPromptModule.buildContext()` → `{ memory }` or `{ memory: undefined }`
  - `WorldStatePromptModule.buildContext()` → `{ worldState }` or `{ worldState: undefined }`
  - `ObservationPromptModule.buildContext()` → `{ observations }` or `{ observations: undefined }`
  - `ReflectionPromptModule.buildContext()` → `{ reflections }` or `{ reflections: undefined }`
- Updated `DefaultPromptBuilder`:
  - `build()` now composes via PromptContext: calls `buildContext()` per module, merges into PromptContext, serializes via module-key mapping
  - New `buildContext(context)` method for structured access (returns PromptContext without serialization)
  - String output is identical to previous version (same sections, same order, same joining)
- Updated barrel exports: `PromptContext` type and `serializePromptContext` from prompt/index.ts and src/index.ts
- Created ADR-0032: Structured Prompt Context
- Added 28 new test cases in `PromptContextFoundation.test.ts` (covering 12 test groups):
  - PromptContext Interface (3 tests): empty, partial, full
  - serializePromptContext (4 tests): empty, single, multiple fields, undefined handling
  - PromptModule.buildContext (6 tests): all 6 modules return correct context keys
  - Legacy Module (2 tests): build() only, mixed with context-aware modules
  - DefaultPromptBuilder.buildContext (2 tests): structured access, merged from all modules
  - DefaultPromptBuilder.build() Backward Compatibility (4 tests): same output as before, module order preservation, empty modules
  - Full Composition (2 tests): all 6 modules, serialized in build()
  - RetryPlanner Compatibility (1 test): works with RetryPlanner
  - ToolCallPlanner Compatibility (1 test): works with ToolCallPlanner
  - Streaming Compatibility (2 tests): streaming path, fallback path
  - AgentLoop Integration (1 test): works with AgentLoop and Reflection
- All 596 tests pass (568 existing + 28 new)
- TypeScript 0 errors, ESLint 0 errors
- Updated PROJECT_STATE.md (v0.19), AI_ARCHITECTURE.md (v0.19)

### WO-S3-016 — Prompt Renderer Foundation

- Created `PromptRenderer` interface in `packages/ai/src/prompt/PromptRenderer.ts`
  - Single method: `render(context: PromptContext): string`
  - Abstraction for future renderer implementations (Markdown, XML, JSON, provider-specific)
- Created `DefaultPromptRenderer` class in `packages/ai/src/prompt/DefaultPromptRenderer.ts`
  - Implements `PromptRenderer` with two rendering strategies:
    - `render()` — insertion order (preserves module array order for the builder)
    - `renderWithOrder()` — canonical field order (system, userInput, memory, reflections, worldState, observations)
  - `CANONICAL_ORDER` static property for reference
  - Filters out unknown keys (not in CANONICAL_ORDER)
- Updated `serializePromptContext()` to delegate to `DefaultPromptRenderer.renderWithOrder()`
  - Fully backward compatible — identical behavior preserved
  - `serializePromptContext` remains a stable public API
- Updated `DefaultPromptBuilder` to use `PromptRenderer`
  - Constructor accepts optional second parameter `renderer?: PromptRenderer` (defaults to `DefaultPromptRenderer`)
  - `build()` now: collects `PromptContext` from modules → calls `renderer.render()` → returns `AIRequest`
  - Legacy modules (no `buildContext()`) still supported via `build()` fallback
  - `buildContext()` method unchanged
  - Output is identical to previous version for all module configurations
- Updated barrel exports:
  - `prompt/index.ts`: exports `PromptRenderer` type and `DefaultPromptRenderer` class
  - `src/index.ts`: exports `PromptRenderer` type and `DefaultPromptRenderer` class
- Created ADR-0033: Prompt Renderer Foundation
- Added 39 new test cases in `PromptRendererFoundation.test.ts` (covering 12 test groups):
  - PromptRenderer Interface (2 tests): conformance, custom implementation
  - DefaultPromptRenderer (7 tests): empty, single field, insertion order, newline joining, undefined fields, unknown key filtering, renderWithOrder canonical order, CANONICAL_ORDER completeness
  - serializePromptContext Compatibility (5 tests): identical behavior, canonical order, delegates to DefaultPromptRenderer
  - DefaultPromptBuilder Renderer Integration (5 tests): default renderer, custom renderer, module order preservation, custom module order, identical output
  - PromptBuilder → Renderer Full Composition (1 test): all 6 modules
  - Existing Prompt Modules Compatibility (6 tests): all 6 modules via build()
  - RetryPlanner Compatibility (1 test): works with RetryPlanner
  - ToolCallPlanner Compatibility (1 test): works with ToolCallPlanner
  - Streaming Compatibility (2 tests): streaming path, fallback path
  - AgentLoop Integration (1 test): works with AgentLoop and Reflection
  - Backward Compatibility — Legacy Modules (2 tests): build() only, mixed
  - Custom Renderer (2 tests): XML-style, JSON-style
  - Exports (2 tests): type and class exports
- All 635 tests pass (596 existing + 39 new)
- TypeScript 0 errors, ESLint 0 errors
- No Planner, Provider, Pipeline, AgentLoop, Runtime, or Renderer modifications
- No breaking changes to any Public API
- Architecture version v0.20

### WO-S3-017 — Context Compression Foundation

- Created `PromptCompression` interface in `packages/ai/src/prompt/PromptCompression.ts`
  - Single method: `compress(context: PromptContext): PromptContext`
  - Pluggable abstraction between PromptContext assembly and rendering
  - No dependencies on Planner, Provider, Runtime, or AgentLoop
- Created `DefaultPromptCompression` class in `packages/ai/src/prompt/DefaultPromptCompression.ts`
  - Implements `PromptCompression`
  - Removes `undefined` and empty string `''` fields from PromptContext
  - Returns a NEW object (does not mutate input)
  - Idempotent: compress(compress(ctx)) === compress(ctx)
  - Deterministic and side-effect free
- Updated `DefaultPromptBuilder` to use `PromptCompression`
  - Constructor accepts optional third parameter `compression?: PromptCompression` (defaults to `DefaultPromptCompression`)
  - `build()` now: collects PromptContext from modules → compression.compress() → renderer.render() → AIRequest
  - `buildContext()` now applies compression before returning
  - Output is identical to previous version (default compression only strips empty/undefined)
- Updated barrel exports:
  - `prompt/index.ts`: exports `PromptCompression` type and `DefaultPromptCompression` class
  - `src/index.ts`: exports `PromptCompression` type and `DefaultPromptCompression` class
- Created ADR-0034: Context Compression Foundation
- Added 54 new test cases in `PromptCompressionFoundation.test.ts` (covering 13 test groups):
  - PromptCompression Interface (3 tests): conformance, custom implementation, no dependencies
  - DefaultPromptCompression (8 tests): non-mutating, field preservation, undefined removal, empty string removal, all-empty, empty input, idempotence, full preservation
  - DefaultPromptBuilder Compression Integration (4 tests): default compression, custom compression, identical output, empty field stripping
  - buildContext Compression Integration (2 tests): compressed output, undefined stripping
  - Renderer Compatibility (2 tests): renderer after compression, module order preservation
  - Existing Prompt Modules Compatibility (6 tests): all 6 modules via build()
  - RetryPlanner Compatibility (1 test): works with RetryPlanner
  - ToolCallPlanner Compatibility (1 test): works with ToolCallPlanner
  - Streaming Compatibility (2 tests): streaming path, fallback path
  - AgentLoop Integration (1 test): works with AgentLoop and Reflection
  - Backward Compatibility (2 tests): legacy modules, mixed modules
  - Custom Compression (2 tests): noop passthrough, field-level filtering
  - Exports (3 tests): type and class from prompt module, class from package root
- All 689 tests pass (635 existing + 54 new)
- TypeScript 0 errors, ESLint 0 errors
- No Planner, Provider, Pipeline, AgentLoop, Runtime, Tool, PromptModule, or PromptRenderer modifications
- No breaking changes to any Public API
- Architecture version v0.21

### WO-S3-018 — Prompt Budget Foundation

- Created `PromptBudget` interface in `packages/ai/src/prompt/PromptBudget.ts`
  - Single method: `calculate(context: PromptContext): PromptBudgetResult`
  - Pluggable measurement abstraction — pure function, no side effects
  - No dependencies on Planner, Provider, Runtime, or AgentLoop
- Created `PromptBudgetResult` interface in `packages/ai/src/prompt/PromptBudgetResult.ts`
  - `totalLength: number` — total character length across all sections
  - `sectionLengths: Record<string, number>` — per-section character lengths
  - `estimatedTokens?: number` — optional, left undefined by default
  - Extensible for future TokenBudget, ProviderBudget implementations
- Created `DefaultPromptBudget` class in `packages/ai/src/prompt/DefaultPromptBudget.ts`
  - Implements `PromptBudget`
  - Character-count based — no tiktoken, no GPT/Claude tokenizer
  - Iterates known PromptContext fields, records `.length` for each
  - Non-mutating, deterministic, pure
  - `estimatedTokens` left undefined (future TokenBudget will populate)
- No integration with Builder, Compression, or Renderer (deferred to future WOs)
- Updated barrel exports:
  - `prompt/index.ts`: exports `PromptBudget` type, `DefaultPromptBudget` class, `PromptBudgetResult` type
  - `src/index.ts`: exports `PromptBudget` type, `DefaultPromptBudget` class, `PromptBudgetResult` type
- Created ADR-0035: Prompt Budget Foundation
- Added 35 new test cases in `PromptBudgetFoundation.test.ts` (covering 11 test groups):
  - PromptBudget Interface (3 tests): conformance, custom implementation, no dependencies
  - PromptBudgetResult Interface (3 tests): totalLength, sectionLengths, estimatedTokens optional
  - DefaultPromptBudget — Empty Context (4 tests): empty, undefined fields, empty strings, all-empty
  - DefaultPromptBudget — Section Length (3 tests): single section, multiple sections, all populated fields
  - DefaultPromptBudget — Full Context (2 tests): totalLength accuracy, estimatedTokens undefined
  - DefaultPromptBudget — Non-mutating (1 test): input unchanged
  - Custom Budget (2 tests): weighted budget, mock token budget with estimatedTokens
  - RetryPlanner Compatibility (1 test): budget is standalone
  - ToolCallPlanner Compatibility (1 test): no interference
  - Streaming Compatibility (2 tests): streaming path, fallback path
  - AgentLoop Integration (1 test): works with AgentLoop
  - Backward Compatibility (2 tests): no breakage, no mutation
  - Exports (4 tests): type and class from prompt module, PromptBudgetResult, class from package root
- All 724 tests pass (689 existing + 35 new)
- TypeScript 0 errors, ESLint 0 errors
- No modifications to any existing component
- No breaking changes to any Public API
- Architecture version v0.22

### WO-S3-019 — Memory Ranking Foundation

- Created `MemoryRanking` interface in `packages/ai/src/prompt/MemoryRanking.ts`
  - Single method: `rank(context: PromptContext): MemoryRankingResult`
  - Pluggable ranking abstraction — pure function, no side effects
  - No dependencies on Planner, Provider, Runtime, or AgentLoop
- Created `MemoryRankingResult` interface in `packages/ai/src/prompt/MemoryRankingResult.ts`
  - `rankedSections: string[]` — section names ordered by priority (highest first)
  - `priorities: Record<string, number>` — per-section priority scores
  - Extensible for future EmbeddingRanking, LLMRanking implementations
- Created `DefaultMemoryRanking` class in `packages/ai/src/prompt/DefaultMemoryRanking.ts`
  - Implements `MemoryRanking`
  - Fixed priority rules — no embedding, no cosine similarity, no LLM evaluation
  - Priority order: userInput (100) > reflections (80) > observations (60) > memory (40) > worldState (20) > system (10)
  - Only populated sections (defined and non-empty) are included
  - `DEFAULT_RANKING_PRIORITY` exported as constant for external reuse
  - Non-mutating, deterministic, pure
  - Provider-agnostic (no OpenAI/DeepSeek binding)
- No integration with Builder, Compression, or Renderer (deferred to future WOs)
- Updated barrel exports:
  - `prompt/index.ts`: exports `MemoryRanking` type, `DefaultMemoryRanking` class, `DEFAULT_RANKING_PRIORITY` constant, `MemoryRankingResult` type
  - `src/index.ts`: exports `MemoryRanking` type, `DefaultMemoryRanking` class, `DEFAULT_RANKING_PRIORITY` constant, `MemoryRankingResult` type
- Created ADR-0036: Memory Ranking Foundation
- Added 33 new test cases in `MemoryRankingFoundation.test.ts` (covering 13 test groups):
  - MemoryRanking Interface (3 tests): conformance, custom implementation, no dependencies
  - MemoryRankingResult Interface (2 tests): rankedSections array, priorities record
  - DEFAULT_RANKING_PRIORITY (3 tests): all fields defined, highest priority, lowest priority
  - DefaultMemoryRanking — Empty Context (4 tests): empty, undefined fields, empty strings, all-empty
  - DefaultMemoryRanking — Fixed Priority (5 tests): pairwise section ordering (all 5 adjacent pairs)
  - DefaultMemoryRanking — Full Context (2 tests): all 6 sections in correct order, correct priority scores
  - DefaultMemoryRanking — Non-mutating (1 test): input unchanged
  - DefaultMemoryRanking — Partial Context (2 tests): only populated sections, single section
  - Custom Ranking (1 test): reverse priority implementation
  - RetryPlanner Compatibility (1 test): ranking is standalone
  - ToolCallPlanner Compatibility (1 test): no interference
  - Streaming Compatibility (2 tests): streaming path, fallback path
  - AgentLoop Integration (1 test): works with AgentLoop
  - Backward Compatibility (2 tests): no breakage, no mutation
  - Exports (5 tests): type and class, DEFAULT_RANKING_PRIORITY, MemoryRankingResult type, package root
- All 757 tests pass (724 existing + 33 new)
- TypeScript 0 errors, ESLint 0 errors
- No modifications to any existing component
- No breaking changes to any Public API
- Architecture version v0.23

### WO-S3-020 — Prompt Assembly Integration

- **DefaultPromptBuilder is now the Prompt Assembly Orchestrator**
  - Constructor extended with 2 new optional parameters (fully backward compatible):
    - `ranking?: MemoryRanking` — defaults to `DefaultMemoryRanking` (4th param)
    - `budget?: PromptBudget` — defaults to `DefaultPromptBudget` (5th param)
  - Existing 1-param `(modules)` and 3-param `(modules, renderer, compression)` signatures unchanged
- **Full Prompt Assembly pipeline in `build()`:**
  1. Module Collection → PromptContext (from PromptModule[].buildContext())
  2. MemoryRanking.rank() — determines section priority (pure measurement)
  3. PromptBudget.calculate() — measures section sizes (pure measurement)
  4. PromptCompression.compress() — cleans context (returns new PromptContext)
  5. PromptRenderer.render() — converts to final string
- **Assembly metadata on AIRequest:**
  - Ranking and Budget results are attached to `AIRequest.metadata.promptAssembly`
  - `{ promptAssembly: { ranking: MemoryRankingResult, budget: PromptBudgetResult } }`
  - Existing metadata keys are preserved
- **buildContext() also runs the full pipeline** (ranking and budget run, compression output flows through)
- All five sub-components remain zero-coupled:
  - Ranking does NOT call Compression
  - Budget does NOT call Ranking
  - Renderer does NOT call Compression
  - Builder is the ONLY orchestrator
- Created ADR-0037: Prompt Assembly Integration
- Added 27 new test cases in `PromptAssemblyIntegration.test.ts` (covering 9 test groups):
  - Default Constructor (5 tests): backward compat, assembly metadata, ranking/budget in metadata, existing metadata preservation
  - Execution Order (1 test): verified rank → budget → compress → render
  - Custom Components (4 tests): custom ranking, custom budget, custom renderer, custom compression
  - buildContext (2 tests): compressed output, empty field stripping
  - Existing Prompt Modules (6 tests): all 6 modules via build()
  - Backward Compatibility (4 tests): 3-param identical output, legacy module, mixed, module order
  - RetryPlanner Compatibility (1 test): works with RetryPlanner
  - ToolCallPlanner Compatibility (1 test): works with ToolCallPlanner
  - Streaming Compatibility (2 tests): streaming path, fallback path
  - AgentLoop Integration (1 test): works with AgentLoop and Reflection
- All 764 tests pass (736 existing + 28 new)
- TypeScript 0 errors, ESLint 0 errors
- No modifications to Planner, Pipeline, Provider, Runtime, AgentLoop, Tool, or any interfaces
- No breaking changes to any Public API
- Architecture version v0.24

### WO-S3-021 — Sprint 3 Freeze

- Sprint 3 officially frozen and marked as **Completed**
- Created Sprint 3 Review document — `docs/project/SPRINT3_REVIEW.md`
  - Sprint goals, completed WO list, architecture evolution
  - Sprint metrics: 20 WOs, 35 ADRs, 779 tests, TypeScript 0 errors
  - Architecture growth analysis (12 new interfaces, 5-stage prompt pipeline)
  - Risks and lessons learned
  - Deferred items mapped to Sprint 4
- Created Sprint 4 Backlog — `docs/project/SPRINT4_BACKLOG.md`
  - P0: Token Compression (Real), Memory Ranking Consumption
  - P1: World Snapshot Optimization, Prompt Optimization
  - P2: Undo/Replay AI, Provider Registration Plugin, Conversation Persistence, Prompt Versioning
  - P3: Embedding/Semantic Memory, LLM-based Compression
- Updated `AI_ARCHITECTURE.md`
  - Added "Sprint 3 Final Architecture (v0.24)" section
  - Complete layer diagram (Prompt Assembly → Agent → Planning → Provider → Validation → Runtime → Rendering)
  - Layer summary table
- Updated `PROJECT_STATE.md` — Sprint 3 marked Completed, Sprint 4 upcoming
- No code changes — documentation only
- All 779 existing tests pass unchanged

### WO-S4-001 — Prompt Selection Foundation

- Created `PromptSelection` interface in `packages/ai/src/prompt/PromptSelection.ts`
  - Single method: `select(context: PromptContext): PromptSelectionResult`
  - Pure decision abstraction — no side effects, no mutation of input
  - No dependencies on Planner, Provider, Runtime, or AgentLoop
  - Pluggable interface for future BudgetAwareSelection, EmbeddingSelection, LLMSelection
- Created `PromptSelectionResult` interface in `packages/ai/src/prompt/PromptSelectionResult.ts`
  - `selectedSections: string[]` — sections to preserve in the final prompt
  - `excludedSections: string[]` — sections to exclude (empty for default pass-through)
- Created `DefaultPromptSelection` class in `packages/ai/src/prompt/DefaultPromptSelection.ts`
  - Implements `PromptSelection`
  - Preserves ALL populated sections (defined and non-empty)
  - Returns empty `excludedSections` array
  - Non-mutating, deterministic, pure, idempotent
  - Provider-agnostic (works identically with Mock, OpenAI, DeepSeek)
- Updated `DefaultPromptBuilder` to slot PromptSelection between Budget and Compression
  - Constructor accepts optional sixth parameter `selection?: PromptSelection` (defaults to `DefaultPromptSelection`)
  - `build()` now runs 7-phase pipeline: collect → rank → budget → select → apply → compress → render
  - `buildContext()` also applies selection before compression
  - Selection result attached to `AIRequest.metadata.promptAssembly.selection`
  - All existing constructor signatures (1-param, 3-param, 5-param) continue working identically
- Updated barrel exports:
  - `prompt/index.ts`: exports `PromptSelection` type, `DefaultPromptSelection` class, `PromptSelectionResult` type
  - `src/index.ts`: exports `PromptSelection` type, `DefaultPromptSelection` class, `PromptSelectionResult` type
- Created ADR-0038: Prompt Selection Foundation
- All 805 tests pass (764 existing + 41 new) with zero modifications to existing tests
- New test groups in `PromptSelectionFoundation.test.ts` (41 tests, 16 groups):
  - PromptSelection Interface (3 tests): interface conformance, custom implementation, no dependencies
  - PromptSelectionResult Interface (3 tests): selectedSections, excludedSections, empty arrays
  - DefaultPromptSelection — Empty Context (4 tests): empty, undefined, empty strings
  - DefaultPromptSelection — Full Context (2 tests): all 6 sections, nothing excluded
  - DefaultPromptSelection — Partial Context (2 tests): subset of sections, single section
  - DefaultPromptSelection — Non-mutating (1 test): input unchanged
  - DefaultPromptSelection — Deterministic (2 tests): identical output, idempotent
  - Custom Selection (1 test): custom selection logic
  - PromptBuilder Integration — Default Selection (3 tests): default, explicit, unchanged output
  - PromptBuilder Integration — Custom Selection (2 tests): exclusion, 6-param constructor
  - Execution Order (1 test): rank → budget → select → compress → render
  - Assembly Metadata (2 tests): selection in metadata, alongside ranking/budget
  - RetryPlanner Compatibility (1 test): works with RetryPlanner
  - ToolCallPlanner Compatibility (1 test): works with ToolCallPlanner
  - Streaming Compatibility (2 tests): streaming path, fallback path
  - AgentLoop Integration (1 test): works with AgentLoop and Reflection
  - Backward Compatibility (4 tests): interfaces, immutability, 1-param vs 6-param, 3-param vs 5-param
  - Exports (4 tests): type and class from prompt module and package root
  - Immutability (1 test): context unchanged after build
- TypeScript 0 errors, ESLint 0 errors
- No modifications to Planner, Pipeline, Provider, Runtime, AgentLoop, Tool, PromptModule, PromptCompression, or PromptRenderer
- No breaking changes to any Public API
- Architecture version v0.25

### WO-S4-002 — Prompt Selection Consumption (Rule-Based)

- **PromptSelection interface evolved** — `select()` now accepts optional `ranking?: MemoryRankingResult` and `budget?: PromptBudgetResult` parameters
  - Backward compatible: existing `select(context)` calls continue working unchanged
  - Custom implementations with single-param signature remain valid TypeScript
- **DefaultPromptSelection implements rule-based budget-aware selection:**
  - Constructor accepts optional `maxBudgetChars` (default: `Infinity` — unlimited)
  - Budget sufficient (`totalLength <= maxBudgetChars`) → preserves all sections
  - Budget constrained (`totalLength > maxBudgetChars`) → removes lowest-priority sections first
  - Uses MemoryRankingResult priorities to determine removal order
  - Uses PromptBudgetResult sectionLengths to track remaining size
  - Falls back to passthrough when ranking or budget is not provided
  - **Guard:** never excludes the last remaining section
  - Non-mutating, deterministic, pure, idempotent, provider-agnostic
- **DefaultPromptBuilder updated** — passes `rankingResult` and `budgetResult` to `selection.select()` in both `build()` and `buildContext()` methods
- Created ADR-0039: Prompt Selection Consumption
- All 836 tests pass (805 existing + 31 new) with zero modifications to existing tests
- New test groups in `PromptSelectionFoundation.test.ts` (31 tests, 15 groups):
  - Ranking & Budget Consumption (2 tests): optional params acceptance, backward compatible
  - Budget Configuration (2 tests): default Infinity, custom maxBudgetChars
  - Budget Sufficient (2 tests): within budget, exactly at budget
  - Budget Constrained (3 tests): remove lowest priority, remove multiple, never exclude all
  - Ranking Consumption (2 tests): removal order from ranking, priority-based ordering
  - Fallback Passthrough (3 tests): no ranking, no budget, neither provided
  - Deterministic with Ranking and Budget (2 tests): identical output, pure function
  - Builder Integration with Budget (3 tests): exclusion in pipeline, ranking/budget passing, metadata
  - buildContext with Budget (1 test): selection applied in buildContext
  - Backward Compatibility with Consumption (3 tests): legacy implementations, immutability, 1-param vs 6-param
  - RetryPlanner Compatibility with Consumption (1 test): works with RetryPlanner
  - ToolCallPlanner Compatibility with Consumption (1 test): works with ToolCallPlanner
  - Streaming Compatibility with Consumption (1 test): works with streaming
  - AgentLoop Compatibility with Consumption (1 test): works with AgentLoop and Reflection
  - Exports with Consumption (4 tests): type and class from prompt module and package root
- TypeScript 0 errors, ESLint 0 errors
- No modifications to Planner, Pipeline, Provider, Runtime, AgentLoop, Tool, PromptModule, PromptCompression, or PromptRenderer
- No breaking changes to any Public API
- Architecture version v0.26

### WO-S4-003 — Prompt Compression Consumption (Rule-Based)

- **PromptCompression interface evolved** — `compress()` now accepts optional `selection?: PromptSelectionResult` parameter
  - Backward compatible: existing `compress(context)` calls continue working unchanged
  - Custom implementations with single-param signature remain valid TypeScript
- **DefaultPromptCompression consumes PromptSelectionResult:**
  - Removes sections listed in `selection.excludedSections`
  - Continues removing `undefined` fields
  - Continues removing empty string `''` fields
  - Exclusion filter applied before undefined/empty stripping
  - When selection is not provided: behavior identical to WO-S3-017
  - Non-mutating, deterministic, pure, idempotent, provider-agnostic
- **DefaultPromptBuilder simplified:**
  - Removed manual selection application (Phase 4 loop over context keys)
  - Now passes `selectionResult` directly to `compression.compress(promptContext, selectionResult)`
  - Builder is now the sole orchestrator; Compression is the sole transformer
  - Both `build()` and `buildContext()` methods updated
- **Pipeline is fully end-to-end connected:**
  `Modules → Context → Rank → Budget → Select → Compress (consumes Selection) → Render`
- Created ADR-0040: Prompt Compression Consumption
- All 857 tests pass (836 existing + 21 new) with zero modifications to existing tests
- New test groups in `PromptCompressionFoundation.test.ts` (21 tests, 11 groups):
  - Selection Consumption Interface (2 tests): optional param acceptance, backward compatible
  - Selection Consumption Behavior (3 tests): single exclusion, multiple exclusion, empty excludedSections
  - Selection + Empty/Undefined Removal (3 tests): simultaneous exclusion+undefined, exclusion+empty, selected preservation
  - Non-mutating with Selection (2 tests): input unchanged, new object reference
  - Deterministic with Selection (2 tests): identical output, idempotent
  - PromptBuilder Integration with Selection Consumption (2 tests): correct output, tracked selection passthrough
  - RetryPlanner with Selection Consumption (1 test): works with RetryPlanner
  - ToolCallPlanner with Selection Consumption (1 test): works with ToolCallPlanner
  - Streaming with Selection Consumption (1 test): works with streaming
  - AgentLoop with Selection Consumption (1 test): works with AgentLoop and Reflection
  - Backward Compatibility with Selection (3 tests): no-selection behavior, legacy implementation, builder constructors
- TypeScript 0 errors, ESLint 0 errors
- No modifications to Planner, Pipeline, Provider, Runtime, AgentLoop, Tool, PromptModule, PromptRenderer, PromptSelection, MemoryRanking, or PromptBudget
- No breaking changes to any Public API
- Architecture version v0.27

### WO-S4-004 — Prompt Budget Token Estimation (Rule-Based)

- **DefaultPromptBudget enhanced** with configurable rule-based token estimation
  - Constructor accepts optional `charsPerToken` parameter (default: 4)
  - Calculates `estimatedTokens = Math.ceil(totalLength / charsPerToken)`
  - Returns `undefined` when `totalLength === 0` (empty context)
  - Configurable ratio allows tuning for different languages or tokenizer efficiencies
- **PromptBudget interface unchanged** — `estimatedTokens` was already an optional field on `PromptBudgetResult`
- **PromptBuilder pipeline unchanged** — Budget is still a pure measurement, consumed downstream by Selection and Compression
- Created ADR-0041: Prompt Budget Token Estimation
- All 879 tests pass (857 existing + 22 new) with zero modifications to existing tests
- New test groups in `PromptBudgetFoundation.test.ts` (22 tests, 7 groups):
  - Token Estimation (5 tests): single section, multiple sections, all sections, empty context, empty/undefined fields
  - Configurable charsPerToken Ratio (5 tests): default ratio, custom ratio, char-level precision, conservative estimation, aggressive estimation
  - Deterministic Token Estimation (2 tests): identical output, different ratios produce different results
  - Immutability with Token Estimation (1 test): input unchanged
  - Token Estimation Builder Integration (2 tests): estimatedTokens in assembly metadata, works with budget-aware selection
  - RetryPlanner with Token Estimation (1 test): works with RetryPlanner
  - ToolCallPlanner with Token Estimation (1 test): works with ToolCallPlanner
  - Streaming with Token Estimation (1 test): works with streaming
  - AgentLoop with Token Estimation (1 test): works with AgentLoop and Reflection
  - Backward Compatibility with Token Estimation (3 tests): totalLength, sectionLengths, immutability
- TypeScript 0 errors, ESLint 0 errors
- No modifications to Planner, Pipeline, Provider, Runtime, AgentLoop, Tool, PromptModule, PromptRenderer, PromptSelection, PromptCompression, or MemoryRanking
- No breaking changes to any Public API
- Architecture version v0.28

### WO-S4-005 — Provider Budget Foundation

- **New `ProviderBudget` interface** — pure lookup component for provider/model token capacity
  - `getBudget(provider: string, model?: string): ProviderBudgetResult`
  - Single-method interface, pure and deterministic
  - No dependencies on PromptBudget, PromptSelection, PromptCompression, Planner, or Provider
- **New `ProviderBudgetResult` interface** — token capacity data type
  - `maxInputTokens: number` — maximum input tokens (required)
  - `maxOutputTokens?: number` — optional maximum output tokens
- **New `DefaultProviderBudget` class** — static lookup table with conservative defaults
  - OpenAI (generic): 8,192 input / 4,096 output
  - DeepSeek (generic): 65,536 input / 8,192 output
  - Anthropic (generic): 100,000 input / 4,096 output
  - Mock: 4,096 input / 1,024 output
  - Unknown provider fallback: 4,096 input / 1,024 output
  - Model-specific overrides: gpt-4, gpt-4-turbo, gpt-4o, gpt-3.5-turbo, deepseek-chat, claude-3-opus, claude-3-sonnet, claude-3-haiku
  - Lookup order: exact model override → provider default → unknown fallback
- **Completely independent from PromptBudget** — separate types, separate interface, separate purpose
- **No integration with PromptSelection** — deferred to future Work Order
- Created ADR-0042: Provider Budget Foundation
- All 941 tests pass (879 existing + 47 new + 15 web) with zero modifications to existing tests
- New test file `ProviderBudgetFoundation.test.ts` (47 tests, 12 groups):
  - Interface Structure (4 tests): only maxInputTokens, both fields, undefined maxOutputTokens, zero values
  - Default Provider Budgets (4 tests): openai, deepseek, anthropic, mock
  - Unknown Provider Fallback (3 tests): unknown, empty string, random string
  - Model-Specific Lookup (10 tests): all model overrides, unknown model fallback, undefined model fallback
  - Deterministic Behavior (4 tests): same provider+model, same provider, different providers, different models
  - Immutability (2 tests): input arguments unchanged, value equality
  - Custom ProviderBudget Implementation (4 tests): custom budget, custom default, custom fallback, type constraint
  - RetryPlanner Compatibility (2 tests): idempotent across calls, all providers
  - ToolCallPlanner Compatibility (2 tests): tool-calling providers, provider-level lookup
  - Streaming Compatibility (1 test): consistent budget across streaming
  - Backward Compatibility (4 tests): exports unchanged, no existing component modified, no PromptBudget dependency, standalone usage
  - Exports (3 tests): ProviderBudget type, DefaultProviderBudget class, ProviderBudgetResult type
  - Independence from PromptBudget (2 tests): different fields, standalone import
  - Constructor (2 tests): no-arg instance, multiple instances
- TypeScript 0 errors, ESLint 0 errors (only pre-existing warnings)
- No modifications to Planner, Pipeline, Provider, Runtime, AgentLoop, Tool, PromptModule, PromptRenderer, PromptBudget, PromptSelection, PromptCompression, MemoryRanking, or any existing component
- No breaking changes to any Public API
- Architecture version v0.29

### WO-S4-006 — Provider Budget Consumption

- **PromptSelection interface evolved** — `select()` gains optional 4th parameter `providerBudget?: ProviderBudgetResult`
  - When provided, implementations use provider token capacity for dynamic budget threshold
  - When omitted, existing behavior unchanged (falls back to static maxBudgetChars)
  - 4-param signature is backward compatible with existing 3-param callers
- **DefaultPromptSelection enhanced** — now supports dynamic ProviderBudget threshold
  - New `charsPerToken` constructor parameter (default: 4) for converting token limits to char thresholds
  - When `ProviderBudgetResult` is passed to `select()`, calculates `effectiveMaxBudgetChars = maxInputTokens * charsPerToken`
  - ProviderBudget threshold overrides static `maxBudgetChars` for that invocation
  - Existing `DefaultPromptSelection(number)` constructor unchanged (backward compatible)
  - Existing `select(context)` and `select(context, ranking, budget)` unchanged (backward compatible)
- **DefaultPromptBuilder extended** — new optional constructor params:
  - `providerBudget?: ProviderBudget` — inject ProviderBudget instance (default: undefined)
  - `providerName?: string` — provider name for lookup (default: 'openai')
  - `modelName?: string` — optional model name for fine-grained lookup
  - When ProviderBudget is injected, the builder calls `getBudget()` and passes result to `selection.select()`
  - `providerBudget` result stored in `AIRequest.metadata.promptAssembly.providerBudget`
  - All existing 1-6 param constructor signatures continue working unchanged
- **Pipeline execution order updated**: Ranking → Budget → ProviderBudget → Selection → Compression → Renderer
- **Different provider budgets produce different selection behavior**:
  - OpenAI (8K tokens → 32K chars): may trigger exclusion for large prompts
  - DeepSeek (65K tokens → 262K chars): generous threshold, rarely triggers exclusion
  - Anthropic (100K tokens → 400K chars): very generous threshold
  - Mock (4K tokens → 16K chars): conservative threshold
  - Unknown: falls back to conservative (4K tokens → 16K chars)
- **Model-specific limits**: gpt-4o (128K tokens), gpt-3.5-turbo (16K tokens), etc.
- Created ADR-0043: Provider Budget Consumption
- All 985 tests pass (926 existing + 44 new + 15 web) with zero modifications to existing tests
- New test file `ProviderBudgetConsumption.test.ts` (44 tests, 14 groups):
  - ProviderBudget Consumption (8 tests): dynamic threshold, preservation, override, exclusion, fallback, undefined fallback, correct exclusion, no maxOutputTokens
  - Different Provider Budgets (6 tests): OpenAI, DeepSeek, Anthropic, Mock thresholds, different thresholds per provider, model-specific limits
  - Unknown Provider Fallback (2 tests): fallback budget, no crash
  - Deterministic with ProviderBudget (3 tests): identical output, idempotent, charsPerToken ratio
  - Immutability with ProviderBudget (2 tests): context unchanged, inputs unchanged
  - Custom ProviderBudget with Selection (2 tests): custom implementation, zero maxInputTokens guard
  - Builder Integration — ProviderBudget Injection (6 tests): 7-param constructor, metadata inclusion, metadata exclusion without ProviderBudget, custom provider name, custom model name, different providers
  - Builder Integration — Execution Order (1 test): rank → budget → providerBudget → select → compress → render
  - Backward Compatibility (8 tests): 1-param constructor, 6-param constructor, select(context) signature, select(context, ranking, budget) signature, constructor(number), constructor(Infinity), custom implementations ignoring 4th param, metadata structure unchanged
  - RetryPlanner Compatibility (1 test): works with RetryPlanner
  - ToolCallPlanner Compatibility (1 test): works with ToolCallPlanner
  - Streaming Compatibility (1 test): works with streaming
  - AgentLoop Compatibility (1 test): works with AgentLoop and Reflection
  - ProviderBudget Metadata (2 tests): maxInputTokens in metadata, model-specific metadata
- TypeScript 0 errors, ESLint 0 errors (only pre-existing warnings)
- No modifications to PromptBudget, Planner, Pipeline, Provider, Runtime, AgentLoop, Tool, PromptModule, PromptRenderer, PromptCompression, MemoryRanking, or any existing component
- No breaking changes to any Public API
- Architecture version v0.30

### WO-S4-007 — AI Configuration Foundation

- **AIConfiguration interface evolved** — unified configuration model for all AI runtime settings
  - New fields: `maxOutputTokens?: number` (preferred over `maxTokens`), `streaming?: boolean`, `toolCalling?: boolean`
  - `maxTokens` marked `@deprecated` in favor of `maxOutputTokens`
  - All existing fields preserved for backward compatibility
  - No speculative fields — every field has a clear future consumer
- **DefaultAIConfiguration enhanced** — immutable default implementation
  - `streaming: false`, `toolCalling: false`, `maxOutputTokens: undefined`
  - All properties are `readonly` — immutable by design
  - Deterministic: identical values on every instantiation
  - Pure: no I/O, no SDK calls, no environment variable access
- **createAIConfiguration enhanced** — new environment variable support
  - `VITE_AI_STREAMING` → `streaming` field (when `"true"`)
  - `VITE_AI_TOOL_CALLING` → `toolCalling` field (when `"true"`)
  - When set to `"false"` or not set, fields remain `undefined` (downstream chooses default)
- **No component modifications** — no changes to PromptBuilder, Planner, PlannerProvider, ProviderBudget, PromptBudget, PromptSelection, PromptCompression, Runtime, AgentLoop, or Pipeline
- **No constructor changes** — no existing component constructors modified
- Created ADR-0044: AI Configuration Foundation
- All 1029 tests pass (970 existing + 44 new + 15 web) with zero modifications to existing tests
- New test file `AIConfigurationFoundation.test.ts` (44 tests, 9 groups):
  - Interface (10 tests): required provider, optional model, temperature, maxOutputTokens, streaming, toolCalling, apiKey, baseURL, allowBrowser
  - Defaults (10 tests): mock provider, mock model, 0 temperature, 0 maxTokens, false streaming, false toolCalling, undefined maxOutputTokens/apiKey/baseURL/allowBrowser
  - Deterministic (1 test): identical values across instances
  - Immutable (2 tests): readonly properties, independent instances
  - No Side Effects (2 tests): no I/O, no env dependency
  - Environment (7 tests): mock defaults, provider, model, streaming, toolCalling, false streaming, false toolCalling
  - Backward Compatibility (5 tests): existing configs, DefaultAIConfiguration, createAIConfiguration, ProviderFactory, assignability
  - Exports (3 tests): AIConfiguration type, DefaultAIConfiguration class, createAIConfiguration function
  - Compatibility (4 tests): ProviderFactory, RetryPlanner, ToolCallPlanner, Streaming, AgentLoop
- TypeScript 0 errors, ESLint 0 errors
- No modifications to any existing component
- No breaking changes to any Public API
- Architecture version v0.31

### WO-S4-008 — AI Configuration Consumption

- **DefaultPromptBuilder constructor simplified** — `providerName` and `modelName` params removed
  - New 8th parameter: `configuration?: AIConfiguration` (replaces old `providerName`: string + `modelName?: string`)
  - ProviderBudget lookup now uses `configuration.provider` and `configuration.model`
  - Falls back to `'openai'` provider when no configuration is provided (same default as before)
  - Builder constructor shrinks from 9 to 8 params
  - All existing 1-7 param constructors work unchanged (backward compatible)
- **AIConfiguration becomes the single configuration source** for the Prompt Assembly pipeline
  - No more separate `providerName`/`modelName` strings
  - Future configuration fields (e.g., `streaming`, `toolCalling`, `charsPerToken`) naturally slot into AIConfiguration
- **No runtime behavior changes** — only configuration flow refactored
- **No PromptBuilder interface change** — `PromptBuilder` interface unchanged
- Created ADR-0045: AI Configuration Consumption
- All 1048 tests pass (1014 existing + 19 new + 15 web) with zero modifications to existing tests
- New test file `AIConfigurationConsumption.test.ts` (19 tests, 7 groups):
  - AIConfiguration Consumption (5 tests): 8-param constructor, provider lookup, model-specific lookup, fallback, metadata
  - DefaultAIConfiguration Compatibility (2 tests): accepts DefaultAIConfiguration, uses mock provider
  - Backward Compatibility (6 tests): 1-param, 6-param, 7-param, 8-param, no configuration, identical prompt content
  - Deterministic (2 tests): identical metadata for identical config, different metadata for different providers
  - RetryPlanner Compatibility (1 test): works with RetryPlanner
  - ToolCallPlanner Compatibility (1 test): works with ToolCallPlanner
  - Streaming Compatibility (1 test): works with streaming
  - AgentLoop Compatibility (1 test): works with AgentLoop
- TypeScript 0 errors, ESLint 0 errors
- No modifications to Planner, Pipeline, Provider, Runtime, AgentLoop, PromptModule, PromptRenderer, PromptBudget, PromptSelection, PromptCompression, MemoryRanking, or any existing component
- No breaking changes to any Public API
- Architecture version v0.32

### WO-S4-010 — BuilderOptions Consumption

- **DefaultPromptBuilder constructor refactored** to consume `BuilderOptions`
  - New primary form: `constructor(modules: PromptModule[], options?: BuilderOptions)`
  - Legacy positional form preserved: `constructor(modules, renderer?, compression?, ..., configuration?)`
  - Both forms are fully type-safe via TypeScript constructor overloads
  - Runtime discriminator detects whether second arg is `BuilderOptions` (object with fields) or `PromptRenderer` (has `render` method)
  - Internally destructures `BuilderOptions` into the same private fields used by the legacy form
- **No runtime behavior changes** — execution order, pipeline flow, metadata, PromptAssembly all unchanged
- **PromptBuilder interface unchanged** — `PromptBuilder` interface not modified
- **All existing call sites compatible** — no migration needed for 1-param callers
- **All legacy constructor forms preserved:**
  - 1-param: `(modules)` — unchanged
  - 2-param: `(modules, renderer)` — unchanged
  - 3-param: `(modules, renderer, compression)` — unchanged
  - 4-param: `(modules, renderer, compression, ranking)` — unchanged
  - 5-param: `(modules, renderer, compression, ranking, budget)` — unchanged
  - 6-param: `(modules, renderer, compression, ranking, budget, selection)` — unchanged
  - 7-param: `(modules, renderer, compression, ranking, budget, selection, providerBudget)` — unchanged
  - 8-param: `(modules, renderer, compression, ranking, budget, selection, providerBudget, configuration)` — unchanged
  - All forms produce identical runtime behavior
- **BuilderOptions form verified identical** to legacy form (same output, same metadata)
- Updated ADR-0046: status changed to Superseded, consumption section added, architecture version updated
- All 1124 tests pass (1109 existing + 37 new + 15 web) with zero modifications to existing tests
- New test file `BuilderOptionsConsumption.test.ts` (37 tests, 14 groups):
  - BuilderOptions Constructor (5 tests): all fields, no options, single field, partial fields, custom implementation
  - Default Options (4 tests): no options, undefined, empty, omitted fields
  - Full Options (2 tests): full options build, full options buildContext
  - Backward Compatibility — Legacy Positional Form (9 tests): 1-param through 8-param legacy constructors, undefined params
  - Identical Behavior — BuilderOptions vs Legacy (2 tests): full param form identical, partial param form identical
  - PromptAssembly Unchanged (2 tests): assembly metadata, execution order
  - ProviderBudget Integration (2 tests): ProviderBudget passthrough, exclusion when not configured
  - AIConfiguration Integration (2 tests): configuration via BuilderOptions, ProviderBudget lookup
  - Deterministic (2 tests): same BuilderOptions, different instances same options
  - Immutability (2 tests): options not mutated, option fields not referenced after construction
  - RetryPlanner Compatibility (1 test): works with BuilderOptions
  - ToolCallPlanner Compatibility (1 test): works with BuilderOptions
  - Streaming Compatibility (1 test): works with BuilderOptions
  - AgentLoop Compatibility (2 tests): AgentLoop + Reflection, DefaultAgentLoop directly
- TypeScript 0 errors, ESLint 0 errors
- No modifications to Planner, Pipeline, Provider, Runtime, AgentLoop, PromptModule, PromptRenderer, PromptBudget, PromptSelection, PromptCompression, MemoryRanking, ProviderBudget, AIConfiguration, or any existing component
- No breaking changes to any Public API
- Architecture version v0.34

### WO-S4-011 — Sprint 4 Architecture Review

- **Comprehensive architecture review completed** — WO-S4-011
- **Review document created**: `docs/project/SPRINT4_ARCHITECTURE_REVIEW.md`
- **17 modules reviewed**: AIConfiguration, BuilderOptions, PromptBuilder, DefaultPromptBuilder, PromptAssembly, MemoryRanking, DefaultMemoryRanking, PromptBudget, DefaultPromptBudget, ProviderBudget, DefaultProviderBudget, PromptSelection, DefaultPromptSelection, PromptCompression, DefaultPromptCompression, PromptRenderer, DefaultPromptRenderer
- **Issues found**: None — architecture is clean
  - 3 pre-existing unused imports noted (result files in lint warnings)
  - 2 PROJECT_STATE.md documentation gaps corrected (AIConfiguration API block, BuilderOptions note)
- **Final verdict**: Architecture is stable. Sprint 4 should Freeze.
- **All 1124 tests pass** (1109 AI + 15 Web) with zero modifications
- **TypeScript 0 errors, ESLint 0 errors** (84 warnings, pre-existing only)
- No production code changes

### WO-S4-012 — Sprint 4 Freeze

- **Sprint 4 officially frozen** — Architecture baseline locked at v0.35
- **Review document created**: `docs/project/SPRINT4_REVIEW.md`
  - Sprint goal, completed WOs, architecture evolution, final pipeline diagram
  - Design decisions, risks, deferred work, lessons learned, sprint metrics
- **Backlog document created**: `docs/project/SPRINT5_BACKLOG.md`
  - 18 backlog items across 8 categories
  - P1 priorities: TokenCompression, Token-Aware Compression, Planner-Level Reflection
  - No implementation — backlog only
- **ADR created**: `docs/adr/ADR-0047-sprint4-freeze.md`
  - Documents all frozen interfaces
  - Extension strategy for Sprint 5
  - Architecture baseline (v0.35, 1124 tests, 0 TS errors)
- **PROJECT_STATE.md updated**:
  - Sprint 4 marked Completed (Frozen)
  - Architecture version v0.35
  - WO-S4-011 and WO-S4-012 added to completed WOs
  - Architecture version header updated
- **CHANGELOG.md updated** — WO-S4-012 entry added
- **No production code changes** — documentation only
- **All 1124 tests pass** (1109 AI + 15 Web) — unchanged
- **TypeScript 0 errors, ESLint 0 errors** — unchanged
- Architecture version v0.35 (Frozen)

- **New `BuilderOptions` interface** — consolidated options object for `DefaultPromptBuilder`
  - Created in `packages/ai/src/prompt/BuilderOptions.ts`
  - Seven optional fields, each mapping 1:1 to existing constructor parameters:
    - `renderer?: PromptRenderer`
    - `compression?: PromptCompression`
    - `ranking?: MemoryRanking`
    - `budget?: PromptBudget`
    - `selection?: PromptSelection`
    - `providerBudget?: ProviderBudget`
    - `configuration?: AIConfiguration`
  - Pure data interface — no methods, no behavior
  - All fields optional — zero breaking changes
  - Foundation only — NOT yet consumed by `DefaultPromptBuilder` constructor
- **Public exports added** — `BuilderOptions` type exported from:
  - `packages/ai/src/prompt/index.ts`
  - `packages/ai/src/index.ts` (package root)
- **No runtime behavior changes** — zero lines of runtime logic added
- **No constructor modifications** — `DefaultPromptBuilder` constructor unchanged
- **No PromptBuilder interface changes** — `PromptBuilder` interface unchanged
- **No modifications to Planner, Pipeline, Provider, Runtime, AgentLoop, PromptModule, PromptRenderer, PromptBudget, PromptSelection, PromptCompression, MemoryRanking, ProviderBudget, AIConfiguration, or any existing component**
- Created ADR-0046: BuilderOptions Foundation
- All 1087 tests pass (1072 existing + 39 new + 15 web) with zero modifications to existing tests
- New test file `BuilderOptionsFoundation.test.ts` (39 tests, 11 groups):
  - BuilderOptions Interface (10 tests): empty object, each field individually, all fields simultaneously, partial assignment
  - Optional Fields (2 tests): undefined fields, Partial type
  - Deterministic Behavior (2 tests): empty structure, all fields structure
  - Type Compatibility (8 tests): default implementations for each field, custom implementations for each field
  - Backward Compatibility (7 tests): PromptBuilder interface, 1/3/5/6/7/8-param constructors
  - PromptBuilder Unchanged (3 tests): identical build output, 8-param constructor output, buildContext output
  - RetryPlanner Compatibility (1 test): works with RetryPlanner
  - ToolCallPlanner Compatibility (1 test): works with ToolCallPlanner
  - Streaming Compatibility (1 test): works with streaming path
  - AgentLoop Compatibility (2 tests): works with AgentLoop and Reflection, DefaultAgentLoop directly
  - Exports (2 tests): exported from prompt module and package root
- TypeScript 0 errors, ESLint 0 errors
- No breaking changes to any Public API
- Architecture version v0.33

- Created `docs/project/AI_DEVELOPMENT_STANDARD.md` (v1.0)
  - Permanent engineering workflow for AI-assisted development
  - 9 development principles: Architecture First, Backward Compatibility, Foundation Before Feature, Composition Over Modification, Single Responsibility, No Temporary Hacks, No Dead Code, Immutable Preferred, Pure Functions Preferred
  - Testing requirements: TypeScript 0 errors, ESLint 0 errors, Vitest all pass, backward compatibility verified
  - Documentation requirements: ADR, PROJECT_STATE, AI_ARCHITECTURE, CHANGELOG per WO
  - Standard delivery format: Changed Files, Architecture, Compatibility, Tests, Build Status, Documentation, Risks
- Created `docs/project/ARCHITECTURE_PRINCIPLES.md` (v1.0)
  - Permanent architecture rules for all development
  - Layering: Pipeline → PromptBuilder → Planner → Provider → AgentLoop → Runtime
  - Dependency rules: one-way only, no circular, dependency inversion preferred
  - Module responsibilities table: each component owns exactly one responsibility
  - Extension strategy: composition over modification, inject via constructor
  - Prompt pipeline strict order: Context → Ranking → Budget → Selection → Compression → Renderer
  - Agent principles: Planner plans, Provider communicates, AgentLoop executes, Reflection observes, Tool executes
  - Future evolution extension points: 13 documented expected extension points
- Updated `PROJECT_STATE.md` — Sprint 4 section, new rows for Development Standards and Architecture Principles
- No runtime code changes — documentation only
- All 779 existing tests pass unchanged

---

## Sprint 5 — Post-Freeze Capabilities

### WO-S5-001 — Intent Analysis Foundation

- **Created `packages/ai/src/intent/` module** — new intent analysis abstraction layer
  - `IntentType.ts` — extensible string union: `'Create' | 'Delete' | 'Move' | 'Modify' | 'Query'`
  - `Intent.ts` — minimal immutable interface: `{ readonly type: IntentType }`
  - `IntentResult.ts` — container interface: `{ readonly intents: Intent[] }`
  - `IntentAnalyzer.ts` — interface: `analyze(input: string): IntentResult`
  - `DefaultIntentAnalyzer.ts` — placeholder implementation returning `{ intents: [] }`
  - `index.ts` — barrel exports for all intent types
- **Public exports** — all intent types exported from:
  - `packages/ai/src/intent/index.ts`
  - `packages/ai/src/index.ts` (package root)
- **No dependencies on Planner, Runtime, Provider, Memory, ToolCalling, AgentLoop, PromptBuilder, or Pipeline**
- **No integration** — IntentAnalyzer is NOT wired into Pipeline, PromptBuilder, or any other component
- **Architecture compliance verified:**
  - Pure: no side effects, no mutation of inputs
  - Deterministic: same input always produces same output
  - Stateless: no internal state between calls
  - Immutable: all Intent/IntentResult fields are readonly
  - No dependencies on any existing component
- Created ADR-0048: Intent Analysis Foundation
- All existing tests pass with zero modifications
- New test file `IntentAnalysisFoundation.test.ts` (71 tests, 11 groups):
  - IntentType (6 tests): each type, string comparison
  - Intent (7 tests): each type creation, frozen, object literal, array
  - IntentResult (6 tests): empty, single, multiple, all types, frozen, empty valid
  - DefaultIntentAnalyzer (11 tests): interface impl, empty/non-empty/complex input, deterministic, idempotent, stateless, no side effects, type structure, IntentType discriminator, zero dependencies
  - Exports (10 tests): from intent/index and package root (types + class)
  - Backward Compatibility (10 tests): all existing interfaces unchanged
  - RetryPlanner Compatibility (2 tests): works with RetryPlanner
  - ToolCallPlanner Compatibility (2 tests): works with ToolCallPlanner
  - Streaming Compatibility (2 tests): works with StreamingProvider
  - AgentLoop Compatibility (3 tests): works with DefaultAgentLoop, Reflection
  - Architecture Compliance (12 tests): no dependencies on Planner/Runtime/Provider/Memory/ToolCalling/AgentLoop/PromptBuilder/Pipeline, no side effects, pure, stateless, non-mutating
- TypeScript 0 errors, ESLint 0 errors
- No modifications to Planner, Pipeline, Provider, Runtime, AgentLoop, PromptModule, PromptRenderer, PromptBudget, PromptSelection, PromptCompression, MemoryRanking, ProviderBudget, AIConfiguration, BuilderOptions, or any existing component
- No breaking changes to any Public API
- Architecture version v0.36

### WO-S5-002 — Rule-Based Intent Analyzer

- **Created `RuleBasedIntentAnalyzer`** — production V1 keyword-based intent detector
  - `packages/ai/src/intent/RuleBasedIntentAnalyzer.ts`
  - Detects all 5 foundation intent types: Create, Delete, Move, Modify, Query
  - Chinese keywords: 创建, 生成, 画, 添加, 放一个, 放一棵, 删除, 移除, 清除, 移动, 挪, 修改, 改变, 编辑, 查询, 看看, 有什么
  - English keywords: spawn, create, draw, add, make, remove, delete, move, translate, replace, change, what, show, list
  - Multi-intent detection via separator-based segmentation (， 、 。 , . 再 然后 and then)
  - Duplicate removal preserving input order
  - Case-insensitive English matching
  - Unknown/empty input returns `{ intents: [] }` (never throws)
  - Pure, stateless, deterministic — no I/O, no LLM, no external dependencies
- **Public exports** — `RuleBasedIntentAnalyzer` exported from:
  - `packages/ai/src/intent/index.ts`
  - `packages/ai/src/index.ts` (package root)
- **No modifications to existing interfaces** — Intent, IntentType, IntentResult, IntentAnalyzer unchanged
- **DefaultIntentAnalyzer unaffected** — continues working unchanged
- Created ADR-0049: Rule-Based Intent Analyzer
- All existing tests pass with zero modifications
- New test file `RuleBasedIntentAnalyzer.test.ts` (93 tests, 14 groups):
  - Create (11 tests): all 6 Chinese + 5 English keywords
  - Delete (5 tests): all 3 Chinese + 2 English keywords
  - Move (4 tests): all 2 Chinese + 2 English keywords
  - Modify (5 tests): all 3 Chinese + 2 English keywords
  - Query (6 tests): all 3 Chinese + 3 English keywords
  - Case Insensitivity (6 tests): UPPERCASE, Capitalized, lowercase, mixed, UPPERCASE delete and move
  - Multiple Keywords Same Intent (2 tests): multiple Create keywords, multiple Delete keywords
  - Multiple Intents (8 tests): Create+Delete, Create+Move, Modify+Query, Chinese multi-intent with ，, with 再, with ，再, with and, Move+Create with then
  - Duplicate Removal (4 tests): Chinese dedup, English dedup, Delete dedup, Move+Create+Move dedup order
  - Unknown Input (14 tests): empty, whitespace, tabs, newlines, greeting, weather, gibberish, emoji, special chars, numbers, mixed, null-like, long strings, no throw
  - Deterministic (3 tests): same input repeated, each Chinese type, idempotent across 10 calls
  - Stateless (2 tests): no state between calls, independent instances
  - Immutability (2 tests): input unchanged, new result per call
  - Architecture Compliance (7 tests): implements IntentAnalyzer, has analyze method, returns IntentResult type, pure, stateless, exports, type from root
  - DefaultIntentAnalyzer Unaffected (2 tests): still returns empty
  - Mixed Inputs (7 tests): Chinese+English mixed, Chinese intent+English object, punctuation, multiple separators, trailing/leading separator
  - RetryPlanner Compatibility (2 tests): works with RetryPlanner
  - ToolCallPlanner Compatibility (2 tests): works with ToolCallPlanner
  - Streaming Compatibility (2 tests): works with StreamingProvider
  - AgentLoop Compatibility (2 tests): works with DefaultAgentLoop
- TypeScript 0 errors, ESLint 0 errors
- No modifications to Planner, Pipeline, Provider, Runtime, AgentLoop, PromptModule, PromptRenderer, PromptBudget, PromptSelection, PromptCompression, MemoryRanking, ProviderBudget, AIConfiguration, BuilderOptions, or any existing component
- No breaking changes to any Public API
- Architecture version v0.37