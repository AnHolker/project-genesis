# ADR-0040: Prompt Compression Consumes PromptSelectionResult

**Status:** Accepted  
**Date:** Sprint 4  
**Work Order:** WO-S4-003  
**Architecture Version:** v0.27

---

## Context

WO-S4-002 (Prompt Selection Consumption) enabled `DefaultPromptSelection` to consume `MemoryRanking` and `PromptBudget` results for rule-based section exclusion. However, the Builder was still responsible for applying the selection result — it manually created a filtered `PromptContext` before passing it to Compression.

This design violated the Single Responsibility Principle:

- **Builder** was acting as a second transformer (applying selection), not just an orchestrator
- **Compression** was a pure cleaner but had no awareness of which sections were intentionally excluded

WO-S4-003 completes the Prompt Assembly pipeline by making `PromptCompression` the sole transformer. It now consumes `PromptSelectionResult` directly — removing excluded sections in addition to its existing empty/undefined field stripping.

### Constraints

1. **Compression is the only transformer** — It applies both selection exclusion and field cleaning.
2. **Builder is the only orchestrator** — It calls components in order but no longer duplicates transformation logic.
3. **Selection is the only decider** — It produces the decision. Compression implements it.
4. **Backward compatible** — New `compress()` parameter is optional. Existing calls unchanged.
5. **No interface breaking** — Custom implementations with single-param `compress(context)` continue working.
6. **No ranking, budget, rendering, or provider optimization in compression.**

---

## Decision

### 1. PromptCompression Interface Evolution

The `compress()` method gains an optional second parameter:

```typescript
interface PromptCompression {
  compress(
    context: PromptContext,
    selection?: PromptSelectionResult,
  ): PromptContext
}
```

When `selection` is provided, implementations SHOULD remove sections listed in `selection.excludedSections`. When not provided, implementations MUST preserve existing behavior unchanged.

### 2. DefaultPromptCompression Enhanced

`DefaultPromptCompression.compress()` now performs three cleaning operations in order:

1. **Exclusion filter** — Remove any section whose key is in `selection.excludedSections`
2. **Undefined filter** — Skip any section with `undefined` value
3. **Empty string filter** — Skip any section with `''` value

When `selection` is not provided, the exclusion filter is skipped (behavior identical to WO-S3-017).

### 3. DefaultPromptBuilder Simplified

The Builder no longer manually applies the selection result. Phase 4 — the manual loop over `promptContext` keys to build a `selectedContext` — is removed. Instead:

```typescript
// Before (WO-S4-002):
const selectionResult = this.selection.select(promptContext, rankingResult, budgetResult)
const selectedContext: PromptContext = {}
for (const key of Object.keys(promptContext) as (keyof PromptContext)[]) {
  if (selectionResult.selectedSections.includes(key)) {
    selectedContext[key] = promptContext[key]
  }
}
const compressed = this.compression.compress(selectedContext)

// After (WO-S4-003):
const selectionResult = this.selection.select(promptContext, rankingResult, budgetResult)
const compressed = this.compression.compress(promptContext, selectionResult)
```

### 4. Pipeline Flow

```
PromptContext (full, from modules)
    ↓
MemoryRanking.rank()          → ranks sections
    ↓
PromptBudget.calculate()      → measures section sizes
    ↓
PromptSelection.select()      → decides which sections to exclude
    ↓
PromptCompression.compress(    ← consumes selection result
  promptContext,
  selectionResult,             ← NEW: excluded sections
)
    ↓                         [removes excluded, undefined, empty]
PromptRenderer.render()
    ↓
AIRequest
```

The pipeline now has exactly **one transformer** (Compression) and exactly **one orchestrator** (Builder).

---

## Consequences

**Positive:**
- Prompt Assembly pipeline is fully end-to-end connected
- Single Responsibility Principle restored: Builder orchestrates, Selection decides, Compression transforms
- No duplicated logic between Builder and Compression
- Backward compatible — all existing interfaces unchanged
- All existing tests pass with zero modifications

**Negative:**
- Compression interface signature changed (new optional parameter)

**Neutral:**
- Architecture version bumped to v0.27
- 857 total tests (836 existing + 21 new)

---

## References

- ADR-0034: Context Compression Foundation
- ADR-0037: Prompt Assembly Integration
- ADR-0038: Prompt Selection Foundation
- ADR-0039: Prompt Selection Consumption
- WO-S3-017: Context Compression Foundation
- WO-S4-002: Prompt Selection Consumption
- WO-S4-003: Prompt Compression Consumption (this Work Order)