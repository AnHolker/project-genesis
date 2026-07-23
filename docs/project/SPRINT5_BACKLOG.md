# Sprint 5 Backlog

> **Target:** Sprint 5 — Post-Freeze Capabilities  
> **Status:** Proposed (Not Yet Started)  
> **Architecture Version:** v0.35

---

## Priority Legend

| Priority | Meaning |
|----------|---------|
| **P0** | Must-have. Required for core functionality. |
| **P1** | Important. Significant value or risk reduction. |
| **P2** | Nice-to-have. Adds value but not blocking. |
| **P3** | Future. Needs more research or dependent work first. |

---

## 1. AI Understanding

### P1: TokenCompression (Real Tokenizer)

Replace the rule-based `charsPerToken` estimation in `DefaultPromptBudget` with real token counting.

- Implements `PromptBudget` interface
- Uses tiktoken or provider SDK tokenizer for accurate token counts
- Model-aware: different tokenizers for different models (GPT-4, Claude, DeepSeek)
- Slot: `PromptBudget` interface — inject via `BuilderOptions.budget`

**Why deferred:** Requires external tokenizer dependency.

### P1: Token-Aware PromptCompression

Implement `TokenCompression` that truncates sections by token count rather than character count.

- Implements `PromptCompression` interface
- Consumes `PromptSelectionResult` + uses `PromptBudget` for measurement
- Can truncate lowest-priority sections when context window exceeded
- Slot: `PromptCompression` interface — inject via `BuilderOptions.compression`

**Why deferred:** Depends on real tokenization (see above).

---

## 2. Planner Improvements

### P1: Planner-Level Reflection Consumption

Make `DefaultReflection` results affect AgentLoop behavior.

- Currently, Reflection records results but does not change loop behavior
- Future: `continueLoop = false` actually stops the loop
- Future: Reflection can adjust strategy (e.g., "try a different approach")

**Why deferred:** Current behavior is safe; behavioral changes need careful testing.

### P2: Retry Policy from AIConfiguration

Move retry policy configuration into `AIConfiguration`.

- Add `retryMaxRetries?: number`, `retryDelay?: number` to AIConfiguration
- `RetryPlanner` reads policy from configuration instead of hardcoded values
- Slot: `AIConfiguration` — additive (optional fields, no breaking changes)

**Why deferred:** AIConfiguration is frozen; additive changes only.

### P3: LLM-Based Reflection

Implement `LLMReflection` that uses an LLM call to evaluate planning results.

- Implements `Reflection` interface
- Uses `PlannerProvider` to ask "Is this plan complete?"
- More nuanced than rule-based `DefaultReflection`

**Why deferred:** Requires additional LLM call per iteration; cost/benefit analysis needed.

---

## 3. Entity Expansion

### P2: Entity Map

Replace the flat `Entity[]` array in World with a Map-based data structure.

- O(1) entity lookup by ID (currently O(n) via `query.findEntity`)
- No API changes to Runtime or Query layers
- Backward compatible: `findById`, `findByType`, `findEntity`, `findEntities` unchanged

**Why deferred:** Performance optimization; not blocking current gameplay.

### P2: More Entity Types

Add new entity types beyond `Tree`.

- Rock, Water, Building, NPC, Monster, Item, etc.
- Each type may have unique properties or behaviors
- Entity type-specific rendering in Canvas

**Why deferred:** Content expansion; not an architecture change.

---

## 4. Tool Calling

### P2: Runtime Tool — CreateEntity

Implement a tool that allows the LLM to create new entities directly.

- Implements `Tool` interface
- Takes `Runtime` reference via constructor (or `RuntimeQuery` + action submission)
- Enables emergent gameplay: "Create a house at position (5,5)"

**Why deferred:** Needs careful security considerations for LLM-driven entity creation.

### P2: Tool-Based World Editing

Implement tools for world state modification.

- `MoveEntityTool` — move existing entities
- `RemoveEntityTool` — remove entities
- `UpdateEntityTool` — change entity properties

