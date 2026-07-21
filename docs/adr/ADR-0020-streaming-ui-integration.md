# ADR-0020: Streaming UI Integration

**Status:** Accepted  
**Date:** Sprint 3  
**Work Order:** WO-S3-003

---

## Context

The AI pipeline already supports streaming via `Pipeline.stream()` and `StreamChunk` events (WO-S3-001, WO-S3-002). However, the web application (`gameStore`) only calls `Pipeline.execute()` — users see no progress during AI generation.

The streaming infrastructure exists in `@genesis/ai`. This work is **presentation-layer only**: connecting the streaming pipeline to the web UI without redesigning the AI architecture.

### Constraints

1. Pipeline remains framework-independent — no Vue/Pinia types in `@genesis/ai`
2. Streaming is visualization only — Runtime executes only after stream completes, JSON assembles, and `StructuredOutputValidator` passes
3. Existing `execute()` behavior must remain identical
4. Non-streaming providers must gracefully fall back (no `StreamChunk` events)

---

## Decision

### 1. Streaming mode toggle in gameStore

Add a `useStreaming` reactive ref to `gameStore`. When `true`, `send()` calls `pipeline.stream()` instead of `pipeline.execute()`. Default is `false` to preserve backward compatibility.

```typescript
const useStreaming = ref(false)

async function send(input: string) {
  if (useStreaming.value) {
    await sendStreaming(input, context)
  } else {
    const result = await pipeline.execute(context)
    applyResult(result, input)
  }
}
```

### 2. StreamChunk event listener

Subscribe to `PipelineEventEmitter` during streaming. Accumulate text chunks into a reactive `streamingText` buffer.

```typescript
const streamListener = {
  onEvent(event: PipelineEvent): void {
    if (event.type === 'StreamChunk' && event.payload?.chunk) {
      streamingText.value += event.payload.chunk as string
    }
  },
}
```

Listener is subscribed before `pipeline.stream()` and unsubscribed in the `finally` block.

### 3. Reactive UI state

Three reactive refs in gameStore, **not** in Pipeline:

| State | Type | Purpose |
|-------|------|---------|
| `isStreaming` | `ref<boolean>` | True while `pipeline.stream()` is in progress |
| `streamingText` | `ref<string>` | Accumulated text from StreamChunk events |
| `streamingFinished` | `ref<boolean>` | True after streaming completes successfully |

Pipeline remains framework-independent. All UI state lives in the application layer.

### 4. Runtime execution after streaming

Streaming is only visualization. After `pipeline.stream()` resolves:

1. `streamingFinished` is set to `true`
2. `applyResult()` processes `plannerResult` identically to `execute()`
3. `Runtime.applyActions()` dispatches validated actions
4. The game world and log update the same way

The pipeline's `stream()` method already ensures `StructuredOutputValidator` runs on the assembled JSON before returning `PlannerResult`.

### 5. Error handling

If streaming fails:

1. Clear all streaming state (`resetStreamingState()`)
2. Show error in log
3. Fall back to `pipeline.execute()` — preserving existing behavior
4. Error is caught in try/catch around `pipeline.stream()`

### 6. Provider passthrough

`DefaultPipeline` constructor takes an optional `provider` parameter. The gameStore now passes the provider to the pipeline so `stream()` can detect `StreamingPlannerProvider` support at runtime.

---

## Consequences

**Positive:**
- Users see real-time AI generation progress
- Streaming is opt-in (toggle), backward compatible
- Pipeline stays framework-independent
- Runtime execution is unchanged — same validation path
- Fallback is seamless for non-streaming providers

**Negative:**
- Slight increase in gameStore complexity (streaming state management)
- UI input/button disabled during streaming to prevent concurrent sends
- Provider must be passed to pipeline constructor (was previously implicit)

**Neutral:**
- `useStreaming` is a user preference, could be persisted in the future
- Streaming panel is minimal — can be styled/enhanced independently

---

## Files Changed

| File | Change |
|------|--------|
| `apps/web/src/stores/gameStore.ts` | Added `isStreaming`, `streamingText`, `streamingFinished`, `useStreaming` refs; `sendStreaming()`, `resetStreamingState()`, `applyResult()`; stream event listener |
| `apps/web/src/App.vue` | Added streaming panel, streaming toggle, disabled input during streaming |
| `apps/web/src/__tests__/streaming-ui.test.ts` | New — 15 tests covering StreamChunk updates, state transitions, fallback, completion, runtime consistency, error handling |
| `apps/web/vitest.config.ts` | New — vitest config for web app |
| `apps/web/package.json` | Added vitest, @vue/test-utils, jsdom devDependencies; test scripts |
