import { describe, it, expect } from 'vitest'
import { DefaultMemoryRanking, DEFAULT_RANKING_PRIORITY } from '../prompt/DefaultMemoryRanking'
import type { MemoryRanking } from '../prompt/MemoryRanking'
import type { MemoryRankingResult } from '../prompt/MemoryRankingResult'
import type { PromptContext } from '../prompt/PromptContext'
import { DefaultPromptBuilder } from '../prompt/DefaultPromptBuilder'
import {
  SystemPromptModule,
  UserInputModule,
  MemoryPromptModule,
  WorldStatePromptModule,
  ObservationPromptModule,
  ReflectionPromptModule,
} from '../prompt/modules'
import { DefaultMemory } from '../memory/DefaultMemory'
import { DefaultReflection } from '../reflection/DefaultReflection'
import { DefaultAgentLoop } from '../agent/DefaultAgentLoop'
import { DefaultToolRegistry } from '../tools/ToolRegistry'
import { DefaultPipeline } from '../pipeline/DefaultPipeline'
import { MockPlanner, RetryPlanner, ToolCallPlanner } from '../planner'
import { MockPlannerProvider, MockStreamingProvider } from '../provider'
import { DefaultAIConfiguration } from '../config'
import type { PromptModule } from '../prompt/modules/PromptModule'
import type { PipelineContext } from '../pipeline/PipelineContext'
import type { Planner } from '../planner/Planner'
import type { PlannerResult } from '../planner/PlannerResult'
import type { AIRequest } from '../request'
import type { Tool, ToolRegistry } from '../tools'
import type { ReflectionResult } from '../reflection/ReflectionResult'

// ---------------------------------------------------------------------------
// Test Data
// ---------------------------------------------------------------------------

const singleReflection: ReflectionResult[] = [
  { reasoning: 'Actions found — task complete', continueLoop: false },
]

const treeResult: PlannerResult = {
  actions: [{ type: 'CreateEntity', entityType: 'tree', x: 5, y: 3 }],
}

const treeRequest: AIRequest = { prompt: 'create a tree' }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockPlanner(result: PlannerResult = treeResult): Planner {
  return {
    async plan(_request: AIRequest): Promise<PlannerResult> {
      return result
    },
  }
}

function createMockTool(name: string, output: unknown = { found: true }): Tool {
  return {
    name,
    description: `Mock: ${name}`,
    async execute(input: unknown): Promise<unknown> {
      return output
    },
  }
}

// ---------------------------------------------------------------------------
// MemoryRanking Interface
// ---------------------------------------------------------------------------

describe('MemoryRanking', () => {
  it('should define rank method that accepts PromptContext and returns MemoryRankingResult', () => {
    const ranking: MemoryRanking = new DefaultMemoryRanking()
    const result = ranking.rank({})
    expect(result).toHaveProperty('rankedSections')
    expect(result).toHaveProperty('priorities')
  })

  it('should be implementable as a custom ranking', () => {
    class CustomRanking implements MemoryRanking {
      rank(_context: PromptContext): MemoryRankingResult {
        return {
          rankedSections: ['system', 'userInput'],
          priorities: { system: 200, userInput: 100 },
        }
      }
    }
    const ranking = new CustomRanking()
    const result = ranking.rank({ system: 'sys', userInput: 'in' })
    expect(result.rankedSections).toEqual(['system', 'userInput'])
    expect(result.priorities.system).toBe(200)
    expect(result.priorities.userInput).toBe(100)
  })

  it('should not require any dependencies', () => {
    const ranking: MemoryRanking = new DefaultMemoryRanking()
    expect(typeof ranking.rank).toBe('function')
  })
})

// ---------------------------------------------------------------------------
// MemoryRankingResult Interface
// ---------------------------------------------------------------------------

