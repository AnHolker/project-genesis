# ADR-0034: Context Compression Foundation

**Status:** Accepted  
**Date:** Sprint 3  
**Work Order:** WO-S3-017  
**Architecture Version:** v0.21

---

## Context

The Prompt pipeline currently flows from `PromptModule[] → PromptContext → PromptRenderer` without any intermediate transformation. As the system handles longer conversations, more observations, and richer world state, the `PromptContext` will grow in size. Future compression strategies (token counting, truncation, LLM summarization) require a well-defined injection point in the pipeline.

Additionally, the `DefaultPromptBuilder` currently passes raw `PromptContext` directly to the `PromptRenderer`. There is no abstraction between context assembly and rendering that could:
1. Remove empty/undefined fields
2. Apply rule-based cleanup
3. Eventually truncate or summarize sections

### Constraints

1. **Compression operates on PromptContext** — Input and output are `PromptContext`. Direct prompt string manipulation is forbidden.
2. **PromptRenderer does NOT compress** — The Renderer's single responsibility is converting `PromptContext` to string.
3. **Compression is replaceable** — A unified interface allows future implementations (Noop, RuleBased, Token, LLM).
4. **One-way dependency** — `PromptContext → Compression → PromptRenderer`. Compression must NOT depend on Planner, Provider, Runtime, or AgentLoop.
5. **Composable** — Compression can be disabled, replaced, tested in isolation. It is side-effect free and returns new objects.
6. **Backward compatible** — All existing interfaces unchanged. Compression is an optional constructor parameter.
7. **No Planner, Pipeline, Provider, AgentLoop, Runtime, Tool, PromptModule, or PromptRenderer modifications.**
8. **Not Token Compression, LLM Summary, or Memory Ranking** — Those are future Work Orders.

---

## Decision

### 1. New Interface: `packages/ai/src/prompt/PromptCompression.ts`

```typescript
interface PromptCompression {
  compress(context: PromptContext): PromptContext
}
```

- Single-method interface
- Accepts `PromptContext`, returns a new `PromptContext`
- Implementations MUST NOT mutate the input object
- No dependencies on any other component

### 2. New Implementation: `packages/ai/src/prompt/DefaultPromptCompression.ts`

Default behavior:
- Returns a NEW `PromptContext` with `undefined` and empty string `''` fields removed
- All other fields are preserved verbatim
- Idempotent: `compress(compress(ctx)) === compress(ctx)`
- Non-mutating: returns a new object

This is intentionally minimal — no token counting, no LLM summarization, no semantic compression.

### 3. DefaultPromptBuilder Updated

`DefaultPromptBuilder` accepts an optional third constructor parameter:

```typescript
constructor(
  modules: PromptModule[],
  renderer?: PromptRenderer,
  compression?: PromptCompression,  // NEW — defaults to DefaultPromptCompression
)
```

The `build()` method now:

```
PromptModules
    ↓
PromptContext (merged from modules)
    ↓
PromptCompression.compress()  ← NEW: always applied before render
    ↓
PromptRenderer.render()
    ↓
AIRequest { prompt }
```

The `buildContext()` method also applies compression before returning:

```
PromptModules
    ↓
PromptContext (merged from modules)
    ↓
PromptCompression.compress()  ← NEW: cleans up before return
    ↓
PromptContext
```

### 4. Data Flow

```
PromptModule[6]
  ├── SystemPromptModule.buildContext()    → { system: "..." }
  ├── UserInputModule.buildContext()       → { userInput: "..." }
  ├── MemoryPromptModule.buildContext()    → { memory: "..." }
  ├── WorldStatePromptModule.buildContext() → { worldState: "..." }
  ├── ObservationPromptModule.buildContext() → { observations: "..." }
  └── ReflectionPromptModule.buildContext() → { reflections: "..." }
                      ↓
      DefaultPromptBuilder merges into PromptContext
                      ↓
      DefaultPromptCompression.compress()      ← NEW
                      ↓
      DefaultPromptRenderer.render(PromptContext)
                      ↓
               AIRequest { prompt }
```

### 5. Exports

Both `PromptCompression` (type) and `DefaultPromptCompression` (class) are exported from:
- `packages/ai/src/prompt/index.ts`
- `packages/ai/src/index.ts`

---

## Consequences

**Positive:**
- Well-defined compression injection point between context assembly and rendering
- All existing code continues unchanged — compression is an optional additive parameter
- Default implementation cleans up undefined/empty fields at no cost
- Interface supports future RuleBasedCompression, TokenCompression, LLMCompression
- Compression is testable in isolation (no dependencies)
- Single-direction dependency maintained (Compression → PromptContext)
- PromptRenderer remains responsible only for string rendering
- All existing tests pass with zero modifications (596+ tests)

**Negative:**
- DefaultPromptBuilder constructor gains an optional third parameter (though fully backward compatible)
- The `buildContext()` method now returns a compressed context, which may differ from the raw module output

**Neutral:**
- DefaultPromptCompression is a new class added to the public API
- PromptCompression interface added to type exports
- Architecture version bumped to v0.21

---

## Future Work (Not Implemented)

| Capability | Description |
|-----------|-------------|
| RuleBasedCompression | Configurable rules for field removal/truncation |
| TokenCompression | Count tokens and truncate PromptContext to fit token budget |
| LLMCompression | Summarize PromptContext sections using an LLM call |
| SemanticCompression | Remove redundant or low-information sections |
| MemoryRankingIntegration | Score and filter memory before context assembly |
| Compression Pipeline | Chain multiple compression strategies |

---

## References

- ADR-0032: Structured Prompt Context
- ADR-0033: Prompt Renderer Foundation
- ADR-0008: PromptBuilder
- ADR-0009: Prompt Modules
- WO-S3-015: Structured Prompt Context Foundation
- WO-S3-016: Prompt Renderer Foundation
- WO-S3-017: Context Compression Foundation (this Work Order)