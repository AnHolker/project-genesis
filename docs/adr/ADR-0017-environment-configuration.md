# ADR-0017: Environment Configuration

**Status:** Accepted  
**Date:** Sprint 2  
**Architecture Version:** v0.8

---

## Context

Before environment configuration, `AIConfiguration` was constructed manually in application code:

```typescript
const config: AIConfiguration = {
  provider: 'openai',
  model: 'gpt-4o-mini',
  apiKey: '...',
  temperature: 0.2,
  maxTokens: 800,
}
```

This created two problems:

1. **Switching providers required code changes** — changing from mock to OpenAI meant editing source code, rebuilding, and redeploying. Not viable for development workflows where developers frequently switch between mock and real providers.

2. **Secrets in source** — API keys would be hardcoded or managed outside the standard Vite environment variable flow. Vite's `import.meta.env` is the standard mechanism for browser-exposed configuration in Vue 3 apps.

3. **No defaults per provider** — Each provider has sensible default models (e.g., `gpt-4o-mini` for OpenAI, `deepseek-chat` for DeepSeek). Without a configuration function, every call site needed to know these defaults.

---

## Decision

Introduce `createAIConfiguration(env?)` — a factory function that reads `VITE_AI_*` environment variables and produces a complete `AIConfiguration`:

```typescript
function createAIConfiguration(env: Record<string, string | undefined> = {}): AIConfiguration
```

Mapped variables:
- `VITE_AI_PROVIDER` → `provider` (default: `"mock"`)
- `VITE_AI_API_KEY` → `apiKey`
- `VITE_AI_MODEL` → `model` (default: provider-specific)
- `VITE_AI_BASE_URL` → `baseURL`
- `VITE_AI_TEMPERATURE` → `temperature` (default: `0.2`)
- `VITE_AI_MAX_TOKENS` → `maxTokens` (default: `800`)

Default models per provider:
- `"mock"` → `"mock"`
- `"openai"` → `"gpt-4o-mini"`
- `"deepseek"` → `"deepseek-chat"`

The function is called at the composition root (`gameStore.ts`):

```typescript
const config = createAIConfiguration(import.meta.env)
const provider = ProviderFactory.create(config)
```

When environment variables are not set, it falls back to `DefaultAIConfiguration` (mock provider).

---

## Consequences

**Positive:**
- Provider selection without code changes — set `VITE_AI_PROVIDER=openai` in `.env.local`
- API keys never appear in source code — loaded from Vite environment
- Provider-specific model defaults — developers don't need to memorize model names
- Consistent with Vite's `import.meta.env` convention

**Negative:**
- Configuration is read once at startup — runtime changes require page reload
- `import.meta.env` exposes values to the browser — API keys are visible in client bundle (unavoidable for browser-side AI calls; server-side proxy would be needed for production)
- Numeric parsing (`Number(env.VITE_AI_TEMPERATURE)`) — no validation of invalid numeric strings

**Neutral:**
- The function is a pure mapping — no side effects, no async
- Defaults are centralized in one function rather than scattered across providers
