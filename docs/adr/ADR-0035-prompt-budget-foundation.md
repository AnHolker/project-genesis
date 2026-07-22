# ADR-0035: Prompt Budget Foundation

**Status:** Accepted  
**Date:** Sprint 3  
**Work Order:** WO-S3-018  
**Architecture Version:** v0.22

---

## Context

The Prompt pipeline currently flows through `PromptModule[] → PromptContext → PromptCompression → PromptRenderer → string`. There is no mechanism to measure the size or composition of a `PromptContext` before it enters compression or rendering.

Future capabilities like Memory Ranking, Context Window management, and Token Optimization all require a standardized way to understand:
1. How large is each section of the prompt?
2. What is the total size of all sections?
3. How many tokens might this prompt consume?

A dedicated Budget abstraction addresses this gap without coupling the measurement logic to any specific consumer.

### Constraints

1. **Budget only measures — never modifies** — Input/output is `PromptContext → PromptBudgetResult`. Budget must NOT alter the context.
2. **Compression does NOT do budgeting** — The pipeline remains: `Context → Budget → Ranking → Compression → Renderer`
3. **Budget is replaceable** — A unified interface allows `CharacterBudget`, `TokenBudget`, `ProviderBudget`, `ModelSpecificBudget`
4. **No real tokenizer in default** — Default budget uses character counts only. No tiktoken, GPT tokenizer, or Claude tokenizer.
5. **One-way dependency** — `PromptContext → Budget → PromptBudgetResult`. Budget must NOT depend on Planner, Provider, Runtime, or AgentLoop.
6. **PromptBuilder does NOT use Budget** — This WO establishes the capability. Integration with Builder, Compression, or Renderer is deferred.
7. **Not Token Counter, Tokenizer, Compression, or Memory Ranking** — Those are separate future Work Orders.
8. **Backward compatible** — All existing interfaces unchanged. No modifications to any existing component.

---

## Decision

### 1. New Module: `packages/ai/src/prompt/PromptBudgetResult.ts`

Defines the budget measurement output:

```typescript
interface PromptBudgetResult {
  totalLength: number
  sectionLengths: Record<string, number>
  estimatedTokens?: number
}
```

- `totalLength` — total character count across all populated sections
- `sectionLengths` — per-section character count (section name → length)
- `estimatedTokens` — optional, left `undefined` by default; populated by future TokenBudget

### 2. New Module: `packages/ai/src/prompt/PromptBudget.ts`

Defines the budget interface:

```typescript
interface PromptBudget {
  calculate(context: PromptContext): PromptBudgetResult
}
```

- Single-method interface
- Accepts `PromptContext`, returns `PromptBudgetResult`
- Implementations MUST NOT modify the input context
- No dependencies on any other component

### 3. New Module: `packages/ai/src/prompt/DefaultPromptBudget.ts`

Default implementation:

- Iterates over all known `PromptContext` fields (`system`, `userInput`, `memory`, `worldState`, `observations`, `reflections`)
- For each populated field (not `undefined`, not `''`), records character length in `sectionLengths`
- Sums all section lengths into `totalLength`
- Leaves `estimatedTokens` undefined
- Non-mutating, deterministic, pure

### 4. Exports

- `packages/ai/src/prompt/index.ts` — exports `PromptBudget` (type), `DefaultPromptBudget` (class), `PromptBudgetResult` (type)
- `packages/ai/src/index.ts` — exports `PromptBudget` (type), `DefaultPromptBudget` (class), `PromptBudgetResult` (type)

### 5. No Integration with Builder or Compression

Budget is a standalone capability in this WO. It is NOT called by:
- `DefaultPromptBuilder`
- `DefaultPromptCompression`
- `DefaultPromptRenderer`

Integration will happen in future Work Orders.

---

## Consequences

**Positive:**
- Well-defined budget abstraction for future components
- All existing code continues unchanged — no interface modifications
- Default implementation uses zero dependencies (character counts only)
- `estimatedTokens` field provides extension point for future TokenBudget
- Budget is testable in isolation (no dependencies)
- Pure function contract (no side effects, no mutation)
- All existing tests pass with zero modifications (672+ tests)

**Negative:**
- No integration yet — Budget must be manually wired in future WOs

**Neutral:**
- `PromptBudget`, `DefaultPromptBudget`, `PromptBudgetResult` added to public API
- Architecture version bumped to v0.22

---

## Future Work (Not Implemented)

| Capability | Description |
|-----------|-------------|
| TokenBudget | Count tokens using a real tokenizer (tiktoken, etc.) |
| ProviderBudget | Provider-specific token counting (OpenAI vs Claude) |
| ModelSpecificBudget | Model-aware budget (GPT-4 context window vs Claude) |
| Budget → Compression | Compression consumes Budget to make truncation decisions |
| Budget → Memory Ranking | Memory Ranking consumes Budget to select top-K memories |
| Budget → PromptBuilder | Builder warns when budget exceeds limits |

---

## References

- ADR-0032: Structured Prompt Context
- ADR-0033: Prompt Renderer Foundation
- ADR-0034: Context Compression Foundation
- WO-S3-015: Structured Prompt Context Foundation
- WO-S3-016: Prompt Renderer Foundation
- WO-S3-017: Context Compression Foundation
- WO-S3-018: Prompt Budget Foundation (this Work Order)