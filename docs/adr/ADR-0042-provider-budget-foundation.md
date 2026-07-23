# ADR-0042: Provider Budget Foundation

**Status:** Accepted  
**Date:** Sprint 4  
**Work Order:** WO-S4-005  
**Architecture Version:** v0.29

---

## Context

The Prompt pipeline currently has `PromptBudget`, which measures the estimated size of a prompt (total character count, per-section lengths, estimated tokens). However, there is no component that represents the **token capacity of different AI providers and models**.

Future capabilities like Provider-aware Prompt Optimization and Model-aware Budget Management require a standardized way to:

1. Look up the maximum input token capacity of a provider/model
2. Look up the maximum output token capacity of a provider/model
3. Answer the question: "How many tokens can this provider accept?"

A dedicated `ProviderBudget` abstraction addresses this gap without coupling provider capacity to prompt measurement.

### Relation to Existing Components

`ProviderBudget` is **completely independent** from `PromptBudget`:

| Aspect | PromptBudget | ProviderBudget |
|--------|-------------|----------------|
| What it measures | Prompt size (characters/tokens) | Provider capacity (max tokens) |
| Input | `PromptContext` | `provider: string`, `model?: string` |
| Output | `PromptBudgetResult` (totalLength, sectionLengths) | `ProviderBudgetResult` (maxInputTokens, maxOutputTokens) |
| Dependency | Depends on `PromptContext` | Completely standalone |
| Slot in pipeline | Between Ranking and Selection | Not in pipeline — configuration only |

### Constraints

1. **Pure lookup component** — No side effects, no I/O, no network requests, no SDK calls.
2. **No dependency on PromptBudget** — ProviderBudget is a separate abstraction.
3. **No dependency on PromptSelection** — ProviderBudget is configuration, not a pipeline stage.
4. **No dependency on Planner** — Must remain completely independent.
5. **No dependency on Provider implementations** — No import of OpenAI SDK, Anthropic SDK, DeepSeek SDK, or any concrete Provider class.
6. **No tokenizer** — ProviderBudget does not count tokens; it provides maximum capacity limits.
7. **No prompt compression** — ProviderBudget does not change or compress prompts.
8. **No prompt selection** — ProviderBudget does not decide which sections to include.
9. **No dynamic capability discovery** — All values are static, conservative defaults.
10. **No automatic model switching** — ProviderBudget only returns capacity limits; it does not switch models or providers.
11. **Backward compatible** — All existing interfaces unchanged.

---

## Decision

### 1. New Module: `packages/ai/src/prompt/ProviderBudgetResult.ts`

Defines the budget output for a provider/model combination:

```typescript
interface ProviderBudgetResult {
  maxInputTokens: number
  maxOutputTokens?: number
}
```

- `maxInputTokens` — Maximum input tokens the provider/model supports (required)
- `maxOutputTokens` — Optional maximum output tokens (some providers don't publicly document this)

### 2. New Module: `packages/ai/src/prompt/ProviderBudget.ts`

Defines the provider budget interface:

```typescript
interface ProviderBudget {
  getBudget(provider: string, model?: string): ProviderBudgetResult
}
```

- Single-method interface
- Accepts `provider` (required) and `model` (optional)
- Returns capacity information for the given provider/model
- Implementations MUST be deterministic, pure, and side-effect free
- No dependencies on any other component

### 3. New Module: `packages/ai/src/prompt/DefaultProviderBudget.ts`

Default implementation with predefined conservative limits:

**Lookup order:**
1. Exact model override (provider + model)
2. Generic provider default
3. Unknown provider fallback (very conservative)

**Provider defaults:**

| Provider | maxInputTokens | maxOutputTokens |
|----------|---------------|-----------------|
| openai (generic) | 8,192 | 4,096 |
| deepseek (generic) | 65,536 | 8,192 |
| anthropic (generic) | 100,000 | 4,096 |
| mock | 4,096 | 1,024 |
| unknown | 4,096 | 1,024 |

**Model-specific overrides:**

| Provider | Model | maxInputTokens | maxOutputTokens |
|----------|-------|---------------|-----------------|
| openai | gpt-4 | 8,192 | 4,096 |
| openai | gpt-4-turbo | 128,000 | 4,096 |
| openai | gpt-4o | 128,000 | 16,384 |
| openai | gpt-3.5-turbo | 16,385 | 4,096 |
| deepseek | deepseek-chat | 65,536 | 8,192 |
| anthropic | claude-3-opus | 200,000 | 4,096 |
| anthropic | claude-3-sonnet | 200,000 | 4,096 |
| anthropic | claude-3-haiku | 200,000 | 4,096 |

### 4. Exports

- `packages/ai/src/prompt/index.ts` — exports `ProviderBudget` (type), `DefaultProviderBudget` (class), `ProviderBudgetResult` (type)
- `packages/ai/src/index.ts` — exports `ProviderBudget` (type), `DefaultProviderBudget` (class), `ProviderBudgetResult` (type)

### 5. No Integration with PromptSelection

ProviderBudget is NOT integrated into PromptSelection in this WO. Integration will occur in a later Work Order.

### 6. Architecture Layer Placement

ProviderBudget is placed at the same architectural layer as other configuration components:

```
Configuration Layer:
  AIConfiguration
  ProviderBudget (NEW)
  └── No dependencies on PromptBudget, PromptSelection,
       PromptCompression, Pipeline, Planner, or Provider
```

---

## Consequences

**Positive:**
- Well-defined provider capacity abstraction for future provider-aware optimization
- All existing code continues unchanged — no interface modifications
- Default implementation uses zero dependencies (static lookup table only)
- `ProviderBudgetResult` with optional `maxOutputTokens` provides gradual extension
- ProviderBudget is testable in isolation (no dependencies)
- Pure function contract (no side effects, no mutation)
- All existing tests pass with zero modifications (879+ tests)
- Completely independent from PromptBudget — two separate types serving different purposes

**Negative:**
- No integration yet — ProviderBudget must be wired into PromptSelection in future WOs
- Default values are conservative and may under-represent actual API limits

**Neutral:**
- `ProviderBudget`, `DefaultProviderBudget`, `ProviderBudgetResult` added to public API
- Architecture version bumped to v0.29

---

## Future Work (Not Implemented)

| Capability | Description |
|-----------|-------------|
| ProviderBudget → PromptSelection | PromptSelection uses ProviderBudget to set budget thresholds |
| Dynamic Budget Discovery | Fetch limits from provider API endpoints |
| ProviderBudget + AIConfiguration | Derive budget from configured provider/model |
| Custom ProviderBudget | Allow user-defined provider limits via configuration |

---

## References

- ADR-0035: Prompt Budget Foundation
- ADR-0038: Prompt Selection Foundation
- ADR-0039: Prompt Selection Consumption
- WO-S3-018: Prompt Budget Foundation
- WO-S4-004: Prompt Budget Token Estimation
- WO-S4-005: Provider Budget Foundation (this Work Order)