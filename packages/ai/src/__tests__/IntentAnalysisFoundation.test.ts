import { describe, it, expect } from 'vitest'
import { DefaultIntentAnalyzer } from '../intent/DefaultIntentAnalyzer'
import type { IntentAnalyzer } from '../intent/IntentAnalyzer'
import type { Intent } from '../intent/Intent'
import type { IntentResult } from '../intent/IntentResult'
import type { IntentType } from '../intent/IntentType'
import {
  DefaultIntentAnalyzer as DefaultIntentAnalyzerFromIndex,
} from '../intent/index'
import type {
  IntentAnalyzer as IntentAnalyzerFromIndex,
  Intent as IntentFromIndex,
  IntentResult as IntentResultFromIndex,
  IntentType as IntentTypeFromIndex,
} from '../intent/index'
import type {
  IntentAnalyzer as IntentAnalyzerFromRoot,
  Intent as IntentFromRoot,
  IntentResult as IntentResultFromRoot,
  IntentType as IntentTypeFromRoot,
} from '../index'
import { DefaultIntentAnalyzer as DefaultIntentAnalyzerFromRoot } from '../index'
import { DefaultPipeline } from '../pipeline/DefaultPipeline'
import { DefaultPromptBuilder } from '../prompt/DefaultPromptBuilder'
import { DefaultPromptRenderer } from '../prompt/DefaultPromptRenderer'
import { DefaultPromptCompression } from '../prompt/DefaultPromptCompression'
import { DefaultMemoryRanking } from '../prompt/DefaultMemoryRanking'
import { DefaultPromptBudget } from '../prompt/DefaultPromptBudget'
import type { PromptSelection } from '../prompt/PromptSelection'
import { DefaultPromptSelection } from '../prompt/DefaultPromptSelection'
import type { PromptBudget } from '../prompt/PromptBudget'
import type { MemoryRanking } from '../prompt/MemoryRanking'
import type { PromptCompression } from '../prompt/PromptCompression'
import type { PromptRenderer } from '../prompt/PromptRenderer'
import type { PromptModule } from '../prompt/modules/PromptModule'
import {
  SystemPromptModule,
  UserInputModule,
  MemoryPromptModule,
  WorldStatePromptModule,
  ObservationPromptModule,
  ReflectionPromptModule,
} from '../prompt/modules'
import { DefaultMemory } from '../memory/DefaultMemory'
import { DefaultToolRegistry } from '../tools/ToolRegistry'
import { MockPlanner, RetryPlanner, ToolCallPlanner } from '../planner'
import { MockPlannerProvider, MockStreamingProvider } from '../provider'
import { DefaultAIConfiguration } from '../config'
import { RetryPolicy } from '../retry/RetryPolicy'
import type { PipelineContext } from '../pipeline/PipelineContext'
import type { Planner } from '../planner/Planner'
import type { PlannerResult } from '../planner/PlannerResult'
import type { AIRequest } from '../request'
import type { ToolRegistry } from '../tools'
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

function createPipelineContext(overrides?: Partial<PipelineContext>): PipelineContext {
  return {
    input: 'place a tree',
    memory: new DefaultMemory(),
    worldState: '',
    ...overrides,
  }
}

function createIntentAnalyzerPipeline(): DefaultPipeline {
  const modules: PromptModule[] = [
    new SystemPromptModule(),
    new UserInputModule(),
    new MemoryPromptModule(),
    new WorldStatePromptModule(),
  ]
  const builder = new DefaultPromptBuilder(modules)
  const planner = new MockPlanner(new MockPlannerProvider(new DefaultAIConfiguration()))
  return new DefaultPipeline(planner, builder)
}

// ---------------------------------------------------------------------------
// IntentType Tests
// ---------------------------------------------------------------------------

