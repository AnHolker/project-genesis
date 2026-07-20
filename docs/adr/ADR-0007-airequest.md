# ADR-0007: AIRequest Input Model

**Status:** Accepted  
**Date:** Sprint 2  
**Architecture Version:** v0.6

---

## Context

`Planner.plan()` originally accepted a raw string (`input: string`). As planning requirements grew, future planners would need additional context:
- System prompts
- Memory entries
- Runtime snapshots
- Tool descriptions

Changing the parameter type later would break all Planner implementations and consumers.

## Decision

Introduce `AIRequest` as the stable input model:

```typescript
interface AIRequest {
  prompt: string
  metadata?: Record<string, unknown>
}
```

`Planner.plan()` now accepts `AIRequest` instead of a raw string. The Pipeline constructs AIRequest from PipelineContext via PromptBuilder.

AIRequest is intentionally minimal — only `prompt` and optional `metadata`. Additional fields can be added as optional properties without breaking existing code.

## Consequences

**Positive:**
- Planner interface is stable — future data is added to AIRequest
- Metadata provides an extension mechanism without interface changes
- Pipeline owns AIRequest construction, not the Planner

**Negative:**
- Slight verbosity increase: callers construct AIRequest instead of passing a string
- MockPlanner must unpack `request.prompt` instead of using `input` directly

**Neutral:**
- Zero behavioral change with the mock provider
- PipelineContext and AIRequest serve different roles (context vs. request)