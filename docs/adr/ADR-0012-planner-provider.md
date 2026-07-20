# ADR-0012: Planner Provider

**Status:** Accepted  
**Date:** Sprint 2  
**Architecture Version:** v0.6

---

## Context

`MockPlanner` contained all planning logic directly — keyword matching, action creation, and result construction. Future LLM planners (OpenAI, Claude, Gemini) would each require their own implementations but should share the same orchestration contract.

Without a provider abstraction, each planner implementation would duplicate the orchestration layer (error handling, retry logic, logging) or the MockPlanner would grow monolithic if/when multiple planning strategies were combined.

## Decision

Introduce `PlannerProvider` interface:

```typescript
interface PlannerProvider {
  complete(request: AIRequest): Promise<PlannerResult>
}
```

`MockPlannerProvider` implements `PlannerProvider` with the existing keyword matching logic.

`MockPlanner` becomes an orchestration layer:

```typescript
class MockPlanner implements Planner {
  constructor(private readonly provider: PlannerProvider) {}
  
  async plan(request: AIRequest): Promise<PlannerResult> {
    return this.provider.complete(request)
  }
}
```

Planner now delegates planning to the injected provider. The provider is swappable via dependency injection.

## Consequences

**Positive:**
- New LLM providers implement only `PlannerProvider`
- MockPlanner is reusable — routes to any provider
- Orchestration logic (retry, validation, logging) can be added to Planner without modifying providers
- Clear separation: Planner = orchestration, Provider = model integration

**Negative:**
- Additional indirection for the simple mock case
- Each planner still needs a MockPlanner-like wrapper (or MockPlanner becomes generic)

**Neutral:**
- No behavioral change — MockPlannerProvider contains the same logic as before
- Existing MockPlanner tests continue to pass through delegation