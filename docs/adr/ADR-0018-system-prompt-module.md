# ADR-0018: System Prompt Module

**Status:** Accepted  
**Date:** Sprint 2  
**Architecture Version:** v0.8

---

## Context

Before SystemPromptModule, the system prompt was hardcoded inside each LLM provider:

- `OpenAIPlannerProvider` contained a 26-line `SYSTEM_PROMPT` constant, passed as `instructions` parameter to the Responses API
- `DeepSeekPlannerProvider` contained an identical 26-line `SYSTEM_PROMPT` constant, passed as the first `messages[]` entry

This created three problems:

1. **Duplication** — The same prompt text existed in two files. Editing action schemas or output format instructions required updating both providers identically.

2. **Prompt ownership in the wrong layer** — Providers are responsible for calling LLM APIs, not for defining prompt content. The system prompt is a *prompt composition* concern, not an *API integration* concern. It belongs in the PromptBuilder pipeline.

3. **Provider coupling to prompt format** — Changing the system prompt wording or adding a new action description required modifying provider source code. Providers should be agnostic to prompt content — they receive a prompt string and return a PlannerResult.

---

## Decision

Extract the system prompt into `SystemPromptModule` — a `PromptModule` implementation that lives in the prompt pipeline:

```typescript
class SystemPromptModule implements PromptModule {
  async build(_context: PipelineContext): Promise<string> {
    return SYSTEM_PROMPT
  }
}
```

The system prompt text (action schema, JSON format requirements) moves from providers into the module. Providers no longer maintain any prompt content:

- `OpenAIPlannerProvider` — removed `instructions: SYSTEM_PROMPT` parameter; sends only `request.prompt` as input
- `DeepSeekPlannerProvider` — removed system message from `messages[]` array; sends only `request.prompt` as user content

The system prompt is now wired as the **first module** in `DefaultPromptBuilder` at the composition root:

```typescript
new DefaultPromptBuilder([
  new SystemPromptModule(),   // 1st — system instructions
  new UserInputModule(),      // 2nd — user input
  new MemoryPromptModule(),   // 3rd — conversation history
  new WorldStatePromptModule(),// 4th — world snapshot
])
```

---

## Consequences

**Positive:**
- Zero duplication — system prompt exists in one file
- Prompt ownership moves to the correct layer — PromptBuilder pipeline, not providers
- Adding action descriptions or changing format requires editing one module, not N providers
- Providers become pure API adapters — receive prompt string, return PlannerResult
- Prompt composition order is explicit and visible at the composition root

**Negative:**
- DeepSeek no longer sends a system message — the system prompt is included in the user content. This may slightly reduce instruction-following quality for models that weight system messages higher than user messages. Acceptable: DeepSeek's Chat Completions API does support system messages, but the unified pipeline approach (one prompt string) is simpler and more consistent across providers.
- OpenAI no longer uses the `instructions` parameter — the system prompt is part of the `input` string. The Responses API treats `instructions` as system-level context, but since the full prompt is composed before reaching the provider, using `input` alone is sufficient.

**Neutral:**
- SystemPromptModule ignores `PipelineContext` — the system prompt is static (same text every call). Future dynamic system prompts would read from context.
- Module order matters — SystemPromptModule must be first so the LLM sees instructions before user content.
