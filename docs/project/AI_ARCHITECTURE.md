# AI Architecture

> Project Genesis — AI Architecture Reference (v0.34)
> Primary reference for all AI development.

### BuilderOptions

`BuilderOptions` is a consolidated options interface for `DefaultPromptBuilder`, introduced in WO-S4-009.

```typescript
interface BuilderOptions {
  renderer?: PromptRenderer
  compression?: PromptCompression
  ranking?: MemoryRanking
  budget?: PromptBudget
  selection?: PromptSelection
  providerBudget?: ProviderBudget
  configuration?: AIConfiguration
}
```

**Current status:** Foundation only — the interface exists and is publicly exported, but is NOT yet consumed by `DefaultPromptBuilder`. The constructor still uses positional parameters.

**Design principles:**
- All fields are optional
- Each field maps 1:1 to an existing constructor parameter
- No new fields beyond what the constructor already accepts
- Pure data interface — no methods, no behavior

**Future:** BuilderOptions will replace the positional parameter constructor in a future Work Order.

---

## High-Level Architecture

```
User Natural Language
    ↓
Pipeline.execute(PipelineContext)
    ↓
PromptBuilder.build(context)         ← Prompt Assembly Orchestrator
    ├── ObservationPromptModule         ← reads context.metadata.observations
    ├── SystemPromptModule              ← system instructions, action schema
    ├── UserInputModule                 ← context.input
    ├── MemoryPromptModule              ← conversation history from Memory
    ├── WorldStatePromptModule          ← context.worldState
    └── ReflectionPromptModule          ← reads context.metadata.reflectionResults
    ↓
PromptContext (structured intermediate)
    ↓
MemoryRanking.rank()                 ← determines section priority (pure measurement)
    ↓
PromptBudget.calculate()              ← measures section sizes (pure measurement)
    ↓
ProviderBudget.getBudget()            ← looks up provider/model capacity (pure lookup)
    ↓
PromptSelection.select()              ← decides which sections to preserve (consumes ranking + budget + providerBudget)
    ↓
PromptCompression.compress()          ← cleans/strips PromptContext before render
    ↓
PromptRenderer.render()              ← converts PromptContext to string
    ↓
AIRequest { prompt, metadata }       ← metadata includes ranking, budget, providerBudget & selection results
    ↓
AgentLoop.execute(request, planner)  ← wraps Planner.plan() with iteration control
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
- Delegates planning to **`AgentLoop`** (which internally calls `Planner.plan()`)
- `DefaultPipeline` creates a `DefaultAgentLoop` internally if none is provided
- Emits lifecycle events through `PipelineEventEmitter`
- `stream()` emits `StreamChunk` events while the provider generates the response
- If the provider supports `StreamingPlannerProvider`, `stream()` uses streaming; otherwise falls back to `AgentLoop.execute()`
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

The **Prompt Assembly Orchestrator**. Composes the `AIRequest.prompt` string by orchestrating the full Prompt Pipeline:

```typescript
interface PromptBuilder {
  build(context: PipelineContext): Promise<AIRequest>
}
```

- Iterates over `PromptModule[]` and collects structured `PromptContext` via each module's `buildContext()` method
- Merges partial contexts into a unified `PromptContext`
- Executes the Prompt Assembly pipeline in order:
  1. `MemoryRanking.rank()` — determines section priority (pure measurement, does not modify context)
  2. `PromptBudget.calculate()` — measures section sizes (pure measurement, does not modify context)
  3. `PromptSelection.select()` — decides which sections to preserve (pure decision, does not modify context)
  4. `PromptCompression.compress()` — cleans/strips context (returns new PromptContext)
  5. `PromptRenderer.render()` — converts compressed context to string
- Attaches ranking, budget, and selection results to `AIRequest.metadata.promptAssembly`
- Also exposes `buildContext(context): Promise<PromptContext>` for structured access (compressed)
- The builder is the **only** component that constructs `AIRequest`
- Cannot render strings — that is the Renderer's sole responsibility

**Constructor:**
```typescript
// Primary form (WO-S4-010, recommended):
constructor(
  modules: PromptModule[],
  options?: BuilderOptions,          // ← single options object (WO-S4-010)
)

