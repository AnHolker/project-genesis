# ADR-0046: BuilderOptions Foundation

**Status:** Superseded  
**Date:** Sprint 4  
**Work Order:** WO-S4-009 → WO-S4-010  
**Architecture Version:** v0.33 → v0.34

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

## Decision (WO-S4-009 — Foundation)

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

### 3. No Consumption (WO-S4-009)

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

## Decision (WO-S4-010 — Consumption)

### 1. DefaultPromptBuilder Constructor Consumes BuilderOptions

WO-S4-010 implements the consumption planned in WO-S4-009. The `DefaultPromptBuilder` constructor now accepts `BuilderOptions` as its second parameter:

```typescript
// Primary form (WO-S4-010, recommended):
constructor(modules: PromptModule[], options?: BuilderOptions)

// Legacy positional form (backward compatible):
constructor(
  modules: PromptModule[],
  renderer?: PromptRenderer,
  compression?: PromptCompression,
  ranking?: MemoryRanking,
  budget?: PromptBudget,
  selection?: PromptSelection,
  providerBudget?: ProviderBudget,
  configuration?: AIConfiguration,
)
```

**Implementation details:**
- Both forms are implemented via TypeScript constructor overloads
- The implementation signature detects whether the second argument is a `BuilderOptions` object or a `PromptRenderer` using `'render' in arg` as the discriminator
- `BuilderOptions` objects lack `render` as a direct property; `PromptRenderer` instances have it

**Internally:**
```typescript
constructor(
  modules: PromptModule[],
  rendererOrOptions?: PromptRenderer | BuilderOptions,
  compression?: PromptCompression,
  ...
) {
  this.modules = modules
  if (rendererOrOptions !== undefined && !('render' in rendererOrOptions)) {
    // BuilderOptions form
    const opts = rendererOrOptions as BuilderOptions
    this.renderer = opts.renderer ?? new DefaultPromptRenderer()
    this.compression = opts.compression ?? new DefaultPromptCompression()
    // ...etc
  } else {
    // Legacy positional form
    this.renderer = (rendererOrOptions as PromptRenderer | undefined) ?? new DefaultPromptRenderer()
    this.compression = compression ?? new DefaultPromptCompression()
    // ...etc
  }
}
```

### 2. Builder Options Form (Recommended)

```typescript
// Full options
new DefaultPromptBuilder(modules, {
  renderer: myRenderer,
  compression: myCompression,
  ranking: myRanking,
  budget: myBudget,
  selection: mySelection,
  providerBudget: myProviderBudget,
  configuration: myConfig,
})

// Partial options
new DefaultPromptBuilder(modules, {
  renderer: myRenderer,
  configuration: myConfig,
})

// Minimal (same as 1-param legacy form)
new DefaultPromptBuilder(modules, {})
```

### 3. Legacy Form Preserved

All legacy constructor forms continue to work unchanged. No callers need to migrate.

The legacy form is fully type-safe via overloads:

| Form | Status |
|------|--------|
| `(modules)` | ✅ Unchanged |
| `(modules, renderer)` | ✅ Preserved |
| `(modules, renderer, compression)` | ✅ Preserved |
| `(modules, renderer, compression, ranking)` | ✅ Preserved |
| `(modules, renderer, compression, ranking, budget)` | ✅ Preserved |
| `(modules, renderer, compression, ranking, budget, selection)` | ✅ Preserved |
| `(modules, renderer, compression, ranking, budget, selection, providerBudget)` | ✅ Preserved |
| `(modules, renderer, compression, ranking, budget, selection, providerBudget, configuration)` | ✅ Preserved |
| `(modules, { ... })` | ✅ **New** |

### 4. No Runtime Behavior Changes

- Pipeline execution order unchanged: collect → rank → budget → providerBudget → select → compress → render
- PromptAssembly metadata unchanged
- PromptBuilder interface unchanged
- Builder remains the sole orchestrator
- All existing tests pass without modification

---

## Consequences (WO-S4-010)

**Positive:**
- Constructor parameter list simplified from 8 positional params to 2 (modules + options)
- New collaborators can be added as BuilderOptions fields without changing constructor signature
- Backward compatible — all existing call sites continue to work
- Consumers can use the new form immediately

**Negative:**
- Two constructor forms coexist (transient complexity during migration period)
- Runtime discriminator (`'render' in arg`) adds minor branch logic

**Neutral:**
- Architecture version bumped to v0.34
- +37 new tests
- Total test count: 1124 (1109 AI + 15 web)
- No existing test modifications required

---

## Future Work (Not Implemented)

| Capability | Description |
|-----------|-------------|
| Deprecate positional params | Mark legacy constructor overloads as `@deprecated` |
| Migrate all callers | Update internal and external callers to use BuilderOptions |
| Options validation | Add runtime validation for BuilderOptions combinations |

---

## References

- ADR-0043: Provider Budget Consumption
- ADR-0044: AI Configuration Foundation
- ADR-0045: AI Configuration Consumption
- ADR-0046: BuilderOptions Foundation (original)
- WO-S4-009: BuilderOptions Foundation
- WO-S4-010: BuilderOptions Consumption (this Work Order)