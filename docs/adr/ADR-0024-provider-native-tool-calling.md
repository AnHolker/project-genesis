# ADR-0024: Provider-native Tool Calling

**Status:** Accepted  
**Date:** Sprint 3  
**Work Order:** WO-S3-007  
**Architecture Version:** v0.11

---

## Context

WO-S3-005 (Tool Calling Foundation) and WO-S3-006 (Runtime Tool Execution) established the Tool and ToolRegistry abstractions, along with Runtime-backed tool implementations. However, these tools were only injected into the LLM prompt as text descriptions via `ToolCallPlanner`. The LLM never saw tool definitions as native API parameters.

Without Provider-native Tool Calling:
- Tools are described in plain text within the prompt, not as structured function/tool schemas
- The LLM cannot call tools natively through the API's function-calling mechanism
- Tool execution happens at the Planner level (ToolCallPlanner), not at the Provider level
- Providers cannot leverage native features like OpenAI's structured function calling, DeepSeek's tool choice, etc.
- The tool calling lifecycle is limited to a single round trip — prompt-based tools cannot be called mid-conversation

The goal is to shift tool calling from the Planner level (prompt-based) to the Provider level (native API), while maintaining full backward compatibility.

### Constraints

1. **Do not modify `Tool` interface** — it must remain provider-independent
2. **Do not modify `PlannerProvider` interface** — new capability must be additive
3. **Do not modify `Pipeline`, `Planner`, `PromptBuilder`, `Runtime`** — all public APIs stay frozen
4. **Do not implement Agent Loop** — this is a single tool calling session per planning request
5. **Existing tests must continue passing** — all 201 tests must remain green
6. **Mock Provider must continue working** — no breaking changes to the default path

---

## Decision

### 1. ToolCallingProvider Interface

Define a new `ToolCallingProvider` interface that extends `PlannerProvider`:

```typescript
interface ToolCallingProvider extends PlannerProvider {
  completeWithTools(request: AIRequest, tools: Tool[]): Promise<PlannerResult>
}
```

- `completeWithTools()` receives the AIRequest and the actual Tool instances
- The provider is responsible for the full tool calling lifecycle
- Providers that do not implement this interface continue with prompt-based tool injection
- The interface is additive — no changes to existing code required

### 2. Tool Schema Translation

Since `Tool` does not have an `inputSchema` field (by design), a separate schema registry maps known tools to their JSON Schema:

```typescript
// Provider-side type (not part of Tool interface)
interface ToolInputSchema {
  type: 'object'
  properties: Record<string, { type: string; description?: string }>
  required: string[]
}
```

The `ProviderToolSchemas` utility provides:
- `getToolInputSchema(tool)`: Look up schema by tool name
- `hasToolSchema(tool)`: Check if schema exists
- `getSchemaTools(tools)`: Filter tools that have known schemas
- Known schemas are hardcoded for: `find_entity`, `find_entities`, `get_world_snapshot`

Each provider translates the generic schema to its native format:
- **OpenAI Responses API**: `{ type: 'function', name, description, parameters, strict: false }`
- **DeepSeek Chat Completions**: `{ type: 'function', function: { name, description, parameters } }`

### 3. Provider Native Tool Calling Lifecycle

**OpenAI Responses API:**
1. `client.responses.create({ input, tools: [...], ... })`
2. Check `response.output` for `function_call` items
3. Execute each tool call via `Tool.execute()`
4. Create `function_call_output` items with results
5. `client.responses.create({ previous_response_id, input: toolResults, ... })`
6. Parse final `response.output_text` as JSON → `PlannerResult`

**DeepSeek Chat Completions:**
1. `client.chat.completions.create({ messages, tools: [...], ... })`
2. Check `response.choices[0].message.tool_calls`
3. Execute each tool call via `Tool.execute()`
4. Append assistant message with tool_calls + tool result messages
5. `client.chat.completions.create({ messages: updatedMessages, ... })`
6. Parse final `message.content` as JSON → `PlannerResult`

### 4. ToolCallPlanner Routing

`ToolCallPlanner` detects native tool calling support:

```
if provider has 'completeWithTools' →
  call provider.completeWithTools(request, tools)
else →
  call provider.complete(enhancedRequest)  // prompt-based fallback
```

The detection uses `'completeWithTools' in provider` — a runtime type check that requires no interface changes.

### 5. Enhanced Event Payloads

Existing `ToolCallStarted` and `ToolCallFinished` events are enhanced with:

| Event | New Fields |
|-------|-----------|
| `ToolCallStarted` | `native: boolean`, `tools: [{ name, description }]` |
| `ToolCallFinished` | `native: boolean`, `toolResults: [{ name, duration, success, error? }]`, `duration: number` |

