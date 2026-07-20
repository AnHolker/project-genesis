# ADR-0010: Pipeline Events

**Status:** Accepted  
**Date:** Sprint 2  
**Architecture Version:** v0.6

---

## Context

Pipeline execution was entirely silent. There was no way to observe what was happening during `Pipeline.execute()` — no visibility into when prompting started, when planning began, or when execution completed.

Future features require observability:
- Debug UI showing pipeline progress
- Performance metrics
- Telemetry and logging
- Error tracking per stage

Adding event emission after the fact would require modifying the Pipeline interface or adding callbacks to every consumer.

## Decision

Introduce a lightweight event system with three components:

**PipelineEvent** — discriminated union of lifecycle events:
```typescript
type PipelineEventType =
  | 'PipelineStarted'
  | 'PromptBuilt'
  | 'PlannerStarted'
  | 'PlannerFinished'
  | 'PipelineFinished'
```

**PipelineEventListener** — observer interface:
```typescript
interface PipelineEventListener {
  onEvent(event: PipelineEvent): void
}
```

**PipelineEventEmitter** — publish/subscribe manager:
```typescript
class PipelineEventEmitter {
  subscribe(listener: PipelineEventListener): void
  unsubscribe(listener: PipelineEventListener): void
  emit(event: PipelineEvent): void
}
```

`DefaultPipeline` owns a `readonly events: PipelineEventEmitter`. It emits events during execution. Pipeline has no knowledge of who is listening.

## Consequences

**Positive:**
- Observability added without coupling
- No effect on Pipeline behavior (fire-and-forget emission)
- Listeners can be added by any consumer without modifying Pipeline

**Negative:**
- Slight overhead (object allocation for each event)
- Synchronous emission — a blocking listener blocks the pipeline

**Neutral:**
- Event types can be extended without breaking existing listeners
- No async emission support (intentional — keep simple until needed)