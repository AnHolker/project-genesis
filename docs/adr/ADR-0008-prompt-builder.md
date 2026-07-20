# ADR-0008: PromptBuilder

**Status:** Accepted  
**Date:** Sprint 2  
**Architecture Version:** v0.6

---

## Context

`DefaultPipeline` was responsible for constructing `AIRequest`:
```typescript
const request: AIRequest = { prompt: context.input }
```

This coupled Pipeline to AIRequest construction. As AIRequest grows to include system prompts, memory, runtime snapshots, and tool descriptions, Pipeline should not know how to assemble these.

A dedicated builder separates the "what to prompt" from the "how to execute."

## Decision

Introduce `PromptBuilder` interface:

```typescript
interface PromptBuilder {
  build(context: PipelineContext): Promise<AIRequest>
}
```

`DefaultPromptBuilder` implements the interface. Pipeline receives `PromptBuilder` via constructor injection and delegates AIRequest construction.

## Consequences

**Positive:**
- Pipeline is decoupled from prompt construction
- PromptBuilder can evolve independently (system prompts, memory, snapshots)
- Testable in isolation — construct an AIRequest without running the full pipeline

**Negative:**
- Additional constructor parameter for DefaultPipeline
- Simple case now requires two objects (Pipeline + PromptBuilder)

**Neutral:**
- Pipeline behavior unchanged — it was already calling `planner.plan()`
- The separation follows the existing pattern (Planner interface → implementation)