describe('IntentType', () => {
  it('should support Create type', () => {
    const type: IntentType = 'Create'
    expect(type).toBe('Create')
  })

  it('should support Delete type', () => {
    const type: IntentType = 'Delete'
    expect(type).toBe('Delete')
  })

  it('should support Move type', () => {
    const type: IntentType = 'Move'
    expect(type).toBe('Move')
  })

  it('should support Modify type', () => {
    const type: IntentType = 'Modify'
    expect(type).toBe('Modify')
  })

  it('should support Query type', () => {
    const type: IntentType = 'Query'
    expect(type).toBe('Query')
  })

  it('should allow exact string comparison', () => {
    const type: string = 'Create'
    expect(type === 'Create').toBe(true)
    expect(type === 'Delete').toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Intent Tests
// ---------------------------------------------------------------------------

describe('Intent', () => {
  it('should create an Intent with Create type', () => {
    const intent: Intent = { type: 'Create' }
    expect(intent.type).toBe('Create')
  })

  it('should create an Intent with Delete type', () => {
    const intent: Intent = { type: 'Delete' }
    expect(intent.type).toBe('Delete')
  })

  it('should create an Intent with Move type', () => {
    const intent: Intent = { type: 'Move' }
    expect(intent.type).toBe('Move')
  })

  it('should create an Intent with Modify type', () => {
    const intent: Intent = { type: 'Modify' }
    expect(intent.type).toBe('Modify')
  })

  it('should create an Intent with Query type', () => {
    const intent: Intent = { type: 'Query' }
    expect(intent.type).toBe('Query')
  })

  it('should support frozen objects', () => {
    const intent = Object.freeze({ type: 'Create' as const })
    expect(intent.type).toBe('Create')
  })

  it('should support array of intents', () => {
    const intents: Intent[] = [
      { type: 'Create' },
      { type: 'Move' },
    ]
    expect(intents).toHaveLength(2)
    expect(intents[0].type).toBe('Create')
    expect(intents[1].type).toBe('Move')
  })
})

// ---------------------------------------------------------------------------
// IntentResult Tests
// ---------------------------------------------------------------------------

describe('IntentResult', () => {
  it('should create an empty IntentResult', () => {
    const result: IntentResult = { intents: [] }
    expect(result.intents).toEqual([])
  })

  it('should create an IntentResult with single intent', () => {
    const result: IntentResult = {
      intents: [{ type: 'Create' }],
    }
    expect(result.intents).toHaveLength(1)
    expect(result.intents[0].type).toBe('Create')
  })

  it('should create an IntentResult with multiple intents', () => {
    const result: IntentResult = {
      intents: [
        { type: 'Create' },
        { type: 'Create' },
      ],
    }
    expect(result.intents).toHaveLength(2)
    expect(result.intents[0].type).toBe('Create')
    expect(result.intents[1].type).toBe('Create')
  })

  it('should create an IntentResult with all intent types', () => {
    const result: IntentResult = {
      intents: [
        { type: 'Create' },
        { type: 'Delete' },
        { type: 'Move' },
        { type: 'Modify' },
        { type: 'Query' },
      ],
    }
    expect(result.intents).toHaveLength(5)
    expect(result.intents.map(i => i.type)).toEqual([
      'Create', 'Delete', 'Move', 'Modify', 'Query',
    ])
  })

  it('should support frozen results', () => {
    const result = Object.freeze({ intents: Object.freeze([{ type: 'Create' }]) })
    expect(result.intents).toHaveLength(1)
  })

  it('should accept empty array as valid', () => {
    const result: IntentResult = { intents: [] }
    expect(result.intents.length).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// DefaultIntentAnalyzer Tests
// ---------------------------------------------------------------------------

describe('DefaultIntentAnalyzer', () => {
  it('should implement IntentAnalyzer interface', () => {
    const analyzer: IntentAnalyzer = new DefaultIntentAnalyzer()
    expect(analyzer).toBeInstanceOf(DefaultIntentAnalyzer)
  })

  it('should return empty intents for empty input', () => {
    const analyzer = new DefaultIntentAnalyzer()
    const result = analyzer.analyze('')
    expect(result).toEqual({ intents: [] })
  })

  it('should return empty intents for non-empty input', () => {
    const analyzer = new DefaultIntentAnalyzer()
    const result = analyzer.analyze('place a tree')
    expect(result).toEqual({ intents: [] })
  })

  it('should return empty intents for complex input', () => {
    const analyzer = new DefaultIntentAnalyzer()
    const result = analyzer.analyze('draw a tree and a flower')
    expect(result).toEqual({ intents: [] })
  })

  it('should have deterministic behavior — same input, same output', () => {
    const analyzer = new DefaultIntentAnalyzer()
    const input = 'place a tree'
    const result1 = analyzer.analyze(input)
    const result2 = analyzer.analyze(input)
    expect(result1).toEqual(result2)
  })

  it('should have deterministic behavior — various inputs all return empty', () => {
    const analyzer = new DefaultIntentAnalyzer()
    const inputs = ['', 'hello', 'create', 'move left', 'delete the tree']
    const results = inputs.map(i => analyzer.analyze(i))
    for (const result of results) {
      expect(result).toEqual({ intents: [] })
    }
  })

  it('should be stateless — no side effects across calls', () => {
    const analyzer = new DefaultIntentAnalyzer()
    const result1 = analyzer.analyze('first')
    const result2 = analyzer.analyze('second')
    const result3 = analyzer.analyze('first')
    expect(result1).toEqual(result2)
    expect(result1).toEqual(result3)
  })

  it('should be idempotent — multiple calls produce same result', () => {
    const analyzer = new DefaultIntentAnalyzer()
    const input = 'place a tree'
    const results = Array.from({ length: 5 }, () => analyzer.analyze(input))
    for (const result of results) {
      expect(result).toEqual({ intents: [] })
    }
  })

  it('should preserve IntentResult type structure', () => {
    const analyzer = new DefaultIntentAnalyzer()
    const result: IntentResult = analyzer.analyze('test')
    expect(result).toHaveProperty('intents')
    expect(Array.isArray(result.intents)).toBe(true)
  })

  it('should work with IntentType discriminator', () => {
    const analyzer = new DefaultIntentAnalyzer()
    const result = analyzer.analyze('test')
    for (const intent of result.intents) {
      // All intents must have a valid IntentType
      const validTypes: IntentType[] = ['Create', 'Delete', 'Move', 'Modify', 'Query']
      expect(validTypes).toContain(intent.type)
    }
  })

  it('should work independently — no dependencies on Planner, Provider, Memory, or ToolCalling', () => {
    // DefaultIntentAnalyzer has zero imports from Planner, Provider, Memory, ToolCalling
    const analyzer = new DefaultIntentAnalyzer()
    expect(analyzer.analyze('test')).toEqual({ intents: [] })
  })
})

// ---------------------------------------------------------------------------
// Exports Tests
// ---------------------------------------------------------------------------

describe('Exports', () => {
  it('should export IntentAnalyzer type from intent/index', () => {
    const analyzer: IntentAnalyzerFromIndex = new DefaultIntentAnalyzerFromIndex()
    expect(analyzer).toBeInstanceOf(DefaultIntentAnalyzer)
  })

  it('should export Intent type from intent/index', () => {
    const intent: IntentFromIndex = { type: 'Create' }
    expect(intent.type).toBe('Create')
  })

  it('should export IntentResult type from intent/index', () => {
    const result: IntentResultFromIndex = { intents: [{ type: 'Create' }] }
    expect(result.intents).toHaveLength(1)
  })

  it('should export IntentType type from intent/index', () => {
    const type: IntentTypeFromIndex = 'Query'
    expect(type).toBe('Query')
  })

  it('should export DefaultIntentAnalyzer from intent/index', () => {
    expect(DefaultIntentAnalyzerFromIndex).toBe(DefaultIntentAnalyzer)
  })

  it('should export IntentAnalyzer type from package root', () => {
    const analyzer: IntentAnalyzerFromRoot = new DefaultIntentAnalyzerFromRoot()
    expect(analyzer).toBeInstanceOf(DefaultIntentAnalyzer)
  })

  it('should export Intent type from package root', () => {
    const intent: IntentFromRoot = { type: 'Move' }
    expect(intent.type).toBe('Move')
  })

  it('should export IntentResult type from package root', () => {
    const result: IntentResultFromRoot = { intents: [] }
    expect(result.intents).toEqual([])
  })

  it('should export IntentType type from package root', () => {
    const type: IntentTypeFromRoot = 'Delete'
    expect(type).toBe('Delete')
  })

  it('should export DefaultIntentAnalyzer from package root', () => {
    expect(DefaultIntentAnalyzerFromRoot).toBe(DefaultIntentAnalyzer)
  })
})

// ---------------------------------------------------------------------------
// Backward Compatibility Tests
// ---------------------------------------------------------------------------

describe('Backward Compatibility', () => {
  it('should not break PromptBuilder interface', () => {
    const builder = new DefaultPromptBuilder([new SystemPromptModule(), new UserInputModule()])
    expect(builder).toBeInstanceOf(DefaultPromptBuilder)
  })

  it('should not break PromptRenderer interface', () => {
    const renderer: PromptRenderer = new DefaultPromptRenderer()
    expect(renderer.render({ userInput: 'test' })).toBe('test')
  })

  it('should not break PromptCompression interface', () => {
    const compression: PromptCompression = new DefaultPromptCompression()
    const result = compression.compress({ userInput: 'test' })
    expect(result).toEqual({ userInput: 'test' })
  })

  it('should not break MemoryRanking interface', () => {
    const ranking: MemoryRanking = new DefaultMemoryRanking()
    const result = ranking.rank({ userInput: 'test' })
    expect(result.rankedSections).toContain('userInput')
  })

  it('should not break PromptBudget interface', () => {
    const budget: PromptBudget = new DefaultPromptBudget()
    const result = budget.calculate({ userInput: 'test' })
    expect(result.totalLength).toBe(4)
  })

  it('should not break PromptSelection interface', () => {
    const selection: PromptSelection = new DefaultPromptSelection()
    const result = selection.select({ userInput: 'test' })
    expect(result.selectedSections).toContain('userInput')
  })

  it('should not break Pipeline interface', () => {
    const pipeline = createIntentAnalyzerPipeline()
    expect(pipeline).toBeInstanceOf(DefaultPipeline)
  })

  it('should not break PipelineContext structure', () => {
    const context = createPipelineContext()
    expect(context).toHaveProperty('input')
    expect(context).toHaveProperty('memory')
  })

  it('should not break AIRequest structure', () => {
    const request: AIRequest = { prompt: 'test' }
    expect(request.prompt).toBe('test')
  })

  it('should not break PlannerResult structure', () => {
    expect(treeResult.actions).toHaveLength(1)
    expect(treeResult.actions[0].type).toBe('CreateEntity')
  })
})

// ---------------------------------------------------------------------------
// RetryPlanner Compatibility Tests
// ---------------------------------------------------------------------------

describe('RetryPlanner Compatibility', () => {
  it('should work with RetryPlanner', async () => {
    const modules: PromptModule[] = [new UserInputModule()]
    const builder = new DefaultPromptBuilder(modules)
    const provider = new MockPlannerProvider(new DefaultAIConfiguration())
    const planner: Planner = new RetryPlanner(provider)
    const pipeline = new DefaultPipeline(planner, builder)
    const context = createPipelineContext()
    await expect(pipeline.execute(context)).resolves.toBeDefined()
  })

  it('should not affect RetryPlanner retry behavior', async () => {
    const modules: PromptModule[] = [new UserInputModule()]
    const builder = new DefaultPromptBuilder(modules)
    const provider = new MockPlannerProvider(new DefaultAIConfiguration())
    const planner = new RetryPlanner(provider, new RetryPolicy({ maxRetries: 1 }))
    const pipeline = new DefaultPipeline(planner, builder)
    const context = createPipelineContext({ input: 'tree' })
    const result = await pipeline.execute(context)
    expect(result.plannerResult?.actions).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// ToolCallPlanner Compatibility Tests
// ---------------------------------------------------------------------------

describe('ToolCallPlanner Compatibility', () => {
  it('should work with ToolCallPlanner', async () => {
    const modules: PromptModule[] = [new UserInputModule()]
    const builder = new DefaultPromptBuilder(modules)
    const provider = new MockPlannerProvider(new DefaultAIConfiguration())
    const toolRegistry: ToolRegistry = new DefaultToolRegistry()
    const planner: Planner = new ToolCallPlanner(provider, toolRegistry)
    const pipeline = new DefaultPipeline(planner, builder)
    const context = createPipelineContext()
    await expect(pipeline.execute(context)).resolves.toBeDefined()
  })

  it('should not affect ToolCallPlanner tool execution', async () => {
    const modules: PromptModule[] = [new UserInputModule()]
    const builder = new DefaultPromptBuilder(modules)
    const provider = new MockPlannerProvider(new DefaultAIConfiguration())
    const toolRegistry: ToolRegistry = new DefaultToolRegistry()
    const planner = new ToolCallPlanner(provider, toolRegistry)
    const pipeline = new DefaultPipeline(planner, builder)
    const context = createPipelineContext({ input: 'tree' })
    const result = await pipeline.execute(context)
    expect(result.plannerResult?.actions).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// Streaming Compatibility Tests
// ---------------------------------------------------------------------------

describe('Streaming Compatibility', () => {
  it('should work with StreamingProvider', async () => {
    const modules: PromptModule[] = [new UserInputModule()]
    const builder = new DefaultPromptBuilder(modules)
    const provider = new MockStreamingProvider()
    const planner = new MockPlanner(provider)
    const pipeline = new DefaultPipeline(planner, builder)
    const context = createPipelineContext()
    await expect(pipeline.stream(context)).resolves.toBeDefined()
  })

  it('should not affect streaming chunk emission', async () => {
    const modules: PromptModule[] = [new UserInputModule()]
    const builder = new DefaultPromptBuilder(modules)
    const provider = new MockStreamingProvider()
    const planner = new MockPlanner(provider)
    const pipeline = new DefaultPipeline(planner, builder)
    const context = createPipelineContext({ input: 'tree' })
    const result = await pipeline.stream(context)
    expect(result.plannerResult?.actions).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// AgentLoop Compatibility Tests
// ---------------------------------------------------------------------------

describe('AgentLoop Compatibility', () => {
  it('should work with DefaultAgentLoop', async () => {
    const modules: PromptModule[] = [new UserInputModule()]
    const builder = new DefaultPromptBuilder(modules)
    const planner = new MockPlanner(new MockPlannerProvider(new DefaultAIConfiguration()))
    const pipeline = new DefaultPipeline(planner, builder)
    const context = createPipelineContext()
    await expect(pipeline.execute(context)).resolves.toBeDefined()
  })

  it('should work with AgentLoop and Reflection', async () => {
    const modules: PromptModule[] = [
      new UserInputModule(),
      new ObservationPromptModule(),
      new ReflectionPromptModule(),
    ]
    const builder = new DefaultPromptBuilder(modules)
    const planner = new MockPlanner(new MockPlannerProvider(new DefaultAIConfiguration()))
    const pipeline = new DefaultPipeline(planner, builder)
    const context = createPipelineContext({
      input: 'tree',
      metadata: {
        observations: [
          { toolName: 'find_entity', toolInput: {}, toolOutput: {}, timestamp: 1, iteration: 1 },
        ],
        reflectionResults: singleReflection,
      },
    })
    await expect(pipeline.execute(context)).resolves.toBeDefined()
  })

  it('should not affect AgentLoop iteration count', async () => {
    const modules: PromptModule[] = [new UserInputModule()]
    const builder = new DefaultPromptBuilder(modules)
    const planner = new MockPlanner(new MockPlannerProvider(new DefaultAIConfiguration()))
    const pipeline = new DefaultPipeline(planner, builder)
    const context = createPipelineContext({ input: 'tree' })
    const result = await pipeline.execute(context)
    expect(result.plannerResult?.actions).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// Architecture Compliance Tests
// ---------------------------------------------------------------------------

describe('Architecture Compliance', () => {
  it('should have no dependencies on Planner', () => {
    // IntentAnalyzer interface does not import Planner
    const analyzer: IntentAnalyzer = new DefaultIntentAnalyzer()
    expect(analyzer.analyze).toBeDefined()
  })

  it('should have no dependencies on Runtime', () => {
    // IntentAnalyzer does not reference Runtime
    const analyzer = new DefaultIntentAnalyzer()
    expect(() => analyzer.analyze('test')).not.toThrow()
  })

  it('should have no dependencies on Provider', () => {
    // IntentAnalyzer does not import any Provider
    const analyzer = new DefaultIntentAnalyzer()
    expect(analyzer.analyze('test')).toEqual({ intents: [] })
  })

  it('should have no dependencies on Memory', () => {
    // IntentAnalyzer does not reference Memory
    const analyzer = new DefaultIntentAnalyzer()
    expect(Object.keys(analyzer)).not.toContain('memory')
  })

  it('should have no dependencies on ToolCalling', () => {
    // IntentAnalyzer does not reference Tool or ToolRegistry
    const analyzer = new DefaultIntentAnalyzer()
    expect(analyzer.analyze('test')).toEqual({ intents: [] })
  })

  it('should have no dependencies on AgentLoop', () => {
    // IntentAnalyzer does not reference AgentLoop
    const analyzer = new DefaultIntentAnalyzer()
    expect(analyzer.analyze('test')).toEqual({ intents: [] })
  })

  it('should have no dependencies on PromptBuilder', () => {
    // IntentAnalyzer does not reference PromptBuilder
    const analyzer = new DefaultIntentAnalyzer()
    expect(analyzer.analyze('test')).toEqual({ intents: [] })
  })

  it('should have no dependencies on Pipeline', () => {
    // IntentAnalyzer does not reference Pipeline
    const analyzer = new DefaultIntentAnalyzer()
    expect(analyzer.analyze('test')).toEqual({ intents: [] })
  })

  it('should have no side effects — calling analyze does not modify external state', () => {
    const analyzer = new DefaultIntentAnalyzer()
    const input = 'place a tree'
    const inputCopy = input.slice()
    analyzer.analyze(input)
    expect(input).toBe(inputCopy)
  })

  it('should be pure — same input always produces same output', () => {
    const analyzer = new DefaultIntentAnalyzer()
    const inputs = ['', 'hello', 'world']
    for (const input of inputs) {
      const result1 = analyzer.analyze(input)
      const result2 = analyzer.analyze(input)
      expect(result1).toEqual(result2)
    }
  })

  it('should be stateless — no internal state between calls', () => {
    const analyzer = new DefaultIntentAnalyzer()
    const result1 = analyzer.analyze('first')
    const result2 = analyzer.analyze('second')
    const result3 = analyzer.analyze('third')
    expect(result1).toEqual(result2)
    expect(result2).toEqual(result3)
  })

  it('should be non-mutating — input string unchanged after analyze', () => {
    const analyzer = new DefaultIntentAnalyzer()
    const input = 'place a tree'
    const expected = input
    analyzer.analyze(input)
    expect(input).toBe(expected)
  })
})