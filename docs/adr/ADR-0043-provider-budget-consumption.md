# ADR-0043: Provider Budget Consumption

**Status:** Accepted  
**Date:** Sprint 4  
**Work Order:** WO-S4-006  
**Architecture Version:** v0.30

---

## Context

WO-S4-005 (Provider Budget Foundation) established the `ProviderBudget` interface and `DefaultProviderBudget` implementation with predefined provider/model token capacity limits. However, `PromptSelection` had no way to consume these limits.

WO-S4-002 (Prompt Selection Consumption) enabled `DefaultPromptSelection` to consume `MemoryRankingResult` and `PromptBudgetResult` for rule-based section exclusion, but the budget threshold was a fixed `maxBudgetChars` parameter (default: Infinity).

To enable provider-aware prompt optimization, `PromptSelection` needs to dynamically calculate its budget threshold from the target provider/model's token capacity.

### Constraints

1. **ProviderBudget remains independent** — No dependency on PromptBudget. Two separate concerns.
2. **PromptBudget remains independent** — No dependency on ProviderBudget.
3. **PromptBuilder is the sole orchestrator** — The builder calls ProviderBudget and passes the result to Selection.
4. **No circular dependencies** — DAG direction: Ranking → Budget → ProviderBudget → Selection → Compression → Renderer.
5. **Selection still only decides** — Selection produces a decision; Compression applies it.
6. **Compression still only transforms** — No selection logic in compression.
7. **Backward compatible** — All existing interfaces unchanged. New parameters are optional.
8. **No Planner, Provider, Runtime, AgentLoop, or PromptRenderer modifications.**

---

## Decision

### 1. PromptSelection Interface Evolution

The `select()` method gains an optional fourth parameter:

```typescript
interface PromptSelection {
  select(
    context: PromptContext,
    ranking?: MemoryRankingResult,
    budget?: PromptBudgetResult,
    providerBudget?: ProviderBudgetResult,  // NEW
  ): PromptSelectionResult
}
```

When `providerBudget` is provided, implementations SHOULD use it to dynamically calculate the budget threshold. When not provided, implementations MUST fall back to their configured static threshold (if any).

### 2. DefaultPromptSelection Enhanced

`DefaultPromptSelection` now supports two budget threshold modes:

**Static mode** (backward compatible): Uses `maxBudgetChars` constructor parameter (default: Infinity).

**Dynamic mode** (new): When `ProviderBudgetResult` is passed to `select()`:
- Calculates `effectiveMaxBudgetChars = providerBudget.maxInputTokens * charsPerToken`
- Overrides the static `maxBudgetChars` for this invocation only
- `charsPerToken` is a new optional constructor parameter (default: 4, matching `DefaultPromptBudget`'s default)

```typescript
class DefaultPromptSelection implements PromptSelection {
  constructor(maxBudgetChars?: number, charsPerToken?: number)
  // maxBudgetChars default: Infinity
  // charsPerToken default: 4
}
```

**Algorithm:**
1. If no ranking or budget provided → preserve all (passthrough fallback)
2. If `providerBudget` provided → use `providerBudget.maxInputTokens * charsPerToken` as effective threshold
3. If `providerBudget` not provided → use `this.maxBudgetChars` (static threshold)
4. If `totalLength <= effective threshold` → preserve all sections
5. If `totalLength > effective threshold` → remove lowest-priority sections until within threshold

**Properties:**
- Non-mutating: never modifies inputs
- Deterministic: fully rule-based
- Pure: no side effects
- Provider-independent: works identically with all providers

### 3. DefaultPromptBuilder Extended

The builder gains three new optional constructor parameters:

```typescript
constructor(
  modules: PromptModule[],
  renderer?: PromptRenderer,
  compression?: PromptCompression,
  ranking?: MemoryRanking,
  budget?: PromptBudget,
  selection?: PromptSelection,
  providerBudget?: ProviderBudget,  // NEW — optional, not injected by default
  providerName?: string,            // NEW — default: 'openai'
  modelName?: string,               // NEW — default: undefined
)
```

**Pipeline execution in `build()`:**

```
Phase 1: Module Collection     → PromptModule[] → PromptContext
Phase 2: MemoryRanking         → ranking.rank()
Phase 3: PromptBudget          → budget.calculate()
Phase 4: ProviderBudget        → providerBudget.getBudget()  (NEW)
Phase 5: PromptSelection       → selection.select(context, ranking, budget, providerBudgetResult)
Phase 6: PromptCompression     → compression.compress(context, selectionResult)
Phase 7: PromptRenderer        → renderer.render(compressed)
```

**Metadata enrichment:**
When ProviderBudget is injected, the `providerBudget` result is included in `AIRequest.metadata.promptAssembly`.

### 4. Backward Compatibility

- `select(context)` — unchanged, still works
- `select(context, ranking, budget)` — unchanged, still works
- `DefaultPromptSelection()` — unchanged
- `DefaultPromptSelection(Infinity)` — unchanged
- `DefaultPromptSelection(number)` — unchanged
- `DefaultPromptBuilder(modules)` — unchanged
- `DefaultPromptBuilder(modules, ..., 6 params)` — unchanged
- `DefaultPromptBuilder(modules, ..., 7+ params with providerBudget)` — new, optional
- Existing custom `PromptSelection` implementations ignoring the 4th param — still valid TypeScript

---

## Consequences

**Positive:**
- PromptSelection can now dynamically adapt to provider/model capacity
- Different providers (OpenAI 8K, DeepSeek 65K, Anthropic 100K) produce different selection behavior
- Unknown providers automatically fall back to conservative limits
- ProviderBudget remains a standalone component with no coupling to PromptBudget
- Complete backward compatibility preserved
- Provider-agnostic — works identically with Mock, OpenAI, DeepSeek
- Metadata enriched with providerBudget result for downstream observability

**Negative:**
- DefaultPromptBuilder constructor grows to 9 parameters (though all optional)
- DefaultPromptSelection constructor signature changed (new optional charsPerToken param)
- `select()` interface signature changed (new optional providerBudget param)

**Neutral:**
- Architecture version bumped to v0.30
- 985 total tests (926 existing + 44 new + 15 web)

---

## Future Work (Not Implemented)

| Capability | Description |
|-----------|-------------|
| ProviderBudget → PromptSelection threshold calculation | Complete — implemented in this WO |
| AIConfiguration → ProviderBudget | Derive provider/model from AIConfiguration instead of constructor params |
| Dynamic Budget Discovery | Fetch limits from provider API endpoints |
| Custom charsPerToken per provider | Allow provider-specific char-to-token ratios |

---

## References

- ADR-0038: Prompt Selection Foundation
- ADR-0039: Prompt Selection Consumption
- ADR-0042: Provider Budget Foundation
- WO-S4-001: Prompt Selection Foundation
- WO-S4-002: Prompt Selection Consumption
- WO-S4-005: Provider Budget Foundation
- WO-S4-006: Provider Budget Consumption (this Work Order)