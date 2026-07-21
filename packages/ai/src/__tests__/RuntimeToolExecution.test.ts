import { describe, it, expect } from 'vitest'
import type { RuntimeQuery } from '@genesis/shared'
import type { Entity } from '@genesis/shared'
import { FindEntityTool } from '../tools/FindEntityTool'
import { FindEntitiesByTypeTool } from '../tools/FindEntitiesByTypeTool'
import { GetWorldSnapshotTool } from '../tools/GetWorldSnapshotTool'
import { DefaultToolRegistry } from '../tools/ToolRegistry'
import { MockFindEntityTool } from '../tools/MockFindEntityTool'

// ---------------------------------------------------------------------------
// Mock RuntimeQuery implementation for testing
// ---------------------------------------------------------------------------

function createMockRuntimeQuery(entities: Entity[]): RuntimeQuery {
  return {
    findEntity(id: string): Entity | undefined {
      return entities.find((e) => e.id === id)
    },
    findEntities(type?: string): Entity[] {
      if (type === undefined) return [...entities]
      return entities.filter((e) => e.type === type)
    },
    getWorldSnapshot(): ReturnType<RuntimeQuery['getWorldSnapshot']> {
      return { entities: entities.map((e) => ({ ...e })) }
    },
  }
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const sampleEntities: Entity[] = [
  { id: 'entity-1', type: 'tree', x: 1, y: 2 },
  { id: 'entity-2', type: 'tree', x: 3, y: 4 },
  { id: 'entity-3', type: 'rock', x: 5, y: 6 },
  { id: 'entity-4', type: 'house', x: 7, y: 8 },
]

const tree1Id = 'entity-1'
const tree2Id = 'entity-2'

// ---------------------------------------------------------------------------
// Tool execution against a real world (via mock RuntimeQuery)
// ---------------------------------------------------------------------------

describe('FindEntityTool', () => {
  describe('execution against a populated world', () => {
    it('should find an entity by ID', async () => {
      const query = createMockRuntimeQuery(sampleEntities)
      const tool = new FindEntityTool(query)

      const result = await tool.execute({ id: tree1Id })

      expect(result).toBeDefined()
      expect(result).toHaveProperty('id', tree1Id)
      expect(result).toHaveProperty('type', 'tree')
      expect(result).toHaveProperty('x', 1)
      expect(result).toHaveProperty('y', 2)
    })

    it('should return null for non-existent entity ID', async () => {
      const query = createMockRuntimeQuery(sampleEntities)
      const tool = new FindEntityTool(query)

      const result = await tool.execute({ id: 'nonexistent' })

      expect(result).toBeNull()
    })

    it('should return error when no id parameter is provided', async () => {
      const query = createMockRuntimeQuery(sampleEntities)
      const tool = new FindEntityTool(query)

      const result = await tool.execute({})

      expect(result).toHaveProperty('error')
      expect((result as { error: string }).error).toContain('id')
    })

    it('should return error when input is not an object', async () => {
      const query = createMockRuntimeQuery(sampleEntities)
      const tool = new FindEntityTool(query)

      const result = await tool.execute('not-an-object')

      expect(result).toHaveProperty('error')
    })
  })

  describe('empty world', () => {
    it('should return null for any ID in empty world', async () => {
      const query = createMockRuntimeQuery([])
      const tool = new FindEntityTool(query)

      const result = await tool.execute({ id: 'entity-1' })

      expect(result).toBeNull()
    })
  })

  describe('tool metadata', () => {
    it('should have correct name and description', () => {
      const query = createMockRuntimeQuery([])
      const tool = new FindEntityTool(query)

      expect(tool.name).toBe('find_entity')
      expect(tool.description).toContain('entity')
      expect(tool.description).toContain('ID')
    })
  })
})

// ---------------------------------------------------------------------------
// FindEntitiesByTypeTool
// ---------------------------------------------------------------------------

describe('FindEntitiesByTypeTool', () => {
  describe('execution against a populated world', () => {
    it('should find all entities of a given type', async () => {
      const query = createMockRuntimeQuery(sampleEntities)
      const tool = new FindEntitiesByTypeTool(query)

      const trees = await tool.execute({ type: 'tree' }) as Array<Record<string, unknown>>

      expect(Array.isArray(trees)).toBe(true)
      expect(trees).toHaveLength(2)
      expect(trees[0]).toHaveProperty('id', tree1Id)
      expect(trees[1]).toHaveProperty('id', tree2Id)
    })

    it('should return all entities when type is omitted', async () => {
      const query = createMockRuntimeQuery(sampleEntities)
      const tool = new FindEntitiesByTypeTool(query)

      const all = await tool.execute({}) as Array<unknown>

      expect(Array.isArray(all)).toBe(true)
      expect(all).toHaveLength(4)
    })

    it('should return all entities when input has no type field', async () => {
      const query = createMockRuntimeQuery(sampleEntities)
      const tool = new FindEntitiesByTypeTool(query)

      const all = await tool.execute(null as unknown as Record<string, unknown>)

      expect(Array.isArray(all)).toBe(true)
      expect(all).toHaveLength(4)
    })

    it('should return empty array for non-existent type', async () => {
      const query = createMockRuntimeQuery(sampleEntities)
      const tool = new FindEntitiesByTypeTool(query)

      const result = await tool.execute({ type: 'dragon' })

      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(0)
    })
  })

  describe('empty world', () => {
    it('should return empty array in empty world', async () => {
      const query = createMockRuntimeQuery([])
      const tool = new FindEntitiesByTypeTool(query)

      const result = await tool.execute({ type: 'tree' })
      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(0)
    })

    it('should return empty array when no type given in empty world', async () => {
      const query = createMockRuntimeQuery([])
      const tool = new FindEntitiesByTypeTool(query)

      const result = await tool.execute({})
      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(0)
    })
  })

  describe('tool metadata', () => {
    it('should have correct name and description', () => {
      const query = createMockRuntimeQuery([])
      const tool = new FindEntitiesByTypeTool(query)

      expect(tool.name).toBe('find_entities')
      expect(tool.description).toContain('entities')
      expect(tool.description).toContain('type')
    })
  })
})

// ---------------------------------------------------------------------------
// GetWorldSnapshotTool
// ---------------------------------------------------------------------------

describe('GetWorldSnapshotTool', () => {
  describe('execution against a populated world', () => {
    it('should return a complete world snapshot', async () => {
      const query = createMockRuntimeQuery(sampleEntities)
      const tool = new GetWorldSnapshotTool(query)

      const result = await tool.execute({}) as { entities: Array<Record<string, unknown>>; entityCount: number }

      expect(result.entities).toHaveLength(4)
      expect(result.entityCount).toBe(4)

      const tree1 = result.entities.find((e) => e.id === tree1Id)
      expect(tree1).toBeDefined()
      expect(tree1!.type).toBe('tree')
      expect(tree1!.x).toBe(1)
      expect(tree1!.y).toBe(2)
    })

    it('should include all entity fields in snapshot', async () => {
      const query = createMockRuntimeQuery(sampleEntities)
      const tool = new GetWorldSnapshotTool(query)

      const result = await tool.execute({}) as { entities: Array<Record<string, unknown>> }

      for (const entity of result.entities) {
        expect(entity).toHaveProperty('id')
        expect(entity).toHaveProperty('type')
        expect(entity).toHaveProperty('x')
        expect(entity).toHaveProperty('y')
      }
    })
  })

  describe('empty world', () => {
    it('should return empty snapshot in empty world', async () => {
      const query = createMockRuntimeQuery([])
      const tool = new GetWorldSnapshotTool(query)

      const result = await tool.execute({}) as { entities: Array<unknown>; entityCount: number }

      expect(result.entities).toHaveLength(0)
      expect(result.entityCount).toBe(0)
    })
  })

  describe('snapshot independence', () => {
    it('should work correctly with different world states', async () => {
      // This test verifies that the tool reflects the current state of the query
      // by testing against two different query instances
      const emptyQuery = createMockRuntimeQuery([])
      const toolEmpty = new GetWorldSnapshotTool(emptyQuery)

      const emptyResult = await toolEmpty.execute({}) as { entityCount: number }
      expect(emptyResult.entityCount).toBe(0)

      const populatedQuery = createMockRuntimeQuery(sampleEntities)
      const toolPopulated = new GetWorldSnapshotTool(populatedQuery)

      const populatedResult = await toolPopulated.execute({}) as { entityCount: number }
      expect(populatedResult.entityCount).toBe(4)
    })
  })

  describe('tool metadata', () => {
    it('should have correct name and description', () => {
      const query = createMockRuntimeQuery([])
      const tool = new GetWorldSnapshotTool(query)

      expect(tool.name).toBe('get_world_snapshot')
      expect(tool.description).toContain('world')
      expect(tool.description).toContain('snapshot')
    })
  })
})

// ---------------------------------------------------------------------------
// Registry Integration
// ---------------------------------------------------------------------------

describe('Tool Registry Integration', () => {
  it('should register all runtime-backed tools in the registry', () => {
    const query = createMockRuntimeQuery(sampleEntities)

    const tools = [
      new FindEntityTool(query),
      new FindEntitiesByTypeTool(query),
      new GetWorldSnapshotTool(query),
    ]
    const registry = new DefaultToolRegistry(tools)

    const registered = registry.getTools()
    expect(registered).toHaveLength(3)

    const names = registered.map((t) => t.name).sort()
    expect(names).toEqual(['find_entities', 'find_entity', 'get_world_snapshot'])
  })

  it('should allow lookup and execution of individual tools from registry', async () => {
    const query = createMockRuntimeQuery(sampleEntities)

    const registry = new DefaultToolRegistry([
      new FindEntityTool(query),
      new FindEntitiesByTypeTool(query),
    ])

    const tool = registry.findTool('find_entity')
    expect(tool).toBeDefined()

    const result = await tool!.execute({ id: tree1Id })
    expect(result).toHaveProperty('id', tree1Id)
    expect(result).toHaveProperty('type', 'tree')
  })

  it('should work with ToolCallPlanner via registry', async () => {
    const { ToolCallPlanner } = await import('../planner/ToolCallPlanner')
    const { MockPlannerProvider } = await import('../provider/MockPlannerProvider')
    const { DefaultAIConfiguration } = await import('../config/DefaultAIConfiguration')

    const query = createMockRuntimeQuery(sampleEntities)
    const config = new DefaultAIConfiguration()

    const tools = [new FindEntityTool(query)]
    const registry = new DefaultToolRegistry(tools)
    const provider = new MockPlannerProvider(config)
    const planner = new ToolCallPlanner(provider, registry)

    const result = await planner.plan({ prompt: 'create a tree at 5,3' })

    // Should return valid actions + tool metadata
    expect(result.actions).toHaveLength(1)
    expect(result.metadata).toBeDefined()
    expect(result.metadata!.tools).toContain('find_entity')
  })
})

// ---------------------------------------------------------------------------
// Backward Compatibility
// ---------------------------------------------------------------------------

describe('Backward Compatibility', () => {
  it('should still work with MockFindEntityTool', async () => {
    const tool = new MockFindEntityTool()

    const result = await tool.execute({ id: 'anything' })

    expect(result).toEqual({
      id: 'entity-1',
      type: 'tree',
      x: 5,
      y: 3,
    })
  })

  it('should still work with existing ToolCallPlanner tests', async () => {
    const { ToolCallPlanner } = await import('../planner/ToolCallPlanner')
    const { DefaultAIConfiguration } = await import('../config/DefaultAIConfiguration')
    const { MockPlannerProvider } = await import('../provider/MockPlannerProvider')

    const provider = new MockPlannerProvider(new DefaultAIConfiguration())
    const registry = new DefaultToolRegistry([new MockFindEntityTool()])
    const planner = new ToolCallPlanner(provider, registry)

    const result = await planner.plan({ prompt: 'create a tree' })

    expect(result.actions).toHaveLength(1)
    expect(result.actions[0].type).toBe('CreateEntity')
    expect(result.metadata!.tools).toEqual(['find_entity'])
  })
})