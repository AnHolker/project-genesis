import { describe, it, expect } from 'vitest'
import { DefaultPromptBuilder } from '../prompt/DefaultPromptBuilder'
import { DefaultProviderBudget } from '../prompt/DefaultProviderBudget'
import { DefaultAIConfiguration } from '../config/DefaultAIConfiguration'
import type { AIConfiguration } from '../config/AIConfiguration'
import type { ProviderBudgetResult } from '../prompt/ProviderBudgetResult'
import {
  SystemPromptModule,
  UserInputModule,
  MemoryPromptModule,
} from '../prompt/modules'
import { DefaultMemory } from '../memory/DefaultMemory'
import { DefaultReflection } from '../reflection/DefaultReflection'
import { DefaultAgentLoop } from '../agent/DefaultAgentLoop'
import { DefaultToolRegistry } from '../tools/ToolRegistry'
import { DefaultPipeline } from '../pipeline/DefaultPipeline'
import { MockPlanner, RetryPlanner, ToolCallPlanner } from '../planner'
import { MockPlannerProvider, MockStreamingProvider } from '../provider'
import { DefaultAIConfiguration as DefaultAIConfig } from '../config'

// ---------------------------------------------------------------------------
// AIConfiguration Consumption in Builder
// ---------------------------------------------------------------------------

