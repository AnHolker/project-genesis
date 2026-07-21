# ADR-0023: Runtime Tool Execution

**Status:** Accepted  
**Date:** Sprint 3  
**Work Order:** WO-S3-006  
**Architecture Version:** v0.10

---

## Context

WO-S3-005 (Tool Calling Foundation) introduced the `Tool` and `ToolRegistry` abstractions but only provided a `MockFindEntityTool` that returned hardcoded data. Real tools need access to live world state from the Runtime.

Without Runtime-backed tools:
- Tools cannot provide useful information during planning
- The AI cannot query entity positions, types, or world state mid-plan
- The tool abstraction layer exists but produces no real value

The challenge is to connect tools to Runtime data without violating the existing dependency direction: `@genesis/ai` must never import `@genesis/runtime`.

### Constraints

1. **No direct dependency** from `@genesis/ai` to `@genesis/runtime`
2. **No mutation APIs exposed** — tools must be read-only
3. **Existing `RuntimeQuery` class** in `@genesis/runtime` must remain backward compatible
4. **All existing tests must continue passing**
5. **Tool interface** (from WO-S3-005) must remain unchanged

---

## Decision

### 1. RuntimeQuery Interface in @genesis/shared

Define a read-only query interface in `@genesis/shared` — the dependency-safe package that both `@genesis/runtime` and `@genesis/ai` depend on:

```typescript
// packages/shared/src/RuntimeQuery.ts
interface RuntimeQuery {
  findEntity(id: string): Entity | undefined
  findEntities(type?: string): Entity[]
  getWorldSnapshot(): Readonly<World>
}
```

**Why `@genesis/shared`?**
- Both `@genesis/runtime` (implementation) and `@genesis/ai` (tool consumers) already depend on `@genesis/shared`
- No new package dependencies needed
- The interface is just types — no runtime cost

### 2. RuntimeQuery Implementation in @genesis/runtime

The existing `RuntimeQuery` class in `@genesis/runtime` is updated to explicitly implement the interface:

```typescript
class RuntimeQuery implements RuntimeQueryInterface {
  findEntity(id: string): Entity | undefined { ... }
  findEntities(type?: string): Entity[] { ... }
  getWorldSnapshot(): Readonly<World> { ... }
}
```

Backward compatibility is maintained:
- `findById()` kept as a deprecated alias for `findEntity()`
- `findByType()` kept as a deprecated alias for `findEntities()`
- `getWorldSnapshot()` returns a defensive copy (not the internal reference)

### 3. Real Tool Implementations in @genesis/ai

Three new tools replace the demonstration-only mock:

| Tool | Name | Description | Backend |
|------|------|-------------|---------|
| `FindEntityTool` | `find_entity` | Find entity by ID | `RuntimeQuery.findEntity()` |
| `FindEntitiesByTypeTool` | `find_entities` | Find entities by type | `RuntimeQuery.findEntities()` |
| `GetWorldSnapshotTool` | `get_world_snapshot` | Full world snapshot | `RuntimeQuery.getWorldSnapshot()` |

Each tool receives a `RuntimeQuery` interface via constructor injection:
```typescript
class FindEntityTool implements Tool {
  constructor(private readonly query: RuntimeQuery) {}
  async execute(input: unknown): Promise<unknown> {
    // Uses this.query.findEntity(...) — no Runtime dependency
  }
}
```

### 4. Dependency Direction

```
@genesis/shared
  ├── RuntimeQuery (interface) ← read-only, type-only
  ├── Entity, World, Action types

@genesis/runtime
  └── depends on @genesis/shared
  └── RuntimeQuery (class) implements RuntimeQuery interface

@genesis/ai
  └── depends on @genesis/shared
  └── FindEntityTool, etc. consume RuntimeQuery interface
  └── NO dependency on @genesis/runtime

Application layer (gameStore.ts)
  └── depends on @genesis/runtime + @genesis/ai
  └── Creates Runtime, creates RuntimeQuery, creates tools, wires them together
```

