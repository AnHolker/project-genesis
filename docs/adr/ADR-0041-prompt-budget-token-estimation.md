# ADR-0041: Prompt Budget Token Estimation (Rule-Based)

**Status:** Accepted  
**Date:** Sprint 4  
**Work Order:** WO-S4-004  
**Architecture Version:** v0.28

---

## Context

WO-S3-018 (Prompt Budget Foundation) established the `PromptBudget` interface and `DefaultPromptBudget` implementation with character-count-only measurement. The `estimatedTokens` field on `PromptBudgetResult` existed but was left `undefined` by the default implementation.

Sprint 4 now provides a lightweight, rule-based token estimation for the default implementation — without introducing any tokenizer library, provider SDK, or model-specific estimation.

### Constraints

1. **Budget is still a measurement component** — It calculates, it does not modify.
2. **No tokenizer** — No tiktoken, no GPT tokenizer, no Claude tokenizer, no Gemini tokenizer, no DeepSeek tokenizer.
3. **No provider-specific estimation** — The estimation is provider-agnostic.
4. **No model-specific logic** — Same ratio applies regardless of model.
5. **Replaceable** — Future TokenBudget implementations can override via the same `PromptBudget` interface.
6. **Backward compatible** — All existing interfaces unchanged. New constructor parameter is optional.
7. **Deterministic and pure** — Same input always produces same output.

---

## Decision

### 1. DefaultPromptBudget: Token Estimation

`DefaultPromptBudget` gains a configurable `charsPerToken` constructor parameter:

```typescript
class DefaultPromptBudget implements PromptBudget {
  constructor(charsPerToken?: number)  // default: 4
}
```

**Estimation formula:**

```
estimatedTokens = Math.ceil(totalLength / charsPerToken)
```

- When `totalLength === 0` (empty context), `estimatedTokens` is `undefined`
- When `totalLength > 0`, `estimatedTokens` is always a positive integer

**Default value (4):** Approximately 4 characters per token is a common rule-of-thumb estimate for English text. This value is configurable because:
- Different languages have different char-to-token ratios
- Different tokenizers have different efficiency
- Users may want more conservative (higher ratio) or more aggressive (lower ratio) estimates

### 2. No Interface Changes

The `PromptBudget` interface and `PromptBudgetResult` interface are unchanged. The `estimatedTokens` field was already defined as `optional number`. This WO simply provides the default implementation for that field.

### 3. Pure Measurement Preserved

`DefaultPromptBudget` remains:
- **Pure** — No side effects, no I/O
- **Deterministic** — Same input always produces same output
- **Non-mutating** — Input `PromptContext` is never modified
- **Provider-agnostic** — No import of any provider SDK or tokenizer

---

## Consequences

**Positive:**
- `estimatedTokens` is now populated by default with a reasonable rule-based estimate
- Configurable ratio allows users to tune for their specific use case
- No external dependencies (no tokenizer library)
- Backward compatible — existing code continues working unchanged
- Provider-agnostic — works identically with Mock, OpenAI, DeepSeek
- Future TokenBudget implementations can override via same interface

**Negative:**
- DefaultPromptBudget constructor signature changed (new optional parameter)
- Estimation is approximate (±20-30% vs real tokenizers for English text)

**Neutral:**
- Architecture version bumped to v0.28
- 879 total tests (857 existing + 22 new)

---

## References

- ADR-0035: Prompt Budget Foundation
- ADR-0037: Prompt Assembly Integration
- WO-S3-018: Prompt Budget Foundation
- WO-S4-004: Prompt Budget Token Estimation (this Work Order)