# AI Development Standard

> Project Genesis — Permanent engineering workflow for AI-assisted development.
> **Version:** 1.0

---

## 1. Purpose

This document defines the permanent engineering workflow used by AI coding agents for Project Genesis.

Every future Work Order should reference this document instead of repeating engineering constraints in Work Order descriptions.

The goal is consistency: regardless of which AI agent implements a Work Order, the development process, documentation format, and delivery standards remain the same.

---

## 2. Development Principles

### Architecture First

Before writing any code, understand the full architecture. Read:
- `PROJECT_STATE.md` — current project status and completed work
- `AI_ARCHITECTURE.md` — architecture reference and component responsibilities
- All relevant ADRs — architectural decisions and their rationale
- `TECH_DEBT.md` — known deferred improvements

### Backward Compatibility

Never break existing interfaces. New capabilities must be:
- Additive (new optional parameters, new methods, new interfaces)
- Non-breaking (existing tests must pass without modification)
- Backward compatible (existing constructors, method signatures unchanged)

### Foundation Before Feature

Build abstractions in layers:
1. **Interface** — define the contract
2. **Default implementation** — simplest possible working version
3. **Integration** — wire into the pipeline
4. **Real implementation** — replace default with production-ready logic

Each Work Order should be scoped to exactly one of these layers.

### Composition Over Modification

Prefer:
- New interfaces over modifying existing ones
- New classes over modifying existing classes
- New modules over modifying existing modules
- Decorator/wrapper patterns over inheritance

Avoid:
- Modifying stable, tested components for new capabilities
- Adding if/else chains to existing code
- Breaking existing abstractions

### Single Responsibility

Each component owns exactly one responsibility:
- `PromptModule` — produces prompt fragments
- `PromptBuilder` — orchestrates the pipeline
- `PromptRenderer` — converts context to string
- `PromptCompression` — cleans/strips context
- `PromptBudget` — measures section sizes
- `MemoryRanking` — determines section priority
- `Planner` — routes requests to providers
- `AgentLoop` — multi-step execution
- `Reflection` — evaluates planning results

Never merge responsibilities. Never duplicate responsibilities.

### No Temporary Hacks

- No `TODO`, `FIXME`, `HACK`, or `XXX` comments in production code
- If a shortcut is necessary, create a `TECH_DEBT.md` entry instead
- Deferred work must have a clear "Suggested Sprint" and rationale

### No Dead Code

- Remove imports, variables, and functions that YOUR changes made unused
- Do not remove pre-existing dead code unless asked — but mention it
- Every line of code must trace directly to a requirement

### Immutable Preferred

- Functions should return new objects, not modify inputs
- `compress()` returns a new `PromptContext`
- `rank()` returns a new `MemoryRankingResult`
- `calculate()` returns a new `PromptBudgetResult`
- Pure functions are preferred over stateful objects

### Pure Functions Preferred

Components in the Prompt Pipeline should be:
- **Deterministic** — same input always produces same output
- **Side-effect free** — no mutation of inputs, no I/O
- **Idempotent** — calling twice produces the same result as calling once

### Architecture Review Required

Every completed Work Order should be reviewed before proceeding to the next Work Order.

The review should verify:
- **Architecture consistency** — Does the change follow the established layer model?
- **Dependency direction** — Are all dependencies one-way? No circular dependencies?
- **Responsibility boundaries** — Does each component still own exactly one responsibility?
- **Future extensibility** — Does the change block or enable future extensions?
- **Technical debt impact** — Does the change introduce new debt or resolve existing debt?

Review output: a brief architecture review section in the delivery report, or a formal `REVIEW.md` for complex changes.

---

## 3. Testing Requirements

Every Work Order must verify the following before delivery:

| Requirement | Command | Expected |
|-------------|---------|----------|
| TypeScript | `tsc --noEmit` | 0 errors |
| ESLint | `eslint . --ext .ts` | 0 errors (warnings acceptable) |
| Vitest (AI) | `pnpm test` (in `packages/ai`) | All tests pass |
| Vitest (Web) | `pnpm test` (in `apps/web`) | All tests pass |
| Backward Compatibility | Verify existing test count unchanged | All existing tests pass |

New tests must cover at least:
- Interface conformance
- Default implementation behavior
- Integration with existing components
- Edge cases (empty, null, undefined)
- Backward compatibility (existing behavior unchanged)
- Compatibility with all existing Planner variants (MockPlanner, RetryPlanner, ToolCallPlanner)
- Compatibility with Streaming path
- Compatibility with AgentLoop + Reflection

---

## 4. Documentation Requirements

Every architecture-related Work Order must update:

| Document | When to Update |
|----------|----------------|
| `ADR` | New architecture decision, interface, or abstraction |
| `PROJECT_STATE.md` | Every completed Work Order |
| `AI_ARCHITECTURE.md` | New component, changed flow, or new section |
| `CHANGELOG.md` | Every completed Work Order — full entry with test counts |

`TECH_DEBT.md` should only be updated when:
- A previously deferred item is completed (mark as Resolved)
- A new deliberate trade-off is introduced

---

## 5. Work Order Requirements

Every Work Order should contain:

1. **Goal** — What this Work Order achieves
2. **Scope** — What is included and what is explicitly excluded
3. **Constraints** — Architecture rules that must be followed
4. **Acceptance Criteria** — Verifiable conditions for completion
5. **Deliverables** — Expected output (files, tests, documentation)

---

## 6. Delivery Format

Standard delivery report:

1. **Changed Files** — All new and modified files
2. **Architecture** — Explanation of the architecture or change
3. **Flow** — Data/control flow through the system
4. **Compatibility Analysis** — Impact on each existing component
5. **Test Summary** — Test groups, counts, and results
6. **Build Status** — TypeScript, ESLint, Vitest results
7. **Documentation Updates** — ADR, PROJECT_STATE, AI_ARCHITECTURE, CHANGELOG
8. **Remaining Risks** — Known issues, deferred work

---

## 7. Versioning

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Sprint 4 | Initial standard — WO-S4-000 |
| 1.1 | Sprint 4 | Added Architecture Review Required principle |

---

## References

- `docs/project/ARCHITECTURE_PRINCIPLES.md` — Permanent architecture rules
- `docs/project/PROJECT_STATE.md` — Current project state
- `docs/project/AI_ARCHITECTURE.md` — Architecture reference
- `docs/project/TECH_DEBT.md` — Known deferred improvements