The tools depend only on the `RuntimeQuery` **interface**, not on the concrete `RuntimeQuery` **class**. This preserves the dependency direction constraint.

### 5. Why not put tools in @genesis/runtime?

Tools implement the `Tool` interface from `@genesis/ai`. Putting tools in `@genesis/runtime` would require `@genesis/runtime` to depend on `@genesis/ai` — a reverse dependency from the current architecture. The `RuntimeQuery` interface in `@genesis/shared` is the correct abstraction layer.

---

## Consequences

**Positive:**
- Tools now return real world data, not hardcoded mocks
- No dependency violation — `@genesis/ai` depends only on `RuntimeQuery` interface from `@genesis/shared`
- `MockFindEntityTool` still available for testing without Runtime
- Backward compatible — all existing methods and tests work unchanged
- Clear extension path for new tools (any method on `RuntimeQuery`)

**Negative:**
- Three new files in `@genesis/ai` that depend on `RuntimeQuery` interface
- Tools must be constructed with a `RuntimeQuery` instance at the composition root
- `RuntimeQuery` interface is now part of the public API of `@genesis/shared`

**Neutral:**
- `RuntimeQuery` interface is type-only — no runtime cost
- The `@genesis/shared` package grows slightly but remains dependency-free
- `MockFindEntityTool` remains useful for isolated unit tests

---

## Files Changed

| File | Change |
|------|--------|
| `packages/shared/src/RuntimeQuery.ts` | New — `RuntimeQuery` interface |
| `packages/shared/src/index.ts` | Modified — exported `RuntimeQuery` |
| `packages/runtime/src/query/RuntimeQuery.ts` | Modified — implements interface, adds `findEntity`, `findEntities`, `getWorldSnapshot` |
| `packages/ai/src/tools/FindEntityTool.ts` | New — Runtime-backed entity lookup |
| `packages/ai/src/tools/FindEntitiesByTypeTool.ts` | New — Runtime-backed type filter |
| `packages/ai/src/tools/GetWorldSnapshotTool.ts` | New — Runtime-backed world snapshot |
| `packages/ai/src/tools/index.ts` | Modified — exported new tools |
| `packages/ai/src/index.ts` | Modified — no change needed (re-exports from tools/) |
| `packages/runtime/src/__tests__/Runtime.test.ts` | Modified — 9 new tests for interface methods |
| `packages/ai/src/__tests__/RuntimeToolExecution.test.ts` | New — 23 tests for tool execution |
| `docs/project/CHANGELOG.md` | Modified — added WO-S3-006 entry |
| `docs/project/PROJECT_STATE.md` | Modified — updated status, ADRs |
| `docs/project/AI_ARCHITECTURE.md` | Modified — updated tool hierarchy |
| `docs/adr/ADR-0023-runtime-tool-execution.md` | New — this document |

---

## Test Summary

### Runtime tests (9 new)

| Test | Count |
|------|-------|
| `findEntity` — find by ID | 2 |
| `findEntities` — filter by type or all | 4 |
| `getWorldSnapshot` — snapshot and immutability | 3 |

### AI tool tests (23 new)

| Test Group | Count |
|-----------|-------|
| FindEntityTool — populated world | 4 |
| FindEntityTool — empty world | 1 |
| FindEntityTool — metadata | 1 |
| FindEntitiesByTypeTool — populated world | 4 |
| FindEntitiesByTypeTool — empty world | 2 |
| FindEntitiesByTypeTool — metadata | 1 |
| GetWorldSnapshotTool — populated world | 2 |
| GetWorldSnapshotTool — empty world | 1 |
| GetWorldSnapshotTool — independence | 1 |
| GetWorldSnapshotTool — metadata | 1 |
| Registry integration | 3 |
| Backward compatibility | 2 |

### Overall

| Metric | Value |
|--------|-------|
| New tests | 32 |
| Existing tests | 169 |
| **Total passing** | **201** |
| TypeScript | Clean |
| ESLint | Clean |
| Build | Passes |