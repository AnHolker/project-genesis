# ADR-0047: Sprint 4 Freeze

**Status:** Accepted  
**Date:** Sprint 4  
**Work Order:** WO-S4-012  
**Architecture Version:** v0.35

---

## Context

Sprint 4 has completed the full Prompt Assembly pipeline. Over 13 Work Orders, the architecture evolved from a 3-stage pipeline (budget → compress → render) to a 6-stage pipeline (rank → budget → providerBudget → select → compress → render).

The pipeline is now considered stable:

- All interfaces are frozen
- Backward compatibility is verified
- 1124 tests pass with zero errors
- Architecture review confirmed no defects

The architecture is ready to be frozen for Sprint 4, allowing Sprint 5 to build on a stable foundation.

### Completed Work

| Layer | Sprint WO | Status |
|-------|-----------|--------|
| Prompt Selection | WO-S4-001 → WO-S4-002 | Stable |
| Prompt Compression Consumption | WO-S4-003 | Stable |
| Prompt Budget Token Estimation | WO-S4-004 | Stable |
| Provider Budget | WO-S4-005 → WO-S4-006 | Stable |
| AI Configuration | WO-S4-007 → WO-S4-008 | Stable |
| BuilderOptions | WO-S4-009 → WO-S4-010 | Stable |
| Architecture Review | WO-S4-011 | Complete |

---

## Decision

### 1. Freeze All Sprint 4 Interfaces

The following interfaces are frozen and must not be modified without a new ADR:

| Interface | File | Status |
|-----------|------|--------|
| `PromptBuilder` | `PromptBuilder.ts` | Frozen |
| `PromptRenderer` | `PromptRenderer.ts` | Frozen |
| `PromptCompression` | `PromptCompression.ts` | Frozen |
| `MemoryRanking` | `MemoryRanking.ts` | Frozen |
| `PromptBudget` | `PromptBudget.ts` | Frozen |
| `ProviderBudget` | `ProviderBudget.ts` | Frozen |
| `PromptSelection` | `PromptSelection.ts` | Frozen |
| `AIConfiguration` | `config/AIConfiguration.ts` | Frozen |
| `BuilderOptions` | `BuilderOptions.ts` | Frozen |

### 2. Extension Strategy (No Modification Required)

All future capabilities slot into existing interfaces without modification:

| New Capability | Interface | Mechanism |
|---------------|-----------|-----------|
| TokenCompression | `PromptCompression` | New class, same interface |
| HeuristicRanking | `MemoryRanking` | New class, same interface |
| EmbeddingRanking | `MemoryRanking` | New class, same interface |
| LLMRanking | `MemoryRanking` | New class, same interface |
| TokenBudget | `PromptBudget` | New class, same interface |
| DynamicBudget | `ProviderBudget` | New class, same interface |
| MarkdownRenderer | `PromptRenderer` | New class, same interface |
| LLMSelection | `PromptSelection` | New class, same interface |

All new implementations inject via `BuilderOptions` fields — no constructor changes needed.

### 3. AIConfiguration Extension (Additive Only)

Future configuration fields:

- Must be optional (`field?: type`)
- Must not change existing field types
- Must not change default behavior when undefined
- Should follow existing naming conventions (`camelCase`)

### 4. Architecture Baseline

The architecture baseline for Sprint 5 is:

- **Architecture Version:** v0.35
- **Total Tests:** 1,124 (1,109 AI + 15 Web)
- **TypeScript Errors:** 0
- **ESLint Errors:** 0

### 5. Documentation Baseline

Sprint 4 final documentation set:

```
docs/
├── project/
│   ├── AI_DEVELOPMENT_STANDARD.md    — Development workflow (v1.0)
│   ├── ARCHITECTURE_PRINCIPLES.md    — Architecture rules (v1.0)
│   ├── PROJECT_STATE.md              — Current state (v0.35, frozen)
│   ├── AI_ARCHITECTURE.md            — Architecture reference
│   ├── CHANGELOG.md                  — Full changelog (S4 complete)
│   ├── TECH_DEBT.md                  — Known technical debt
│   ├── SPRINT4_REVIEW.md             — Sprint review (NEW)
│   ├── SPRINT4_ARCHITECTURE_REVIEW.md— Architecture review (NEW)
│   └── SPRINT5_BACKLOG.md            — Future work backlog (NEW)
├── adr/
│   ├── ADR-0038 through ADR-0047     — Sprint 4 decisions
│   └── ... (previous ADRs)
```

---

## Consequences

**Positive:**

- Sprint 4 is officially frozen with a clean, well-documented baseline
- All interfaces are stable and support future extension without modification
- Sprint 5 can begin without backward compatibility concerns
- Architecture review confirmed no defects — high confidence in pipeline stability
- Extension strategy documented and understood

**Negative:**

- No new runtime behavior changes in Sprint 4
- Sprint 5 will need to implement deferred features (TokenCompression, etc.)

**Neutral:**

- Architecture version bumped to v0.35
- Project state updated to reflect Frozen status
- Sprint 5 backlog established with priorities

---

## Future Work

See `docs/project/SPRINT5_BACKLOG.md` for full backlog.

Key Sprint 5 candidates:
- TokenCompression (real tokenizer) — P1
- Planner-Level Reflection Consumption — P1
- Entity Map — P2
- Conversation Persistence — P2

---

## References

- ADR-0038: Prompt Selection Foundation
- ADR-0039: Prompt Selection Consumption
- ADR-0040: Prompt Compression Consumption
- ADR-0041: Prompt Budget Token Estimation
- ADR-0042: Provider Budget Foundation
- ADR-0043: Provider Budget Consumption
- ADR-0044: AI Configuration Foundation
- ADR-0045: AI Configuration Consumption
- ADR-0046: BuilderOptions Foundation & Consumption
- WO-S4-000 through WO-S4-012: All Sprint 4 Work Orders
- `docs/project/SPRINT4_REVIEW.md` — Sprint 4 review
- `docs/project/SPRINT5_BACKLOG.md` — Sprint 5 backlog