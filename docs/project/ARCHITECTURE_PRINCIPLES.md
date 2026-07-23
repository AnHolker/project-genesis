# Architecture Principles

> Project Genesis — Permanent architecture rules for all development.
> **Version:** 1.0

---

## 1. Layering

Architecture layers are strictly ordered. Each layer may only depend on layers below it.

```
User Input
    ↓
Pipeline
    ↓
Prompt Builder
    ↓
Planner
    ↓
Provider
    ↓
Agent Loop
    ↓
Runtime
    ↓
World
```

**Rules:**
- A layer may never import or reference a layer above it
- A layer may only depend on the interfaces of layers below it, not their implementations
- Cross-layer communication flows through `PipelineContext` / `AIRequest` / `PlannerResult` — never through direct imports

---

## 2. Dependency Rules

### One-way Dependencies

Every dependency must be strictly one-way:

```
PromptModule → PromptContext → PromptCompression → PromptRenderer
```

No component may depend on a component that depends on it (directly or transitively).

### No Circular Dependencies

Circular dependencies are forbidden at both the package level and the module level:

- `@genesis/ai` must never import from `@genesis/runtime`
- `@genesis/runtime` must never import from `@genesis/ai`
- Within a package, modules must form a DAG (Directed Acyclic Graph)

### Dependency Inversion Preferred

High-level components should not depend on low-level implementations:

```
Planner (interface) ← Planner depends on interface
    ↑
PlannerProvider (interface) ← Planner uses interface, not concrete class
    ↑
OpenAIPlannerProvider (concrete) ← Concrete implements interface
```

---

## 3. Module Responsibilities

Each module owns exactly one responsibility. No responsibility duplication.

| Module | Responsibility | Must NOT |
|--------|---------------|----------|
| `Pipeline` | AI entry point, lifecycle orchestration | Plan, render, compress |
| `PromptBuilder` | Prompt assembly orchestration | Render strings |
| `PromptRenderer` | PromptContext → string conversion | Compress, rank, budget |
| `PromptCompression` | Clean/strip PromptContext | Render, rank, budget |
| `PromptBudget` | Measure section sizes | Modify context |
| `ProviderBudget` | Look up provider/model capacity | Measure prompts, call SDKs |
| `MemoryRanking` | Determine section priority | Modify context |
| `Planner` | Route requests to provider | Call LLM directly |
| `PlannerProvider` | Communicate with LLM | Plan, validate |
| `AgentLoop` | Multi-step execution control | Plan, call LLM |
| `Reflection` | Evaluate planning results | Modify loop behavior |
| `Tool` | Execute external capabilities | Plan, call LLM |

---

## 4. Extension Strategy

### Prefer Composition Over Modification

When adding a new capability:

1. ✅ **Create a new interface** — defines the capability contract
2. ✅ **Create a default implementation** — simplest possible version
3. ✅ **Inject into existing component** — via constructor parameter
4. ❌ **Do NOT modify existing interfaces** — unless absolutely necessary
5. ❌ **Do NOT add conditional logic to existing components** — prefer decorator/wrapper patterns

### Examples

| Pattern | Good | Bad |
|---------|------|-----|
| Retry | `RetryPlanner` wraps `PlannerProvider` | Add retry logic to `PlannerProvider` |
| Tools | `ToolCallPlanner` wraps `PlannerProvider` | Add tool dispatch to `PlannerProvider` |
| Streaming | `StreamingPlannerProvider` extends `PlannerProvider` | Modify `PlannerProvider` to always stream |
| Compression | Inject `PromptCompression` into `PromptBuilder` | Add compression logic to `PromptRenderer` |

---

## 5. Prompt Pipeline Principles

### Strict Pipeline Order

```
PromptModule
    ↓
PromptContext
    ↓
MemoryRanking        ← pure measurement, does not modify context
    ↓
PromptBudget         ← pure measurement, does not modify context
    ↓
PromptSelection      ← future: conditional section inclusion
    ↓
PromptCompression    ← may modify context (returns new object)
    ↓
PromptRenderer
    ↓
Provider
```

### Rules

- No module may bypass `PromptBuilder` orchestration
- `PromptBuilder` is the **sole orchestrator** of the prompt pipeline
- Ranking and Budget are pure measurements — they never modify `PromptContext`
- Compression is the only transformer — it returns a new `PromptContext`
- Renderer is the only serializer — it converts context to string
- Future components (Selection, Token Compression) must slot into this order

---

## 6. Agent Principles

### Component Responsibilities

