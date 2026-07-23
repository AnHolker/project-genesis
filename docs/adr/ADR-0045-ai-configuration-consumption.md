# ADR-0045: AI Configuration Consumption

**Status:** Accepted  
**Date:** Sprint 4  
**Work Order:** WO-S4-008  
**Architecture Version:** v0.32

---

## Context

WO-S4-007 (AI Configuration Foundation) established the evolved `AIConfiguration` interface with support for `streaming`, `toolCalling`, and `maxOutputTokens`. However, `DefaultPromptBuilder` still owned `providerName` and `modelName` as separate constructor parameters.

The Builder had two sources of provider configuration:

1. `providerName: string` — 8th constructor parameter (default: `'openai'`)
2. `modelName?: string` — 9th constructor parameter (default: `undefined`)

These were used for `ProviderBudget` lookup. The new `AIConfiguration` interface already contains `provider` and `model`, making the separate params redundant.

### Problem

- Two configuration sources violate the Single Source of Truth principle
- Adding more configuration fields would require adding more constructor params
- No clear path for future configuration (e.g., `streaming`, `toolCalling`, `retryPolicy`)

### Constraints

1. **Backward compatible** — All existing constructor forms must continue working.
2. **No runtime behavior changes** — Only configuration flow changes.
3. **No dependency changes** — `AIConfiguration` remains independent from all components.
4. **No PromptBuilder interface change** — `PromptBuilder` interface is unchanged.
5. **No Planner, Provider, Runtime, AgentLoop modifications.**
6. **Single Responsibility** — Builder orchestrates, AIConfiguration configures.

---

## Decision

### 1. DefaultPromptBuilder Constructor Simplified

**Before (WO-S4-006):**
```typescript
constructor(
  modules: PromptModule[],
  renderer?: PromptRenderer,
  compression?: PromptCompression,
  ranking?: MemoryRanking,
  budget?: PromptBudget,
  selection?: PromptSelection,
  providerBudget?: ProviderBudget,
  providerName?: string,       // ← removed
  modelName?: string,          // ← removed
)
```

**After (WO-S4-008):**
```typescript
constructor(
  modules: PromptModule[],
  renderer?: PromptRenderer,
  compression?: PromptCompression,
  ranking?: MemoryRanking,
  budget?: PromptBudget,
  selection?: PromptSelection,
  providerBudget?: ProviderBudget,
  configuration?: AIConfiguration,  // ← replaces providerName + modelName
)
```

### 2. ProviderBudget Lookup Updated

The builder now derives provider/model from `AIConfiguration`:

```typescript
if (this.providerBudget !== undefined) {
  const provider = this.configuration?.provider ?? 'openai'
  const model = this.configuration?.model
  providerBudgetResult = this.providerBudget.getBudget(provider, model)
}
```

Fallback: when `configuration` is not provided, defaults to `provider: 'openai'` with no model (same default as before).

### 3. Backward Compatibility

| Constructor Form | Status | Behavior |
|-----------------|--------|----------|
| `(modules)` | Unchanged | Same as before |
| `(modules, renderer, compression)` | Unchanged | Same as before |
| `(modules, ..., selection)` | Unchanged | Same as before |
| `(modules, ..., providerBudget)` | Unchanged | Same as before |
| `(modules, ..., providerBudget, configuration)` | **Evolved** | Replaces old 8-9 param form |

---

## Consequences

**Positive:**
- Builder now has a single configuration source — `AIConfiguration`
- `providerName` and `modelName` removed from the constructor, reducing parameter count
- Future configuration fields (e.g., `streaming`, `toolCalling`, `charsPerToken`) naturally slot into `AIConfiguration`
- Builder constructor shrinks from 9 to 8 params
- Backward compatible — all existing 1-7 param constructors work unchanged
- DefaultAIConfiguration can be passed directly

**Negative:**
- The 8th constructor parameter semantics changed from `providerName` (string) to `configuration` (AIConfiguration object)
- Callers that used the 8-param or 9-param form with string `providerName`/`modelName` must migrate to config objects

**Neutral:**
- Architecture version bumped to v0.32
- 1048 total tests (1014 existing + 19 new + 15 web)

---

## Future Work (Not Implemented)

| Capability | Description |
|-----------|-------------|
| BuilderOptions | Consolidate all optional params into a single options object |
| AIConfiguration → Pipeline | Pipeline reads `streaming` and `toolCalling` from config |
| AIConfiguration → RetryPlanner | Retry policy from configuration |
| charsPerToken in AIConfiguration | Move the chars-per-token ratio into unified configuration |

---

## References

- ADR-0013: AI Configuration (original)
- ADR-0042: Provider Budget Foundation
- ADR-0043: Provider Budget Consumption
- ADR-0044: AI Configuration Foundation
- WO-S4-007: AI Configuration Foundation
- WO-S4-008: AI Configuration Consumption (this Work Order)