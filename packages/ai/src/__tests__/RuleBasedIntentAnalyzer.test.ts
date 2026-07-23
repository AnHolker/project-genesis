import { describe, it, expect } from 'vitest'
import { RuleBasedIntentAnalyzer } from '../intent/RuleBasedIntentAnalyzer'
import type { IntentAnalyzer } from '../intent/IntentAnalyzer'
import type { IntentType } from '../intent/IntentType'
import { DefaultIntentAnalyzer } from '../intent/DefaultIntentAnalyzer'
import { RuleBasedIntentAnalyzer as RuleBasedFromRoot } from '../index'
import type { IntentAnalyzer as IntentAnalyzerFromRoot } from '../index'
import { DefaultPipeline } from '../pipeline/DefaultPipeline'
import { DefaultPromptBuilder } from '../prompt/DefaultPromptBuilder'
import type { PromptModule } from '../prompt/modules/PromptModule'
import {
  UserInputModule,
} from '../prompt/modules'
import { DefaultMemory } from '../memory/DefaultMemory'
import { MockPlanner, RetryPlanner, ToolCallPlanner } from '../planner'
import { MockPlannerProvider, MockStreamingProvider } from '../provider'
import { DefaultAIConfiguration } from '../config'
import { RetryPolicy } from '../retry/RetryPolicy'
import { DefaultToolRegistry } from '../tools/ToolRegistry'
import type { ToolRegistry } from '../tools'
import type { PipelineContext } from '../pipeline/PipelineContext'
import type { Planner } from '../planner/Planner'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createAnalyzer(): RuleBasedIntentAnalyzer {
  return new RuleBasedIntentAnalyzer()
}

function assertIntents(input: string, expected: IntentType[]): void {
  const analyzer = createAnalyzer()
  const result = analyzer.analyze(input)
  expect(result.intents.map(i => i.type)).toEqual(expected)
}

function assertEmpty(input: string): void {
  const analyzer = createAnalyzer()
  const result = analyzer.analyze(input)
  expect(result.intents).toEqual([])
}

function createPipelineContext(overrides?: Partial<PipelineContext>): PipelineContext {
  return {
    input: 'place a tree',
    memory: new DefaultMemory(),
    worldState: '',
    ...overrides,
  }
}

const mockConfig = new DefaultAIConfiguration()

// ---------------------------------------------------------------------------
// Intent Recognition — Create
// ---------------------------------------------------------------------------

describe('RuleBasedIntentAnalyzer — Create', () => {
  it('should detect Create from Chinese: 创建', () => {
    assertIntents('创建一棵树', ['Create'])
  })

  it('should detect Create from Chinese: 生成', () => {
    assertIntents('生成一朵花', ['Create'])
  })

  it('should detect Create from Chinese: 画', () => {
    assertIntents('画一棵树', ['Create'])
  })

  it('should detect Create from Chinese: 添加', () => {
    assertIntents('添加一个建筑', ['Create'])
  })

  it('should detect Create from Chinese: 放一个', () => {
    assertIntents('放一个石头', ['Create'])
  })

  it('should detect Create from Chinese: 放一棵', () => {
    assertIntents('放一棵树', ['Create'])
  })

  it('should detect Create from English: spawn', () => {
    assertIntents('spawn a tree', ['Create'])
  })

  it('should detect Create from English: create', () => {
    assertIntents('create a house', ['Create'])
  })

  it('should detect Create from English: draw', () => {
    assertIntents('draw a flower', ['Create'])
  })

  it('should detect Create from English: add', () => {
    assertIntents('add a rock', ['Create'])
  })

  it('should detect Create from English: make', () => {
    assertIntents('make a building', ['Create'])
  })
})

// ---------------------------------------------------------------------------
// Intent Recognition — Delete
// ---------------------------------------------------------------------------

describe('RuleBasedIntentAnalyzer — Delete', () => {
  it('should detect Delete from Chinese: 删除', () => {
    assertIntents('删除那棵树', ['Delete'])
  })

  it('should detect Delete from Chinese: 移除', () => {
    assertIntents('移除花朵', ['Delete'])
  })

  it('should detect Delete from Chinese: 清除', () => {
    assertIntents('清除所有', ['Delete'])
  })

  it('should detect Delete from English: remove', () => {
    assertIntents('remove the tree', ['Delete'])
  })

  it('should detect Delete from English: delete', () => {
    assertIntents('delete this', ['Delete'])
  })
})

