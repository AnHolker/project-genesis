# ADR-0019: Responses API Migration

**Status:** Accepted  
**Date:** Sprint 2  
**Architecture Version:** v0.8

---

## Context

OpenAIPlannerProvider originally used the Chat Completions API (`client.chat.completions.create()`). OpenAI introduced the Responses API (`client.responses.create()`) as the recommended endpoint for structured output generation.

DeepSeekPlannerProvider uses the Chat Completions API (`client.chat.completions.create()`) via the OpenAI-compatible SDK with a custom `baseURL`.

The question: should both providers use the same API, or should each use its native endpoint?

---

## Decision

Use different API endpoints for each provider:

- **OpenAIPlannerProvider** — migrated to Responses API (`client.responses.create()`)
- **DeepSeekPlannerProvider** — kept on Chat Completions API (`client.chat.completions.create()`)

### Why Responses API for OpenAI

1. **Official recommendation** — OpenAI's SDK documentation positions `responses.create()` as the primary API for structured output generation. Chat Completions is still supported but is no longer the recommended path.

2. **Structured JSON mode** — `text: { format: { type: 'json_object' } }` is the Responses API's native JSON mode. It replaces the `response_format: { type: 'json_object' }` parameter from Chat Completions with a more explicit configuration.

3. **Simplified parameter model** — Responses API uses `input` (string) instead of `messages` (array). Since the PromptBuilder pipeline already composes a single prompt string, `input` maps directly: `input: request.prompt`. No message array construction needed.

4. **`max_output_tokens`** — replaces `max_tokens`. More semantically clear (output vs. total context).

### Why Chat Completions for DeepSeek

1. **API compatibility** — DeepSeek's endpoint (`api.deepseek.com`) implements the Chat Completions API. It does not support the Responses API endpoint. Using `responses.create()` against DeepSeek's baseURL would fail.

2. **OpenAI-compatible SDK** — DeepSeek explicitly documents using the `openai` SDK with `client.chat.completions.create()` and a custom `baseURL`. This is the officially supported integration method.

3. **`messages` format required** — Chat Completions expects `messages: [{ role, content }]`. The provider sends `request.prompt` as a user message. No system message is needed (system prompt is handled by SystemPromptModule in the pipeline).

### Why not unify on one API

Unifying on Chat Completions for both would work but:
- Forfeits OpenAI's recommended API path
- Misses the cleaner `input`/`max_output_tokens` parameter model
- Would need to migrate back when OpenAI eventually deprecates Chat Completions

Unifying on Responses API for both would not work:
- DeepSeek does not implement the Responses API endpoint

Each provider uses its native API — this is the correct alignment.

---

## Consequences

**Positive:**
- Each provider uses its API's recommended path
- OpenAI provider follows current SDK best practices
- DeepSeek provider follows DeepSeek's documented integration method
- The PlannerProvider interface hides the API difference — consumers see `complete(request): PlannerResult` regardless

**Negative:**
- Two different API calling patterns exist in the codebase — developers must understand both when modifying providers
- Parameter names differ (`max_output_tokens` vs `max_tokens`, `input` vs `messages`) — easy to confuse when switching between providers
- Both providers share `AIConfiguration.maxTokens` but map it to different SDK parameters

**Neutral:**
- The `PlannerProvider` interface absorbs the API difference — no consumer code needs to change when switching providers
- `StructuredOutputValidator` normalizes the response format — both APIs produce the same `PlannerResult`
- Migration was seamless — no behavioral change, only implementation change