// Legacy positional form (backward compatible):
constructor(
  modules: PromptModule[],
  renderer?: PromptRenderer,          // default: DefaultPromptRenderer
  compression?: PromptCompression,    // default: DefaultPromptCompression
  ranking?: MemoryRanking,            // default: DefaultMemoryRanking
  budget?: PromptBudget,              // default: DefaultPromptBudget
  selection?: PromptSelection,        // default: DefaultPromptSelection
  providerBudget?: ProviderBudget,    // default: undefined
  configuration?: AIConfiguration,    // default: undefined (falls back to 'openai' provider)
)
```

All optional parameters are fully backward compatible — existing 1-8 param constructors continue working unchanged.
The `BuilderOptions` form is the recommended way to construct `DefaultPromptBuilder`. It consolidates all optional collaborators into a single object, preventing future constructor parameter growth.

`BuilderOptions` fields:
```typescript
interface BuilderOptions {
  renderer?: PromptRenderer
  compression?: PromptCompression
  ranking?: MemoryRanking
  budget?: PromptBudget
  selection?: PromptSelection
  providerBudget?: ProviderBudget
  configuration?: AIConfiguration
}
```

### PromptRenderer

The sole component responsible for converting a structured `PromptContext` into a final prompt string.

```typescript
interface PromptRenderer {
  render(context: PromptContext): string
}
```

- `render()` — converts PromptContext to string (default: insertion order = module array order)
- `DefaultPromptRenderer` — default implementation
  - `render()` — insertion order (preserves module array ordering)
  - `renderWithOrder()` — canonical field order (for `serializePromptContext` compatibility)
- Future implementations: XMLPromptRenderer, JSONPromptRenderer, OpenAIPromptRenderer, ClaudePromptRenderer
- All prompt text output must go through a PromptRenderer
- Compression is handled before render by PromptCompression — not by PromptRenderer

### PromptModule

Pluggable prompt fragment generator. Each module contributes a section to the final prompt.

```typescript
interface PromptModule {
  build(context: PipelineContext): Promise<string>
  buildContext?(context: PipelineContext): Promise<Partial<PromptContext>>
}
```

- `build()` — unchanged, returns formatted string fragment (backward compatible)
- `buildContext()` — new, returns structured `Partial<PromptContext>` with only this module's fields
- All 6 built-in modules implement both methods
- Legacy modules (build() only) continue working unchanged — `DefaultPromptBuilder` falls back to `build()`

Current modules (in composition order):

1. **ObservationPromptModule** — reads `context.metadata?.observations` and formats them as a "## Previous Observations" section. This is the canonical formatting — all observation prompt text originates from PromptBuilder.
2. **SystemPromptModule** — returns the system prompt text: "You are a game action planner for Project Genesis..." — defines available actions, JSON output format, and constraints
3. **UserInputModule** — returns `context.input` verbatim
4. **MemoryPromptModule** — reads conversation history from Memory and formats it as context
5. **WorldStatePromptModule** — wraps `context.worldState` in a "Current World:" header section
6. **ReflectionPromptModule** — reads `context.metadata?.reflectionResults` and formats them as a "## Previous Reflection" section. This is the canonical formatting — all reflection prompt text originates from PromptBuilder.

### Prompt Composition Order (via Prompt Assembly)

```
PromptModule[6]
  ├── SystemPromptModule.buildContext()    → { system: "..." }
  ├── UserInputModule.buildContext()       → { userInput: "..." }
  ├── MemoryPromptModule.buildContext()    → { memory: "..." }
  ├── WorldStatePromptModule.buildContext() → { worldState: "..." }
  ├── ObservationPromptModule.buildContext() → { observations: "..." }
  └── ReflectionPromptModule.buildContext() → { reflections: "..." }
                      ↓
            Merge into PromptContext
                      ↓
       [MemoryRanking.rank()]            ← pure measurement → stored in metadata
                      ↓
       [PromptBudget.calculate()]         ← pure measurement → stored in metadata
                      ↓
       [ProviderBudget.getBudget()]        ← pure lookup → stored in metadata (NEW WO-S4-006)
                      ↓
       [PromptSelection.select(            ← consumes ranking + budget + providerBudget
         context,
         rankingResult,
         budgetResult,
         providerBudgetResult,             ← NEW: provider token capacity
       )]
                      ↓
       [PromptCompression.compress(       ← consumes selection result (WO-S4-003)
         PromptContext,                   removes excluded + undefined + empty
         selectionResult,                 returns new PromptContext
       )]
                      ↓
       [PromptRenderer.render()]          ← converts PromptContext to string
                      ↓
            AIRequest { prompt, metadata.promptAssembly }

