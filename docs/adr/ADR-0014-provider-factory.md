# ADR-0014: Provider Factory

**Status:** Accepted  
**Date:** Sprint 2  
**Architecture Version:** v0.7

---

## Context

After introducing three `PlannerProvider` implementations (Mock, OpenAI, DeepSeek), the application code needed to manually construct the correct provider:

```typescript
// Before — manual construction
const provider = new OpenAIPlannerProvider(config)
const planner = new MockPlanner(provider)
```

or:

```typescript
const provider = new DeepSeekPlannerProvider(config)
const planner = new MockPlanner(provider)
```

This creates several problems:

1. **Consumer knows concrete types** — every call site must import and construct the specific provider class.
2. **Selection logic is duplicated** — any place that switches providers must repeat the same `if/else` or `switch` logic.
3. **Adding a provider touches many files** — a new provider requires updating every construction site.
4. **Configuration and construction are coupled** — the consumer must understand which provider requires which configuration fields.

## Decision

Introduce `ProviderFactory` — a static factory that constructs the correct `PlannerProvider` from `AIConfiguration`:

```typescript
class ProviderFactory {
  static create(config: AIConfiguration): PlannerProvider {
    switch (config.provider) {
      case 'mock':     return new MockPlannerProvider(config)
      case 'openai':   return new OpenAIPlannerProvider(config)
      case 'deepseek': return new DeepSeekPlannerProvider(config)
      default:         throw new Error(`Unknown AI provider: ${config.provider}`)
    }
  }
}
```

Application code now uses:

```typescript
const provider = ProviderFactory.create(config)
const planner = new MockPlanner(provider)
```

The consumer only depends on `PlannerProvider` (interface) and `ProviderFactory`. It no longer imports or knows concrete provider classes.

### Why a static factory, not a dependency injection framework?

- The provider list is small and known at compile time.
- No runtime registration or plugin discovery is needed.
- A `switch` statement is explicit, readable, and easy to audit.
- Introducing a DI framework or service locator would add complexity disproportionate to the problem size.

### Why not a provider registration map?

A `Map<string, ProviderConstructor>` would allow providers to self-register:

```typescript
ProviderFactory.register('claude', ClaudePlannerProvider)
```

This was rejected because:
- The provider count is currently 3 — registration overhead is unjustified.
- Registration hides the full provider list (scattered across files).
- Static analysis (dead code elimination, import verification) becomes harder.
- The switch statement can be upgraded to a map if the count grows beyond ~6 providers.

## Consequences

**Positive:**
- Single point of provider construction — adding a provider requires changing one file
- Consumer code depends only on `PlannerProvider` interface and `ProviderFactory`
- Unknown provider names produce a clear error instead of silent fallback
- `AIConfiguration.provider` is the single source of truth for provider selection
- Simple and explicit — no framework overhead

**Negative:**
- Adding a provider still requires modifying `ProviderFactory` (Open-Closed Principle violation)
- Static factory is not mockable without overriding module imports in tests
- The `switch` statement grows linearly with provider count

**Neutral:**
- Factory returns `PlannerProvider` — consumers never see concrete types
- Configuration validation (e.g., `apiKey` required for OpenAI) remains in each provider's constructor
- Factory is stateless — no lifecycle management needed
