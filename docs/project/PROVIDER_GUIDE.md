# Provider Development Guide

> How to implement, configure, and test PlannerProvider implementations for Project Genesis.

---

## Current Providers

| Provider | API | Required Config | SDK |
|----------|-----|-----------------|-----|
| MockPlannerProvider | None (keyword matching) | `provider: "mock"` | None |
| OpenAIPlannerProvider | OpenAI Responses API | `provider: "openai"`, `apiKey`, `model` | `openai` |
| DeepSeekPlannerProvider | DeepSeek Chat Completions | `provider: "deepseek"`, `apiKey`, `baseURL`, `model` | `openai` (compatible) |

---

## Required Interface

Every provider must implement:

```typescript
interface PlannerProvider {
  complete(request: AIRequest): Promise<PlannerResult>
}
```

Where:

```typescript
interface AIRequest {
  prompt: string
  metadata?: Record<string, unknown>
}

interface PlannerResult {
  actions: Action[]       // Must be Runtime-compatible Action objects
  reasoning?: string      // Optional explanation
  metadata?: Record<string, unknown>
}
```

### Runtime-Compatible Actions

`PlannerResult.actions` must contain objects matching the `Action` type from `@genesis/shared`:

```typescript
type Action = CreateEntityAction | MoveEntityAction

interface CreateEntityAction {
  type: 'CreateEntity'
  entityType: string
  x: number
  y: number
}

interface MoveEntityAction {
  type: 'MoveEntity'
  id: string
  x: number
  y: number
}
```

Any action that does not match this union will be silently ignored by Runtime's handler registry.

---

## Provider Responsibilities

A provider is responsible for:

1. **Calling the LLM API** — using the appropriate SDK and endpoint
2. **System prompt** — instructing the model to produce JSON actions
3. **JSON parsing** — converting the raw response text into `PlannerResult`
4. **Error handling** — returning `{ actions: [] }` with `reasoning` instead of crashing
5. **Configuration validation** — throwing in the constructor if required fields are missing

A provider is **not** responsible for:

