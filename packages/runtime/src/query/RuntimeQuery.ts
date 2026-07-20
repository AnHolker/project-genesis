import type { Entity, World } from '@genesis/shared'

export class RuntimeQuery {
  constructor(private readonly world: Readonly<World>) {}

  findById(id: string): Entity | undefined {
    return this.world.entities.find((e) => e.id === id)
  }

  findByType(type: string): Entity[] {
    return this.world.entities.filter((e) => e.type === type)
  }
}