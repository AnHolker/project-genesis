# ADR-0048: Intent Analysis Foundation

**Status:** Accepted  
**Date:** Sprint 5  
**Work Order:** WO-S5-001  
**Architecture Version:** v0.36

---

## Context

The Prompt Assembly pipeline (v0.35 Frozen) treats all user input as raw natural language. There is no abstraction layer between the user's natural language and the Planner's action-oriented prompt.

The pipeline currently flows:

```
User Natural Language
    ↓
PipelineContext { input: string }
    ↓
PromptBuilder → AIRequest { prompt: string }
    ↓
Planner → PlannerResult { actions: Action[] }
```

There is no representation of *what the user intends* — only raw text. Every downstream component must re-parse the user's intent from scratch.

### Problem

1. **No semantic bridge** — Natural language goes directly into prompts with no intermediate intent representation
2. **No reusable intent abstraction** — Planner, Reflection, and AgentLoop each interpret user input independently
3. **No single source of truth for "what the user wants"** — Each component duplicates intent detection logic
4. **No foundation for future semantic understanding** — LLM-based intent analysis, intent routing, and intent-aware planning have no abstraction to plug into

### Constraints

1. **Foundation only** — This WO establishes the abstraction. No planner integration, no LLM integration, no runtime integration.
2. **No breaking changes** — All existing interfaces unchanged. No modifications to existing components.
3. **No dependencies on Planner, Runtime, Provider, Memory, ToolCalling, or AgentLoop** — IntentAnalyzer must be completely independent.
4. **Interface-first** — IntentAnalyzer defines the contract; DefaultIntentAnalyzer is the simplest valid implementation.
5. **Pure, stateless, deterministic** — Same input always produces same output. No side effects.
6. **Immutable** — All types are readonly. No mutation of inputs.
7. **Extensible** — IntentType is a string union (additive). Intent can carry optional payload in the future.

---

## Decision

### 1. New Module: `packages/ai/src/intent/`

A new top-level directory under `@genesis/ai` containing:

| File | Type | Purpose |
|------|------|---------|
| `IntentType.ts` | String union | User intention categories (Create, Delete, Move, Modify, Query) |
| `Intent.ts` | Interface | Singleton intent with type discriminator |
| `IntentResult.ts` | Interface | Container for multiple intents |
| `IntentAnalyzer.ts` | Interface | Contract for extracting intents from natural language |
| `DefaultIntentAnalyzer.ts` | Class | Placeholder implementation (empty result) |
| `index.ts` | Exports | Barrel export for all intent types |

### 2. IntentType — String Union

```typescript
type IntentType = 'Create' | 'Delete' | 'Move' | 'Modify' | 'Query'
```

- **String union** — Extensible by adding new literal types. No modification needed for existing code.
- **5 foundation types** — Cover core user intentions for Project Genesis:
  - `Create` — User wants to create something (entity, object, etc.)
  - `Delete` — User wants to remove something
  - `Move` — User wants to relocate something
  - `Modify` — User wants to change properties of something
  - `Query` — User wants to retrieve information about something

### 3. Intent — Immutable Data Object

```typescript
interface Intent {
  readonly type: IntentType
}
```

- **Pure data** — No methods, no behavior, no logic
- **readonly** — Immutable by design
- **Minimal** — Future optional payload field can be added without breaking changes

### 4. IntentResult — Multiple Intents

```typescript
interface IntentResult {
  readonly intents: Intent[]
}
```

- Supports multiple intents from a single input (e.g., "draw a tree and a flower" → 2 Create intents)
- Empty array is valid (when no intent could be determined)
- readonly — immutable by design

### 5. IntentAnalyzer — Interface

```typescript
interface IntentAnalyzer {
  analyze(input: string): IntentResult
}
```

- Single-method interface
- Accepts natural language input, returns IntentResult
- Implementations MUST be pure, deterministic, and side-effect free
- No dependencies on any other component
- Future implementations: RuleBasedIntentAnalyzer, HeuristicIntentAnalyzer, LLMIntentAnalyzer

### 6. DefaultIntentAnalyzer — Placeholder

```typescript
class DefaultIntentAnalyzer implements IntentAnalyzer {
  analyze(_input: string): IntentResult {
    return { intents: [] }
  }
}
```

- Returns empty `{ intents: [] }` for every input
- No parsing, no AI, no heuristics, no runtime
- Serves as the default/default implementation for the interface
- All future implementations must produce the same type (IntentResult)

### 7. No Integration

This WO does NOT integrate IntentAnalyzer with:
- PromptBuilder — No new PipelineAssembly stage
- Planner — Planner still receives raw natural language
- Pipeline — PipelineContext unchanged
- AgentLoop — No intent-aware loop behavior
- Reflection — Reflection does not consume intent
- BuilderOptions — No `intentAnalyzer` field added

Integration with PromptBuilder (Intent → PromptAssembly) is deferred to a future Work Order.

---

## Consequences

**Positive:**
- Well-defined intent abstraction for future semantic understanding
- All existing code continues unchanged — no interface modifications
- Default implementation uses zero dependencies (empty result only)
- Intent is testable in isolation (no dependencies)
- Pure function contract (no side effects, no mutation)
- Provider-agnostic — works identically with Mock, OpenAI, DeepSeek
- Future RuleBasedIntentAnalyzer, LLMIntentAnalyzer can slot in via same interface
- String union IntentType allows additive extension without breaking changes
- Complete backward compatibility preserved — no existing tests modified

**Negative:**
- No integration yet — IntentAnalyzer must be manually wired in future WOs
- DefaultIntentAnalyzer is a no-op (always returns empty result)

**Neutral:**
- Intent, IntentType, IntentResult, IntentAnalyzer, DefaultIntentAnalyzer added to public API
- Architecture version bumped to v0.36

---

## Future Work (Not Implemented)

| Capability | Description |
|-----------|-------------|
| RuleBasedIntentAnalyzer | Keyword-based intent detection (e.g., "create" → Create, "move" → Move) |
| LLMIntentAnalyzer | LLM-based semantic intent analysis |
| Intent → PromptAssembly | Inject Intent into PromptContext for Planner awareness |
| Intent Routing | Route intents to different planners or executors |
| Intent Payload | Add target/targetType fields to Intent for data-carrying intents |
| Multi-Intent Decomposition | Structured decomposition of multi-intent inputs |

---

## References

- ADR-0032: Structured Prompt Context
- ADR-0037: Prompt Assembly Integration
- ADR-0047: Sprint 4 Freeze
- WO-S5-001: Intent Analysis Foundation (this Work Order)
- `docs/project/AI_ARCHITECTURE.md` — Architecture reference
- `docs/project/PROJECT_STATE.md` — Current project state