- Orchestrating the pipeline (Pipeline's job)
- Composing the prompt (PromptBuilder's job)
- Storing conversation history (Memory's job)
- Executing actions (Runtime's job)
- Selecting which provider to use (ProviderFactory's job)

---

## Configuration

All providers receive `AIConfiguration`:

```typescript
interface AIConfiguration {
  provider: string       // "mock" | "openai" | "deepseek" | custom
  model: string          // model identifier
  temperature: number    // response randomness (0.0–2.0)
  maxTokens: number      // max output tokens
  apiKey?: string        // required for openai, deepseek
  baseURL?: string       // required for deepseek and other OpenAI-compatible APIs
}
```

### Example Configurations

**Mock:**
```typescript
const config: AIConfiguration = {
  provider: 'mock',
  model: 'mock',
  temperature: 0,
  maxTokens: 0,
}
```

**OpenAI:**
```typescript
const config: AIConfiguration = {
  provider: 'openai',
  model: 'gpt-4o',
  apiKey: process.env.OPENAI_API_KEY!,
  temperature: 0.2,
  maxTokens: 800,
}
```

**DeepSeek:**
```typescript
const config: AIConfiguration = {
  provider: 'deepseek',
  model: 'deepseek-chat',
  apiKey: process.env.DEEPSEEK_API_KEY!,
  baseURL: 'https://api.deepseek.com',
  temperature: 0.2,
  maxTokens: 800,
}
```

### Instantiation via ProviderFactory

```typescript
import { ProviderFactory, MockPlanner } from '@genesis/ai'

const provider = ProviderFactory.create(config)
const planner = new MockPlanner(provider)
```

---

## Error Handling

Providers must **never throw** during `complete()`. Instead, return a `PlannerResult` with empty actions:

```typescript
async complete(request: AIRequest): Promise<PlannerResult> {
  try {
    // ... call API, parse response ...
  } catch (error) {
    return {
      actions: [],
      reasoning: `API error: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}
```

Required error cases:

| Condition | Expected Result |
|-----------|----------------|
| Missing `apiKey` | Throw in constructor |
| Missing `baseURL` (if required) | Throw in constructor |
| Network failure | `{ actions: [], reasoning: "..." }` |
| Invalid JSON response | `{ actions: [], reasoning: "..." }` |
| Empty response | `{ actions: [], reasoning: "Empty response from ..." }` |
| `actions` not an array | `{ actions: [], reasoning: "Response actions is not an array" }` |

---

## JSON Parsing

Providers receive raw text from the LLM and must parse it into `PlannerResult`:

```typescript
private parseResponse(content: string): PlannerResult {
  try {
    const parsed = JSON.parse(content)
    const rawActions = parsed.actions ?? []
    if (!Array.isArray(rawActions)) {
      return { actions: [], reasoning: 'Response actions is not an array' }
    }

    const actions: Action[] = []
    for (const raw of rawActions) {
      if (raw && typeof raw === 'object' && typeof raw.type === 'string') {
        actions.push(raw as Action)
      }
    }

    return { actions }
  } catch {
    return { actions: [], reasoning: 'Failed to parse response as JSON' }
  }
}
```

Key rules:
- Use `response_format: { type: 'json_object' }` (or equivalent) to force JSON output
- Filter out actions without a `type` field — they will be rejected by Runtime anyway
- Never crash — always return a valid `PlannerResult`

---

## Structured Output Expectations

The system prompt must instruct the LLM to produce:

```json
{"actions": [{"type": "CreateEntity", "entityType": "tree", "x": 5, "y": 3}]}
```

If no actions can be determined:

```json
{"actions": []}
```

Requirements:
- **No markdown** — no code fences, no backticks
- **No commentary** — only the JSON object
- **Valid JSON** — must be parseable by `JSON.parse()`
- **Array of actions** — `actions` must be an array

---

## How to Implement a New Provider

### Step 1: Create the file

```
packages/ai/src/provider/<Name>PlannerProvider.ts
```

### Step 2: Implement the interface

```typescript
import type { PlannerProvider } from './PlannerProvider'
import type { AIRequest } from '../request'
import type { PlannerResult } from '../planner'
import type { AIConfiguration } from '../config'
import type { Action } from '@genesis/shared'

const SYSTEM_PROMPT = `You are a game action planner for Project Genesis.
...
Respond with ONLY valid JSON. No markdown. No code fences. Pure JSON object:
{"actions": [{"type": "CreateEntity", "entityType": "tree", "x": 5, "y": 3}]}
If the input cannot be translated to actions, return {"actions": []}.`

export class MyProviderPlannerProvider implements PlannerProvider {
  private config: AIConfiguration

  constructor(config: AIConfiguration) {
    // Validate required config fields
    if (!config.apiKey) {
      throw new Error('MyProviderPlannerProvider requires an apiKey in AIConfiguration')
    }
    this.config = config
  }

  async complete(request: AIRequest): Promise<PlannerResult> {
    try {
      // Call the LLM API
      const response = await this.callAPI(request)
      const content = /* extract text from response */
      if (!content || content.trim().length === 0) {
        return { actions: [], reasoning: 'Empty response from MyProvider' }
      }
      return this.parseResponse(content)
    } catch (error) {
      return {
        actions: [],
        reasoning: `MyProvider API error: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
  }

  private parseResponse(content: string): PlannerResult {
    // ... JSON parsing as shown above ...
  }
}
```

### Step 3: Register in ProviderFactory

Add a case to the switch in `ProviderFactory.create()`:

```typescript
case 'myprovider':
  return new MyProviderPlannerProvider(config)
```

### Step 4: Export

Add to `packages/ai/src/provider/index.ts`:

```typescript
export { MyProviderPlannerProvider } from './MyProviderPlannerProvider'
```

Add to `packages/ai/src/index.ts`:

```typescript
export { MyProviderPlannerProvider } from './provider'
```

### Step 5: Test

Create `packages/ai/src/__tests__/MyProviderPlannerProvider.test.ts`:

- Missing required config → constructor throws
- Empty response → `{ actions: [] }`
- Valid JSON → correct actions
- Invalid JSON → `{ actions: [] }` with reasoning
- Network error → `{ actions: [] }` with reasoning
- Non-array actions → `{ actions: [] }` with reasoning

Mock the internal API client to avoid real network calls.

---

## Future Provider Examples

The following providers could be added using the same pattern:

| Provider | API Compatibility | Notes |
|----------|-------------------|-------|
| Claude | Anthropic Messages API | Requires `@anthropic-ai/sdk` or compatible endpoint |
| Gemini | Google Generative AI | Requires `@google/generative-ai` SDK |
| Qwen | OpenAI-compatible | Same pattern as DeepSeek — use `openai` SDK with custom `baseURL` |
| Doubao | Volcengine API | May require custom SDK or OpenAI-compatible endpoint |

For OpenAI-compatible providers (Qwen, and potentially others), the existing `openai` SDK with custom `baseURL` can be reused — no new SDK dependency needed.

---

## Testing Recommendations

1. **Never call real APIs in unit tests** — mock the SDK client
2. **Test constructor validation** — missing required fields must throw
3. **Test every error path** — empty, invalid JSON, network error, non-array
4. **Test happy path** — valid JSON with multiple actions
5. **Use `vi.fn()` for mocks** — Vitest mock functions for SDK methods
6. **Test action type filtering** — actions without `type` field should be excluded
7. **Keep tests independent** — each test creates its own provider instance
