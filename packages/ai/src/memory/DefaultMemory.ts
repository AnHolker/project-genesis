import type { Memory } from './Memory'

export class DefaultMemory implements Memory {
  private store = new Map<string, unknown>()

  async get(key: string): Promise<unknown> {
    return this.store.get(key)
  }

  async set(key: string, value: unknown): Promise<void> {
    this.store.set(key, value)
  }
}