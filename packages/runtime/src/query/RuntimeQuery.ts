import type { Entity, World } from '@genesis/shared'
import type { RuntimeQuery as RuntimeQueryInterface } from '@genesis/shared'

export class RuntimeQuery implements RuntimeQueryInterface {
  constructor(private readonly world: Readonly<World>) {}

  findEntity(id: string): Entity | undefined {
    return this.world.entities.find((e) => e.id === id)
  }

  findEntities(type?: string): Entity[] {
    if (type === undefined) {
      return [...this.world.entities]
    }
    return this.world.entities.filter((e) => e.type === type)
  }

  getWorldSnapshot(): Readonly<World> {
    return { entities: [...this.world.entities] }
  }

  // -----------------------------------------------------------------------
  // Deprecated aliases — kept for backward compatibility
  // -----------------------------------------------------------------------

  /** @deprecated Use findEntity() instead */
  findById(id: string): Entity | undefined {
    return this.findEntity(id)
  }

  /** @deprecated Use findEntities(type) instead */
  findByType(type: string): Entity[] {
    return this.findEntities(type)
  }
}