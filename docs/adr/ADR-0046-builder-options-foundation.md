# ADR-0046: BuilderOptions Foundation

**Status:** Accepted  
**Date:** Sprint 4  
**Work Order:** WO-S4-009  
**Architecture Version:** v0.33

---

## Context

The `DefaultPromptBuilder` constructor has grown to 8 parameters across Sprint 4:

```
constructor(
  modules: PromptModule[],
  renderer?: PromptRenderer,          // WO-S3-016
  compression?: PromptCompression,    // WO-S3-017
  ranking?: MemoryRanking,            // WO-S3-020
  budget?: PromptBudget,              // WO-S3-020
  selection?: PromptSelection,        // WO-S4-001
  providerBudget?: ProviderBudget,    // WO-S4-006
  configuration?: AIConfiguration,    // WO-S4-008
)
```

Future Sprint 4 work will continue adding optional collaborators:
- Tool-based prompt modules
- Advanced ranking strategies
- Token compression implementations
- Custom rendering strategies

Continuing to add constructor parameters is unsustainable. Each new parameter:
- Changes the positional parameter index for existing callers
- Makes the constructor harder to read and maintain
- Creates merge conflicts when multiple WOs add parameters simultaneously
- Increases cognitive load for consumers

### Prior Art

ADR-0045 explicitly listed `BuilderOptions` in its "Future Work" section:

> | Capability | Description |
> |-----------|-------------|
> | BuilderOptions | Consolidate all optional params into a single options object |

### Constraints

1. **No runtime changes** — This WO establishes the abstraction only. Do NOT consume BuilderOptions yet.
2. **No constructor changes** — `DefaultPromptBuilder` constructor remains unchanged.
3. **No PromptBuilder interface changes** — `PromptBuilder` interface is unchanged.
4. **Backward compatible** — All existing interfaces unchanged. All fields are optional.
5. **Foundation only** — Consumption by DefaultPromptBuilder deferred to future WOs.
6. **Exact mapping** — Each BuilderOptions field maps 1:1 to an existing constructor parameter.

---

## Decision

### 1. BuilderOptions Interface

Create a new `BuilderOptions` interface in `packages/ai/src/prompt/BuilderOptions.ts`:

```typescript
interface BuilderOptions {
  renderer?: PromptRenderer
  compression?: PromptCompression
  ranking?: MemoryRanking
  budget?: PromptBudget
  selection?: PromptSelection
  providerBudget?: ProviderBudget
  configuration?: AIConfiguration
}
```

**Design decisions:**
- All fields are optional — the `?` modifier ensures zero breakage
- Each field maps exactly to an existing `DefaultPromptBuilder` constructor parameter
- No new fields beyond what the constructor already accepts
- No methods, no behavior — pure data interface
- Import types reference existing interfaces (no duplication of type definitions)

### 2. Public Export

`BuilderOptions` is exported from:
- `packages/ai/src/prompt/index.ts` — `export type { BuilderOptions }`
- `packages/ai/src/index.ts` — `export type { BuilderOptions }` (package root)

### 3. No Consumption

`DefaultPromptBuilder` constructor is NOT modified to accept `BuilderOptions`.

This WO establishes the abstraction only. Future Work Orders will:
1. Add a `BuilderOptions`-based constructor overload
2. Migrate existing constructor callers
3. Deprecate the positional parameter constructor

### 4. No Runtime Behavior Changes

- Zero lines of runtime logic added
- Zero existing components modified
- Zero existing constructor signatures changed
- Type-only addition — erased at compile time

---

## Consequences

**Positive:**
- Provides a clean, extensible foundation for future constructor consolidation
- Every BuilderOptions field maps 1:1 to an existing parameter — no speculation
- All fields optional — zero breaking changes
- Reduces merge conflict surface for future WOs adding new collaborators
- Type-only addition — no runtime cost, no bundle size impact
- Improves discoverability — consumers see all optional config in one place
- Follows the "prefer options objects over positional params" pattern used by the TypeScript ecosystem

**Negative:**
- Not yet consumed — adds an exported type without consumption (temporary trace)
- Consumers might see both the constructor params and BuilderOptions during migration

- **Neutral:**
- Architecture version bumped to v0.33
- +39 new tests
- Total test count: 1087 (1072 AI + 15 web)
- No existing test modifications required

---

## Future Work (Not Implemented)

| Capability | Description |
|-----------|-------------|
| BuilderOptions → Constructor | Add BuilderOptions-based constructor overload to DefaultPromptBuilder |
| Deprecate positional params | Mark positional constructor params as `@deprecated` |
| Migrate all callers | Update internal and external callers to use BuilderOptions |
| Options validation | Add runtime validation for BuilderOptions combinations |

---

## References

- ADR-0043: Provider Budget Consumption
- ADR-0044: AI Configuration Foundation
- ADR-0045: AI Configuration Consumption
- WO-S4-009: BuilderOptions Foundation (this Work Order)