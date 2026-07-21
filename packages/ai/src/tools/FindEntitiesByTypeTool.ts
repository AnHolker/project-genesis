import type { Tool } from './Tool'
import type { RuntimeQuery } from '@genesis/shared'

/**
 * FindEntitiesByTypeTool finds all entities matching a given type,
 * or all entities if no type is specified.
 *
 * This tool depends only on the RuntimeQuery interface (from @genesis/shared),
 * not on the concrete Runtime implementation.
 */
export class FindEntitiesByTypeTool implements Tool {
  readonly name = 'find_entities'
  readonly description =
    'Find entities by type. Pass a "type" parameter to filter by entity type (e.g., "tree", "house"). If no type is given, returns all entities in the world. Returns an array of entity objects.'

  constructor(private readonly query: RuntimeQuery) {}

  async execute(input: unknown): Promise<unknown> {
    const type = typeof input === 'object' && input !== null
      ? (input as Record<string, unknown>).type
      : undefined

    const entities = typeof type === 'string' && type.length > 0
      ? this.query.findEntities(type)
      : this.query.findEntities()

    return entities
  }
}