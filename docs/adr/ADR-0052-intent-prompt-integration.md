# ADR-0052: Intent Prompt Integration

**Status:** Accepted  
**Date:** Sprint 5  
**Work Order:** WO-S5-005  
**Architecture Version:** v0.40

---

## Context

WO-S5-004 (ADR-0051) introduced `IntentRenderer` which converts `IntentResult` into a formatted string. The rendered intent was stored in `AIRequest.metadata.promptAssembly.intentRendered` but never injected into the final prompt string.

Before this WO, the pipeline:

```
IntentAnalyzer → IntentRenderer → intentRendered → metadata only (not in prompt)
```

The `PromptRenderer.render()` method produced the final prompt string without any intent section. The rendered intent existed only in metadata, invisible to the Planner and downstream systems.

### Problem

1. **Intent is invisible in the prompt** — The Planner receives the prompt without any intent information
2. **Metadata-only storage is insufficient** — Downstream systems that read the prompt string cannot see the user's intent
3. **No rendering foundation** — Future features like intent-aware planning require intent in the prompt

### Constraints

1. **No PromptRenderer interface changes** — `render(context: PromptContext): string` remains unchanged
2. **No PromptContext removal** — Existing fields are preserved; `intentRendered` is added as an optional field
3. **No PromptContext modifications** — Only additive: `intentRendered?: string` is added to PromptContext
4. **Backward compatible** — All existing tests pass unchanged
5. **Empty intent → no section** — Empty `intentRendered` produces no visible output
6. **Blank line separation** — Exactly one blank line between sections

---

## Decision

### 1. PromptContext Extension

Add `intentRendered?: string` to the `PromptContext` interface:

```typescript
interface PromptContext {
  system?: string
  intentRendered?: string     // ← NEW (WO-S5-005)
  userInput?: string
  memory?: string
  worldState?: string
  observations?: string
  reflections?: string
}
```

- Additive change — no existing fields removed or modified
- Optional — `undefined` and `''` values are filtered out during rendering
- Only populated when both `IntentAnalyzer` and `IntentRenderer` are configured

### 2. DefaultPromptBuilder Injection

The builder injects `intentRendered` into the PromptContext before rendering:

```typescript
// Build render context with intentRendered first (ensures correct insertion order)
const renderContext: PromptContext = {}
if (intentRendered !== undefined && intentRendered.length > 0) {
  renderContext.intentRendered = intentRendered
}
Object.assign(renderContext, compressed)
const rendered = this.renderer.render(renderContext)
```

- `intentRendered` is set first in the new context to ensure insertion order
- Only set when non-empty — empty results in no key at all
- The compressed context from compression is merged afterward

### 3. DefaultPromptRenderer Changes

**Section join changed from `\n` to `\n\n`:**

```typescript
return promptKeys
  .map((key) => context[key] ?? '')
  .join('\n\n')
```

This creates exactly one blank line between each section:

```
User Intent:
- Create

System instructions

User Input:
Draw a tree
```

**Empty section filtering:**

```typescript
const promptKeys = keys.filter(
  (key) =>
    CANONICAL_ORDER.includes(key) &&
    context[key] !== undefined &&
    context[key] !== '',
)
```

- Undefined and empty string fields are excluded from output
- No blank lines, no placeholders, no empty sections

### 4. CANONICAL_ORDER Update

`intentRendered` is added to the canonical order as the first field:

```typescript
static readonly CANONICAL_ORDER: Array<keyof PromptContext> = [
  'intentRendered',    // ← NEW — first in order
  'system',
  'userInput',
  'memory',
  'reflections',
  'worldState',
  'observations',
]
```

### 5. DefaultPromptCompression Update

`isPromptContextKey()` now recognizes `intentRendered`:

```typescript
private isPromptContextKey(key: string): key is keyof PromptContext {
  const validKeys = [
    'system',
    'intentRendered',    // ← NEW
    'userInput',
    'memory',
    'worldState',
    'observations',
    'reflections',
  ]
  return validKeys.includes(key as keyof PromptContext)
}
```

### 6. Rendering Behavior

| Input | Output |
|-------|--------|
| `{ intentRendered: '', userInput: 'draw' }` | `"draw"` (empty intent filtered out) |
| `{ intentRendered: 'User Intent:\n- Create', userInput: 'draw' }` | `"User Intent:\n- Create\n\ndraw"` |
| `{ intentRendered: undefined, system: 'sys', userInput: 'input' }` | `"sys\n\ninput"` (intent absent) |

---

## Consequences

**Positive:**
- Intent officially becomes part of the generated prompt
- Planner receives intent information in the prompt string
- PromptRenderer interface unchanged — backward compatible
- Empty intent produces no visible output
- Exactly one blank line between sections for clean formatting
- All existing tests pass unchanged

**Negative:**
- Section join changes from `\n` to `\n\n` — all sections now have blank lines between them
- Snapshot tests required updating (expected behavior change)

**Neutral:**
- Architecture version bumped to v0.40
- `PromptContext.intentRendered` added
- `DefaultPromptCompression.isPromptContextKey()` recognizes `intentRendered`

---

## Future Work (Not Implemented)

| Capability | Description |
|-----------|-------------|
| Custom Intent Section Format | Different rendering styles for intent section |
| Intent-Aware Planning | Planner uses intent section for action prioritization |
| Entity/Scene Sections | Additional prompt sections after intent |

---

## References

- ADR-0048: Intent Analysis Foundation (WO-S5-001)
- ADR-0049: Rule-Based Intent Analyzer (WO-S5-002)
- ADR-0050: Intent Consumption (WO-S5-003)
- ADR-0051: Intent Rendering Foundation (WO-S5-004)
- WO-S5-005: Intent Prompt Integration (this Work Order)
- `docs/project/AI_ARCHITECTURE.md` — Architecture reference
- `docs/project/PROJECT_STATE.md` — Current project state
- `docs/project/CHANGELOG.md` — Work order changelog