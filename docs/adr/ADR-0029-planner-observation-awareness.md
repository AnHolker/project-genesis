# ADR-0029: Planner Observation Awareness

**Status:** Accepted  
**Date:** Sprint 3  
**Work Order:** WO-S3-012  
**Architecture Version:** v0.16

---

## Context

After WO-S3-011 (Structured Observation Context), observations became structured data (`Observation[]`) passed through `AIRequest.metadata.observations`. However, the prompt formatting of observations was still handled by the `DefaultAgentLoop`:

```
AgentLoop iteration:
  ├── Attach Observation[] to request.metadata.observations
  ├── planner.plan(request) → PlannerResult
  ├── Execute tools → Create Observation[]
  └── AgentLoop formats observations into prompt text (OWNED FORMATTING)
```

This violated the principle that **PromptBuilder is the sole owner of prompt organization**. The AgentLoop had dual responsibilities: maintaining observation state AND formatting observation text.

### Problems

1. **Fragmented prompt logic** — Observation formatting existed in two places: AgentLoop (inline) and nowhere (PromptBuilder didn't know about observations)
2. **No canonical formatter** — The `Observation:` prefix format was hardcoded in AgentLoop, not reusable
3. **Hard to extend** — Changing observation formatting required editing AgentLoop source
4. **Architecture inconsistency** — PromptBuilder owned all other prompt sections (system, user, memory, world state) but not observations

### Constraints

1. **Planner interface unchanged** — `Planner.plan(request): Promise<PlannerResult>` must remain as-is
2. **No Planner/Provider modifications** — Planner, PlannerProvider, ToolCallPlanner, RetryPlanner unchanged
3. **No Pipeline modifications** — Pipeline.execute() and stream() unchanged
4. **No Runtime modifications**
5. **No Renderer modifications**
6. **Observation lifecycle stays in AgentLoop** — AgentLoop maintains `Observation[]` and writes to `request.metadata.observations`
7. **Backward compatible** — all existing tests continue passing without modification
8. **Provider completely unaware of Observation** — Provider only receives the final prompt

---

## Decision

### 1. ObservationPromptModule

Create a new `ObservationPromptModule` in `packages/ai/src/prompt/modules/ObservationPromptModule.ts`:

```typescript
class ObservationPromptModule implements PromptModule {
  async build(context: PipelineContext): Promise<string> { ... }
}
```

- Reads `PipelineContext.metadata?.observations` 
- Formats them using the canonical `formatObservations()` function
- Returns empty string when no observations exist

### 2. formatObservations (Rich Format)

The canonical `formatObservations()` function produces a structured, human-readable format:

```
## Previous Observations

Iteration 1

Tool:
find_entity

Input:
{"id":"e1"}

Output:
{"found":true}

Success:
true
```

- **Rich format** — Used by `ObservationPromptModule` for inclusion in the full prompt
- **Single source of truth** — All observation-to-prompt formatting lives here

### 3. formatObservationsInline (Compact Format)

The `formatObservationsInline()` function produces a compact format for AgentLoop iteration:

```
Observation:
Tool find_entity returned: {"found":true}
```

- **Compact format** — Used by `DefaultAgentLoop` to append new observations between iterations
- **Backward compatible** — Matches the previous AgentLoop inline format exactly

### 4. DefaultPromptBuilder Gateway

`DefaultPromptBuilder` exposes `formatObservations(observations): string` as an instance method:

```typescript
class DefaultPromptBuilder {
  formatObservations(observations: Observation[]): string { ... }
}
```

- Delegates to the same implementation as `ObservationPromptModule`
- Provides a canonical API for any component that needs observation formatting
- Ensures consistency between PromptModule formatting and ad-hoc formatting

### 5. AgentLoop Delegation

`DefaultAgentLoop` no longer does inline prompt formatting. Instead:

```
Before (AgentLoop owned formatting):
  const observationText = `Tool ${toolCall.name} returned: ${JSON.stringify(output)}`
  promptObservations.push(observationText)
  ...
  request.prompt = `${prompt}\n\nObservation:\n${promptText}`

After (AgentLoop delegates to PromptBuilder):
  import { formatObservationsInline } from '../prompt/modules/ObservationPromptModule'
  ...
  const promptText = formatObservationsInline(iterationObservations)
  request.prompt = `${prompt}\n\n${promptText}`
```

- AgentLoop only: maintains `Observation[]`, writes to `request.metadata.observations`, calls `formatObservationsInline`
- PromptBuilder owns: the formatting logic, format string, and prompt organization
- Provider receives only the final prompt, completely unaware of Observation

### 6. Data Flow

```
Pipeline.execute()
  ↓
PromptBuilder.build(context)          ← includes ObservationPromptModule
  ↓                                   ← formats metadata.observations into rich "## Previous Observations" section
AIRequest { prompt, metadata.observations }
  ↓
AgentLoop.execute()
  ↓
For each iteration:
  ├── request.metadata.observations = accumulated Observation[]
  ├── planner.plan(request) → PlannerResult
  ├── Execute tools → Observation[]
  ├── Append to accumulated Observation[]
  └── request.prompt += formatObservationsInline(newObservations)  ← PromptBuilder logic
  ↓
PlannerResult → PipelineContext
```

### 7. Package Structure

```
packages/ai/src/prompt/modules/
  ObservationPromptModule.ts         ← NEW: PromptModule + formatObservations + formatObservationsInline
  PromptModule.ts                    ← Unchanged
  UserInputModule.ts                 ← Unchanged
  MemoryPromptModule.ts              ← Unchanged
  SystemPromptModule.ts              ← Unchanged
  WorldStatePromptModule.ts          ← Unchanged
  index.ts                           ← Updated: exports new module and functions

packages/ai/src/prompt/
  PromptBuilder.ts                   ← Unchanged
  DefaultPromptBuilder.ts            ← Updated: imports/exposes formatObservations
  index.ts                           ← Updated: exports new module and functions

packages/ai/src/agent/
  DefaultAgentLoop.ts                ← Updated: imports and calls formatObservationsInline
  Observation.ts                     ← Unchanged
  AgentLoop.ts                       ← Unchanged
  AgentLoopContext.ts                 ← Unchanged
  AgentLoopResult.ts                  ← Unchanged
  AgentLoopStep.ts                    ← Unchanged
  index.ts                           ← Unchanged

packages/ai/src/
  index.ts                           ← Updated: exports new module and functions
```

---

## Consequences

**Positive:**
- PromptBuilder is now the sole owner of all prompt organization
- Observation formatting is canonical — one implementation, reusable everywhere
- AgentLoop responsibility is clean: maintain state, delegate formatting
- Format changes only require editing `ObservationPromptModule.ts`
- All formatting functions are exported and testable independently
- Provider remains completely unaware of Observation

**Negative:**
- Additional indirection: AgentLoop now imports from PromptBuilder module
- Two formatting functions (rich + compact) instead of one
- formatObservationsInline is a compact format primarily for AgentLoop backward compatibility

**Neutral:**
- Existing tests (473) pass with zero modifications
- 29 new tests added covering all formatting and compatibility paths
- All public APIs remain unchanged

---

## References

- ADR-0027: Multi-Step Agent Loop
- ADR-0028: Structured Observation Context
- WO-S3-010: Multi-Step Agent Loop
- WO-S3-011: Structured Observation Context
- WO-S3-012: Planner Observation Awareness (this Work Order)