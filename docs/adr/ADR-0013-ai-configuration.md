# ADR-0013: AI Configuration

**Status:** Accepted  
**Date:** Sprint 2  
**Architecture Version:** v0.6

---

## Context

Provider implementations lacked a standard configuration contract. Each provider would need:
- Model name or identifier
- Response creativity (temperature)
- Maximum response length (maxTokens)
- API key for authentication

Without a configuration object, these would be passed as separate constructor arguments or environment variables — inconsistent across providers and difficult to manage centrally.

## Decision

Introduce `AIConfiguration` interface:

```typescript
interface AIConfiguration {
  provider: string
  model: string
  temperature: number
  maxTokens: number
  apiKey?: string
}
```

`DefaultAIConfiguration` provides safe defaults for the mock provider:
```typescript
class DefaultAIConfiguration implements AIConfiguration {
  readonly provider = 'mock'
  readonly model = 'mock'
  readonly temperature = 0
  readonly maxTokens = 0
}
```

`MockPlannerProvider` receives configuration via constructor injection. Future providers (OpenAI, Claude, Gemini) will use the same configuration interface.

`apiKey` is optional — mock providers don't require it, and real providers can source it from environment variables at construction time.

## Consequences

**Positive:**
- Uniform configuration across all providers
- Environment-specific configuration can be injected at the composition root
- `apiKey` is never hardcoded in source — sourced externally
- Configuration is type-safe and discoverable

**Negative:**
- Slight constructor verbosity for the mock case
- Configuration is read at construction time — runtime changes require re-creation

**Neutral:**
- DefaultAIConfiguration values are not read during mock execution (zero impact)
- Configuration model can be extended with provider-specific fields via optional properties