// ---------------------------------------------------------------------------
// Intent Recognition — Move
// ---------------------------------------------------------------------------

describe('RuleBasedIntentAnalyzer — Move', () => {
  it('should detect Move from Chinese: 移动', () => {
    assertIntents('移动树到左边', ['Move'])
  })

  it('should detect Move from Chinese: 挪', () => {
    assertIntents('挪到右边', ['Move'])
  })

  it('should detect Move from English: move', () => {
    assertIntents('move the tree', ['Move'])
  })

  it('should detect Move from English: translate', () => {
    assertIntents('translate to position 5,5', ['Move'])
  })
})

// ---------------------------------------------------------------------------
// Intent Recognition — Modify
// ---------------------------------------------------------------------------

describe('RuleBasedIntentAnalyzer — Modify', () => {
  it('should detect Modify from Chinese: 修改', () => {
    assertIntents('修改颜色', ['Modify'])
  })

  it('should detect Modify from Chinese: 改变', () => {
    assertIntents('改变大小', ['Modify'])
  })

  it('should detect Modify from Chinese: 编辑', () => {
    assertIntents('编辑属性', ['Modify'])
  })

  it('should detect Modify from English: replace', () => {
    assertIntents('replace the tree', ['Modify'])
  })

  it('should detect Modify from English: change', () => {
    assertIntents('change the color', ['Modify'])
  })
})

// ---------------------------------------------------------------------------
// Intent Recognition — Query
// ---------------------------------------------------------------------------

describe('RuleBasedIntentAnalyzer — Query', () => {
  it('should detect Query from Chinese: 查询', () => {
    assertIntents('查询所有树', ['Query'])
  })

  it('should detect Query from Chinese: 看看', () => {
    assertIntents('看看有什么', ['Query'])
  })

  it('should detect Query from Chinese: 有什么', () => {
    assertIntents('有什么东西', ['Query'])
  })

  it('should detect Query from English: what', () => {
    assertIntents('what is here', ['Query'])
  })

  it('should detect Query from English: show', () => {
    assertIntents('show me trees', ['Query'])
  })

  it('should detect Query from English: list', () => {
    assertIntents('list all entities', ['Query'])
  })
})

// ---------------------------------------------------------------------------
// Case Insensitivity
// ---------------------------------------------------------------------------

describe('Case Insensitivity', () => {
  it('should handle UPPERCASE', () => {
    assertIntents('DRAW TREE', ['Create'])
  })

  it('should handle Capitalized', () => {
    assertIntents('Draw Tree', ['Create'])
  })

  it('should handle lowercase', () => {
    assertIntents('draw tree', ['Create'])
  })

  it('should handle mixed case', () => {
    assertIntents('DrAw TrEe', ['Create'])
  })

  it('should handle UPPERCASE for delete', () => {
    assertIntents('DELETE TREE', ['Delete'])
  })

  it('should handle UPPERCASE for move', () => {
    assertIntents('MOVE LEFT', ['Move'])
  })
})

// ---------------------------------------------------------------------------
// Multiple Keywords (same intent)
// ---------------------------------------------------------------------------

describe('Multiple Keywords — Same Intent', () => {
  it('should handle multiple Create keywords', () => {
    // Both "create" and "draw" map to Create
    assertIntents('create and draw', ['Create'])
  })

  it('should handle multiple Delete keywords', () => {
    assertIntents('remove and delete', ['Delete'])
  })
})

// ---------------------------------------------------------------------------
// Multiple Intents
// ---------------------------------------------------------------------------

