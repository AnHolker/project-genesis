# AI Integration Guide

> How to configure, run, and switch AI providers in Project Genesis.

---

## Quick Start

1. Copy the environment template:
   ```bash
   cp apps/web/.env.example apps/web/.env.local
   ```

2. Edit `.env.local` and set your provider and credentials.

3. Start the development server:
   ```bash
   cd apps/web && pnpm dev
   ```

4. Open http://localhost:5190 and type commands in the input field.

---

## Environment Variables

All AI configuration is loaded from environment variables with the `VITE_` prefix (required by Vite for browser exposure).

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_AI_PROVIDER` | No | `"mock"` | Provider to use: `"mock"`, `"openai"`, `"deepseek"` |
| `VITE_AI_MODEL` | No | Provider-specific | Model identifier (see defaults below) |
| `VITE_AI_API_KEY` | For openai, deepseek | — | API key for the selected provider |
| `VITE_AI_BASE_URL` | For deepseek | — | Custom API endpoint URL |
| `VITE_AI_TEMPERATURE` | No | `"0.2"` | Response randomness (0.0–2.0) |
| `VITE_AI_MAX_TOKENS` | No | `"800"` | Maximum output tokens |

### Default Models by Provider

| Provider | Default Model |
|----------|---------------|
| `mock` | `"mock"` |
| `openai` | `"gpt-4o-mini"` |
| `deepseek` | `"deepseek-chat"` |

---

## Provider Configuration Examples

### Mock (Default — No API Key Required)

```env
VITE_AI_PROVIDER=mock
```

### OpenAI

```env
VITE_AI_PROVIDER=openai
VITE_AI_API_KEY=sk-your-openai-key
VITE_AI_MODEL=gpt-4o-mini
VITE_AI_TEMPERATURE=0.2
VITE_AI_MAX_TOKENS=800
```

### DeepSeek

```env
VITE_AI_PROVIDER=deepseek
VITE_AI_API_KEY=your-deepseek-key
VITE_AI_BASE_URL=https://api.deepseek.com
VITE_AI_MODEL=deepseek-chat
VITE_AI_TEMPERATURE=0.2
VITE_AI_MAX_TOKENS=800
```

---

## Switching Providers

Switching providers requires **only** a configuration change. No code modification is needed.

1. Edit `apps/web/.env.local`
2. Change `VITE_AI_PROVIDER` to the desired provider
3. Set the corresponding `VITE_AI_API_KEY` (and `VITE_AI_BASE_URL` for DeepSeek)
4. Restart the development server

### Fallback Behavior

If `ProviderFactory.create()` fails (e.g., `VITE_AI_PROVIDER=openai` but `VITE_AI_API_KEY` is missing), the application falls back to `MockPlannerProvider` and logs a warning to the browser console:

```
Provider creation failed, falling back to mock: OpenAIPlannerProvider requires an apiKey in AIConfiguration
```

The application continues to function with the mock provider.

---

## Request Flow

The complete flow from user input to rendered output:

```
1. User types "增加一棵树" and clicks Send

2. gameStore.send(input) is called

3. Pipeline.execute({ input: "增加一棵树", memory: DefaultMemory }) starts
   → Emits: PipelineStarted

4. PromptBuilder.build(context) composes the prompt
   → UserInputModule: "增加一棵树"
   → MemoryPromptModule: "Previous actions:\n- Applied 1 action(s)" (if history exists)
   → Emits: PromptBuilt

5. Planner.plan(request) delegates to PlannerProvider
   → Emits: PlannerStarted

6. ProviderFactory selects the provider from AIConfiguration:
   → "mock"     → MockPlannerProvider.complete(request)
   → "openai"   → OpenAIPlannerProvider.complete(request) [Responses API]
   → "deepseek" → DeepSeekPlannerProvider.complete(request) [Chat Completions API]

7. Provider calls LLM API, receives JSON, parses into PlannerResult
   → { actions: [{ type: "CreateEntity", entityType: "tree", x: 5, y: 3 }] }
   → Emits: PlannerFinished

8. Pipeline returns PipelineContext with plannerResult
   → Emits: PipelineFinished

9. gameStore extracts actions from result.plannerResult.actions

10. Runtime.applyActions(actions) dispatches through Action Handlers
    → CreateEntityHandler creates entity in World

11. renderVersion increments → Renderer redraws Canvas with new World state

12. Conversation history is stored in Memory for next turn
```

---

## Error Handling

The pipeline never crashes. Every error path returns a valid `PlannerResult`:

| Error | Where | Result |
|-------|-------|--------|
| Missing API key | ProviderFactory.create() → constructor | Falls back to mock provider |
| Network failure | Provider.complete() catch | `{ actions: [], reasoning: "API error: ..." }` |
| Invalid JSON | Provider.parseResponse() catch | `{ actions: [], reasoning: "Failed to parse response as JSON" }` |
| Empty response | Provider.complete() | `{ actions: [], reasoning: "Empty response from ..." }` |
| Non-array actions | Provider.parseResponse() | `{ actions: [], reasoning: "Response actions is not an array" }` |
| Unknown provider | ProviderFactory.create() | Throws `Error: Unknown AI provider: xxx` → fallback to mock |

When `actions` is empty, the game store displays `Unknown: "input"` in the log. The application remains fully interactive.

---

## Running Locally

```bash
# Install dependencies
pnpm install

# Run with mock provider (default)
cd apps/web && pnpm dev

# Run with DeepSeek
VITE_AI_PROVIDER=deepseek \
VITE_AI_API_KEY=your-key \
VITE_AI_BASE_URL=https://api.deepseek.com \
pnpm --filter @genesis/web dev

# Run with OpenAI
VITE_AI_PROVIDER=openai \
VITE_AI_API_KEY=sk-your-key \
pnpm --filter @genesis/web dev
```

Or create `.env.local`:

```bash
cp apps/web/.env.example apps/web/.env.local
# Edit .env.local with your provider and credentials
cd apps/web && pnpm dev
```

---

## Verification Commands

### Mock Provider

| Input | Expected Result |
|-------|-----------------|
| `增加一棵树` | `Applied 1 action(s)` (CreateEntity tree) |
| `移动实体` | `Applied 1 action(s)` (MoveEntity) |
| `创建森林` | `Applied 1 action(s)` (CreateEntity tree — keyword match) |
| `创建村庄` | `Applied 1 action(s)` (CreateEntity — keyword match) |
| `hello world` | `Unknown: "hello world"` |

### DeepSeek / OpenAI Provider

| Input | Expected Result |
|-------|-----------------|
| `增加一棵树` | `Applied N action(s)` (CreateEntity tree) |
| `移动实体` | `Applied N action(s)` (MoveEntity) |
| `创建森林` | `Applied N action(s)` (multiple CreateEntity trees) |
| `创建村庄` | `Applied N action(s)` (multiple CreateEntity houses, etc.) |

Results from real LLMs may vary. The key verification is that the pipeline produces valid `PlannerResult` with Runtime-compatible actions.
