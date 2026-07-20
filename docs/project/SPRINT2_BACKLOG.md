# Sprint 2 Backlog

> Project Genesis — Sprint 2: AI Foundation
> Status: Active (7 of 14 work orders completed)
> This is a living document.

---

## Sprint Theme

**AI Foundation**

Build the bridge between natural language input and the Runtime.

Focus: Planner ecosystem, prompt engineering, and the first real AI planner integration.

---

## Completed Work Orders

### WO-S2-001 — AI Pipeline Interface ✅

- Defined `Pipeline` interface
- Implemented `DefaultPipeline` class
- Pipeline is the only AI entry point

### WO-S2-002 — PipelineContext ✅

- Defined `PipelineContext` interface
- Pipeline stages communicate only through PipelineContext

### WO-S2-003 — AIRequest ✅

- Defined `AIRequest` input model
- `Planner.plan()` now accepts `AIRequest`
- Pipeline constructs AIRequest from PipelineContext

### WO-S2-004 — PromptBuilder ✅

- Defined `PromptBuilder` interface
- Implemented `DefaultPromptBuilder`
- Pipeline delegates AIRequest construction to PromptBuilder

### WO-S2-005 — Pipeline Events ✅

- Defined `PipelineEvent` type (5 event variants)
- `PipelineEventEmitter` with subscribe/unsubscribe/emit
- DefaultPipeline emits lifecycle events

### WO-S2-006 — Prompt Modules ✅

- Defined `PromptModule` interface
- Implemented `UserInputModule`
- DefaultPromptBuilder composes prompt from modules

### WO-S2-007 — Memory Interface ✅

- Defined `Memory` interface (get/set)
- Implemented `DefaultMemory` (Map-based)
- PipelineContext includes optional `memory` field
- Added Vitest + memory tests to `packages/ai`

---

## Pending Work Orders

### WO-S2-008 — AI Pipeline Tests

**Goal:** Add test infrastructure for Pipeline and Planner implementations.

**Description:**
- Test `DefaultPipeline` behavior
- Test `MockPlanner` with AIRequest
- Test edge cases: empty input, special characters, very long input
- Test `DefaultPromptBuilder` composition with modules

**Rationale:** All future pipeline components need test coverage.

**Depends on:** WO-S2-003, WO-S2-004, WO-S2-006

---

### WO-S2-009 — OpenAI Planner

**Goal:** First real AI planner using OpenAI API.

**Description:**
- Implement `Planner` interface with OpenAI client
- Use Prompt Builder for system/user prompts
- Parse LLM response into `PlannerResult`
- Handle API errors gracefully
- API key configuration via environment variable
- No streaming, no tool calling

**Rationale:** First LLM integration validates the entire Pipeline and Planner interface design.

**Depends on:** WO-S2-003 (AIRequest), WO-S2-004 (PromptBuilder), WO-S2-008 (Pipeline Tests)

---

### WO-S2-010 — Streaming Planner

**Goal:** Support streaming/partial action generation for responsive UX.

**Description:**
- Extend `PlannerResult` or create `StreamingPlanner` interface
- Emit partial actions as they are generated
- UI updates progressively instead of waiting for full response
- Requires Renderer to handle incremental updates

**Rationale:** Reduces perceived latency. Users see results as they are generated.

**Depends on:** WO-S2-009 (OpenAI Planner)

---

### WO-S2-011 — Tool Calling

**Goal:** Use OpenAI function/tool calling for structured action generation.

**Description:**
- Define action schema as OpenAI tool definitions
- Let LLM choose which action to generate via tool calling
- More reliable than free-form JSON generation
- Falls back to parsing if tool calling is unavailable

**Rationale:** Tool calling produces reliably structured output. Reduces parsing errors.

**Depends on:** WO-S2-009 (OpenAI Planner)

---

### WO-S2-012 — Context Compression

**Goal:** Compress conversation history to fit within LLM context windows.

**Description:**
- Summarize past actions
- Trim old history entries
- Configurable max tokens/entries
- Only meaningful when Memory exists

**Rationale:** LLM context windows are finite. Without compression, long sessions will fail.

**Depends on:** WO-S2-007 (Memory Interface)

---

### WO-S2-013 — System Prompt Module

**Goal:** Add PromptModule for system-level instructions.

**Description:**
- Create `SystemPromptModule` implementing `PromptModule`
- Include available action types and schemas
- Include game world constraints

**Rationale:** LLMs need system context to generate valid actions.

**Depends on:** WO-S2-006 (Prompt Modules)

---

### WO-S2-014 — Memory Prompt Module

**Goal:** Add PromptModule that feeds Memory content into the prompt.

**Description:**
- Create `MemoryPromptModule` implementing `PromptModule`
- Retrieve recent entries from Memory
- Format as conversation history

**Rationale:** Multi-turn conversations require context awareness.

**Depends on:** WO-S2-006 (Prompt Modules), WO-S2-007 (Memory Interface)

---

## Out of Scope for Sprint 2

| Item | Reason |
|------|--------|
| Backend | No server needed yet |
| Networking | No multiplayer yet |
| Renderer improvements | Not core to AI foundation |
| Runtime extensions | No new actions unless required by AI |
| Persistence | No save/load |
| Vector store | Overkill for current scale |

---

## Notes

- Sprint 2 focuses on building the AI pipeline end-to-end
- All planners must implement the `Planner` interface
- All planners must return `PlannerResult`
- Priority: Correctness > Performance > Polish
- OpenAI is the first target. Claude and Gemini are stretch goals.
- Streaming is a stretch goal — only if time permits