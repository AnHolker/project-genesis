# AI Architecture

> Project Genesis — AI Architecture Reference (v0.8)
> Primary reference for all AI development.

---

## High-Level Architecture

```
User Natural Language
    ↓
Pipeline.execute(PipelineContext)
    ↓
PromptBuilder.build(context)         ← composes prompt from PromptModule[4]
    ├── SystemPromptModule            ← system instructions, action schema
    ├── UserInputModule               ← context.input
    ├── MemoryPromptModule            ← conversation history from Memory
    └── WorldStatePromptModule        ← context.worldState
    ↓
AIRequest { prompt }
    ↓
Planner.plan(request)
    ↓
ProviderFactory.create(config)        ← selects from AIConfiguration.provider
    ↓
PlannerProvider.complete(request)     ← calls LLM API
    ↓
StructuredOutputValidator.validate()  ← validates action schema
    ↓
PlannerResult { actions, reasoning? }
    ↓
Runtime.applyActions(actions)         ← dispatches through Action Handlers
    ↓
World
    ↓
Renderer
```

---

## Component Responsibilities

### Pipeline

The **only** AI entry point. Orchestrates the flow from user input to planner result.

```
Pipeline.execute(context: PipelineContext): Promise<PipelineContext>
Pipeline.stream(context: PipelineContext): Promise<PipelineContext>
```

- Receives `PipelineContext` with user input
- Delegates prompt construction to `PromptBuilder`
- Delegates planning to `Planner`
- Emits lifecycle events through `PipelineEventEmitter`
- `stream()` emits `StreamChunk` events while the provider generates the response
- If the provider supports `StreamingPlannerProvider`, `stream()` uses streaming; otherwise falls back to `Planner.plan()`
- Both methods return enriched `PipelineContext` with `plannerResult`
- `stream()` is visualization only — Runtime executes only after stream completes and validation passes

### PipelineContext

Data object that flows through the pipeline. Stages communicate **only** through this object.

```typescript
interface PipelineContext {
  input: string
  plannerResult?: PlannerResult
  memory?: Memory
  worldState?: string
  metadata?: Record<string, unknown>
}
```

- Carries user input in
- Carries planner result out
- Optionally carries `Memory` for prompt modules
- Optionally carries `worldState` — pre-formatted world snapshot string
- Extensible via `metadata`

### PromptBuilder

Composes the `AIRequest.prompt` string from modular fragments.

```typescript
interface PromptBuilder {
  build(context: PipelineContext): Promise<AIRequest>
}
```

- Iterates over `PromptModule[]` and concatenates their outputs
- Each module contributes a section to the final prompt
- The builder is the **only** component that constructs `AIRequest`

### PromptModule

Pluggable prompt fragment generator. Each module contributes a section to the final prompt.

```typescript
interface PromptModule {
  build(context: PipelineContext): Promise<string>
}
```

Current modules (in composition order):

1. **SystemPromptModule** — returns the system prompt text: "You are a game action planner for Project Genesis..." — defines available actions, JSON output format, and constraints
2. **UserInputModule** — returns `context.input` verbatim
3. **MemoryPromptModule** — reads conversation history from Memory and formats it as context
4. **WorldStatePromptModule** — wraps `context.worldState` in a "Current World:" header section

### Prompt Composition Order

