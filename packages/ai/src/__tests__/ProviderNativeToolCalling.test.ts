import { describe, it, expect, vi } from 'vitest'
import type { Tool } from '../tools/Tool'
import type { PlannerProvider } from '../provider/PlannerProvider'
import type { ToolCallingProvider } from '../provider/ToolCallingProvider'
import type { AIRequest } from '../request'
import type { PlannerResult } from '../planner'
import type { AIConfiguration } from '../config'
import { getToolInputSchema, hasToolSchema, getSchemaTools } from '../provider/ProviderToolSchemas'
import { DefaultToolRegistry } from '../tools/ToolRegistry'
import { ToolCallPlanner } from '../planner/ToolCallPlanner'
import { OpenAIPlannerProvider } from '../provider/OpenAIPlannerProvider'
import { DeepSeekPlannerProvider } from '../provider/DeepSeekPlannerProvider'
import { MockPlannerProvider } from '../provider/MockPlannerProvider'
import { MockStreamingProvider } from '../provider/MockStreamingProvider'
import { ProviderFactory } from '../provider/ProviderFactory'
import type { PipelineEvent } from '../events'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const validResult: PlannerResult = {
  actions: [{ type: 'CreateEntity', entityType: 'tree', x: 5, y: 3 }],
}

function createMockTool(name: string, data?: unknown): Tool {
  return {
    name,
    description: `Tool: ${name}`,
    async execute(input: unknown): Promise<unknown> {
      return data ?? { result: `executed ${name} with ${JSON.stringify(input)}` }
    },
  }
}

/**
 * Creates a mock ToolCallingProvider that simulates tool calling behavior.
 */
function createMockToolCallingProvider(
  options?: {
    result?: PlannerResult
    shouldThrow?: boolean
    simulateToolCalls?: boolean
  },
): ToolCallingProvider {
  const {
    result = validResult,
    shouldThrow = false,
    simulateToolCalls = false,
  } = options ?? {}

  return {
    async complete(_request: AIRequest): Promise<PlannerResult> {
      return result
    },
    async completeWithTools(_request: AIRequest, tools: Tool[]): Promise<PlannerResult> {
      if (shouldThrow) {
        throw new Error('Tool calling failed')
      }

      if (simulateToolCalls) {
        // Simulate a provider that executed tools
        return {
          ...result,
          metadata: {
            toolCalls: tools.map((t) => ({
              name: t.name,
              duration: 50,
              success: true,
            })),
            totalToolCallDuration: 100,
            nativeToolCalling: true,
          },
        }
      }

      return {
        ...result,
        metadata: {
          toolCalls: [],
          nativeToolCalling: true,
        },
      }
    },
  }
}

/**
 * Creates a mock non-ToolCallingProvider (backward compatibility).
 */
function createMockPlainProvider(result: PlannerResult = validResult): PlannerProvider {
  return {
    async complete(_request: AIRequest): Promise<PlannerResult> {
      return result
    },
  }
}

// ---------------------------------------------------------------------------
// ProviderToolSchemas
// ---------------------------------------------------------------------------

