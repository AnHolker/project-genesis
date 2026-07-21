import type { Tool } from './Tool'
import type { RuntimeQuery } from '@genesis/shared'

/**
 * GetWorldSnapshotTool returns a read-only snapshot of the entire world state,
 * including all entities with their positions and IDs.
 *
 * This tool depends only on the RuntimeQuery interface (from @genesis/shared),
 * not on the concrete Runtime implementation.
 */
export class GetWorldSnapshotTool implements Tool {
  readonly name = 'get_world_snapshot'
  readonly description =
    'Get a complete snapshot of the current world including all entities, their types, positions (x, y), and IDs. Useful for understanding the full state of the game world.'

  constructor(private readonly query: RuntimeQuery) {}

  async execute(_input: unknown): Promise<unknown> {
    const snapshot = this.query.getWorldSnapshot()
    return {
      entities: snapshot.entities.map((e) => ({
        id: e.id,
        type: e.type,
        x: e.x,
        y: e.y,
      })),
      entityCount: snapshot.entities.length,
    }
  }
}