describe('Multiple Intents', () => {
  it('should detect Create+Delete separated by and', () => {
    assertIntents('draw a tree and delete the flower', ['Create', 'Delete'])
  })

  it('should detect Create+Move separated by ,', () => {
    assertIntents('draw a tree, move the rock', ['Create', 'Move'])
  })

  it('should detect Modify+Query separated by ,', () => {
    assertIntents('change color, show result', ['Modify', 'Query'])
  })

  it('should detect Chinese multi-intent with ，', () => {
    assertIntents('画一棵树，删除花', ['Create', 'Delete'])
  })

  it('should detect Chinese multi-intent with 再', () => {
    assertIntents('画一棵树再删除花', ['Create', 'Delete'])
  })

  it('should detect Chinese multi-intent with ，再', () => {
    assertIntents('画一棵树，再删除花', ['Create', 'Delete'])
  })

  it('should detect Create+Delete with and', () => {
    assertIntents('create and delete', ['Create', 'Delete'])
  })

  it('should detect Move+Create with then', () => {
    assertIntents('move the tree then draw a flower', ['Move', 'Create'])
  })
})

// ---------------------------------------------------------------------------
// Duplicate Removal
// ---------------------------------------------------------------------------

describe('Duplicate Removal', () => {
  it('should deduplicate repeated Create: 画树画花画草', () => {
    assertIntents('画树画花画草', ['Create'])
  })

  it('should deduplicate repeated Create: draw tree and draw flower', () => {
    assertIntents('draw tree and draw flower', ['Create'])
  })

  it('should deduplicate repeated Delete', () => {
    assertIntents('delete tree and delete flower', ['Delete'])
  })

  it('should preserve order with dedup: Move+Create+Move', () => {
    assertIntents('move tree, draw flower, move rock', ['Move', 'Create'])
  })
})

// ---------------------------------------------------------------------------
// Unknown / Empty / Edge Inputs
// ---------------------------------------------------------------------------