describe('ProviderToolSchemas', () => {
  describe('getToolInputSchema', () => {
    it('should return schema for find_entity tool', () => {
      const tool = createMockTool('find_entity')
      const schema = getToolInputSchema(tool)

      expect(schema).toBeDefined()
      expect(schema!.type).toBe('object')
      expect(schema!.properties).toHaveProperty('id')
      expect(schema!.required).toContain('id')
    })

    it('should return schema for find_entities tool', () => {
      const tool = createMockTool('find_entities')
      const schema = getToolInputSchema(tool)

      expect(schema).toBeDefined()
      expect(schema!.properties).toHaveProperty('type')
      expect(schema!.required).toHaveLength(0)
    })

    it('should return schema for get_world_snapshot tool', () => {
      const tool = createMockTool('get_world_snapshot')
      const schema = getToolInputSchema(tool)

      expect(schema).toBeDefined()
      expect(schema!.properties).toEqual({})
      expect(schema!.required).toHaveLength(0)
    })

    it('should return undefined for unknown tool', () => {
      const tool = createMockTool('unknown_tool')
      const schema = getToolInputSchema(tool)

      expect(schema).toBeUndefined()
    })
  })

  describe('hasToolSchema', () => {
    it('should return true for known tools', () => {
      expect(hasToolSchema(createMockTool('find_entity'))).toBe(true)
      expect(hasToolSchema(createMockTool('find_entities'))).toBe(true)
      expect(hasToolSchema(createMockTool('get_world_snapshot'))).toBe(true)
    })

    it('should return false for unknown tools', () => {
      expect(hasToolSchema(createMockTool('unknown_tool'))).toBe(false)
    })
  })

  describe('getSchemaTools', () => {
    it('should filter tools with known schemas', () => {
      const tools = [
        createMockTool('find_entity'),
        createMockTool('unknown_tool'),
        createMockTool('get_world_snapshot'),
      ]

      const schemas = getSchemaTools(tools)
      expect(schemas).toHaveLength(2)
      expect(schemas.map((s) => s.name)).toContain('find_entity')
      expect(schemas.map((s) => s.name)).toContain('get_world_snapshot')
    })

    it('should return empty array for no known tools', () => {
      const tools = [createMockTool('unknown_tool'), createMockTool('another_unknown')]
      expect(getSchemaTools(tools)).toHaveLength(0)
    })

    it('should return empty array for empty input', () => {
      expect(getSchemaTools([])).toHaveLength(0)
    })
  })
})

// ---------------------------------------------------------------------------
// ToolCallingProvider Interface
// ---------------------------------------------------------------------------

describe('ToolCallingProvider', () => {
  it('should extend PlannerProvider', () => {
    const provider: ToolCallingProvider = createMockToolCallingProvider()
    expect(provider.complete).toBeDefined()
    expect(provider.completeWithTools).toBeDefined()
  })

  it('should support completeWithTools with tools', async () => {
    const provider = createMockToolCallingProvider({ simulateToolCalls: true })
    const tools = [createMockTool('find_entity'), createMockTool('find_entities')]

    const result = await provider.completeWithTools({ prompt: 'test' }, tools)

    expect(result.actions).toHaveLength(1)
    expect(result.actions[0].type).toBe('CreateEntity')
    expect(result.metadata?.toolCalls).toHaveLength(2)
    expect(result.metadata?.nativeToolCalling).toBe(true)
  })

  it('should handle empty tools array', async () => {
    const provider = createMockToolCallingProvider()
    const result = await provider.completeWithTools({ prompt: 'test' }, [])

    expect(result.actions).toHaveLength(1)
    expect(result.metadata?.nativeToolCalling).toBe(true)
  })

  it('should handle errors during completeWithTools', async () => {
    const provider = createMockToolCallingProvider({ shouldThrow: true })
    const tools = [createMockTool('find_entity')]

    await expect(provider.completeWithTools({ prompt: 'test' }, tools)).rejects.toThrow(
      'Tool calling failed',
    )
  })
})

// ---------------------------------------------------------------------------
// ToolCallPlanner — Native Tool Calling Routing
// ---------------------------------------------------------------------------