describe('MemoryRankingResult', () => {
  it('should define rankedSections as string array', () => {
    const result: MemoryRankingResult = { rankedSections: [], priorities: {} }
    expect(Array.isArray(result.rankedSections)).toBe(true)
  })

  it('should define priorities as Record<string, number>', () => {
    const result: MemoryRankingResult = { rankedSections: [], priorities: { a: 1 } }
    expect(result.priorities.a).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// DEFAULT_RANKING_PRIORITY
// ---------------------------------------------------------------------------

describe('DEFAULT_RANKING_PRIORITY', () => {
  it('should define all PromptContext fields', () => {
    expect(DEFAULT_RANKING_PRIORITY).toHaveProperty('userInput')
    expect(DEFAULT_RANKING_PRIORITY).toHaveProperty('reflections')
    expect(DEFAULT_RANKING_PRIORITY).toHaveProperty('observations')
    expect(DEFAULT_RANKING_PRIORITY).toHaveProperty('memory')
    expect(DEFAULT_RANKING_PRIORITY).toHaveProperty('worldState')
    expect(DEFAULT_RANKING_PRIORITY).toHaveProperty('system')
  })

  it('should have userInput as highest priority', () => {
    expect(DEFAULT_RANKING_PRIORITY.userInput).toBeGreaterThan(DEFAULT_RANKING_PRIORITY.reflections!)
    expect(DEFAULT_RANKING_PRIORITY.userInput).toBeGreaterThan(DEFAULT_RANKING_PRIORITY.observations!)
    expect(DEFAULT_RANKING_PRIORITY.userInput).toBeGreaterThan(DEFAULT_RANKING_PRIORITY.memory!)
    expect(DEFAULT_RANKING_PRIORITY.userInput).toBeGreaterThan(DEFAULT_RANKING_PRIORITY.worldState!)
    expect(DEFAULT_RANKING_PRIORITY.userInput).toBeGreaterThan(DEFAULT_RANKING_PRIORITY.system!)
  })

  it('should have system as lowest priority', () => {
    expect(DEFAULT_RANKING_PRIORITY.system).toBeLessThan(DEFAULT_RANKING_PRIORITY.userInput!)
    expect(DEFAULT_RANKING_PRIORITY.system).toBeLessThan(DEFAULT_RANKING_PRIORITY.reflections!)
    expect(DEFAULT_RANKING_PRIORITY.system).toBeLessThan(DEFAULT_RANKING_PRIORITY.observations!)
    expect(DEFAULT_RANKING_PRIORITY.system).toBeLessThan(DEFAULT_RANKING_PRIORITY.memory!)
    expect(DEFAULT_RANKING_PRIORITY.system).toBeLessThan(DEFAULT_RANKING_PRIORITY.worldState!)
  })
})

// ---------------------------------------------------------------------------
// DefaultMemoryRanking — Empty Context
// ---------------------------------------------------------------------------

describe('DefaultMemoryRanking — Empty Context', () => {
  it('should return empty rankedSections for empty context', () => {
    const ranking = new DefaultMemoryRanking()
    const result = ranking.rank({})
    expect(result.rankedSections).toHaveLength(0)
  })

  it('should return empty priorities for empty context', () => {
    const ranking = new DefaultMemoryRanking()
    const result = ranking.rank({})
    expect(Object.keys(result.priorities)).toHaveLength(0)
  })

  it('should ignore undefined fields', () => {
    const ranking = new DefaultMemoryRanking()
    const result = ranking.rank({
      system: undefined,
      userInput: undefined,
      memory: undefined,
    })
    expect(result.rankedSections).toHaveLength(0)
  })

  it('should ignore empty string fields', () => {
    const ranking = new DefaultMemoryRanking()
    const result = ranking.rank({
      system: '',
      userInput: '',
      memory: '',
    })
    expect(result.rankedSections).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// DefaultMemoryRanking — Fixed Priority
// ---------------------------------------------------------------------------

describe('DefaultMemoryRanking — Fixed Priority', () => {
  it('should rank userInput above reflections', () => {
    const ranking = new DefaultMemoryRanking()
    const result = ranking.rank({
      userInput: 'create a tree',
      reflections: 'Task complete',
    })
    expect(result.rankedSections[0]).toBe('userInput')
    expect(result.rankedSections[1]).toBe('reflections')
  })

  it('should rank reflections above observations', () => {
    const ranking = new DefaultMemoryRanking()
    const result = ranking.rank({
      reflections: 'Need more work',
      observations: 'Tool found entity',
    })
    expect(result.rankedSections[0]).toBe('reflections')
    expect(result.rankedSections[1]).toBe('observations')
  })

  it('should rank observations above memory', () => {
    const ranking = new DefaultMemoryRanking()
    const result = ranking.rank({
      observations: 'Tool output',
      memory: 'Previous conversation',
    })
    expect(result.rankedSections[0]).toBe('observations')
    expect(result.rankedSections[1]).toBe('memory')
  })

  it('should rank memory above worldState', () => {
    const ranking = new DefaultMemoryRanking()
    const result = ranking.rank({
      memory: 'Conversation history',
      worldState: 'World snapshot',
    })
    expect(result.rankedSections[0]).toBe('memory')
    expect(result.rankedSections[1]).toBe('worldState')
  })

  it('should rank worldState above system', () => {
    const ranking = new DefaultMemoryRanking()
    const result = ranking.rank({
      worldState: 'Current world',
      system: 'You are a planner',
    })
    expect(result.rankedSections[0]).toBe('worldState')
    expect(result.rankedSections[1]).toBe('system')
  })
})

// ---------------------------------------------------------------------------
// DefaultMemoryRanking — Full Context
// ---------------------------------------------------------------------------

describe('DefaultMemoryRanking — Full Context', () => {
  it('should rank all 6 sections in correct priority order', () => {
    const ranking = new DefaultMemoryRanking()
    const result = ranking.rank({
      system: 'You are a planner.',
      userInput: 'Create a tree.',
      memory: 'Previous conversation.',
      worldState: 'World snapshot.',
      observations: 'Tool observations.',
      reflections: 'Reflection result.',
    })
    expect(result.rankedSections).toEqual([
      'userInput',
      'reflections',
      'observations',
      'memory',
      'worldState',
      'system',
    ])
  })

  it('should return correct priority scores for all sections', () => {
    const ranking = new DefaultMemoryRanking()
    const result = ranking.rank({
      system: 'sys',
      userInput: 'in',
      memory: 'mem',
      worldState: 'world',
      observations: 'obs',
      reflections: 'refl',
    })
    expect(result.priorities.userInput).toBe(100)
    expect(result.priorities.reflections).toBe(80)
    expect(result.priorities.observations).toBe(60)
    expect(result.priorities.memory).toBe(40)
    expect(result.priorities.worldState).toBe(20)
    expect(result.priorities.system).toBe(10)
  })
})

// ---------------------------------------------------------------------------
// DefaultMemoryRanking — Non-mutating
// ---------------------------------------------------------------------------

describe('DefaultMemoryRanking — Non-mutating', () => {
  it('should not modify the input context', () => {
    const ranking = new DefaultMemoryRanking()
    const input: PromptContext = { system: 'hello', userInput: 'world' }
    const inputCopy = { ...input }
    ranking.rank(input)
    expect(input).toEqual(inputCopy)
  })
})

// ---------------------------------------------------------------------------
// DefaultMemoryRanking — Partial Context
// ---------------------------------------------------------------------------

describe('DefaultMemoryRanking — Partial Context', () => {
  it('should only include populated sections', () => {
    const ranking = new DefaultMemoryRanking()
    const result = ranking.rank({
      userInput: 'hello',
      system: 'sys',
      // memory, worldState, observations, reflections are undefined
    })
    expect(result.rankedSections).toEqual(['userInput', 'system'])
    expect(result.rankedSections).toHaveLength(2)
  })

  it('should handle single section', () => {
    const ranking = new DefaultMemoryRanking()
    const result = ranking.rank({ system: 'sys' })
    expect(result.rankedSections).toEqual(['system'])
    expect(Object.keys(result.priorities)).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// Custom Ranking
// ---------------------------------------------------------------------------

describe('Custom Ranking', () => {
  it('should support custom ranking implementation', () => {
    class ReverseRanking implements MemoryRanking {
      rank(context: PromptContext): MemoryRankingResult {
        const sections = Object.entries(context)
          .filter(([, v]) => v !== undefined && v !== '')
          .map(([k]) => k)
        // Reverse the default priority
        const priorities: Record<string, number> = {
          system: 100,
          worldState: 80,
          memory: 60,
          observations: 40,
          reflections: 20,
          userInput: 10,
        }
        const rankedSections = [...sections].sort(
          (a, b) => (priorities[b] ?? 0) - (priorities[a] ?? 0),
        )
        return { rankedSections, priorities }
      }
    }
    const ranking = new ReverseRanking()
    const result = ranking.rank({
      system: 'sys',
      userInput: 'in',
      memory: 'mem',
      worldState: 'world',
      observations: 'obs',
      reflections: 'refl',
    })
    // Reverse order: system (highest) → userInput (lowest)
    expect(result.rankedSections[0]).toBe('system')
    expect(result.rankedSections[result.rankedSections.length - 1]).toBe('userInput')
  })
})

// ---------------------------------------------------------------------------
// RetryPlanner Compatibility
// ---------------------------------------------------------------------------

describe('MemoryRanking — RetryPlanner Compatibility', () => {
  it('should work with RetryPlanner (ranking is standalone)', async () => {
    const provider = new MockPlannerProvider(new DefaultAIConfiguration())
    const retryPlanner = new RetryPlanner(provider)
    const pipeline = new DefaultPipeline(
      retryPlanner,
      new DefaultPromptBuilder([new SystemPromptModule(), new UserInputModule()]),
    )
    const result = await pipeline.execute({ input: 'tree' })
    expect(result.plannerResult!.actions).toBeDefined()

    // Ranking works independently
    const ranking = new DefaultMemoryRanking()
    const rankResult = ranking.rank({ system: 'test' })
    expect(rankResult.rankedSections).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// ToolCallingPlanner Compatibility
// ---------------------------------------------------------------------------

describe('MemoryRanking — ToolCallPlanner Compatibility', () => {
  it('should work with ToolCallPlanner (ranking is standalone)', async () => {
    const tool = createMockTool('find_entity', { found: true })
    const registry = new DefaultToolRegistry([tool])
    const provider = new MockPlannerProvider(new DefaultAIConfiguration())
    const toolCallPlanner = new ToolCallPlanner(provider, registry)
    const pipeline = new DefaultPipeline(
      toolCallPlanner,
      new DefaultPromptBuilder([new SystemPromptModule(), new UserInputModule()]),
    )
    const result = await pipeline.execute({ input: 'tree' })
    expect(result.plannerResult!.actions).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Streaming Compatibility
// ---------------------------------------------------------------------------

describe('MemoryRanking — Streaming Compatibility', () => {
  it('should work with streaming provider (ranking is standalone)', async () => {
    const streamingProvider = new MockStreamingProvider()
    const planner = new MockPlanner(streamingProvider)
    const pipeline = new DefaultPipeline(
      planner,
      new DefaultPromptBuilder([new SystemPromptModule(), new UserInputModule()]),
      streamingProvider,
    )
    const result = await pipeline.stream({ input: 'tree' })
    expect(result.plannerResult!.actions).toBeDefined()
  })

  it('should fall back to agent loop when provider does not stream', async () => {
    const pipeline = new DefaultPipeline(
      createMockPlanner(treeResult),
      new DefaultPromptBuilder([new SystemPromptModule(), new UserInputModule()]),
    )
    const result = await pipeline.stream({ input: 'tree' })
    expect(result.plannerResult!.actions).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// AgentLoop Integration
// ---------------------------------------------------------------------------

describe('MemoryRanking — AgentLoop Integration', () => {
  it('should work with AgentLoop and Reflection (ranking is standalone)', async () => {
    const reflection = new DefaultReflection()
    const agentLoop = new DefaultAgentLoop(reflection)
    const pipeline = new DefaultPipeline(
      createMockPlanner(treeResult),
      new DefaultPromptBuilder([new SystemPromptModule(), new ReflectionPromptModule(), new UserInputModule()]),
      undefined,
      agentLoop,
    )
    const result = await pipeline.execute({ input: 'create a tree' })
    expect(result.plannerResult!.actions).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// Backward Compatibility
// ---------------------------------------------------------------------------

describe('MemoryRanking — Backward Compatibility', () => {
  it('should not break any existing interfaces', () => {
    const ranking = new DefaultMemoryRanking()
    const result = ranking.rank({})
    expect(Array.isArray(result.rankedSections)).toBe(true)
  })

  it('should not modify PromptContext', () => {
    const ranking = new DefaultMemoryRanking()
    const ctx: PromptContext = { system: 'hello' }
    const ctxBefore = JSON.stringify(ctx)
    ranking.rank(ctx)
    expect(JSON.stringify(ctx)).toBe(ctxBefore)
  })
})

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

describe('MemoryRanking Exports', () => {
  it('should export MemoryRanking type from prompt module', async () => {
    const { DefaultMemoryRanking: DMR } = await import('../prompt')
    expect(DMR).toBeDefined()
  })

  it('should export DefaultMemoryRanking class from prompt module', async () => {
    const { DefaultMemoryRanking: ExportedClass } = await import('../prompt')
    expect(ExportedClass).toBeDefined()
    expect(typeof ExportedClass).toBe('function')
  })

  it('should export DEFAULT_RANKING_PRIORITY from prompt module', async () => {
    const { DEFAULT_RANKING_PRIORITY: DRP } = await import('../prompt')
    expect(DRP).toBeDefined()
    expect(DRP.userInput).toBe(100)
  })

  it('should export MemoryRankingResult type from prompt module', async () => {
    const m = await import('../prompt')
    const ranking = new DefaultMemoryRanking()
    const result: MemoryRankingResult = ranking.rank({ system: 'test' })
    expect(result.rankedSections).toEqual(['system'])
  })

  it('should export DefaultMemoryRanking from package root', async () => {
    const { DefaultMemoryRanking: DMR } = await import('..')
    expect(DMR).toBeDefined()
  })
})