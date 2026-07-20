# ADR-0006: AI Pipeline

**Status:** Accepted  
**Date:** Sprint 2  
**Architecture Version:** v0.6

---

## Context

The original flow was `Natural Language → Planner → Runtime → Renderer`. There was no formal Pipeline abstraction. The UI (`gameStore.ts`) directly called `MockPlanner.plan(input)`, which tightly coupled the application layer to the planner implementation.

Future stages — PromptBuilder, Memory, Tool Calling, Streaming — require a structured execution framework. Without a Pipeline, each new stage would require modifying the UI.

## Decision

Introduce a `Pipeline` interface with a single method:

```typescript
interface Pipeline {
  execute(context: PipelineContext): Promise<PipelineContext>
}
```

`PipelineContext` carries all data through pipeline stages:

```typescript
interface PipelineContext {
  input: string
  plannerResult?: PlannerResult
  memory?: Memory
  metadata?: Record<string, unknown>
}
```

`DefaultPipeline` implements `Pipeline`. It orchestrates:
1. PromptBuilder → AIRequest
2. Planner → PlannerResult
3. Assembles result into PipelineContext

The UI depends only on the `Pipeline` interface.

## Consequences

**Positive:**
- New pipeline stages can be added without modifying the UI
- PipelineContext provides a stable contract between stages
- DefaultPipeline is replaceable without changing consumers
- Events and monitoring can be added around pipeline execution

**Negative:**
- Additional indirection layer for simple flows
- PipelineContext accumulates data across stages

**Neutral:**
- Single entry point for all AI operations
- Pipeline interface is intentionally minimal