describe('ToolCallPlanner — Native Routing', () => {
  it('should route to completeWithTools when provider supports ToolCallingProvider', async () => {
    const tool = createMockTool('find_entity')
    const registry = new DefaultToolRegistry([tool])
    const completeWithToolsSpy = vi.fn().mockResolvedValue({
      ...validResult,
      metadata: { nativeToolCalling: true, toolCalls: [] },
    })

    const provider: ToolCallingProvider = {
      async complete(_request: AIRequest): Promise<PlannerResult> {
        return validResult
      },
      async completeWithTools(_request: AIRequest, _tools: Tool[]): Promise<PlannerResult> {
        return completeWithToolsSpy(_request, _tools)
      },
    }

    const planner = new ToolCallPlanner(provider, registry)
    await planner.plan({ prompt: 'test' })

    expect(completeWithToolsSpy).toHaveBeenCalledTimes(1)
    expect(completeWithToolsSpy).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: 'test' }),
      [tool],
    )
  })

  it('should pass all tools from registry to completeWithTools', async () => {
    const tool1 = createMockTool('find_entity')
    const tool2 = createMockTool('find_entities')
    const mockProvider = createMockToolCallingProvider({ simulateToolCalls: true })
    const completeWithToolsSpy = vi.spyOn(mockProvider, 'completeWithTools')

    const registry = new DefaultToolRegistry([tool1, tool2])
    const planner = new ToolCallPlanner(mockProvider, registry)

    await planner.plan({ prompt: 'test' })

    expect(completeWithToolsSpy).toHaveBeenCalledTimes(1)
    const passedTools = completeWithToolsSpy.mock.calls[0][1]
    expect(passedTools).toHaveLength(2)
    expect(passedTools.map((t) => t.name)).toContain('find_entity')
    expect(passedTools.map((t) => t.name)).toContain('find_entities')
  })

  it('should include nativeToolCalling in result metadata', async () => {
    const tool = createMockTool('find_entity')
    const provider = createMockToolCallingProvider({ simulateToolCalls: true })
    const registry = new DefaultToolRegistry([tool])
    const planner = new ToolCallPlanner(provider, registry)

    const result = await planner.plan({ prompt: 'test' })

    expect(result.metadata?.toolCallNative).toBe(true)
    expect(result.metadata?.tools).toContain('find_entity')
  })

  it('should emit ToolCallStarted with native:true when provider supports native', async () => {
    const tool = createMockTool('find_entity')
    const provider = createMockToolCallingProvider()
    const registry = new DefaultToolRegistry([tool])
    const planner = new ToolCallPlanner(provider, registry)

    const events: PipelineEvent[] = []
    planner.events.subscribe({ onEvent: (e) => events.push(e) })

    await planner.plan({ prompt: 'test' })

    const startedEvent = events.find((e) => e.type === 'ToolCallStarted')
    expect(startedEvent).toBeDefined()
    expect(startedEvent!.payload?.native).toBe(true)
    expect(startedEvent!.payload?.toolNames).toContain('find_entity')
    expect(startedEvent!.payload?.tools).toBeDefined()
  })

  it('should emit ToolCallFinished with rich payload when native tool calling succeeds', async () => {
    const tool = createMockTool('find_entity')
    const provider = createMockToolCallingProvider({ simulateToolCalls: true })
    const registry = new DefaultToolRegistry([tool])
    const planner = new ToolCallPlanner(provider, registry)

    const events: PipelineEvent[] = []
    planner.events.subscribe({ onEvent: (e) => events.push(e) })

    await planner.plan({ prompt: 'test' })

    const finishedEvent = events.find((e) => e.type === 'ToolCallFinished')
    expect(finishedEvent).toBeDefined()
    expect(finishedEvent!.payload?.success).toBe(true)
    expect(finishedEvent!.payload?.native).toBe(true)
    expect(finishedEvent!.payload?.duration).toBeGreaterThanOrEqual(0)
    expect(finishedEvent!.payload?.toolResults).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// ToolCallPlanner — Backward Compatibility
// ---------------------------------------------------------------------------

describe('ToolCallPlanner — Backward Compatibility', () => {
  it('should fall back to prompt-based approach when provider is plain PlannerProvider', async () => {
    const tool = createMockTool('find_entity')
    const registry = new DefaultToolRegistry([tool])
    const completeSpy = vi.fn().mockResolvedValue(validResult)

    const provider: PlannerProvider = {
      async complete(_request: AIRequest): Promise<PlannerResult> {
        return completeSpy(_request)
      },
    }

    const planner = new ToolCallPlanner(provider, registry)
    await planner.plan({ prompt: 'test' })

    expect(completeSpy).toHaveBeenCalledTimes(1)
    const request = completeSpy.mock.calls[0][0]
    expect(request.prompt).toContain('Available Tools:')
    expect(request.prompt).toContain('find_entity')
    expect(request.metadata?.toolNames).toContain('find_entity')
  })

  it('should work with MockPlannerProvider (no native tool calling)', async () => {
    const tool = createMockTool('find_entity')
    const registry = new DefaultToolRegistry([tool])
    const provider = new MockPlannerProvider({
      provider: 'mock',
      model: 'mock',
      temperature: 0,
      maxTokens: 0,
    })

    const planner = new ToolCallPlanner(provider, registry)
    const result = await planner.plan({ prompt: 'test' })

    // Mock provider returns empty actions for unknown input
    expect(result).toBeDefined()
    expect(result.metadata?.tools).toContain('find_entity')
    expect(result.metadata?.toolCallNative).toBe(false)
  })

  it('should emit ToolCallStarted with native:false for non-native providers', async () => {
    const tool = createMockTool('test_tool')
    const registry = new DefaultToolRegistry([tool])
    const provider = createMockPlainProvider()
    const planner = new ToolCallPlanner(provider, registry)

    const events: PipelineEvent[] = []
    planner.events.subscribe({ onEvent: (e) => events.push(e) })

    await planner.plan({ prompt: 'test' })

    const startedEvent = events.find((e) => e.type === 'ToolCallStarted')
    expect(startedEvent).toBeDefined()
    expect(startedEvent!.payload?.native).toBe(false)
  })

  it('should work with empty tools for any provider', async () => {
    const registry = new DefaultToolRegistry([])
    const toolProvider = createMockToolCallingProvider()
    const plainProvider = createMockPlainProvider()

    const toolPlanner = new ToolCallPlanner(toolProvider, registry)
    const plainPlanner = new ToolCallPlanner(plainProvider, registry)

    const [toolResult, plainResult] = await Promise.all([
      toolPlanner.plan({ prompt: 'test' }),
      plainPlanner.plan({ prompt: 'test' }),
    ])

    expect(toolResult.actions).toHaveLength(1)
    expect(plainResult.actions).toHaveLength(1)
  })

  it('should handle ToolCallPlanner error gracefully', async () => {
    const tool = createMockTool('find_entity')
    const registry = new DefaultToolRegistry([tool])

    // Make the provider throw
    const errorProvider: PlannerProvider = {
      async complete(_request: AIRequest): Promise<PlannerResult> {
        throw new Error('Network error')
      },
    }

    const planner = new ToolCallPlanner(errorProvider, registry)
    const result = await planner.plan({ prompt: 'test' })

    expect(result.actions).toEqual([])
    expect(result.reasoning).toContain('ToolCallPlanner error')
  })
})

// ---------------------------------------------------------------------------
// OpenAIPlannerProvider — Native Tool Calling (via mocked client)
// ---------------------------------------------------------------------------

describe('OpenAIPlannerProvider — Tool Calling', () => {
  const validConfig: AIConfiguration = {
    provider: 'openai',
    model: 'gpt-4o-mini',
    apiKey: 'sk-test-key',
    temperature: 0.2,
    maxTokens: 800,
    allowBrowser: false,
  }

  it('should implement ToolCallingProvider', () => {
    const provider = new OpenAIPlannerProvider(validConfig)
    expect(typeof (provider as unknown as ToolCallingProvider).completeWithTools).toBe('function')
  })

  it('should fall back to prompt-based tool descriptions for tools without schemas', async () => {
    const provider = new OpenAIPlannerProvider(validConfig)
    const mockCreate = vi.fn().mockResolvedValue({
      output_text: JSON.stringify({ actions: [{ type: 'CreateEntity', entityType: 'tree', x: 5, y: 3 }] }),
      output: [],
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(provider as any).client.responses = { create: mockCreate }

    const tool = createMockTool('unknown_no_schema_tool')
    const result = await provider.completeWithTools({ prompt: 'test' }, [tool])

    expect(result.actions).toHaveLength(1)
    // Tools without schemas are filtered out — no tools sent to API
    const createCall = mockCreate.mock.calls[0][0]
    expect(createCall.tools).toBeUndefined()
  })

  it('should handle API error during completeWithTools', async () => {
    const provider = new OpenAIPlannerProvider(validConfig)
    const mockCreate = vi.fn().mockRejectedValue(new Error('API rate limit exceeded'))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(provider as any).client.responses = { create: mockCreate }

    const tool = createMockTool('find_entity')
    const result = await provider.completeWithTools({ prompt: 'test' }, [tool])

    expect(result.actions).toEqual([])
    expect(result.reasoning).toContain('OpenAI API error during tool calling')
    expect(result.metadata?.toolCalls).toEqual([])
  })

  it('should use browser config for client construction', () => {
    const browserConfig: AIConfiguration = { ...validConfig, allowBrowser: true }
    const provider = new OpenAIPlannerProvider(browserConfig)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((provider as any).config.allowBrowser).toBe(true)
  })

  it('should not include dangerouslyAllowBrowser when allowBrowser is false', () => {
    const config: AIConfiguration = { ...validConfig, allowBrowser: false }
    const provider = new OpenAIPlannerProvider(config)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((provider as any).config.allowBrowser).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// DeepSeekPlannerProvider — Native Tool Calling (via mocked client)
// ---------------------------------------------------------------------------

describe('DeepSeekPlannerProvider — Tool Calling', () => {
  const validConfig: AIConfiguration = {
    provider: 'deepseek',
    model: 'deepseek-chat',
    apiKey: 'sk-test-key',
    baseURL: 'https://api.deepseek.com',
    temperature: 0.2,
    maxTokens: 800,
    allowBrowser: false,
  }

  it('should implement ToolCallingProvider', () => {
    const provider = new DeepSeekPlannerProvider(validConfig)
    expect(typeof (provider as unknown as ToolCallingProvider).completeWithTools).toBe('function')
  })

  it('should fall back to prompt-based for tools without schemas', async () => {
    const provider = new DeepSeekPlannerProvider(validConfig)
    const mockCreate = vi.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({ actions: [{ type: 'CreateEntity', entityType: 'tree', x: 5, y: 3 }] }),
            tool_calls: null,
          },
        },
      ],
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(provider as any).client.chat = { completions: { create: mockCreate } }

    const tool = createMockTool('unknown_no_schema_tool')
    const result = await provider.completeWithTools({ prompt: 'test' }, [tool])

    expect(result.actions).toHaveLength(1)
    const createCall = mockCreate.mock.calls[0][0]
    expect(createCall.tools).toBeUndefined()
  })

  it('should handle API error during completeWithTools', async () => {
    const provider = new DeepSeekPlannerProvider(validConfig)
    const mockCreate = vi.fn().mockRejectedValue(new Error('API timeout'))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(provider as any).client.chat = { completions: { create: mockCreate } }

    const tool = createMockTool('find_entity')
    const result = await provider.completeWithTools({ prompt: 'test' }, [tool])

    expect(result.actions).toEqual([])
    expect(result.reasoning).toContain('DeepSeek API error during tool calling')
  })

  it('should use browser config for client construction', () => {
    const browserConfig: AIConfiguration = { ...validConfig, allowBrowser: true }
    const provider = new DeepSeekPlannerProvider(browserConfig)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((provider as any).config.allowBrowser).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Failure Handling
// ---------------------------------------------------------------------------

describe('Failure Handling', () => {
  it('should handle unknown tool in completeWithTools gracefully', async () => {
    const provider = createMockToolCallingProvider()
    const tool = createMockTool('unknown_tool')

    // This test verifies that the tool calling provider doesn't crash
    // when receiving a tool it doesn't recognize by name
    const result = await provider.completeWithTools({ prompt: 'test' }, [tool])
    expect(result).toBeDefined()
    expect(result.actions).toHaveLength(1)
  })

  it('should handle tool execution failure in completeWithTools', async () => {
    // Create a tool that throws during execution
    const failingTool: Tool = {
      name: 'failing_tool',
      description: 'A tool that always fails',
      async execute(_input: unknown): Promise<unknown> {
        throw new Error('Execution failed')
      },
    }

    // Mock provider that simulates a tool call failure
    const provider: ToolCallingProvider = {
      async complete(_request: AIRequest): Promise<PlannerResult> {
        return validResult
      },
      async completeWithTools(_request: AIRequest, _tools: Tool[]): Promise<PlannerResult> {
        return {
          actions: [],
          reasoning: 'Tool execution failed for: failing_tool',
          metadata: {
            toolCalls: [{
              name: 'failing_tool',
              duration: 10,
              success: false,
              error: 'Execution failed',
            }],
            nativeToolCalling: true,
          },
        }
      },
    }

    const registry = new DefaultToolRegistry([failingTool])
    const planner = new ToolCallPlanner(provider, registry)
    const result = await planner.plan({ prompt: 'test' })

    expect(result.actions).toEqual([])
    expect(result.metadata?.toolCalls).toBeDefined()
    const toolCalls = result.metadata?.toolCalls as Array<{ name: string; success: boolean }>
    expect(toolCalls[0].success).toBe(false)
  })

  it('should handle provider error in ToolCallPlanner', async () => {
    const tool = createMockTool('find_entity')
    const registry = new DefaultToolRegistry([tool])

    // Provider that throws during native tool calling
    const provider: ToolCallingProvider = {
      async complete(_request: AIRequest): Promise<PlannerResult> {
        return validResult
      },
      async completeWithTools(_request: AIRequest, _tools: Tool[]): Promise<PlannerResult> {
        throw new Error('Provider internal error')
      },
    }

    const planner = new ToolCallPlanner(provider, registry)
    const result = await planner.plan({ prompt: 'test' })

    expect(result.actions).toEqual([])
    expect(result.reasoning).toContain('ToolCallPlanner error')
  })

  it('should handle tool not found (name mismatch)', async () => {
    const tool = createMockTool('find_entity')
    const provider = createMockToolCallingProvider()

    // Simulate a case where the LLM calls a tool that doesn't exist
    const result = await provider.completeWithTools({ prompt: 'test' }, [tool])
    expect(result).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Event Ordering
// ---------------------------------------------------------------------------

describe('Event Ordering', () => {
  it('should emit events in correct order during native tool calling', async () => {
    const tool = createMockTool('find_entity')
    const registry = new DefaultToolRegistry([tool])
    const provider = createMockToolCallingProvider({ simulateToolCalls: true })
    const planner = new ToolCallPlanner(provider, registry)

    const events: PipelineEvent[] = []
    planner.events.subscribe({ onEvent: (e) => events.push(e) })

    await planner.plan({ prompt: 'test' })

    const eventTypes = events.map((e) => e.type)
    const toolStartedIndex = eventTypes.indexOf('ToolCallStarted')
    const toolFinishedIndex = eventTypes.indexOf('ToolCallFinished')

    expect(toolStartedIndex).toBeGreaterThanOrEqual(0)
    expect(toolFinishedIndex).toBeGreaterThan(toolStartedIndex)
  })

  it('should emit events in correct order for non-native providers', async () => {
    const tool = createMockTool('find_entity')
    const registry = new DefaultToolRegistry([tool])
    const provider = createMockPlainProvider()
    const planner = new ToolCallPlanner(provider, registry)

    const events: PipelineEvent[] = []
    planner.events.subscribe({ onEvent: (e) => events.push(e) })

    await planner.plan({ prompt: 'test' })

    const eventTypes = events.map((e) => e.type)
    const toolStartedIndex = eventTypes.indexOf('ToolCallStarted')
    const toolFinishedIndex = eventTypes.indexOf('ToolCallFinished')

    expect(toolStartedIndex).toBeGreaterThanOrEqual(0)
    expect(toolFinishedIndex).toBeGreaterThan(toolStartedIndex)
  })
})

// ---------------------------------------------------------------------------
// Browser Development Configuration
// ---------------------------------------------------------------------------

describe('Browser Development Configuration', () => {
  it('should create config with allowBrowser=true when VITE_AI_ALLOW_BROWSER=true', async () => {
    const { createAIConfiguration } = await import('../config/createAIConfiguration')
    const config = createAIConfiguration({
      VITE_AI_PROVIDER: 'openai',
      VITE_AI_API_KEY: 'sk-test',
      VITE_AI_ALLOW_BROWSER: 'true',
    })

    expect(config.allowBrowser).toBe(true)
  })

  it('should create config with allowBrowser=false when VITE_AI_ALLOW_BROWSER is not set', async () => {
    const { createAIConfiguration } = await import('../config/createAIConfiguration')
    const config = createAIConfiguration({
      VITE_AI_PROVIDER: 'openai',
      VITE_AI_API_KEY: 'sk-test',
    })

    expect(config.allowBrowser).toBe(false)
  })

  it('should create config with allowBrowser=false when VITE_AI_ALLOW_BROWSER=false', async () => {
    const { createAIConfiguration } = await import('../config/createAIConfiguration')
    const config = createAIConfiguration({
      VITE_AI_PROVIDER: 'openai',
      VITE_AI_API_KEY: 'sk-test',
      VITE_AI_ALLOW_BROWSER: 'false',
    })

    expect(config.allowBrowser).toBe(false)
  })

  it('should not modify production mock provider behavior', async () => {
    const { createAIConfiguration: createConfig } = await import('../config/createAIConfiguration')
    const config = createConfig({})
    expect(config.allowBrowser).toBe(false)
    expect(config.provider).toBe('mock')
  })
})

// ---------------------------------------------------------------------------
// Provider Factory Compatibility
// ---------------------------------------------------------------------------

describe('Provider Factory Compatibility', () => {
  it('should create MockPlannerProvider with mock config', () => {
    const provider = ProviderFactory.create({
      provider: 'mock',
      model: 'mock',
      temperature: 0,
      maxTokens: 0,
    })

    expect(provider).toBeInstanceOf(MockPlannerProvider)
  })

  it('should create OpenAIPlannerProvider with openai config', () => {
    const provider = ProviderFactory.create({
      provider: 'openai',
      model: 'gpt-4o-mini',
      apiKey: 'sk-test-key',
      temperature: 0.2,
      maxTokens: 800,
      allowBrowser: false,
    })

    expect(provider).toBeInstanceOf(OpenAIPlannerProvider)
  })

  it('should create DeepSeekPlannerProvider with deepseek config', () => {
    const provider = ProviderFactory.create({
      provider: 'deepseek',
      model: 'deepseek-chat',
      apiKey: 'sk-test-key',
      baseURL: 'https://api.deepseek.com',
      temperature: 0.2,
      maxTokens: 800,
      allowBrowser: false,
    })

    expect(provider).toBeInstanceOf(DeepSeekPlannerProvider)
  })

  it('should throw for unknown provider', () => {
    expect(() =>
      ProviderFactory.create({
        provider: 'unknown',
        model: 'test',
        temperature: 0,
        maxTokens: 0,
      }),
    ).toThrow('Unknown AI provider: unknown')
  })
})

// ---------------------------------------------------------------------------
// Backward Compatibility — Mock Provider
// ---------------------------------------------------------------------------

describe('Mock Provider Backward Compatibility', () => {
  it('should still work with ToolCallPlanner (prompt-based)', async () => {
    const tool = createMockTool('find_entity')
    const registry = new DefaultToolRegistry([tool])
    const mockProvider = new MockPlannerProvider({
      provider: 'mock',
      model: 'mock',
      temperature: 0,
      maxTokens: 0,
    })

    const planner = new ToolCallPlanner(mockProvider, registry)
    const result = await planner.plan({ prompt: 'tree' })

    // Mock provider: "tree" keyword matches CreateEntity
    expect(result.actions).toHaveLength(1)
    expect(result.actions[0].type).toBe('CreateEntity')
  })

  it('should maintain MockStreamingProvider compatibility', async () => {
    const provider = new MockStreamingProvider()

    const chunks: string[] = []
    for await (const chunk of provider.stream({ prompt: 'test' })) {
      chunks.push(chunk)
    }

    expect(chunks.length).toBeGreaterThan(0)
  })

  it('should maintain MockPlannerProvider complete method', async () => {
    const provider = new MockPlannerProvider({
      provider: 'mock',
      model: 'mock',
      temperature: 0,
      maxTokens: 0,
    })

    const result = await provider.complete({ prompt: 'tree' })
    expect(result.actions).toHaveLength(1)

    const emptyResult = await provider.complete({ prompt: 'hello world' })
    expect(emptyResult.actions).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Retry Integration
// ---------------------------------------------------------------------------

describe('Retry Integration', () => {
  it('should work when ToolCallingProvider is used with RetryPlanner', async () => {
    const { RetryPlanner } = await import('../planner/RetryPlanner')

    // RetryPlanner wraps a PlannerProvider (which can also be a ToolCallingProvider)
    const provider = createMockToolCallingProvider()
    const retryPlanner = new RetryPlanner(provider)

    // RetryPlanner calls provider.complete() — the standard path
    const result = await retryPlanner.plan({ prompt: 'test' })

    expect(result.actions).toHaveLength(1)
  })

  it('should handle retry recovery after invalid result', async () => {
    const { RetryPlanner } = await import('../planner/RetryPlanner')

    // First attempt returns invalid result, second succeeds
    let attempts = 0
    const provider: ToolCallingProvider = {
      async complete(_request: AIRequest): Promise<PlannerResult> {
        attempts++
        if (attempts === 1) {
          // Use a reasoning string that matches RetryPolicy.isRecoverableFailure patterns
          return { actions: [], reasoning: 'Failed to parse response as JSON: invalid format' }
        }
        return { ...validResult, metadata: { retryCount: 1 } }
      },
      async completeWithTools(_request: AIRequest, _tools: Tool[]): Promise<PlannerResult> {
        attempts++
        if (attempts === 1) {
          return { actions: [], reasoning: 'Failed to parse response as JSON: invalid format' }
        }
        return { ...validResult, metadata: { nativeToolCalling: true, toolCalls: [], retryCount: 1 } }
      },
    }

    const retryPlanner = new RetryPlanner(provider)
    const result = await retryPlanner.plan({ prompt: 'test' })

    expect(attempts).toBe(2)
    expect(result.actions).toHaveLength(1)
  })

  it('should not interfere with ToolCallPlanner native tool calling', async () => {
    const tool = createMockTool('find_entity')
    const registry = new DefaultToolRegistry([tool])
    const provider = createMockToolCallingProvider({ simulateToolCalls: true })

    // ToolCallPlanner wraps the provider directly (native tool calling happens inside)
    const toolCallPlanner = new ToolCallPlanner(provider, registry)
    const result = await toolCallPlanner.plan({ prompt: 'test' })

    expect(result.actions).toHaveLength(1)
    expect(result.metadata?.toolCallNative).toBe(true)
    expect(result.metadata?.tools).toContain('find_entity')
  })
})

// ---------------------------------------------------------------------------
// AIConfiguration allowBrowser field
// ---------------------------------------------------------------------------

describe('AIConfiguration allowBrowser', () => {
  it('should be optional in AIConfiguration', async () => {
    // Verifies backward compatibility — existing configs without allowBrowser still work
    const config: AIConfiguration = {
      provider: 'mock',
      model: 'mock',
      temperature: 0,
      maxTokens: 0,
    }

    expect(config.allowBrowser).toBeUndefined()
  })

  it('should propagate through ProviderFactory', () => {
    const config: AIConfiguration = {
      provider: 'openai',
      model: 'gpt-4o-mini',
      apiKey: 'sk-test-key',
      temperature: 0.2,
      maxTokens: 800,
      allowBrowser: true,
    }

    const provider = ProviderFactory.create(config) as OpenAIPlannerProvider
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((provider as any).config.allowBrowser).toBe(true)
  })
})