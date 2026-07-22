# ADR-0038: Prompt Selection Foundation

**Status:** Accepted  
**Date:** Sprint 4  
**Work Order:** WO-S4-001  
**Architecture Version:** v0.25

---

## Context

The Prompt pipeline currently flows through `PromptModule[] → PromptContext → MemoryRanking → PromptBudget → PromptCompression → PromptRenderer`. There is no dedicated component responsible for deciding **which sections of a PromptContext should participate in the final prompt**.

Future capabilities like Budget-aware section exclusion, Embedding-based relevance selection, and LLM-based importance evaluation all require a well-defined injection point in the pipeline — a component that determines section inclusion without performing compression or rendering.

### Constraints

1. **Selection only decides — never removes** — Input/output is `PromptContext → PromptSelectionResult`. Selection must NOT alter the context.
2. **Selection slots between Budget and Compression** — The pipeline becomes: `Context → Ranking → Budget → Selection → Compression → Renderer`
3. **Selection is replaceable** — A unified interface allows `BudgetAwareSelection`, `EmbeddingSelection`, `LLMSelection`
4. **No AI/logic in default** — Default selection preserves every populated section. No filtering, no token awareness, no embeddings, no LLM calls.
5. **One-way dependency** — `PromptContext → Selection → PromptSelectionResult`. Selection must NOT depend on Planner, Provider, Runtime, or AgentLoop.
6. **DefaultPromptBuilder is the sole orchestrator** — Selection is called by the Builder, which also applies the result to filter the context.
7. **Builder applies selection** — Selection returns a result object; the Builder creates a new filtered `PromptContext` before passing it to Compression.
8. **Not Compression, Rendering, Ranking, Budget, or Token Optimization** — Those are separate responsibilities.
9. **Backward compatible** — All existing interfaces unchanged. Selection is an optional constructor parameter with a pass-through default.

---

## Decision

### 1. New Module: `packages/ai/src/prompt/PromptSelectionResult.ts`

Defines the selection output:

```typescript
interface PromptSelectionResult {
  selectedSections: string[]
  excludedSections: string[]
}
```

- `selectedSections` — section names to preserve in the final prompt
- `excludedSections` — section names to exclude from the final prompt
- Empty `excludedSections` means default pass-through (all sections preserved)

### 2. New Module: `packages/ai/src/prompt/PromptSelection.ts`

Defines the selection interface:

```typescript
interface PromptSelection {
  select(context: PromptContext): PromptSelectionResult
}
```

- Single-method interface
- Accepts `PromptContext`, returns `PromptSelectionResult`
- Implementations MUST NOT modify the input context
- No dependencies on any other component

### 3. New Module: `packages/ai/src/prompt/DefaultPromptSelection.ts`

Default implementation:

- Iterates over all `PromptContext` entries
- For each populated field (not `undefined`, not `''`), includes it in `selectedSections`
- Returns empty `excludedSections` array
- Non-mutating, deterministic, pure, idempotent

This is intentionally minimal — no token awareness, no ranking consumption, no heuristics, no embeddings, no LLM calls.

### 4. DefaultPromptBuilder Extended

`DefaultPromptBuilder` constructor gains an optional sixth parameter:

```typescript
constructor(
  modules: PromptModule[],
  renderer?: PromptRenderer,          // default: DefaultPromptRenderer
  compression?: PromptCompression,    // default: DefaultPromptCompression
  ranking?: MemoryRanking,            // default: DefaultMemoryRanking
  budget?: PromptBudget,              // default: DefaultPromptBudget
  selection?: PromptSelection,        // default: DefaultPromptSelection  ← NEW
)
```

All parameters remain optional with sensible defaults. The 1-param `(modules)`, 3-param `(modules, renderer, compression)`, and 5-param `(modules, renderer, compression, ranking, budget)` signatures continue working identically.

### 5. Prompt Assembly Pipeline

The `build()` method now executes in seven ordered phases:

```
Phase 1: Module Collection
  PromptModule[] → buildContext() → merge into PromptContext

Phase 2: MemoryRanking (pure measurement)
  ranking.rank(promptContext) → MemoryRankingResult (not modified)

Phase 3: PromptBudget (pure measurement)
  budget.calculate(promptContext) → PromptBudgetResult (not modified)

Phase 4: PromptSelection (pure decision)
  selection.select(promptContext) → PromptSelectionResult (not modified)

Phase 5: Apply Selection (builder responsibility)
  Create new PromptContext with only selectedSections

Phase 6: PromptCompression (transformer)
  compression.compress(selectedContext) → new PromptContext (original unchanged)

Phase 7: PromptRenderer (serializer)
  renderer.render(compressed) → string
  → AIRequest { prompt, metadata: { promptAssembly: { ranking, budget, selection } } }
```

### 6. Metadata Enrichment

The `AIRequest` now carries selection metadata alongside ranking and budget:

```typescript
{
  prompt: "the rendered prompt string",
  metadata: {
    promptAssembly: {
      ranking: MemoryRankingResult,
      budget: PromptBudgetResult,
      selection: PromptSelectionResult,  // ← NEW
    }
  }
}
```

### 7. Exports

- `packages/ai/src/prompt/index.ts` — exports `PromptSelection` (type), `DefaultPromptSelection` (class), `PromptSelectionResult` (type)
- `packages/ai/src/index.ts` — exports `PromptSelection` (type), `DefaultPromptSelection` (class), `PromptSelectionResult` (type)

### 8. No Component Coupling

The following dependencies remain strictly **disallowed** and are NOT implemented:
- Selection → Compression (selection does not call compression)
- Selection → Ranking (selection does not consume ranking)
- Selection → Budget (selection does not consume budget)
- Compression → Selection (compression does not call selection)

---

## Consequences

**Positive:**
- Well-defined selection abstraction for future intelligent section inclusion
- All existing code continues unchanged — no interface modifications
- Default implementation is a passthrough (behavior identical to pre-selection)
- Selection is testable in isolation (no dependencies)
- Pure function contract (no side effects, no mutation)
- Provider-agnostic — works identically with Mock, OpenAI, DeepSeek
- Future BudgetAwareSelection, EmbeddingSelection, or LLMSelection can slot in via same interface
- Selection result stored in metadata for downstream consumption
- All existing tests pass with zero modifications (805+ tests)

**Negative:**
- DefaultPromptBuilder constructor grows to 6 parameters (though all optional)
- Every `build()` call now runs Selection (negligible overhead — Object.entries iteration)

**Neutral:**
- `PromptSelection`, `DefaultPromptSelection`, `PromptSelectionResult` added to public API
- Architecture version bumped to v0.25

---

## Future Work (Not Implemented)

| Capability | Description |
|-----------|-------------|
| BudgetAwareSelection | Exclude low-priority sections when budget is tight |
| EmbeddingSelection | Semantic relevance-based section selection |
| LLMSelection | LLM-based importance evaluation for sections |
| HeuristicSelection | Rule-based selection by section type and content |
| Selection → Compression | Compression uses selection result to guide truncation |
| Selection → Builder | Builder reorders sections based on selection priority |

---

## References

- ADR-0032: Structured Prompt Context
- ADR-0033: Prompt Renderer Foundation
- ADR-0034: Context Compression Foundation
- ADR-0035: Prompt Budget Foundation
- ADR-0036: Memory Ranking Foundation
- ADR-0037: Prompt Assembly Integration
- WO-S3-017: Context Compression Foundation
- WO-S3-018: Prompt Budget Foundation
- WO-S3-019: Memory Ranking Foundation
- WO-S3-020: Prompt Assembly Integration
- WO-S4-001: Prompt Selection Foundation (this Work Order)