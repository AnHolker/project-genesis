import type { Entity, World } from './types'

/**
 * RuntimeQuery provides read-only access to the current world state.
 *
 * This interface lives in @genesis/shared so that both @genesis/runtime
 * (implementation) and @genesis/ai (tool consumers) can depend on it
 * without introducing a direct dependency between them.
 *
 * Only read methods are exposed — no mutation APIs.
 */
export interface RuntimeQuery {
  /** Find a single entity by its unique ID. Returns undefined if not found. */
  findEntity(id: string): Entity | undefined

  /** Find all entities matching the given type. If type is omitted, returns all entities. */
  findEntities(type?: string): Entity[]

  /**
   * Get a read-only snapshot of the entire world.
   * The returned World should not be mutated by callers.
   */
  getWorldSnapshot(): Readonly<World>
}