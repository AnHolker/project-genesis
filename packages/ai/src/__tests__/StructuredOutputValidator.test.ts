import { describe, it, expect } from 'vitest'
import { StructuredOutputValidator } from '../validation/StructuredOutputValidator'

describe('StructuredOutputValidator', () => {
  // --- Root validation ---

  it('should return empty actions when root is not an object', () => {
    const result = StructuredOutputValidator.validate('not an object')
    expect(result.actions).toEqual([])
    expect(result.reasoning).toBe('Response is not an object')
  })

  it('should return empty actions when root is null', () => {
    const result = StructuredOutputValidator.validate(null)
    expect(result.actions).toEqual([])
    expect(result.reasoning).toBe('Response is not an object')
  })

  it('should return empty actions when root is an array', () => {
    const result = StructuredOutputValidator.validate([1, 2, 3])
    expect(result.actions).toEqual([])
    expect(result.reasoning).toBe('Response is not an object')
  })

  // --- actions field validation ---

  it('should return empty actions when actions is not an array', () => {
    const result = StructuredOutputValidator.validate({ actions: 'not-array' })
    expect(result.actions).toEqual([])
    expect(result.reasoning).toBe('actions must be an array')
  })

  it('should return empty actions when actions is missing', () => {
    const result = StructuredOutputValidator.validate({ other: true })
    expect(result.actions).toEqual([])
    expect(result.reasoning).toBe('actions must be an array')
  })

  // --- Valid CreateEntity ---

  it('should accept a valid CreateEntity action', () => {
    const result = StructuredOutputValidator.validate({
      actions: [{ type: 'CreateEntity', entityType: 'tree', x: 1, y: 2 }],
    })
    expect(result.actions).toHaveLength(1)
    expect(result.actions[0]).toEqual({ type: 'CreateEntity', entityType: 'tree', x: 1, y: 2 })
    expect(result.reasoning).toBeUndefined()
  })

  // --- Valid MoveEntity ---

  it('should accept a valid MoveEntity action', () => {
    const result = StructuredOutputValidator.validate({
      actions: [{ type: 'MoveEntity', id: 'entity-1', x: 5, y: 3 }],
    })
    expect(result.actions).toHaveLength(1)
    expect(result.actions[0]).toEqual({ type: 'MoveEntity', id: 'entity-1', x: 5, y: 3 })
    expect(result.reasoning).toBeUndefined()
  })

  // --- Unknown action type ---

  it('should discard unknown action types', () => {
    const result = StructuredOutputValidator.validate({
      actions: [{ type: 'FooAction', name: 'test' }],
    })
    expect(result.actions).toEqual([])
    expect(result.reasoning).toContain('unknown type FooAction')
  })

  // --- Missing required fields ---

  it('should discard CreateEntity with missing entityType', () => {
    const result = StructuredOutputValidator.validate({
      actions: [{ type: 'CreateEntity', x: 1, y: 2 }],
    })
    expect(result.actions).toEqual([])
    expect(result.reasoning).toContain('CreateEntity.entityType must be a string')
  })

  it('should discard CreateEntity with missing x', () => {
    const result = StructuredOutputValidator.validate({
      actions: [{ type: 'CreateEntity', entityType: 'tree', y: 2 }],
    })
    expect(result.actions).toEqual([])
    expect(result.reasoning).toContain('CreateEntity.x must be a number')
  })

  it('should discard MoveEntity with missing id', () => {
    const result = StructuredOutputValidator.validate({
      actions: [{ type: 'MoveEntity', x: 1, y: 2 }],
    })
    expect(result.actions).toEqual([])
    expect(result.reasoning).toContain('MoveEntity.id must be a string')
  })

  // --- Wrong field types ---

  it('should discard CreateEntity with wrong x type', () => {
    const result = StructuredOutputValidator.validate({
      actions: [{ type: 'CreateEntity', entityType: 'tree', x: 'left', y: 2 }],
    })
    expect(result.actions).toEqual([])
    expect(result.reasoning).toContain('CreateEntity.x must be a number')
  })

  it('should discard MoveEntity with non-string id', () => {
    const result = StructuredOutputValidator.validate({
      actions: [{ type: 'MoveEntity', id: 123, x: 1, y: 2 }],
    })
    expect(result.actions).toEqual([])
    expect(result.reasoning).toContain('MoveEntity.id must be a string')
  })

  // --- Mixed valid + invalid ---

  it('should preserve valid actions and discard invalid ones', () => {
    const result = StructuredOutputValidator.validate({
      actions: [
        { type: 'CreateEntity', entityType: 'tree', x: 1, y: 2 },
        { type: 'FooAction', name: 'test' },
        { type: 'MoveEntity', id: 123, x: 3, y: 4 },
      ],
    })
    expect(result.actions).toHaveLength(1)
    expect(result.actions[0].type).toBe('CreateEntity')
    expect(result.reasoning).toContain('Discarded 2 invalid action(s)')
    expect(result.reasoning).toContain('unknown type FooAction')
    expect(result.reasoning).toContain('MoveEntity.id must be a string')
  })

  it('should collect errors from multiple invalid CreateEntity actions', () => {
    const result = StructuredOutputValidator.validate({
      actions: [
        { type: 'CreateEntity', entityType: 42, x: 1, y: 2 },
        { type: 'CreateEntity', entityType: 'tree', x: 'left', y: 2 },
      ],
    })
    expect(result.actions).toEqual([])
    expect(result.reasoning).toContain('CreateEntity.entityType must be a string')
    expect(result.reasoning).toContain('CreateEntity.x must be a number')
  })

  // --- Non-object action entries ---

  it('should discard non-object action entries', () => {
    const result = StructuredOutputValidator.validate({
      actions: ['string-action', 42, null, true],
    })
    expect(result.actions).toEqual([])
    expect(result.reasoning).toContain('action must be an object')
  })

  // --- Empty actions array ---

  it('should return empty actions for empty array', () => {
    const result = StructuredOutputValidator.validate({ actions: [] })
    expect(result.actions).toEqual([])
    expect(result.reasoning).toBeUndefined()
  })

  // --- Multiple valid actions ---

  it('should accept multiple valid actions', () => {
    const result = StructuredOutputValidator.validate({
      actions: [
        { type: 'CreateEntity', entityType: 'tree', x: 1, y: 2 },
        { type: 'MoveEntity', id: 'entity-1', x: 5, y: 3 },
        { type: 'CreateEntity', entityType: 'house', x: 8, y: 4 },
      ],
    })
    expect(result.actions).toHaveLength(3)
    expect(result.reasoning).toBeUndefined()
  })

  // --- Action without type field ---

  it('should discard action without type field', () => {
    const result = StructuredOutputValidator.validate({
      actions: [{ entityType: 'tree', x: 1, y: 2 }],
    })
    expect(result.actions).toEqual([])
    expect(result.reasoning).toContain('action.type must be a string')
  })

  // --- Action with numeric type ---

  it('should discard action with numeric type', () => {
    const result = StructuredOutputValidator.validate({
      actions: [{ type: 123 }],
    })
    expect(result.actions).toEqual([])
    expect(result.reasoning).toContain('action.type must be a string')
  })
})
