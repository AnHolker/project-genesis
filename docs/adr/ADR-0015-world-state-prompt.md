# ADR-0015: World State via PipelineContext

**Status:** Accepted  
**Date:** Sprint 2  
**Architecture Version:** v0.8

---

## Context

The PromptBuilder pipeline needed a way to include current world state (entity positions, types, IDs) so the AI can reason about existing entities. Two approaches were considered:

1. **PromptModule queries Runtime directly** — `WorldStatePromptModule` receives `RuntimeQuery` or `World` reference, serializes entities internally.
2. **World state is injected via PipelineContext** — Application layer serializes the world, passes a formatted string as `context.worldState`.

## Decision

Use approach 2: world state is injected into `PipelineContext.worldState` as a pre-formatted string.

`WorldStatePromptModule` reads `context.worldState` and wraps it in a header section:

```typescript
class WorldStatePromptModule implements PromptModule {
  async build(context: PipelineContext): Promise<string> {
    if (!context.worldState) return ''
    const entities = context.worldState.trim()
    if (entities.length === 0) return ''
    return `Current World:\n\n${entities}`
  }
}
```

The application layer (`gameStore.ts`) owns serialization via `formatWorldState()`:

```typescript
function formatWorldState(): string {
  const entities = runtime.value.world.entities
  if (entities.length === 0) return '(empty)'
  // ... format each entity as:
  //   Tree\nid: tree-1\nposition: (3,5)
}
```

### Why not approach 1?

- `PromptModule` would need to import `Runtime` or `World` types — adding a compile-time dependency on `@genesis/runtime`
- `PromptBuilder` (currently in `@genesis/ai`) would need to know about world types — violating package isolation
- Direct query from PromptModule couples prompt generation to runtime state management
- Testing would require constructing a full `Runtime` instance with entities
- The serialization format is a presentation concern — belongs in the application layer

### Why a string, not a structured type?

- `PipelineContext` stays generic — no dependency on `World`, `Entity`, or Runtime types
- The format can change without modifying `@genesis/ai` package
- `WorldStatePromptModule` is trivially testable — just pass strings in, assert strings out
- Future formats (JSON, Markdown tables, token-optimized) can be implemented in the application layer

## Consequences

**Positive:**
- `WorldStatePromptModule` has zero dependencies on Runtime or World types
- The module is a pure text formatter — `string in → string out`
- Application layer controls serialization format
- Tests are simple — construct `PipelineContext` with `worldState` string, assert output
- Adding world state to the prompt does not require modifying any AI package code

**Negative:**
- Application layer must remember to set `worldState` in every `PipelineContext`
- Serialization runs on every pipeline execution — no caching (acceptable at current scale)
- The format is implicit — no schema validation between application and prompt module

**Neutral:**
- The string type could be replaced with a structured snapshot type in the future without changing the module interface
- The separation follows the same pattern as `Memory` — injected via context, not queried by module