**Why deferred:** Tool set expansion; no architecture changes needed.

---

## 5. Memory

### P2: Conversation Persistence

Implement persistent memory storage.

- Replace `DefaultMemory` (Map-based, in-memory) with file/DB-backed implementation
- Conversation history survives page refresh
- Same `Memory` interface — no architecture changes

**Why deferred:** Post-MVP feature; current in-memory storage sufficient for development.

### P3: Embedding/Semantic Memory

Implement embedding-based memory retrieval.

- Stores conversation chunks as embeddings
- Retrieves by semantic similarity (not keyword match)
- Implements `MemoryRanking` interface for ranked retrieval
- Slot: `MemoryRanking` interface — inject via `BuilderOptions.ranking`

**Why deferred:** Requires embedding infrastructure and storage.

---

## 6. Scene Understanding

### P2: World Snapshot Optimization

Optimize world state serialization for large worlds.

- Incremental snapshots (only changed entities)
- Cached serialization (avoid re-serializing unchanged state)
- Still returns string for `PipelineContext.worldState`

**Why deferred:** Optimization; current serialization fine for small worlds.

### P3: Multi-Agent Scene Understanding

Multiple agents collaborating on scene understanding.

- Multiple planners with different focus areas
- Shared world state with partitioned observations
- Cooperative planning and execution

**Why deferred:** Complex architecture; needs Sprint 4 pipeline to be stable first.

---

## 7. Multi-Step Planning

### P2: Undo/Replay for AI Actions

Implement inverse operations for each Action type.

- `CreateEntity` → inverse is `DeleteEntity`
- `MoveEntity` → inverse is `MoveEntity` back to original position
- Enables: undo last action, replay sequence from log

**Why deferred:** New capability; no architecture changes to existing code.

### P3: Hierarchical Planning

Multi-level planning with sub-goals.

- High-level plan → decomposed into sub-plans
- Sub-plans executed by same or different planners
- Results composed back into overall plan

**Why deferred:** Requires significant research and design.

---

## 8. Technical Debt

### P2: Remove Unused Imports in Result Files

- `MemoryRankingResult.ts` imports unused `PromptContext`
- `PromptBudgetResult.ts` imports unused `PromptContext`
- `PromptSelectionResult.ts` imports unused `PromptContext`

**Effort:** Trivial (3 import removals). Low risk.

### P3: Deprecate Legacy Positional Constructor Form

- Mark legacy `DefaultPromptBuilder` constructor overloads as `@deprecated`
- Add TypeScript lint rule to warn on positional param usage
- Remove in Sprint 6 or later

**Effort:** Low. Needs migration guide for downstream consumers.

---

## Sprint 5 Entry Point

The Prompt Assembly pipeline is stable at v0.35. All new work slots into existing interfaces:

```
BuilderOptions {
  budget?: PromptBudget          ← TokenCompression slots here
  compression?: PromptCompression ← TokenCompression slots here
  ranking?: MemoryRanking        ← EmbeddingRanking slots here
  // ... existing fields unchanged
}
```

No existing constructor or interface changes needed. No existing tests need modification.

---

## Backlog Summary

| Priority | Count | Key Items |
|----------|-------|-----------|
| P0 | 0 | — |
| P1 | 3 | TokenCompression, Token-Aware Compression, Planner-Level Reflection |
| P2 | 9 | Entity Map, More Entity Types, Runtime Tool CreateEntity, Tool-Based World Editing, Conversation Persistence, World Snapshot Optimization, Undo/Replay, Remove Unused Imports, Deprecate Legacy Constructor |
| P3 | 6 | LLM-Based Reflection, Embedding Memory, Multi-Agent, Hierarchical Planning |
| **Total** | **18** | |

---

## References

- `docs/project/SPRINT4_REVIEW.md` — Sprint 4 completion report
- `docs/adr/ADR-0047-sprint4-freeze.md` — Freeze decision record
- `docs/project/PROJECT_STATE.md` — Current project state (v0.35)
- `docs/project/TECH_DEBT.md` — Known technical debt