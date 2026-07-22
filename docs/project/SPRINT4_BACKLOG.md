# Sprint 4 Backlog

> Project Genesis — Sprint 4: AI Polish & Production Readiness
> **Status:** Proposed — No work has started.

---

## Goal

Advance the Prompt Pipeline from foundations to real implementations. Move from measurement/ranking to actual compression, token awareness, and memory management.

---

## Backlog Items

### P0 — Core AI Production Readiness

#### Token Compression (Real)

**Problem:** `DefaultPromptCompression` only strips empty/undefined fields. It cannot truncate or summarize content. Long conversations will exceed LLM context windows.

**Direction:**
- Implement real token counting via `tiktoken` (or similar)
- `TokenBudget` implementing `PromptBudget` — sets `estimatedTokens` with real token count
- `TokenCompression` implementing `PromptCompression` — truncates/summarizes when token budget exceeded
- Integrate with `AIConfiguration.maxTokens` for budget limits
- Consume `PromptBudgetResult` from assembly metadata

**Dependencies:**
- `tiktoken` dependency
- WO-S3-017 (PromptCompression interface ✓)
- WO-S3-018 (PromptBudget interface with `estimatedTokens?` ✓)
- WO-S3-020 (Prompt Assembly Integration ✓)

**Risk:** Real tokenization adds a dependency and computation overhead.

---

#### Memory Ranking Consumption

**Problem:** `DefaultMemoryRanking` exists but `MemoryPromptModule` still returns ALL conversation history. No top-K filtering or relevance-based selection.

**Direction:**
- `MemoryPromptModule` consumes `MemoryRankingResult` to select top-K memories
- Or: add ranking-aware memory retrieval in `DefaultMemory` (or `ScoredMemory`)
- Configurable max memory entries via pipeline config

**Dependencies:**
- WO-S3-019 (MemoryRanking interface ✓)

**Risk:** Changes to `MemoryPromptModule` output may affect snapshot tests.

---

### P1 — Quality of Life

#### World Snapshot Optimization

**Problem:** `formatWorldState()` re-serializes the entire world on every `send()`. For large worlds, this adds overhead.

**Direction:**
- Cache serialized world state string in `gameStore`
- Incremental update on entity create/move
- Lazy serialization — only format when world state changes

**Dependencies:**
- None

**Risk:** Low — well-understood caching pattern.

---

#### Prompt Optimization

**Problem:** Static system prompts cannot be adapted per user input. Token usage is not optimized for specific models.

**Direction:**
- Dynamic system prompt generation based on context
- Model-specific prompt tuning (GPT-4 vs Claude vs DeepSeek)
- Prompt template versioning

**Dependencies:**
- WO-S3-016 (PromptRenderer — custom renderers for different models)

**Risk:** Medium — model-specific tuning requires experimentation.

---

### P2 — Advanced AI

#### Undo / Replay AI

**Problem:** No action history. Cannot undo an AI-generated sequence or replay past states.

**Direction:**
- Store action history as part of Memory
- Pipeline supports deterministic replay from action log
- UI: "Undo last action" button that reverses AI actions

**Dependencies:**
- WO-S3-010 (Multi-Step Agent Loop — action history exists in LoopStep)

**Risk:** Requires inverse actions for each Action type.

---

#### Provider Registration Plugin

**Problem:** `ProviderFactory` uses a `switch` statement. Adding a new provider requires modifying ProviderFactory source.

**Direction:**
- Provider registration pattern (Map-based, self-registering)
- Plugin-like provider addition without source changes

**Dependencies:**
- None

**Risk:** Low — refactoring pattern, no behavior change.

---

#### Conversation Persistence

**Problem:** `DefaultMemory` stores conversation in-memory Map. History lost on page refresh.

**Direction:**
- LocalStorage-backed memory (for web)
- Optional server-side persistence
- Configurable storage strategy

**Dependencies:**
- WO-S2-007 (Memory interface ✓)

**Risk:** Low — additive, not breaking.

---

#### Prompt Versioning

**Problem:** No mechanism to track or version system prompts. Changes to prompt wording may break response parsing.

**Direction:**
- Version ID on PromptModule output
- Snapshot comparison for prompt changes
- Rollback capability

**Dependencies:**
- WO-S3-015 (PromptContext — structured sections enable versioning)

**Risk:** Low — but may not be needed until multiple prompt iterations occur.

---

### P3 — Future Foundation

#### Embedding / Semantic Memory

**Problem:** Memory ranking currently uses fixed rules. No semantic understanding.

**Direction:**
- `EmbeddingRanking` implementing `MemoryRanking` — cosine similarity with user input
- Vector-based memory retrieval
- Requires embedding API or local model

**Dependencies:**
- WO-S3-019 (MemoryRanking interface ✓)
- External embedding API (OpenAI, etc.)

**Risk:** High — adds embedding dependency, cost, and latency.

---

#### LLM-based Compression

**Problem:** Summarization requires a secondary LLM call. Token compression may lose important context.

**Direction:**
- `LLMCompression` implementing `PromptCompression`
- Secondary LLM call to summarize sections
- Configurable compression strategy (truncate vs summarize vs hybrid)

**Dependencies:**
- WO-S3-017 (PromptCompression interface ✓)
- External LLM API

**Risk:** High — adds latency and cost per compression.

---

## Dependency Map

| Item | Depends On | Unlocks |
|------|-----------|---------|
| Token Compression | tiktoken lib, Budget ✓, Compression ✓ | Long conversation support |
| Memory Ranking Consumption | Ranking ✓, MemoryPromptModule | Context window efficiency |
| World Snapshot Optimization | — | Performance at scale |
| Undo/Replay | LoopStep ✓ | Debugging, user trust |
| Provider Registration | — | New providers without source changes |
| Conversation Persistence | Memory ✓ | State across sessions |
| Embedding Ranking | Ranking ✓, Embedding API | Semantic memory |
| LLM Compression | Compression ✓, LLM API | Intelligent summarization |

---

## Non-Goals for Sprint 4

- No server-side Runtime
- No multiplayer
- No worker threads
- No new provider integrations (unless plugin registration makes it trivial)
- No Vue/Renderer refactoring (unless required by undo/replay UI)

---

## Estimation

| Priority | Item | Estimated Effort |
|----------|------|-----------------|
| P0 | Token Compression (Real) | Medium |
| P0 | Memory Ranking Consumption | Medium |
| P1 | World Snapshot Optimization | Small |
| P1 | Prompt Optimization | Medium |
| P2 | Undo / Replay AI | Large |
| P2 | Provider Registration Plugin | Small |
| P2 | Conversation Persistence | Small |
| P2 | Prompt Versioning | Small |
| P3 | Embedding / Semantic Memory | Large |
| P3 | LLM-based Compression | Large |