```
SystemPromptModule
       ↓
UserInputModule
       ↓
MemoryPromptModule
       ↓
WorldStatePromptModule
       ↓
DefaultPromptBuilder.build() joins with '\n'
       ↓
AIRequest { prompt }

### AIRequest

The input model for the Planner. Contains the composed prompt.

```typescript
interface AIRequest {
  prompt: string
  metadata?: Record<string, unknown>
}
```

- Created by PromptBuilder
- Consumed by Planner/PlannerProvider
- Never constructed manually by Pipeline

### Planner

Orchestration layer that delegates planning to a `PlannerProvider`.

```typescript
interface Planner {
  plan(request: AIRequest): Promise<PlannerResult>
}
```

- Does **not** contain planning logic itself
- Delegates to the injected `PlannerProvider`
- Can be extended with retry, validation, or caching without modifying providers
- `RetryPlanner` wraps any `PlannerProvider` with automatic retry logic:
  - Retries on recoverable failures (invalid JSON, schema validation failure, malformed actions)
  - Does not retry non-recoverable errors (auth, rate limits, network failures)
  - Emits `PlannerRetryStarted`/`PlannerRetryFinished` events during retry
  - Tracks `retryCount`, `planningAttempts`, `lastValidationError` in `PlannerResult.metadata`

### PlannerProvider

The interface for concrete AI implementations. Each provider calls a specific LLM API.

```typescript
interface PlannerProvider {
  complete(request: AIRequest): Promise<PlannerResult>
}
```

Current providers:
| Provider | API | SDK Method |
|----------|-----|------------|
| MockPlannerProvider | None (keyword matching) | N/A |
| OpenAIPlannerProvider | OpenAI Responses API | `client.responses.create()` |
| DeepSeekPlannerProvider | DeepSeek via OpenAI-compatible Chat Completions | `client.chat.completions.create()` |

### PlannerResult

The output model returned by the Planner.

```typescript
interface PlannerResult {
  actions: Action[]
  reasoning?: string
  metadata?: Record<string, unknown>
}
```

- `actions` — Runtime-compatible action objects (CreateEntity, MoveEntity)
- `reasoning` — optional explanation of the planning decision
- `metadata` — extensible for future use (token counts, latency, etc.)

### Runtime

Executes actions against the World. **Independent** of the AI pipeline.

```typescript
class Runtime {
  readonly world: World
  readonly query: RuntimeQuery
  applyActions(actions: Action[]): void
}
```

- Owns `World` — only Runtime may mutate it
- Dispatches actions through registered `ActionHandler` instances
- Never knows about AI, Planner, or Pipeline

---

## Provider Hierarchy

```
PlannerProvider (interface)
  ├── MockPlannerProvider       — keyword matching, no API required
  │     "tree" → CreateEntity
  │     "move" → MoveEntity
  │     other  → { actions: [] }
  │
  ├── OpenAIPlannerProvider     — OpenAI Responses API
  │     Uses: client.responses.create()
  │     Requires: apiKey, model
  │     Output: JSON with { actions: [...] }
  │     Also implements: StreamingPlannerProvider (stream via client.responses.create({ stream: true }))
  │
  └── DeepSeekPlannerProvider   — DeepSeek Chat Completions API
        Uses: client.chat.completions.create() (OpenAI-compatible)
        Requires: apiKey, baseURL, model
        Output: JSON with { actions: [...] }
        Also implements: StreamingPlannerProvider (stream via client.chat.completions.create({ stream: true }))

StreamingPlannerProvider (interface, extends PlannerProvider)
  └── MockStreamingProvider     — char-by-char streaming for testing
        OpenAIPlannerProvider    — also implements StreamingPlannerProvider
        DeepSeekPlannerProvider  — also implements StreamingPlannerProvider

RetryPlanner (implements Planner, wraps PlannerProvider)
  └── RetryPolicy              — configurable retry policy
        Works with: MockPlannerProvider, OpenAIPlannerProvider, DeepSeekPlannerProvider
        Retry events: PlannerRetryStarted, PlannerRetryFinished

ToolCallPlanner (implements Planner, wraps PlannerProvider + ToolRegistry)
  └── ToolRegistry              — tool registration and lookup
        └── Tool (interface)     — name, description, execute()
              ├── MockFindEntityTool — returns hardcoded entity data
        Events: ToolCallStarted, ToolCallFinished
