# ADR-0051: Intent Rendering Foundation

**Status:** Accepted  
**Date:** Sprint 5  
**Work Order:** WO-S5-004  
**Architecture Version:** v0.39

---

## Context

WO-S5-003 (ADR-0050) integrated `IntentAnalyzer` into the Prompt Assembly pipeline. The analyzed intents are stored as structured `IntentResult` in `AIRequest.metadata.promptAssembly.intent`. However, there is no string representation of user intents — they exist only as raw data objects.

Downstream systems (Planner, AgentLoop, prompt rendering) cannot see a formatted intent section. Example of what is missing:

```
User Intent:
- Create
- Move
```

Before this WO, the Prompt Assembly pipeline flows:

```
Prompt Modules → PromptContext → IntentAnalyzer → MemoryRanking → PromptBudget → ProviderBudget → PromptSelection → PromptCompression → PromptRenderer → AIRequest
```

The `IntentResult` from `IntentAnalyzer` is stored in metadata, but never rendered into a human-readable string that could be injected into prompts.

### Problem

1. **No intent string representation** — IntentResult exists as data only, not as formatted text
2. **No abstraction for intent formatting** — No interface exists for converting IntentResult to string
3. **Missing pipeline slot** — No rendering step exists between IntentAnalyzer and MemoryRanking
4. **No metadata record of rendered intent** — Future prompt injection has no foundation

### Constraints

1. **No modifications to existing interfaces** — IntentAnalyzer, IntentResult, Intent, IntentType unchanged
2. **No PromptRenderer modifications** — PromptRenderer remains unchanged
3. **No PromptContext changes** — IntentRendered is NOT injected into PromptContext
4. **No final prompt injection** — IntentRendered is stored in metadata only, not rendered into the final prompt string
5. **Additive only** — BuilderOptions gains new field; no positional constructor parameters
6. **Pure, stateless, deterministic** — IntentRenderer must follow the same rules as all pipeline components

---

## Decision

### 1. New Interface: `IntentRenderer`

```typescript
interface IntentRenderer {
  render(intent: IntentResult): string
}
```

- Single-method interface: accepts `IntentResult`, returns formatted string
- Pure function: same input → same output
- Stateless: no internal state between calls
- Deterministic: no randomness or external factors
- Side-effect free: no I/O, no mutation of inputs

### 2. Default Implementation: `DefaultIntentRenderer`

```typescript
class DefaultIntentRenderer implements IntentRenderer {
  render(intent: IntentResult): string {
    if (intent.intents.length === 0) return ''
    const lines = intent.intents.map((i) => `- ${i.type}`)
    return `User Intent:\n${lines.join('\n')}`
  }
}
```

**Rendering behavior:**

| Input | Output |
|-------|--------|
| `{ intents: [] }` | `""` (empty string) |
| `{ intents: [{ type: 'Create' }] }` | `"User Intent:\n- Create"` |
| `{ intents: [{ type: 'Create' }, { type: 'Move' }] }` | `"User Intent:\n- Create\n- Move"` |

**Properties:**
- Pure function — no side effects
- Stateless — no internal state
- Deterministic — same input always produces same output
- Immutable — never modifies input
- Idempotent — calling twice produces the same result
- No PromptContext dependency — consumes only IntentResult

### 3. Pipeline Integration

The pipeline execution order becomes:

```
Prompt Modules
    ↓
PromptContext
    ↓
IntentAnalyzer.analyze()
    ↓
IntentRenderer.render()           ← NEW (WO-S5-004)
    ↓
MemoryRanking.rank()
    ↓
PromptBudget.calculate()
    ↓
ProviderBudget.getBudget()
    ↓
PromptSelection.select()
    ↓
PromptCompression.compress()
    ↓
PromptRenderer.render()
    ↓
AIRequest { prompt, metadata.promptAssembly }
```

Intent rendering:
- Occurs immediately after IntentAnalyzer
- Uses IntentRenderer.render() with the IntentResult from IntentAnalyzer
- Result stored as `intentRendered` in `promptAssembly` metadata

### 4. Metadata Storage

```typescript
// When both IntentAnalyzer and IntentRenderer are provided:
{
  promptAssembly: {
    intent: { intents: [{ type: 'Create' }] },
    intentRendered: "User Intent:\n- Create",     // ← NEW
    ranking: MemoryRankingResult,
    budget: PromptBudgetResult,
    selection: PromptSelectionResult,
    providerBudget?: ProviderBudgetResult,
  }
}

// When IntentRenderer is not provided:
{
  promptAssembly: {
    intent: { intents: [{ type: 'Create' }] },
    // No "intentRendered" field
    ranking: MemoryRankingResult,
    budget: PromptBudgetResult,
    selection: PromptSelectionResult,
  }
}
```

**Rules:**
- `intentRendered` only present when both IntentAnalyzer and IntentRenderer are injected
- `intentRendered` is NOT injected into the final prompt string (deferred to future WO)
- `intentRendered` is NOT injected into PromptContext (deferred to future WO)

### 5. BuilderOptions Extension

```typescript
interface BuilderOptions {
  // ... existing fields ...
  intentAnalyzer?: IntentAnalyzer
  intentRenderer?: IntentRenderer     // ← NEW (WO-S5-004)
}
```

- Optional: when `undefined`, no intent rendering occurs
- Only available via BuilderOptions form — no new positional parameter
- Works independently: IntentRenderer without IntentAnalyzer produces no intentRendered

---

## Consequences

**Positive:**
- First string representation of intents in the system
- Clean abstraction: IntentRenderer interface with single responsibility
- Default implementation covers empty, single, and multi-intent cases
- Backward compatible: no changes to existing interfaces
- No prompt contamination: intentRendered stays in metadata only
- Pure, stateless, deterministic — consistent with all pipeline components
- 57 new comprehensive tests covering all scenarios

**Negative:**
- IntentRendered not yet injected into final prompt (deferred)
- IntentRendered not yet available in PromptContext (deferred)

**Neutral:**
- Architecture version bumped to v0.39
- `IntentRenderer`, `DefaultIntentRenderer` added to public API
- `BuilderOptions.intentRenderer` added

---

## Future Work (Not Implemented)

| Capability | Description |
|-----------|-------------|
| Intent → Prompt Output | Inject intentRendered into the final rendered prompt |
| Intent → PromptContext | Make IntentRendered available via PromptContext |
| Custom IntentRenderer | Alternative rendering formats (XML, JSON, single-line) |
| Intent Priority Rendering | Render intents sorted by confidence/priority |

---

## References

- ADR-0048: Intent Analysis Foundation (WO-S5-001)
- ADR-0049: Rule-Based Intent Analyzer (WO-S5-002)
- ADR-0050: Intent Consumption (WO-S5-003)
- WO-S5-004: Intent Rendering Foundation (this Work Order)
- `docs/project/AI_ARCHITECTURE.md` — Architecture reference
- `docs/project/PROJECT_STATE.md` — Current project state
- `docs/project/CHANGELOG.md` — Work order changelog