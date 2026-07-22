# ADR-0039: Prompt Selection Consumes MemoryRanking and PromptBudget

**Status:** Accepted  
**Date:** Sprint 4  
**Work Order:** WO-S4-002  
**Architecture Version:** v0.26

---

## Context

WO-S4-001 (Prompt Selection Foundation) established the `PromptSelection` interface with a passthrough-only default implementation. The `select()` method accepted only a `PromptContext` and returned every populated section. Meanwhile, `MemoryRanking` and `PromptBudget` results were already being computed in the pipeline and passed to `AIRequest.metadata.promptAssembly`, but `PromptSelection` had no way to consume them.

Sprint 4 introduces the first **Rule-Based Prompt Selection** implementation — enabling `DefaultPromptSelection` to use `MemoryRankingResult` and `PromptBudgetResult` to make deterministic section inclusion decisions.

### Constraints

1. **Consumption only** — Selection still only decides. It does NOT modify the context.
2. **Pure function** — Same input always produces same output. No side effects.
3. **Deterministic** — Fully rule-based. No probabilistic logic, no AI reasoning.
4. **No tokenizer** — Budget comparison uses character counts only. No tiktoken, no GPT/Claude tokenizer.
5. **No embeddings** — No embedding-based or semantic selection.
6. **No LLM selection** — No LLM calls for decision making.
7. **No provider-specific optimization** — Works identically with Mock, OpenAI, DeepSeek.
8. **No compression, no rendering** — Selection only decides which sections to include.
9. **Backward compatible** — Existing `select(context)` calls continue working unchanged.
10. **No interface breaking** — New parameters are optional. Existing custom implementations unchanged.

---

## Decision

### 1. PromptSelection Interface Evolution

The `select()` method gains two optional parameters:

```typescript
interface PromptSelection {
  select(
    context: PromptContext,
    ranking?: MemoryRankingResult,
    budget?: PromptBudgetResult,
  ): PromptSelectionResult
}
```

When `ranking` and `budget` are both provided, implementations SHOULD use them for rule-based decisions. When either is missing, implementations MUST preserve all sections (passthrough).

### 2. DefaultPromptSelection: Rule-Based Selection

`DefaultPromptSelection` now implements deterministic rule-based selection with a configurable budget threshold:

```typescript
class DefaultPromptSelection implements PromptSelection {
  constructor(maxBudgetChars?: number)  // default: Infinity
}
```

**Algorithm:**

1. If `ranking` or `budget` is not provided → preserve all sections (passthrough fallback)
2. If `budget.totalLength <= maxBudgetChars` → preserve all sections (budget sufficient)
3. If `budget.totalLength > maxBudgetChars` → budget constrained:
   a. Sort populated sections by priority ascending (lowest priority first)
   b. Iteratively remove lowest-priority sections until remaining `totalLength <= maxBudgetChars`
   c. **Guard:** never exclude the last remaining section (at least one must remain)

**Properties:**
- Non-mutating: never modifies the input PromptContext
- Deterministic: fully rule-based, same input always produces same output
- Idempotent: same result when called multiple times with same inputs
- Pure: no side effects
- Provider-independent: no binding to any provider
- No AI, no embeddings, no LLM calls, no semantic search

### 3. DefaultPromptBuilder Wired

`DefaultPromptBuilder.build()` and `buildContext()` now pass `rankingResult` and `budgetResult` to `selection.select()`:

```typescript
// Phase 3: PromptSelection — now consumes MemoryRanking and PromptBudget
const selectionResult = this.selection.select(promptContext, rankingResult, budgetResult)
```

### 4. Pipeline Diagram Updated

```
PromptModules → PromptContext
    ↓
MemoryRanking.rank()           ← pure measurement
    ↓
PromptBudget.calculate()       ← pure measurement
    ↓
PromptSelection.select(        ← consults ranking + budget
  context,
  rankingResult,               ← NEW: section priorities
  budgetResult,                ← NEW: section sizes
)
    ↓
PromptCompression.compress()
    ↓
PromptRenderer.render()
    ↓
AIRequest { prompt, metadata.promptAssembly }
```

### 5. Backward Compatibility

- `select(context)` — unchanged, still works (passthrough when ranking/budget omitted)
- `DefaultPromptSelection()` — unchanged, defaults to `Infinity` budget
- `DefaultPromptBuilder` 1-param, 3-param, 5-param constructors — unchanged
- Custom implementations of `PromptSelection` with single-param `select(context)` — still valid TypeScript (the new params are optional)
- All existing tests pass with zero modifications

---

## Consequences

**Positive:**
- PromptSelection now fully participates in the Prompt Assembly pipeline
- Budget-aware section exclusion is implemented with zero probabilistic logic
- MemoryRanking priorities directly influence which sections are preserved
- Guard against complete exclusion ensures at least one section always remains
- Complete backward compatibility preserved
- Provider-agnostic — works identically with Mock, OpenAI, DeepSeek

**Negative:**
- DefaultPromptSelection constructor signature changed (new optional parameter)
- `select()` interface signature changed (new optional parameters)

**Neutral:**
- Architecture version bumped to v0.26
- 836 total tests (805 existing + 31 new)

---

## Future Work (Not Implemented)

| Capability | Description |
|-----------|-------------|
| TokenBudget Selection | Token-aware budget threshold (using tiktoken) |
| EmbeddingSelection | Semantic relevance-based section selection |
| LLMSelection | LLM-based importance evaluation for sections |
| Dynamic Budget | Budget threshold derived from provider/context window |
| Selection → Compression | Compression uses selection result to guide truncation |

---

## References

- ADR-0035: Prompt Budget Foundation
- ADR-0036: Memory Ranking Foundation
- ADR-0037: Prompt Assembly Integration
- ADR-0038: Prompt Selection Foundation
- WO-S4-001: Prompt Selection Foundation
- WO-S4-002: Prompt Selection Consumption (this Work Order)