### 6. Browser Development Support

A new `allowBrowser?: boolean` field on `AIConfiguration` controls the OpenAI SDK's `dangerouslyAllowBrowser` flag:

- **Only enabled in development** via `VITE_AI_ALLOW_BROWSER=true`
- **Default: false** — production-safe by default
- **Explicit opt-in** — no automatic detection, no hidden behavior
- Both `OpenAIPlannerProvider` and `DeepSeekPlannerProvider` check `config.allowBrowser`

---

## Consequences

**Positive:**
- Providers can leverage native API function/tool calling for better LLM integration
- Tool schemas are sent as structured API parameters, not prompt text — improving LLM comprehension
- Tool execution lifecycle is managed entirely within the provider — simpler architecture
- Full backward compatibility — all existing tests pass without modification
- Mock provider unchanged — non-native providers continue with prompt-based flow
- `Tool` interface remains pure — no schema pollution
- Browser development is explicitly safe — no hardcoded `dangerouslyAllowBrowser`

**Negative:**
- Tool input schemas are duplicated in `ProviderToolSchemas.ts` (separate from Tool implementations)
- Adding a new tool requires updating both the Tool implementation and the schema registry
- `ProviderToolSchemas` must be manually kept in sync with Tool implementations

**Neutral:**
- `ToolCallingProvider` is a new interface — increases the provider surface area
- ToolCallPlanner gains routing logic — minor complexity increase
- Provider response parsing remains unchanged (same `parseResponse` + `StructuredOutputValidator`)

---

## Files Changed

| File | Change |
|------|--------|
| `packages/ai/src/provider/ToolCallingProvider.ts` | **New** — Interface extending PlannerProvider |
| `packages/ai/src/provider/ProviderToolSchemas.ts` | **New** — Tool schema registry and utilities |
| `packages/ai/src/provider/OpenAIPlannerProvider.ts` | **Modified** — Implements ToolCallingProvider, browser support |
| `packages/ai/src/provider/DeepSeekPlannerProvider.ts` | **Modified** — Implements ToolCallingProvider, browser support |
| `packages/ai/src/planner/ToolCallPlanner.ts` | **Modified** — Native tool calling routing, enhanced events |
| `packages/ai/src/config/AIConfiguration.ts` | **Modified** — Added `allowBrowser` field |
| `packages/ai/src/config/createAIConfiguration.ts` | **Modified** — Reads `VITE_AI_ALLOW_BROWSER` env var |
| `packages/ai/src/provider/index.ts` | **Modified** — Exports new types |
| `packages/ai/src/index.ts` | **Modified** — Exports new types from barrel |
| `packages/ai/src/__tests__/ProviderNativeToolCalling.test.ts` | **New** — 54 test cases |
| `apps/web/.env.example` | **Modified** — Added `VITE_AI_ALLOW_BROWSER` |
| `docs/project/CHANGELOG.md` | **Modified** — Added WO-S3-007 entry |
| `docs/project/PROJECT_STATE.md` | **Modified** — Updated status |
| `docs/project/AI_ARCHITECTURE.md` | **Modified** — Updated tool calling hierarchy |
| `docs/project/AI_INTEGRATION.md` | **Modified** — Added browser development docs |
| `docs/adr/ADR-0024-provider-native-tool-calling.md` | **New** — This document |

---

## Test Summary

### New Tests (54)

| Test Group | Count |
|-----------|-------|
| ProviderToolSchemas — schema lookup, filtering, unknown tool handling | 9 |
| ToolCallingProvider — interface conformance, with/without tools, errors | 4 |
| ToolCallPlanner Native Routing — detection, tool passing, events | 5 |
| ToolCallPlanner Backward Compatibility — fallback, Mock, events, errors | 5 |
| OpenAIPlannerProvider Tool Calling — interface, schema fallback, API errors, browser config | 5 |
| DeepSeekPlannerProvider Tool Calling — interface, schema fallback, API errors, browser config | 4 |
| Failure Handling — unknown tool, execution failure, provider error, name mismatch | 4 |
| Event Ordering — native and non-native event sequencing | 2 |
| Browser Development Configuration — all VITE_AI_ALLOW_BROWSER states | 4 |
| Provider Factory Compatibility — all 3 providers, unknown provider | 4 |
| Mock Provider Backward Compatibility — ToolCallPlanner, streaming, complete | 3 |
| Retry Integration — ToolCallingProvider + RetryPlanner, recovery, independence | 3 |
| AIConfiguration allowBrowser — optional field, factory propagation | 2 |

### Overall

| Metric | Value |
|--------|-------|
| New tests | 54 |
| Existing tests | 201 |
| **Total passing** | **255** |
| TypeScript | Clean |