PromptContext (structured intermediate representation):
  { system?, userInput?, memory?, worldState?, observations?, reflections? }

DefaultPromptBuilder.buildContext(context) → PromptContext (compressed, pipeline run)
serializePromptContext(ctx: PromptContext) → string (delegates to DefaultPromptRenderer)

DefaultPromptRenderer (implements PromptRenderer):
  render(ctx)     → insertion order (module array order for builder)
  renderWithOrder(ctx) → canonical order (for serializePromptContext)

### PromptCompression

Pluggable compression layer between PromptContext assembly and rendering.
Since WO-S4-003, compression consumes PromptSelectionResult to remove excluded
sections in addition to its existing empty/undefined field stripping.

```typescript
interface PromptCompression {
  compress(
    context: PromptContext,
    selection?: PromptSelectionResult,  // ← NEW (WO-S4-003)
  ): PromptContext
}
```

- Accepts `PromptContext`, returns a new `PromptContext` (never mutates input)
- No dependencies on Planner, Provider, Runtime, or AgentLoop
- Injected into `DefaultPromptBuilder` constructor (optional, defaults to `DefaultPromptCompression`)
- Applies to both `build()` and `buildContext()` outputs

**DefaultPromptCompression** — strips `undefined` and empty string `''` fields, and
removes sections excluded by PromptSelection. Idempotent, non-mutating, deterministic.

**Future implementations** (not implemented):
- RuleBasedCompression — configurable field filtering
- TokenCompression — truncate by token count
- LLMCompression — summarize sections via LLM

### PromptBudget

Standalone budget calculation layer for measuring PromptContext sizes.
Since WO-S4-004, DefaultPromptBudget calculates an estimated token count
using a configurable chars-per-token ratio (default: 4).

```typescript
interface PromptBudget {
  calculate(context: PromptContext): PromptBudgetResult
}
```

- `calculate()` — accepts `PromptContext`, returns `PromptBudgetResult`
- Pure function: reads context, returns measurement — never modifies input
- No dependencies on Planner, Provider, Runtime, or AgentLoop
- Not integrated with PromptBuilder or Compression (deferred to future WOs)

**PromptBudgetResult:**
```typescript
interface PromptBudgetResult {
  totalLength: number             // Total character length across all sections
  sectionLengths: Record<string, number>  // Per-section character lengths
  estimatedTokens?: number        // Optional — undefined by default
}
```

**DefaultPromptBudget** — character-count implementation with rule-based token estimation.
- Iterates known PromptContext fields, records `.length` for each
- Returns `totalLength` and `sectionLengths`
- Calculates `estimatedTokens = Math.ceil(totalLength / charsPerToken)`
- Configurable `charsPerToken` ratio via constructor (default: 4)
- Returns `estimatedTokens` as `undefined` when `totalLength` is 0

**Future implementations** (not implemented):
- TokenBudget — real tokenizer (tiktoken, etc.)
- ModelSpecificBudget — model-aware budget

### ProviderBudget

Standalone configuration component that represents the token capacity of different AI providers and models. Completely independent from PromptBudget — it measures provider capacity, not prompt size.

```typescript
interface ProviderBudget {
  getBudget(provider: string, model?: string): ProviderBudgetResult
}
```

- `getBudget()` — accepts provider name and optional model name, returns capacity limits
- Pure lookup: no side effects, no I/O, no network requests, no SDK calls
- No dependencies on PromptBudget, PromptSelection, PromptCompression, Planner, or Provider
- Not integrated with PromptBuilder — configuration only, wired in future WOs

**ProviderBudgetResult:**
```typescript
interface ProviderBudgetResult {
  maxInputTokens: number             // Maximum input tokens this provider/model supports
  maxOutputTokens?: number            // Optional maximum output tokens
}
```

**DefaultProviderBudget** — static lookup table with conservative defaults:

| Provider | maxInputTokens | maxOutputTokens |
|----------|---------------|-----------------|
| openai (generic) | 8,192 | 4,096 |
| deepseek (generic) | 65,536 | 8,192 |
| anthropic (generic) | 100,000 | 4,096 |
| mock | 4,096 | 1,024 |
| unknown | 4,096 | 1,024 |

