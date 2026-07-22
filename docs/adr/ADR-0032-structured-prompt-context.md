# ADR-0032: Structured Prompt Context

**Status:** Accepted  
**Date:** Sprint 3  
**Work Order:** WO-S3-015  
**Architecture Version:** v0.19

---

## Context

The PromptBuilder currently composes the final prompt string by collecting raw string fragments from PromptModule.build() and joining them with '\n'. While functional, this approach has several limitations:

1. **No intermediate structure** — The prompt sections (system, user input, memory, etc.) are opaque strings with no semantic identity
2. **Order-dependent** — The output depends entirely on module array order, not on section semantics
3. **Difficult to inspect** — Consumers cannot access individual sections without re-parsing the string
4. **No future extension path** — Future capabilities like Context Compression, Memory Ranking, or Conditional Sections need structured access to prompt sections

### Constraints

1. **PromptBuilder is the only Prompt organizer** — All prompt organization stays in PromptBuilder
2. **New context must be added as PromptModule** — No if/else chains in PromptBuilder
3. **PromptBuilder must not depend on AgentLoop** — Maintains one-way dependency
4. **Backward compatible** — All existing tests pass without modification
5. **Existing PromptModule.build() unchanged** — buildContext() is additive, not breaking
6. **No PromptBuilder interface changes** — build(context): Promise<AIRequest> stays identical
7. **No Planner, Pipeline, Provider, or AgentLoop modifications**

---

## Decision

### 1. New Module: `packages/ai/src/prompt/PromptContext.ts`

```
packages/ai/src/prompt/
  PromptContext.ts    ← NEW
```

Defines the unified prompt data structure:

```typescript
interface PromptContext {
  system?: string         // System prompt instructions
  userInput?: string      // Raw user input text
  memory?: string         // Conversation history
  worldState?: string     // Current world snapshot
  observations?: string   // Structured tool observations
  reflections?: string    // Reflection evaluation results
}
```

- Each field corresponds to one PromptModule type
- All fields are optional — only populated sections are present
- Simple design: no future-proofing for dozens of fields
- Independent of AgentLoop, Planner, or Runtime

Plus a serialization utility:

```typescript
function serializePromptContext(ctx: PromptContext): string
```

Converts a PromptContext to a formatted string by iterating over a canonical field order and joining non-empty sections with '\n'.

### 2. PromptModule Extension

The `PromptModule` interface gains an optional method:

```typescript
interface PromptModule {
  build(context: PipelineContext): Promise<string>

  buildContext?(context: PipelineContext): Promise<Partial<PromptContext>>
}
```

- `build()` — unchanged, still returns the formatted string fragment
- `buildContext()` — new, returns structured Partial<PromptContext>
- Both methods produce the same content, just in different forms
- Legacy modules (build() only) continue working unchanged

All 6 existing PromptModules implement buildContext():

| Module | buildContext() returns |
|--------|----------------------|
| SystemPromptModule | `{ system: "You are..." }` |
| UserInputModule | `{ userInput: "input text" }` |
| MemoryPromptModule | `{ memory: "Previous conversation:..." }` or `{ memory: undefined }` |
| WorldStatePromptModule | `{ worldState: "Current World:..." }` or `{ worldState: undefined }` |
| ObservationPromptModule | `{ observations: "## Previous Observations..." }` or `{ observations: undefined }` |
| ReflectionPromptModule | `{ reflections: "## Previous Reflection..." }` or `{ reflections: undefined }` |

### 3. DefaultPromptBuilder Context Composition

`DefaultPromptBuilder.build()` is updated to compose via PromptContext:

```
for each module:
  ├── Call module.buildContext(context) → Partial<PromptContext>
  ├── Merge into unified PromptContext
  ├── Serialize section from context key
  └── Append to sections array

Return AIRequest { prompt: sections.join('\n') }
```

The builder also exposes a new `buildContext()` method that returns the structured PromptContext without serializing:

```typescript
class DefaultPromptBuilder implements PromptBuilder {
  async buildContext(context: PipelineContext): Promise<PromptContext>
}
```

### 4. Data Flow

```
PromptModule[6]
  ├── SystemPromptModule.buildContext()    → { system }
  ├── UserInputModule.buildContext()       → { userInput }
  ├── MemoryPromptModule.buildContext()    → { memory }
  ├── WorldStatePromptModule.buildContext() → { worldState }
  ├── ObservationPromptModule.buildContext() → { observations }
  └── ReflectionPromptModule.buildContext() → { reflections }
                      │
                      ▼
            Merge into PromptContext
                      │
                      ▼
            Serialize to string
                      │
                      ▼
              AIRequest { prompt }
```

---

## Consequences

**Positive:**
- PromptContext provides a structured intermediate representation
- Consumers can access individual prompt sections via PromptContext
- Future capabilities (Compression, Ranking, Conditional Sections) can operate on PromptContext
- buildContext() is additive — all existing build() code continues working
- All 568 existing tests pass with zero modifications
- DefaultPromptBuilder.buildContext() enables structured access without serialization

**Negative:**
- Modules with buildContext() are called for both build() content and structured context (double work for modules that re-process data)
- The canonical field order in serialization may differ from custom module array orders

**Neutral:**
- PromptModule interface gains an optional method
- DefaultPromptBuilder gains a buildContext() method
- PromptContext type added to public API exports

---

## Future Work (Not Implemented)

| Capability | Description |
|-----------|-------------|
| Context Compression | Use PromptContext to decide which sections to summarize |
| Memory Ranking | Score and filter memory entries based on relevance |
| Conditional Sections | Skip PromptModule sections based on context analysis |
| Prompt Renderer | Customizable rendering of PromptContext to string |

---

## References

- ADR-0008: PromptBuilder
- ADR-0009: Prompt Modules
- ADR-0029: Planner Observation Awareness
- ADR-0030: Reflection Foundation
- ADR-0031: Reflection Prompt Integration
- WO-S3-014: Reflection Prompt Integration
- WO-S3-015: Structured Prompt Context Foundation (this Work Order)