| Component | Responsibility | Constraints |
|-----------|---------------|-------------|
| `Planner` | Only plans | Delegates to `PlannerProvider`; never calls LLM directly |
| `PlannerProvider` | Only communicates with LLM | Never plans, never validates |
| `AgentLoop` | Owns execution | Controls iteration, tool calling, observation; never calls LLM |
| `Reflection` | Only observes | Evaluates results; never modifies loop behavior |
| `Tool` | Only executes | Performs a single capability; never plans or calls LLM |

### Data Flow

```
AgentLoop.execute()
    ↓
for each iteration:
    ├── Planner.plan()            ← produces actions
    ├── Check: actions found?     → break
    ├── ToolRegistry.execute()    ← produces observations
    ├── Reflection.evaluate()     ← produces reflection results (recorded, not acted upon)
    └── Append observations to prompt
    ↓
AgentLoopResult
```

---

## 7. Future Evolution

### Expected Extension Points

These extension points are documented but not yet implemented. Future Work Orders should slot into the existing architecture without modifying stable components.

| Extension | Slot | Description |
|-----------|------|-------------|
| **PromptSelection** | Between Budget and Compression | Conditional section inclusion based on context |
| **TokenCompression** | Implements PromptCompression | Token-aware truncation or summarization |
| **MemoryRanking (consumption)** | MemoryPromptModule | Top-K memory selection based on ranking |
| **HeuristicRanking** | Implements MemoryRanking | Score by recency, length, keyword match |
| **EmbeddingRanking** | Implements MemoryRanking | Semantic similarity via embeddings |
| **LLMRanking** | Implements MemoryRanking | LLM-based importance evaluation |
| **TokenBudget** | Implements PromptBudget | Real token counting via tiktoken |
| **ProviderBudget** | Standalone interface | Provider-specific token capacity lookup (implemented in WO-S4-005) |
| **Replay** | Pipeline extension | Deterministic replay from action log |
| **Undo** | Runtime extension | Inverse operations for each Action type |
| **WorldSnapshot** | Pipeline extension | Cached, incremental world state serialization |
| **LLMReflection** | Implements Reflection | LLM-based self-critique |
| **MultiAgent** | Pipeline extension | Multiple agents collaborating |

### Design Principles for Future Extensions

1. Every new capability must implement an existing interface when possible
2. Every new capability must be injectable via constructor parameter
3. Every new capability must be optional with a working default
4. No new capability may modify existing stable interfaces

---

## 8. Versioning

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Sprint 4 | Initial principles — WO-S4-000 |

---

## 9. Governance

The complete project governance flow:

```
Proposal
    ↓
Sprint Planning
    ↓
Work Order (WO)
    ├── Goal & Scope
    ├── Constraints
    └── Acceptance Criteria
    ↓
Implementation (AI Agent)
    ↓
Delivery Report
    ├── Changed Files
    ├── Architecture
    ├── Compatibility
    ├── Tests
    ├── Build Status
    └── Documentation
    ↓
Architecture Review
    ├── Architecture consistency
    ├── Dependency direction
    ├── Responsibility boundaries
    ├── Future extensibility
    └── Technical debt impact
    ↓
ADR (if new architecture decision)
    ↓
Documentation Sync
    ├── PROJECT_STATE.md
    ├── AI_ARCHITECTURE.md
    └── CHANGELOG.md
    ↓
Sprint Freeze
    ├── Sprint Review
    ├── Metrics
    └── Backlog Update
    ↓
Next Sprint
```

### Governance Principles

1. **Proposal-first** — Every Sprint starts with a proposal defining scope, priorities, and dependencies
2. **WO-driven** — Every change is tracked as a Work Order with explicit acceptance criteria
3. **ADR-documented** — Every architecture decision has a formal record
4. **Review-gated** — Every WO is reviewed before the next begins
5. **Freeze-verified** — Every Sprint ends with a verification freeze
6. **Backlog-continuous** — Deferred items move to the next sprint backlog

### Governance Roles

| Role | Responsibility |
|------|---------------|
| AI Agent | Implements the Work Order |
| Architecture Review | Verifies architecture consistency, dependency direction, responsibility boundaries |
| Documentation | Synchronizes all project documents after each WO |
| Sprint Freeze | Verifies completion, creates review, updates backlog |

### Versioning

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Sprint 4 | Initial governance — WO-S4-000 |

---

## References

- `docs/project/AI_DEVELOPMENT_STANDARD.md` — Engineering workflow for AI agents
- `docs/project/AI_ARCHITECTURE.md` — Detailed architecture reference
- `docs/adr/` — All Architecture Decision Records