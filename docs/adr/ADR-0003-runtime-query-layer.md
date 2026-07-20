# ADR-0003: Runtime Query Layer

**Status:** Accepted  
**Date:** Sprint 1  
**Architecture Version:** v0.3

---

## Context

External callers accessed World data directly through `runtime.world.entities`. This leaked the internal storage implementation (a flat array) and made it impossible to evolve storage without changing consumers.

The Renderer and future AI Planner both need read-only access to World data. Neither should depend on the internal structure of World.

A dedicated Query Layer was needed to:
- Provide a stable read API
- Hide the internal storage representation
- Enforce read-only access at the type level

---

## Decision

Introduce `RuntimeQuery` as a separate class under `packages/runtime/src/query/`.

Runtime owns a `query` instance:

```
runtime.query.findById(id)
runtime.query.findByType(type)
```

`RuntimeQuery` receives `Readonly<World>` in its constructor. TypeScript enforces that query methods cannot mutate World.

Initial methods:
- `findById(id: string): Entity | undefined`
- `findByType(type: string): Entity[]`

Both iterate over `world.entities` linearly. No Map optimizations. No storage redesign.

---

## Consequences

**Positive:**
- Read access is now typed and stable
- World storage can evolve without breaking query consumers
- `Readonly<World>` provides compile-time mutation safety
- New query methods can be added without changing Runtime
- Separate file, single responsibility

**Negative:**
- O(n) lookups until Entity Map optimization is introduced
- Slightly more code than direct `world.entities` access

**Neutral:**
- Query methods forward to existing array iteration
- No performance impact at current scale