Model-specific overrides (e.g., gpt-4o → 128,000 input, 16,384 output) are resolved when a model name is provided.

**Future implementations** (not implemented):
- ProviderBudget → PromptSelection integration (implemented in WO-S4-006)
- Dynamic capability discovery from provider APIs
- Custom provider budgets via configuration

### MemoryRanking

Pluggable ranking layer that determines section priority without modifying PromptContext.

```typescript
interface MemoryRanking {
  rank(context: PromptContext): MemoryRankingResult
}
```

- `rank()` — accepts `PromptContext`, returns `MemoryRankingResult`
- Pure function: reads context, returns priority info — never modifies input
- No dependencies on Planner, Provider, Runtime, or AgentLoop
- Not integrated with PromptBuilder or Compression (deferred to future WOs)

**MemoryRankingResult:**
```typescript
interface MemoryRankingResult {
  rankedSections: string[]            // Section names sorted by priority (highest first)
  priorities: Record<string, number>  // Per-section priority scores
}
```

**DefaultMemoryRanking** — fixed priority rules:

| Section | Priority | Rationale |
|---------|----------|-----------|
| userInput | 100 (Highest) | What the user asked |
| reflections | 80 | Task-specific AI insight |
| observations | 60 | Current tool execution context |
| memory | 40 | Conversation continuity |
| worldState | 20 | Spatial context |
| system | 10 (Lowest) | Static instructions |

- Only populated sections included
- Unknown sections get priority 0
- `DEFAULT_RANKING_PRIORITY` exported as constant
- Provider-agnostic (no OpenAI/DeepSeek binding)

**Future implementations** (not implemented):
- HeuristicRanking — score by recency, length, keyword match
- EmbeddingRanking — semantic similarity via embeddings
- LLMRanking — LLM-based importance evaluation

### PromptSelection

Pluggable selection layer that decides which PromptContext sections should participate in the final prompt, without modifying the context. Since WO-S4-002, PromptSelection consumes MemoryRanking and PromptBudget results for rule-based decisions.

```typescript
interface PromptSelection {
  select(
    context: PromptContext,
    ranking?: MemoryRankingResult,
    budget?: PromptBudgetResult,
    providerBudget?: ProviderBudgetResult,  // ← NEW (WO-S4-006)
  ): PromptSelectionResult
}
```

- `select()` — accepts `PromptContext` with optional `MemoryRankingResult`, `PromptBudgetResult`, and `ProviderBudgetResult`
- Pure function: reads context + ranking + budget + providerBudget, returns decision — never modifies input
- No dependencies on Planner, Provider, Runtime, or AgentLoop
- Slotted between ProviderBudget and Compression in the Prompt Assembly pipeline

**PromptSelectionResult:**
```typescript
interface PromptSelectionResult {
  selectedSections: string[]      // Sections to preserve
  excludedSections: string[]       // Sections to exclude (empty for default)
}
```

**DefaultPromptSelection** — rule-based budget-aware implementation:
- Preserves ALL populated sections when budget is sufficient
- Removes lowest-priority sections (via MemoryRanking priority) when budget is constrained
- Constructor accepts optional `maxBudgetChars` (defaults to `Infinity` — unlimited)
- Constructor accepts optional `charsPerToken` (defaults to 4 — used for ProviderBudget threshold conversion)
- When `ProviderBudgetResult` is passed to `select()`, dynamically calculates threshold as `maxInputTokens * charsPerToken`, overriding `maxBudgetChars`
- Falls back to passthrough when ranking or budget is not provided
- Non-mutating, deterministic, pure, idempotent
- Provider-agnostic (no OpenAI/DeepSeek binding)
- **Guard:** never excludes the last remaining section

**Future implementations** (not implemented):
- EmbeddingSelection — relevance-based section selection
- LLMSelection — LLM-based importance evaluation

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
              ├── FindEntityTool          — backed by RuntimeQuery.findEntity()
              ├── FindEntitiesByTypeTool  — backed by RuntimeQuery.findEntities()
              ├── GetWorldSnapshotTool    — backed by RuntimeQuery.getWorldSnapshot()
              └── MockFindEntityTool      — hardcoded mock (for testing)
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

