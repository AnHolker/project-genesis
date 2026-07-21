import { describe, it, expect, vi } from 'vitest'
import { ToolCallPlanner } from '../planner/ToolCallPlanner'
import { DefaultToolRegistry } from '../tools/ToolRegistry'
import { MockFindEntityTool } from '../tools/MockFindEntityTool'
import type { Tool } from '../tools/Tool'
import type { PlannerProvider } from '../provider/PlannerProvider'
import type { AIRequest } from '../request'
import type { PlannerResult } from '../planner'
import type { PipelineEvent } from '../events'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const validResult: PlannerResult = {
  actions: [{ type: 'CreateEntity', entityType: 'tree', x: 5, y: 3 }],
}

/**
 * Creates a simple mock provider that returns a fixed result.
 */
function createMockProvider(result: PlannerResult = validResult): PlannerProvider {
  return {
    async complete(_request: AIRequest): Promise<PlannerResult> {
      return result
    },
  }
}

/**
 * Creates a mock tool for testing.
 */
function createMockTool(name: string, data?: unknown): Tool {
  return {
    name,
    description: `Tool: ${name}`,
    async execute(input: unknown): Promise<unknown> {
      return data ?? { result: `executed ${name} with ${JSON.stringify(input)}` }
    },
  }
}

// ---------------------------------------------------------------------------
// DefaultToolRegistry — Registration & Lookup
// ---------------------------------------------------------------------------

describe('DefaultToolRegistry', () => {
  describe('tool registration', () => {
    it('should register tools and return them via getTools()', () => {
      const tool1 = createMockTool('tool_a')
      const tool2 = createMockTool('tool_b')
      const registry = new DefaultToolRegistry([tool1, tool2])

      const tools = registry.getTools()

      expect(tools).toHaveLength(2)
      expect(tools.map((t) => t.name)).toContain('tool_a')
      expect(tools.map((t) => t.name)).toContain('tool_b')
    })

    it('should return empty array when no tools are registered', () => {
      const registry = new DefaultToolRegistry()
      expect(registry.getTools()).toHaveLength(0)
    })

    it('should handle an empty constructor array', () => {
      const registry = new DefaultToolRegistry([])
      expect(registry.getTools()).toHaveLength(0)
    })

    it('should support registering a single tool', () => {
      const tool = createMockTool('single_tool')
      const registry = new DefaultToolRegistry([tool])
      expect(registry.getTools()).toHaveLength(1)
      expect(registry.getTools()[0].name).toBe('single_tool')
    })
  })

  describe('registry lookup', () => {
    it('should find a tool by name', () => {
      const tool1 = createMockTool('find_entity')
      const tool2 = createMockTool('move_entity')
      const registry = new DefaultToolRegistry([tool1, tool2])

      const found = registry.findTool('find_entity')
      expect(found).toBeDefined()
      expect(found!.name).toBe('find_entity')
      expect(found!.description).toBe('Tool: find_entity')
    })

    it('should return undefined for unknown tool name', () => {
      const tool = createMockTool('known_tool')
      const registry = new DefaultToolRegistry([tool])

      const found = registry.findTool('unknown_tool')
      expect(found).toBeUndefined()
    })

    it('should return undefined when registry is empty', () => {
      const registry = new DefaultToolRegistry()
      expect(registry.findTool('anything')).toBeUndefined()
    })

    it('should return the same tool instance via getTools() and findTool()', () => {
      const tool = createMockTool('same_ref')
      const registry = new DefaultToolRegistry([tool])

      const fromGet = registry.getTools()[0]
      const fromFind = registry.findTool('same_ref')

      expect(fromGet).toBe(fromFind)
    })
  })
})

// ---------------------------------------------------------------------------
// MockFindEntityTool
// ---------------------------------------------------------------------------

describe('MockFindEntityTool', () => {
  it('should have correct name and description', () => {
    const tool = new MockFindEntityTool()
    expect(tool.name).toBe('find_entity')
    expect(tool.description).toBeTruthy()
    expect(tool.description.length).toBeGreaterThan(10)
  })

  it('should return mocked entity data on execute', async () => {
    const tool = new MockFindEntityTool()
    const result = await tool.execute({ id: 'test-id' })

    expect(result).toEqual({
      id: 'entity-1',
      type: 'tree',
      x: 5,
      y: 3,
    })
  })

  it('should return same data regardless of input', async () => {
    const tool = new MockFindEntityTool()

    const result1 = await tool.execute({ id: 'anything' })
    const result2 = await tool.execute({ name: 'something' })
    const result3 = await tool.execute(null)

    expect(result1).toEqual(result2)
    expect(result2).toEqual(result3)
  })
})

