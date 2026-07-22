# ADR-0033: Prompt Renderer Foundation

**Status:** Accepted  
**Date:** Sprint 3  
**Work Order:** WO-S3-016  
**Architecture Version:** v0.20

---

## Context

The PromptBuilder currently handles both prompt construction AND string formatting in a single `build()` method. It combines PromptModule fragments by iterating over their `buildContext()` results and joining sections with `\n`. While functional, this approach couples two distinct responsibilities:

1. **Organizing PromptContext** — collecting structured prompt sections from modules
2. **Rendering to string** — converting the structured context to a final prompt format

Additionally, `serializePromptContext()` duplicates the rendering logic outside of PromptBuilder, providing a standalone serialization path.

### Problem

- PromptBuilder knows about both WHAT goes into the prompt and HOW it's formatted
- No abstraction exists for different prompt formats (markdown, XML, JSON, provider-specific)
- Adding a new output format requires modifying PromptBuilder
- There is no central "Prompt → string" abstraction with a clear contract

### Constraints

1. **PromptBuilder is the PromptContext organizer** — It calls PromptModules and merges `PromptContext`, but does NOT render strings
2. **PromptRenderer is the only text renderer** — All prompt text output must go through a `PromptRenderer`
3. **PromptModule stays independent** — Each module has `build()` and `buildContext()`, no module depends on another
4. **One-way dependency** — `PromptModule → PromptContext → PromptRenderer → PromptBuilder`
5. **Renderer is replaceable** — Abstraction allows future renderers (XML, JSON, provider-specific)
6. **Backward compatible** — All existing interfaces (`PromptBuilder`, `PromptModule`, `PromptContext`) unchanged
7. **No Planner, Pipeline, Provider, AgentLoop, Runtime modifications**
8. **Compression, Memory Ranking, Token Optimization deferred** — Not implemented in this WO

---

## Decision

### 1. New Module: `packages/ai/src/prompt/PromptRenderer.ts`

Defines the renderer abstraction:

```typescript
interface PromptRenderer {
  render(context: PromptContext): string
}
```

- Single-method interface
- Accepts `PromptContext`, returns a formatted string
- Implementations control the output format (order, structure, encoding)

### 2. New Module: `packages/ai/src/prompt/DefaultPromptRenderer.ts`

Default implementation with two rendering strategies:

- `render()` — renders fields in **insertion order** (preserving module array order used by the builder)
- `renderWithOrder()` — renders fields in **canonical order** (used by `serializePromptContext()` for backward compatibility)

Canonical field order:
```
system, userInput, memory, reflections, worldState, observations
```

### 3. serializePromptContext Delegation

`serializePromptContext()` now delegates to `DefaultPromptRenderer.renderWithOrder()`, maintaining identical behavior to the previous implementation.

### 4. DefaultPromptBuilder Updated

`DefaultPromptBuilder` now accepts an optional `PromptRenderer` parameter (defaults to `DefaultPromptRenderer`). Its `build()` method:

1. Iterates `PromptModule[]` and collects `PromptContext` via `buildContext()`
2. Calls `renderer.render(promptContext)` to produce the final string
3. For legacy modules (no `buildContext()`), calls `build()` and appends output

The `buildContext()` method is unchanged — it still returns the structured `PromptContext`.

### 5. Data Flow

```
PromptModule[6]
  ├── SystemPromptModule.buildContext()    → { system }
  ├── UserInputModule.buildContext()       → { userInput }
  ├── MemoryPromptModule.buildContext()    → { memory }
  ├── WorldStatePromptModule.buildContext()  → { worldState }
  ├── ObservationPromptModule.buildContext() → { observations }
  └── ReflectionPromptModule.buildContext()  → { reflections }
                      ↓
      DefaultPromptBuilder merges into PromptContext
                      ↓
      DefaultPromptRenderer.render(PromptContext)
                      ↓
               AIRequest { prompt }
```

---

## Consequences

**Positive:**
- Clear separation of concerns: PromptBuilder organizes, PromptRenderer formats
- Renderer abstraction enables future renderers without PromptBuilder changes
- `DefaultPromptRenderer.render()` and `renderWithOrder()` support both insertion (module) order and canonical order
- All 596 existing tests pass with zero modifications
- All external interfaces (`PromptBuilder`, `PromptModule`, `PromptContext`) unchanged
- `serializePromptContext()` remains a stable backward-compatible API
- Custom renderers can be injected into `DefaultPromptBuilder` for different output formats
- 39 new tests cover PromptRenderer, DefaultPromptRenderer, builder integration, serialization compatibility, legacy module support, all planners, streaming, AgentLoop, and custom renderer patterns

**Negative:**
- DefaultPromptBuilder constructor gains an optional second parameter (though fully backward compatible)
- PromptContext insertion order depends on module array order, which varies across callers

**Neutral:**
- PromptRenderer type and DefaultPromptRenderer class added to public API exports
- `DefaultPromptRenderer.renderWithOrder()` exposed for `serializePromptContext` canonical rendering
- Architecture version bumped to v0.20

---

## Future Work (Deferred)

| Capability | Description |
|-----------|-------------|
| MarkdownPromptRenderer | Section-based markdown format |
| XMLPromptRenderer | Structured XML prompt format |
| JSONPromptRenderer | JSON-encoded prompt |
| OpenAIPromptRenderer | OpenAI-specific format |
| ClaudePromptRenderer | Claude-specific format |
| Context Compression | Summarize or truncate sections during render |
| Memory Ranking | Score and filter memory entries during render |
| Token Optimization | Estimate and optimize token usage during render |

---

## References

- ADR-0008: PromptBuilder
- ADR-0009: Prompt Modules
- ADR-0032: Structured Prompt Context
- WO-S3-015: Structured Prompt Context
- WO-S3-016: Prompt Renderer Foundation (this Work Order)