| Tool | Name | Description | Backend |
|------|------|-------------|---------|
| FindEntityTool | `find_entity` | Find an entity by unique ID | RuntimeQuery.findEntity() |
| FindEntitiesByTypeTool | `find_entities` | Find entities by type (or all) | RuntimeQuery.findEntities() |
| GetWorldSnapshotTool | `get_world_snapshot` | Get complete world snapshot | RuntimeQuery.getWorldSnapshot() |
| MockFindEntityTool | `find_entity` | Returns hardcoded mock data (testing) | None (mock) |

### Tool Layering

```
Pipeline → ToolCallPlanner → PlannerProvider → Concrete Provider
                ↑
          ToolRegistry → Tool (interface)
                            ├── FindEntityTool → RuntimeQuery (interface, from @genesis/shared)
                            ├── FindEntitiesByTypeTool → RuntimeQuery
                            ├── GetWorldSnapshotTool → RuntimeQuery
                            └── MockFindEntityTool (test only)
```

- The AI layer depends only on `Tool` and `ToolRegistry` abstractions
- Tools depend on `RuntimeQuery` interface (from `@genesis/shared`), not on concrete Runtime
- No provider directly imports Runtime
- ToolCallPlanner is additive — existing planners work unchanged
- `RuntimeQuery` interface is implemented by `@genesis/runtime`

---

## Agent Loop (Multi-Step with Structured Observations)

The Agent Loop provides an abstraction for iterative AI reasoning. Since WO-S3-010, `DefaultAgentLoop` supports true multi-step execution with tool calling. Since WO-S3-011, observations are maintained as structured `Observation[]` objects.

### Architecture

```
AgentLoop.execute(context)
    ↓
AgentLoopContext { request, planner, toolRegistry?, maxIterations }
    ↓
structuredObservations: Observation[] = []
    ↓
Emit: AgentLoopStarted
    ↓
for iteration = 1 to maxIterations:
  ├── Attach observations to request.metadata
  ├── Emit: LoopIterationStarted
  ├── planner.plan(request with metadata.observations) → PlannerResult
  ├── actions.length > 0? → Yes: break (finished = true)
  ├── No → toolCalls in metadata AND toolRegistry?
  │         ├── Yes: for each toolCall:
  │         │       ├── Emit: ToolExecuted
  │         │       ├── tool.execute(input) → output
  │         │       ├── Create Observation { toolName, toolInput, toolOutput, timestamp, iteration }
  │         │       ├── Push to structuredObservations
  │         │       └── Emit: ObservationRecorded
  │         │       Use PromptBuilder.formatObservationsInline() for prompt text
  │         │       Append formatted text to request prompt
  │         └── No: break (finished = false)
  ├── Run reflection (if available):
  │       reflection.execute({ plannerResult, observations, steps, iteration, maxIterations })
  │       → ReflectionResult (recorded, not acted upon)
  └── Emit: LoopIterationFinished
    ↓
AgentLoopResult { plannerResult, steps: [LoopStep with observations], iterations, finished }
    ↓
Emit: AgentLoopFinished
    ↓
Return AgentLoopResult
```

### Key Design Decisions

1. **Pipeline integration** — Since WO-S3-009, `DefaultPipeline.execute()` and `DefaultPipeline.stream()` use `AgentLoop.execute()` internally. Pipeline remains the only AI entry point; AgentLoop is the planning layer beneath it.
2. **Multi-step execution** — Since WO-S3-010, `DefaultAgentLoop` supports true multi-step execution. It calls `planner.plan()` in a loop, checking for final actions, executing tools, and feeding back observations.
3. **Stop conditions** — Two stop conditions: Planner returns non-empty actions, or maxIterations reached.
4. **Tool call detection** — Tool calls are read from `PlannerResult.metadata.toolCalls`. Each tool is executed via `ToolRegistry` and observations are recorded as structured `Observation[]` in `LoopStep`.
5. **Structured Observation Context** — Since WO-S3-011, AgentLoop maintains an `Observation[]` array passed to the Planner via `request.metadata.observations`. LoopStep references Observation objects (no data duplication).
6. **Planner Observation Awareness** — Since WO-S3-012, AgentLoop no longer formats observation prompt text inline. All observation formatting is delegated to PromptBuilder (`formatObservations`/`formatObservationsInline` in `ObservationPromptModule.ts`). AgentLoop only maintains and writes observations.
7. **Reflection Foundation** — Since WO-S3-013, `DefaultAgentLoop` accepts an optional `Reflection` via constructor. After each iteration, it calls `reflection.execute()` with the current state. Results are recorded in `AgentLoopResult.reflectionResults` but do NOT affect loop behavior. See ADR-0030.
6. **Events** — Six events (`AgentLoopStarted`, `LoopIterationStarted`, `ToolExecuted`, `ObservationRecorded`, `LoopIterationFinished`, `AgentLoopFinished`) provide full observability.
6. **No Runtime dependency** — AgentLoopContext accepts `request`, `planner`, and optional `toolRegistry`. It has no reference to Runtime.

