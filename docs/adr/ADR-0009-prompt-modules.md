# ADR-0009: Prompt Modules

**Status:** Accepted  
**Date:** Sprint 2  
**Architecture Version:** v0.6

---

## Context

`DefaultPromptBuilder` initially hardcoded prompt generation:
```typescript
return { prompt: context.input }
```

Future prompts need to assemble content from multiple sources:
- User input
- System instructions
- Conversation memory
- Runtime world state
- Tool descriptions
- Safety instructions

Hardcoding these inside PromptBuilder would create a monolithic class that violates the Single Responsibility Principle.

## Decision

Introduce `PromptModule` interface:

```typescript
interface PromptModule {
  build(context: PipelineContext): Promise<string>
}
```

Each module returns one prompt fragment. `DefaultPromptBuilder` receives an array of modules, executes them via `Promise.all`, and joins fragments with `'\n'`:

```typescript
class DefaultPromptBuilder implements PromptBuilder {
  constructor(private readonly modules: PromptModule[]) {}
  
  async build(context: PipelineContext): Promise<AIRequest> {
    const fragments = await Promise.all(
      this.modules.map((m) => m.build(context))
    )
    return { prompt: fragments.join('\n') }
  }
}
```

`UserInputModule` provides the current user input (`context.input`).

## Consequences

**Positive:**
- Adding a prompt source means creating a new module class
- No changes to PromptBuilder, Pipeline, or existing modules
- Modules run in parallel via Promise.all
- Each module is independently testable

**Negative:**
- `join('\n')` is a naive separator — may need structured composition later
- Additional array parameter in DefaultPromptBuilder constructor

**Neutral:**
- Zero behavioral change (single module produces same output)
- Future modules may need ordering guarantees