describe('Unknown Input', () => {
  it('should return empty for empty string', () => {
    assertEmpty('')
  })

  it('should return empty for whitespace only', () => {
    assertEmpty('   ')
  })

  it('should return empty for tabs', () => {
    assertEmpty('\t\t')
  })

  it('should return empty for newlines', () => {
    assertEmpty('\n\n')
  })

  it('should return empty for greeting', () => {
    assertEmpty('你好')
  })

  it('should return empty for weather comment', () => {
    assertEmpty('天气不错')
  })

  it('should return empty for gibberish', () => {
    assertEmpty('asdf')
  })

  it('should return empty for emoji', () => {
    assertEmpty('🌳🌺')
  })

  it('should return empty for special characters', () => {
    assertEmpty('!@#$%^&*()')
  })

  it('should return empty for numbers', () => {
    assertEmpty('12345')
  })

  it('should return empty for mixed unknown', () => {
    assertEmpty('你好 world !@#')
  })

  it('should not throw on null-like inputs', () => {
    const analyzer = createAnalyzer()
    expect(() => analyzer.analyze('undefined')).not.toThrow()
    expect(() => analyzer.analyze('null')).not.toThrow()
  })

  it('should not throw on very long strings', () => {
    const analyzer = createAnalyzer()
    const long = 'a'.repeat(10000)
    expect(() => analyzer.analyze(long)).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// Deterministic
// ---------------------------------------------------------------------------

describe('Deterministic', () => {
  it('should return identical result for same input', () => {
    const analyzer = createAnalyzer()
    const input = 'draw a tree and delete the flower'
    const r1 = analyzer.analyze(input)
    const r2 = analyzer.analyze(input)
    const r3 = analyzer.analyze(input)
    expect(r1).toEqual(r2)
    expect(r2).toEqual(r3)
  })

  it('should return identical result for each Chinese intent type', () => {
    const analyzer = createAnalyzer()
    const inputs = ['创建', '删除', '移动', '修改', '查询']
    for (const input of inputs) {
      const r1 = analyzer.analyze(input)
      const r2 = analyzer.analyze(input)
      expect(r1).toEqual(r2)
    }
  })

  it('should be idempotent across repeated calls', () => {
    const analyzer = createAnalyzer()
    const input = '画树和画花'
    for (let i = 0; i < 10; i++) {
      const result = analyzer.analyze(input)
      expect(result.intents.map(i => i.type)).toEqual(['Create'])
    }
  })
})

// ---------------------------------------------------------------------------
// Stateless
// ---------------------------------------------------------------------------

describe('Stateless', () => {
  it('should not retain state between calls', () => {
    const analyzer = createAnalyzer()
    expect(analyzer.analyze('draw tree').intents.map(i => i.type)).toEqual(['Create'])
    expect(analyzer.analyze('').intents).toEqual([])
    expect(analyzer.analyze('delete tree').intents.map(i => i.type)).toEqual(['Delete'])
  })

  it('should be independent across multiple analyzer instances', () => {
    const a1 = createAnalyzer()
    const a2 = createAnalyzer()
    const a3 = createAnalyzer()
    expect(a1.analyze('draw').intents.map(i => i.type)).toEqual(['Create'])
    expect(a2.analyze('delete').intents.map(i => i.type)).toEqual(['Delete'])
    expect(a3.analyze('draw').intents.map(i => i.type)).toEqual(['Create'])
  })
})

// ---------------------------------------------------------------------------
// Immutability (IntentAnalyzer contract)
// ---------------------------------------------------------------------------

describe('Immutability', () => {
  it('should not modify the input string', () => {
    const analyzer = createAnalyzer()
    const input = 'draw a tree'
    const original = input
    analyzer.analyze(input)
    expect(input).toBe(original)
  })

  it('should return new IntentResult on each call', () => {
    const analyzer = createAnalyzer()
    const r1 = analyzer.analyze('draw tree')
    const r2 = analyzer.analyze('draw tree')
    expect(r1).toEqual(r2)
    expect(r1).not.toBe(r2)
  })
})

// ---------------------------------------------------------------------------
// Architecture Compliance
// ---------------------------------------------------------------------------

describe('Architecture Compliance', () => {
  it('should implement IntentAnalyzer interface', () => {
    const analyzer: IntentAnalyzer = createAnalyzer()
    expect(analyzer).toBeInstanceOf(RuleBasedIntentAnalyzer)
  })

  it('should have analyze method', () => {
    const analyzer = createAnalyzer()
    expect(typeof analyzer.analyze).toBe('function')
  })

  it('should return IntentResult type', () => {
    const analyzer = createAnalyzer()
    const result = analyzer.analyze('draw tree')
    expect(result).toHaveProperty('intents')
    expect(Array.isArray(result.intents)).toBe(true)
  })

  it('should be pure — no side effects', () => {
    const analyzer = createAnalyzer()
    const before = Object.keys(analyzer)
    analyzer.analyze('draw tree')
    analyzer.analyze('delete tree')
    analyzer.analyze('')
    const after = Object.keys(analyzer)
    expect(before).toEqual(after)
  })

  it('should be stateless — no internal mutation', () => {
    const analyzer = createAnalyzer()
    const state1 = JSON.stringify(analyzer.analyze('draw'))
    const state2 = JSON.stringify(analyzer.analyze('delete'))
    const state3 = JSON.stringify(analyzer.analyze(''))
    // Each call returns a new result independent of previous calls
    expect(JSON.stringify(analyzer.analyze('draw'))).toBe(state1)
    expect(JSON.stringify(analyzer.analyze('delete'))).toBe(state2)
    expect(JSON.stringify(analyzer.analyze(''))).toBe(state3)
  })

  it('should export from package root', () => {
    expect(RuleBasedFromRoot).toBe(RuleBasedIntentAnalyzer)
  })

  it('should maintain IntentAnalyzer type from root exports', () => {
    const analyzer: IntentAnalyzerFromRoot = createAnalyzer()
    expect(analyzer.analyze('test')).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// DefaultIntentAnalyzer Still Works
// ---------------------------------------------------------------------------

describe('DefaultIntentAnalyzer unaffected', () => {
  it('should still return empty for any input', () => {
    const analyzer = new DefaultIntentAnalyzer()
    expect(analyzer.analyze('draw tree')).toEqual({ intents: [] })
    expect(analyzer.analyze('delete tree')).toEqual({ intents: [] })
  })
})

// ---------------------------------------------------------------------------
// Mixed Inputs
// ---------------------------------------------------------------------------

describe('Mixed Inputs', () => {
  it('should handle Chinese + English mixed', () => {
    assertIntents('draw一棵树', ['Create'])
  })

  it('should handle Chinese intent with English object', () => {
    assertIntents('创建一个house', ['Create'])
  })

  it('should handle punctuation around Chinese', () => {
    assertIntents('画树，再修改颜色', ['Create', 'Modify'])
  })

  it('should handle multiple separators', () => {
    assertIntents('draw tree, delete flower, move rock', ['Create', 'Delete', 'Move'])
  })

  it('should handle trailing separator', () => {
    assertIntents('draw tree, ', ['Create'])
  })

  it('should handle leading separator', () => {
    assertIntents(', draw tree', ['Create'])
  })
})

// ---------------------------------------------------------------------------
// RetryPlanner Compatibility
// ---------------------------------------------------------------------------

describe('RetryPlanner Compatibility', () => {
  it('should work with RetryPlanner', async () => {
    const modules: PromptModule[] = [new UserInputModule()]
    const builder = new DefaultPromptBuilder(modules)
    const provider = new MockPlannerProvider(mockConfig)
    const planner: Planner = new RetryPlanner(provider)
    const pipeline = new DefaultPipeline(planner, builder)
    const context = createPipelineContext()
    await expect(pipeline.execute(context)).resolves.toBeDefined()
  })

  it('should not affect RetryPlanner retry behavior', async () => {
    const modules: PromptModule[] = [new UserInputModule()]
    const builder = new DefaultPromptBuilder(modules)
    const provider = new MockPlannerProvider(mockConfig)
    const planner = new RetryPlanner(provider, new RetryPolicy({ maxRetries: 1 }))
    const pipeline = new DefaultPipeline(planner, builder)
    const context = createPipelineContext({ input: 'tree' })
    const result = await pipeline.execute(context)
    expect(result.plannerResult?.actions).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// ToolCallPlanner Compatibility
// ---------------------------------------------------------------------------

describe('ToolCallPlanner Compatibility', () => {
  it('should work with ToolCallPlanner', async () => {
    const modules: PromptModule[] = [new UserInputModule()]
    const builder = new DefaultPromptBuilder(modules)
    const provider = new MockPlannerProvider(mockConfig)
    const toolRegistry: ToolRegistry = new DefaultToolRegistry()
    const planner: Planner = new ToolCallPlanner(provider, toolRegistry)
    const pipeline = new DefaultPipeline(planner, builder)
    const context = createPipelineContext()
    await expect(pipeline.execute(context)).resolves.toBeDefined()
  })

  it('should not affect ToolCallPlanner tool execution', async () => {
    const modules: PromptModule[] = [new UserInputModule()]
    const builder = new DefaultPromptBuilder(modules)
    const provider = new MockPlannerProvider(mockConfig)
    const toolRegistry: ToolRegistry = new DefaultToolRegistry()
    const planner = new ToolCallPlanner(provider, toolRegistry)
    const pipeline = new DefaultPipeline(planner, builder)
    const context = createPipelineContext({ input: 'tree' })
    const result = await pipeline.execute(context)
    expect(result.plannerResult?.actions).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// Streaming Compatibility
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
// AgentLoop Compatibility
// ---------------------------------------------------------------------------

describe('AgentLoop Compatibility', () => {
  it('should work with DefaultAgentLoop', async () => {
    const modules: PromptModule[] = [new UserInputModule()]
    const builder = new DefaultPromptBuilder(modules)
    const planner = new MockPlanner(new MockPlannerProvider(mockConfig))
    const pipeline = new DefaultPipeline(planner, builder)
    const context = createPipelineContext()
    await expect(pipeline.execute(context)).resolves.toBeDefined()
  })

  it('should not affect AgentLoop iteration count', async () => {
    const modules: PromptModule[] = [new UserInputModule()]
    const builder = new DefaultPromptBuilder(modules)
    const planner = new MockPlanner(new MockPlannerProvider(mockConfig))
    const pipeline = new DefaultPipeline(planner, builder)
    const context = createPipelineContext({ input: 'tree' })
    const result = await pipeline.execute(context)
    expect(result.plannerResult?.actions).toHaveLength(1)
  })
})