### Compatibility

| Component | Compatible | Notes |
|-----------|-----------|-------|
| MockPlanner | ✅ | DefaultAgentLoop accepts any Planner |
| RetryPlanner | ✅ | Retry events fire inside Planner, loop events fire around it |
| ToolCallPlanner | ✅ | Tool events fire inside Planner, loop events fire around it |
| MockStreamingProvider | ✅ | Streaming provider's `complete()` used through Planner |
| OpenAIPlannerProvider | ✅ | Works through MockPlanner wrapper |
| DeepSeekPlannerProvider | ✅ | Works through MockPlanner wrapper |

### Events

| Event | Enhanced Payload | When |
|-------|-----------------|------|
| `AgentLoopStarted` | `{ maxIterations }` | Before any planning |
| `LoopIterationStarted` | `{ iteration, maxIterations }` | Before each iteration |
| `ToolExecuted` | `{ toolName, toolInput, success? }` | After each tool execution |
| `ObservationRecorded` | `{ toolName, toolInput, toolOutput, success? }` | After each observation |
| `LoopIterationFinished` | `{ iteration }` | After each iteration |
| `AgentLoopFinished` | `{ iterations, finished }` | After all iterations |

### Future (Not Yet Implemented)

- LLM-based Reflection (self-critique)
- Auto re-plan from ReflectionResult
- Context compression between iterations
- Replay
- Memory Ranking
- Parallel Tool Calling
- Human Approval

## Prompt Generation Flow

```
PipelineContext { input: "增加一棵树", memory: DefaultMemory, worldState: "Tree\nid: tree-1\nposition: (3,5)", metadata: { reflectionResults: [...] } }
    ↓
DefaultPromptBuilder.build(context)
    ↓
Iterates PromptModule[6] via buildContext() (in order)
    ├── SystemPromptModule.buildContext()     → { system: "You are a game action planner..." }
    ├── UserInputModule.buildContext(context) → { userInput: "增加一棵树" }
    ├── MemoryPromptModule.buildContext()     → { memory: "Previous actions:\n- Applied 1 action(s)" }
    ├── WorldStatePromptModule.buildContext()  → { worldState: "Current World:\n\nTree\nid: tree-1\nposition: (3,5)" }
    └── ReflectionPromptModule.buildContext()  → { reflections: "## Previous Reflection\n\nIteration 1\n\nReasoning:\nActions found\n\nContinue:\nfalse" }
    ↓
Merge into PromptContext
    ↓
Serialize to string via module-order key mapping
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

DefaultAgentLoop.execute() emits (independent of Pipeline):
  1. AgentLoopStarted        (payload: { maxIterations })
  2. LoopIterationStarted    (payload: { iteration, maxIterations })
  3. [ToolExecuted]           (payload: { toolName, toolInput, success? })  ← only if tools executed
  4. [ObservationRecorded]    (payload: { toolName, toolInput, toolOutput, success? })  ← only if tools executed
  5. LoopIterationFinished   (payload: { iteration })
  ... (repeated for each iteration)
  6. AgentLoopFinished       (payload: { iterations, finished })
```

- Events are fire-and-forget — Pipeline never waits for listeners
- `PipelineEventEmitter` supports `subscribe` / `unsubscribe`
- Events carry `timestamp` and optional `payload`
- Useful for logging, debugging, and UI progress indicators

---

## Configuration Flow

