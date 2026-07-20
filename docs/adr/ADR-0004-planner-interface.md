# ADR-0004: Planner Interface

**Status:** Accepted  
**Date:** Sprint 1  
**Architecture Version:** v0.3  

---

## Context

The original `mockPlanner` was a standalone function directly imported by the UI:

```typescript
import { mockPlanner } from '../planner/mockPlanner'
const actions = mockPlanner(input)
```

This created a tight coupling between the UI and one specific implementation. Future AI planners (OpenAI, Claude, Gemini, local models) all require different implementations but should share the same contract.

Without a formal interface:
- Swapping planners requires changing import statements
- No type-level contract for planner implementations
- Cannot inject planners via dependency injection
- Testing with different planner strategies is cumbersome

---

## Decision

Define a `Planner` interface in `packages/ai`:

```typescript
interface Planner {
  plan(input: string): Promise<Action[]>
}
```

Refactor `mockPlanner` into `MockPlanner` class implementing `Planner`.

UI depends only on the interface:

```typescript
import type { Planner } from '@genesis/ai'
import { MockPlanner } from '@genesis/ai'

const planner: Planner = new MockPlanner()
const actions = await planner.plan(input)
```

---

## Consequences

**Positive:**
- UI depends on interface, not implementation
- New planners (OpenAI, Claude, etc.) need only implement `Planner`
- Planners can be swapped without changing consumer code
- Async from day one, ready for LLM calls
- Planner lives in `packages/ai`, the correct layer

**Negative:**
- `MockPlanner.plan()` returns a Promise even though it's synchronous
- Slightly more indirection for the simple mock case

**Neutral:**
- Old `mockPlanner.ts` removed, no dead code
- `send()` in gameStore became async, but Vue handles this transparently