```

Provider selection is centralized in `ProviderFactory`:

```typescript
const provider = ProviderFactory.create(config)
// config.provider = "mock"     → MockPlannerProvider
// config.provider = "openai"   → OpenAIPlannerProvider
// config.provider = "deepseek" → DeepSeekPlannerProvider
// unknown                       → throws Error
```

### StructuredOutputValidator

Validates that raw LLM responses conform to the expected action schema before they reach Runtime.

```typescript
class StructuredOutputValidator {
  static validate(parsed: unknown): PlannerResult
}
```

- Checks that `actions` is an array
- Filters out malformed actions (missing `type` field)
- Returns valid `{ actions: [...] }` result
- Used by both `OpenAIPlannerProvider` and `DeepSeekPlannerProvider` in `parseResponse()`

### Environment Configuration

Creates `AIConfiguration` from Vite environment variables, allowing runtime provider selection without code changes.

```typescript
function createAIConfiguration(env?: Record<string, string | undefined>): AIConfiguration
```

- `VITE_AI_PROVIDER` → `provider`
- `VITE_AI_API_KEY` → `apiKey`
- `VITE_AI_MODEL` → `model`
- `VITE_AI_BASE_URL` → `baseURL`
- `VITE_AI_TEMPERATURE` → `temperature`
- `VITE_AI_MAX_TOKENS` → `maxTokens`

Falls back to `DefaultAIConfiguration` (mock provider) when environment variables are not set.

---

## Tool Calling Architecture

The Tool Calling layer provides a provider-independent abstraction for the Planner to invoke tools during planning.

### Tool Interface

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

### ToolRegistry Interface

```typescript
interface ToolRegistry {
  getTools(): Tool[]
  findTool(name: string): Tool | undefined
}
```

`DefaultToolRegistry` provides a Map-based implementation with O(1) lookup.

### ToolCallPlanner

`ToolCallPlanner` implements `Planner` and wraps a `PlannerProvider` + `ToolRegistry`.

```
ToolCallPlanner.plan(request)
    ↓
Retrieve tools from ToolRegistry
    ↓
Enhance AIRequest with tool descriptions in prompt + metadata
    ↓
Emit ToolCallStarted (payload: { toolNames })
    ↓
Provider.complete(enhancedRequest)
    ↓
Emit ToolCallFinished (payload: { toolNames, success })
    ↓
Return PlannerResult with metadata.tools
```

### Current Tools

| Tool | Name | Description |
|------|------|-------------|
| MockFindEntityTool | `find_entity` | Returns hardcoded mock entity data (no Runtime access) |

### Tool Layering

```
Pipeline → ToolCallPlanner → PlannerProvider → Concrete Provider
                ↑
          ToolRegistry → Tool (interface)
                            ├── MockFindEntityTool (mock data only)
                            └── (future: Runtime-backed tools)
```

- The AI layer depends only on `Tool` and `ToolRegistry` abstractions
- No provider directly imports Runtime
- ToolCallPlanner is additive — existing planners work unchanged

---

## Prompt Generation Flow

```
PipelineContext { input: "增加一棵树", memory: DefaultMemory, worldState: "Tree\nid: tree-1\nposition: (3,5)" }
    ↓
DefaultPromptBuilder.build(context)
    ↓
Iterates PromptModule[4] (in order)
    ├── SystemPromptModule.build()     → "You are a game action planner..."
    ├── UserInputModule.build(context) → "增加一棵树"
    ├── MemoryPromptModule.build()     → "Previous actions:\n- Applied 1 action(s)"
    └── WorldStatePromptModule.build()  → "Current World:\n\nTree\nid: tree-1\nposition: (3,5)"
    ↓
Concatenate fragments with '\n' separator
    ↓
AIRequest { prompt: "You are a game action planner...\n增加一棵树\nPrevious actions:\n...\nCurrent World:\n..." }
```

---

## Memory Flow

```
User sends input
    ↓
PipelineContext carries DefaultMemory
    ↓
MemoryPromptModule reads "conversation" key
    ↓
Prompt includes conversation history
    ↓
PlannerProvider receives full context
    ↓
After planning, gameStore stores result:
    memory.set("conversation", [...history, { input, summary }])
```

- `DefaultMemory` is a Map-based in-memory store
- Key: `"conversation"` → `Array<{ input: string, summary: string }>`
- Memory is **not** persisted across page refreshes
- Memory integration is optional — `PipelineContext.memory` is nullable

---

## Event Flow

```
Pipeline.execute() with ToolCallPlanner emits:
  1. PipelineStarted
  2. PromptBuilt          (payload: { prompt })
  3. PlannerStarted
  4. ToolCallStarted      (payload: { toolNames })
  5. ToolCallFinished     (payload: { toolNames, success })
  6. [PlannerRetryStarted]   ← only if RetryPlanner wraps ToolCallPlanner (payload: { retryCount, validationReason })
  7. [PlannerRetryFinished]  ← only if RetryPlanner wraps ToolCallPlanner (payload: { retryCount, validationReason })
  8. PlannerFinished
  9. PipelineFinished

Pipeline.stream() emits:
  1. PipelineStarted
  2. PromptBuilt          (payload: { prompt })
  3. PlannerStarted
  4. StreamChunk          (payload: { chunk })  ← one per text chunk from provider
  5. PlannerFinished
  6. PipelineFinished
