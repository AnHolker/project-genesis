# ADR-0044: AI Configuration Foundation

**Status:** Accepted  
**Date:** Sprint 4  
**Work Order:** WO-S4-007  
**Architecture Version:** v0.31

---

## Context

The AI subsystem configuration is currently spread across multiple places: `AIConfiguration` interface, `DefaultAIConfiguration` class, `createAIConfiguration` factory function, environment variables, and individual component constructor parameters.

As Sprint 4 progresses, constructor parameters are growing across multiple components. Rather than continuing to add parameters independently, a unified configuration object is needed to serve as the single source of truth for all AI runtime settings.

### Existing Configuration

The existing `AIConfiguration` interface from Sprint 2 contained:

- `provider: string` — provider identifier
- `model: string` — model identifier
- `temperature: number` — response randomness
- `maxTokens: number` — maximum output tokens
- `apiKey?: string` — API key
- `baseURL?: string` — custom API endpoint
- `allowBrowser?: boolean` — browser mode flag

### New Configuration Needs

Sprint 4 has introduced new concerns that need configuration:

- `maxOutputTokens` — clearer name for output token limit
- `streaming` — enable/disable streaming response mode
- `toolCalling` — enable/disable native tool calling

### Constraints

1. **No behavior changes** — This WO establishes the model only. No runtime behavior changes.
2. **No constructor changes** — No existing component constructors are modified.
3. **No pipeline changes** — Pipeline orchestration is unchanged.
4. **No Planner changes** — Planner interface and implementations unchanged.
5. **No Provider changes** — Provider interface and implementations unchanged.
6. **No PromptBuilder changes** — Builder contract unchanged.
7. **Backward compatible** — All existing interfaces unchanged. New fields are optional.
8. **Foundation only** — Consumption by other components deferred to future WOs.

---

## Decision

### 1. AIConfiguration Interface Evolved

The existing `AIConfiguration` interface is evolved with new fields while preserving all existing fields for backward compatibility:

```typescript
interface AIConfiguration {
  provider: string
  model: string
  temperature: number
  maxTokens: number          // @deprecated — use maxOutputTokens
  maxOutputTokens?: number   // NEW
  streaming?: boolean        // NEW
  toolCalling?: boolean      // NEW
  apiKey?: string
  baseURL?: string
  allowBrowser?: boolean
}
```

**Key design decisions:**
- `provider`, `model`, `temperature`, `maxTokens` remain required for backward compatibility
- `maxTokens` is marked `@deprecated` in favor of `maxOutputTokens`
- `streaming` and `toolCalling` are optional booleans (default: `undefined`, meaning "not configured")
- No speculative fields — every field has a clear future consumer

### 2. DefaultAIConfiguration Enhanced

```typescript
class DefaultAIConfiguration implements AIConfiguration {
  readonly provider = 'mock'
  readonly model = 'mock'
  readonly temperature = 0
  readonly maxTokens = 0
  readonly streaming = false
  readonly toolCalling = false
  readonly maxOutputTokens = undefined
  readonly apiKey = undefined
  readonly baseURL = undefined
  readonly allowBrowser = undefined
}
```

**Properties:**
- Immutable (all `readonly`)
- Deterministic (identical values on every instantiation)
- Pure (no I/O, no SDK calls, no environment variable access)
- No side effects

### 3. createAIConfiguration Enhanced

New environment variable support:

| Variable | Field | Default |
|----------|-------|---------|
| VITE_AI_STREAMING | `streaming` | `undefined` |
| VITE_AI_TOOL_CALLING | `toolCalling` | `undefined` |

When set to `"true"`, the corresponding field is set to `true`. When set to `"false"` or not set, the field is `undefined` (not `false`), allowing downstream components to use their own defaults.

### 4. No Component Modifications

No existing component is modified. The evolved `AIConfiguration` interface is a superset of the previous interface — all existing consumers continue to compile and work without changes.

---

## Consequences

**Positive:**
- Unified configuration model for all future AI settings
- `maxOutputTokens` provides a clearer name than `maxTokens`
- `streaming` and `toolCalling` flags enable future pipeline integration
- Complete backward compatibility — all existing code compiles unchanged
- Immutable, deterministic, pure default implementation
- No dependency on any existing component

**Negative:**
- `maxTokens` and `maxOutputTokens` coexist as parallel fields (minor duplication)
- Not yet consumed by any component — future WOs must wire the new fields

**Neutral:**
- Architecture version bumped to v0.31
- 1029 total tests (970 existing + 44 new + 15 web)

---

## Future Work (Not Implemented)

| Capability | Description |
|-----------|-------------|
| AIConfiguration → PromptBuilder | Derive provider name, model name, charsPerToken from config |
| AIConfiguration → ProviderBudget | Derive provider/model for capacity lookup |
| AIConfiguration → Pipeline | streaming flag controls Pipeline.stream() |
| AIConfiguration → RetryPlanner | Retry policy from configuration |
| AIConfiguration → ToolCallPlanner | Tool calling flag from configuration |

---

## References

- ADR-0013: AI Configuration (original)
- ADR-0042: Provider Budget Foundation
- ADR-0043: Provider Budget Consumption
- WO-S4-007: AI Configuration Foundation (this Work Order)