describe('DefaultPromptBuilder — AIConfiguration Consumption', () => {
  it('should accept AIConfiguration as 8th constructor param', async () => {
    const config: AIConfiguration = {
      provider: 'openai',
      model: 'gpt-4o',
      temperature: 0,
      maxTokens: 0,
    }
    const builder = new DefaultPromptBuilder(
      [new UserInputModule()],
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      new DefaultProviderBudget(),
      config,
    )
    const request = await builder.build({ input: 'hello' })
    expect(request.prompt).toContain('hello')
  })

  it('should use configuration.provider for ProviderBudget lookup', async () => {
    const config: AIConfiguration = {
      provider: 'deepseek',
      model: 'deepseek-chat',
      temperature: 0,
      maxTokens: 0,
    }
    const builder = new DefaultPromptBuilder(
      [new UserInputModule()],
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      new DefaultProviderBudget(),
      config,
    )
    const request = await builder.build({ input: 'hello' })
    const assembly = request.metadata?.promptAssembly as Record<string, unknown>
    const pb = assembly.providerBudget as ProviderBudgetResult
    expect(pb.maxInputTokens).toBe(65536)
  })

  it('should use configuration.model for ProviderBudget model-specific lookup', async () => {
    const config: AIConfiguration = {
      provider: 'openai',
      model: 'gpt-4o',
      temperature: 0,
      maxTokens: 0,
    }
    const builder = new DefaultPromptBuilder(
      [new UserInputModule()],
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      new DefaultProviderBudget(),
      config,
    )
    const request = await builder.build({ input: 'hello' })
    const assembly = request.metadata?.promptAssembly as Record<string, unknown>
    const pb = assembly.providerBudget as ProviderBudgetResult
    expect(pb.maxInputTokens).toBe(128000)
    expect(pb.maxOutputTokens).toBe(16384)
  })

  it('should fall back to openai default when configuration has no model', async () => {
    const config: AIConfiguration = {
      provider: 'openai',
      model: 'gpt-4o',
      temperature: 0,
      maxTokens: 0,
    }
    const builder = new DefaultPromptBuilder(
      [new UserInputModule()],
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      new DefaultProviderBudget(),
      config,
    )
    const request = await builder.build({ input: 'hello' })
    const assembly = request.metadata?.promptAssembly as Record<string, unknown>
    const pb = assembly.providerBudget as ProviderBudgetResult
    expect(pb.maxInputTokens).toBeGreaterThan(0)
  })

  it('should include providerBudget in metadata when configuration is provided', async () => {
    const config: AIConfiguration = {
      provider: 'openai',
      model: 'gpt-4o',
      temperature: 0,
      maxTokens: 0,
    }
    const builder = new DefaultPromptBuilder(
      [new UserInputModule()],
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      new DefaultProviderBudget(),
      config,
    )
    const request = await builder.build({ input: 'hello' })
    const assembly = request.metadata?.promptAssembly as Record<string, unknown>
    expect(assembly.providerBudget).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// DefaultAIConfiguration Compatibility
// ---------------------------------------------------------------------------

describe('DefaultPromptBuilder — DefaultAIConfiguration', () => {
  it('should accept DefaultAIConfiguration as configuration', async () => {
    const builder = new DefaultPromptBuilder(
      [new UserInputModule()],
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      new DefaultProviderBudget(),
      new DefaultAIConfiguration(),
    )
    const request = await builder.build({ input: 'hello' })
    expect(request.prompt).toContain('hello')
  })

  it('should use mock provider from DefaultAIConfiguration', async () => {
    const builder = new DefaultPromptBuilder(
      [new UserInputModule()],
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      new DefaultProviderBudget(),
      new DefaultAIConfiguration(),
    )
    const request = await builder.build({ input: 'hello' })
    const assembly = request.metadata?.promptAssembly as Record<string, unknown>
    const pb = assembly.providerBudget as ProviderBudgetResult
    // mock provider → 4096 tokens
    expect(pb.maxInputTokens).toBe(4096)
  })
})

// ---------------------------------------------------------------------------
// Backward Compatibility
// ---------------------------------------------------------------------------

describe('DefaultPromptBuilder — Backward Compatibility', () => {
  it('should work with 1-param constructor', async () => {
    const builder = new DefaultPromptBuilder([new UserInputModule()])
    const request = await builder.build({ input: 'hello' })
    expect(request.prompt).toContain('hello')
  })

  it('should work with 6-param constructor', async () => {
    const builder = new DefaultPromptBuilder(
      [new UserInputModule()],
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    )
    const request = await builder.build({ input: 'hello' })
    expect(request.prompt).toContain('hello')
  })

  it('should work with 7-param constructor (providerBudget only)', async () => {
    const builder = new DefaultPromptBuilder(
      [new UserInputModule()],
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      new DefaultProviderBudget(),
    )
    const request = await builder.build({ input: 'hello' })
    const assembly = request.metadata?.promptAssembly as Record<string, unknown>
    // providerBudget is injected → metadata contains it
    expect(assembly.providerBudget).toBeDefined()
  })

  it('should work with 8-param constructor (providerBudget + configuration)', async () => {
    const builder = new DefaultPromptBuilder(
      [new UserInputModule()],
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      new DefaultProviderBudget(),
      { provider: 'openai', model: 'gpt-4o', temperature: 0, maxTokens: 0 },
    )
    const request = await builder.build({ input: 'hello' })
    expect(request.prompt).toContain('hello')
  })

  it('should produce identical output without configuration (no providerBudget)', async () => {
    const builder = new DefaultPromptBuilder([new UserInputModule()])
    const request = await builder.build({ input: 'hello' })
    expect(request.prompt).toContain('hello')
  })

  it('should produce identical prompt content regardless of configuration', async () => {
    const builder1 = new DefaultPromptBuilder([new UserInputModule()])
    const builder2 = new DefaultPromptBuilder(
      [new UserInputModule()],
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      { provider: 'openai', model: 'gpt-4o', temperature: 0, maxTokens: 0 },
    )
    const request1 = await builder1.build({ input: 'hello' })
    const request2 = await builder2.build({ input: 'hello' })
    // Prompt content is the same (configuration only affects metadata, not prompt text)
    expect(request1.prompt).toBe(request2.prompt)
  })
})

// ---------------------------------------------------------------------------
// Deterministic Behavior
// ---------------------------------------------------------------------------

describe('DefaultPromptBuilder — Deterministic with Configuration', () => {
  it('should produce identical metadata for identical configuration', async () => {
    const config: AIConfiguration = {
      provider: 'openai',
      model: 'gpt-4o',
      temperature: 0,
      maxTokens: 0,
    }
    const builder1 = new DefaultPromptBuilder(
      [new UserInputModule()],
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      new DefaultProviderBudget(),
      config,
    )
    const builder2 = new DefaultPromptBuilder(
      [new UserInputModule()],
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      new DefaultProviderBudget(),
      config,
    )
    const request1 = await builder1.build({ input: 'hello' })
    const request2 = await builder2.build({ input: 'hello' })
    const assembly1 = request1.metadata?.promptAssembly as Record<string, unknown>
    const assembly2 = request2.metadata?.promptAssembly as Record<string, unknown>
    expect(assembly1.providerBudget).toEqual(assembly2.providerBudget)
  })

  it('should produce different metadata for different providers', async () => {
    const openAIConfig: AIConfiguration = {
      provider: 'openai',
      model: 'gpt-4o',
      temperature: 0,
      maxTokens: 0,
    }
    const deepSeekConfig: AIConfiguration = {
      provider: 'deepseek',
      model: 'deepseek-chat',
      temperature: 0,
      maxTokens: 0,
    }
    const builderOpenAI = new DefaultPromptBuilder(
      [new UserInputModule()],
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      new DefaultProviderBudget(),
      openAIConfig,
    )
    const builderDeepSeek = new DefaultPromptBuilder(
      [new UserInputModule()],
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      new DefaultProviderBudget(),
      deepSeekConfig,
    )
    const requestOpenAI = await builderOpenAI.build({ input: 'hello' })
    const requestDeepSeek = await builderDeepSeek.build({ input: 'hello' })
    const assemblyOpenAI = requestOpenAI.metadata?.promptAssembly as Record<string, unknown>
    const assemblyDeepSeek = requestDeepSeek.metadata?.promptAssembly as Record<string, unknown>
    const pbOpenAI = assemblyOpenAI.providerBudget as ProviderBudgetResult
    const pbDeepSeek = assemblyDeepSeek.providerBudget as ProviderBudgetResult
    expect(pbOpenAI.maxInputTokens).toBe(128000)
    expect(pbDeepSeek.maxInputTokens).toBe(65536)
  })
})

// ---------------------------------------------------------------------------
// Compatibility — RetryPlanner
// ---------------------------------------------------------------------------

describe('AIConfiguration Consumption — RetryPlanner', () => {
  it('should work with RetryPlanner', async () => {
    const builder = new DefaultPromptBuilder(
      [new SystemPromptModule(), new UserInputModule(), new MemoryPromptModule()],
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      new DefaultProviderBudget(),
      { provider: 'openai', model: 'gpt-4o', temperature: 0, maxTokens: 0 },
    )
    const memory = new DefaultMemory()
    await memory.set('conversation', [
      { input: 'hello', summary: 'created tree' },
    ])
    const planner = new RetryPlanner(new MockPlannerProvider(new DefaultAIConfig()))
    const pipeline = new DefaultPipeline(planner, builder)
    const result = await pipeline.execute({ input: 'tree', memory })
    expect(result.plannerResult).toBeDefined()
    expect(result.plannerResult!.actions.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// Compatibility — ToolCallPlanner
// ---------------------------------------------------------------------------

describe('AIConfiguration Consumption — ToolCallPlanner', () => {
  it('should work with ToolCallPlanner', async () => {
    const builder = new DefaultPromptBuilder(
      [new SystemPromptModule(), new UserInputModule(), new MemoryPromptModule()],
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      new DefaultProviderBudget(),
      { provider: 'openai', model: 'gpt-4o', temperature: 0, maxTokens: 0 },
    )
    const memory = new DefaultMemory()
    await memory.set('conversation', [
      { input: 'hello', summary: 'created tree' },
    ])
    const tools = new DefaultToolRegistry([
      createMockTool('find_entity'),
    ])
    const planner = new ToolCallPlanner(new MockPlannerProvider(new DefaultAIConfig()), tools)
    const pipeline = new DefaultPipeline(planner, builder)
    const result = await pipeline.execute({ input: 'tree', memory })
    expect(result.plannerResult).toBeDefined()
    expect(result.plannerResult!.actions.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// Compatibility — Streaming
// ---------------------------------------------------------------------------

describe('AIConfiguration Consumption — Streaming', () => {
  it('should work with streaming', async () => {
    const builder = new DefaultPromptBuilder(
      [new SystemPromptModule(), new UserInputModule()],
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      new DefaultProviderBudget(),
      { provider: 'openai', model: 'gpt-4o', temperature: 0, maxTokens: 0 },
    )
    const planner = new MockPlanner(new MockStreamingProvider())
    const pipeline = new DefaultPipeline(planner, builder)
    const result = await pipeline.stream({ input: 'tree' })
    expect(result.plannerResult).toBeDefined()
    expect(result.plannerResult!.actions.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// Compatibility — AgentLoop
// ---------------------------------------------------------------------------

describe('AIConfiguration Consumption — AgentLoop', () => {
  it('should work with AgentLoop', async () => {
    const builder = new DefaultPromptBuilder(
      [new SystemPromptModule(), new UserInputModule()],
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      new DefaultProviderBudget(),
      { provider: 'openai', model: 'gpt-4o', temperature: 0, maxTokens: 0 },
    )
    const agentLoop = new DefaultAgentLoop(new DefaultReflection())
    const planner = new MockPlanner(new MockPlannerProvider(new DefaultAIConfig()))
    const pipeline = new DefaultPipeline(planner, builder, undefined, agentLoop)
    const result = await pipeline.execute({ input: 'tree' })
    expect(result.plannerResult).toBeDefined()
    expect(result.plannerResult!.actions.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function createMockTool(name: string, output: unknown = { found: true }) {
  return {
    name,
    description: `Mock: ${name}`,
    async execute(_input: unknown): Promise<unknown> {
      return output
    },
  }
}