// ---------------------------------------------------------------------------
// ToolCallPlanner — Planner receives registry
// ---------------------------------------------------------------------------

describe('ToolCallPlanner', () => {
  describe('planner receives registry', () => {
    it('should call provider.complete with the AIRequest', async () => {
      const provider = createMockProvider()
      const completeSpy = vi.spyOn(provider, 'complete')
      const registry = new DefaultToolRegistry([createMockTool('test_tool')])
      const planner = new ToolCallPlanner(provider, registry)

      await planner.plan({ prompt: 'create a tree' })

      expect(completeSpy).toHaveBeenCalledTimes(1)
      completeSpy.mockRestore()
    })

    it('should return the provider result with tool metadata', async () => {
      const provider = createMockProvider()
      const registry = new DefaultToolRegistry([createMockTool('find_entity')])
      const planner = new ToolCallPlanner(provider, registry)

      const result = await planner.plan({ prompt: 'create a tree' })

      expect(result.actions).toHaveLength(1)
      expect(result.actions[0].type).toBe('CreateEntity')
      expect(result.metadata).toBeDefined()
      expect(result.metadata!.tools).toEqual(['find_entity'])
    })

    it('should add tool descriptions to the provider prompt', async () => {
      const completeMock = vi.fn()
      const provider: PlannerProvider = {
        async complete(request: AIRequest): Promise<PlannerResult> {
          completeMock(request.prompt)
          return validResult
        },
      }
      const registry = new DefaultToolRegistry([createMockTool('find_entity')])
      const planner = new ToolCallPlanner(provider, registry)

      await planner.plan({ prompt: 'create a tree' })

      const sentPrompt = completeMock.mock.calls[0][0]
      expect(sentPrompt).toContain('create a tree')
      expect(sentPrompt).toContain('Available Tools:')
      expect(sentPrompt).toContain('find_entity')
    })

    it('should include tool names in request metadata', async () => {
      const completeMock = vi.fn()
      const provider: PlannerProvider = {
        async complete(request: AIRequest): Promise<PlannerResult> {
          completeMock(request.metadata)
          return validResult
        },
      }
      const registry = new DefaultToolRegistry([createMockTool('find_entity')])
      const planner = new ToolCallPlanner(provider, registry)

      await planner.plan({ prompt: 'do something' })

      const sentMetadata = completeMock.mock.calls[0][0]
      expect(sentMetadata).toBeDefined()
      expect(sentMetadata!.toolNames).toEqual(['find_entity'])
    })
  })

  // -----------------------------------------------------------------------
  // Backward Compatibility
  // -----------------------------------------------------------------------

  describe('backward compatibility', () => {
    it('should work without any tools registered', async () => {
      const provider = createMockProvider()
      const registry = new DefaultToolRegistry()
      const planner = new ToolCallPlanner(provider, registry)

      const result = await planner.plan({ prompt: 'create a tree' })

      expect(result.actions).toHaveLength(1)
      expect(result.actions[0].type).toBe('CreateEntity')
    })

    it('should not add tool block to prompt when no tools registered', async () => {
      const completeMock = vi.fn()
      const provider: PlannerProvider = {
        async complete(request: AIRequest): Promise<PlannerResult> {
          completeMock(request.prompt)
          return validResult
        },
      }
      const registry = new DefaultToolRegistry()
      const planner = new ToolCallPlanner(provider, registry)

      await planner.plan({ prompt: 'original prompt' })

      const sentPrompt = completeMock.mock.calls[0][0]
      expect(sentPrompt).toBe('original prompt')
      expect(sentPrompt).not.toContain('Available Tools:')
    })

    it('should set tools to empty array in metadata when no tools', async () => {
      const provider = createMockProvider()
      const registry = new DefaultToolRegistry()
      const planner = new ToolCallPlanner(provider, registry)

      const result = await planner.plan({ prompt: 'hello' })

      expect(result.metadata!.tools).toEqual([])
    })

    it('should work with MockPlannerProvider', async () => {
      const { MockPlannerProvider } = await import('../provider/MockPlannerProvider')
      const { DefaultAIConfiguration } = await import('../config/DefaultAIConfiguration')
      const provider = new MockPlannerProvider(new DefaultAIConfiguration())
      const registry = new DefaultToolRegistry([new MockFindEntityTool()])
      const planner = new ToolCallPlanner(provider, registry)

      const result = await planner.plan({ prompt: 'create a tree' })

      expect(result.actions).toHaveLength(1)
      expect(result.actions[0].type).toBe('CreateEntity')
      expect(result.metadata!.tools).toEqual(['find_entity'])
    })
  })

  // -----------------------------------------------------------------------
  // Mock Tool Execution
  // -----------------------------------------------------------------------

  describe('mock tool execution', () => {
    it('should execute MockFindEntityTool and return mocked data', async () => {
      const tool = new MockFindEntityTool()
      const result = await tool.execute({ id: 'anything' })

      expect(result).toHaveProperty('id', 'entity-1')
      expect(result).toHaveProperty('type', 'tree')
      expect(result).toHaveProperty('x', 5)
      expect(result).toHaveProperty('y', 3)
    })

    it('should register MockFindEntityTool in registry', () => {
      const registry = new DefaultToolRegistry([new MockFindEntityTool()])

      const tools = registry.getTools()
      expect(tools).toHaveLength(1)
      expect(tools[0].name).toBe('find_entity')

      const found = registry.findTool('find_entity')
      expect(found).toBeDefined()
      expect(found!.description).toContain('entity')
    })

    it('should expose MockFindEntityTool through ToolCallPlanner metadata', async () => {
      const provider = createMockProvider()
      const registry = new DefaultToolRegistry([new MockFindEntityTool()])
      const planner = new ToolCallPlanner(provider, registry)

      const result = await planner.plan({ prompt: 'find the tree' })

      expect(result.metadata!.tools).toContain('find_entity')
    })
  })

  // -----------------------------------------------------------------------
  // Event Emission
  // -----------------------------------------------------------------------

  describe('event emission', () => {
    it('should emit ToolCallStarted and ToolCallFinished events', async () => {
      const provider = createMockProvider()
      const registry = new DefaultToolRegistry([createMockTool('find_entity')])
      const planner = new ToolCallPlanner(provider, registry)

      const receivedEvents: PipelineEvent[] = []
      planner.events.subscribe({ onEvent: (e) => receivedEvents.push(e) })

      await planner.plan({ prompt: 'create a tree' })

      const toolStarted = receivedEvents.filter((e) => e.type === 'ToolCallStarted')
      const toolFinished = receivedEvents.filter((e) => e.type === 'ToolCallFinished')

      expect(toolStarted).toHaveLength(1)
      expect(toolFinished).toHaveLength(1)
    })

    it('should emit events in correct order (Started before Finished)', async () => {
      const provider = createMockProvider()
      const registry = new DefaultToolRegistry([createMockTool('find_entity')])
      const planner = new ToolCallPlanner(provider, registry)

      const receivedEvents: PipelineEvent[] = []
      planner.events.subscribe({ onEvent: (e) => receivedEvents.push(e) })

      await planner.plan({ prompt: 'create a tree' })

      const toolEvents = receivedEvents.filter(
        (e) => e.type === 'ToolCallStarted' || e.type === 'ToolCallFinished',
      )

      expect(toolEvents).toHaveLength(2)
      expect(toolEvents[0].type).toBe('ToolCallStarted')
      expect(toolEvents[1].type).toBe('ToolCallFinished')
    })

    it('ToolCallStarted should carry toolNames in payload', async () => {
      const provider = createMockProvider()
      const registry = new DefaultToolRegistry([
        createMockTool('tool_a'),
        createMockTool('tool_b'),
      ])
      const planner = new ToolCallPlanner(provider, registry)

      const receivedEvents: PipelineEvent[] = []
      planner.events.subscribe({ onEvent: (e) => receivedEvents.push(e) })

      await planner.plan({ prompt: 'test' })

      const startedEvent = receivedEvents.find((e) => e.type === 'ToolCallStarted')
      expect(startedEvent).toBeDefined()
      expect(startedEvent!.payload).toBeDefined()
      expect(startedEvent!.payload!.toolNames).toEqual(['tool_a', 'tool_b'])
    })

    it('ToolCallFinished should carry toolNames and success in payload', async () => {
      const provider = createMockProvider()
      const registry = new DefaultToolRegistry([createMockTool('find_entity')])
      const planner = new ToolCallPlanner(provider, registry)

      const receivedEvents: PipelineEvent[] = []
      planner.events.subscribe({ onEvent: (e) => receivedEvents.push(e) })

      await planner.plan({ prompt: 'test' })

      const finishedEvent = receivedEvents.find((e) => e.type === 'ToolCallFinished')
      expect(finishedEvent).toBeDefined()
      expect(finishedEvent!.payload).toBeDefined()
      expect(finishedEvent!.payload!.toolNames).toEqual(['find_entity'])
      expect(finishedEvent!.payload!.success).toBe(true)
    })

    it('ToolCallFinished should indicate failure when provider throws', async () => {
      const failingProvider: PlannerProvider = {
        async complete(_request: AIRequest): Promise<PlannerResult> {
          throw new Error('Provider crashed')
        },
      }
      const registry = new DefaultToolRegistry([createMockTool('find_entity')])
      const planner = new ToolCallPlanner(failingProvider, registry)

      const receivedEvents: PipelineEvent[] = []
      planner.events.subscribe({ onEvent: (e) => receivedEvents.push(e) })

      const result = await planner.plan({ prompt: 'test' })

      const finishedEvent = receivedEvents.find((e) => e.type === 'ToolCallFinished')
      expect(finishedEvent).toBeDefined()
      expect(finishedEvent!.payload!.success).toBe(false)

      // Should return a graceful error result
      expect(result.actions).toHaveLength(0)
      expect(result.reasoning).toContain('Provider crashed')
    })

    it('each event should have a valid timestamp', async () => {
      const provider = createMockProvider()
      const registry = new DefaultToolRegistry([createMockTool('find_entity')])
      const planner = new ToolCallPlanner(provider, registry)

      const receivedEvents: PipelineEvent[] = []
      planner.events.subscribe({ onEvent: (e) => receivedEvents.push(e) })

      await planner.plan({ prompt: 'test' })

      for (const event of receivedEvents) {
        expect(event.timestamp).toBeGreaterThan(0)
      }
    })
  })

  // -----------------------------------------------------------------------
  // Multiple tools
  // -----------------------------------------------------------------------

  describe('multiple tools', () => {
    it('should handle multiple registered tools', async () => {
      const provider = createMockProvider()
      const registry = new DefaultToolRegistry([
        createMockTool('find_entity'),
        createMockTool('count_entities'),
        createMockTool('get_world_state'),
      ])
      const planner = new ToolCallPlanner(provider, registry)

      const result = await planner.plan({ prompt: 'test' })

      // All tool names should be in metadata
      expect(result.metadata!.tools).toEqual([
        'find_entity',
        'count_entities',
        'get_world_state',
      ])

      // All tools should be in prompt
      const completeMock = vi.fn()
      const provider2: PlannerProvider = {
        async complete(request: AIRequest): Promise<PlannerResult> {
          completeMock(request.prompt)
          return validResult
        },
      }
      const planner2 = new ToolCallPlanner(provider2, registry)
      await planner2.plan({ prompt: 'test' })

      const prompt = completeMock.mock.calls[0][0]
      expect(prompt).toContain('find_entity')
      expect(prompt).toContain('count_entities')
      expect(prompt).toContain('get_world_state')
    })
  })

  // -----------------------------------------------------------------------
  // Tool interface contract
  // -----------------------------------------------------------------------

  describe('Tool interface contract', () => {
    it('should require name, description, and execute method', () => {
      const tool: Tool = {
        name: 'custom_tool',
        description: 'A custom tool for testing',
        async execute(_input: unknown): Promise<unknown> {
          return { done: true }
        },
      }

      expect(tool.name).toBe('custom_tool')
      expect(tool.description).toBe('A custom tool for testing')
    })

    it('should allow execute to return any shape', async () => {
      const tool: Tool = {
        name: 'custom_tool',
        description: 'Returns custom data',
        async execute(_input: unknown): Promise<unknown> {
          return { items: [1, 2, 3], count: 3, metadata: { source: 'mock' } }
        },
      }

      const result = await tool.execute({ limit: 10 })
      expect(result).toEqual({ items: [1, 2, 3], count: 3, metadata: { source: 'mock' } })
    })

    it('should pass input to execute', async () => {
      const executeSpy = vi.fn()
      const tool: Tool = {
        name: 'spy_tool',
        description: 'Spy on input',
        async execute(input: unknown): Promise<unknown> {
          executeSpy(input)
          return {}
        },
      }

      const input = { id: 'abc', filter: 'all' }
      await tool.execute(input)
      expect(executeSpy).toHaveBeenCalledWith(input)
    })
  })

  // -----------------------------------------------------------------------
  // Preserve existing metadata from provider
  // -----------------------------------------------------------------------

  describe('metadata preservation', () => {
    it('should preserve existing metadata from provider result', async () => {
      const providerResult: PlannerResult = {
        ...validResult,
        metadata: { tokenCount: 42, provider: 'mock' },
      }
      const provider = createMockProvider(providerResult)
      const registry = new DefaultToolRegistry([createMockTool('find_entity')])
      const planner = new ToolCallPlanner(provider, registry)

      const result = await planner.plan({ prompt: 'test' })

      expect(result.metadata!.tokenCount).toBe(42)
      expect(result.metadata!.provider).toBe('mock')
      expect(result.metadata!.tools).toEqual(['find_entity'])
    })
  })
})