```
AIConfiguration
  ├── provider: string           "mock" | "openai" | "deepseek"
  ├── model: string              model identifier
  ├── apiKey?: string            API key (required for openai, deepseek)
  ├── baseURL?: string           custom endpoint (required for deepseek)
  ├── temperature: number        response randomness (0.0–2.0)
  ├── maxTokens: number          max output tokens (deprecated — use maxOutputTokens)
  ├── maxOutputTokens?: number   max output tokens (preferred)
  ├── streaming?: boolean        enable streaming response mode
  ├── toolCalling?: boolean      enable native tool calling support
  └── allowBrowser?: boolean     allow browser API key usage (dev only)

DefaultAIConfiguration:
  provider="mock", model="mock", temperature=0, maxTokens=0,
  streaming=false, toolCalling=false,
  maxOutputTokens=undefined, apiKey=undefined, baseURL=undefined, allowBrowser=undefined

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
  ├── uses ToolRegistry → Tool → RuntimeQuery (interface from @genesis/shared)
  ├── detects ToolCallingProvider (native tool calling)
  │     └── routes to completeWithTools() when available
  │     └── falls back to prompt-based injection for non-native providers
  └── emits tool events via PipelineEventEmitter

### Provider Native Tool Calling

When a provider implements `ToolCallingProvider` (extends `PlannerProvider`), the tool calling lifecycle shifts from the Planner level into the Provider level:

```
ToolCallPlanner.plan()
    ↓
Detects ToolCallingProvider
    ↓
Calls provider.completeWithTools(request, tools)
    ↓
Provider converts Tool[] → Provider-specific schema
    ↓
Sends prompt + tool schemas to LLM
    ↓
LLM returns function calls
    ↓
Provider executes Tool instances
    ↓
Provider sends results back to LLM
    ↓
LLM returns final response
    ↓
Provider parses → PlannerResult
```

For providers that do NOT implement `ToolCallingProvider`, the existing prompt-based tool description flow remains unchanged.

### ProviderToolSchemas

`ProviderToolSchemas` provides schema definitions for known tools, enabling providers to translate the generic `Tool` interface into provider-native function/tool schemas:

```typescript
// Tool (unchanged — no schema field)
interface Tool {
  name: string
  description: string
  execute(input: unknown): Promise<unknown>
}

// Provider-side schema (new — not in Tool interface)
interface ToolInputSchema {
  type: 'object'
  properties: Record<string, { type: string; description?: string }>
  required: string[]
}

// Utility functions
getToolInputSchema(tool: Tool): ToolInputSchema | undefined
hasToolSchema(tool: Tool): boolean
getSchemaTools(tools: Tool[]): ToolSchemaDescriptor[]
```

Provider translation:
```
Tool → ToolInputSchema → Provider-native schema
                           ├── OpenAI: { type: 'function', name, description, parameters, strict }
                           └── DeepSeek: { type: 'function', function: { name, description, parameters } }
```

### Event Enhancements

Tool events now carry richer payloads:

| Event | Enhanced Payload Fields |
|-------|----------------------|
| `ToolCallStarted` | `toolNames`, `tools?: [{ name, description }]`, `native: boolean` |
| `ToolCallFinished` | `toolNames`, `success`, `native: boolean`, `toolResults?: [{ name, duration, success, error? }]`, `duration`, `totalToolCallDuration?` |

### Tool Calling Provider Hierarchy

```
PlannerProvider (interface)
  └── complete(request: AIRequest): Promise<PlannerResult>

ToolCallingProvider (interface, extends PlannerProvider)
  └── completeWithTools(request: AIRequest, tools: Tool[]): Promise<PlannerResult>

PlannerProvider implementations:
  ├── MockPlannerProvider          — NO native tool calling (prompt-based only)
  ├── OpenAIPlannerProvider        — YES, implements ToolCallingProvider
  │     Uses: OpenAI Responses API function calling
  │     Schema: { type, name, description, parameters, strict }
  │     Flow: send → function_call → execute → previous_response_id → final
  └── DeepSeekPlannerProvider      — YES, implements ToolCallingProvider
        Uses: Chat Completions API tool calling
        Schema: { type, function: { name, description, parameters } }
        Flow: send → tool_calls → execute → tool messages → final

ToolCallPlanner routing:
  provider is ToolCallingProvider? → completeWithTools(request, tools)
  otherwise                        → enhanceWithTools(request) + complete(request)
