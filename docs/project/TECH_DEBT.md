# Technical Debt

> Intentionally postponed improvements.
> Items are not bugs — they are deliberate trade-offs.

---

## Renderer Registry

| Field | Value |
|-------|-------|
| **Priority** | Medium |
| **Reason** | Renderer currently uses `switch(entity.type)` to draw entities. Adding new entity types requires modifying the switch. A registry pattern (matching Runtime's ActionHandler approach) would make entity rendering extensible without file modification. |
| **Suggested Sprint** | Sprint 4 |

---

## Entity Map

| Field | Value |
|-------|-------|
| **Priority** | Medium |
| **Reason** | World stores entities as `Entity[]`. Lookups (e.g., MoveEntityHandler's `find`) are O(n). A `Map<string, Entity>` would provide O(1) lookup. Array is sufficient for current scale. |
| **Suggested Sprint** | Sprint 4 |

---

## Planner Interface

| Field | Value |
|-------|-------|
| **Priority** | ~~High~~ **Resolved** |
| **Reason** | ~~MockPlanner is a function, not an interface. AI integration requires a stable Planner contract. Formalizing `Planner` as an interface with `plan(input: string): Action[]` will enable swapping implementations.~~ |
| **Suggested Sprint** | ~~Sprint 2~~ **Completed in WO-S1-007** |
| **Resolution** | `Planner` interface created in `packages/ai`. `MockPlanner` implements it. UI depends on interface only. Returns `PlannerResult`. |

---

## AI Pipeline Abstraction

| Field | Value |
|-------|-------|
| **Priority** | ~~High~~ **Resolved** |
| **Reason** | ~~No formal Pipeline existed. AI entry point needs a defined contract.~~ |
| **Suggested Sprint** | ~~Sprint 2~~ **Completed in WO-S2-001 through WO-S2-014** |
| **Resolution** | Pipeline, PipelineContext, AIRequest, PromptBuilder, PromptModules, Memory, PlannerProvider, AIConfiguration all implemented. OpenAIPlannerProvider, DeepSeekPlannerProvider, and ProviderFactory complete. |

---

## Replay

| Field | Value |
|-------|-------|
| **Priority** | Low |
| **Reason** | No persistent action log exists. Replaying a sequence of actions requires storing all past Action[]. Not needed until AI iteration or debug features are built. |
| **Suggested Sprint** | Sprint 4 |

---

## Undo

| Field | Value |
|-------|-------|
| **Priority** | Low |
| **Reason** | Requires action history and inverse operations. Each Action needs an undo counterpart. Adds complexity with no current user-facing need. |
| **Suggested Sprint** | Sprint 4 |

---

## Snapshot

| Field | Value |
|-------|-------|
| **Priority** | Low |
| **Reason** | Serializing/deserializing full World state for time-travel or save/load. Requires structured cloning of entities. Not needed until persistence or multiplayer. |
| **Suggested Sprint** | Sprint 4 |

---

## Dirty Rendering

| Field | Value |
|-------|-------|
| **Priority** | Low |
| **Reason** | Current renderer redraws entire canvas on every change. Dirty rect tracking would improve performance for complex worlds. Premature optimization at current scale. |
| **Suggested Sprint** | Sprint 4 |

---

## Worker Runtime

| Field | Value |
|-------|-------|
| **Priority** | Low |
| **Reason** | Runtime runs on main thread. Offloading to a Web Worker prevents UI blocking during heavy computation. Adds serialization overhead. Not needed until AI produces large action batches. |
| **Suggested Sprint** | Sprint 5 |

---

## Server Runtime

| Field | Value |
|-------|-------|
| **Priority** | Low |
| **Reason** | No server-side execution. Multiplayer, persistence, and server-side AI planning all require a server Runtime. Entirely out of scope for Sprint 1. |
| **Suggested Sprint** | Sprint 6 |

---

## AI Planner

| Field | Value |
|-------|-------|
| **Priority** | ~~High~~ **Resolved** |
| **Reason** | ~~Core differentiator of Project Genesis. Infrastructure ready: Pipeline, PlannerProvider, AIConfiguration all exist. MockPlannerProvider is active placeholder. Requires real LLM integration (OpenAI), prompt engineering with PromptBuilder/PromptModules, and action schema validation.~~ |
| **Suggested Sprint** | ~~Sprint 3~~ **Completed in WO-S2-011 through WO-S2-014** |
| **Resolution** | OpenAIPlannerProvider and DeepSeekPlannerProvider implemented. ProviderFactory selects provider from AIConfiguration. Both use the `openai` SDK with structured JSON output. |

---

## AI Pipeline Tests

| Field | Value |
|-------|-------|
| **Priority** | ~~Medium~~ **Resolved** |
| **Reason** | ~~No test suite exists for Pipeline, DefaultPipeline, PromptBuilder, PromptModules, or PlannerProvider. MockPlannerProvider logic is untested. Tests should be added before real LLM integration.~~ |
| **Suggested Sprint** | ~~Sprint 3~~ **Completed in WO-S2-017, WO-S2-018** |
| **Resolution** | Pipeline Integration Tests (7 tests) and Prompt Snapshot Tests (6 snapshots) added. Full pipeline coverage including memory, events, PromptBuilder spy, Planner spy, context field preservation, and plannerResult write-back. |

---

## Conversation Persistence

| Field | Value |
|-------|-------|
| **Priority** | Low |
| **Reason** | DefaultMemory stores conversation in-memory Map. History is lost on page refresh. No persistence strategy exists. Sufficient for current development. |
| **Suggested Sprint** | Sprint 4 |

---

## System Prompt Hardcoded

| Field | Value |
|-------|-------|
| **Priority** | ~~Medium~~ **Resolved** |
| **Reason** | ~~System prompt is hardcoded inside both OpenAIPlannerProvider and DeepSeekPlannerProvider. Adding or modifying action schemas requires editing provider source. Prompt should be configurable or sourced from PromptBuilder.~~ |
| **Suggested Sprint** | ~~Sprint 3~~ **Completed in WO-S2-019** |
| **Resolution** | SystemPromptModule created in `packages/ai/src/prompt/modules/SystemPromptModule.ts`. System prompt is now part of PromptBuilder pipeline — extracted from both providers. Providers no longer maintain prompt content. |

---

## Prompt Versioning Missing

| Field | Value |
|-------|-------|
| **Priority** | Low |
| **Reason** | No mechanism to track or version system prompts. Changes to prompt wording may break response parsing. Versioning would enable A/B testing and rollback. |
| **Suggested Sprint** | Sprint 4 |

---

## Structured Output Validation

| Field | Value |
|-------|-------|
| **Priority** | ~~Medium~~ **Resolved** |
| **Reason** | ~~Provider `parseResponse` only checks `typeof raw.type === 'string'`. It does not validate field presence (e.g., CreateEntity requires `entityType`, `x`, `y`). Invalid actions may pass through to Runtime and fail at handler dispatch. A schema validation layer (e.g., Zod) would catch malformed actions before they reach Runtime.~~ |
| **Suggested Sprint** | ~~Sprint 3~~ **Completed in WO-S2-015** |
| **Resolution** | StructuredOutputValidator created with `static validate(parsed: unknown): PlannerResult`. Unified validation across all providers. Validates: actions is array, each action has type. Integrated into OpenAIPlannerProvider and DeepSeekPlannerProvider. |

---

## Provider Registration Switch

| Field | Value |
|-------|-------|
| **Priority** | Low |
| **Reason** | ProviderFactory uses a `switch` statement to map `config.provider` to concrete classes. Adding a new provider requires modifying ProviderFactory source. A registration mechanism (e.g., provider map or plugin pattern) would allow providers to self-register. The switch is simple and explicit — acceptable until provider count grows significantly. |
| **Suggested Sprint** | Sprint 4 |

---

## Streaming Not Implemented

| Field | Value |
|-------|-------|
| **Priority** | ~~Low~~ **Resolved** |
| **Reason** | ~~Both OpenAIPlannerProvider and DeepSeekPlannerProvider wait for the full response before parsing. Streaming would reduce perceived latency for long responses. Requires changes to PlannerProvider interface (currently returns `Promise<PlannerResult>`, not `AsyncIterable`).~~ |
| **Suggested Sprint** | ~~Sprint 4~~ **Completed in WO-S3-001 through WO-S3-003** |
| **Resolution** | StreamingPlannerProvider interface added (WO-S3-001). Pipeline.stream() and StreamChunk events implemented (WO-S3-002). Web UI integration with reactive streaming state completed (WO-S3-003). |

---

## Provider Retry Policy Absent

| Field | Value |
|-------|-------|
| **Priority** | ~~Low~~ **Resolved** |
| **Reason** | ~~No retry logic for transient failures (rate limits, network timeouts). Currently, any error returns `{ actions: [] }`. A retry policy with exponential backoff would improve reliability for production use.~~ |
| **Suggested Sprint** | ~~Sprint 4~~ **Completed in WO-S3-004** |
| **Resolution** | RetryPolicy and RetryPlanner created. RetryPlanner wraps any PlannerProvider with automatic retry. RetryPolicy distinguishes recoverable (invalid JSON, schema errors) from non-recoverable (auth, rate limits, network) failures. Retry events (PlannerRetryStarted/Finished) emitted. Retry metrics tracked in PlannerResult.metadata. 50 tests covering all retry paths. |

---

## Streaming Responses

| Field | Value |
|-------|-------|
| **Priority** | ~~High~~ **Resolved** |
| **Reason** | ~~Both providers wait for full response. No partial/streaming action generation. User cannot see progress during long planning cycles. Requires PlannerProvider interface extension.~~ |
| **Suggested Sprint** | ~~Sprint 3~~ **Completed in WO-S3-001 through WO-S3-003** |
| **Resolution** | StreamingPlannerProvider interface, Pipeline.stream(), StreamChunk events, and Streaming UI integration all implemented. OpenAI and DeepSeek providers support streaming. MockStreamingProvider added for testing. |

---

## Tool Calling

| Field | Value |
|-------|-------|
| **Priority** | ~~High~~ **Resolved** |
| **Reason** | ~~AI has no way to query runtime state, memory, or available actions during planning. Every plan is a single-shot completion. No function-calling or tool-use pattern exists.~~ |
| **Suggested Sprint** | ~~Sprint 3~~ **Completed in WO-S3-005** |
| **Resolution** | Tool/ToolRegistry interfaces created in AI layer. ToolCallPlanner wraps any PlannerProvider with tool support. MockFindEntityTool returns hardcoded entity data. Tool events (ToolCallStarted/ToolCallFinished) emitted. No Runtime dependency. Agent Loop integration deferred to future sprint. |

---

## Context Compression (Real)

| Field | Value |
|-------|-------|
| **Priority** | High |
| **Reason** | Memory stores full conversation history. No summarization, trimming, or token budgeting. Long conversations will exceed LLM context window. Each turn adds to the prompt without bound. Foundation exists (PromptCompression interface, DefaultPromptCompression strips empty/undefined). Real token-aware compression not yet implemented. |
| **Suggested Sprint** | Sprint 4 |

---

## World Snapshot Optimization

| Field | Value |
|-------|-------|
| **Priority** | Medium |
| **Reason** | WorldStatePromptModule receives a pre-formatted string, but `formatWorldState()` in gameStore re-serializes on every call. For large worlds, this adds overhead. Caching or incremental updates would improve performance. |
| **Suggested Sprint** | Sprint 4 |

---

## Entity Retrieval (Name-based)

| Field | Value |
|-------|-------|
| **Priority** | Medium |
| **Reason** | AI cannot find entities by name, location, or relation without exact ID. "Move the tree next to the house" requires entity lookup, lookup is currently O(n) scan. Entity lookup by ID exists via FindEntityTool, but name-based and nearest-neighbor lookup are not yet supported. |
| **Suggested Sprint** | Sprint 4 |

---

## Multi-turn Planning

| Field | Value |
|-------|-------|
| **Priority** | ~~Medium~~ **Resolved** |
| **Reason** | ~~Planning is single-shot — one input produces one PlannerResult. No iterative refinement, no intermediate feedback, no plan correction loop. Agent Loop foundation (WO-S3-008) establishes the abstraction layer. Multi-iteration execution requires future WO.~~ |
| **Suggested Sprint** | ~~Sprint 4~~ **Completed in WO-S3-010, WO-S3-011** |
| **Resolution** | DefaultAgentLoop now supports multi-step execution with tool calling (WO-S3-010). Structured Observation Context (WO-S3-011) provides formal Observation[] lifecycle. AgentLoop iterates: plan → check actions → execute tools → observe → repeat, until Planner returns actions or maxIterations reached. |

---

## Agent Loop

| Field | Value |
|-------|-------|
| **Priority** | ~~Medium~~ **Resolved** |
| **Reason** | ~~No loop exists for multi-step AI reasoning. AI cannot decompose "build a house" into sequence of actions, observe results, and adjust. Requires PlannerProvider interface changes.~~ |
| **Suggested Sprint** | ~~Sprint 4~~ **Completed in WO-S3-008 through WO-S3-011** |
| **Resolution** | AgentLoop interface, DefaultAgentLoop (single-iteration), LoopStep, AgentLoopContext, AgentLoopResult, and 6 event types created in WO-S3-008. Multi-step execution with tool calling added in WO-S3-010. Structured Observation Context added in WO-S3-011. Pipeline integration completed in WO-S3-009. |

---

## Memory Ranking

| Field | Value |
|-------|-------|
| **Priority** | Low |
| **Reason** | All memories are treated equally. No mechanism to prioritize relevant memories (e.g., by recency, similarity, or importance). |
| **Suggested Sprint** | Sprint 4 |

---

## MockPlanner Naming

| Field | Value |
|-------|-------|
| **Priority** | Medium |
| **Reason** | `MockPlanner` is the default Planner implementation for all providers (OpenAI, DeepSeek, Mock), not just the mock. When OpenAI is configured, `new MockPlanner(openaiProvider)` reads as a contradiction. ADR-0012 states: "MockPlanner is reusable — routes to any provider." The class should be renamed to `DefaultPlanner` to reflect its actual role as the orchestration layer. |
| **Suggested Sprint** | Sprint 4 |
| **Source** | Architecture Audit (META-006) |

---

## Missing Package Dependency

| Field | Value |
|-------|-------|
| **Priority** | ~~High~~ **Resolved** |
| **Reason** | ~~`apps/web/package.json` does not declare `@genesis/ai` as a dependency, despite `gameStore.ts` importing 11 symbols from it. The code works only because Vite aliases (`vite.config.ts`) and TypeScript paths (`tsconfig.json`) resolve it. If the alias-based resolution breaks or a build tool change occurs, the app will fail.~~ |
| **Suggested Sprint** | ~~Sprint 3~~ **Resolved in WO-S2-021** |
| **Resolution** | Added `"@genesis/ai": "workspace:*"` to `apps/web/package.json` dependencies. |
| **Source** | Architecture Audit (META-006) |

---

## Provider parseResponse Duplication

| Field | Value |
|-------|-------|
| **Priority** | Low |
| **Reason** | `OpenAIPlannerProvider.parseResponse()` and `DeepSeekPlannerProvider.parseResponse()` contain identical logic (5 lines each: `JSON.parse` → `StructuredOutputValidator.validate()` → catch). Only the reasoning string differs. The validation logic was already extracted into StructuredOutputValidator (WO-S2-015), but the `JSON.parse` + error catching wrapper remains duplicated. Acceptable at 2 providers — not worth a base class yet. |
| **Suggested Sprint** | Sprint 4 |
| **Source** | Architecture Audit (META-006) |

---

## No Validation Enforcement

| Field | Value |
|-------|-------|
| **Priority** | Low |
| **Reason** | New LLM providers can omit `StructuredOutputValidator.validate()` with no compile-time or runtime error. The architecture relies on developer discipline and PROVIDER_GUIDE.md. At 3 providers this is acceptable. At 6+ providers, a base class or lint rule should enforce validator usage. |
| **Suggested Sprint** | Sprint 4 |
| **Source** | Architecture Audit (META-006) |

---

## Missing ADRs

| Field | Value |
|-------|-------|
| **Priority** | ~~Medium~~ **Resolved** |
| **Reason** | ~~Four Sprint 2 architectural decisions lack formal ADRs: (1) Structured Output Validator (WO-S2-015), (2) Environment Configuration (WO-S2-016), (3) System Prompt Module extraction (WO-S2-019), (4) Responses API Migration (WO-S2-012). These are documented only in CHANGELOG.md. If the team grows, new developers need these records.~~ |
| **Suggested Sprint** | ~~Sprint 3~~ **Resolved in WO-S2-021** |
| **Resolution** | ADR-0016 (Structured Output Validator), ADR-0017 (Environment Configuration), ADR-0018 (System Prompt Module), ADR-0019 (Responses API Migration) created. |
| **Source** | Architecture Audit (META-006) |

---

## Dead Directory

| Field | Value |
|-------|-------|
| **Priority** | Low |
| **Reason** | `apps/web/src/planner/` is an empty directory left over from WO-S1-007 (MockPlanner was moved to `@genesis/ai`). No code references it. Should be removed. |
| **Suggested Sprint** | Sprint 4 |
| **Source** | Architecture Audit (META-006) |