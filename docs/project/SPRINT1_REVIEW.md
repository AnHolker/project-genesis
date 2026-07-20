# Sprint 1 Review

> Project Genesis — Sprint 1: Runtime Foundation
> Status: Completed and Frozen

---

## Goals

Sprint 1 aimed to validate the Runtime architecture by implementing a minimal but complete pipeline:

```
Natural Language → Planner → Runtime → World → Renderer
```

Key constraints:
- No AI integration
- No backend
- No networking
- No ECS
- Keep implementation minimal

---

## Completed Work Orders

| ID | Title | Scope |
|----|-------|-------|
| WO-S1-001 | Create Entity | Entity/World types, CreateEntityAction, Canvas renderer, Mock planner, Vue app |
| WO-S1-002 | Runtime Owns World | Runtime class, Runtime owns World, applyActions(), Planner returns Action[] |
| WO-S1-003 | Move Entity | MoveEntityAction, entity movement, Mock planner supports "move" |
| WO-S1-004 | Runtime Action Registry | ActionHandler interface, RuntimeHost, handler registry, removed switch(action.type) |
| WO-S1-005 | Runtime Unit Tests | Vitest, 5 test cases: CreateEntity, MoveEntity, Unknown Action, Multiple Actions |
| WO-S1-006 | Runtime Query Layer | RuntimeQuery, findById, findByType, 4 query tests, Readonly<World> safety |
| WO-S1-007 | Planner Interface | Planner interface, MockPlanner class, UI depends on interface only |
| WO-S1-008 | PlannerResult | PlannerResult wrapper with actions/reasoning/metadata, async interface |

**Total: 8 Work Orders | 5 source packages | 1 application | 0 regressions**

---

## Architecture Overview (v0.3)

```
                    packages/                      apps/
┌─────────────────────────────────────────────┐  ┌──────────────────┐
│  @genesis/shared                            │  │  web             │
│  ┌─────────────────┐                        │  │  ┌────────────┐  │
│  │ Entity          │                        │  │  │ App.vue    │  │
│  │ World           │                        │  │  │ (Canvas)   │  │
│  │ Action (union)  │                        │  │  └─────┬──────┘  │
│  │ CreateEntity    │                        │  │        │         │
│  │ MoveEntity      │                        │  │  ┌─────▼──────┐  │
│  └─────────────────┘                        │  │  │ gameStore  │  │
│                                              │  │  │ (Planner)  │  │
│  @genesis/ai                                │  │  └────────────┘  │
│  ┌─────────────────┐                        │  └──────────────────┘
│  │ Planner (iface) │────────────────────────┘
│  │ MockPlanner     │
│  │ PlannerResult   │
│  └─────────────────┘
│                                              Data Flow:
│  @genesis/runtime     ┌────────────────┐     Input → Planner.plan()
│  ┌─────────────────┐  │ RuntimeQuery   │            → PlannerResult.actions
│  │ Runtime         │  │  findById()    │            → Runtime.applyActions()
│  │  .world         │──│  findByType()  │            → ActionHandler.execute()
│  │  .query         │  └────────────────┘            → World mutation
│  │  .applyActions()│                               → renderWorld(ctx, world)
│  │  .generateId()  │
│  └──────┬──────────┘
│         │ handlers/
│  ┌──────▼──────────┐
│  │ ActionHandler   │
│  │ CreateEntity    │
│  │ MoveEntity      │
│  └─────────────────┘
│
│  @genesis/renderer
│  ┌─────────────────┐
│  │ renderWorld()   │
│  │ (Canvas 2D)     │
│  └─────────────────┘
```

### Key Architecture Rules

1. Runtime owns World — sole mutator
2. World stores state only
3. Planner produces `PlannerResult` only
4. Renderer reads World only
5. One Action → One Handler
6. No `switch(action.type)`
7. Query Layer is read-only
8. Keep code simple

---

## Lessons Learned

### Positive

1. **Handler registry over switch** — Adding MoveEntity required zero changes to existing code. The registry pattern scales naturally.

2. **Vitest integration** — Lightweight, fast (200ms test suite), zero conflicts with existing Vite setup.

3. **Interface-first approach** — Planner interface and PlannerResult were introduced before any LLM integration, avoiding future breaking changes.

4. **Readonly typing** — `Readonly<World>` in RuntimeQuery prevented accidental mutations at compile time.

### Challenges

1. **Node.js version constraint** — v18 doesn't support Vitest v4. Had to pin Vitest v1. Worth upgrading Node.js before Sprint 2.

2. **Monorepo path resolution** — Each package uses `main: "./src/index.ts"` with direct TypeScript sources. Vite aliases duplicate this resolution. Works but adds config surface area.

3. **Architecture documentation drift** — Some decisions (Query Layer, Planner Interface) were made mid-sprint. Capturing them after implementation required reconstructing context.

---

## Technical Debt

See [TECH_DEBT.md](./TECH_DEBT.md) for full details.

### Resolved This Sprint
- ~~Planner Interface~~ — WO-S1-007

### Carried Forward
- Renderer Registry (Sprint 2)
- Entity Map (Sprint 3)
- AI Planner (Sprint 3)
- Worker Runtime (Sprint 5)
- Server Runtime (Sprint 6)
- Replay / Undo / Snapshot (Sprint 4+)

---

## Sprint 2 Recommendations

1. **Upgrade Node.js** to v20 or v22 to enable latest tooling
2. **Prompt Builder** — First AI integration step. Build prompt templates for converting natural language to actions.
3. **OpenAI Planner** — Implement `Planner` interface using OpenAI API as first real AI planner.
4. **Planner Tests** — Add test suite for Planner implementations.
5. **Streaming Planner** — Support partial/streaming action generation for responsive UX.
6. **Memory Interface** — Prepare conversation memory abstraction for context-aware planning.

See [SPRINT2_BACKLOG.md](./SPRINT2_BACKLOG.md) for detailed backlog.