```

- Events are fire-and-forget — Pipeline never waits for listeners
- `PipelineEventEmitter` supports `subscribe` / `unsubscribe`
- Events carry `timestamp` and optional `payload`
- Useful for logging, debugging, and UI progress indicators

---

## Configuration Flow

```
AIConfiguration
  ├── provider: string          "mock" | "openai" | "deepseek"
  ├── model: string             model identifier
  ├── apiKey?: string           API key (required for openai, deepseek)
  ├── baseURL?: string          custom endpoint (required for deepseek)
  ├── temperature: number       response randomness (0.0–2.0)
  └── maxTokens: number         max output tokens

DefaultAIConfiguration:
  provider="mock", model="mock", temperature=0, maxTokens=0

Usage:
  const config: AIConfiguration = { ... }
  const provider = ProviderFactory.create(config)
  const planner = new MockPlanner(provider)
  const pipeline = new DefaultPipeline(planner, promptBuilder)
```

---

## Dependency Rules

1. **Pipeline depends on Planner and PromptBuilder** — never on concrete providers
2. **Planner depends on PlannerProvider interface** — never on concrete providers
3. **ProviderFactory depends on all concrete providers** — it is the only place that knows them
4. **Concrete providers depend on AIConfiguration and PlannerProvider interface** — nothing else
5. **Runtime is independent** — never imports from `@genesis/ai`
6. **Memory is optional** — PipelineContext.memory is nullable
7. **WorldState is optional** — PipelineContext.worldState is nullable
8. **Events are fire-and-forget** — no component knows its listeners

Dependency direction (must never be violated):

```
Pipeline → Planner → PlannerProvider → Concrete Provider
                                         ↑
                                    AIConfiguration

RetryPlanner (implements Planner)
  ├── wraps PlannerProvider
  ├── uses RetryPolicy
  └── emits retry events via PipelineEventEmitter

ToolCallPlanner (implements Planner)
  ├── wraps PlannerProvider
  ├── uses ToolRegistry → Tool
  └── emits tool events via PipelineEventEmitter

Pipeline → PromptBuilder → PromptModule[]
                              ├── SystemPromptModule (no deps)
                              ├── UserInputModule (no deps)
                              ├── MemoryPromptModule → Memory
                              └── WorldStatePromptModule (no deps — reads string)

StructuredOutputValidator (used by OpenAIPlannerProvider, DeepSeekPlannerProvider)

Runtime (independent)
```

**Key constraint**: PromptModules must never import Runtime, World, or entity types. World state information flows through `PipelineContext.worldState` as a pre-formatted string, serialized by the application layer.

---

## Extension Points

### Adding a new Provider

1. Create `packages/ai/src/provider/<Name>PlannerProvider.ts`
2. Implement `PlannerProvider` interface
3. Add a case to `ProviderFactory.create()`
4. Export from `provider/index.ts` and `src/index.ts`

See [PROVIDER_GUIDE.md](./PROVIDER_GUIDE.md) for step-by-step instructions.

### Adding a new PromptModule

1. Create `packages/ai/src/prompt/modules/<Name>PromptModule.ts`
2. Implement `PromptModule` interface
3. Add to `modules/index.ts`
4. Wire into `DefaultPromptBuilder` at the composition root (e.g., `gameStore.ts`)

Modules are added to the constructor array of `DefaultPromptBuilder`:
```typescript
new DefaultPromptBuilder([
  new SystemPromptModule(),
  new UserInputModule(),
  new MemoryPromptModule(),
  new WorldStatePromptModule(),
])
```

Order matters — modules appear in the prompt in array order.

### Adding a new Action Type

1. Define action type in `@genesis/shared`
2. Create `ActionHandler` in `@genesis/runtime`
3. Register handler in `Runtime` constructor
4. Update system prompt in providers (or PromptModule)

### Adding a new Memory Implementation

1. Create class implementing `Memory` interface
2. Replace `DefaultMemory` at the composition root
3. No other code changes needed

---

## See Also

- [PROVIDER_GUIDE.md](./PROVIDER_GUIDE.md) — Step-by-step provider development guide
- [AI_INTEGRATION.md](./AI_INTEGRATION.md) — How to configure and switch AI providers
