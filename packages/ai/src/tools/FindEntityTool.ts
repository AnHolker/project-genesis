import type { Tool } from './Tool'
import type { RuntimeQuery } from '@genesis/shared'

/**
 * FindEntityTool finds a single entity by its unique ID.
 *
 * This tool depends only on the RuntimeQuery interface (from @genesis/shared),
 * not on the concrete Runtime implementation. The AI layer remains unaware
 * of Runtime internals.
 */
export class FindEntityTool implements Tool {
  readonly name = 'find_entity'
  readonly description =
    'Find an entity by its unique ID. Returns entity details including type, position (x, y), and ID. Returns null if no entity with the given ID exists.'

  constructor(private readonly query: RuntimeQuery) {}

  async execute(input: unknown): Promise<unknown> {
    const id = typeof input === 'object' && input !== null
      ? (input as Record<string, unknown>).id
      : undefined

    if (typeof id !== 'string' || id.length === 0) {
      return { error: 'find_entity requires an "id" parameter (string)' }
    }

    const entity = this.query.findEntity(id)
    return entity ?? null
  }
}