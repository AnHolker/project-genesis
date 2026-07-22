# ADR-0036: Memory Ranking Foundation

**Status:** Accepted  
**Date:** Sprint 3  
**Work Order:** WO-S3-019  
**Architecture Version:** v0.23

---

## Context

The Prompt pipeline currently flows through `PromptModule[] → PromptContext → PromptCompression → PromptRenderer → string`. Budget measurement has been added, but there is no mechanism to determine **which sections of a PromptContext are most important**.

Future capabilities like Context Window management and intelligent Compression require a standardized way to understand section priority:
1. Which sections should be preserved first when token budgets are tight?
2. What is the relative importance of UserInput vs System vs Memory?
3. How can future embedding-based ranking slot into the same interface?

A dedicated Memory Ranking abstraction addresses this gap without coupling the ranking logic to any specific consumer.

### Constraints

1. **Ranking only prioritizes — never removes** — Input/output is `PromptContext → MemoryRankingResult`. Ranking must NOT alter the context.
2. **Compression consumes ranking, not vice versa** — The pipeline remains: `Context → Budget → Ranking → Compression → Renderer`
3. **Ranking is replaceable** — A unified interface allows `RuleBasedRanking`, `HeuristicRanking`, `EmbeddingRanking`, `LLMRanking`
4. **No AI/embedding in default** — Default ranking uses fixed priority rules only. No Embedding, Cosine Similarity, Vector Search, or LLM Evaluation.
5. **One-way dependency** — `PromptContext → Ranking → MemoryRankingResult`. Ranking must NOT depend on Planner, Provider, Runtime, or AgentLoop.
6. **PromptBuilder does NOT consume Ranking** — This WO establishes the capability. Integration with Builder, Compression, or Renderer is deferred.
7. **Not Memory Store, Vector Database, Embedding, Semantic Search, or Compression** — Those are separate future Work Orders.
8. **Backward compatible** — All existing interfaces unchanged. No modifications to any existing component.

---

## Decision

### 1. New Module: `packages/ai/src/prompt/MemoryRankingResult.ts`

Defines the ranking output:

```typescript
interface MemoryRankingResult {
  rankedSections: string[]
  priorities: Record<string, number>
}
```

- `rankedSections` — section names ordered by priority (highest first). Only populated sections included.
- `priorities` — per-section priority scores (higher = more important).

### 2. New Module: `packages/ai/src/prompt/MemoryRanking.ts`

Defines the ranking interface:

```typescript
interface MemoryRanking {
  rank(context: PromptContext): MemoryRankingResult
}
```

- Single-method interface
- Accepts `PromptContext`, returns `MemoryRankingResult`
- Implementations MUST NOT modify the input context
- No dependencies on any other component

### 3. New Module: `packages/ai/src/prompt/DefaultMemoryRanking.ts`

Default implementation with fixed priority rules:

| Priority | Section | Score | Rationale |
|----------|---------|-------|-----------|
| 1 (Highest) | userInput | 100 | What the user actually asked |
| 2 | reflections | 80 | Task-specific insight from AI self-evaluation |
| 3 | observations | 60 | Current execution context from tools |
| 4 | memory | 40 | Conversation history for continuity |
| 5 | worldState | 20 | Spatial context (useful but often large) |
| 6 (Lowest) | system | 10 | Static instructions, always present |

- Only populated sections (defined and non-empty) are included
- Sections sorted in descending priority order
- Unknown sections get priority 0
- Non-mutating, deterministic, pure
- Provider-agnostic — no binding to OpenAI, DeepSeek, or any provider

Plus an exported constant:

```typescript
export const DEFAULT_RANKING_PRIORITY: Record<string, number> = {
  userInput: 100,
  reflections: 80,
  observations: 60,
  memory: 40,
  worldState: 20,
  system: 10,
}
```

### 4. Exports

- `packages/ai/src/prompt/index.ts` — exports `MemoryRanking` (type), `DefaultMemoryRanking`, `DEFAULT_RANKING_PRIORITY`, `MemoryRankingResult` (type)
- `packages/ai/src/index.ts` — exports `MemoryRanking` (type), `DefaultMemoryRanking`, `DEFAULT_RANKING_PRIORITY`, `MemoryRankingResult` (type)

### 5. No Integration with Builder, Compression, or Renderer

MemoryRanking is a standalone capability in this WO. It is NOT called by:
- `DefaultPromptBuilder`
- `DefaultPromptCompression`
- `DefaultPromptRenderer`

Integration will happen in future Work Orders.

---

## Consequences

**Positive:**
- Well-defined ranking abstraction for future consumption by Compression
- All existing code continues unchanged — no interface modifications
- Default implementation uses zero advanced dependencies (fixed rules only)
- `rankedSections` array directly consumable by future Compression logic
- `priorities` map provides extensible scoring for future heuristic/embedding ranking
- Ranking is testable in isolation (no dependencies)
- Pure function contract (no side effects, no mutation)
- Provider-agnostic — works identically with Mock, OpenAI, DeepSeek
- Future EmbeddingRanking or LLMRanking can slot in via same interface
- All existing tests pass with zero modifications (701+ tests)

**Negative:**
- No integration yet — Ranking must be manually wired in future WOs

**Neutral:**
- `MemoryRanking`, `DefaultMemoryRanking`, `DEFAULT_RANKING_PRIORITY`, `MemoryRankingResult` added to public API
- Architecture version bumped to v0.23

---

## Future Work (Not Implemented)

| Capability | Description |
|-----------|-------------|
| HeuristicRanking | Score by recency, length, keyword match |
| EmbeddingRanking | Semantic similarity via embeddings |
| LLMRanking | LLM-based importance evaluation |
| Ranking → Compression | Compression consumes Ranking to decide what to keep/truncate |
| Ranking → PromptBuilder | Builder reorders sections based on ranking |

---

## References

- ADR-0032: Structured Prompt Context
- ADR-0033: Prompt Renderer Foundation
- ADR-0034: Context Compression Foundation
- ADR-0035: Prompt Budget Foundation
- WO-S3-015: Structured Prompt Context Foundation
- WO-S3-016: Prompt Renderer Foundation
- WO-S3-017: Context Compression Foundation
- WO-S3-018: Prompt Budget Foundation
- WO-S3-019: Memory Ranking Foundation (this Work Order)