# ADR-0037: Prompt Assembly Integration

**Status:** Accepted  
**Date:** Sprint 3  
**Work Order:** WO-S3-020  
**Architecture Version:** v0.24

---

## Context

Three foundation components have been established in preceding Work Orders:

| WO | Component | Purpose |
|----|-----------|---------|
| WO-S3-017 | PromptCompression | Cleans/strips PromptContext before render |
| WO-S3-018 | PromptBudget | Measures section sizes (character count) |
| WO-S3-019 | MemoryRanking | Determines section priority (fixed rules) |

Each component was built as a standalone, pure-function abstraction with explicit constraints against premature integration. The PromptBuilder currently only calls Compression and Renderer — Ranking and Budget exist but are not wired into the pipeline.

This WO completes the Prompt Assembly layer by making `DefaultPromptBuilder` the **single orchestrator** of the entire Prompt Pipeline:

```
PromptModules → PromptContext → Ranking → Budget → Compression → Renderer → AIRequest
```

### Constraints

1. **Builder is the only orchestrator** — Only `DefaultPromptBuilder` coordinates the pipeline. Sub-components never call each other.
2. **Ranking, Budget, and Compression remain zero-coupled** — No component depends on another. The Builder calls them in sequence.
3. **All components remain pure functions** — No side effects, no mutation of input.
4. **No real tokenizer, LLM compression, or embedding ranking** — Only established abstractions are wired.
5. **Backward compatible** — No interface changes. New constructor params are optional with defaults.
6. **No Planner, Pipeline, Provider, Runtime, AgentLoop, or Tool modifications.**
7. **Existing tests must pass without modification.**

---

## Decision

### 1. DefaultPromptBuilder Constructor Extended

```typescript
constructor(
  modules: PromptModule[],
  renderer?: PromptRenderer,          // default: DefaultPromptRenderer
  compression?: PromptCompression,    // default: DefaultPromptCompression
  ranking?: MemoryRanking,            // default: DefaultMemoryRanking  ← NEW
  budget?: PromptBudget,              // default: DefaultPromptBudget   ← NEW
)
```

All parameters remain optional with sensible defaults. The 1-param `(modules)` and 3-param `(modules, renderer, compression)` signatures continue working identically.

### 2. Prompt Assembly Pipeline

The `build()` method now executes in five ordered phases:

```
Phase 1: Module Collection
  PromptModule[] → buildContext() → merge into PromptContext

Phase 2: MemoryRanking (pure measurement)
  ranking.rank(promptContext) → MemoryRankingResult (not modified)

Phase 3: PromptBudget (pure measurement)
  budget.calculate(promptContext) → PromptBudgetResult (not modified)

Phase 4: PromptCompression (transformer)
  compression.compress(promptContext) → new PromptContext (original unchanged)

Phase 5: PromptRenderer (serializer)
  renderer.render(compressed) → string
  → AIRequest { prompt, metadata: { promptAssembly: { ranking, budget } } }
```

### 3. Metadata Enrichment

The `AIRequest` now carries assembly metadata:

```typescript
{
  prompt: "the rendered prompt string",
  metadata: {
    promptAssembly: {
      ranking: MemoryRankingResult,   // section priorities
      budget: PromptBudgetResult,     // section sizes
    }
  }
}
```

This makes ranking and budget results available to downstream consumers (Planner, AgentLoop, Logging) without modifying any interfaces.

### 4. buildContext() Also Runs the Pipeline

The `buildContext()` method also calls all four sub-components to maintain consistency with `build()`. Ranking and Budget results are not returned (they are measurements, not the context), but Compression output flows through.

### 5. No Component Coupling

The following dependencies remain strictly **disallowed** and are NOT implemented:
- Ranking → Compression (ranking consumes PriorityResult, not Context)
- Compression → Ranking (compression does not call ranking)
- Budget → Ranking (no cross-component calls)
- Renderer → Compression (renderer only renders strings)

---

## Consequences

**Positive:**
- Builder is now the single orchestrator of all Prompt Pipeline stages
- Ranking and Budget are no longer "dead" abstractions — they participate in every `build()` call
- Assembly metadata makes ranking/budget results accessible to downstream consumers
- All existing code remains unchanged (backward compatible)
- All five sub-components remain zero-coupled
- Execution order is deterministic and testable
- Existing 3-param constructor pattern continues working unchanged

**Negative:**
- DefaultPromptBuilder constructor grows to 5 parameters (though all optional)
- Every `build()` call now runs Ranking + Budget (negligible overhead — pure character operations)

**Neutral:**
- `promptAssembly` metadata key added to `AIRequest.metadata`
- Architecture version bumped to v0.24

---

## References

- ADR-0032: Structured Prompt Context
- ADR-0033: Prompt Renderer Foundation
- ADR-0034: Context Compression Foundation
- ADR-0035: Prompt Budget Foundation
- ADR-0036: Memory Ranking Foundation
- WO-S3-017: Context Compression Foundation
- WO-S3-018: Prompt Budget Foundation
- WO-S3-019: Memory Ranking Foundation
- WO-S3-020: Prompt Assembly Integration (this Work Order)