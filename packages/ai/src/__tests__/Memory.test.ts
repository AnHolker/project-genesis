import { describe, it, expect } from 'vitest'
import { DefaultMemory } from '../memory/DefaultMemory'

describe('DefaultMemory', () => {
  it('should return the value after set', async () => {
    const memory = new DefaultMemory()

    await memory.set('key1', 'hello')
    const value = await memory.get('key1')

    expect(value).toBe('hello')
  })

  it('should return undefined for a key that does not exist', async () => {
    const memory = new DefaultMemory()

    const value = await memory.get('nonexistent')

    expect(value).toBeUndefined()
  })
})