# ADR-0050: Intent Consumption

**Status:** Accepted  
**Date:** Sprint 5  
**Work Order:** WO-S5-003  
**Architecture Version:** v0.38

---

## Context

WO-S5-001 (ADR-0048) established the Intent Analysis Foundation with `IntentAnalyzer` interface and `DefaultIntentAnalyzer` placeholder. WO-S5-002 (ADR-0049) introduced `RuleBasedIntentAnalyzer` as the first production implementation.

However, the IntentAnalyzer was never wired into the Prompt Assembly pipeline. It existed as a standalone capability that had to be manually invoked — no component in the system consumed it automatically.

After Sprint 4 (v0.35 Frozen), the pipeline flows:

```
PromptModule → PromptContext → MemoryRanking → PromptBudget → ProviderBudget → PromptSelection → PromptCompression → PromptRenderer → AIRequest
```

The IntentAnalyzer sits outside this flow, producing intent results that no component can access.

### Problem

1. **Unconsumed capability** — IntentAnalyzer exists but is not part of any automated pipeline
2. **Missing metadata** — Downstream systems cannot access analyzed intents
3. **No integration point** — Future intent-aware features (IntentRouting, Intent → PromptAssembly, intent-aware planning) have no foundation

### Constraints

1. **No architecture modifications** — IntentAnalyzer remains a pure analyzer. No changes to PromptRenderer, PromptCompression, PromptSelection, PromptBudget, ProviderBudget, MemoryRanking, Runtime, Planner, or Provider.
2. **Builder remains sole orchestrator** — PromptBuilder is the only component that orchestrates the pipeline.
3. **Backward compatible** — No positional constructor parameters added to DefaultPromptBuilder. All existing constructors unchanged.
4. **Additive only** — Only BuilderOptions grows (new optional `intentAnalyzer` field). No interface changes.
5. **No PromptContext modification** — IntentResult is not injected into PromptContext. Only stored in metadata.
6. **No PromptRenderer changes** — Intent is not rendered into the prompt string yet (future WO).

---

## Decision

### 1. BuilderOptions Extension

Add an optional `intentAnalyzer` field to `BuilderOptions`:

```typescript
interface BuilderOptions {
  renderer?: PromptRenderer
  compression?: PromptCompression
  ranking?: MemoryRanking
  budget?: PromptBudget
  selection?: PromptSelection
  providerBudget?: ProviderBudget
  configuration?: AIConfiguration
  /** Optional IntentAnalyzer (defaults to undefined — no intent analysis) */
  intentAnalyzer?: IntentAnalyzer      // ← NEW (WO-S5-003)
}
```

Design decisions:
- **Optional** — When undefined, no IntentAnalyzer is invoked. Full backward compatibility.
- **Additive** — Only the BuilderOptions form gains the new field. Legacy positional form unchanged.
- **No new constructor parameters** — Positional constructor signatures remain frozen. Only BuilderOptions is extended.

### 2. Pipeline Execution Order

With IntentAnalyzer, the Builder execution order becomes:

```
Prompt Modules
    ↓
[IntentAnalyzer.analyze()]        ← NEW: executed after PromptContext assembly
    ↓
MemoryRanking
    ↓
PromptBudget
    ↓
ProviderBudget
    ↓
PromptSelection
    ↓
PromptCompression
    ↓
PromptRenderer
    ↓
AIRequest { prompt, metadata.promptAssembly.intent }
```

Intent analysis occurs:
- **After** PromptModule execution (needs user input from PipelineContext)
- **Before** MemoryRanking (pure measurement — no dependency on intent)
- **Once per build() call** (not per module, not per rendering)

### 3. Metadata Storage

IntentResult is stored in `AIRequest.metadata.promptAssembly.intent`:

```typescript
// When IntentAnalyzer is provided:
{
  promptAssembly: {
    intent: { intents: [{ type: 'Create' }] },  // ← NEW
    ranking: MemoryRankingResult,
    budget: PromptBudgetResult,
    selection: PromptSelectionResult,
    providerBudget?: ProviderBudgetResult,
  }
}

// When IntentAnalyzer is NOT provided:
{
  promptAssembly: {
    // No "intent" field present
    ranking: MemoryRankingResult,
    budget: PromptBudgetResult,
    selection: PromptSelectionResult,
    providerBudget?: ProviderBudgetResult,
  }
}
```

Design decisions:
- **Conditional** — The `intent` field only appears when IntentAnalyzer is injected
- **Non-breaking** — Existing consumers that read `promptAssembly` continue working unchanged
- **Extensible** — Future fields can be added alongside `intent` without breaking changes

### 4. No PromptContext Modification

IntentResult is NOT injected into PromptContext for these reasons:

1. No rendering changes required — existing renderers continue working unchanged
2. No compression changes required — existing compressors don't need to handle intent
3. No selection changes required — existing selectors don't need to consider intent
4. Future WO (Intent → PromptAssembly) can add it to PromptContext when rendering requires it

### 5. DefaultIntentAnalyzer in Pipeline

When `DefaultIntentAnalyzer` (the placeholder) is injected:
- Returns `{ intents: [] }` for every input
- Metadata includes `promptAssembly.intent: { intents: [] }`
- Prompt output is identical to not having an IntentAnalyzer
- Downstream systems can check `intent.intents.length === 0` for "no intent detected"

This enables downstream systems to always read `promptAssembly.intent` without null-checking the analyzer's existence (when DefaultIntentAnalyzer is configured).

---

## Consequences

**Positive:**
- IntentAnalyzer becomes part of the Prompt Assembly pipeline
- Builder remains the sole orchestrator
- All existing interfaces unchanged — no breaking changes
- No modifications to PromptRenderer, PromptCompression, PromptSelection, PromptBudget, ProviderBudget, MemoryRanking, Runtime, Planner, or Provider
- Metadata contains analyzed intents for downstream consumption
- Backward compatible: Builder without IntentAnalyzer behaves identically
- No new positional constructor parameters
- Deterministic, stateless, immutable pipeline behavior preserved
- 46 new comprehensive tests covering all scenarios

**Negative:**
- Intent is not yet rendered into the prompt string (deferred to future WO)
- Intent is not yet available in PromptContext (deferred to future WO)
- PipelineContext does not carry IntentResult (AIRequest metadata not propagated back)

**Neutral:**
- Architecture version bumped to v0.38
- `BuilderOptions.intentAnalyzer` added to public API
- Intent consumption occurs once per build, not configurable

---

## Future Work (Not Implemented)

| Capability | Description |
|-----------|-------------|
| Intent → PromptAssembly | Inject Intent into PromptContext for Planner awareness |
| Intent → PromptContext | Make IntentResult available via PromptContext |
| Intent Routing | Route intents to different planners or executors |
| Intent-Aware Planning | Planner consumes IntentResult for action prioritization |
| PipelineContext Intent | Propagate IntentResult from AIRequest to PipelineContext |

---

## References

- ADR-0048: Intent Analysis Foundation (WO-S5-001)
- ADR-0049: Rule-Based Intent Analyzer (WO-S5-002)
- ADR-0037: Prompt Assembly Integration
- ADR-0046: Builder Options Foundation
- WO-S5-003: Intent Consumption (this Work Order)
- `docs/project/AI_ARCHITECTURE.md` — Architecture reference
- `docs/project/PROJECT_STATE.md` — Current project state
- `docs/project/CHANGELOG.md` — Work order changelog