```

Pipeline → PromptBuilder → PromptModule[]
                              ├── SystemPromptModule (no deps)
                              ├── UserInputModule (no deps)
                              ├── MemoryPromptModule → Memory
                              ├── WorldStatePromptModule (no deps — reads string)
                              ├── ObservationPromptModule (no deps — reads metadata)
                              └── ReflectionPromptModule (no deps — reads metadata)

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
2. Implement `PromptModule` interface (both `build()` and optional `buildContext()`)
3. Add to `modules/index.ts`
4. Wire into `DefaultPromptBuilder` at the composition root (e.g., `gameStore.ts`)

Modules are added to the constructor array of `DefaultPromptBuilder`:
```typescript
new DefaultPromptBuilder([
  new SystemPromptModule(),
  new UserInputModule(),
  new MemoryPromptModule(),
  new WorldStatePromptModule(),
  new ObservationPromptModule(),
  new ReflectionPromptModule(),
])
```

If the module implements `buildContext()`, it automatically contributes structured data to `PromptContext`.
Legacy modules (build() only) are fully supported — the builder falls back to `build()` for string fragments.

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

## Sprint 4 Final Architecture (v0.28)

The complete architecture at the end of Sprint 4:

```
User Input
    ↓
Pipeline.execute() / .stream()
    ↓
┌──────────────────────────────────────────────────────────────┐
│                  Prompt Assembly (PromptBuilder)              │
│  PromptModules → PromptContext → MemoryRanking → PromptBudget │
│  → PromptSelection → PromptCompression → PromptRenderer → AIRequest │
└──────────────────────────────────────────────────────────────┘
    ↓
AgentLoop.execute()
    ├── Planner.plan()
    │     ├── RetryPlanner (decorator, wraps PlannerProvider)
    │     │     └── RetryPolicy (configurable retry with backoff)
    │     └── ToolCallPlanner (decorator, wraps PlannerProvider)
    │           └── Detects ToolCallingProvider → native routing
    ├── Tool Execution
    │     └── ToolRegistry → Tool
    │           ├── FindEntityTool          → RuntimeQuery.findEntity()
    │           ├── FindEntitiesByTypeTool  → RuntimeQuery.findEntities()
    │           ├── GetWorldSnapshotTool    → RuntimeQuery.getWorldSnapshot()
    │           └── MockFindEntityTool      (testing only)
    └── Reflection.evaluate()
          └── DefaultReflection (rule-based: actions? → stop)
    ↓
PlannerProvider.complete() / completeWithTools()
    ├── MockPlannerProvider
    ├── OpenAIPlannerProvider (Streaming + ToolCalling)
    └── DeepSeekPlannerProvider (Streaming + ToolCalling)
    ↓
StructuredOutputValidator.validate()
    ↓
PlannerResult { actions, reasoning?, metadata? }
    ↓
Runtime.applyActions()
    ↓
ActionHandler[]
    ├── CreateEntityHandler
    └── MoveEntityHandler
    ↓
World
    ↓
Renderer (Canvas)
    ↓
UI
```

### Layer Summary

| Layer | Components | Responsibility |
|-------|-----------|---------------|
| **Pipeline** | `Pipeline.execute/stream`, `PipelineContext`, `PipelineEventEmitter` | AI entry point, lifecycle events |
| **Prompt Assembly** | `PromptModule[6]`, `PromptContext`, `MemoryRanking`, `PromptBudget`, `PromptSelection`, `PromptCompression`, `PromptRenderer` | Build prompt from modular sections |
| **Agent** | `AgentLoop`, `LoopStep`, `Observation`, `Reflection` | Multi-step iteration, tool calling, self-evaluation |
| **Planning** | `Planner`, `PlannerResult`, `RetryPlanner`, `ToolCallPlanner` | Orchestrate provider calls with retry and tools |
| **Provider** | `PlannerProvider`, `StreamingPlannerProvider`, `ToolCallingProvider`, `ProviderFactory` | LLM API abstraction |
| **Validation** | `StructuredOutputValidator` | Response schema validation |
| **Runtime** | `Runtime`, `ActionHandler`, `RuntimeQuery` | World state management |
| **Rendering** | Entity renderers, Canvas | Visual output |

---

## See Also

- [PROVIDER_GUIDE.md](./PROVIDER_GUIDE.md) — Step-by-step provider development guide
- [AI_INTEGRATION.md](./AI_INTEGRATION.md) — How to configure and switch AI providers
