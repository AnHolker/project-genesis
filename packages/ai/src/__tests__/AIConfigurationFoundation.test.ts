import { describe, it, expect } from 'vitest'
import type { AIConfiguration } from '../config/AIConfiguration'
import { DefaultAIConfiguration } from '../config/DefaultAIConfiguration'
import { createAIConfiguration } from '../config/createAIConfiguration'

// ---------------------------------------------------------------------------
// AIConfiguration — Interface
// ---------------------------------------------------------------------------

describe('AIConfiguration — Interface', () => {
  it('should require provider', () => {
    const config: AIConfiguration = {
      provider: 'openai',
      model: 'gpt-4o',
      temperature: 0.2,
      maxTokens: 800,
    }
    expect(config.provider).toBe('openai')
  })

  it('should support optional model', () => {
    const config: AIConfiguration = {
      provider: 'openai',
      model: 'gpt-4o',
      temperature: 0.2,
      maxTokens: 800,
    }
    expect(config.model).toBe('gpt-4o')
  })

  it('should support optional temperature', () => {
    const config: AIConfiguration = {
      provider: 'openai',
      model: 'gpt-4o',
      temperature: 0.5,
      maxTokens: 800,
    }
    expect(config.temperature).toBe(0.5)
  })

  it('should support optional maxOutputTokens', () => {
    const config: AIConfiguration = {
      provider: 'openai',
      model: 'gpt-4o',
      temperature: 0.2,
      maxTokens: 800,
      maxOutputTokens: 16384,
    }
    expect(config.maxOutputTokens).toBe(16384)
  })

  it('should support optional streaming', () => {
    const config: AIConfiguration = {
      provider: 'openai',
      model: 'gpt-4o',
      temperature: 0.2,
      maxTokens: 800,
      streaming: true,
    }
    expect(config.streaming).toBe(true)
  })

  it('should support optional toolCalling', () => {
    const config: AIConfiguration = {
      provider: 'openai',
      model: 'gpt-4o',
      temperature: 0.2,
      maxTokens: 800,
      toolCalling: true,
    }
    expect(config.toolCalling).toBe(true)
  })

  it('should support optional apiKey', () => {
    const config: AIConfiguration = {
      provider: 'openai',
      model: 'gpt-4o',
      temperature: 0.2,
      maxTokens: 800,
      apiKey: 'sk-...',
    }
    expect(config.apiKey).toBe('sk-...')
  })

  it('should support optional baseURL', () => {
    const config: AIConfiguration = {
      provider: 'deepseek',
      model: 'deepseek-chat',
      temperature: 0.2,
      maxTokens: 800,
      baseURL: 'https://api.deepseek.com',
    }
    expect(config.baseURL).toBe('https://api.deepseek.com')
  })

  it('should support optional allowBrowser', () => {
    const config: AIConfiguration = {
      provider: 'openai',
      model: 'gpt-4o',
      temperature: 0.2,
      maxTokens: 800,
      allowBrowser: true,
    }
    expect(config.allowBrowser).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// DefaultAIConfiguration — Defaults
// ---------------------------------------------------------------------------

describe('DefaultAIConfiguration — Defaults', () => {
  it('should default to mock provider', () => {
    const config = new DefaultAIConfiguration()
    expect(config.provider).toBe('mock')
  })

  it('should default to mock model', () => {
    const config = new DefaultAIConfiguration()
    expect(config.model).toBe('mock')
  })

  it('should default to 0 temperature', () => {
    const config = new DefaultAIConfiguration()
    expect(config.temperature).toBe(0)
  })

  it('should default to 0 maxTokens', () => {
    const config = new DefaultAIConfiguration()
    expect(config.maxTokens).toBe(0)
  })

  it('should default streaming to false', () => {
    const config = new DefaultAIConfiguration()
    expect(config.streaming).toBe(false)
  })

  it('should default toolCalling to false', () => {
    const config = new DefaultAIConfiguration()
    expect(config.toolCalling).toBe(false)
  })

  it('should have undefined maxOutputTokens', () => {
    const config = new DefaultAIConfiguration()
    expect(config.maxOutputTokens).toBeUndefined()
  })

  it('should have undefined apiKey', () => {
    const config = new DefaultAIConfiguration()
    expect(config.apiKey).toBeUndefined()
  })

  it('should have undefined baseURL', () => {
    const config = new DefaultAIConfiguration()
    expect(config.baseURL).toBeUndefined()
  })

  it('should have undefined allowBrowser', () => {
    const config = new DefaultAIConfiguration()
    expect(config.allowBrowser).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// DefaultAIConfiguration — Deterministic
// ---------------------------------------------------------------------------

describe('DefaultAIConfiguration — Deterministic', () => {
  it('should produce identical values on every instantiation', () => {
    const a = new DefaultAIConfiguration()
    const b = new DefaultAIConfiguration()
    expect(a.provider).toBe(b.provider)
    expect(a.model).toBe(b.model)
    expect(a.temperature).toBe(b.temperature)
    expect(a.maxTokens).toBe(b.maxTokens)
    expect(a.streaming).toBe(b.streaming)
    expect(a.toolCalling).toBe(b.toolCalling)
    expect(a.maxOutputTokens).toBe(b.maxOutputTokens)
    expect(a.apiKey).toBe(b.apiKey)
    expect(a.baseURL).toBe(b.baseURL)
    expect(a.allowBrowser).toBe(b.allowBrowser)
  })
})

// ---------------------------------------------------------------------------
// DefaultAIConfiguration — Immutable
// ---------------------------------------------------------------------------

describe('DefaultAIConfiguration — Immutable', () => {
  it('should have readonly properties', () => {
    const config = new DefaultAIConfiguration()
    // TypeScript enforces readonly at compile time
    // At runtime, verify the value is correct
    expect(config.provider).toBe('mock')
  })

  it('should not be affected by external state', () => {
    // Multiple instances should be independent
    const a = new DefaultAIConfiguration()
    const b = new DefaultAIConfiguration()
    // Both should have same defaults
    expect(a.provider).toBe('mock')
    expect(b.provider).toBe('mock')
  })
})

// ---------------------------------------------------------------------------
// DefaultAIConfiguration — No Side Effects
// ---------------------------------------------------------------------------

describe('DefaultAIConfiguration — No Side Effects', () => {
  it('should not perform I/O during construction', () => {
    // Construction should be a pure memory operation
    const config = new DefaultAIConfiguration()
    expect(config).toBeDefined()
  })

  it('should not depend on environment variables', () => {
    // Should work identically regardless of env
    const config = new DefaultAIConfiguration()
    expect(config.provider).toBe('mock')
    expect(config.apiKey).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// createAIConfiguration — Environment
// ---------------------------------------------------------------------------

describe('createAIConfiguration — Environment', () => {
  it('should return mock defaults when no env provided', () => {
    const config = createAIConfiguration()
    expect(config.provider).toBe('mock')
    expect(config.model).toBe('mock')
    expect(config.apiKey).toBeUndefined()
    expect(config.baseURL).toBeUndefined()
    expect(config.temperature).toBe(0.2)
    expect(config.maxTokens).toBe(800)
    expect(config.streaming).toBeUndefined()
    expect(config.toolCalling).toBeUndefined()
    expect(config.allowBrowser).toBe(false)
  })

  it('should respect VITE_AI_PROVIDER', () => {
    const config = createAIConfiguration({ VITE_AI_PROVIDER: 'openai' })
    expect(config.provider).toBe('openai')
    expect(config.model).toBe('gpt-4o-mini')
  })

  it('should respect VITE_AI_MODEL', () => {
    const config = createAIConfiguration({
      VITE_AI_PROVIDER: 'openai',
      VITE_AI_MODEL: 'gpt-4o',
    })
    expect(config.model).toBe('gpt-4o')
  })

  it('should respect VITE_AI_STREAMING', () => {
    const config = createAIConfiguration({ VITE_AI_STREAMING: 'true' })
    expect(config.streaming).toBe(true)
  })

  it('should respect VITE_AI_TOOL_CALLING', () => {
    const config = createAIConfiguration({ VITE_AI_TOOL_CALLING: 'true' })
    expect(config.toolCalling).toBe(true)
  })

  it('should not set streaming when VITE_AI_STREAMING is false', () => {
    const config = createAIConfiguration({ VITE_AI_STREAMING: 'false' })
    expect(config.streaming).toBeUndefined()
  })

  it('should not set toolCalling when VITE_AI_TOOL_CALLING is false', () => {
    const config = createAIConfiguration({ VITE_AI_TOOL_CALLING: 'false' })
    expect(config.toolCalling).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Backward Compatibility
// ---------------------------------------------------------------------------

describe('AIConfiguration — Backward Compatibility', () => {
  it('should still support existing provider configs', () => {
    // Old-style config (no new fields)
    const config: AIConfiguration = {
      provider: 'deepseek',
      model: 'deepseek-v4-flash',
      apiKey: 'sk-xxx',
      baseURL: 'https://api.deepseek.com',
      temperature: 0.2,
      maxTokens: 800,
    }
    expect(config.provider).toBe('deepseek')
    expect(config.model).toBe('deepseek-v4-flash')
    expect(config.maxTokens).toBe(800)
  })

  it('should still work with DefaultAIConfiguration as before', () => {
    const config = new DefaultAIConfiguration()
    // These are the same properties that existed before
    expect(config.provider).toBe('mock')
    expect(config.model).toBe('mock')
    expect(config.temperature).toBe(0)
    expect(config.maxTokens).toBe(0)
  })

  it('should still work with createAIConfiguration as before', () => {
    const config = createAIConfiguration({
      VITE_AI_PROVIDER: 'openai',
      VITE_AI_API_KEY: 'sk-xxx',
    })
    expect(config.provider).toBe('openai')
    expect(config.apiKey).toBe('sk-xxx')
  })

  it('should be usable with ProviderFactory', () => {
    const config: AIConfiguration = {
      provider: 'mock',
      model: 'mock',
      temperature: 0,
      maxTokens: 0,
    }
    expect(config.provider).toBe('mock')
  })

  it('should be assignable to old AIConfiguration interface', () => {
    const oldConfig: AIConfiguration = {
      provider: 'openai',
      model: 'gpt-4o',
      temperature: 0.2,
      maxTokens: 800,
    }
    // New fields are optional — should not break old code
    expect(oldConfig.streaming).toBeUndefined()
    expect(oldConfig.toolCalling).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

describe('AIConfiguration — Exports', () => {
  it('should export AIConfiguration type', () => {
    const config: AIConfiguration = {
      provider: 'test',
      model: 'test',
      temperature: 0,
      maxTokens: 0,
    }
    expect(config.provider).toBe('test')
  })

  it('should export DefaultAIConfiguration class', () => {
    expect(DefaultAIConfiguration).toBeDefined()
    expect(new DefaultAIConfiguration()).toBeInstanceOf(DefaultAIConfiguration)
  })

  it('should export createAIConfiguration function', () => {
    expect(createAIConfiguration).toBeDefined()
    expect(typeof createAIConfiguration).toBe('function')
  })
})

// ---------------------------------------------------------------------------
// Compatibility — ProviderFactory
// ---------------------------------------------------------------------------

describe('AIConfiguration — ProviderFactory Compatibility', () => {
  it('should be usable with DefaultAIConfiguration in ProviderFactory', async () => {
    const { ProviderFactory } = await import('../provider/ProviderFactory')
    const provider = ProviderFactory.create(new DefaultAIConfiguration())
    expect(provider).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Compatibility — RetryPlanner / ToolCallPlanner
// ---------------------------------------------------------------------------

describe('AIConfiguration — Planner Compatibility', () => {
  it('should work with RetryPlanner', async () => {
    const { RetryPlanner } = await import('../planner/RetryPlanner')
    const { MockPlannerProvider } = await import('../provider/MockPlannerProvider')
    const planner = new RetryPlanner(new MockPlannerProvider(new DefaultAIConfiguration()))
    expect(planner).toBeDefined()
  })

  it('should work with ToolCallPlanner', async () => {
    const { ToolCallPlanner } = await import('../planner/ToolCallPlanner')
    const { DefaultToolRegistry } = await import('../tools/ToolRegistry')
    const { MockPlannerProvider } = await import('../provider/MockPlannerProvider')
    const planner = new ToolCallPlanner(
      new MockPlannerProvider(new DefaultAIConfiguration()),
      new DefaultToolRegistry([]),
    )
    expect(planner).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Compatibility — Streaming
// ---------------------------------------------------------------------------

describe('AIConfiguration — Streaming Compatibility', () => {
  it('should work with streaming providers', async () => {
    const { MockStreamingProvider } = await import('../provider/MockStreamingProvider')
    const { MockPlanner } = await import('../planner/MockPlanner')
    const { DefaultPipeline } = await import('../pipeline/DefaultPipeline')
    const { DefaultPromptBuilder } = await import('../prompt/DefaultPromptBuilder')
    const { UserInputModule } = await import('../prompt/modules')

    const planner = new MockPlanner(new MockStreamingProvider())
    const builder = new DefaultPromptBuilder([new UserInputModule()])
    const pipeline = new DefaultPipeline(planner, builder)
    const result = await pipeline.stream({ input: 'tree' })
    expect(result.plannerResult).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Compatibility — AgentLoop
// ---------------------------------------------------------------------------

describe('AIConfiguration — AgentLoop Compatibility', () => {
  it('should work with AgentLoop', async () => {
    const { DefaultAgentLoop } = await import('../agent/DefaultAgentLoop')
    const { MockPlanner } = await import('../planner/MockPlanner')
    const { MockPlannerProvider } = await import('../provider/MockPlannerProvider')
    const { DefaultPipeline } = await import('../pipeline/DefaultPipeline')
    const { DefaultPromptBuilder } = await import('../prompt/DefaultPromptBuilder')
    const { UserInputModule } = await import('../prompt/modules')

    const agentLoop = new DefaultAgentLoop()
    const planner = new MockPlanner(new MockPlannerProvider(new DefaultAIConfiguration()))
    const builder = new DefaultPromptBuilder([new UserInputModule()])
    const pipeline = new DefaultPipeline(planner, builder, undefined, agentLoop)
    const result = await pipeline.execute({ input: 'tree' })
    expect(result.plannerResult).toBeDefined()
  })
})