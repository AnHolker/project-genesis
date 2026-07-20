# ADR-0011: Memory Interface

**Status:** Accepted  
**Date:** Sprint 2  
**Architecture Version:** v0.6

---

## Context

Multi-turn conversations require context. The AI Pipeline has no mechanism to store or retrieve information between turns. Without a Memory abstraction, each user input is processed in isolation — the Planner has no knowledge of previous interactions.

A formal Memory interface is needed before conversation-aware PromptModules can be built.

## Decision

Introduce a minimal `Memory` interface:

```typescript
interface Memory {
  get(key: string): Promise<unknown>
  set(key: string, value: unknown): Promise<void>
}
```

`DefaultMemory` implements this interface using an in-memory `Map<string, unknown>`.

`PipelineContext` includes an optional `memory` field. `MemoryPromptModule` retrieves conversation history from memory and formats it as a prompt fragment.

The interface is intentionally minimal — only `get` and `set` by string key. This allows future implementations (persistent storage, vector stores) without changing consumers.

## Consequences

**Positive:**
- Simple, generic interface — unopinionated about storage strategy
- No dependency on Runtime, Vue, or external libraries
- `MemoryPromptModule` can be added without modifying Pipeline or Planner
- Optional field in PipelineContext — zero cost when unused

**Negative:**
- No key enumeration — callers must know key names
- No TTL, eviction, or size limits
- `Promise<unknown>` requires type checking by consumers

**Neutral:**
- Interface can be extended with additional methods later
- DefaultMemory lifetime matches the application instance