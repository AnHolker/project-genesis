# Sprint 3 Proposal

> Project Genesis — Sprint 3: AI Integration & Polish
> **Proposed** — No work has started.

---

## Goal

Extend the AI Pipeline with streaming, tool calling, and context management capabilities. Polish the prompt pipeline and provider layer for production readiness.

---

## Proposed Backlog

### P0 — Core AI Extensions

#### Streaming Responses

**Problem:** Both OpenAIPlannerProvider and DeepSeekPlannerProvider wait for the full response before returning `PlannerResult`. Users see no progress during long planning cycles.

**Direction:**
- Extend `PlannerProvider` interface to support streaming (e.g., `AsyncIterable<Partial<PlannerResult>>`)
- Create streaming variant of `Pipeline.execute()` or add streaming event type
- Update `OpenAIPlannerProvider` to stream from Responses API
- Update `DeepSeekPlannerProvider` to stream from Chat Completions API
- UI shows progressive action parsing as tokens arrive

**Risk:** Interface change to `PlannerProvider` and `Planner`. Breaking change if not done carefully.

---

#### Tool Calling

**Problem:** AI only does single-shot natural language → actions. It cannot query runtime state, retrieve entity details, or look up available actions mid-plan.

**Direction:**
- Define tool schema (entity query, world state, action list)
- Pass tools to LLM via function-calling or tool-use API parameters
- `Planner` executes tool calls between action generation
- `PlannerResult` includes tool call trace

**Risk:** Requires `Planner` to hold reference to `Runtime` or `RuntimeQuery`. Architecture change needed.

---

#### Context Compression

**Problem:** Memory stores full conversation history. Long conversations will exceed LLM context window. No token budget tracking.

**Direction:**
- Introduce context window token counting (estimate tokens per prompt)
- Summarize or truncate `MemoryPromptModule` output when approaching limit
- Configurable compression strategy: truncate oldest, summarize, or hybrid
- Add `maxPromptTokens` to `AIConfiguration` or pipeline config

**Risk:** Summarization requires a secondary LLM call or a local algorithm. Adds latency.

---

### P1 — Quality of Life

#### World Snapshot Optimization

**Problem:** `formatWorldState()` re-serializes entire world on every `send()`. For large worlds, this adds overhead.

**Direction:**
- Cache serialized world state string
- Incremental update on entity create/move
- Lazy serialization — only format when world state changes

---

#### Entity Retrieval

**Problem:** AI cannot find entities by name, location, or relation without exact ID. "Move the tree next to the house" requires entity lookup.

**Direction:**
- Add `findByName(name)` and `findNearest(x, y)` to `RuntimeQuery`
- Include entity name-to-ID mapping in world state prompt
- Tool calling (P0) would enable direct entity lookup at planning time

---

#### Planner Retry

**Problem:** No retry logic for transient failures. Rate limits and network timeouts return `{ actions: [] }`.

**Direction:**
- Add retry wrapper in `MockPlanner` (or create `RetryPlanner` decorator)
- Exponential backoff with jitter
- Configurable max retries (default: 3)

---

### P2 — Advanced AI

#### Agent Loop

**Problem:** Single-shot planning cannot decompose complex tasks. "Build a house" requires multiple steps: create foundation, create walls, create roof.

**Direction:**
- Pipeline loops: execute actions → observe new world state → plan next step
- Max iteration limit to prevent infinite loops
- Action history feeds back into prompt context each iteration

---

#### Reflection

**Problem:** AI cannot critique its own plans. If CreateEntity places a tree at the wrong position, no correction loop exists.

**Direction:**
- After plan generation, AI evaluates its own actions against user intent
- Reflection prompt: "Does this plan match the user's request?"
- If not, re-plan with reflection notes in context

---

#### Memory Ranking

**Problem:** All memories are treated equally. Old irrelevant memories clutter the context window.

**Direction:**
- Score memories by: recency, relevance to current input, importance
- Only include top-K memories in MemoryPromptModule output
- Configurable ranking strategy

---

#### Undo / Replay AI

**Problem:** No action history. Cannot undo an AI-generated sequence or replay past states.

**Direction:**
- Store action history as part of Memory
- Pipeline supports deterministic replay from action log
- UI: "Undo last action" button that reverses AI actions

---

## Non-Goals for Sprint 3

- No server-side Runtime
- No multiplayer
- No persistent storage (beyond in-memory)
- No worker threads
- No Vue/Renderer changes (unless required by streaming UI)
- No new provider integrations (Claude, Gemini, etc.)

---

## Dependencies

| Item | Depends On | Unlocks |
|------|-----------|---------|
| Tool Calling | PromptBuilder extension, Runtime public API stability | Entity retrieval, agent loop |
| Streaming | PlannerProvider interface change | Progressive UI rendering |
| Context Compression | Token estimation utility, Memory interface | Long conversation support |
| Reflection | Tool Calling or agent loop | Self-correcting AI |
| Retry | Planner interface | Production reliability |

---

## Estimation

| Priority | Item | Estimated Effort |
|----------|------|-----------------|
| P0 | Streaming Responses | Large |
| P0 | Tool Calling | Large |
| P0 | Context Compression | Medium |
| P1 | World Snapshot Optimization | Small |
| P1 | Entity Retrieval | Medium |
| P1 | Planner Retry | Small |
| P2 | Agent Loop | Large |
| P2 | Reflection | Medium |
| P2 | Memory Ranking | Medium |
| P2 | Undo / Replay AI | Medium |