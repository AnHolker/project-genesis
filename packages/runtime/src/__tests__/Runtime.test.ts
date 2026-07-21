import { describe, it, expect } from 'vitest'
import { Runtime } from '../runtime'

function makeCreateAction(entityType: string, x: number, y: number) {
  return { type: 'CreateEntity' as const, entityType, x, y }
}

function makeMoveAction(id: string, x: number, y: number) {
  return { type: 'MoveEntity' as const, id, x, y }
}

describe('Runtime', () => {
  describe('CreateEntity', () => {
    it('should add an entity to the world', () => {
      const runtime = new Runtime()
      expect(runtime.world.entities).toHaveLength(0)

      runtime.applyActions([makeCreateAction('tree', 1, 2)])

      expect(runtime.world.entities).toHaveLength(1)
      const entity = runtime.world.entities[0]
      expect(entity.type).toBe('tree')
      expect(entity.x).toBe(1)
      expect(entity.y).toBe(2)
      expect(entity.id).toBeTruthy()
    })
  })

  describe('MoveEntity', () => {
    it('should update an existing entity position', () => {
      const runtime = new Runtime()
      runtime.applyActions([makeCreateAction('tree', 0, 0)])

      const entity = runtime.world.entities[0]
      const entityId = entity.id

      runtime.applyActions([makeMoveAction(entityId, 5, 3)])

      expect(runtime.world.entities).toHaveLength(1)
      expect(runtime.world.entities[0].x).toBe(5)
      expect(runtime.world.entities[0].y).toBe(3)
    })
  })

  describe('Unknown Action', () => {
    it('should not crash and world remains valid', () => {
      const runtime = new Runtime()

      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      runtime.applyActions([{ type: 'UnknownType' }] as any)
      }).not.toThrow()

      expect(runtime.world).toBeDefined()
      expect(runtime.world.entities).toEqual([])
    })

    it('should not affect a non-empty world', () => {
      const runtime = new Runtime()
      runtime.applyActions([makeCreateAction('tree', 0, 0)])
      expect(runtime.world.entities).toHaveLength(1)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      runtime.applyActions([{ type: 'UnknownType' }] as any)

      expect(runtime.world.entities).toHaveLength(1)
    })
  })

  describe('Multiple Actions', () => {
    it('should process create-move-create in sequence', () => {
      const runtime = new Runtime()

      // Create entity A
      runtime.applyActions([makeCreateAction('tree', 1, 1)])
      expect(runtime.world.entities).toHaveLength(1)
      const entityAId = runtime.world.entities[0].id

      // Move entity A
      runtime.applyActions([makeMoveAction(entityAId, 10, 20)])
      expect(runtime.world.entities).toHaveLength(1)
      expect(runtime.world.entities[0].x).toBe(10)
      expect(runtime.world.entities[0].y).toBe(20)

      // Create entity B
      runtime.applyActions([makeCreateAction('tree', 5, 5)])

      // Final state
      expect(runtime.world.entities).toHaveLength(2)
      expect(runtime.world.entities[0].id).toBe(entityAId)
      expect(runtime.world.entities[0].x).toBe(10)
      expect(runtime.world.entities[0].y).toBe(20)
      expect(runtime.world.entities[1].type).toBe('tree')
      expect(runtime.world.entities[1].x).toBe(5)
      expect(runtime.world.entities[1].y).toBe(5)
    })
  })

  describe('Query', () => {
    describe('findById', () => {
      it('should find an entity by id', () => {
        const runtime = new Runtime()
        runtime.applyActions([makeCreateAction('tree', 1, 2)])
        const id = runtime.world.entities[0].id

        const entity = runtime.query.findById(id)

        expect(entity).toBeDefined()
        expect(entity!.id).toBe(id)
        expect(entity!.type).toBe('tree')
        expect(entity!.x).toBe(1)
        expect(entity!.y).toBe(2)
      })

      it('should return undefined when id does not exist', () => {
        const runtime = new Runtime()

        const entity = runtime.query.findById('nonexistent')

        expect(entity).toBeUndefined()
      })
    })

    describe('findByType', () => {
      it('should return entities of the given type', () => {
        const runtime = new Runtime()
        runtime.applyActions([makeCreateAction('tree', 1, 2)])
        runtime.applyActions([makeCreateAction('tree', 3, 4)])
        runtime.applyActions([makeCreateAction('rock', 5, 6)])

        const trees = runtime.query.findByType('tree')

        expect(trees).toHaveLength(2)
        expect(trees[0].type).toBe('tree')
        expect(trees[1].type).toBe('tree')
      })

      it('should return empty array when type does not exist', () => {
        const runtime = new Runtime()

        const result = runtime.query.findByType('nonexistent')

        expect(result).toEqual([])
      })
    })

    // -------------------------------------------------------------------
    // RuntimeQuery interface methods
    // -------------------------------------------------------------------

    describe('findEntity (interface method)', () => {
      it('should find an entity by id via the interface method', () => {
        const runtime = new Runtime()
        runtime.applyActions([makeCreateAction('tree', 1, 2)])
        const id = runtime.world.entities[0].id

        const entity = runtime.query.findEntity(id)

        expect(entity).toBeDefined()
        expect(entity!.id).toBe(id)
        expect(entity!.type).toBe('tree')
        expect(entity!.x).toBe(1)
        expect(entity!.y).toBe(2)
      })

      it('should return undefined for non-existent entity', () => {
        const runtime = new Runtime()
        expect(runtime.query.findEntity('ghost')).toBeUndefined()
      })
    })

    describe('findEntities (interface method)', () => {
      it('should return all entities when type is omitted', () => {
        const runtime = new Runtime()
        runtime.applyActions([makeCreateAction('tree', 1, 2)])
        runtime.applyActions([makeCreateAction('rock', 3, 4)])

        const all = runtime.query.findEntities()

        expect(all).toHaveLength(2)
      })

      it('should filter by type when type is provided', () => {
        const runtime = new Runtime()
        runtime.applyActions([makeCreateAction('tree', 1, 2)])
        runtime.applyActions([makeCreateAction('tree', 3, 4)])
        runtime.applyActions([makeCreateAction('rock', 5, 6)])

        const trees = runtime.query.findEntities('tree')

        expect(trees).toHaveLength(2)
        expect(trees[0].type).toBe('tree')
        expect(trees[1].type).toBe('tree')
      })

      it('should return empty array when type has no matches', () => {
        const runtime = new Runtime()
        expect(runtime.query.findEntities('ghost')).toEqual([])
      })

      it('should return a new array (not the internal reference)', () => {
        const runtime = new Runtime()
        runtime.applyActions([makeCreateAction('tree', 1, 2)])

        const all = runtime.query.findEntities()
        expect(all).toHaveLength(1)

        // Mutating the returned array should not affect the world
        all.pop()
        expect(runtime.world.entities).toHaveLength(1)
      })
    })

    describe('getWorldSnapshot', () => {
      it('should return a snapshot of the current world', () => {
        const runtime = new Runtime()
        runtime.applyActions([makeCreateAction('tree', 1, 2)])
        runtime.applyActions([makeCreateAction('rock', 3, 4)])

        const snapshot = runtime.query.getWorldSnapshot()

        expect(snapshot.entities).toHaveLength(2)
        expect(snapshot.entities[0].type).toBe('tree')
        expect(snapshot.entities[1].type).toBe('rock')
      })

      it('should return empty world when no entities exist', () => {
        const runtime = new Runtime()
        const snapshot = runtime.query.getWorldSnapshot()
        expect(snapshot.entities).toEqual([])
      })

      it('should return a copy (not the internal reference)', () => {
        const runtime = new Runtime()
        runtime.applyActions([makeCreateAction('tree', 1, 2)])

        const snapshot = runtime.query.getWorldSnapshot()
        expect(snapshot.entities).toHaveLength(1)

        // Mutating the snapshot entities should not affect the world
        ;(snapshot.entities as Array<unknown>).pop()
        expect(runtime.world.entities).toHaveLength(1)
      })
    })
  })
})